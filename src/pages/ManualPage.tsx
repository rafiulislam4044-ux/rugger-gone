import { useState, useRef, useEffect, useCallback } from "react";
import { useMonitor } from "@/contexts/MonitorContext";
import { supabase } from "@/integrations/supabase/client";

export default function ManualPage() {
  const { executeSellFast, terminalMessages, addTerminalMessage, settings } = useMonitor();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [terminalMessages]);

  const executeCommand = useCallback(async (cmd: string) => {
    const match = cmd.match(/SELL\s+token\s+address\s+"(0x[a-fA-F0-9]{40})"/i);
    if (match) {
      const tokenAddr = match[1];
      addTerminalMessage(`⚡ Executing SELL for ${tokenAddr}...`);
      await executeSellFast(tokenAddr);
    } else {
      addTerminalMessage(`❌ Unknown command. Use: SELL token address "0xTokenAddress"`);
    }
  }, [executeSellFast, addTerminalMessage]);

  // Supabase Realtime listener for auto-sells
  useEffect(() => {
    if (!settings?.autoSellEnabled) return;

    const channel = supabase
      .channel("danger_transfers_channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "danger_transfers",
          filter: "source=eq.live",
        },
        (payload) => {
          const tokenAddress = payload.new.token_address;
          const command = `SELL token address "${tokenAddress}"`;
          addTerminalMessage(`🤖 AUTO-TRIGGERED by Supabase: ${command}`);
          executeCommand(command);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [settings?.autoSellEnabled, addTerminalMessage, executeCommand]);

  const handleExecute = () => {
    if (!input.trim()) return;
    addTerminalMessage(`> ${input}`);
    executeCommand(input.trim());
    setInput("");
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-4">
      <h2 className="font-display text-xl font-bold">⌨️ MANUAL COMMAND TERMINAL</h2>

      {/* Terminal output */}
      <div
        ref={scrollRef}
        className="terminal-bg h-[500px] overflow-y-auto rounded-lg border border-border p-4 font-mono text-xs"
      >
        {terminalMessages.length === 0 && (
          <div className="text-muted-foreground">
            Waiting for commands...{"\n"}
            Usage: SELL token address "0xTokenAddress"
          </div>
        )}
        {terminalMessages.map((msg) => (
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

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleExecute()}
          placeholder='Type command... e.g. SELL token address "0x..."'
          className="flex-1 rounded-md border border-border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleExecute}
          className="rounded-md bg-success px-6 py-2 font-display text-sm font-semibold text-success-foreground transition-colors hover:opacity-90"
        >
          EXECUTE
        </button>
      </div>
    </div>
  );
}
