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
import { clearGuestUser, getEffectiveUser } from "@/lib/auth-helpers";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — TradeLog Pro" },
      {
        name: "description",
        content: "Manage your trader profile, base currency and starting equity.",
      },
      { property: "og:title", content: "Profile — TradeLog Pro" },
      {
        property: "og:description",
        content: "Manage your trader profile and account settings.",
      },
    ],
  }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletType, setWalletType] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [isGuest, setIsGuest] = useState<boolean>(false);

  useEffect(() => {
    void getEffectiveUser().then((user) => {
      if (user) {
        const userEmail =
          user.email && !user.email.endsWith("@wallet.tradelog.app")
            ? user.email
            : "";
        setEmail(userEmail);
        const metadata = user.user_metadata as Record<string, any> | undefined;
        const addr: string = (metadata?.["wallet_address"] as string) ?? "";
        setWalletAddress(addr);
        setWalletType((metadata?.["wallet_type"] as string) ?? "Wallet");
        setName((metadata?.["full_name"] as string) ?? (metadata?.["name"] as string) ?? "");
        setIsGuest(!!user.isGuest);
      }
    });
  }, []);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    clearGuestUser();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <AppLayout title="Profile" subtitle="Your account and trading defaults">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="gap-6 p-6">
          <h2 className="text-lg font-semibold">User info</h2>

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
            <div className="flex items-center justify-between">
              <Label>{walletAddress ? "Account / Wallet" : "Account Email"}</Label>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${isGuest ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                {isGuest ? '⚡ Local Workspace' : '☁️ Cloud Synced'}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm flex items-center gap-2">
              {walletAddress ? (
                <>
                  <span className="text-[11px] text-muted-foreground font-medium">{walletType}</span>
                  <span className="font-mono text-xs break-all text-foreground">{walletAddress}</span>
                </>
              ) : email ? (
                <span className="text-foreground">{email}</span>
              ) : (
                <span className="text-muted-foreground">{isGuest ? "Guest Trader" : "Signed In"}</span>
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
          <h2 className="text-lg font-semibold">Account</h2>
          <p className="text-sm text-muted-foreground">
            Disconnect your wallet to switch accounts. Your data is saved in the cloud —
            reconnect with the same wallet on any device to access it instantly.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
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
