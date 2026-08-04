export type MarketType = "Stocks" | "Crypto" | "Forex" | "Futures" | "Options";
export type Direction = "BUY" | "SELL";
export type TradeType = "Intraday" | "Swing" | "Positional";
export type Emotion = "Confident" | "Fearful" | "FOMO" | "Greedy" | "Neutral";

export const MARKETS: MarketType[] = ["Stocks", "Crypto", "Forex", "Futures", "Options"];
export const TRADE_TYPES: TradeType[] = ["Intraday", "Swing", "Positional"];
export const EMOTIONS: Emotion[] = ["Confident", "Fearful", "FOMO", "Greedy", "Neutral"];
export const MISTAKE_TAGS = [
  "FOMO Entry",
  "Late Entry",
  "Early Exit",
  "Revenge Trade",
  "Good Trade",
  "Followed Rules",
] as const;
export type MistakeTag = (typeof MISTAKE_TAGS)[number];

export interface Trade {
  id: string;
  symbol: string;
  market: MarketType;
  direction: Direction;
  entry: number;
  exit: number;
  quantity: number;
  date: string; // ISO
  tradeType: TradeType;
  emotion: Emotion;
  tags: MistakeTag[];
  notes: string;
  /** Supabase Storage paths of attached chart screenshots */
  charts?: string[];
  rulesFollowed?: string[];
  rulesBroken?: string[];
}

export interface Rule {
  id: string;
  text: string;
}

export function pnl(t: Pick<Trade, "entry" | "exit" | "quantity" | "direction">): number {
  const raw = (t.exit - t.entry) * t.quantity;
  return t.direction === "BUY" ? raw : -raw;
}

export const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const signedMoney = (n: number) => `${n > 0 ? "+" : ""}${money(n)}`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

const t = (
  id: string,
  symbol: string,
  market: MarketType,
  direction: Direction,
  entry: number,
  exit: number,
  quantity: number,
  date: string,
  tradeType: TradeType,
  emotion: Emotion,
  tags: MistakeTag[],
  notes: string,
): Trade => ({
  id,
  symbol,
  market,
  direction,
  entry,
  exit,
  quantity,
  date,
  tradeType,
  emotion,
  tags,
  notes,
});

export const SAMPLE_TRADES: Trade[] = [
  t("t01", "AAPL", "Stocks", "BUY", 182.4, 188.9, 120, "2026-03-04T14:32:00Z", "Swing", "Confident", ["Good Trade", "Followed Rules"], "Breakout above the 20-day range with rising volume. Scaled out at target."),
  t("t02", "TSLA", "Stocks", "SELL", 254.1, 244.8, 60, "2026-03-06T15:05:00Z", "Intraday", "Neutral", ["Followed Rules"], "Faded the opening drive into VWAP rejection."),
  t("t03", "BTCUSD", "Crypto", "BUY", 61200, 59450, 0.6, "2026-03-09T09:12:00Z", "Swing", "FOMO", ["FOMO Entry", "Late Entry"], "Chased the candle after a news spike. No structure behind the entry."),
  t("t04", "ETHUSD", "Crypto", "BUY", 3120, 3388, 4, "2026-03-12T11:40:00Z", "Swing", "Confident", ["Good Trade"], "Higher-low retest on the daily. Clean risk of $80."),
  t("t05", "EURUSD", "Forex", "SELL", 1.0925, 1.0871, 100000, "2026-03-14T08:20:00Z", "Intraday", "Neutral", ["Followed Rules", "Good Trade"], "London session short after the Asian range failure."),
  t("t06", "NVDA", "Stocks", "BUY", 878.5, 842.2, 40, "2026-03-18T16:02:00Z", "Intraday", "Greedy", ["Revenge Trade"], "Re-entered right after a stop out. Size was too large for the setup."),
  t("t07", "GBPUSD", "Forex", "BUY", 1.2712, 1.2764, 80000, "2026-03-20T10:11:00Z", "Intraday", "Confident", ["Good Trade"], "Trend continuation off the 4H demand zone."),
  t("t08", "MSFT", "Stocks", "BUY", 412.6, 419.4, 55, "2026-03-25T13:47:00Z", "Positional", "Neutral", ["Followed Rules"], "Added on the pullback into the rising 50-day."),
  t("t09", "SOLUSD", "Crypto", "SELL", 148.2, 158.7, 30, "2026-03-27T19:25:00Z", "Swing", "Greedy", ["Late Entry", "Revenge Trade"], "Shorted strength in an uptrend. Fought the market."),
  t("t10", "ES", "Futures", "BUY", 5218.5, 5241.25, 2, "2026-04-01T14:55:00Z", "Intraday", "Confident", ["Good Trade", "Followed Rules"], "Opening range breakout with clean follow-through."),
  t("t11", "AMD", "Stocks", "BUY", 168.9, 161.4, 90, "2026-04-03T17:10:00Z", "Swing", "FOMO", ["FOMO Entry"], "Bought the gap up without waiting for the retest."),
  t("t12", "BTCUSD", "Crypto", "BUY", 58400, 63100, 0.4, "2026-04-08T07:35:00Z", "Positional", "Confident", ["Good Trade", "Followed Rules"], "Weekly support reclaim. Held through the noise."),
  t("t13", "USDJPY", "Forex", "SELL", 151.85, 151.42, 60000, "2026-04-10T06:15:00Z", "Intraday", "Neutral", ["Early Exit"], "Correct read but I closed half the target too early."),
  t("t14", "SPY 520C", "Options", "BUY", 4.85, 7.2, 10, "2026-04-15T15:30:00Z", "Intraday", "Confident", ["Good Trade"], "Momentum call on the CPI reaction. Quick scalp."),
  t("t15", "META", "Stocks", "SELL", 498.3, 511.6, 35, "2026-04-17T14:05:00Z", "Swing", "Fearful", ["Late Entry"], "Short into strength before earnings. Poor timing."),
  t("t16", "NQ", "Futures", "SELL", 18320, 18215, 1, "2026-04-22T18:40:00Z", "Intraday", "Confident", ["Followed Rules", "Good Trade"], "Lower-high rejection at the prior day high."),
  t("t17", "ETHUSD", "Crypto", "SELL", 3410, 3475, 3, "2026-04-24T20:02:00Z", "Intraday", "FOMO", ["FOMO Entry", "Revenge Trade"], "Immediately re-shorted after being stopped. Emotional."),
  t("t18", "AAPL", "Stocks", "BUY", 190.2, 196.75, 100, "2026-04-29T13:22:00Z", "Swing", "Confident", ["Good Trade", "Followed Rules"], "Post-earnings drift continuation."),
  t("t19", "AUDUSD", "Forex", "BUY", 0.6605, 0.6578, 90000, "2026-05-02T05:45:00Z", "Intraday", "Neutral", ["Followed Rules"], "Valid setup, market simply did not follow through."),
  t("t20", "TSLA", "Stocks", "BUY", 236.4, 251.9, 70, "2026-05-06T14:18:00Z", "Swing", "Confident", ["Good Trade"], "Base breakout with expanding volume."),
  t("t21", "SOLUSD", "Crypto", "BUY", 132.5, 149.8, 40, "2026-05-09T10:50:00Z", "Swing", "Neutral", ["Good Trade", "Followed Rules"], "Range low sweep and reclaim."),
  t("t22", "GOOGL", "Stocks", "SELL", 172.6, 176.9, 80, "2026-05-13T16:35:00Z", "Intraday", "Greedy", ["Revenge Trade", "Late Entry"], "Oversized short after a winning morning. Gave back profits."),
  t("t23", "CL", "Futures", "BUY", 78.4, 79.85, 3, "2026-05-16T15:12:00Z", "Intraday", "Confident", ["Good Trade"], "Inventory report continuation trade."),
  t("t24", "QQQ 445P", "Options", "BUY", 3.4, 2.15, 15, "2026-05-20T17:55:00Z", "Intraday", "Fearful", ["FOMO Entry", "Early Exit"], "Hedge bought in a panic, cut it at a loss when the market stabilised."),
];

