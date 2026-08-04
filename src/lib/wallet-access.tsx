import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { parseEther } from "viem";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import {
  readContract,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";

import { supabase } from "@/integrations/supabase/client";
import {
  ACCESS_CONTRACT_ABI,
  ACCESS_CONTRACT_ADDRESS,
  ACCESS_PRICE,
  ritualChain,
  wagmiConfig,
} from "@/lib/wagmi";

export function utcDateString(d: Date = new Date()) {
  return d.toISOString().slice(0, 10);
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

/** UTC day index used by the access contract (Unix timestamp divided by one day). */
export function utcDayIndex(nowMs: number = Date.now()) {
  return Math.floor(nowMs / 86_400_000);
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
  paying: boolean;
  streak: number;
  payForToday: () => Promise<void>;
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
  const [paying, setPaying] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [streak, setStreak] = useState(0);
  const [resetMs, setResetMs] = useState<number | null>(null);

  const wrongNetwork = isConnected && chainId !== ritualChain.id;

  const refreshStreak = useCallback(async (wallet: string) => {
    const { data } = await supabase
      .from("wallet_access")
      .select("access_date")
      .eq("wallet_address", wallet)
      .order("access_date", { ascending: false })
      .limit(60);
    const dates = (data ?? []).map((r) => r.access_date as string);
    setStreak(streakFromDates(dates));
  }, []);

  const refresh = useCallback(async () => {
    if (!address) {
      setHasAccessToday(false);
      setStreak(0);
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const lastAccessDay = (await readContract(wagmiConfig, {
        address: ACCESS_CONTRACT_ADDRESS,
        abi: ACCESS_CONTRACT_ABI,
        functionName: "lastAccessDay",
        args: [address],
        chainId: ritualChain.id,
      })) as bigint;

      // Access is derived from contract storage on every load/connect. React state
      // only mirrors that result for rendering and is never the source of truth.
      setHasAccessToday(lastAccessDay >= BigInt(utcDayIndex()));
    } catch {
      setHasAccessToday(false);
    }
    void refreshStreak(address.toLowerCase());
    setChecking(false);
  }, [address, refreshStreak]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Contract-driven countdown to the next access reset.
  const fetchingReset = useRef(false);
  const loadReset = useCallback(async () => {
    if (fetchingReset.current) return;
    fetchingReset.current = true;
    try {
      const seconds = (await readContract(wagmiConfig, {
        address: ACCESS_CONTRACT_ADDRESS,
        abi: ACCESS_CONTRACT_ABI,
        functionName: "getTimeUntilReset",
        chainId: ritualChain.id,
      })) as bigint;
      setResetMs(Number(seconds) * 1000);
    } catch {
      setResetMs(msUntilUtcMidnight());
    } finally {
      fetchingReset.current = false;
    }
  }, []);

  useEffect(() => {
    void loadReset();
    const tick = setInterval(() => {
      setResetMs((prev) => {
        if (prev === null) return prev;
        const next = prev - 1000;
        if (next <= 0) {
          void loadReset();
          void refresh();
          return 0;
        }
        return next;
      });
    }, 1000);
    const resync = setInterval(() => void loadReset(), 5 * 60 * 1000);
    return () => {
      clearInterval(tick);
      clearInterval(resync);
    };
  }, [loadReset, refresh]);

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

  const payForToday = useCallback(async () => {
    if (!address) throw new Error("Connect a wallet first.");
    setPaying(true);
    try {
      if (chainId !== ritualChain.id) {
        await switchChain(wagmiConfig, { chainId: ritualChain.id });
      }

      const txHash = await writeContract(wagmiConfig, {
        address: ACCESS_CONTRACT_ADDRESS,
        abi: ACCESS_CONTRACT_ABI,
        functionName: "payForAccess",
        value: parseEther(ACCESS_PRICE),
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
        const { error } = await supabase.from("wallet_access").insert({
          user_id: user.id,
          wallet_address: address.toLowerCase(),
          access_date: utcDateString(),
          tx_hash: txHash,
        });
        if (error && error.code !== "23505") console.error(error);
      }

      await refresh();
      void loadReset();
    } finally {
      setPaying(false);
    }
  }, [address, chainId, refresh, loadReset]);

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
      paying,
      streak,
      payForToday,
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
      paying,
      streak,
      payForToday,
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

/** Live countdown string to the next access reset (contract-driven). */
export function useUtcCountdown() {
  return useWalletAccess().countdown;
}
