import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getEffectiveUser } from "@/lib/auth-helpers";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getEffectiveUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
