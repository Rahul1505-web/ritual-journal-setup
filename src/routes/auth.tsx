import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CandlestickChart,
  Wallet,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Globe,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Send,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

/* ─── Ethereum provider types ────────────────────────────────────────────── */
declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isBraveWallet?: boolean;
  isCoinbaseWallet?: boolean;
}

/* ─── Route ──────────────────────────────────────────────────────────────── */
export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — TradeLog Pro" },
      {
        name: "description",
        content:
          "Sign in to TradeLog Pro with your email or crypto wallet to access your trading journal.",
      },
      { property: "og:title", content: "Sign In — TradeLog Pro" },
    ],
  }),
  component: AuthPage,
});

/* ─── Helpers ────────────────────────────────────────────────────────────── */
type WalletStep = "idle" | "connecting" | "signing" | "authenticating";
type AuthTab = "email" | "wallet";
type EmailMode = "signin" | "signup" | "check_email" | "forgot_password";

function getWalletLabel(eth: EthereumProvider): string {
  if (eth.isBraveWallet) return "Brave Wallet";
  if (eth.isCoinbaseWallet) return "Coinbase Wallet";
  if (eth.isMetaMask) return "MetaMask";
  return "Web3 Wallet";
}

function shortAddr(address: string): string {
  return `${address.slice(0, 6)}···${address.slice(-4)}`;
}

/**
 * Official EIP-4361 (Sign-In with Ethereum / SIWE) standard format.
 */
function buildSiweMessage({
  address,
  domain,
  uri,
  chainId,
}: {
  address: string;
  domain: string;
  uri: string;
  chainId: number;
}): string {
  return (
    `${domain} wants you to sign in with your Ethereum account:\n` +
    `${address}\n\n` +
    `Sign in to TradeLog Pro to sync your trading journal.\n\n` +
    `URI: ${uri}\n` +
    `Version: 1\n` +
    `Chain ID: ${chainId}\n` +
    `Nonce: tradelogpro2026\n` +
    `Issued At: 2026-01-01T00:00:00.000Z`
  );
}

