import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CandlestickChart, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TradeLog Pro" },
      {
        name: "description",
        content:
          "Sign in to TradeLog Pro to log trades, track P&L and review your trading psychology.",
      },
      { property: "og:title", content: "Sign in — TradeLog Pro" },
      {
        property: "og:description",
        content: "Access your private trading journal, analytics and AI coach.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm, or sign in directly.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ backgroundColor: "#0a0d1a" }}
    >
      <div
        className="w-full max-w-[420px]"
        style={{
          backgroundColor: "#111827",
          borderRadius: "16px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45)",
          padding: "48px",
        }}
      >
        <div className="flex flex-col items-center text-center">
          {/* Logo */}
          <div
            className="grid place-items-center"
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              backgroundColor: "rgba(89, 139, 255, 0.12)",
              color: "#598bff",
              marginBottom: "24px",
            }}
          >
            <CandlestickChart className="size-8" />
          </div>

          <h1
            className="font-bold tracking-tight"
            style={{
              color: "#ffffff",
              fontSize: "28px",
              lineHeight: 1.2,
              marginBottom: "8px",
            }}
          >
            TradeLog Pro
          </h1>

          <p
            style={{
              color: "#6b7280",
              fontSize: "14px",
              lineHeight: 1.5,
              marginBottom: "32px",
            }}
          >
            {mode === "signin"
              ? "Sign in to access your trading journal"
              : "Create an account to start your journal"}
          </p>
        </div>

        {/* Tab switcher */}
        <div
          className="flex mb-6"
          style={{
            backgroundColor: "#1f2937",
            borderRadius: "10px",
            padding: "4px",
          }}
        >
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor: mode === m ? "#598bff" : "transparent",
                color: mode === m ? "#ffffff" : "#6b7280",
              }}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Email */}
          <div style={{ position: "relative" }}>
            <Mail
              className="size-4"
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#4b5563",
                pointerEvents: "none",
              }}
            />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                height: "48px",
                paddingLeft: "40px",
                paddingRight: "16px",
                backgroundColor: "#1f2937",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                color: "#f9fafb",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ position: "relative" }}>
            <Lock
              className="size-4"
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#4b5563",
                pointerEvents: "none",
              }}
            />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                height: "48px",
                paddingLeft: "40px",
                paddingRight: "44px",
                backgroundColor: "#1f2937",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                color: "#f9fafb",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#4b5563",
                padding: 0,
              }}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full justify-center font-medium mt-2"
            style={{
              height: "52px",
              borderRadius: "10px",
              fontSize: "15px",
              backgroundColor: "#598bff",
              color: "#ffffff",
              border: "none",
            }}
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : mode === "signin" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        {/* Footer note */}
        <div
          className="flex items-center justify-center gap-2"
          style={{
            color: "#6b7280",
            fontSize: "12px",
            marginTop: "24px",
            lineHeight: 1.4,
          }}
        >
          <Lock className="size-3.5" />
          <span>
            Same email = same journal on any device. Your data is private.
          </span>
        </div>
      </div>
    </div>
  );
}
