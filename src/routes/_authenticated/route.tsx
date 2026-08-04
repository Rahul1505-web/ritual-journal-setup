import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { WagmiProvider } from "wagmi";

import { WalletGate } from "@/components/wallet-gate";
import { supabase } from "@/integrations/supabase/client";
import { wagmiConfig } from "@/lib/wagmi";
import { WalletAccessProvider } from "@/lib/wallet-access";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <WagmiProvider config={wagmiConfig}>
      <WalletAccessProvider>
        <WalletGate>
          <Outlet />
        </WalletGate>
      </WalletAccessProvider>
    </WagmiProvider>
  ),
});
