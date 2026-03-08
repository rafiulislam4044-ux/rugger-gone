import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DangerRow {
  id: number; token_address: string; token_name: string | null; token_symbol: string | null;
  from_wallet: string; to_wallet: string; amount: string; tx_hash: string | null;
  wallet_position: number | null; transfer_count: number | null;
  detected_at: string | null; sell_triggered: boolean | null;
  sell_tx_hash: string | null; sell_status: string | null; source: string | null;
}
interface HistoryRow {
  id: number; token_address: string; wallet_address: string | null;
  searched_at: string | null; results_count: number | null;
}
interface SellRow {
  id: number; token_address: string; token_name: string | null;
  amount_sold: string | null; sell_tx_hash: string | null;
  status: string; error_message: string | null; executed_at: string | null;
}

type TabKey = "danger" | "history" | "sell";

export default function DataLogsPage() {
  const [tab, setTab] = useState<TabKey>("danger");
  const [dangers, setDangers] = useState<DangerRow[]>([]);
  const [histories, setHistories] = useState<HistoryRow[]>([]);
  const [sells, setSells] = useState<SellRow[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "single" | "all"; table: string; id?: number } | null>(null);

  const loadData = useCallback(async () => {
    const [d, h, s] = await Promise.all([
      supabase.from("danger_transfers").select("*").order("detected_at", { ascending: false }),
      supabase.from("history_searches").select("*").order("searched_at", { ascending: false }),
      supabase.from("sell_log").select("*").order("executed_at", { ascending: false }),
    ]);
    if (d.data) setDangers(d.data);
    if (h.data) setHistories(h.data);
    if (s.data) setSells(s.data);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const deleteFromTable = async (table: string, id?: number) => {
    const t = table as "danger_transfers" | "history_searches" | "sell_log";
    if (id) {
      await supabase.from(t).delete().eq("id", id);
    } else {
      await supabase.from(t).delete().neq("id", 0);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteFromTable(confirmDelete.table, confirmDelete.type === "single" ? confirmDelete.id : undefined);
      toast.success(confirmDelete.type === "all" ? "All records deleted ✅" : "Record deleted ✅");
      loadData();
    } catch {
      toast.error("Delete failed — try again ❌");
    }
    setConfirmDelete(null);
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "danger", label: "Danger Transfers", icon: "🚨" },
    { key: "history", label: "History Searches", icon: "🔵" },
    { key: "sell", label: "Sell Log", icon: "🤖" },
  ];

  const successSells = sells.filter((s) => s.status === "success").length;
  const failedSells = sells.filter((s) => s.status === "failed").length;

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-4">
      <h2 className="font-display text-xl font-bold">📊 DATA LOGS</h2>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Danger Transfers", value: dangers.length, color: "text-danger" },
          { label: "Sells Attempted", value: sells.length, color: "text-accent" },
          { label: "Sells Successful", value: successSells, color: "text-success" },
          { label: "Sells Failed", value: failedSells, color: "text-danger" },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-border bg-card p-3 text-center">
            <div className={`font-mono text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
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
        <button
          onClick={() => setConfirmDelete({
            type: "all",
            table: tab === "danger" ? "danger_transfers" : tab === "history" ? "history_searches" : "sell_log",
          })}
          className="rounded-md bg-danger/20 px-3 py-1.5 text-xs text-danger hover:bg-danger/30"
        >
          🗑️ Clear All
        </button>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {tab === "danger" && dangers.map((d) => (
          <div key={d.id} className="rounded-lg border border-border bg-card p-4 font-mono text-xs">
            <div className="flex items-start justify-between mb-2">
              <span className="text-danger font-bold">🚨 DANGER TRANSFER</span>
              <button
                onClick={() => setConfirmDelete({ type: "single", table: "danger_transfers", id: d.id })}
                className="text-danger hover:text-danger/80 text-xs"
              >🗑️</button>
            </div>
            <div className="space-y-1">
              <div>Token: {d.token_name} ({d.token_symbol})</div>
              <div className="text-accent">🏷️ WALLET #{d.wallet_position} (transfer {d.transfer_count} of 5)</div>
              <div>FROM: <span className="text-foreground break-all">{d.from_wallet}</span></div>
              <div>TO: <span className="text-foreground break-all">{d.to_wallet}</span></div>
              <div>AMOUNT: {Number(d.amount).toLocaleString()}</div>
              {d.tx_hash && (
                <div>TX: <a href={`https://basescan.org/tx/${d.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">{d.tx_hash.slice(0, 24)}...</a></div>
              )}
              <div>TIME: {d.detected_at ? new Date(d.detected_at).toLocaleString() : "—"}</div>
              <div>SOURCE: {d.source === "live" ? "🔴 LIVE" : "🔵 HISTORY"}</div>
              <div>SELL: {d.sell_status === "success" ? "✅ SUCCESS" : d.sell_status === "failed" ? "❌ FAILED" : "⏳"}</div>
              {d.sell_tx_hash && (
                <div>SELL TX: <a href={`https://basescan.org/tx/${d.sell_tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">{d.sell_tx_hash.slice(0, 24)}...</a></div>
              )}
            </div>
          </div>
        ))}

        {tab === "history" && histories.map((h) => (
          <div key={h.id} className="rounded-lg border border-border bg-card p-4 font-mono text-xs">
            <div className="flex items-start justify-between mb-2">
              <span className="text-secondary font-bold">🔵 HISTORY SEARCH</span>
              <button
                onClick={() => setConfirmDelete({ type: "single", table: "history_searches", id: h.id })}
                className="text-danger hover:text-danger/80 text-xs"
              >🗑️</button>
            </div>
            <div className="space-y-1">
              <div>Token: <span className="break-all">{h.token_address}</span></div>
              {h.wallet_address && <div>Wallet: <span className="break-all">{h.wallet_address}</span></div>}
              <div>Results Found: {h.results_count}</div>
              <div>Searched: {h.searched_at ? new Date(h.searched_at).toLocaleString() : "—"}</div>
            </div>
          </div>
        ))}

        {tab === "sell" && sells.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-card p-4 font-mono text-xs">
            <div className="flex items-start justify-between mb-2">
              <span className="text-accent font-bold">🤖 SELL LOG</span>
              <button
                onClick={() => setConfirmDelete({ type: "single", table: "sell_log", id: s.id })}
                className="text-danger hover:text-danger/80 text-xs"
              >🗑️</button>
            </div>
            <div className="space-y-1">
              <div>Token: {s.token_name || s.token_address}</div>
              <div>Amount Sold: {s.amount_sold}</div>
              <div>Status: {s.status === "success" ? "✅ SUCCESS" : "❌ FAILED"}</div>
              {s.sell_tx_hash && (
                <div>TX: <a href={`https://basescan.org/tx/${s.sell_tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">{s.sell_tx_hash.slice(0, 24)}...</a></div>
              )}
              {s.error_message && <div className="text-danger">Error: {s.error_message}</div>}
              <div>Time: {s.executed_at ? new Date(s.executed_at).toLocaleString() : "—"}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="rounded-lg border border-border bg-card p-6 text-center max-w-sm">
            <p className="mb-4 font-display text-sm">
              {confirmDelete.type === "all"
                ? "Delete ALL records? Cannot be undone."
                : "Are you sure? Cannot be undone."}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleDelete}
                className="rounded-md bg-danger px-4 py-2 text-sm text-danger-foreground font-semibold"
              >
                YES DELETE
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
