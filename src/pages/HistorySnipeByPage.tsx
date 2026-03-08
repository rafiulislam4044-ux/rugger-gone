import { useState, useRef, useEffect } from "react";
import { ethers } from "ethers";
import { getAlchemyRpcUrl } from "@/lib/apiKeyRotation";

interface FundingTrace {
  id: string;
  sourceWallet: string;
  fundedWallet: string;
  ethAmount: string;
  txHash: string;
  timestamp: string;
  tokenCreated: string | null;
  tokenName: string | null;
  tokenSymbol: string | null;
  creatorWallet: string | null;
}

interface LogEntry {
  id: string;
  text: string;
  type: "info" | "success" | "warn" | "error";
  timestamp: Date;
}

export default function HistorySnipeByPage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [traces, setTraces] = useState<FundingTrace[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const addLog = (text: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { id: crypto.randomUUID(), text, type, timestamp: new Date() }]);
  };

  const scanWallet = async () => {
    const addr = walletAddress.trim();
    if (!addr.startsWith("0x") || addr.length !== 42) {
      addLog("Invalid wallet address", "error");
      return;
    }

    setIsScanning(true);
    setTraces([]);
    setLogs([]);
    addLog(`Scanning wallet: ${addr}`);

    try {
      const rpcUrl = getAlchemyRpcUrl();
      if (!rpcUrl || rpcUrl.includes("undefined")) {
        addLog("No Alchemy API key configured. Go to Settings.", "error");
        setIsScanning(false);
        return;
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Fetch BOTH outgoing AND incoming transfers in parallel
      addLog("Fetching outgoing + incoming transfers (ETH + ERC20)...");
      const [ethOutRes, erc20OutRes, ethInRes, erc20InRes] = await Promise.all([
        fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "alchemy_getAssetTransfers",
            params: [{ fromAddress: addr, category: ["external"], order: "desc", maxCount: "0x64", withMetadata: true }],
          }),
        }),
        fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 2,
            method: "alchemy_getAssetTransfers",
            params: [{ fromAddress: addr, category: ["erc20"], order: "desc", maxCount: "0x64", withMetadata: true }],
          }),
        }),
        fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 3,
            method: "alchemy_getAssetTransfers",
            params: [{ toAddress: addr, category: ["external"], order: "desc", maxCount: "0x64", withMetadata: true }],
          }),
        }),
        fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 4,
            method: "alchemy_getAssetTransfers",
            params: [{ toAddress: addr, category: ["erc20"], order: "desc", maxCount: "0x64", withMetadata: true }],
          }),
        }),
      ]);

      const [ethOutData, erc20OutData, ethInData, erc20InData] = await Promise.all([
        ethOutRes.json(), erc20OutRes.json(), ethInRes.json(), erc20InRes.json(),
      ]);

      for (const d of [ethOutData, erc20OutData, ethInData, erc20InData]) {
        if (d.error) addLog(`API error: ${d.error.message}`, "warn");
      }

      const outTransfers = [
        ...(ethOutData?.result?.transfers || []),
        ...(erc20OutData?.result?.transfers || []),
      ];
      const inTransfers = [
        ...(ethInData?.result?.transfers || []),
        ...(erc20InData?.result?.transfers || []),
      ];

      addLog(`Found ${outTransfers.length} outgoing + ${inTransfers.length} incoming transfers`);

      // Collect all unique related wallets
      const allUniqueWallets = new Set<string>();
      const walletTxMap: Record<string, { ethAmount: string; txHash: string; timestamp: string; direction: string }> = {};

      // Outgoing: recipient wallets
      for (const t of outTransfers) {
        if (t.to && t.to.toLowerCase() !== addr.toLowerCase()) {
          const w = t.to.toLowerCase();
          allUniqueWallets.add(w);
          if (!walletTxMap[w]) walletTxMap[w] = { ethAmount: t.value?.toString() || "0", txHash: t.hash, timestamp: t.metadata?.blockTimestamp || "", direction: "OUT" };
        }
      }

      // Incoming: sender wallets
      for (const t of inTransfers) {
        if (t.from && t.from.toLowerCase() !== addr.toLowerCase()) {
          const w = t.from.toLowerCase();
          allUniqueWallets.add(w);
          if (!walletTxMap[w]) walletTxMap[w] = { ethAmount: t.value?.toString() || "0", txHash: t.hash, timestamp: t.metadata?.blockTimestamp || "", direction: "IN" };
        }
      }

      addLog(`${allUniqueWallets.size} unique related wallets to check`);

      const foundTraces: FundingTrace[] = [];

      // Step 2: For each recipient wallet, check if it deployed a contract (token)
      for (const recipientAddr of allUniqueRecipients) {
        const fundedWallet = recipientAddr;
        const matchingTx = transfers.find((t: any) => t.to?.toLowerCase() === recipientAddr);
        const ethAmount = matchingTx?.value?.toString() || "0";
        const txHash = matchingTx?.hash || "";
        const timestamp = matchingTx?.metadata?.blockTimestamp || "";
        addLog(`Checking wallet: ${fundedWallet.slice(0, 10)}...`);

        try {
          // Get transactions FROM the funded wallet to find contract creation
          const txListRes = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 2,
              method: "alchemy_getAssetTransfers",
              params: [{
                fromAddress: fundedWallet,
                category: ["external", "erc20"],
                order: "asc",
                maxCount: "0x32", // 50
                withMetadata: true,
              }],
            }),
          });

          const txListData = await txListRes.json();
          const fundedTxs = txListData?.result?.transfers || [];

          // Also check for contract deployments (to: null)
          const deployRes = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 3,
              method: "alchemy_getAssetTransfers",
              params: [{
                fromAddress: fundedWallet,
                category: ["internal"],
                order: "asc",
                maxCount: "0x14",
                withMetadata: true,
              }],
            }),
          });

          const deployData = await deployRes.json();

          // Check each tx for contract creation
          let tokenCreated: string | null = null;
          let tokenName: string | null = null;
          let tokenSymbol: string | null = null;

          // Check tx receipts for contract creation
          for (const ftx of fundedTxs.slice(0, 5)) {
            try {
              const receipt = await provider.getTransactionReceipt(ftx.hash);
              if (receipt && receipt.contractAddress) {
                tokenCreated = receipt.contractAddress;
                addLog(`🎯 Token created: ${tokenCreated}`, "success");

                // Try to get token info
                try {
                  const tokenContract = new ethers.Contract(tokenCreated, [
                    "function name() view returns (string)",
                    "function symbol() view returns (string)",
                  ], provider);
                  const [name, symbol] = await Promise.all([
                    tokenContract.name().catch(() => null),
                    tokenContract.symbol().catch(() => null),
                  ]);
                  tokenName = name;
                  tokenSymbol = symbol;
                  addLog(`Token: ${name} (${symbol})`, "success");
                } catch {}
                break;
              }
            } catch {}
          }

          // Also check if funded wallet interacted with any new contracts
          // by looking at internal txs that might be factory deployments
          if (!tokenCreated) {
            for (const itx of (deployData?.result?.transfers || []).slice(0, 5)) {
              if (itx.to && itx.to !== fundedWallet) {
                try {
                  const code = await provider.getCode(itx.to);
                  if (code && code.length > 10) {
                    // It's a contract, check if it's a token
                    try {
                      const tokenContract = new ethers.Contract(itx.to, [
                        "function name() view returns (string)",
                        "function symbol() view returns (string)",
                        "function totalSupply() view returns (uint256)",
                      ], provider);
                      const [name, symbol] = await Promise.all([
                        tokenContract.name().catch(() => null),
                        tokenContract.symbol().catch(() => null),
                      ]);
                      if (name && symbol) {
                        tokenCreated = itx.to;
                        tokenName = name;
                        tokenSymbol = symbol;
                        addLog(`🎯 Token found via factory: ${name} (${symbol})`, "success");
                        break;
                      }
                    } catch {}
                  }
                } catch {}
              }
            }
          }

          foundTraces.push({
            id: crypto.randomUUID(),
            sourceWallet: addr,
            fundedWallet,
            ethAmount,
            txHash,
            timestamp,
            tokenCreated,
            tokenName,
            tokenSymbol,
            creatorWallet: tokenCreated ? fundedWallet : null,
          });

          setTraces([...foundTraces]);

        } catch (err) {
          addLog(`Error checking ${fundedWallet.slice(0, 10)}: ${err}`, "warn");
        }
      }

      addLog(`Scan complete. ${foundTraces.length} funded wallets found, ${foundTraces.filter(t => t.tokenCreated).length} created tokens.`, "success");

    } catch (err: any) {
      addLog(`Scan failed: ${err.message}`, "error");
    }

    setIsScanning(false);
  };

  const logColor = (type: LogEntry["type"]) =>
    type === "success" ? "text-success" :
    type === "error" ? "text-danger" :
    type === "warn" ? "text-warning" :
    "text-foreground";

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-4">
      <h2 className="font-display text-xl font-bold">🔎 HISTORY SNIPE CHECK</h2>
      <p className="text-xs text-muted-foreground">
        Test blueprint: Enter a wallet to trace its funding → token creation chain (same logic as SnipeBuy)
      </p>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="0x... wallet address to trace"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 rounded-md border border-border bg-input px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={scanWallet}
          disabled={isScanning}
          className="rounded-md bg-accent px-4 py-2 font-display text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {isScanning ? "SCANNING..." : "SCAN"}
        </button>
      </div>

      {/* Results */}
      {traces.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm font-bold">📋 TRACE RESULTS ({traces.length})</h3>
          {traces.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-card p-3 font-mono text-xs">
              <div className="flex items-start justify-between mb-2">
                <span className="font-bold text-foreground">
                  {t.tokenCreated ? "🎯" : "👛"} {t.tokenCreated ? "TOKEN CREATED" : "FUNDED WALLET"}
                </span>
                <span className="text-muted-foreground">
                  {t.ethAmount ? `${parseFloat(t.ethAmount).toFixed(4)} ETH` : ""}
                </span>
              </div>
              <div className="space-y-1">
                <div>
                  <span className="text-muted-foreground">Source: </span>
                  <span className="text-foreground">{t.sourceWallet.slice(0, 10)}...{t.sourceWallet.slice(-6)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">→ Funded: </span>
                  <span className="text-accent">{t.fundedWallet.slice(0, 10)}...{t.fundedWallet.slice(-6)}</span>
                </div>
                {t.tokenCreated && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">→ Token: </span>
                      <span className="text-success">{t.tokenName} ({t.tokenSymbol})</span>
                    </div>
                    <div className="break-all">
                      <span className="text-muted-foreground">Address: </span>
                      <span className="text-success">{t.tokenCreated}</span>
                    </div>
                  </>
                )}
                <div>
                  <a href={`https://basescan.org/tx/${t.txHash}`} target="_blank" rel="noopener noreferrer"
                    className="text-secondary hover:underline">🔗 View TX</a>
                </div>
                {t.timestamp && (
                  <div className="text-muted-foreground">
                    {new Date(t.timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity Log */}
      <div
        ref={scrollRef}
        className="terminal-bg h-[300px] overflow-y-auto rounded-lg border border-border p-4 font-mono text-xs"
      >
        {logs.length === 0 && (
          <div className="text-muted-foreground">Enter a wallet address and click SCAN to trace its history.</div>
        )}
        {logs.map((l) => (
          <div key={l.id} className="mb-1">
            <span className="text-muted-foreground mr-2">
              [{l.timestamp.toLocaleTimeString()}]
            </span>
            <span className={logColor(l.type)}>{l.text}</span>
          </div>
        ))}
        {isScanning && (
          <div className="text-accent animate-pulse">Scanning...</div>
        )}
      </div>
    </div>
  );
}
