import { useState, useCallback, useEffect } from "react";
import { useMonitor } from "@/contexts/MonitorContext";
import TokenInfoCard from "@/components/TokenInfoCard";
import DangerCard from "@/components/DangerCard";
import { ethers } from "ethers";
import { supabase } from "@/integrations/supabase/client";
import { ERC20_ABI, TRANSFER_SELECTOR } from "@/lib/constants";
import { DangerTransfer, WalletInfo } from "@/lib/types";
import { playAlertBeep } from "@/lib/audio";

export default function IndexPage() {
  const {
    status, tokenInfo, dangerTransfers, walletRegistry,
    startMonitoring, stopMonitoring, settings, sellsExecuted,
  } = useMonitor();
  const [tokenAddress, setTokenAddress] = useState("");
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [historyTokenAddr, setHistoryTokenAddr] = useState("");
  const [historyWalletAddr, setHistoryWalletAddr] = useState("");
  const [historyResults, setHistoryResults] = useState<DangerTransfer[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    if (status === "connected" && !startTime) setStartTime(new Date());
    if (status === "disconnected") setStartTime(null);
  }, [status, startTime]);

  useEffect(() => {
    if (!startTime) { setElapsed("00:00:00"); return; }
    const iv = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime.getTime()) / 1000);
      const h = String(Math.floor(diff / 3600)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(iv);
  }, [startTime]);

  const handleStart = async () => {
    if (!tokenAddress.trim()) return;
    if (!settings) {
      alert("Configure API keys in Settings first!");
      return;
    }
    await startMonitoring(tokenAddress.trim());
  };

  const fetchHistory = useCallback(async () => {
    if (!historyTokenAddr.trim() || !settings) return;
    setHistoryLoading(true);
    setHistoryResults([]);

    const provider = new ethers.JsonRpcProvider(
      `https://base-mainnet.g.alchemy.com/v2/${settings.alchemyApiKey}`
    );

    try {
      const body: Record<string, unknown> = {
        fromBlock: "0x0", toBlock: "latest",
        contractAddresses: [historyTokenAddr],
        category: ["erc20"], withMetadata: true,
        excludeZeroValue: true, maxCount: "0x3e8", order: "desc",
      };
      if (historyWalletAddr.trim()) body.fromAddress = historyWalletAddr.trim();

      const res = await fetch(
        `https://base-mainnet.g.alchemy.com/v2/${settings.alchemyApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: 1, jsonrpc: "2.0",
            method: "alchemy_getAssetTransfers",
            params: [body],
          }),
        }
      );
      const data = await res.json();
      const transfers = data.result?.transfers ?? [];
      const histWallets: Record<string, WalletInfo> = {};
      const results: DangerTransfer[] = [];

      for (const t of transfers) {
        try {
          const txRes = await provider.getTransaction(t.hash);
          if (!txRes || !txRes.data) continue;
          if (!txRes.data.startsWith(TRANSFER_SELECTOR)) continue;
          if (txRes.to?.toLowerCase() !== historyTokenAddr.toLowerCase()) continue;

          const from = t.from.toLowerCase();
          if (!histWallets[from]) {
            histWallets[from] = { position: Object.keys(histWallets).length + 1, transferCount: 0, firstSeen: Date.now() };
          }
          histWallets[from].transferCount += 1;
          if (histWallets[from].transferCount > 5) continue;

          results.push({
            tokenAddress: historyTokenAddr,
            tokenName: t.asset || "Unknown",
            tokenSymbol: t.asset || "?",
            fromWallet: t.from,
            toWallet: t.to,
            amount: String(t.value ?? "0"),
            txHash: t.hash,
            walletPosition: histWallets[from].position,
            transferCount: histWallets[from].transferCount,
            detectedAt: t.metadata?.blockTimestamp || new Date().toISOString(),
            sellTriggered: false,
            sellStatus: "pending",
            source: "history",
          });
        } catch { continue; }
      }

      setHistoryResults(results);

      // Save to Supabase
      await supabase.from("history_searches").insert({
        token_address: historyTokenAddr,
        wallet_address: historyWalletAddr || null,
        results_count: results.length,
      });

      for (const r of results) {
        await supabase.from("danger_transfers").insert({
          token_address: r.tokenAddress,
          token_name: r.tokenName,
          token_symbol: r.tokenSymbol,
          from_wallet: r.fromWallet,
          to_wallet: r.toWallet,
          amount: r.amount,
          tx_hash: r.txHash,
          wallet_position: r.walletPosition,
          transfer_count: r.transferCount,
          source: "history",
        });
      }
    } catch (err) {
      console.error("History fetch failed:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyTokenAddr, historyWalletAddr, settings]);

  const uniqueWallets = Object.keys(walletRegistry.current).length;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4">
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("live")}
          className={`rounded-md px-4 py-2 font-display text-sm transition-colors ${
            activeTab === "live" ? "bg-danger text-danger-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          🔴 Live Monitor
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`rounded-md px-4 py-2 font-display text-sm transition-colors ${
            activeTab === "history" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          🔵 History Check
        </button>
      </div>

      {activeTab === "live" && (
        <>
          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter Token Address (0x...)"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              className="flex-1 rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {status === "disconnected" ? (
              <button
                onClick={handleStart}
                className="rounded-md bg-success px-4 py-2 font-display text-sm font-semibold text-success-foreground transition-colors hover:opacity-90"
              >
                START MONITORING
              </button>
            ) : (
              <button
                onClick={stopMonitoring}
                className="rounded-md bg-danger px-4 py-2 font-display text-sm font-semibold text-danger-foreground transition-colors hover:opacity-90"
              >
                STOP
              </button>
            )}
          </div>

          {/* Token Info */}
          <TokenInfoCard />

          {/* Stats */}
          {status !== "disconnected" && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: "🚨", label: "Danger Transfers", value: dangerTransfers.length },
                { icon: "👛", label: "Unique Wallets", value: uniqueWallets },
                { icon: "🤖", label: "Sells Executed", value: sellsExecuted },
                { icon: "⏱️", label: "Duration", value: elapsed },
              ].map((s) => (
                <div key={s.label} className="rounded-md border border-border bg-card p-3 text-center">
                  <div className="text-lg">{s.icon}</div>
                  <div className="font-mono text-lg font-bold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Danger Cards */}
          <div className="space-y-3">
            {dangerTransfers.map((dt, i) => (
              <DangerCard key={dt.txHash + i} transfer={dt} />
            ))}
          </div>
        </>
      )}

      {activeTab === "history" && (
        <>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Token Address (required)"
              value={historyTokenAddr}
              onChange={(e) => setHistoryTokenAddr(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Wallet Address (optional)"
              value={historyWalletAddr}
              onChange={(e) => setHistoryWalletAddr(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={fetchHistory}
              disabled={historyLoading}
              className="rounded-md bg-secondary px-4 py-2 font-display text-sm font-semibold text-secondary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {historyLoading ? "⏳ FETCHING..." : "FETCH HISTORY"}
            </button>
          </div>
          <div className="space-y-3">
            {historyResults.map((dt, i) => (
              <DangerCard key={dt.txHash + i} transfer={dt} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
