import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ethers } from "ethers";
import { toast } from "sonner";
import { useMonitor } from "@/contexts/MonitorContext";

export default function SettingsPage() {
  const { loadSettings } = useMonitor();
  const [apiKeys, setApiKeys] = useState<string[]>([""]);
  const [privateKey, setPrivateKey] = useState("");
  const [autoSell, setAutoSell] = useState(true);
  const [walletAddress, setWalletAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (data) {
        // Load multiple keys if available, fallback to single key
        const keys: string[] = (data as Record<string, unknown>).alchemy_api_keys as string[] || [];
        if (keys.length > 0) {
          setApiKeys(keys);
        } else if (data.alchemy_api_key) {
          setApiKeys([data.alchemy_api_key]);
        }
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
    const validKeys = apiKeys.filter((k) => k.trim().length > 0);
    if (validKeys.length === 0) {
      toast.error("Add at least one API key");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("settings").upsert({
      id: 1,
      alchemy_api_key: validKeys[0], // Primary key for backward compatibility
      alchemy_api_keys: validKeys,
      wallet_private_key: privateKey,
      auto_sell_enabled: autoSell,
    } as Record<string, unknown>);
    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success(`Settings saved ✅ (${validKeys.length} API key${validKeys.length > 1 ? "s" : ""})`);
      await loadSettings();
    }
    setSaving(false);
  };

  const addKey = () => {
    if (apiKeys.length >= 10) return;
    setApiKeys([...apiKeys, ""]);
  };

  const removeKey = (index: number) => {
    if (apiKeys.length <= 1) return;
    setApiKeys(apiKeys.filter((_, i) => i !== index));
  };

  const updateKey = (index: number, value: string) => {
    const next = [...apiKeys];
    next[index] = value;
    setApiKeys(next);
  };

  return (
    <div className="container mx-auto max-w-lg space-y-6 p-4">
      <h2 className="font-display text-xl font-bold">⚙️ SETTINGS</h2>

      <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-xs text-warning">
        ⚠️ Private key controls your wallet. Use a dedicated trading wallet only. Never use your main wallet here.
      </div>

      <div className="space-y-4">
        {/* Multiple Alchemy API Keys */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-muted-foreground font-display">
              Alchemy API Keys ({apiKeys.filter((k) => k.trim()).length})
            </label>
            <button
              onClick={addKey}
              disabled={apiKeys.length >= 10}
              className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground disabled:opacity-50"
            >
              + ADD KEY
            </button>
          </div>
          <div className="space-y-2">
            {apiKeys.map((key, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground w-5 text-right font-mono">{i + 1}.</span>
                <input
                  type="password"
                  value={key}
                  onChange={(e) => updateKey(i, e.target.value)}
                  placeholder={`API Key #${i + 1}`}
                  className="flex-1 rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {apiKeys.length > 1 && (
                  <button
                    onClick={() => removeKey(i)}
                    className="text-danger hover:text-danger/80 text-xs"
                  >🗑️</button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-md bg-secondary/10 border border-secondary/30 p-2 text-xs text-secondary">
            🔄 Auto-rotation: When one key hits rate limits, the system automatically switches to the next key.
            Add multiple keys for uninterrupted monitoring.
          </div>
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
