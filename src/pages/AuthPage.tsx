import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Enter email and password");
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Logged in ✅");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account created! Check your email to verify ✅");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">🔒 RUGGER GONE</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLogin ? "Sign in to access your dashboard" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground font-display">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground font-display">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-success px-4 py-2 font-display text-sm font-semibold text-success-foreground transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "LOADING..." : isLogin ? "SIGN IN" : "SIGN UP"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {isLogin ? "No account? " : "Already have an account? "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-secondary hover:underline"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
