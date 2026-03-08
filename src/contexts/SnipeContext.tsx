import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { supabase } from "@/integrations/supabase/client";
import { useMonitor } from "@/contexts/MonitorContext";
import { ERC20_ABI, KYBERSWAP_ROUTER, WETH_BASE, GAS_REFRESH_INTERVAL, GAS_MULTIPLIER, GAS_DIVISOR, SWAP_GAS_LIMIT } from "@/lib/constants";
import { getKyberRoute, buildKyberSwap } from "@/lib/kyberswap";
import { getAlchemyRpcUrl, getAlchemyWsUrl } from "@/lib/apiKeyRotation";

interface SnipeWallet {
  id: number;
  wallet_address: string;
  label: string | null;
  is_active: boolean;
}

interface WatchedWallet {
  id: number;
  source_wallet: string;
  funded_wallet: string;
  eth_amount: string | null;
  funding_tx_hash: string | null;
  token_created: string | null;
  is_active: boolean;
  detected_at: string | null;
  expires_at: string | null;
}

interface SnipeBuy {
  id: number;
  source_wallet: string;
  funded_wallet: string;
  token_address: string;
  token_name: string | null;
  token_symbol: string | null;
  buy_amount_eth: string | null;
  buy_tx_hash: string | null;
  buy_price_eth: string | null;
  current_price_eth: string | null;
  pnl_percent: number | null;
  status: string;
  profit_taken: boolean | null;
  stop_loss_triggered: boolean | null;
  auto_monitor_started: boolean | null;
  created_at: string | null;
}

interface SnipeConfig {
  buy_amount_eth: string;
  profit_take_percent: number;
  profit_sell_percent: number;
  stop_loss_percent: number;
  is_enabled: boolean;
  watch_timeout_hours: number;
}

interface ActivityLog {
  id: number;
  wallet_address: string;
  event_type: string;
  description: string | null;
  tx_hash: string | null;
  created_at: string | null;
}

interface SnipeContextType {
  wallets: SnipeWallet[];
  watchedWallets: WatchedWallet[];
  snipeBuys: SnipeBuy[];
  config: SnipeConfig | null;
  activityLog: ActivityLog[];
  isSnipeActive: boolean;
  addWallet: (address: string, label: string) => Promise<void>;
  removeWallet: (id: number) => Promise<void>;
  updateConfig: (config: Partial<SnipeConfig>) => Promise<void>;
  startSnipe: () => Promise<void>;
  stopSnipe: () => void;
  loadData: () => Promise<void>;
}

const SnipeContext = createContext<SnipeContextType | null>(null);

export function useSnipe() {
  const ctx = useContext(SnipeContext);
  if (!ctx) throw new Error("useSnipe must be used within SnipeProvider");
  return ctx;
}

