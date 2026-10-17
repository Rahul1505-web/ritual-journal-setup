import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { CHART_BUCKET } from "./trade-charts";
import {
  DEFAULT_RULES,
  SAMPLE_TRADES,
  type Emotion,
  type MarketType,
  type MistakeTag,
  type Rule,
  type Trade,
  type TradeType,
  type Direction,
  type TradingAccount,
} from "./trades";

export const DEFAULT_ACCOUNTS: TradingAccount[] = [
  {
    id: "acc_main",
    name: "Main Trading Account",
    type: "Personal Live",
    broker: "Zerodha",
    initialBalance: 25000,
    currency: "$",
    color: "#598bff",
    status: "active",
    description: "Primary personal live trading account",
    createdAt: new Date().toISOString(),
  },
];

interface JournalContextValue {
  trades: Trade[];
  rules: Rule[];
  accounts: TradingAccount[];
  activeAccountId: string;
  setActiveAccountId: (id: string) => void;
  filteredTrades: Trade[];
  loading: boolean;
  /** true when the user has no saved trades and sample data is shown */
  isDemo: boolean;
  addTrade: (trade: Omit<Trade, "id">) => Promise<void>;
  updateTradeCharts: (id: string, charts: string[]) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  addRule: (text: string) => Promise<void>;
  updateRule: (id: string, text: string) => Promise<void>;
  removeRule: (id: string) => Promise<void>;
  addAccount: (account: Omit<TradingAccount, "id">) => Promise<TradingAccount>;
  updateAccount: (id: string, updates: Partial<TradingAccount>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
}

const JournalContext = createContext<JournalContextValue | null>(null);

type TradeRow = {
  id: string;
  symbol: string;
  market_type: string;
  direction: string;
  entry_price: number | string;
  exit_price: number | string;
  quantity: number | string;
  trade_date: string;
  trade_type: string;
  emotion: string;
  mistake_tags: string[] | null;
  notes: string | null;
  chart_urls: string[] | null;
};

const num = (v: number | string) => (typeof v === "number" ? v : parseFloat(v));

const META_REGEX = /\s*<!--tradelog:(\{.*?\})-->\s*$/;

export function packTradeNotes(
  notes: string,
  meta: { sl?: number; tp?: number; amount?: number; leverage?: number; accountId?: string },
): string {
  const clean = notes ? notes.replace(META_REGEX, "").trim() : "";
  const hasMeta =
    meta.sl !== undefined ||
    meta.tp !== undefined ||
    meta.amount !== undefined ||
    meta.leverage !== undefined ||
    meta.accountId !== undefined;
  if (!hasMeta) return clean;
  const metaComment = `<!--tradelog:${JSON.stringify(meta)}-->`;
  return clean ? `${clean}\n\n${metaComment}` : metaComment;
}

export function unpackTradeNotes(rawNotes: string | null | undefined): {
  notes: string;
  sl?: number;
  tp?: number;
  amount?: number;
  leverage?: number;
  accountId?: string;
} {
  if (!rawNotes) return { notes: "" };
  const match = rawNotes.match(META_REGEX);
  if (match) {
    try {
      const meta = JSON.parse(match[1] as string) as {
        sl?: number;
        tp?: number;
        amount?: number;
        leverage?: number;
        accountId?: string;
      };
      const cleaned = rawNotes.replace(META_REGEX, "").trim();
      return {
        notes: cleaned,
        ...(typeof meta.sl === "number" && !isNaN(meta.sl) ? { sl: meta.sl } : {}),
        ...(typeof meta.tp === "number" && !isNaN(meta.tp) ? { tp: meta.tp } : {}),
        ...(typeof meta.amount === "number" && !isNaN(meta.amount) ? { amount: meta.amount } : {}),
        ...(typeof meta.leverage === "number" && !isNaN(meta.leverage) ? { leverage: meta.leverage } : {}),
        ...(typeof meta.accountId === "string" ? { accountId: meta.accountId } : {}),
      };
    } catch {
      // fallback
    }
  }
  return { notes: rawNotes };
}

function toTrade(row: TradeRow, defaultAccountId?: string): Trade {
  const { notes, sl, tp, amount, leverage, accountId } = unpackTradeNotes(row.notes);
  const resolvedAccountId = accountId ?? defaultAccountId;
  return {
    id: row.id,
    symbol: row.symbol,
    market: row.market_type as MarketType,
    direction: row.direction as Direction,
    entry: num(row.entry_price),
    ...(sl !== undefined ? { sl } : {}),
    ...(tp !== undefined ? { tp } : {}),
    ...(amount !== undefined ? { amount } : {}),
    ...(leverage !== undefined ? { leverage } : {}),
    ...(resolvedAccountId !== undefined ? { accountId: resolvedAccountId } : {}),
    exit: num(row.exit_price),
    quantity: num(row.quantity),
    date: row.trade_date,
    tradeType: row.trade_type as TradeType,
    emotion: row.emotion as Emotion,
    tags: (row.mistake_tags ?? []) as MistakeTag[],
    notes,
    charts: row.chart_urls ?? [],
  };
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>(DEFAULT_ACCOUNTS);
  const [activeAccountId, setActiveAccountIdState] = useState<string>(() => {
    try {
      return localStorage.getItem("tradelog_active_account") ?? "all";
    } catch {
      return "all";
    }
  });
  const [accountRowMap, setAccountRowMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const setActiveAccountId = useCallback((id: string) => {
    setActiveAccountIdState(id);
    try {
      localStorage.setItem("tradelog_active_account", id);
    } catch {
      // ignore
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setTrades([]);
      setRules([]);
      setAccounts(DEFAULT_ACCOUNTS);
      setLoading(false);
      return;
    }

    const [tradesRes, rulesRes] = await Promise.all([
      supabase
        .from("trades")
        .select(
          "id,symbol,market_type,direction,entry_price,exit_price,quantity,trade_date,trade_type,emotion,mistake_tags,notes,chart_urls",
        )
        .order("trade_date", { ascending: true }),
      supabase.from("rules").select("id,rule_text").order("created_at", { ascending: true }),
    ]);

    const allRuleRows = (rulesRes.data ?? []) as { id: string; rule_text: string }[];

    // 1. Parse accounts stored in rules table with prefix '__ACCOUNT__:'
    const accountRows = allRuleRows.filter((r) => r.rule_text.startsWith("__ACCOUNT__:"));
    let loadedAccounts: TradingAccount[] = [];
    const newAccountRowMap: Record<string, string> = {};

    if (accountRows.length === 0) {
      // Seed the default primary account in Supabase
      const defaultAcc = DEFAULT_ACCOUNTS[0];
      if (!defaultAcc) {
        setLoading(false);
        return;
      }
      const { data: seededAcc } = await supabase
        .from("rules")
        .insert({
          user_id: user.id,
          rule_text: `__ACCOUNT__:${JSON.stringify(defaultAcc)}`,
        })
        .select("id")
        .single();
      loadedAccounts = [defaultAcc];
      if (seededAcc) {
        newAccountRowMap[defaultAcc.id] = seededAcc.id;
      }
    } else {
      for (const row of accountRows) {
        try {
          const jsonStr = row.rule_text.replace("__ACCOUNT__:", "");
          const parsed = JSON.parse(jsonStr) as TradingAccount;
          loadedAccounts.push(parsed);
          newAccountRowMap[parsed.id] = row.id;
        } catch {
          // ignore corrupted account row
        }
      }
    }

    setAccounts(loadedAccounts);
    setAccountRowMap(newAccountRowMap);

    const primaryAccountId = loadedAccounts[0]?.id ?? "acc_main";

    // 2. Parse normal rules (excluding account configurations)
    const normalRuleRows = allRuleRows.filter((r) => !r.rule_text.startsWith("__ACCOUNT__:"));
    let ruleItems = normalRuleRows;

    if (normalRuleRows.length === 0) {
      // Give every new account the starter rule set so the checklist is usable.
      const { data: seededRules } = await supabase
        .from("rules")
        .insert(DEFAULT_RULES.map((r) => ({ user_id: user.id, rule_text: r.text })))
        .select("id,rule_text");
      ruleItems = (seededRules ?? []) as { id: string; rule_text: string }[];
    }
    setRules(ruleItems.map((r) => ({ id: r.id, text: r.rule_text })));

    // 3. Map trades with account attribution
    setTrades(((tradesRes.data ?? []) as TradeRow[]).map((row) => toTrade(row, primaryAccountId)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const addAccount = useCallback(
    async (accountData: Omit<TradingAccount, "id">): Promise<TradingAccount> => {
      if (accounts.length >= 15) {
        throw new Error("Maximum 15 accounts allowed. Please delete or archive an existing account.");
      }
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in to add an account.");

      const newId = `acc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const newAccount: TradingAccount = {
        ...accountData,
        id: newId,
        createdAt: new Date().toISOString(),
      };

      const { data: inserted, error } = await supabase
        .from("rules")
        .insert({
          user_id: user.id,
          rule_text: `__ACCOUNT__:${JSON.stringify(newAccount)}`,
        })
        .select("id")
        .single();

      if (error) throw error;
      if (inserted) {
        setAccountRowMap((prev) => ({ ...prev, [newId]: inserted.id }));
      }
      setAccounts((prev) => [...prev, newAccount]);
      await refresh();
      return newAccount;
    },
    [accounts.length, refresh],
  );

  const updateAccount = useCallback(
    async (id: string, updates: Partial<TradingAccount>) => {
      const existing = accounts.find((a) => a.id === id);
      if (!existing) throw new Error("Account not found.");

      const updated: TradingAccount = { ...existing, ...updates };
      const rowId = accountRowMap[id];
      if (rowId) {
        const { error } = await supabase
          .from("rules")
          .update({ rule_text: `__ACCOUNT__:${JSON.stringify(updated)}` })
          .eq("id", rowId);
        if (error) throw error;
      }
      setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      await refresh();
    },
    [accounts, accountRowMap, refresh],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      if (accounts.length <= 1) {
        throw new Error("You must keep at least one trading account.");
      }
      const rowId = accountRowMap[id];
      if (rowId) {
        const { error } = await supabase.from("rules").delete().eq("id", rowId);
        if (error) throw error;
      }
      if (activeAccountId === id) {
        setActiveAccountId("all");
      }
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      await refresh();
    },
    [accounts.length, accountRowMap, activeAccountId, setActiveAccountId, refresh],
  );

  const addTrade = useCallback(
    async (trade: Omit<Trade, "id">) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in to log a trade.");
      const { error } = await supabase.from("trades").insert({
        user_id: user.id,
        symbol: trade.symbol,
        market_type: trade.market,
        direction: trade.direction,
        entry_price: trade.entry,
        exit_price: trade.exit,
        quantity: trade.quantity,
        trade_date: trade.date,
        trade_type: trade.tradeType,
        emotion: trade.emotion,
        mistake_tags: trade.tags,
        notes: packTradeNotes(trade.notes, {
          ...(trade.sl !== undefined ? { sl: trade.sl } : {}),
          ...(trade.tp !== undefined ? { tp: trade.tp } : {}),
          ...(trade.amount !== undefined ? { amount: trade.amount } : {}),
          ...(trade.leverage !== undefined ? { leverage: trade.leverage } : {}),
          accountId: trade.accountId ?? accounts[0]?.id ?? "acc_main",
        }),
        chart_urls: trade.charts ?? [],
      });
      if (error) throw error;
      await refresh();
    },
    [accounts, refresh],
  );

  const updateTradeCharts = useCallback(async (id: string, charts: string[]) => {
    setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, charts } : t)));
    const { error } = await supabase.from("trades").update({ chart_urls: charts }).eq("id", id);
    if (error) throw error;
  }, []);

  const deleteTrade = useCallback(
    async (id: string) => {
      const target = trades.find((t) => t.id === id);
      const { error } = await supabase.from("trades").delete().eq("id", id);
      if (error) throw error;
      if (target?.charts?.length) {
        await supabase.storage.from(CHART_BUCKET).remove(target.charts);
      }
      setTrades((prev) => prev.filter((t) => t.id !== id));
    },
    [trades],
  );

  const addRule = useCallback(
    async (text: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;
      const { error } = await supabase.from("rules").insert({ user_id: user.id, rule_text: text });
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const updateRule = useCallback(async (id: string, text: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, text } : r)));
    await supabase.from("rules").update({ rule_text: text }).eq("id", id);
  }, []);

  const removeRule = useCallback(async (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("rules").delete().eq("id", id);
  }, []);

  const isDemo = !loading && trades.length === 0;

  const currentTrades = isDemo ? SAMPLE_TRADES : trades;

  const filteredTrades = useMemo(() => {
    if (activeAccountId === "all") return currentTrades;
    const defaultAccId = accounts[0]?.id ?? "acc_main";
    return currentTrades.filter((t) => (t.accountId ?? defaultAccId) === activeAccountId);
  }, [currentTrades, activeAccountId, accounts]);

  const value = useMemo(
    () => ({
      trades: currentTrades,
      rules,
      accounts,
      activeAccountId,
      setActiveAccountId,
      filteredTrades,
      loading,
      isDemo,
      addTrade,
      updateTradeCharts,
      deleteTrade,
      addRule,
      updateRule,
      removeRule,
      addAccount,
      updateAccount,
      deleteAccount,
    }),
    [
      currentTrades,
      rules,
      accounts,
      activeAccountId,
      setActiveAccountId,
      filteredTrades,
      loading,
      isDemo,
      addTrade,
      updateTradeCharts,
      deleteTrade,
      addRule,
      updateRule,
      removeRule,
      addAccount,
      updateAccount,
      deleteAccount,
    ],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used inside JournalProvider");
  return ctx;
}
