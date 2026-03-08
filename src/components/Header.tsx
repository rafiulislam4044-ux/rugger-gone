import { Link, useLocation } from "react-router-dom";
import { useMonitor } from "@/contexts/MonitorContext";
import { useAuth } from "@/hooks/useAuth";

function LogoutButton() {
  const { signOut } = useAuth();
  return (
    <button
      onClick={signOut}
      className="ml-2 rounded-md bg-danger/20 px-3 py-1.5 font-display text-sm text-danger hover:bg-danger/30 transition-colors"
    >
      Logout
    </button>
  );
}

export default function Header() {
  const { status, tokenInfo, reconnectAttempt } = useMonitor();
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/snipeby", label: "SnipeBuy" },
    { path: "/historysnipeby", label: "HistorySnipe" },
    { path: "/buy", label: "Buy" },
    { path: "/DataLogs", label: "DataLogs" },
    { path: "/manual", label: "Manual" },
    { path: "/Settings", label: "Settings" },
  ];

  const statusLabel = status === "connected" && tokenInfo
    ? `MONITORING: ${tokenInfo.symbol}`
    : status === "reconnecting"
    ? `RECONNECTING... (attempt ${reconnectAttempt})`
    : "DISCONNECTED";

  const dotClass = status === "connected"
    ? "status-dot status-dot-green"
    : status === "reconnecting"
    ? "status-dot status-dot-yellow"
    : "status-dot status-dot-red";

  return (
    <header className="border-b border-border bg-card px-4 py-3">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-xl font-bold tracking-tight">
            🔍 <span className="text-danger">RUG</span> DETECTOR
          </h1>
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 font-mono text-xs">
            <span className={dotClass} />
            <span className="text-muted-foreground">{statusLabel}</span>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`rounded-md px-3 py-1.5 font-display text-sm transition-colors ${
                location.pathname === item.path
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
