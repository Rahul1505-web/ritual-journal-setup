import { Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/wagmi";
import { useWalletAccess } from "@/lib/wallet-access";

const COLORS = {
  card: "#111827",
  border: "#1f2937",
  primary: "#6366f1",
  success: "#10b981",
  text: "#f9fafb",
  muted: "#6b7280",
};

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 backdrop-blur-sm bg-[rgba(10,13,26,0.88)]">
      <div
        className="w-full max-w-[440px] animate-in fade-in slide-in-from-bottom-2 duration-200"
        style={{
          backgroundColor: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: "8px",
          padding: "32px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ fontSize: "13px", padding: "8px 0" }}
    >
      <span style={{ color: COLORS.muted }}>{label}</span>
      <span style={{ color: COLORS.text }}>{value}</span>
    </div>
  );
}

export function WalletGate({ children }: { children: React.ReactNode }) {
  const {
    isConnected,
    address,
    connectors,
    connecting,
    connectWallet,
    hasAccessToday,
    checking,
    unlocking,
    unlockAccess,
    wrongNetwork,
    switching,
    switchToRitual,
  } = useWalletAccess();
  const [busyId, setBusyId] = useState<string | null>(null);

  const onConnect = async (id: string) => {
    setBusyId(id);
    try {
      await connectWallet(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wallet connection failed.");
    } finally {
      setBusyId(null);
    }
  };

  if (!isConnected) {
    return (
      <>
        {children}
        <Overlay>
          <h2
            className="font-semibold tracking-tight"
            style={{ color: COLORS.text, fontSize: "20px", marginBottom: "8px" }}
          >
            Connect Wallet
          </h2>
          <p style={{ color: COLORS.muted, fontSize: "13px", lineHeight: 1.5, marginBottom: "24px" }}>
            Connect MetaMask on Ritual Chain to continue to TradeLog Pro.
          </p>

          <div className="space-y-2">
            {connectors.map((c) => (
              <Button
                key={c.uid}
                className="w-full justify-center gap-2 font-medium"
                style={{
                  height: "52px",
                  borderRadius: "8px",
                  backgroundColor: c.uid === connectors[0]?.uid ? COLORS.primary : "transparent",
                  border: c.uid === connectors[0]?.uid ? "none" : `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                }}
                disabled={connecting}
                onClick={() => void onConnect(c.id)}
              >
                {busyId === c.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wallet className="size-4" />
                )}
                Connect {c.name}
              </Button>
            ))}
            {connectors.length === 0 ? (
              <p className="text-center" style={{ color: COLORS.muted, fontSize: "12px" }}>
                No wallet detected. Install MetaMask to continue.
              </p>
            ) : null}
          </div>
        </Overlay>
      </>
    );
  }

  if (!checking && !hasAccessToday) {
    return (
      <>
        {children}
        <Overlay>
          <h2
            className="font-semibold tracking-tight"
            style={{ color: COLORS.text, fontSize: "20px", marginBottom: "8px" }}
          >
            Daily Access Required
          </h2>
          <p style={{ color: COLORS.muted, fontSize: "13px", lineHeight: 1.5, marginBottom: "24px" }}>
            Confirm a transaction to access TradeLog Pro for today. Access resets at 00:00 UTC.
          </p>

          <div
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: "8px",
              padding: "8px 16px",
              marginBottom: "24px",
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{ fontSize: "13px", padding: "8px 0" }}
            >
              <span style={{ color: COLORS.muted }}>Wallet</span>
              <span className="flex items-center gap-2 font-mono" style={{ color: COLORS.text }}>
                <span
                  className="size-2"
                  style={{ backgroundColor: COLORS.success, borderRadius: "9999px" }}
                />
                {shortAddress(address)}
              </span>
            </div>
            <InfoRow label="Cost" value="Gas fee only" />
            <InfoRow label="Resets" value="00:00 UTC daily" />
          </div>

          {wrongNetwork ? (
            <Button
              className="w-full justify-center font-medium"
              style={{
                height: "52px",
                borderRadius: "8px",
                backgroundColor: COLORS.primary,
                color: COLORS.text,
                border: "none",
              }}
              disabled={switching}
              onClick={async () => {
                try {
                  await switchToRitual();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not switch network.");
                }
              }}
            >
              {switching ? <Loader2 className="size-4 animate-spin" /> : null}
              Switch to Ritual Chain
            </Button>
          ) : (
            <Button
              className="w-full justify-center font-medium"
              style={{
                height: "52px",
                borderRadius: "8px",
                backgroundColor: COLORS.primary,
                color: COLORS.text,
                border: "none",
              }}
              disabled={unlocking}
              onClick={async () => {
                try {
                  await unlockAccess();
                  toast.success("Access granted for today.");
                } catch {
                  toast.error("Transaction failed. Please try again.");
                }
              }}
            >
              {unlocking ? <Loader2 className="size-4 animate-spin" /> : null}
              {unlocking ? "Confirming transaction..." : "Unlock Access"}
            </Button>
          )}

          <p
            className="text-center"
            style={{ color: COLORS.muted, fontSize: "12px", marginTop: "16px", lineHeight: 1.5 }}
          >
            You will be prompted to confirm a transaction in MetaMask
          </p>
        </Overlay>
      </>
    );
  }

  return <>{children}</>;
}
