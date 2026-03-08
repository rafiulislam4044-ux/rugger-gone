import { useState, useRef, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useMonitor } from "@/contexts/MonitorContext";
import { ERC20_ABI, KYBERSWAP_ROUTER, WETH_BASE } from "@/lib/constants";
import { getAlchemyRpcUrl } from "@/lib/apiKeyRotation";

interface BuyLog {
  id: string;
  text: string;
  timestamp: Date;
}

export default function BuyPage() {
  const { settings, startMonitoring, addTerminalMessage } = useMonitor();

  const [tokenAddress, setTokenAddress] = useState("");
  const [ethAmount, setEthAmount] = useState("0.01");
  const [slippage, setSlippage] = useState("50");
  const [buying, setBuying] = useState(false);
  const [logs, setLogs] = useState<BuyLog[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const log = useCallback((text: string) => {
    setLogs((prev) => [...prev.slice(-200), { id: crypto.randomUUID(), text, timestamp: new Date() }]);
  }, []);

  const executeBuy = useCallback(async () => {
    if (!tokenAddress.trim() || !tokenAddress.startsWith("0x") || tokenAddress.length !== 42) {
      log("❌ Invalid token address");
      return;
    }
    if (!settings) {
      log("❌ Configure settings first! Go to /Settings");
      return;
    }
    const ethVal = parseFloat(ethAmount);
    if (isNaN(ethVal) || ethVal <= 0) {
      log("❌ Invalid ETH amount");
      return;
    }

    setBuying(true);
    const token = tokenAddress.trim().toLowerCase();
    const buyAmountWei = ethers.parseEther(ethAmount);

    try {
      const provider = new ethers.JsonRpcProvider(getAlchemyRpcUrl());
      const wallet = new ethers.Wallet(settings.walletPrivateKey, provider);

      log(`⚡ BUY: ${ethAmount} ETH → ${token.slice(0, 10)}...`);

      // Parallel: get route + gas + token metadata + WETH balance check
      log("🔄 Fetching route + gas + token info in parallel...");

      const routeParams = new URLSearchParams({
        tokenIn: WETH_BASE,
        tokenOut: token,
        amountIn: buyAmountWei.toString(),
        to: wallet.address,
      });

      const [routeRes, feeData] = await Promise.all([
        fetch(
          `https://aggregator-api.kyberswap.com/base/api/v1/routes?${routeParams}`,
          { headers: { "x-client-id": "rug-detector" } }
        ),
        provider.getFeeData(),
      ]);

      const routeData = await routeRes.json();
      if (!routeData.data?.routeSummary) {
        log("❌ No route found — token may not have liquidity");
        setBuying(false);
        return;
      }
      log("✅ Route found");

      // Build swap TX
      log("🔄 Building swap transaction...");
      const slippageTolerance = parseInt(slippage) * 100; // convert % to bps
      const buildRes = await fetch(
        "https://aggregator-api.kyberswap.com/base/api/v1/route/build",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-client-id": "rug-detector" },
          body: JSON.stringify({
            routeSummary: routeData.data.routeSummary,
            sender: wallet.address,
            recipient: wallet.address,
            slippageTolerance,
            ignoreCappedSlippage: true,
            deadline: Math.floor(Date.now() / 1000) + 300,
          }),
        }
      );
      const buildData = await buildRes.json();
      if (!buildData.data?.data) {
        log("❌ Failed to build swap data");
        setBuying(false);
        return;
      }
      log("✅ Swap data built");

      // Check WETH allowance
      const wethContract = new ethers.Contract(WETH_BASE, ERC20_ABI, wallet);
      const allowance = await wethContract.allowance(wallet.address, buildData.data.routerAddress);
      if (allowance < buyAmountWei) {
        log("🔄 Approving WETH for KyberSwap...");
        const appTx = await wethContract.approve(buildData.data.routerAddress, ethers.MaxUint256);
        await appTx.wait();
        log("✅ WETH approved");
      }

      // Gas
      const maxFee = (feeData.maxFeePerGas ?? 1000000000n) * 2n;
      const maxPriority = feeData.maxPriorityFeePerGas
        ? (feeData.maxPriorityFeePerGas < maxFee ? feeData.maxPriorityFeePerGas : maxFee / 2n)
        : maxFee / 2n;

      // FIRE
      log("⚡ Firing buy transaction...");
      const tx = await wallet.sendTransaction({
        to: buildData.data.routerAddress,
        data: buildData.data.data,
        gasLimit: 500000n,
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: maxPriority,
        type: 2,
      });

      log(`✅ BUY SUBMITTED: ${tx.hash}`);
      log(`🔗 basescan.org/tx/${tx.hash}`);

      // Wait for confirmation then auto-start monitor
      tx.wait().then(async (receipt) => {
        if (receipt) {
          log(`✅ CONFIRMED in block ${receipt.blockNumber}`);

          // Get token info
          try {
            const tokenContract = new ethers.Contract(token, ERC20_ABI, provider);
            const [name, symbol, balance] = await Promise.all([
              tokenContract.name().catch(() => "Unknown"),
              tokenContract.symbol().catch(() => "???"),
              tokenContract.balanceOf(wallet.address),
            ]);
            const decimals = await tokenContract.decimals().catch(() => 18);
            log(`💰 You now hold: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
          } catch { /* ignore */ }

          // Auto-start Live Monitor
          log("🔄 Auto-starting Live Monitor...");
          addTerminalMessage(`🎯 BUY completed — auto-monitoring ${token}`);
          await startMonitoring(token);
          log("✅ Live Monitor ACTIVE — watching for danger transfers");
        }
      }).catch((err: Error) => {
        log(`❌ Confirmation failed: ${err.message}`);
      });
    } catch (err: unknown) {
      log(`❌ Buy failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setBuying(false);
    }
  }, [tokenAddress, ethAmount, slippage, settings, log, startMonitoring, addTerminalMessage]);

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-4">
      <h2 className="font-display text-xl font-bold">💰 QUICK BUY</h2>

      {/* Buy form */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Token Address</label>
          <input
            type="text"
            placeholder="0x... token to buy"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">ETH Amount</label>
            <input
              type="text"
              placeholder="0.01"
              value={ethAmount}
              onChange={(e) => setEthAmount(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Slippage %</label>
            <input
              type="text"
              placeholder="50"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <button
          onClick={executeBuy}
          disabled={buying || !tokenAddress.trim()}
          className="w-full rounded-md bg-success px-4 py-3 font-display text-sm font-bold text-success-foreground transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {buying ? "⏳ BUYING..." : "⚡ BUY NOW"}
        </button>
        <div className="text-xs text-muted-foreground">
          Buys via KyberSwap (WETH → Token) → Auto-starts Live Monitor → Auto-sells on danger
        </div>
      </div>

      {/* Buy log */}
      <div
        ref={scrollRef}
        className="terminal-bg h-[400px] overflow-y-auto rounded-lg border border-border p-4 font-mono text-xs"
      >
        {logs.length === 0 && (
          <div className="text-muted-foreground">Ready to buy. Enter token address and ETH amount.</div>
        )}
        {logs.map((msg) => (
          <div key={msg.id} className="mb-1">
            <span className="text-muted-foreground mr-2">
              [{msg.timestamp.toLocaleTimeString()}]
            </span>
            <span
              className={
                msg.text.includes("✅") ? "text-success" :
                msg.text.includes("❌") ? "text-danger" :
                msg.text.includes("⚠️") ? "text-warning" :
                msg.text.includes("⚡") ? "text-accent" :
                "text-success"
              }
            >
              {msg.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