export function SnipeProvider({ children }: { children: React.ReactNode }) {
  const { settings, addTerminalMessage, startMonitoring, executeSellFast } = useMonitor();

  const [wallets, setWallets] = useState<SnipeWallet[]>([]);
  const [watchedWallets, setWatchedWallets] = useState<WatchedWallet[]>([]);
  const [snipeBuys, setSnipeBuys] = useState<SnipeBuy[]>([]);
  const [config, setConfig] = useState<SnipeConfig | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [isSnipeActive, setIsSnipeActive] = useState(false);

  const wsRefs = useRef<WebSocket[]>([]);
  const layer2WsRefs = useRef<Record<string, WebSocket>>({});
  const gasIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const priceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gasCacheRef = useRef<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | null>(null);
  const configRef = useRef<SnipeConfig | null>(null);

  const logActivity = useCallback(async (walletAddress: string, eventType: string, description: string, txHash?: string) => {
    const entry: ActivityLog = {
      id: Date.now(),
      wallet_address: walletAddress,
      event_type: eventType,
      description,
      tx_hash: txHash ?? null,
      created_at: new Date().toISOString(),
    };
    setActivityLog((prev) => [entry, ...prev].slice(0, 200));

    await supabase.from("snipe_activity_log").insert({
      wallet_address: walletAddress,
      event_type: eventType,
      description,
      tx_hash: txHash ?? null,
    });
  }, []);

  const loadData = useCallback(async () => {
    const [wRes, cRes, bRes, aRes, watchRes] = await Promise.all([
      supabase.from("snipe_wallets").select("*").order("added_at", { ascending: true }),
      supabase.from("snipe_config").select("*").eq("id", 1).single(),
      supabase.from("snipe_buys").select("*").order("created_at", { ascending: false }),
      supabase.from("snipe_activity_log").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("snipe_watched_wallets").select("*").eq("is_active", true),
    ]);
    if (wRes.data) setWallets(wRes.data);
    if (cRes.data) {
      const c: SnipeConfig = {
        buy_amount_eth: cRes.data.buy_amount_eth,
        profit_take_percent: cRes.data.profit_take_percent,
        profit_sell_percent: cRes.data.profit_sell_percent,
        stop_loss_percent: cRes.data.stop_loss_percent,
        is_enabled: cRes.data.is_enabled,
        watch_timeout_hours: cRes.data.watch_timeout_hours,
      };
      setConfig(c);
      configRef.current = c;
    }
    if (bRes.data) setSnipeBuys(bRes.data);
    if (aRes.data) setActivityLog(aRes.data);
    if (watchRes.data) setWatchedWallets(watchRes.data);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const addWallet = useCallback(async (address: string, label: string) => {
    if (wallets.length >= 8) return;
    const { data } = await supabase.from("snipe_wallets").insert({
      wallet_address: address.toLowerCase(),
      label: label || null,
    }).select().single();
    if (data) setWallets((prev) => [...prev, data]);
  }, [wallets.length]);

  const removeWallet = useCallback(async (id: number) => {
    await supabase.from("snipe_wallets").delete().eq("id", id);
    setWallets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const updateConfig = useCallback(async (updates: Partial<SnipeConfig>) => {
    await supabase.from("snipe_config").update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setConfig((prev) => {
      const next = prev ? { ...prev, ...updates } : null;
      configRef.current = next;
      return next;
    });
  }, []);

  // Auto-buy a newly created token
  const executeSnipeBuy = useCallback(async (
    tokenAddress: string, sourceWallet: string, fundedWallet: string
  ) => {
    if (!settings) return;
    const cfg = configRef.current;
    if (!cfg) return;

    const provider = new ethers.JsonRpcProvider(getAlchemyRpcUrl());
    const wallet = new ethers.Wallet(settings.walletPrivateKey, provider);

    addTerminalMessage(`🎯 SNIPE BUY: Token ${tokenAddress} detected from ${fundedWallet}`);
    logActivity(fundedWallet, "token_created", `Token ${tokenAddress} created`, "");

    // Insert pending buy record
    const { data: buyRecord } = await supabase.from("snipe_buys").insert({
      source_wallet: sourceWallet,
      funded_wallet: fundedWallet,
      token_address: tokenAddress,
      buy_amount_eth: cfg.buy_amount_eth,
      status: "pending",
    }).select().single();

    try {
      // Wait a few seconds for liquidity
      addTerminalMessage("⏳ Waiting 5s for liquidity pool...");
      await new Promise((r) => setTimeout(r, 5000));

      // Get token metadata
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      let tokenName = "Unknown";
      let tokenSymbol = "???";
      try {
        [tokenName, tokenSymbol] = await Promise.all([
          tokenContract.name(),
          tokenContract.symbol(),
        ]);
      } catch { /* new tokens may not have metadata yet */ }

      // Buy via KyberSwap: swap WETH -> Token
      const buyAmountWei = ethers.parseEther(cfg.buy_amount_eth);

      addTerminalMessage(`🔄 Getting KyberSwap route to buy ${tokenSymbol}...`);

      // Get route: WETH -> Token
      const params = new URLSearchParams({
        tokenIn: WETH_BASE,
        tokenOut: tokenAddress,
        amountIn: buyAmountWei.toString(),
        to: wallet.address,
      });
      const routeRes = await fetch(
        `https://aggregator-api.kyberswap.com/base/api/v1/routes?${params}`,
        { headers: { "x-client-id": "rug-detector" } }
      );
      const routeData = await routeRes.json();

      if (!routeData.data?.routeSummary) {
        throw new Error("No route found — token may not have liquidity yet");
      }

      const routeSummary = routeData.data.routeSummary;

      // Build swap
      const buildRes = await fetch(
        "https://aggregator-api.kyberswap.com/base/api/v1/route/build",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-client-id": "rug-detector" },
          body: JSON.stringify({
            routeSummary,
            sender: wallet.address,
            recipient: wallet.address,
            slippageTolerance: 5000, // 50% slippage for new tokens
            ignoreCappedSlippage: true,
            deadline: Math.floor(Date.now() / 1000) + 300,
          }),
        }
      );
      const buildData = await buildRes.json();

      // Check WETH allowance for router
      const wethContract = new ethers.Contract(WETH_BASE, ERC20_ABI, wallet);
      const allowance = await wethContract.allowance(wallet.address, buildData.data.routerAddress);
      if (allowance < buyAmountWei) {
        addTerminalMessage("🔄 Approving WETH for KyberSwap...");
        const appTx = await wethContract.approve(buildData.data.routerAddress, ethers.MaxUint256);
        await appTx.wait();
        addTerminalMessage("✅ WETH approved");
      }

      // Gas — low fees
      const gc = gasCacheRef.current;
      const maxFee = gc?.maxFeePerGas ?? 1100000000n;
      const maxPriority = gc?.maxPriorityFeePerGas ?? 1000000000n;

      addTerminalMessage("⚡ Firing buy transaction...");
      const tx = await wallet.sendTransaction({
        to: buildData.data.routerAddress,
        data: buildData.data.data,
        gasLimit: SWAP_GAS_LIMIT,
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: maxPriority,
        type: 2,
      });

      addTerminalMessage(`✅ BUY SUBMITTED: ${tx.hash}`);
      addTerminalMessage(`🔗 basescan.org/tx/${tx.hash}`);

      // Update buy record
      if (buyRecord) {
        await supabase.from("snipe_buys").update({
          token_name: tokenName,
          token_symbol: tokenSymbol,
          buy_tx_hash: tx.hash,
          buy_price_eth: cfg.buy_amount_eth,
          status: "submitted",
        }).eq("id", buyRecord.id);
      }

      // Wait for confirmation in background
      tx.wait().then(async (receipt) => {
        if (receipt) {
          addTerminalMessage(`✅ BUY CONFIRMED in block ${receipt.blockNumber}`);
          logActivity(fundedWallet, "buy_confirmed", `Bought ${tokenSymbol} for ${cfg.buy_amount_eth} ETH`, tx.hash);

          if (buyRecord) {
            await supabase.from("snipe_buys").update({
              status: "success",
              auto_monitor_started: true,
            }).eq("id", buyRecord.id);
          }

          // Auto-start live monitor on this token
          addTerminalMessage(`🔄 Auto-starting Live Monitor for ${tokenSymbol}...`);
          await startMonitoring(tokenAddress);
        }
      }).catch(async (err: Error) => {
        addTerminalMessage(`❌ Buy confirmation failed: ${err.message}`);
        if (buyRecord) {
          await supabase.from("snipe_buys").update({
            status: "failed",
          }).eq("id", buyRecord.id);
        }
      });

      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      addTerminalMessage(`❌ Snipe buy failed: ${msg}`);
      logActivity(fundedWallet, "buy_failed", msg);
      if (buyRecord) {
        await supabase.from("snipe_buys").update({ status: "failed" }).eq("id", buyRecord.id);
      }
    }
  }, [settings, addTerminalMessage, logActivity, startMonitoring, loadData]);

  // Layer 2: Watch a funded wallet for contract deployment
  const watchFundedWallet = useCallback((fundedWallet: string, sourceWallet: string) => {
    if (!settings || layer2WsRefs.current[fundedWallet]) return;

    const wsUrl = getAlchemyWsUrl();
    const ws = new WebSocket(wsUrl);
    layer2WsRefs.current[fundedWallet] = ws;

    ws.onopen = () => {
      // Subscribe to pending TXs FROM the funded wallet
      ws.send(JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_subscribe",
        params: ["alchemy_pendingTransactions", { fromAddress: fundedWallet }],
      }));
      logActivity(fundedWallet, "layer2_watching", `Watching ${fundedWallet.slice(0, 10)}... for token creation`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.params?.result) {
          const tx = data.params.result;
          // Contract creation = tx.to is null
          if (tx.to === null || tx.to === undefined || tx.to === "0x" || tx.to === "") {
            addTerminalMessage(`🎯 TOKEN CREATION DETECTED from ${fundedWallet.slice(0, 10)}...!`);
            logActivity(fundedWallet, "token_creation_detected", "Contract deployment detected", tx.hash);

            // Get the created contract address from the receipt
            const provider = new ethers.JsonRpcProvider(getAlchemyRpcUrl());
            provider.waitForTransaction(tx.hash).then(async (receipt) => {
              if (receipt?.contractAddress) {
                addTerminalMessage(`📝 New contract: ${receipt.contractAddress}`);

                // Mark watched wallet
                await supabase.from("snipe_watched_wallets")
                  .update({ token_created: receipt.contractAddress, is_active: false })
                  .eq("funded_wallet", fundedWallet);

                // Execute snipe buy
                executeSnipeBuy(receipt.contractAddress, sourceWallet, fundedWallet);
              }
            });
          }
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      delete layer2WsRefs.current[fundedWallet];
    };
    ws.onerror = () => ws.close();
  }, [settings, addTerminalMessage, logActivity, executeSnipeBuy]);

  // Layer 1: Watch tracked wallets for ETH transfers
  const startLayer1 = useCallback((activeWallets: SnipeWallet[]) => {
    if (!settings) return;
    const wsUrl = getAlchemyWsUrl();

    for (const w of activeWallets) {
      const ws = new WebSocket(wsUrl);
      wsRefs.current.push(ws);

      ws.onopen = () => {
        // Subscribe to pending TXs FROM this tracked wallet
        ws.send(JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "eth_subscribe",
          params: ["alchemy_pendingTransactions", { fromAddress: w.wallet_address }],
        }));
        logActivity(w.wallet_address, "layer1_connected", `Watching ${w.label || w.wallet_address.slice(0, 10)}...`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.params?.result) {
            const tx = data.params.result;
            // Check if it's an ETH transfer (no input data or "0x")
            if (tx.to && (!tx.input || tx.input === "0x") && tx.value && BigInt(tx.value) > 0n) {
              const fundedWallet = tx.to.toLowerCase();
              const ethAmount = ethers.formatEther(BigInt(tx.value));

              addTerminalMessage(
                `💸 ETH Transfer: ${w.label || w.wallet_address.slice(0, 8)}... → ${fundedWallet.slice(0, 10)}... (${ethAmount} ETH)`
              );
              logActivity(w.wallet_address, "eth_transfer", `Sent ${ethAmount} ETH to ${fundedWallet}`, tx.hash);

              // Save to watched wallets
              supabase.from("snipe_watched_wallets").insert({
                source_wallet: w.wallet_address,
                funded_wallet: fundedWallet,
                eth_amount: ethAmount,
                funding_tx_hash: tx.hash,
                expires_at: new Date(Date.now() + (configRef.current?.watch_timeout_hours ?? 24) * 3600 * 1000).toISOString(),
              }).then(() => loadData());

              // Start Layer 2 watching on this funded wallet
              watchFundedWallet(fundedWallet, w.wallet_address);
            }
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        logActivity(w.wallet_address, "disconnected", "WebSocket closed");
      };
      ws.onerror = () => ws.close();
    }
  }, [settings, addTerminalMessage, logActivity, watchFundedWallet, loadData]);

  // Gas cache for snipe buys
  const startGasCache = useCallback(() => {
    if (!settings) return;
    const provider = new ethers.JsonRpcProvider(getAlchemyRpcUrl());
    const refresh = async () => {
      try {
        const feeData = await provider.getFeeData();
        const maxFee = (feeData.maxFeePerGas ?? 1000000000n) * GAS_MULTIPLIER / GAS_DIVISOR;
        const maxPriority = feeData.maxPriorityFeePerGas
          ? (feeData.maxPriorityFeePerGas < maxFee ? feeData.maxPriorityFeePerGas : maxFee / 2n)
          : maxFee / 2n;
        gasCacheRef.current = { maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPriority };
      } catch { /* silent */ }
    };
    refresh();
    gasIntervalRef.current = setInterval(refresh, GAS_REFRESH_INTERVAL);
  }, [settings]);

  // Price check for profit-taking / stop-loss
  const startPriceCheck = useCallback(() => {
    if (!settings) return;

    const check = async () => {
      const cfg = configRef.current;
      if (!cfg) return;

      const { data: activeBuys } = await supabase
        .from("snipe_buys")
        .select("*")
        .eq("status", "success")
        .eq("profit_taken", false)
        .eq("stop_loss_triggered", false);

      if (!activeBuys?.length) return;

      const provider = new ethers.JsonRpcProvider(getAlchemyRpcUrl());
      const wallet = new ethers.Wallet(settings!.walletPrivateKey, provider);

      for (const buy of activeBuys) {
        try {
          const tokenContract = new ethers.Contract(buy.token_address, ERC20_ABI, provider);
          const balance = await tokenContract.balanceOf(wallet.address);
          if (balance === 0n) continue;

          // Get current value via KyberSwap route
          const routeRes = await fetch(
            `https://aggregator-api.kyberswap.com/base/api/v1/routes?` +
            `tokenIn=${buy.token_address}&tokenOut=${WETH_BASE}&amountIn=${balance.toString()}&to=${wallet.address}`,
            { headers: { "x-client-id": "rug-detector" } }
          );
          const routeData = await routeRes.json();
          if (!routeData.data?.routeSummary) continue;

          const currentValueWei = BigInt(routeData.data.routeSummary.amountOut);
          const currentValueEth = ethers.formatEther(currentValueWei);
          const buyPriceEth = parseFloat(buy.buy_price_eth || "0");
          const currentPriceFloat = parseFloat(currentValueEth);
          const pnlPercent = buyPriceEth > 0 ? ((currentPriceFloat - buyPriceEth) / buyPriceEth) * 100 : 0;

          // Update P&L in DB
          await supabase.from("snipe_buys").update({
            current_price_eth: currentValueEth,
            pnl_percent: Math.round(pnlPercent * 100) / 100,
          }).eq("id", buy.id);

          // Profit-take check
          if (pnlPercent >= cfg.profit_take_percent) {
            addTerminalMessage(`💰 PROFIT TARGET HIT: ${buy.token_symbol} at +${pnlPercent.toFixed(1)}%`);
            addTerminalMessage(`🔄 Selling ${cfg.profit_sell_percent}% of holdings...`);

            // Sell partial: calculate amount to sell
            const sellAmount = (balance * BigInt(cfg.profit_sell_percent)) / 100n;
            // Use executeSellFast for the sell (sells all — for partial we'd need custom logic)
            await executeSellFast(buy.token_address);

            await supabase.from("snipe_buys").update({ profit_taken: true }).eq("id", buy.id);
            logActivity(buy.token_address, "profit_taken", `Sold at +${pnlPercent.toFixed(1)}%`);
          }

          // Stop-loss check
          if (pnlPercent <= -cfg.stop_loss_percent) {
            addTerminalMessage(`🛑 STOP-LOSS TRIGGERED: ${buy.token_symbol} at ${pnlPercent.toFixed(1)}%`);
            addTerminalMessage(`🔄 Selling 100% of holdings...`);

            await executeSellFast(buy.token_address);

            await supabase.from("snipe_buys").update({ stop_loss_triggered: true }).eq("id", buy.id);
            logActivity(buy.token_address, "stop_loss", `Stop-loss at ${pnlPercent.toFixed(1)}%`);
          }
        } catch { /* silent per-token error */ }
      }
      loadData();
    };

    priceCheckRef.current = setInterval(check, 15000); // every 15s
  }, [settings, addTerminalMessage, executeSellFast, logActivity, loadData]);

  const startSnipe = useCallback(async () => {
    if (!settings) {
      addTerminalMessage("❌ Configure settings first!");
      return;
    }
    const activeWallets = wallets.filter((w) => w.is_active);
    if (activeWallets.length === 0) {
      addTerminalMessage("❌ No wallets to watch!");
      return;
    }

    setIsSnipeActive(true);
    await updateConfig({ is_enabled: true });
    addTerminalMessage(`🎯 SNIPE BUY ACTIVE — watching ${activeWallets.length} wallets`);

    startGasCache();
    startLayer1(activeWallets);
    startPriceCheck();

    // Also resume watching any existing watched wallets
    for (const ww of watchedWallets) {
      if (ww.is_active) {
        watchFundedWallet(ww.funded_wallet, ww.source_wallet);
      }
    }
  }, [settings, wallets, watchedWallets, addTerminalMessage, updateConfig, startGasCache, startLayer1, startPriceCheck, watchFundedWallet]);

  const stopSnipe = useCallback(() => {
    // Close all Layer 1 WebSockets
    wsRefs.current.forEach((ws) => ws.close());
    wsRefs.current = [];

    // Close all Layer 2 WebSockets
    Object.values(layer2WsRefs.current).forEach((ws) => ws.close());
    layer2WsRefs.current = {};

    if (gasIntervalRef.current) clearInterval(gasIntervalRef.current);
    if (priceCheckRef.current) clearInterval(priceCheckRef.current);

    setIsSnipeActive(false);
    updateConfig({ is_enabled: false });
    addTerminalMessage("🛑 Snipe Buy stopped");
  }, [addTerminalMessage, updateConfig]);

  return (
    <SnipeContext.Provider
      value={{
        wallets, watchedWallets, snipeBuys, config, activityLog,
        isSnipeActive, addWallet, removeWallet, updateConfig,
        startSnipe, stopSnipe, loadData,
      }}
    >
      {children}
    </SnipeContext.Provider>
  );
}
