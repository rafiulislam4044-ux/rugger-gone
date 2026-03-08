import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ethers } from "ethers";
import { toast } from "sonner";
import { useMonitor } from "@/contexts/MonitorContext";

export default function SettingsPage() {
  const { loadSettings } = useMonitor();
  const [alchemyKey, setAlchemyKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [autoSell, setAutoSell] = useState(true);
  const [walletAddress, setWalletAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (data) {
        setAlchemyKey(data.alchemy_api_key || "");
        setPrivateKey(data.wallet_private_key || "");
        setAutoSell(data.auto_sell_enabled ?? true);
        if (data.wallet_private_key) {
          try {
            const w = new ethers.Wallet(data.wallet_private_key);
            setWalletAddress(w.address);
          } catch { /* invalid key */ }
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (privateKey) {
      try {
        const w = new ethers.Wallet(privateKey);
        setWalletAddress(w.address);
      } catch {
        setWalletAddress("");
      }
    } else {
      setWalletAddress("");
    }
  }, [privateKey]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").upsert({
      id: 1,
      alchemy_api_key: alchemyKey,
      wallet_private_key: privateKey,
      auto_sell_enabled: autoSell,
    });
    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Settings saved ✅");
      await loadSettings();
    }
    setSaving(false);
  };

  return (
    <div className="container mx-auto max-w-lg space-y-6 p-4">
      <h2 className="font-display text-xl font-bold">⚙️ SETTINGS</h2>

      <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-xs text-warning">
        ⚠️ Private key controls your wallet. Use a dedicated trading wallet only. Never use your main wallet here.
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground font-display">Alchemy API Key</label>
          <input
            type="password"
            value={alchemyKey}
            onChange={(e) => setAlchemyKey(e.target.value)}
            placeholder="Enter Alchemy API Key"
            className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-muted-foreground font-display">Wallet Private Key</label>
          <input
            type="password"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="Enter Private Key"
            className="w-full rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {walletAddress && (
            <p className="mt-1 font-mono text-xs text-success">
              Connected Wallet: {walletAddress}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
          <span className="font-display text-sm">Auto-Sell Enabled</span>
          <button
            onClick={() => setAutoSell(!autoSell)}
            className={`rounded-full px-4 py-1 text-xs font-semibold transition-colors ${
              autoSell
                ? "bg-success text-success-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {autoSell ? "ON" : "OFF"}
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-md bg-success px-4 py-2 font-display text-sm font-semibold text-success-foreground transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "SAVING..." : "SAVE SETTINGS"}
        </button>
      </div>
    </div>
  );
}
