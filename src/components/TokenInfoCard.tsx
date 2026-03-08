import { useMonitor } from "@/contexts/MonitorContext";

export default function TokenInfoCard() {
  const { tokenInfo, sellReady, needsApproval, settings } = useMonitor();
  if (!tokenInfo) return null;

  return (
    <div className="glow-success rounded-lg border border-success/20 bg-card p-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">Token</span>
          <p className="font-display font-semibold">{tokenInfo.name} ({tokenInfo.symbol})</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Total Supply</span>
          <p className="font-mono text-xs">{Number(tokenInfo.totalSupply).toLocaleString()}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Your Balance</span>
          <p className="font-mono text-xs text-success">
            {Number(tokenInfo.balance).toLocaleString()} {tokenInfo.symbol}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Auto-Sell</span>
          <p className={settings?.autoSellEnabled ? "text-success text-xs" : "text-danger text-xs"}>
            {settings?.autoSellEnabled ? "✅ ENABLED" : "❌ DISABLED"}
          </p>
        </div>
        <div className="col-span-2">
          <span className="text-muted-foreground text-xs">Sell Ready</span>
          <p className={`text-xs ${sellReady ? "text-success" : "text-warning"}`}>
            {sellReady
              ? "✅ INSTANT (pre-built TX ready)"
              : needsApproval
              ? "⏳ First sell needs approval (~3-5s)"
              : "⏳ BUILDING..."}
          </p>
        </div>
        <div className="col-span-2">
          <span className="text-muted-foreground text-xs">Contract</span>
          <p className="font-mono text-xs break-all">{tokenInfo.address}</p>
        </div>
      </div>
    </div>
  );
}
