import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWalletAccess } from "@/lib/wallet-access";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — TradeLog Pro" },
      {
        name: "description",
        content: "Manage your trader profile, linked Google account, wallet, base currency and starting equity.",
      },
      { property: "og:title", content: "Profile — TradeLog Pro" },
      {
        property: "og:description",
        content: "Manage your trader profile, linked account, wallet and equity settings.",
      },
    ],
  }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isConnected, address, disconnectWallet } = useWalletAccess();
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      const meta = data.user?.user_metadata as { full_name?: string; name?: string } | undefined;
      setName(meta?.full_name ?? meta?.name ?? "");
    });
  }, []);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <AppLayout title="Profile" subtitle="Your account, wallet and trading defaults">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="gap-6 p-6">
          <h2 className="text-sm font-semibold">User info</h2>

          <div className="space-y-2">
            <Label htmlFor="name">Trader name</Label>
            <Input
              id="name"
              value={name}
              placeholder="Your name"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Account email</Label>
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm">
              {email ? (
                <span className="break-all">{email}</span>
              ) : (
                <span className="text-muted-foreground">No email account linked</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Wallet address</Label>
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 font-mono text-xs">
              {isConnected && address ? (
                <span className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full bg-profit" />
                  <span className="break-all">{address}</span>
                </span>
              ) : (
                <span className="font-sans text-sm text-muted-foreground">No wallet connected</span>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Base currency</Label>
              <Select defaultValue="USD">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "GBP", "INR"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="equity">Starting equity</Label>
              <Input id="equity" type="number" defaultValue={25000} />
            </div>
          </div>

          <Button className="w-fit" onClick={() => toast.success("Profile saved.")}>
            Save changes
          </Button>
        </Card>

        <Card className="gap-6 p-6">
          <h2 className="text-sm font-semibold">Actions</h2>
          <p className="text-sm text-muted-foreground">
            Disconnecting your wallet keeps you signed in. Signing out clears your session entirely.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              disabled={!isConnected}
              onClick={() => {
                disconnectWallet();
                toast.success("Wallet disconnected.");
              }}
              className="border-loss/60 text-loss hover:bg-loss/10 hover:text-loss"
            >
              Disconnect Wallet
            </Button>
            <Button
              variant="outline"
              onClick={() => void signOut()}
              className="border-loss/60 text-loss hover:bg-loss/10 hover:text-loss"
            >
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
