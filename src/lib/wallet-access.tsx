import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import {
  sendTransaction,
  switchChain,
  waitForTransactionReceipt,
} from "wagmi/actions";

import { supabase } from "@/integrations/supabase/client";
import { OWNER_ADDRESS, ritualChain, wagmiConfig } from "@/lib/wagmi";

export function utcDateString(d: Date = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Start of the current UTC day. */
export function startOfUtcDay(now: Date = new Date()) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Milliseconds until the next 00:00 UTC reset. */
export function msUntilUtcMidnight(now: Date = new Date()) {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(0, next - now.getTime());
}

export function formatCountdown(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function streakFromDates(dates: string[]) {
  const set = new Set(dates);
  let streak = 0;
  const cursor = new Date();
  // Streak counts back from today (UTC) while consecutive days exist.
  while (set.has(utcDateString(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

interface WalletAccessValue {
  address?: `0x${string}` | undefined;
  isConnected: boolean;
  connecting: boolean;
  connectors: ReturnType<typeof useConnect>["connectors"];
  connectWallet: (connectorId?: string) => Promise<void>;
  disconnectWallet: () => void;
  hasAccessToday: boolean;
  checking: boolean;
  unlocking: boolean;
  streak: number;
  unlockAccess: () => Promise<void>;
  wrongNetwork: boolean;
  switching: boolean;
  switchToRitual: () => Promise<void>;
  countdown: string;
}

const WalletAccessContext = createContext<WalletAccessValue | null>(null);

export function WalletAccessProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  const [hasAccessToday, setHasAccessToday] = useState(false);
  const [checking, setChecking] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [streak, setStreak] = useState(0);
  const [resetMs, setResetMs] = useState<number | null>(null);

  const wrongNetwork = isConnected && chainId !== ritualChain.id;

  const refresh = useCallback(async () => {
    if (!address) {
      setHasAccessToday(false);
      setStreak(0);
      setChecking(false);
      return;
    }
    setChecking(true);
    const wallet = address.toLowerCase();

    const { data: today } = await supabase
      .from("daily_access")
      .select("id")
      .eq("wallet_address", wallet)
      .gte("paid_at", startOfUtcDay().toISOString())
      .limit(1);
    setHasAccessToday((today ?? []).length > 0);

    const { data: history } = await supabase
      .from("daily_access")
      .select("paid_at")
      .eq("wallet_address", wallet)
      .order("paid_at", { ascending: false })
      .limit(120);
    setStreak(
      streakFromDates(
        (history ?? []).map((r) => utcDateString(new Date(r.paid_at as string))),
      ),
    );

    setChecking(false);
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Countdown to the next 00:00 UTC reset.
  useEffect(() => {
    setResetMs(msUntilUtcMidnight());
    const tick = setInterval(() => {
      const next = msUntilUtcMidnight();
      setResetMs(next);
      if (next >= 86_399_000) void refresh();
    }, 1000);
    return () => clearInterval(tick);
  }, [refresh]);

  const connectWallet = useCallback(
    async (connectorId?: string) => {
      const connector =
        connectors.find((c) => c.id === connectorId) ?? connectors[0];
      if (!connector) throw new Error("No wallet connector available.");
      await connect({ connector, chainId: ritualChain.id });
    },
    [connect, connectors],
  );

  const disconnectWallet = useCallback(() => {
    disconnect();
    setHasAccessToday(false);
    setStreak(0);
  }, [disconnect]);

  const switchToRitual = useCallback(async () => {
    setSwitching(true);
    try {
      // Wallets that don't know Ritual Chain yet get it added automatically.
      await switchChain(wagmiConfig, { chainId: ritualChain.id });
    } finally {
      setSwitching(false);
    }
  }, []);

  const unlockAccess = useCallback(async () => {
    if (!address) throw new Error("Connect a wallet first.");
    setUnlocking(true);
    try {
      if (chainId !== ritualChain.id) {
        await switchChain(wagmiConfig, { chainId: ritualChain.id });
      }

      // Zero-value confirmation transaction: the user only pays gas.
      const txHash = await sendTransaction(wagmiConfig, {
        to: OWNER_ADDRESS,
        value: 0n,
        chainId: ritualChain.id,
      });

      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash: txHash,
        chainId: ritualChain.id,
      });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (user) {
        const { error } = await supabase.from("daily_access").insert({
          user_id: user.id,
          wallet_address: address.toLowerCase(),
          paid_at: new Date().toISOString(),
          tx_hash: txHash,
        });
        if (error) console.error(error);
      }

      await refresh();
    } finally {
      setUnlocking(false);
    }
  }, [address, chainId, refresh]);

  const countdown = resetMs === null ? "--:--:--" : formatCountdown(resetMs);

  const value = useMemo(
    () => ({
      address,
      isConnected,
      connecting: isPending,
      connectors,
      connectWallet,
      disconnectWallet,
      hasAccessToday,
      checking,
      unlocking,
      streak,
      unlockAccess,
      wrongNetwork,
      switching,
      switchToRitual,
      countdown,
    }),
    [
      address,
      isConnected,
      isPending,
      connectors,
      connectWallet,
      disconnectWallet,
      hasAccessToday,
      checking,
      unlocking,
      streak,
      unlockAccess,
      wrongNetwork,
      switching,
      switchToRitual,
      countdown,
    ],
  );

  return (
    <WalletAccessContext.Provider value={value}>{children}</WalletAccessContext.Provider>
  );
}

export function useWalletAccess() {
  const ctx = useContext(WalletAccessContext);
  if (!ctx) throw new Error("useWalletAccess must be used inside WalletAccessProvider");
  return ctx;
}

/** Live countdown string to the next 00:00 UTC access reset. */
export function useUtcCountdown() {
  return useWalletAccess().countdown;
}
