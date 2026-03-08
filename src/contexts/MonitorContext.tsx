import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { supabase } from "@/integrations/supabase/client";
import {
  TokenInfo, DangerTransfer, WalletInfo, GasCache, KyberCache,
  PrebuiltTx, AppSettings, ConnectionStatus, TerminalMessage,
} from "@/lib/types";
import {
  ERC20_ABI, KYBERSWAP_ROUTER, TRANSFER_SELECTOR, TRANSFER_TOPIC,
  MAX_DANGER_CARDS, MAX_WALLET_TRANSFERS, GAS_REFRESH_INTERVAL,
  KYBER_REFRESH_INTERVAL, PENDING_CLEANUP_INTERVAL, WS_RECONNECT_DELAY,
} from "@/lib/constants";
import { getKyberRoute, buildKyberSwap } from "@/lib/kyberswap";
import { playAlertBeep } from "@/lib/audio";
import { setApiKeys, getAlchemyRpcUrl, getAlchemyWsUrl, markKeyRateLimited } from "@/lib/apiKeyRotation";

interface MonitorContextType {
  status: ConnectionStatus;
  tokenInfo: TokenInfo | null;
  dangerTransfers: DangerTransfer[];
  walletRegistry: React.MutableRefObject<Record<string, WalletInfo>>;
  settings: AppSettings | null;
  sellReady: boolean;
  needsApproval: boolean;
  terminalMessages: TerminalMessage[];
  reconnectAttempt: number;
  startMonitoring: (tokenAddress: string) => Promise<void>;
  stopMonitoring: () => Promise<void>;
  loadSettings: () => Promise<AppSettings | null>;
  executeSellFast: (tokenAddress: string) => Promise<void>;
  addTerminalMessage: (text: string) => void;
  sellsExecuted: number;
}

const MonitorContext = createContext<MonitorContextType | null>(null);

export function useMonitor() {
  const ctx = useContext(MonitorContext);
  if (!ctx) throw new Error("useMonitor must be used within MonitorProvider");
  return ctx;
}

