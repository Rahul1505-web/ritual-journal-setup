import { pnl, type Trade, sortByDate } from "./trades";

export interface DayTradeSummary {
  date: string; // YYYY-MM-DD
  totalPnl: number;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  trades: Trade[];
}

export interface CalendarDay {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  totalPnl: number;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  trades: Trade[];
}

export interface DayOfWeekStat {
  dayName: string; // "Monday", "Tuesday", etc.
  dayShort: string; // "Mon", "Tue", etc.
  dayIndex: number; // 0 = Sunday, 1 = Monday ... 6 = Saturday
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface SymbolProfitStat {
  symbol: string;
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
}

export interface TimeSessionStat {
  id: string;
  name: string;
  hours: string; // e.g. "13:00 - 19:00 UTC (US Open)"
  icon: string;
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface HourlyStat {
  hour: number;
  label: string; // "09:00", "14:00"
  pnl: number;
  trades: number;
}

export interface EquityCurvePoint {
  date: string;
  time: string;
  rawDate: string;
  equity: number;
  peak: number;
  drawdownDollars: number;
  drawdownPercent: number;
  tradePnl: number;
  cumulativePnl: number;
  symbol: string;
}

export interface EquityCurveSummary {
  points: EquityCurvePoint[];
  startEquity: number;
  currentEquity: number;
  peakEquity: number;
  netPnl: number;
  roiPercent: number;
  maxDrawdownDollars: number;
  maxDrawdownPercent: number;
}

/**
 * Groups trades by YYYY-MM-DD date string.
 */
export function getDailyTradeSummaries(trades: Trade[]): Map<string, DayTradeSummary> {
  const map = new Map<string, DayTradeSummary>();

  for (const tr of trades) {
    const d = new Date(tr.date);
    if (isNaN(d.getTime())) continue;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${day}`;

    const tradePnl = pnl(tr);
    const existing = map.get(dateKey);

    if (existing) {
      existing.totalPnl += tradePnl;
      existing.tradesCount += 1;
      if (tradePnl > 0) existing.winsCount += 1;
      else if (tradePnl < 0) existing.lossesCount += 1;
      existing.trades.push(tr);
    } else {
      map.set(dateKey, {
        date: dateKey,
        totalPnl: tradePnl,
        tradesCount: 1,
        winsCount: tradePnl > 0 ? 1 : 0,
        lossesCount: tradePnl < 0 ? 1 : 0,
        trades: [tr],
      });
    }
  }

  return map;
}

/**
 * Builds a 7x5 or 7x6 calendar grid for a given year and month (0-indexed month).
 */
export function buildMonthCalendarGrid(
  year: number,
  monthIndex: number,
  dailyPnlMap: Map<string, DayTradeSummary>,
): CalendarDay[] {
  const days: CalendarDay[] = [];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);

  // Day of week for 1st of month: 0=Sun, 1=Mon, ..., 6=Sat
  // Let's use Monday as 1st day of the week (standard trading calendar)
  // Monday = 0, Sunday = 6
  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday becomes 6

  // Days from previous month to fill initial row
  const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const prevMonthDate = new Date(year, monthIndex - 1, dayNum);
    const y = prevMonthDate.getFullYear();
    const m = String(prevMonthDate.getMonth() + 1).padStart(2, "0");
    const dStr = String(dayNum).padStart(2, "0");
    const dateStr = `${y}-${m}-${dStr}`;

    const summary = dailyPnlMap.get(dateStr);
    days.push({
      dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      totalPnl: summary?.totalPnl ?? 0,
      tradesCount: summary?.tradesCount ?? 0,
      winsCount: summary?.winsCount ?? 0,
      lossesCount: summary?.lossesCount ?? 0,
      trades: summary?.trades ?? [],
    });
  }

  // Days of current month
  const totalDaysCurrentMonth = lastDayOfMonth.getDate();
  for (let dayNum = 1; dayNum <= totalDaysCurrentMonth; dayNum++) {
    const m = String(monthIndex + 1).padStart(2, "0");
    const dStr = String(dayNum).padStart(2, "0");
    const dateStr = `${year}-${m}-${dStr}`;

    const summary = dailyPnlMap.get(dateStr);
    days.push({
      dateStr,
      dayNumber: dayNum,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      totalPnl: summary?.totalPnl ?? 0,
      tradesCount: summary?.tradesCount ?? 0,
      winsCount: summary?.winsCount ?? 0,
      lossesCount: summary?.lossesCount ?? 0,
      trades: summary?.trades ?? [],
    });
  }

  // Remaining days to complete the last row (up to multiple of 7)
  const remaining = (7 - (days.length % 7)) % 7;
  for (let dayNum = 1; dayNum <= remaining; dayNum++) {
    const nextMonthDate = new Date(year, monthIndex + 1, dayNum);
    const y = nextMonthDate.getFullYear();
    const m = String(nextMonthDate.getMonth() + 1).padStart(2, "0");
    const dStr = String(dayNum).padStart(2, "0");
    const dateStr = `${y}-${m}-${dStr}`;

    const summary = dailyPnlMap.get(dateStr);
    days.push({
      dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      totalPnl: summary?.totalPnl ?? 0,
      tradesCount: summary?.tradesCount ?? 0,
      winsCount: summary?.winsCount ?? 0,
      lossesCount: summary?.lossesCount ?? 0,
      trades: summary?.trades ?? [],
    });
  }

  return days;
}

/**
 * Calculates Day of the Week stats (Monday through Sunday).
 */
export function calculateDayOfWeekStats(trades: Trade[]): {
  days: DayOfWeekStat[];
  bestDay: DayOfWeekStat | null;
  worstDay: DayOfWeekStat | null;
} {
  const dayNames = [
    { name: "Monday", short: "Mon", index: 1 },
    { name: "Tuesday", short: "Tue", index: 2 },
    { name: "Wednesday", short: "Wed", index: 3 },
    { name: "Thursday", short: "Thu", index: 4 },
    { name: "Friday", short: "Fri", index: 5 },
    { name: "Saturday", short: "Sat", index: 6 },
    { name: "Sunday", short: "Sun", index: 0 },
  ];

  const statsMap = new Map<number, { pnl: number; trades: number; wins: number; losses: number }>();
  for (const d of dayNames) {
    statsMap.set(d.index, { pnl: 0, trades: 0, wins: 0, losses: 0 });
  }

  for (const tr of trades) {
    const d = new Date(tr.date);
    if (isNaN(d.getTime())) continue;
    const dayIdx = d.getDay();
    const cur = statsMap.get(dayIdx);
    if (cur) {
      const tradePnl = pnl(tr);
      cur.pnl += tradePnl;
      cur.trades += 1;
      if (tradePnl > 0) cur.wins += 1;
      else if (tradePnl < 0) cur.losses += 1;
    }
  }

  const days: DayOfWeekStat[] = dayNames.map((d) => {
    const val = statsMap.get(d.index)!;
    const winRate = val.trades > 0 ? (val.wins / val.trades) * 100 : 0;
    return {
      dayName: d.name,
      dayShort: d.short,
      dayIndex: d.index,
      pnl: Math.round(val.pnl * 100) / 100,
      trades: val.trades,
      wins: val.wins,
      losses: val.losses,
      winRate: Math.round(winRate * 10) / 10,
    };
  });

  const tradedDays = days.filter((d) => d.trades > 0);
  let bestDay: DayOfWeekStat | null = null;
  let worstDay: DayOfWeekStat | null = null;

  if (tradedDays.length > 0) {
    bestDay = [...tradedDays].sort((a, b) => b.pnl - a.pnl)[0] ?? null;
    worstDay = [...tradedDays].sort((a, b) => a.pnl - b.pnl)[0] ?? null;
  }

  return { days, bestDay, worstDay };
}

/**
 * Calculates Symbol/Pair Profitability (Best vs Worst pair).
 */
export function calculateSymbolProfitability(trades: Trade[]): {
  symbols: SymbolProfitStat[];
  mostProfitable: SymbolProfitStat | null;
  biggestLoss: SymbolProfitStat | null;
} {
  const map = new Map<
    string,
    { pnl: number; trades: number; wins: number; losses: number }
  >();

  for (const tr of trades) {
    const sym = tr.symbol.trim().toUpperCase();
    const cur = map.get(sym) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
    const tradePnl = pnl(tr);
    cur.pnl += tradePnl;
    cur.trades += 1;
    if (tradePnl > 0) cur.wins += 1;
    else if (tradePnl < 0) cur.losses += 1;
    map.set(sym, cur);
  }

  const symbols: SymbolProfitStat[] = [...map.entries()].map(([symbol, stat]) => {
    const winRate = stat.trades > 0 ? (stat.wins / stat.trades) * 100 : 0;
    const avgPnl = stat.trades > 0 ? stat.pnl / stat.trades : 0;
    return {
      symbol,
      pnl: Math.round(stat.pnl * 100) / 100,
      trades: stat.trades,
      wins: stat.wins,
      losses: stat.losses,
      winRate: Math.round(winRate * 10) / 10,
      avgPnl: Math.round(avgPnl * 100) / 100,
    };
  });

  symbols.sort((a, b) => b.pnl - a.pnl);

  const mostProfitable = symbols.length > 0 && symbols[0]!.pnl > 0 ? symbols[0]! : null;
  const losingSymbols = [...symbols].filter((s) => s.pnl < 0);
  const biggestLoss = losingSymbols.length > 0 ? losingSymbols[losingSymbols.length - 1]! : null;

  return { symbols, mostProfitable, biggestLoss };
}

/**
 * Calculates Time of Day and Market Session stats.
 */
export function calculateTimeSessionStats(trades: Trade[]): {
  sessions: TimeSessionStat[];
  hourly: HourlyStat[];
  bestSession: TimeSessionStat | null;
  worstSession: TimeSessionStat | null;
  bestHour: HourlyStat | null;
  worstHour: HourlyStat | null;
} {
  const SESSIONS_CONFIG = [
    { id: "asia", name: "Asian / Pre-Market", hours: "00:00 - 08:00 UTC", icon: "🌏", minH: 0, maxH: 7 },
    { id: "london", name: "London Session / Open", hours: "08:00 - 13:00 UTC", icon: "🇬🇧", minH: 8, maxH: 12 },
    { id: "ny_peak", name: "New York Session / US Peak", hours: "13:00 - 19:00 UTC", icon: "🗽", minH: 13, maxH: 18 },
    { id: "evening", name: "Evening / Post-Market", hours: "19:00 - 24:00 UTC", icon: "🌙", minH: 19, maxH: 23 },
  ];

  const sessionMap = new Map<string, { pnl: number; trades: number; wins: number; losses: number }>();
  for (const s of SESSIONS_CONFIG) {
    sessionMap.set(s.id, { pnl: 0, trades: 0, wins: 0, losses: 0 });
  }

  const hourMap = new Map<number, { pnl: number; trades: number }>();
  for (let h = 0; h < 24; h++) {
    hourMap.set(h, { pnl: 0, trades: 0 });
  }

  for (const tr of trades) {
    const d = new Date(tr.date);
    if (isNaN(d.getTime())) continue;
    const hour = d.getUTCHours();
    const tradePnl = pnl(tr);

    // Hourly
    const curH = hourMap.get(hour);
    if (curH) {
      curH.pnl += tradePnl;
      curH.trades += 1;
    }

    // Session
    const matchedSession = SESSIONS_CONFIG.find((s) => hour >= s.minH && hour <= s.maxH) || SESSIONS_CONFIG[0]!;
    const curS = sessionMap.get(matchedSession.id);
    if (curS) {
      curS.pnl += tradePnl;
      curS.trades += 1;
      if (tradePnl > 0) curS.wins += 1;
      else if (tradePnl < 0) curS.losses += 1;
    }
  }

  const sessions: TimeSessionStat[] = SESSIONS_CONFIG.map((s) => {
    const val = sessionMap.get(s.id)!;
    const winRate = val.trades > 0 ? (val.wins / val.trades) * 100 : 0;
    return {
      id: s.id,
      name: s.name,
      hours: s.hours,
      icon: s.icon,
      pnl: Math.round(val.pnl * 100) / 100,
      trades: val.trades,
      wins: val.wins,
      losses: val.losses,
      winRate: Math.round(winRate * 10) / 10,
    };
  });

  const hourly: HourlyStat[] = Array.from({ length: 24 }, (_, h) => {
    const val = hourMap.get(h)!;
    return {
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      pnl: Math.round(val.pnl * 100) / 100,
      trades: val.trades,
    };
  });

  const activeSessions = sessions.filter((s) => s.trades > 0);
  const bestSession = activeSessions.length > 0 ? [...activeSessions].sort((a, b) => b.pnl - a.pnl)[0] ?? null : null;
  const worstSession = activeSessions.length > 0 ? [...activeSessions].sort((a, b) => a.pnl - b.pnl)[0] ?? null : null;

  const activeHours = hourly.filter((h) => h.trades > 0);
  const bestHour = activeHours.length > 0 ? [...activeHours].sort((a, b) => b.pnl - a.pnl)[0] ?? null : null;
  const worstHour = activeHours.length > 0 ? [...activeHours].sort((a, b) => a.pnl - b.pnl)[0] ?? null : null;

  return { sessions, hourly, bestSession, worstSession, bestHour, worstHour };
}

/**
 * Calculates a detailed Equity Curve with Watermark, Drawdowns, and Range Filters.
 */
export function calculateDetailedEquityCurve(
  trades: Trade[],
  startEquity: number,
  range: "7D" | "30D" | "90D" | "1Y" | "ALL" = "ALL",
): EquityCurveSummary {
  const sorted = sortByDate(trades);

  // Filter by date range if not ALL
  let filtered = sorted;
  if (range !== "ALL" && sorted.length > 0) {
    const now = new Date();
    const daysMap = { "7D": 7, "30D": 30, "90D": 90, "1Y": 365 };
    const cutoff = new Date(now.getTime() - daysMap[range] * 24 * 60 * 60 * 1000);
    filtered = sorted.filter((t) => new Date(t.date) >= cutoff);
    if (filtered.length === 0) filtered = sorted.slice(-10); // fallback to recent
  }

  let runningEquity = startEquity;
  let peak = startEquity;
  let maxDrawdownDollars = 0;
  let maxDrawdownPercent = 0;

  const points: EquityCurvePoint[] = [];

  // Initial baseline point
  const firstTradeDate = filtered[0]?.date ? new Date(filtered[0].date) : new Date();
  const baselineDateStr = new Date(firstTradeDate.getTime() - 60000);
  points.push({
    date: baselineDateStr.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: baselineDateStr.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    rawDate: baselineDateStr.toISOString(),
    equity: Math.round(startEquity * 100) / 100,
    peak: Math.round(startEquity * 100) / 100,
    drawdownDollars: 0,
    drawdownPercent: 0,
    tradePnl: 0,
    cumulativePnl: 0,
    symbol: "Starting Balance",
  });

  for (const tr of filtered) {
    const tradePnl = pnl(tr);
    runningEquity += tradePnl;
    if (runningEquity > peak) {
      peak = runningEquity;
    }
    const ddDollars = peak - runningEquity;
    const ddPercent = peak > 0 ? (ddDollars / peak) * 100 : 0;

    if (ddDollars > maxDrawdownDollars) maxDrawdownDollars = ddDollars;
    if (ddPercent > maxDrawdownPercent) maxDrawdownPercent = ddPercent;

    const trDate = new Date(tr.date);
    points.push({
      date: trDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      time: trDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      rawDate: tr.date,
      equity: Math.round(runningEquity * 100) / 100,
      peak: Math.round(peak * 100) / 100,
      drawdownDollars: Math.round(ddDollars * 100) / 100,
      drawdownPercent: Math.round(ddPercent * 10) / 10,
      tradePnl: Math.round(tradePnl * 100) / 100,
      cumulativePnl: Math.round((runningEquity - startEquity) * 100) / 100,
      symbol: tr.symbol,
    });
  }

  const currentEquity = points[points.length - 1]?.equity ?? startEquity;
  const netPnl = currentEquity - startEquity;
  const roiPercent = startEquity > 0 ? (netPnl / startEquity) * 100 : 0;

  return {
    points,
    startEquity: Math.round(startEquity * 100) / 100,
    currentEquity: Math.round(currentEquity * 100) / 100,
    peakEquity: Math.round(peak * 100) / 100,
    netPnl: Math.round(netPnl * 100) / 100,
    roiPercent: Math.round(roiPercent * 10) / 10,
    maxDrawdownDollars: Math.round(maxDrawdownDollars * 100) / 100,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 10) / 10,
  };
}

