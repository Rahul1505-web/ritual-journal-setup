import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles,
  Bot,
  Calendar as CalendarIcon,
  Clock,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  AlertTriangle,
  Award,
  RefreshCw,
  Loader2,
  ChevronRight,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  calculateDayOfWeekStats,
  calculateSymbolProfitability,
  calculateTimeSessionStats,
} from "@/lib/analytics-helpers";
import { askCoach } from "@/lib/coach.functions";
import { dualSignedMoney, signedCurrency, type Rule, type Trade } from "@/lib/trades";
import { cn } from "@/lib/utils";

interface AnalyticsDeepDiveProps {
  trades: Trade[];
  currency?: string;
  accountName?: string;
  rules?: Rule[];
}

export function AnalyticsDeepDive({
  trades,
  currency = "$",
  accountName = "All Accounts",
  rules = [],
}: AnalyticsDeepDiveProps) {
  const callCoach = useServerFn(askCoach);

  // AI Audit State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // 1. Day of Week Stats
  const dayOfWeekStats = useMemo(() => calculateDayOfWeekStats(trades), [trades]);

  // 2. Symbol Profitability (Best vs Worst pair)
  const symbolStats = useMemo(() => calculateSymbolProfitability(trades), [trades]);

  // 3. Time of Day & Session Stats
  const timeSessionStats = useMemo(() => calculateTimeSessionStats(trades), [trades]);

  // Run AI Pattern Analysis
  const handleRunAiAudit = async () => {
    if (trades.length === 0) {
      toast.info("Log some trades first so AI can discover your behavioral patterns.");
      return;
    }

    setAiLoading(true);

    try {
      const bestD = dayOfWeekStats.bestDay
        ? `${dayOfWeekStats.bestDay.dayName} (P&L: $${dayOfWeekStats.bestDay.pnl}, Win Rate: ${dayOfWeekStats.bestDay.winRate}%, Trades: ${dayOfWeekStats.bestDay.trades})`
        : "None";
      const worstD = dayOfWeekStats.worstDay
        ? `${dayOfWeekStats.worstDay.dayName} (P&L: $${dayOfWeekStats.worstDay.pnl}, Win Rate: ${dayOfWeekStats.worstDay.winRate}%, Trades: ${dayOfWeekStats.worstDay.trades})`
        : "None";

      const bestSym = symbolStats.mostProfitable
        ? `${symbolStats.mostProfitable.symbol} (P&L: $${symbolStats.mostProfitable.pnl}, Win Rate: ${symbolStats.mostProfitable.winRate}%, Trades: ${symbolStats.mostProfitable.trades})`
        : "None";
      const worstSym = symbolStats.biggestLoss
        ? `${symbolStats.biggestLoss.symbol} (P&L: $${symbolStats.biggestLoss.pnl}, Win Rate: ${symbolStats.biggestLoss.winRate}%, Trades: ${symbolStats.biggestLoss.trades})`
        : "None";

      const bestSess = timeSessionStats.bestSession
        ? `${timeSessionStats.bestSession.name} [${timeSessionStats.bestSession.hours}] (P&L: $${timeSessionStats.bestSession.pnl}, Win Rate: ${timeSessionStats.bestSession.winRate}%)`
        : "None";
      const worstSess = timeSessionStats.worstSession
        ? `${timeSessionStats.worstSession.name} [${timeSessionStats.worstSession.hours}] (P&L: $${timeSessionStats.worstSession.pnl}, Win Rate: ${timeSessionStats.worstSession.winRate}%)`
        : "None";

      const question = [
        `ADVANCED BEHAVIORAL & STATISTICAL AUDIT REQUEST FOR: ${accountName}`,
        `Please conduct an executive, blunt, and deeply psychological trading audit based on my exact numbers:`,
        ``,
        `1. DAY OF WEEK PATTERNS:`,
        `- Most Profitable Day: ${bestD}`,
        `- Worst / Biggest Leak Day: ${worstD}`,
        `- All Days Breakdown: ${dayOfWeekStats.days.map((d) => `${d.dayShort}: $${d.pnl} (${d.winRate}% WR, ${d.trades} trades)`).join(" | ")}`,
        ``,
        `2. ASSET & PAIR SELECTION:`,
        `- Most Profitable Pair: ${bestSym}`,
        `- Biggest Money Drain Pair: ${worstSym}`,
        `- Top Traded Assets: ${symbolStats.symbols.slice(0, 5).map((s) => `${s.symbol}: $${s.pnl} (${s.winRate}% WR)`).join(", ")}`,
        ``,
        `3. TIME OF DAY & MARKET SESSIONS:`,
        `- Peak Profit Time Window: ${bestSess}`,
        `- Most Dangerous / Loss Hours: ${worstSess}`,
        `- All Sessions: ${timeSessionStats.sessions.map((s) => `${s.name}: $${s.pnl} (${s.winRate}% WR)`).join(" | ")}`,
        ``,
        `AUDIT INSTRUCTIONS:`,
        `1. Identify why my best day works and why my worst day leaks capital (fatigue, overtrading, or lack of setups).`,
        `2. Give me a blunt verdict on my pair selection: should I cut the losing pair completely?`,
        `3. Analyze my trading hours: when should I aggressively trade and when should I strictly shut down the screens?`,
        `4. Give me 1 actionable golden rule to implement immediately.`,
        ``,
        `LANGUAGE: Natural, friendly, authoritative Hinglish or English matching the trader's persona.`,
      ].join("\n");

      const response = await callCoach({
        data: {
          question,
          tradeSummary: `Active Rules: ${rules.map((r) => r.text).join(" | ") || "Follow risk management"}\nTotal Trades Analyzed: ${trades.length}`,
          history: [],
        },
      });

      setAiReport(response.text);
      toast.success("AI Pattern Audit completed!");
    } catch (err) {
      console.error("AI audit failed:", err);
      toast.error("Could not complete AI audit. Please check your AI API key.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── TOP HIGHLIGHT CARDS: BEST DAY, BEST PAIR, BEST TIME ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Day of Week Highlight */}
        <Card className="p-5 border-border/80 shadow-xs relative overflow-hidden bg-gradient-to-br from-surface via-surface-2/40 to-surface">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CalendarIcon className="size-3.5 text-primary" />
              <span>Day Analysis</span>
            </span>
            <Badge variant="outline" className="text-[10px] font-bold">
              Weekly Rhythm
            </Badge>
          </div>

          <div className="mt-3 space-y-2">
            {dayOfWeekStats.bestDay && dayOfWeekStats.bestDay.pnl > 0 ? (
              <div className="p-2.5 rounded-lg bg-profit/10 border border-profit/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-profit flex items-center gap-1">
                    <Award className="size-3.5" />
                    <span>Best Day: {dayOfWeekStats.bestDay.dayName}</span>
                  </span>
                  <span className="font-bold tabular text-profit">
                    {signedCurrency(dayOfWeekStats.bestDay.pnl, currency)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {dayOfWeekStats.bestDay.winRate}% win rate across {dayOfWeekStats.bestDay.trades} trades
                </p>
              </div>
            ) : null}

            {dayOfWeekStats.worstDay && dayOfWeekStats.worstDay.pnl < 0 ? (
              <div className="p-2.5 rounded-lg bg-loss/10 border border-loss/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-loss flex items-center gap-1">
                    <AlertTriangle className="size-3.5" />
                    <span>Worst Day: {dayOfWeekStats.worstDay.dayName}</span>
                  </span>
                  <span className="font-bold tabular text-loss">
                    {signedCurrency(dayOfWeekStats.worstDay.pnl, currency)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {dayOfWeekStats.worstDay.winRate}% win rate across {dayOfWeekStats.worstDay.trades} trades
                </p>
              </div>
            ) : null}
          </div>
        </Card>

        {/* 2. Pair / Symbol Highlight */}
        <Card className="p-5 border-border/80 shadow-xs relative overflow-hidden bg-gradient-to-br from-surface via-surface-2/40 to-surface">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              <span>Asset Profitability</span>
            </span>
            <Badge variant="outline" className="text-[10px] font-bold">
              Pair Alpha
            </Badge>
          </div>

          <div className="mt-3 space-y-2">
            {symbolStats.mostProfitable ? (
              <div className="p-2.5 rounded-lg bg-profit/10 border border-profit/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-profit flex items-center gap-1">
                    <Award className="size-3.5" />
                    <span>Top Pair: {symbolStats.mostProfitable.symbol}</span>
                  </span>
                  <span className="font-bold tabular text-profit">
                    {signedCurrency(symbolStats.mostProfitable.pnl, currency)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {symbolStats.mostProfitable.winRate}% win rate across {symbolStats.mostProfitable.trades} trades
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Log more trades to identify winning pairs.</p>
            )}

            {symbolStats.biggestLoss ? (
              <div className="p-2.5 rounded-lg bg-loss/10 border border-loss/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-loss flex items-center gap-1">
                    <AlertTriangle className="size-3.5" />
                    <span>Biggest Leak: {symbolStats.biggestLoss.symbol}</span>
                  </span>
                  <span className="font-bold tabular text-loss">
                    {signedCurrency(symbolStats.biggestLoss.pnl, currency)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {symbolStats.biggestLoss.winRate}% win rate across {symbolStats.biggestLoss.trades} trades
                </p>
              </div>
            ) : null}
          </div>
        </Card>

        {/* 3. Trading Hours / Session Highlight */}
        <Card className="p-5 border-border/80 shadow-xs relative overflow-hidden bg-gradient-to-br from-surface via-surface-2/40 to-surface">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" />
              <span>Time of Day</span>
            </span>
            <Badge variant="outline" className="text-[10px] font-bold">
              Session Edge
            </Badge>
          </div>

          <div className="mt-3 space-y-2">
            {timeSessionStats.bestSession && timeSessionStats.bestSession.pnl > 0 ? (
              <div className="p-2.5 rounded-lg bg-profit/10 border border-profit/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-profit flex items-center gap-1">
                    <span>{timeSessionStats.bestSession.icon}</span>
                    <span>Best: {timeSessionStats.bestSession.name}</span>
                  </span>
                  <span className="font-bold tabular text-profit">
                    {signedCurrency(timeSessionStats.bestSession.pnl, currency)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {timeSessionStats.bestSession.hours} ({timeSessionStats.bestSession.winRate}% win)
                </p>
              </div>
            ) : null}

            {timeSessionStats.worstSession && timeSessionStats.worstSession.pnl < 0 ? (
              <div className="p-2.5 rounded-lg bg-loss/10 border border-loss/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-loss flex items-center gap-1">
                    <span>{timeSessionStats.worstSession.icon}</span>
                    <span>Leak: {timeSessionStats.worstSession.name}</span>
                  </span>
                  <span className="font-bold tabular text-loss">
                    {signedCurrency(timeSessionStats.worstSession.pnl, currency)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {timeSessionStats.worstSession.hours} ({timeSessionStats.worstSession.winRate}% win)
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {/* ── DETAILED BREAKDOWN PANELS: DAY OF WEEK & SESSION MATRIX ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day of the Week Detail Cards */}
        <Card className="p-6 border-border/80 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Day-of-the-Week P&L & Win Rate
              </h3>
              <p className="text-xs text-muted-foreground">
                Which days yield profits vs which days leak capital
              </p>
            </div>
            <CalendarIcon className="size-4 text-primary" />
          </div>

          <div className="space-y-2.5">
            {dayOfWeekStats.days.map((d) => {
              const isProfit = d.pnl > 0;
              const isLoss = d.pnl < 0;
              return (
                <div
                  key={d.dayName}
                  className={cn(
                    "p-3 rounded-xl border flex items-center justify-between transition-colors",
                    d.trades === 0
                      ? "bg-surface/30 border-border/40 opacity-50"
                      : isProfit
                      ? "bg-profit/5 border-profit/25 hover:bg-profit/10"
                      : isLoss
                      ? "bg-loss/5 border-loss/25 hover:bg-loss/10"
                      : "bg-surface-2/40 border-border/60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xs size-7 grid place-items-center rounded-lg bg-surface-2 text-foreground">
                      {d.dayShort}
                    </span>
                    <div>
                      <p className="font-semibold text-xs text-foreground">{d.dayName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {d.trades} {d.trades === 1 ? "trade" : "trades"}{" "}
                        {d.trades > 0 && `· ${d.winRate}% win (${d.wins}W / ${d.losses}L)`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={cn(
                        "text-xs sm:text-sm font-bold tabular",
                        isProfit ? "text-profit" : isLoss ? "text-loss" : "text-muted-foreground",
                      )}
                    >
                      {d.trades > 0 ? signedCurrency(d.pnl, currency) : "No trades"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Market Sessions & Time Window Performance */}
        <Card className="p-6 border-border/80 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Market Session & Trading Hours
              </h3>
              <p className="text-xs text-muted-foreground">
                Performance grouped by standard global market windows (UTC)
              </p>
            </div>
            <Clock className="size-4 text-primary" />
          </div>

          <div className="space-y-3">
            {timeSessionStats.sessions.map((sess) => {
              const isProfit = sess.pnl > 0;
              const isLoss = sess.pnl < 0;
              return (
                <div
                  key={sess.id}
                  className={cn(
                    "p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors",
                    sess.trades === 0
                      ? "bg-surface/30 border-border/40 opacity-50"
                      : isProfit
                      ? "bg-profit/5 border-profit/25 hover:bg-profit/10"
                      : isLoss
                      ? "bg-loss/5 border-loss/25 hover:bg-loss/10"
                      : "bg-surface-2/40 border-border/60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg size-8 grid place-items-center rounded-lg bg-surface-2 shrink-0">
                      {sess.icon}
                    </span>
                    <div>
                      <p className="font-bold text-xs text-foreground">{sess.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {sess.hours} · {sess.trades} {sess.trades === 1 ? "trade" : "trades"}
                        {sess.trades > 0 && ` (${sess.winRate}% win)`}
                      </p>
                    </div>
                  </div>

                  <div className="self-end sm:self-auto text-right">
                    <p
                      className={cn(
                        "text-xs sm:text-sm font-bold tabular",
                        isProfit ? "text-profit" : isLoss ? "text-loss" : "text-muted-foreground",
                      )}
                    >
                      {sess.trades > 0 ? signedCurrency(sess.pnl, currency) : "No trades"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── AI DEEP PATTERN & EDGE AUDIT CARD ── */}
      <Card className="p-6 border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-surface to-indigo-500/10 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-500/20 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-md">
              <Bot className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground text-base sm:text-lg">
                  AI Behavioral Edge & Leak Audit
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Gemini Deep AI
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI analyzes your best day vs worst day, winning vs losing pairs, and time-of-day execution leaks.
              </p>
            </div>
          </div>

          <Button
            onClick={handleRunAiAudit}
            disabled={aiLoading}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md self-start sm:self-auto"
          >
            {aiLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>{aiReport ? "Re-Run AI Audit" : "Generate AI Edge Audit"}</span>
          </Button>
        </div>

        {/* AI Report Content */}
        {aiLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="size-8 animate-spin text-indigo-500" />
            <p className="text-xs font-medium text-foreground">
              Analyzing daily win rates, symbol performance, and time-of-day tendencies...
            </p>
            <p className="text-[11px] text-muted-foreground">
              Discovering where your true edge lies and where emotions cost you money.
            </p>
          </div>
        ) : aiReport ? (
          <div className="mt-5 space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed whitespace-pre-wrap bg-surface-2/40 p-4 sm:p-5 rounded-2xl border border-indigo-500/20 text-foreground/90">
              {aiReport}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <span className="italic flex items-center gap-1">
                <Info className="size-3 text-indigo-400" />
                <span>Mentorship customized for {accountName} based on your actual executions</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAiReport(null)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Hide Audit
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 p-5 rounded-xl border border-dashed border-border text-center bg-surface/30">
            <Sparkles className="size-6 text-indigo-400 mx-auto mb-2 opacity-80" />
            <p className="text-xs font-semibold text-foreground">
              Ready to discover your trading rhythm?
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-md mx-auto">
              Click "Generate AI Edge Audit" above to have AI examine your day-of-week win rates, best/worst trading pairs, and trading hour discipline.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

