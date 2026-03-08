import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#111",
          color: "#fff",
          fontFamily: "monospace",
          padding: "2rem",
        }}>
          <div style={{ maxWidth: 600, textAlign: "center" }}>
            <h1 style={{ fontSize: "2rem", marginBottom: "1rem", color: "#ff4444" }}>
              ⚠️ App Crashed
            </h1>
            <p style={{ marginBottom: "1rem", color: "#aaa" }}>
              Something went wrong. Check the browser console (F12) for details.
            </p>
            <pre style={{
              background: "#222",
              padding: "1rem",
              borderRadius: "8px",
              textAlign: "left",
              fontSize: "0.85rem",
              overflow: "auto",
              color: "#ff6666",
              maxHeight: "200px",
            }}>
              {this.state.error?.message || "Unknown error"}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: "1.5rem",
                padding: "0.75rem 2rem",
                background: "#00cc88",
                color: "#000",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              RELOAD APP
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