export const DEFAULT_RULES: Rule[] = [
  { id: "r1", text: "Never enter a trade without a predefined stop loss" },
  { id: "r2", text: "Risk a maximum of 1% of account equity per trade" },
  { id: "r3", text: "No trades in the first 5 minutes after the open" },
  { id: "r4", text: "Minimum 1:2 risk-reward on every setup" },
  { id: "r5", text: "Maximum 3 trades per day — no revenge trading" },
  { id: "r6", text: "Journal every trade the same day it is closed" },
];

/* ── Derived analytics ─────────────────────────────────────────────── */

export function sortByDate(trades: Trade[]) {
  return [...trades].sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

export function stats(trades: Trade[]) {
  const pnls = trades.map(pnl);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p <= 0);
  const total = pnls.reduce((a, b) => a + b, 0);
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

  // current streak from most recent trades
  const ordered = sortByDate(trades).reverse();
  let streak = 0;
  let streakWin = true;
  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    if (!item) break;
    const p = pnl(item);
    if (i === 0) {
      streakWin = p > 0;
      streak = 1;
    } else if (p > 0 === streakWin) {
      streak++;
    } else break;
  }

  return {
    total,
    count: trades.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    wins: wins.length,
    losses: losses.length,
    avgWin,
    avgLoss,
    best: pnls.length ? Math.max(...pnls) : 0,
    worst: pnls.length ? Math.min(...pnls) : 0,
    rr: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0,
    streak,
    streakWin,
  };
}

export function equityCurve(trades: Trade[], startEquity = 25000) {
  let running = startEquity;
  return sortByDate(trades).map((tr) => {
    running += pnl(tr);
    return {
      date: new Date(tr.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      equity: Math.round(running),
    };
  });
}

export function monthlyPnl(trades: Trade[]) {
  const map = new Map<string, number>();
  sortByDate(trades).forEach((tr) => {
    const key = new Date(tr.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    map.set(key, (map.get(key) ?? 0) + pnl(tr));
  });
  return [...map.entries()].map(([month, value]) => ({ month, value: Math.round(value) }));
}

export function bySymbol(trades: Trade[]) {
  const map = new Map<string, { symbol: string; trades: number; value: number }>();
  trades.forEach((tr) => {
    const cur = map.get(tr.symbol) ?? { symbol: tr.symbol, trades: 0, value: 0 };
    cur.trades += 1;
    cur.value += pnl(tr);
    map.set(tr.symbol, cur);
  });
  return [...map.values()]
    .map((r) => ({ ...r, value: Math.round(r.value) }))
    .sort((a, b) => b.trades - a.trades);
}

export function byEmotion(trades: Trade[]) {
  return EMOTIONS.map((emotion) => {
    const subset = trades.filter((tr) => tr.emotion === emotion);
    const s = stats(subset);
    return {
      emotion,
      trades: subset.length,
      value: Math.round(s.total),
      winRate: Math.round(s.winRate),
    };
  });
}

export function byMistake(trades: Trade[]) {
  return MISTAKE_TAGS.map((tag) => {
    const subset = trades.filter((tr) => tr.tags.includes(tag));
    return {
      tag,
      count: subset.length,
      value: Math.round(subset.reduce((a, b) => a + pnl(b), 0)),
    };
  }).sort((a, b) => b.count - a.count);
}
