import { useState, useRef, useEffect } from "react";
import { useSnipe } from "@/contexts/SnipeContext";
import { useMonitor } from "@/contexts/MonitorContext";

type TabKey = "config" | "activity" | "positions";

export default function SnipeByPage() {
  const {
    wallets, watchedWallets, snipeBuys, config, activityLog,
    isSnipeActive, addWallet, removeWallet, updateConfig,
    startSnipe, stopSnipe,
  } = useSnipe();
  const { terminalMessages } = useMonitor();

  const [tab, setTab] = useState<TabKey>("config");
  const [newAddr, setNewAddr] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [buyAmount, setBuyAmount] = useState(config?.buy_amount_eth || "0.01");
  const [profitPercent, setProfitPercent] = useState(config?.profit_take_percent?.toString() || "100");
  const [profitSell, setProfitSell] = useState(config?.profit_sell_percent?.toString() || "50");
  const [stopLoss, setStopLoss] = useState(config?.stop_loss_percent?.toString() || "50");
  const [watchTimeout, setWatchTimeout] = useState(config?.watch_timeout_hours?.toString() || "24");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (config) {
      setBuyAmount(config.buy_amount_eth);
      setProfitPercent(config.profit_take_percent.toString());
      setProfitSell(config.profit_sell_percent.toString());
      setStopLoss(config.stop_loss_percent.toString());
      setWatchTimeout(config.watch_timeout_hours.toString());
    }
  }, [config]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activityLog, terminalMessages]);

  const handleAddWallet = async () => {
    if (!newAddr.trim() || !newAddr.startsWith("0x") || newAddr.length !== 42) return;
    await addWallet(newAddr.trim(), newLabel.trim());
    setNewAddr("");
    setNewLabel("");
  };

  const handleSaveConfig = async () => {
    await updateConfig({
      buy_amount_eth: buyAmount,
      profit_take_percent: parseInt(profitPercent) || 100,
      profit_sell_percent: parseInt(profitSell) || 50,
      stop_loss_percent: parseInt(stopLoss) || 50,
      watch_timeout_hours: parseInt(watchTimeout) || 24,
    });
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "config", label: "Wallets & Config", icon: "⚙️" },
    { key: "activity", label: "Activity Feed", icon: "📡" },
    { key: "positions", label: "Active Positions", icon: "💰" },
  ];

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">🎯 SNIPE BUY</h2>
        {isSnipeActive ? (
          <button
            onClick={stopSnipe}
            className="rounded-md bg-danger px-4 py-2 font-display text-sm font-semibold text-danger-foreground transition-colors hover:opacity-90"
          >
            STOP SNIPE
          </button>
        ) : (
          <button
            onClick={startSnipe}
            className="rounded-md bg-success px-4 py-2 font-display text-sm font-semibold text-success-foreground transition-colors hover:opacity-90"
          >
            START SNIPE
          </button>
        )}
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: "👛", label: "Tracked Wallets", value: wallets.filter((w) => w.is_active).length },
          { icon: "👁️", label: "Watched (L2)", value: watchedWallets.filter((w) => w.is_active).length },
          { icon: "🎯", label: "Snipe Buys", value: snipeBuys.length },
          { icon: isSnipeActive ? "🟢" : "🔴", label: "Status", value: isSnipeActive ? "ACTIVE" : "OFF" },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-border bg-card p-3 text-center">
            <div className="text-lg">{s.icon}</div>
            <div className="font-mono text-lg font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 font-display text-sm transition-colors ${
              tab === t.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Config Tab */}
      {tab === "config" && (
        <div className="space-y-4">
          {/* Wallet list */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-display text-sm font-bold mb-3">👛 TRACKED WALLETS ({wallets.length}/8)</h3>
            <div className="space-y-2 mb-3">
              {wallets.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-md border border-border bg-muted/50 p-2">
                  <div>
                    <span className="font-mono text-xs text-foreground">{w.wallet_address}</span>
                    {w.label && <span className="ml-2 text-xs text-accent">({w.label})</span>}
                  </div>
                  <button
                    onClick={() => removeWallet(w.id)}
                    className="text-danger hover:text-danger/80 text-xs"
                  >🗑️</button>
                </div>
              ))}
              {wallets.length === 0 && (
                <div className="text-xs text-muted-foreground">No wallets added yet</div>
              )}
            </div>
            {wallets.length < 8 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="0x... wallet address"
                  value={newAddr}
                  onChange={(e) => setNewAddr(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-input px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="text"
                  placeholder="Label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-24 rounded-md border border-border bg-input px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={handleAddWallet}
                  className="rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground"
                >ADD</button>
              </div>
            )}
          </div>

          {/* Watched wallets (Layer 2) */}
          {watchedWallets.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-display text-sm font-bold mb-3">👁️ WATCHED WALLETS (Layer 2)</h3>
              <div className="space-y-2">
                {watchedWallets.map((ww) => (
                  <div key={ww.id} className="rounded-md border border-border bg-muted/50 p-2 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className={ww.is_active ? "text-success" : "text-muted-foreground"}>
                        {ww.is_active ? "🟢" : "⚪"}
                      </span>
                      <span className="text-foreground">{ww.funded_wallet}</span>
                    </div>
                    <div className="text-muted-foreground mt-1">
                      From: {ww.source_wallet.slice(0, 10)}... | ETH: {ww.eth_amount}
                      {ww.token_created && <span className="text-success ml-2">→ Token: {ww.token_created.slice(0, 10)}...</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Config panel */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-display text-sm font-bold mb-3">⚙️ SNIPE CONFIGURATION</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Buy Amount (ETH)</label>
                <input type="text" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Watch Timeout (hours)</label>
                <input type="text" value={watchTimeout} onChange={(e) => setWatchTimeout(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Profit Target (%)</label>
                <input type="text" value={profitPercent} onChange={(e) => setProfitPercent(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sell at Profit (%)</label>
                <input type="text" value={profitSell} onChange={(e) => setProfitSell(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Stop-Loss (%)</label>
                <input type="text" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="flex items-end">
                <button onClick={handleSaveConfig}
                  className="rounded-md bg-success px-4 py-2 font-display text-sm font-semibold text-success-foreground transition-colors hover:opacity-90">
                  SAVE CONFIG
                </button>
              </div>
            </div>
            <div className="mt-3 rounded-md bg-warning/10 border border-warning/30 p-2 text-xs text-warning">
              ⚠️ At {profitPercent}% gain → auto-sell {profitSell}% of holdings | At -{stopLoss}% loss → sell 100%
            </div>
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {tab === "activity" && (
        <div
          ref={scrollRef}
          className="terminal-bg h-[500px] overflow-y-auto rounded-lg border border-border p-4 font-mono text-xs"
        >
          {activityLog.length === 0 && (
            <div className="text-muted-foreground">No activity yet. Start snipe to begin watching.</div>
          )}
          {activityLog.map((a) => (
            <div key={a.id} className="mb-1">
              <span className="text-muted-foreground mr-2">
                [{a.created_at ? new Date(a.created_at).toLocaleTimeString() : "—"}]
              </span>
              <span className={
                a.event_type.includes("created") || a.event_type.includes("confirmed") ? "text-success" :
                a.event_type.includes("failed") || a.event_type.includes("stop") ? "text-danger" :
                a.event_type.includes("transfer") ? "text-accent" :
                "text-foreground"
              }>
                [{a.event_type}] {a.description}
              </span>
              {a.tx_hash && (
                <a href={`https://basescan.org/tx/${a.tx_hash}`} target="_blank" rel="noopener noreferrer"
                  className="ml-1 text-secondary hover:underline">🔗</a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Positions Tab */}
      {tab === "positions" && (
        <div className="space-y-3">
          {snipeBuys.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              No snipe buys yet. Waiting for token creation detection...
            </div>
          )}
          {snipeBuys.map((buy) => {
            const pnl = buy.pnl_percent ?? 0;
            const pnlColor = pnl > 0 ? "text-success" : pnl < 0 ? "text-danger" : "text-muted-foreground";
            return (
              <div key={buy.id} className="rounded-lg border border-border bg-card p-4 font-mono text-xs">
                <div className="flex items-start justify-between mb-2">
                  <span className="font-bold text-accent">🎯 SNIPE BUY</span>
                  <span className={`font-bold text-sm ${pnlColor}`}>
                    {pnl > 0 ? "+" : ""}{pnl.toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-1">
                  <div>Token: {buy.token_name || "Unknown"} ({buy.token_symbol || "???"})</div>
                  <div className="break-all">Address: {buy.token_address}</div>
                  <div>Buy: {buy.buy_amount_eth} ETH → Current: {buy.current_price_eth || "..."} ETH</div>
                  <div>Status: {
                    buy.status === "success" ? "✅ BOUGHT" :
                    buy.status === "pending" ? "⏳ PENDING" :
                    buy.status === "submitted" ? "📤 SUBMITTED" :
                    "❌ FAILED"
                  }</div>
                  <div>Source: {buy.source_wallet.slice(0, 10)}... → {buy.funded_wallet.slice(0, 10)}...</div>
                  {buy.profit_taken && <div className="text-success">💰 PROFIT TAKEN</div>}
                  {buy.stop_loss_triggered && <div className="text-danger">🛑 STOP-LOSS TRIGGERED</div>}
                  {buy.auto_monitor_started && <div className="text-secondary">📡 Live Monitor Active</div>}
                  {buy.buy_tx_hash && (
                    <div>TX: <a href={`https://basescan.org/tx/${buy.buy_tx_hash}`} target="_blank" rel="noopener noreferrer"
                      className="text-secondary hover:underline">{buy.buy_tx_hash.slice(0, 24)}...</a></div>
                  )}
                  <div className="text-muted-foreground">{buy.created_at ? new Date(buy.created_at).toLocaleString() : ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