function stringToHex(str: string): string {
  return (
    "0x" +
    Array.from(new TextEncoder().encode(str))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */
function AuthPage() {
  const navigate = useNavigate();

  // Tab State
  const [activeTab, setActiveTab] = useState<AuthTab>("email");

  // Email Auth State
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Wallet Auth State
  const [walletStep, setWalletStep] = useState<WalletStep>("idle");
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [walletLabel, setWalletLabel] = useState<string>("Wallet");
  const [copied, setCopied] = useState(false);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  /* Detect wallet + redirect if already signed in */
  useEffect(() => {
    setHasWallet(typeof window !== "undefined" && !!window.ethereum);

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        toast.success("Authenticated! Loading your journal…");
        navigate({ to: "/", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  /* Resend cooldown countdown */
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const copyAddress = async () => {
    if (!connectedAddress) return;
    await navigator.clipboard.writeText(connectedAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Email Auth Handlers ───────────────────────────────────────────────── */
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter both email and password.");
      return;
    }

    setEmailLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setSubmittedEmail(email.trim());
          setEmailMode("check_email");
          toast.error("Please confirm your email first. Check your inbox or click resend.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.session) {
        toast.success("Signed in successfully!");
        navigate({ to: "/", replace: true });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setEmailLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        if (error.message === "{}" || error.status === 500) {
          toast.error(
            "SMTP 500 Error: Supabase could not send the email through Resend. Check that Sender Email is onboarding@resend.dev.",
            { duration: 8000 }
          );
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.session) {
        // Auto-confirmed
        toast.success("Account created! Redirecting to your journal…");
        navigate({ to: "/", replace: true });
      } else if (data.user) {
        // Confirmation email sent!
        setSubmittedEmail(email.trim());
        setEmailMode("check_email");
        setResendCooldown(60);
        toast.success("Confirmation link sent! Please check your Gmail.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }

    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/profile`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password reset link sent! Check your inbox.");
        setEmailMode("signin");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!submittedEmail || resendCooldown > 0) return;

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: submittedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Confirmation email resent! Please check your spam folder too.");
        setResendCooldown(60);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resend.");
    }
  };

  /* ── Wallet Auth Handler ───────────────────────────────────────────────── */
  const handleWalletConnect = async () => {
    if (!window.ethereum) {
      toast.error("No wallet found. Please install MetaMask and refresh.");
      return;
    }

    try {
      setWalletStep("connecting");
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const address = accounts[0];
      if (!address) throw new Error("No account returned from wallet.");
      setConnectedAddress(address);
      setWalletLabel(getWalletLabel(window.ethereum));

      setWalletStep("signing");
      const chainIdHex = (await window.ethereum
        .request({ method: "eth_chainId" })
        .catch(() => "0x1")) as string;
      const chainId = parseInt(chainIdHex, 16) || 1;

      const message = buildSiweMessage({
        address,
        domain: window.location.host,
        uri: window.location.origin,
        chainId,
      });
      const hexMessage = stringToHex(message);

      let signature: string;
      try {
        signature = (await window.ethereum.request({
          method: "personal_sign",
          params: [hexMessage, address],
        })) as string;
      } catch (signErr: unknown) {
        const errObj = signErr as { code?: number; message?: string };
        if (errObj?.code === -32602 || errObj?.message?.includes("parameter")) {
          signature = (await window.ethereum.request({
            method: "personal_sign",
            params: [address, hexMessage],
          })) as string;
        } else {
          throw signErr;
        }
      }

      setWalletStep("authenticating");
      const walletEmail = `${address.toLowerCase()}@wallet.tradelog.app`;
      const walletPassword = `wlt_${signature.slice(2, 42)}`;

      const { data: signInData, error: signInErr } =
        await supabase.auth.signInWithPassword({
          email: walletEmail,
          password: walletPassword,
        });

      if (!signInErr && signInData?.session) {
        toast.success("Wallet authenticated! Loading your journal…");
        navigate({ to: "/", replace: true });
        return;
      }

      const { data: signUpData, error: signUpErr } =
        await supabase.auth.signUp({
          email: walletEmail,
          password: walletPassword,
          options: {
            data: {
              wallet_address: address.toLowerCase(),
              wallet_type: walletLabel,
            },
          },
        });

      if (signUpErr) {
        if (
          signUpErr.message.includes("rate limit") ||
          signUpErr.status === 429
        ) {
          throw new Error(
            "Supabase email confirmation is currently enabled for new accounts. Please disable 'Confirm email' for wallet sign-in or use the Email tab."
          );
        }
        throw signUpErr;
      }

      if (signUpData.session) {
        toast.success("Wallet account created! Welcome to TradeLog Pro.");
        navigate({ to: "/", replace: true });
      } else {
        toast.error(
          "Setup required: In Supabase → Authentication → Providers → Email → uncheck 'Confirm email' → Save. Then reconnect.",
          { duration: 15000 }
        );
        setWalletStep("idle");
      }
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code: number }).code
          : null;

      if (code === 4001) {
        toast.error("Signature declined. Please approve the sign request in your wallet.");
      } else if (code === -32002) {
        toast.error("MetaMask is waiting — open the MetaMask extension and click 'Sign'.");
      } else {
        toast.error(err instanceof Error ? err.message : "Wallet authentication failed.");
      }
      setWalletStep("idle");
    }
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#080b18" }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(89,139,255,0.14) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="relative w-full max-w-[440px]"
        style={{
          backgroundColor: "rgba(17,24,39,0.97)",
          borderRadius: "22px",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(89,139,255,0.08) inset",
          padding: "36px 32px",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Logo + branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "16px",
              background:
                "linear-gradient(135deg, rgba(89,139,255,0.25) 0%, rgba(89,139,255,0.08) 100%)",
              border: "1px solid rgba(89,139,255,0.3)",
              display: "grid",
              placeItems: "center",
              color: "#598bff",
              marginBottom: "14px",
              boxShadow: "0 0 24px rgba(89,139,255,0.22)",
            }}
          >
            <CandlestickChart className="size-7" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white">
            TradeLog Pro
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-[280px]">
            Cloud-synced digital journal & discipline analytics
          </p>
        </div>

        {/* Tab switcher: Email vs Web3 Wallet */}
        <div
          className="flex p-1 mb-6 rounded-xl"
          style={{
            backgroundColor: "rgba(31,41,55,0.7)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200"
            style={{
              backgroundColor:
                activeTab === "email" ? "#598bff" : "transparent",
              color: activeTab === "email" ? "#ffffff" : "#9ca3af",
              boxShadow:
                activeTab === "email"
                  ? "0 4px 14px rgba(89,139,255,0.35)"
                  : "none",
            }}
          >
            <Mail className="size-3.5" />
            Email & Gmail
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("wallet")}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200"
            style={{
              backgroundColor:
                activeTab === "wallet" ? "#598bff" : "transparent",
              color: activeTab === "wallet" ? "#ffffff" : "#9ca3af",
              boxShadow:
                activeTab === "wallet"
                  ? "0 4px 14px rgba(89,139,255,0.35)"
                  : "none",
            }}
          >
            <Wallet className="size-3.5" />
            Web3 Wallet
          </button>
        </div>

        {/* ── TAB 1: EMAIL AUTH ────────────────────────────────────────────── */}
        {activeTab === "email" && (
          <div>
            {/* SUB-VIEW: Check Email Screen */}
            {emailMode === "check_email" ? (
              <div className="text-center py-2">
                <div
                  className="mx-auto size-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background: "rgba(89,139,255,0.15)",
                    border: "1px solid rgba(89,139,255,0.3)",
                    color: "#598bff",
                  }}
                >
                  <Send className="size-7 animate-pulse" />
                </div>

                <h3 className="text-lg font-bold text-white">
                  Check your Gmail
                </h3>

                <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                  We sent a confirmation link to:
                </p>
                <p className="text-xs font-mono font-semibold text-primary mt-1 break-all bg-primary/10 py-1.5 px-3 rounded-lg border border-primary/20">
                  {submittedEmail}
                </p>

                <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
                  Click the link in the email to activate your account and start logging trades.
                </p>

                {/* Primary: Open Gmail button */}
                <a
                  href="https://mail.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white transition-all duration-200"
                  style={{
                    backgroundColor: "#598bff",
                    boxShadow: "0 6px 20px rgba(89,139,255,0.35)",
                  }}
                >
                  <Mail className="size-4" />
                  Open Gmail Inbox
                  <ExternalLink className="size-3.5 opacity-80" />
                </a>

                {/* Resend button */}
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <p className="text-[11px] text-gray-500 mb-2">
                    Didn't get the email? Check your <strong>Spam / Junk</strong> folder.
                  </p>
                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={handleResendConfirmation}
                    className="text-xs font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <RefreshCw className={`size-3 ${resendCooldown > 0 ? "animate-spin" : ""}`} />
                    {resendCooldown > 0
                      ? `Resend available in ${resendCooldown}s`
                      : "Resend confirmation email"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEmailMode("signin")}
                  className="mt-4 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ← Back to Sign In
                </button>
              </div>
            ) : emailMode === "forgot_password" ? (
              /* SUB-VIEW: Forgot Password */
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-base font-bold text-white">Reset Password</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Enter your email to receive a password reset link
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="trader@gmail.com"
                      required
                      className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={emailLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white transition-all duration-200 mt-2"
                  style={{
                    backgroundColor: "#598bff",
                    boxShadow: "0 6px 20px rgba(89,139,255,0.35)",
                  }}
                >
                  {emailLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Send Reset Link"
                  )}
                </button>

                <div className="text-center mt-3">
                  <button
                    type="button"
                    onClick={() => setEmailMode("signin")}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              /* SUB-VIEW: Sign In / Sign Up Form */
              <form
                onSubmit={
                  emailMode === "signup" ? handleEmailSignUp : handleEmailSignIn
                }
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="trader@gmail.com"
                      required
                      className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-gray-300">
                      Password
                    </label>
                    {emailMode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setEmailMode("forgot_password")}
                        className="text-[11px] text-gray-400 hover:text-primary transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        emailMode === "signup" ? "At least 6 characters" : "••••••••"
                      }
                      required
                      className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl py-2.5 pl-10 pr-10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                {emailMode === "signup" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        required
                        className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={emailLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white transition-all duration-200 mt-2"
                  style={{
                    backgroundColor: "#598bff",
                    boxShadow: "0 6px 20px rgba(89,139,255,0.35)",
                  }}
                >
                  {emailLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : emailMode === "signup" ? (
                    <>
                      Create Account & Send Link
                      <ArrowRight className="size-3.5" />
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  {emailMode === "signin" ? (
                    <p className="text-xs text-gray-400">
                      Don't have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setEmailMode("signup")}
                        className="text-primary font-semibold hover:underline"
                      >
                        Create one
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setEmailMode("signin")}
                        className="text-primary font-semibold hover:underline"
                      >
                        Sign in
                      </button>
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── TAB 2: WEB3 WALLET AUTH ──────────────────────────────────────── */}
        {activeTab === "wallet" && (
          <div>
            {/* Connected wallet pill */}
            {connectedAddress && (
              <div
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl mb-4 text-xs"
                style={{
                  backgroundColor: "rgba(89,139,255,0.08)",
                  border: "1px solid rgba(89,139,255,0.22)",
                }}
              >
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-white">{walletLabel}</span>
                  <span className="text-gray-500">·</span>
                  <span className="font-mono text-gray-300">
                    {shortAddr(connectedAddress)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={copyAddress}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Copy address"
                >
                  {copied ? (
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            )}

            {/* Step-by-step indicator */}
            {walletStep !== "idle" && (
              <div
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl mb-4 text-xs"
                style={{
                  backgroundColor: "rgba(89,139,255,0.09)",
                  border: "1px solid rgba(89,139,255,0.28)",
                  color: "#93c5fd",
                }}
              >
                <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                <span className="font-medium">
                  {walletStep === "connecting"
                    ? "Connecting to wallet…"
                    : walletStep === "signing"
                      ? "Check your wallet popup — waiting for signature…"
                      : "Verifying with cloud…"}
                </span>
              </div>
            )}

            {/* Wallet button or MetaMask install prompt */}
            {hasWallet === false ? (
              <div className="space-y-3">
                <div
                  className="flex items-start gap-3 p-3.5 rounded-xl text-xs"
                  style={{
                    backgroundColor: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.25)",
                    color: "#fcd34d",
                  }}
                >
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <p className="font-semibold">No crypto wallet detected</p>
                    <p className="text-gray-400 mt-0.5 leading-relaxed">
                      Install MetaMask, Brave Wallet, or Coinbase Wallet to sign in with your Web3 address.
                    </p>
                  </div>
                </div>

                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold text-white transition-all duration-200"
                  style={{
                    backgroundColor: "#f6851b",
                    boxShadow: "0 6px 20px rgba(246,133,27,0.3)",
                  }}
                >
                  <Wallet className="size-4" />
                  Install MetaMask
                  <ExternalLink className="size-3.5 opacity-70" />
                </a>
              </div>
            ) : (
              <button
                type="button"
                disabled={walletStep !== "idle"}
                onClick={handleWalletConnect}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "#598bff",
                  boxShadow:
                    walletStep === "idle"
                      ? "0 6px 24px rgba(89,139,255,0.45)"
                      : "none",
                }}
              >
                {walletStep === "idle" ? (
                  <>
                    <Wallet className="size-4" />
                    Connect Wallet & Sign In
                  </>
                ) : (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Authenticating…
                  </>
                )}
              </button>
            )}

            <p className="text-center text-[11px] text-gray-500 mt-3">
              MetaMask · Brave Wallet · Coinbase Wallet · any EIP-1193 wallet
            </p>
          </div>
        )}

        {/* ── Benefits / reassurance footer ──────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-gray-800/80">
          <p className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 text-center mb-3">
            Your data is always secure
          </p>

          <div className="space-y-2.5">
            {[
              {
                icon: ShieldCheck,
                color: "#10b981",
                title: "Cloud Synced",
                desc: "Your trades and journal entries are backed up securely.",
              },
              {
                icon: Globe,
                color: "#598bff",
                title: "All Devices",
                desc: "Access your dashboard from your phone, tablet, or desktop.",
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex items-start gap-2.5">
                <div
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "8px",
                    background: `${color}14`,
                    border: `1px solid ${color}28`,
                    display: "grid",
                    placeItems: "center",
                    color,
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  <Icon className="size-3" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-300">{title}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
