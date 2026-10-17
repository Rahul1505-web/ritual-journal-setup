import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CandlestickChart,
  Wallet,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Globe,
  Copy,
  CheckCircle2,
  AlertTriangle,
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
      { title: "Connect Wallet — TradeLog Pro" },
      {
        name: "description",
        content:
          "Sign in to TradeLog Pro with your crypto wallet. No email, no password — just your wallet signature.",
      },
      { property: "og:title", content: "Connect Wallet — TradeLog Pro" },
    ],
  }),
  component: AuthPage,
});

/* ─── Helpers ────────────────────────────────────────────────────────────── */
type Step = "idle" | "connecting" | "signing" | "authenticating";

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
 * personal_sign is deterministic for secp256k1:
 * same private key + same message = same signature every time.
 * This means the same wallet always produces the same Supabase credentials.
 */
function buildSignMessage(address: string): string {
  return (
    `TradeLog Pro — Wallet Sign-In\n\n` +
    `Sign this message to authenticate securely.\n` +
    `No transaction will be made and no gas is charged.\n\n` +
    `Wallet: ${address.toLowerCase()}\n\n` +
    `Your signature syncs your trading journal across every device.`
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */
function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("idle");
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
        toast.success("Wallet authenticated! Loading your journal…");
        navigate({ to: "/", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const copyAddress = async () => {
    if (!connectedAddress) return;
    await navigator.clipboard.writeText(connectedAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Main auth flow ───────────────────────────────────────────────────── */
  const handleConnect = async () => {
    if (!window.ethereum) {
      toast.error("No wallet found. Please install MetaMask and refresh.");
      return;
    }

    try {
      /* Step 1 — request accounts */
      setStep("connecting");
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const address = accounts[0];
      if (!address) throw new Error("No account returned from wallet.");
      setConnectedAddress(address);
      setWalletLabel(getWalletLabel(window.ethereum));

      /* Step 2 — sign deterministic message (no gas, no transaction) */
      setStep("signing");
      const message = buildSignMessage(address);
      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

      /* Step 3 — derive Supabase credentials from signature.
         personal_sign (secp256k1) is deterministic: same wallet + same message = same sig always.
         The derived password never changes for the same wallet → same account across every device. */
      setStep("authenticating");
      const walletEmail = `${address.toLowerCase()}@wallet.tradelog.app`;
      const walletPassword = `wlt_${signature.slice(2, 66)}`; // 64 deterministic hex chars

      /* Try sign-in first (returning user) */
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: walletEmail,
        password: walletPassword,
      });

      if (!signInErr) return; // ✅ already registered → signed in via onAuthStateChange

      /* New user — create account */
      if (signInErr.message.toLowerCase().includes("invalid login credentials")) {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: walletEmail,
          password: walletPassword,
          options: {
            data: {
              wallet_address: address.toLowerCase(),
              wallet_type: walletLabel,
            },
          },
        });

        if (signUpErr) throw signUpErr;

        if (signUpData.session) {
          /* ✅ Auto-confirmed (Supabase: Authentication → Email → 'Confirm email' must be OFF) */
          toast.success("Wallet account created! Welcome to TradeLog Pro.");
          navigate({ to: "/", replace: true });
        } else {
          /* Supabase email confirm is still ON — guide user to disable it */
          toast.error(
            "One-time setup required: In Supabase → Authentication → Providers → Email → uncheck 'Confirm email' → Save. Then reconnect your wallet.",
            { duration: 14000 }
          );
          setStep("idle");
        }
      } else {
        throw signInErr;
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
      setStep("idle");
    }
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  const stepLabels: Record<Step, string> = {
    idle: "",
    connecting: "Connecting to wallet…",
    signing: "Check your wallet popup — waiting for signature…",
    authenticating: "Verifying with cloud…",
  };

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
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(89,139,255,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="relative w-full max-w-[420px]"
        style={{
          backgroundColor: "rgba(17,24,39,0.97)",
          borderRadius: "22px",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(89,139,255,0.06) inset",
          padding: "40px 36px",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Logo + header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            style={{
              width: "66px",
              height: "66px",
              borderRadius: "18px",
              background:
                "linear-gradient(135deg, rgba(89,139,255,0.22) 0%, rgba(89,139,255,0.06) 100%)",
              border: "1px solid rgba(89,139,255,0.28)",
              display: "grid",
              placeItems: "center",
              color: "#598bff",
              marginBottom: "18px",
            }}
          >
            <CandlestickChart className="size-8" />
          </div>

          <h1
            style={{
              color: "#ffffff",
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "-0.5px",
              lineHeight: 1.2,
              marginBottom: "8px",
            }}
          >
            TradeLog Pro
          </h1>
          <p style={{ color: "#6b7280", fontSize: "13px", lineHeight: 1.5 }}>
            Connect your wallet to access your cloud-synced journal
          </p>
        </div>

        {/* Divider */}
        <div
          style={{
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)",
            marginBottom: "24px",
          }}
        />

        {/* No wallet detected */}
        {hasWallet === false && (
          <div
            className="rounded-xl p-4 mb-5 text-center"
            style={{
              background: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.2)",
            }}
          >
            <AlertTriangle className="size-5 text-amber-400 mx-auto mb-2" />
            <p className="text-amber-200 text-sm font-semibold mb-1">
              No wallet detected
            </p>
            <p className="text-amber-200/60 text-xs mb-3">
              Install MetaMask to use wallet sign-in.
            </p>
            <a
              href="https://metamask.io/download"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 transition-colors font-medium"
            >
              Install MetaMask <ExternalLink className="size-3" />
            </a>
          </div>
        )}

        {/* Connected address pill */}
        {connectedAddress && (
          <div
            className="rounded-xl p-3 mb-4 flex items-center justify-between gap-3"
            style={{
              background: "rgba(89,139,255,0.07)",
              border: "1px solid rgba(89,139,255,0.2)",
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="size-2 rounded-full flex-shrink-0"
                style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e80" }}
              />
              <span className="text-xs text-gray-300 font-medium truncate">
                {walletLabel} · {shortAddr(connectedAddress)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
              title="Copy address"
            >
              {copied ? (
                <CheckCircle2 className="size-3.5 text-green-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
        )}

        {/* Step status banner */}
        {step !== "idle" && (
          <div
            className="rounded-xl p-3.5 mb-4 flex items-center gap-3"
            style={{
              background: "rgba(89,139,255,0.06)",
              border: "1px solid rgba(89,139,255,0.18)",
            }}
          >
            <Loader2 className="size-4 text-blue-400 animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-200 leading-snug">{stepLabels[step]}</p>
          </div>
        )}

        {/* Connect button */}
        <button
          type="button"
          id="wallet-connect-btn"
          onClick={() => void handleConnect()}
          disabled={step !== "idle" || hasWallet === false}
          style={{
            width: "100%",
            height: "54px",
            borderRadius: "14px",
            background:
              step !== "idle"
                ? "rgba(89,139,255,0.22)"
                : "linear-gradient(135deg, #598bff 0%, #4469e0 100%)",
            border: "none",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: 600,
            cursor:
              step !== "idle" || hasWallet === false ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            transition: "all 0.2s",
            boxShadow:
              step === "idle" && hasWallet !== false
                ? "0 4px 24px rgba(89,139,255,0.38)"
                : "none",
          }}
          onMouseEnter={(e) => {
            if (step === "idle" && hasWallet !== false)
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
          }}
        >
          {step !== "idle" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Wallet className="size-5" />
          )}
          {step === "idle" ? "Connect Wallet & Sign In" : "Authenticating…"}
        </button>

        {hasWallet !== false && step === "idle" && (
          <p className="text-center text-[11px] text-gray-600 mt-2.5">
            MetaMask · Brave Wallet · Coinbase Wallet · any EIP-1193 wallet
          </p>
        )}

        {/* Why wallet sign-in */}
        <div
          style={{
            marginTop: "28px",
            paddingTop: "22px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-4">
            Why wallet sign-in?
          </p>
          <div className="flex flex-col gap-3.5">
            {[
              {
                icon: ShieldCheck,
                color: "#22c55e",
                title: "No email · No password",
                desc: "Your wallet signature is the only key needed.",
              },
              {
                icon: Globe,
                color: "#598bff",
                title: "Sync across all devices",
                desc: "Same wallet = same journal data everywhere, instantly.",
              },
              {
                icon: Wallet,
                color: "#a78bfa",
                title: "No transaction · No gas",
                desc: "Signing is free — nothing is sent to the blockchain.",
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "9px",
                    background: `${color}14`,
                    border: `1px solid ${color}28`,
                    display: "grid",
                    placeItems: "center",
                    color,
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  <Icon className="size-3.5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-300">{title}</p>
                  <p className="text-[11px] text-gray-600 leading-relaxed mt-0.5">
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
