import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MonitorProvider } from "@/contexts/MonitorContext";
import { SnipeProvider } from "@/contexts/SnipeContext";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Index from "./pages/Index";
import SnipeByPage from "./pages/SnipeByPage";
import HistorySnipeByPage from "./pages/HistorySnipeByPage";
import BuyPage from "./pages/BuyPage";
import DataLogsPage from "./pages/DataLogsPage";
import ManualPage from "./pages/ManualPage";
import SettingsPage from "./pages/SettingsPage";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-display text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <MonitorProvider>
      <SnipeProvider>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/snipeby" element={<SnipeByPage />} />
              <Route path="/historysnipeby" element={<HistorySnipeByPage />} />
              <Route path="/buy" element={<BuyPage />} />
              <Route path="/DataLogs" element={<DataLogsPage />} />
              <Route path="/manual" element={<ManualPage />} />
              <Route path="/Settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </SnipeProvider>
    </MonitorProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ProtectedApp />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
