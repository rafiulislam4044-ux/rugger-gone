import { DangerTransfer } from "@/lib/types";

interface Props {
  transfer: DangerTransfer;
}

export default function DangerCard({ transfer }: Props) {
  return (
    <div className="danger-pulse glow-danger rounded-lg border border-danger/30 bg-card p-4 font-mono text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-danger font-bold">🚨 DIRECT TRANSFER DETECTED</span>
        <span className="text-xs text-muted-foreground">
          {new Date(transfer.detectedAt).toLocaleTimeString()}
        </span>
      </div>
      <div className="text-warning font-semibold mb-2">⚠️ DANGER — POSSIBLE RUG</div>
      <div className="text-accent text-xs mb-3">
        🏷️ WALLET #{transfer.walletPosition} (transfer {transfer.transferCount} of 5)
      </div>
      <div className="space-y-1 text-xs">
        <div>
          <span className="text-muted-foreground">FROM: </span>
          <span className="text-foreground break-all">{transfer.fromWallet}</span>
        </div>
        <div>
          <span className="text-muted-foreground">TO: </span>
          <span className="text-foreground break-all">{transfer.toWallet}</span>
        </div>
        <div>
          <span className="text-muted-foreground">AMOUNT: </span>
          <span className="text-foreground">
            {Number(transfer.amount).toLocaleString()} {transfer.tokenSymbol}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">TX: </span>
          <a
            href={`https://basescan.org/tx/${transfer.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary hover:underline"
          >
            {transfer.txHash.slice(0, 20)}...
          </a>
        </div>
      </div>
      <div className="mt-3 border-t border-border pt-2 text-xs">
        {transfer.sellStatus === "success" ? (
          <span className="text-success">🤖 SELL: ✅ SUCCESS</span>
        ) : transfer.sellStatus === "failed" ? (
          <span className="text-danger">🤖 SELL: ❌ FAILED</span>
        ) : (
          <span className="text-warning">🤖 SELL: ⏳ WAITING /manual...</span>
        )}
      </div>
    </div>
  );
}
