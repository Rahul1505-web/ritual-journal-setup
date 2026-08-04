import { Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ACCESS_PRICE, shortAddress } from "@/lib/wagmi";
import { useWalletAccess } from "@/lib/wallet-access";

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-4 py-8 backdrop-blur">
      <Card className="w-full max-w-md gap-5 p-6">{children}</Card>
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
    paying,
    payForToday,
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
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Wallet className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Connect your wallet</h2>
              <p className="text-xs text-muted-foreground">
                Connect your wallet to access TradeLog Pro.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {connectors.map((c) => (
              <Button
                key={c.uid}
                className="w-full"
                variant={c.id === connectors[0]?.id ? "default" : "outline"}
                disabled={connecting}
                onClick={() => void onConnect(c.id)}
              >
                {busyId === c.id ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                Connect {c.name}
              </Button>
            ))}
            {connectors.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">
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
          <div className="text-center">
            <div className="text-4xl">🔥</div>
            <h2 className="mt-2 text-xl font-bold tracking-tight">Unlock Today's Access</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pay {ACCESS_PRICE} RITUAL on Ritual Chain to unlock 24-hour access to TradeLog
              Pro. Access resets daily.
            </p>
          </div>


          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-profit" />
            <span className="font-mono">{shortAddress(address)}</span>
          </div>

          {wrongNetwork ? (
            <Button
              className="w-full"
              disabled={switching}
              onClick={async () => {
                try {
                  await switchToRitual();
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Could not switch network.",
                  );
                }
              }}
            >
              {switching ? <Loader2 className="size-4 animate-spin" /> : null}
              Switch to Ritual Chain
            </Button>
          ) : (
            <Button
              className="w-full bg-profit text-background hover:bg-profit/90"
              disabled={paying}
              onClick={async () => {
                try {
                  await payForToday();
                  toast.success("✅ Access granted for today!");
                } catch {
                  toast.error("Transaction failed. Please try again.");
                }
              }}
            >
              {paying ? <Loader2 className="size-4 animate-spin" /> : null}
              {paying ? "Confirming on Ritual Chain..." : "Pay for Today's Access"}
            </Button>
          )}

        </Overlay>
      </>
    );
  }

  return <>{children}</>;
}
