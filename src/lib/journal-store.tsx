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
} from "./trades";

interface JournalContextValue {
  trades: Trade[];
  rules: Rule[];
  loading: boolean;
  /** true when the user has no saved trades and sample data is shown */
  isDemo: boolean;
  addTrade: (trade: Omit<Trade, "id">) => Promise<void>;
  updateTradeCharts: (id: string, charts: string[]) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  addRule: (text: string) => Promise<void>;
  updateRule: (id: string, text: string) => Promise<void>;
  removeRule: (id: string) => Promise<void>;
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

function toTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    symbol: row.symbol,
    market: row.market_type as MarketType,
    direction: row.direction as Direction,
    entry: num(row.entry_price),
    exit: num(row.exit_price),
    quantity: num(row.quantity),
    date: row.trade_date,
    tradeType: row.trade_type as TradeType,
    emotion: row.emotion as Emotion,
    tags: (row.mistake_tags ?? []) as MistakeTag[],
    notes: row.notes ?? "",
    charts: row.chart_urls ?? [],
  };
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setTrades([]);
      setRules([]);
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

    setTrades(((tradesRes.data ?? []) as TradeRow[]).map(toTrade));

    let ruleRows = (rulesRes.data ?? []) as { id: string; rule_text: string }[];
    if (ruleRows.length === 0) {
      // Give every new account the starter rule set so the checklist is usable.
      const { data: seeded } = await supabase
        .from("rules")
        .insert(DEFAULT_RULES.map((r) => ({ user_id: user.id, rule_text: r.text })))
        .select("id,rule_text");
      ruleRows = (seeded ?? []) as { id: string; rule_text: string }[];
    }
    setRules(ruleRows.map((r) => ({ id: r.id, text: r.rule_text })));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

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
        notes: trade.notes,
        chart_urls: trade.charts ?? [],
      });
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const updateTradeCharts = useCallback(async (id: string, charts: string[]) => {
    setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, charts } : t)));
    const { error } = await supabase.from("trades").update({ chart_urls: charts }).eq("id", id);
    if (error) throw error;
  }, []);

  const deleteTrade = useCallback(async (id: string) => {
    const target = trades.find((t) => t.id === id);
    const { error } = await supabase.from("trades").delete().eq("id", id);
    if (error) throw error;
    if (target?.charts?.length) {
      await supabase.storage.from(CHART_BUCKET).remove(target.charts);
    }
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }, [trades]);

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

  const value = useMemo(
    () => ({
      trades: isDemo ? SAMPLE_TRADES : trades,
      rules,
      loading,
      isDemo,
      addTrade,
      updateTradeCharts,
      deleteTrade,
      addRule,
      updateRule,
      removeRule,
    }),
    [trades, rules, loading, isDemo, addTrade, updateTradeCharts, deleteTrade, addRule, updateRule, removeRule],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used inside JournalProvider");
  return ctx;
}