export function MonitorProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [dangerTransfers, setDangerTransfers] = useState<DangerTransfer[]>([]);
  const [sellReady, setSellReady] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [terminalMessages, setTerminalMessages] = useState<TerminalMessage[]>([]);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [sellsExecuted, setSellsExecuted] = useState(0);

  const walletRegistry = useRef<Record<string, WalletInfo>>({});
  const ws1Ref = useRef<WebSocket | null>(null);
  const ws2Ref = useRef<WebSocket | null>(null);
  const pendingTransfers = useRef<Record<string, { from: string; to: string; amount: bigint; detectedAt: number }>>({});
  const gasCache = useRef<GasCache | null>(null);
  const kyberCache = useRef<KyberCache | null>(null);
  const prebuiltTx = useRef<PrebuiltTx | null>(null);
  const gasIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const kyberIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const monitoringTokenRef = useRef<string | null>(null);
  const settingsRef = useRef<AppSettings | null>(null);
  const needsApprovalRef = useRef(true);
  const tokenInfoRef = useRef<TokenInfo | null>(null);

  const addTerminalMessage = useCallback((text: string) => {
    setTerminalMessages((prev) => [
      ...prev.slice(-200),
      { id: crypto.randomUUID(), text, timestamp: new Date() },
    ]);
  }, []);

  const terminal = addTerminalMessage;

  const loadSettings = useCallback(async (): Promise<AppSettings | null> => {
    const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
    if (data && data.alchemy_api_key && data.wallet_private_key) {
      const rawData = data as Record<string, unknown>;
      const keys: string[] = (rawData.alchemy_api_keys as string[]) || [data.alchemy_api_key];
      const validKeys = keys.filter((k: string) => k.trim().length > 0);
      if (validKeys.length === 0) validKeys.push(data.alchemy_api_key);
      
      // Initialize API key rotation
      setApiKeys(validKeys);
      
      const s: AppSettings = {
        alchemyApiKey: validKeys[0],
        alchemyApiKeys: validKeys,
        walletPrivateKey: data.wallet_private_key,
        autoSellEnabled: data.auto_sell_enabled ?? true,
      };
      setSettings(s);
      settingsRef.current = s;
      return s;
    }
    return null;
  }, []);

  const getProvider = useCallback((apiKey?: string) => {
    const url = apiKey ? `https://base-mainnet.g.alchemy.com/v2/${apiKey}` : getAlchemyRpcUrl();
    return new ethers.JsonRpcProvider(url);
  }, []);

  const getWallet = useCallback((privateKey: string, provider: ethers.JsonRpcProvider) => {
    return new ethers.Wallet(privateKey, provider);
  }, []);

  const startGasCache = useCallback((provider: ethers.JsonRpcProvider) => {
    const refreshGas = async () => {
      try {
        const feeData = await provider.getFeeData();
        const maxFee = (feeData.maxFeePerGas ?? 1000000000n) * 2n;
        const maxPriority = feeData.maxPriorityFeePerGas
          ? (feeData.maxPriorityFeePerGas < maxFee ? feeData.maxPriorityFeePerGas : maxFee / 2n)
          : maxFee / 2n;
        gasCache.current = { maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPriority, updatedAt: Date.now() };
        if (prebuiltTx.current) {
          prebuiltTx.current.maxFeePerGas = maxFee;
          prebuiltTx.current.maxPriorityFeePerGas = maxPriority;
        }
      } catch { /* silent */ }
    };
    refreshGas();
    gasIntervalRef.current = setInterval(refreshGas, GAS_REFRESH_INTERVAL);
  }, []);

  const prefetchKyberSwapRoute = useCallback(async (tokenAddress: string, walletAddress: string, provider: ethers.JsonRpcProvider) => {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const balance = await tokenContract.balanceOf(walletAddress);
      if (balance === 0n) return;

      const routeSummary = await getKyberRoute(tokenAddress, balance.toString(), walletAddress);
      const { encodedData, routerAddress } = await buildKyberSwap(routeSummary, walletAddress, 600);

      kyberCache.current = {
        tokenAddress, encodedData, routerAddress, routeSummary,
        builtAt: Date.now(), balance: balance.toString(),
      };

      const gc = gasCache.current;
      prebuiltTx.current = {
        to: routerAddress, data: encodedData, gasLimit: 500000n,
        maxFeePerGas: gc?.maxFeePerGas ?? 2000000000n,
        maxPriorityFeePerGas: gc?.maxPriorityFeePerGas ?? 1000000000n,
        type: 2,
      };

      terminal("✅ Sell TX pre-built — ready to fire instantly");
    } catch (err: unknown) {
      terminal(`⚠️ KyberSwap pre-fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [terminal]);

  const startKyberRefresh = useCallback((tokenAddress: string, walletAddress: string, provider: ethers.JsonRpcProvider) => {
    const refresh = async () => {
      try {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const balance = await tokenContract.balanceOf(walletAddress);
        if (balance === 0n) return;

        const routeSummary = await getKyberRoute(tokenAddress, balance.toString(), walletAddress);
        const { encodedData, routerAddress } = await buildKyberSwap(routeSummary, walletAddress, 600);

        kyberCache.current = {
          tokenAddress, encodedData, routerAddress, routeSummary,
          builtAt: Date.now(), balance: balance.toString(),
        };
        const gc = gasCache.current;
        prebuiltTx.current = {
          to: routerAddress, data: encodedData, gasLimit: 500000n,
          maxFeePerGas: gc?.maxFeePerGas ?? 2000000000n,
          maxPriorityFeePerGas: gc?.maxPriorityFeePerGas ?? 1000000000n,
          type: 2,
        };
      } catch { /* silent */ }
    };
    kyberIntervalRef.current = setInterval(refresh, KYBER_REFRESH_INTERVAL);
  }, []);

  const updateSupabaseAfterSell = useCallback(async (
    sellStatus: "success" | "failed", txHash: string | null, tokenAddress: string, errorMsg?: string
  ) => {
    try {
      // Update most recent danger_transfer for this token
      const { data: dangers } = await supabase
        .from("danger_transfers")
        .select("id")
        .eq("token_address", tokenAddress)
        .order("detected_at", { ascending: false })
        .limit(1);

      if (dangers && dangers[0]) {
        await supabase.from("danger_transfers").update({
          sell_triggered: true,
          sell_tx_hash: txHash,
          sell_status: sellStatus,
        }).eq("id", dangers[0].id);
      }

      await supabase.from("sell_log").insert({
        token_address: tokenAddress,
        token_name: tokenInfoRef.current?.name ?? "",
        amount_sold: tokenInfoRef.current?.balance ?? "0",
        sell_tx_hash: txHash,
        status: sellStatus,
        error_message: errorMsg ?? null,
      });

      if (sellStatus === "success") setSellsExecuted((p) => p + 1);
    } catch { /* non-blocking */ }
  }, []);

  const executeSellFast = useCallback(async (tokenAddress: string) => {
    const s = settingsRef.current;
    if (!s) { terminal("❌ No settings — go to /Settings first"); return; }

    const provider = getProvider(s.alchemyApiKey);
    const wallet = getWallet(s.walletPrivateKey, provider);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

    // PATH A — Pre-built TX
    if (
      prebuiltTx.current && kyberCache.current &&
      kyberCache.current.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
    ) {
      terminal("⚡ Pre-built KyberSwap TX found — fast sell path");

      const balance = await tokenContract.balanceOf(wallet.address);
      if (balance === 0n) { terminal("⚠️ No tokens found for this address"); return; }

      const decimals = await tokenContract.decimals();
      terminal(`💰 Balance: ${ethers.formatUnits(balance, decimals)} tokens`);

      if (needsApprovalRef.current) {
        terminal("🔄 Approving KyberSwap router (one time only)...");
        const approveTx = await tokenContract.approve(KYBERSWAP_ROUTER, ethers.MaxUint256);
        await approveTx.wait();
        terminal("✅ Approval confirmed — instant for all future sells");
        needsApprovalRef.current = false;
        setNeedsApproval(false);
        setSellReady(true);
      }

      // Check balance drift >10%
      const cachedBal = BigInt(kyberCache.current.balance);
      const diff = balance > cachedBal ? balance - cachedBal : cachedBal - balance;
      if (diff > cachedBal / 10n) {
        terminal("🔄 Balance changed — refreshing route...");
        await prefetchKyberSwapRoute(tokenAddress, wallet.address, provider);
      }

      const gc = gasCache.current;
      const txToSend = {
        ...prebuiltTx.current,
        maxFeePerGas: gc?.maxFeePerGas ?? prebuiltTx.current.maxFeePerGas,
        maxPriorityFeePerGas: gc?.maxPriorityFeePerGas ?? prebuiltTx.current.maxPriorityFeePerGas,
      };

      terminal("⚡ Firing pre-built KyberSwap transaction...");
      try {
        const tx = await wallet.sendTransaction(txToSend);
        terminal(`✅ SELL SUBMITTED: ${tx.hash}`);
        terminal(`🔗 View on basescan.org/tx/${tx.hash}`);
        tx.wait().then((receipt) => {
          if (receipt) terminal(`✅ CONFIRMED in block ${receipt.blockNumber}`);
          updateSupabaseAfterSell("success", tx.hash, tokenAddress);
        }).catch((err: Error) => {
          terminal(`⚠️ Confirmation issue: ${err.message}`);
          updateSupabaseAfterSell("failed", null, tokenAddress, err.message);
        });
      } catch (err: unknown) {
        terminal(`❌ Send failed: ${err instanceof Error ? err.message : 'Unknown'}`);
        updateSupabaseAfterSell("failed", null, tokenAddress, err instanceof Error ? err.message : 'Unknown');
      }
      return;
    }

    // PATH B — Fresh fetch
    terminal("🔄 No pre-built TX — fetching KyberSwap route now...");
    terminal(`⚡ SELL command received for ${tokenAddress}`);
    terminal("🔄 Loading wallet...");

    try {
      const [balance, decimals] = await Promise.all([
        tokenContract.balanceOf(wallet.address),
        tokenContract.decimals(),
      ]);
      if (balance === 0n) { terminal("⚠️ No tokens found for this address"); return; }
      terminal(`💰 Balance: ${ethers.formatUnits(balance, decimals)} tokens`);

      terminal("🔄 Checking KyberSwap allowance...");
      const allowance = await tokenContract.allowance(wallet.address, KYBERSWAP_ROUTER);
      if (allowance < balance) {
        terminal("🔄 Approving KyberSwap router...");
        const approveTx = await tokenContract.approve(KYBERSWAP_ROUTER, ethers.MaxUint256);
        await approveTx.wait();
        terminal(`✅ Approval confirmed: ${approveTx.hash}`);
      } else {
        terminal("✅ Already approved — skipping");
      }

      terminal("🔄 Getting KyberSwap route + gas data in parallel...");
      const [routeSummary, feeData] = await Promise.all([
        getKyberRoute(tokenAddress, balance.toString(), wallet.address),
        provider.getFeeData(),
      ]);
      terminal("✅ Route found");

      terminal("🔄 Building swap transaction...");
      const { encodedData, routerAddress } = await buildKyberSwap(routeSummary, wallet.address, 300);
      terminal("✅ Swap data built");

      const maxFee = (feeData.maxFeePerGas ?? 1000000000n) * 2n;
      const maxPriority = feeData.maxPriorityFeePerGas
        ? (feeData.maxPriorityFeePerGas < maxFee ? feeData.maxPriorityFeePerGas : maxFee / 2n)
        : maxFee / 2n;

      terminal("⚡ Executing sell transaction...");
      const tx = await wallet.sendTransaction({
        to: routerAddress, data: encodedData, gasLimit: 500000n,
        maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPriority, type: 2,
      });
      terminal(`✅ SELL SUBMITTED: ${tx.hash}`);
      terminal(`🔗 View on basescan.org/tx/${tx.hash}`);

      tx.wait().then((receipt) => {
        if (receipt) terminal(`✅ CONFIRMED in block ${receipt.blockNumber}`);
        updateSupabaseAfterSell("success", tx.hash, tokenAddress);
      }).catch((err: Error) => {
        terminal(`⚠️ Confirmation issue: ${err.message}`);
        updateSupabaseAfterSell("failed", null, tokenAddress, err.message);
      });
    } catch (err: unknown) {
      terminal(`❌ Sell failed: ${err instanceof Error ? err.message : 'Unknown'}`);
      updateSupabaseAfterSell("failed", null, tokenAddress, err instanceof Error ? err.message : 'Unknown');
    }
  }, [getProvider, getWallet, prefetchKyberSwapRoute, terminal, updateSupabaseAfterSell]);

  const addDangerTransfer = useCallback((dt: DangerTransfer) => {
    setDangerTransfers((prev) => {
      const next = [dt, ...prev];
      return next.slice(0, MAX_DANGER_CARDS);
    });
  }, []);

  const processDangerTransfer = useCallback(async (
    from: string, to: string, amount: bigint, txHash: string, tokenAddress: string
  ) => {
    const addr = from.toLowerCase();
    const ti = tokenInfoRef.current;
    if (!ti) return;

    if (!walletRegistry.current[addr]) {
      const pos = Object.keys(walletRegistry.current).length + 1;
      walletRegistry.current[addr] = { position: pos, transferCount: 0, firstSeen: Date.now() };
    }
    walletRegistry.current[addr].transferCount += 1;
    const info = walletRegistry.current[addr];

    if (info.transferCount > MAX_WALLET_TRANSFERS) return;

    const dt: DangerTransfer = {
      tokenAddress, tokenName: ti.name, tokenSymbol: ti.symbol,
      fromWallet: from, toWallet: to,
      amount: ethers.formatUnits(amount, ti.decimals),
      txHash, walletPosition: info.position, transferCount: info.transferCount,
      detectedAt: new Date().toISOString(), sellTriggered: false,
      sellStatus: "pending", source: "live",
    };

    addDangerTransfer(dt);
    playAlertBeep();

    // Save to Supabase (triggers realtime -> /manual)
    await supabase.from("danger_transfers").insert({
      token_address: dt.tokenAddress,
      token_name: dt.tokenName,
      token_symbol: dt.tokenSymbol,
      from_wallet: dt.fromWallet,
      to_wallet: dt.toWallet,
      amount: dt.amount,
      tx_hash: dt.txHash,
      wallet_position: dt.walletPosition,
      transfer_count: dt.transferCount,
      sell_status: "pending",
      source: "live",
    });
  }, [addDangerTransfer]);

  const openWebSockets = useCallback((tokenAddress: string, _apiKey?: string) => {
    const wsUrl = getAlchemyWsUrl();

    // WS1 — Pending transactions
    const ws1 = new WebSocket(wsUrl);
    ws1Ref.current = ws1;
    ws1.onopen = () => {
      ws1.send(JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_subscribe",
        params: ["alchemy_pendingTransactions", { toAddress: tokenAddress }],
      }));
    };
    ws1.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.params?.result) {
          const tx = data.params.result;
          if (tx.input && tx.input.startsWith(TRANSFER_SELECTOR) && tx.input.length >= 138) {
            const decodedTo = "0x" + tx.input.slice(34, 74);
            const decodedAmount = BigInt("0x" + tx.input.slice(74));
            pendingTransfers.current[tx.hash] = {
              from: tx.from, to: decodedTo, amount: decodedAmount, detectedAt: Date.now(),
            };
          }
        }
      } catch { /* ignore */ }
    };

    // WS2 — Confirmed Transfer logs
    const ws2 = new WebSocket(wsUrl);
    ws2Ref.current = ws2;
    ws2.onopen = () => {
      ws2.send(JSON.stringify({
        jsonrpc: "2.0", id: 2, method: "eth_subscribe",
        params: ["logs", { address: tokenAddress, topics: [TRANSFER_TOPIC] }],
      }));
      setStatus("connected");
      setReconnectAttempt(0);
    };
    ws2.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.params?.result) {
          const log = data.params.result;
          const hash = log.transactionHash;
          const pending = pendingTransfers.current[hash];
          if (pending) {
            delete pendingTransfers.current[hash];
            processDangerTransfer(pending.from, pending.to, pending.amount, hash, tokenAddress);
          }
        }
      } catch { /* ignore */ }
    };

    // Reconnect handling
    const handleClose = () => {
      if (!monitoringTokenRef.current) return;
      setStatus("reconnecting");
      let attempt = 0;
      const reconnect = () => {
        attempt++;
        setReconnectAttempt(attempt);
        setTimeout(async () => {
          const { data } = await supabase.from("monitor_state").select("*").eq("id", 1).single();
          if (data?.is_monitoring && data.token_address) {
            ws1Ref.current?.close();
            ws2Ref.current?.close();
            openWebSockets(data.token_address);
          } else {
            setStatus("disconnected");
          }
        }, WS_RECONNECT_DELAY);
      };
      reconnect();
    };

    ws1.onclose = handleClose;
    ws2.onclose = handleClose;
    ws1.onerror = () => ws1.close();
    ws2.onerror = () => ws2.close();
  }, [processDangerTransfer]);

  const startMonitoring = useCallback(async (tokenAddress: string) => {
    const s = settingsRef.current;
    if (!s) { terminal("❌ No settings configured"); return; }

    setStatus("reconnecting");
    monitoringTokenRef.current = tokenAddress;
    walletRegistry.current = {};
    setDangerTransfers([]);
    setSellsExecuted(0);

    const provider = getProvider(s.alchemyApiKey);
    const wallet = getWallet(s.walletPrivateKey, provider);

    // STEP 1 — Token metadata
    terminal("🔄 Fetching token metadata...");
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const [name, symbol, decimals, totalSupply, balance] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply(),
        tokenContract.balanceOf(wallet.address),
      ]);

      const ti: TokenInfo = {
        address: tokenAddress, name, symbol,
        decimals: Number(decimals),
        totalSupply: ethers.formatUnits(totalSupply, decimals),
        balance: ethers.formatUnits(balance, decimals),
      };
      setTokenInfo(ti);
      tokenInfoRef.current = ti;
      terminal(`✅ Token: ${name} (${symbol}) — You hold: ${ti.balance}`);

      // Save to monitor_state
      await supabase.from("monitor_state").upsert({
        id: 1, is_monitoring: true, token_address: tokenAddress,
        token_name: name, token_symbol: symbol,
        token_decimals: Number(decimals),
        total_supply: ethers.formatUnits(totalSupply, decimals),
        started_at: new Date().toISOString(),
      });
    } catch (err: unknown) {
      terminal(`❌ Failed to fetch token: ${err instanceof Error ? err.message : 'Unknown'}`);
      setStatus("disconnected");
      return;
    }

    // STEP 2 — Prepare
    terminal("🔄 Starting gas cache...");
    startGasCache(provider);

    terminal("🔄 Checking KyberSwap allowance...");
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const [allowance, balance] = await Promise.all([
        tokenContract.allowance(wallet.address, KYBERSWAP_ROUTER),
        tokenContract.balanceOf(wallet.address),
      ]);
      if (allowance >= balance && balance > 0n) {
        needsApprovalRef.current = false;
        setNeedsApproval(false);
        setSellReady(true);
        terminal("✅ Already approved — instant sell ready");
      } else {
        needsApprovalRef.current = true;
        setNeedsApproval(true);
        setSellReady(false);
        terminal("⚠️ Not yet approved — first sell will take 3-5s extra for approval");
      }
    } catch {
      terminal("⚠️ Could not check allowance");
    }

    terminal("🔄 Pre-fetching KyberSwap route...");
    await prefetchKyberSwapRoute(tokenAddress, wallet.address, provider);
    startKyberRefresh(tokenAddress, wallet.address, provider);

    // Cleanup old pending
    cleanupIntervalRef.current = setInterval(() => {
      const now = Date.now();
      Object.keys(pendingTransfers.current).forEach((hash) => {
        if (now - pendingTransfers.current[hash].detectedAt > PENDING_CLEANUP_INTERVAL) {
          delete pendingTransfers.current[hash];
        }
      });
    }, PENDING_CLEANUP_INTERVAL);

    // STEP 3 — WebSockets
    terminal("🔄 Opening WebSocket connections...");
    openWebSockets(tokenAddress, s.alchemyApiKey);
  }, [getProvider, getWallet, startGasCache, prefetchKyberSwapRoute, startKyberRefresh, openWebSockets, terminal]);

  const stopMonitoring = useCallback(async () => {
    monitoringTokenRef.current = null;
    ws1Ref.current?.close();
    ws2Ref.current?.close();
    ws1Ref.current = null;
    ws2Ref.current = null;
    if (gasIntervalRef.current) clearInterval(gasIntervalRef.current);
    if (kyberIntervalRef.current) clearInterval(kyberIntervalRef.current);
    if (cleanupIntervalRef.current) clearInterval(cleanupIntervalRef.current);
    gasCache.current = null;
    kyberCache.current = null;
    prebuiltTx.current = null;
    pendingTransfers.current = {};
    setStatus("disconnected");
    setTokenInfo(null);
    tokenInfoRef.current = null;
    setSellReady(false);
    setNeedsApproval(true);
    needsApprovalRef.current = true;

    await supabase.from("monitor_state").upsert({
      id: 1, is_monitoring: false, token_address: null,
    });
    terminal("🛑 Monitoring stopped");
  }, [terminal]);

  // Auto-reconnect on mount
  useEffect(() => {
    const checkAndReconnect = async () => {
      const s = await loadSettings();
      if (!s) return;
      const { data } = await supabase.from("monitor_state").select("*").eq("id", 1).single();
      if (data?.is_monitoring && data.token_address) {
        terminal("🔄 Restoring previous monitoring session...");
        await startMonitoring(data.token_address);
      }
    };
    checkAndReconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MonitorContext.Provider
      value={{
        status, tokenInfo, dangerTransfers, walletRegistry,
        settings, sellReady, needsApproval, terminalMessages,
        reconnectAttempt, startMonitoring, stopMonitoring,
        loadSettings, executeSellFast, addTerminalMessage, sellsExecuted,
      }}
    >
      {children}
    </MonitorContext.Provider>
  );
}
