import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Clock,
  Sparkles,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  buildMonthCalendarGrid,
  getDailyTradeSummaries,
  type CalendarDay,
  type DayTradeSummary,
} from "@/lib/analytics-helpers";
import {
  dualMoney,
  dualSignedMoney,
  formatCurrency,
  pnl,
  signedCurrency,
  type Trade,
} from "@/lib/trades";
import { cn } from "@/lib/utils";

interface TradingCalendarProps {
  trades: Trade[];
  currency?: string;
  accountName?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TradingCalendar({
  trades,
  currency = "$",
  accountName = "All Accounts",
}: TradingCalendarProps) {
  // Determine initial year and month from the latest trade (or today)
  const initialDate = useMemo(() => {
    if (trades.length > 0) {
      const dates = trades
        .map((t) => new Date(t.date).getTime())
        .filter((n) => !isNaN(n));
      if (dates.length > 0) {
        return new Date(Math.max(...dates));
      }
    }
    return new Date();
  }, [trades]);

  const [currentYear, setCurrentYear] = useState(() => initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => initialDate.getMonth());
  const [selectedDayTrades, setSelectedDayTrades] = useState<DayTradeSummary | null>(null);

  // Group trades by date YYYY-MM-DD
  const dailyPnlMap = useMemo(() => getDailyTradeSummaries(trades), [trades]);

  // Build calendar grid
  const calendarDays = useMemo(
    () => buildMonthCalendarGrid(currentYear, currentMonth, dailyPnlMap),
    [currentYear, currentMonth, dailyPnlMap],
  );

  // Calculate monthly stats for the active calendar month
  const monthStats = useMemo(() => {
    let monthPnl = 0;
    let winDays = 0;
    let lossDays = 0;
    let totalMonthTrades = 0;
    let bestDayPnl = -Infinity;
    let worstDayPnl = Infinity;

    for (const d of calendarDays) {
      if (d.isCurrentMonth && d.tradesCount > 0) {
        monthPnl += d.totalPnl;
        totalMonthTrades += d.tradesCount;
        if (d.totalPnl > 0) {
          winDays++;
          if (d.totalPnl > bestDayPnl) bestDayPnl = d.totalPnl;
        } else if (d.totalPnl < 0) {
          lossDays++;
          if (d.totalPnl < worstDayPnl) worstDayPnl = d.totalPnl;
        }
      }
    }

    const totalActiveDays = winDays + lossDays;
    const dayWinRate = totalActiveDays > 0 ? (winDays / totalActiveDays) * 100 : 0;

    return {
      monthPnl,
      winDays,
      lossDays,
      totalMonthTrades,
      dayWinRate: Math.round(dayWinRate * 10) / 10,
      bestDayPnl: bestDayPnl !== -Infinity ? bestDayPnl : 0,
      worstDayPnl: worstDayPnl !== Infinity ? worstDayPnl : 0,
    };
  }, [calendarDays]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToLatest = () => {
    setCurrentYear(initialDate.getFullYear());
    setCurrentMonth(initialDate.getMonth());
  };

  return (
    <Card className="p-4 sm:p-6 shadow-md border-border/80">
      {/* ── CALENDAR TOP BAR: MONTH NAVIGATION & QUICK STATS ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-5 text-primary" />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              P&L Trading Calendar
            </h2>
            <Badge variant="outline" className="text-xs font-medium">
              {accountName}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Daily profit and loss in dollars. Click any active trading day to view trade executions.
          </p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevMonth}
            className="size-8"
            title="Previous Month"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <span className="font-bold text-sm sm:text-base min-w-[140px] text-center">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNextMonth}
            className="size-8"
            title="Next Month"
          >
            <ChevronRight className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleJumpToLatest}
            className="h-8 text-xs font-semibold text-primary"
          >
            Active Month
          </Button>
        </div>
      </div>

      {/* ── MONTHLY EXECUTIVE SUMMARY BANNER ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 py-3 px-4 rounded-xl bg-surface-2/60 border border-border/60">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Month Realized P&L
          </p>
          <p
            className={cn(
              "text-base sm:text-lg font-bold tabular mt-0.5",
              monthStats.monthPnl >= 0 ? "text-profit" : "text-loss",
            )}
          >
            {dualSignedMoney(monthStats.monthPnl, currency)}
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Day Win Rate
          </p>
          <p className="text-base sm:text-lg font-bold tabular mt-0.5 text-foreground">
            {monthStats.dayWinRate}%{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({monthStats.winDays}W / {monthStats.lossDays}L)
            </span>
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Best Trading Day
          </p>
          <p className="text-base sm:text-lg font-bold tabular mt-0.5 text-profit">
            {monthStats.bestDayPnl > 0
              ? dualSignedMoney(monthStats.bestDayPnl, currency)
              : "—"}
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Worst Trading Day
          </p>
          <p className="text-base sm:text-lg font-bold tabular mt-0.5 text-loss">
            {monthStats.worstDayPnl < 0
              ? dualSignedMoney(monthStats.worstDayPnl, currency)
              : "—"}
          </p>
        </div>
      </div>

      {/* ── 7-COLUMN CALENDAR GRID ── */}
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
            {WEEKDAY_NAMES.map((name, i) => (
              <div
                key={name}
                className={cn(
                  "py-1.5 text-xs font-bold tracking-wider uppercase rounded-md",
                  i >= 5 ? "text-muted-foreground/70" : "text-muted-foreground",
                )}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Calendar Days Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((day, idx) => {
              const hasTrades = day.tradesCount > 0;
              const isProfit = day.totalPnl > 0;
              const isLoss = day.totalPnl < 0;

              return (
                <div
                  key={`${day.dateStr}_${idx}`}
                  onClick={() => {
                    if (hasTrades) {
                      const summary = dailyPnlMap.get(day.dateStr);
                      if (summary) setSelectedDayTrades(summary);
                    }
                  }}
                  className={cn(
                    "min-h-[82px] sm:min-h-[92px] p-2 rounded-xl border transition-all flex flex-col justify-between relative group select-none",
                    !day.isCurrentMonth && "opacity-35 bg-surface-2/20 border-border/30",
                    day.isCurrentMonth && !hasTrades && "bg-surface/40 border-border/60 hover:bg-surface/70",
                    hasTrades &&
                      isProfit &&
                      "bg-profit/10 border-profit/35 hover:bg-profit/20 hover:border-profit/60 cursor-pointer shadow-xs",
                    hasTrades &&
                      isLoss &&
                      "bg-loss/10 border-loss/35 hover:bg-loss/20 hover:border-loss/60 cursor-pointer shadow-xs",
                    hasTrades &&
                      !isProfit &&
                      !isLoss &&
                      "bg-surface-2 border-border/80 hover:bg-surface-3 cursor-pointer",
                    day.isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                  )}
                >
                  {/* Top row: Day Number + Today indicator */}
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={cn(
                        "font-semibold text-xs size-6 grid place-items-center rounded-full",
                        day.isToday
                          ? "bg-primary text-primary-foreground font-bold"
                          : day.isCurrentMonth
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {day.dayNumber}
                    </span>

                    {hasTrades && (
                      <span className="text-[10px] font-medium text-muted-foreground opacity-80 group-hover:opacity-100">
                        {day.tradesCount} {day.tradesCount === 1 ? "trade" : "trades"}
                      </span>
                    )}
                  </div>

                  {/* Middle / Bottom row: Profit / Loss in Dollars */}
                  {hasTrades ? (
                    <div className="mt-1">
                      <p
                        className={cn(
                          "text-xs sm:text-sm font-extrabold tabular tracking-tight leading-tight",
                          isProfit ? "text-profit" : isLoss ? "text-loss" : "text-foreground",
                        )}
                      >
                        {signedCurrency(day.totalPnl, currency)}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="text-profit font-semibold">{day.winsCount}W</span>
                        <span>/</span>
                        <span className="text-loss font-semibold">{day.lossesCount}L</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-6" />
                  )}

                  {/* Hover Inspect icon on active days */}
                  {hasTrades && (
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="size-3 text-muted-foreground hover:text-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── DAY TRADES INSPECTOR DIALOG ── */}
      <Dialog
        open={Boolean(selectedDayTrades)}
        onOpenChange={(open) => !open && setSelectedDayTrades(null)}
      >
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 text-base sm:text-lg">
              <div className="flex items-center gap-2">
                <CalendarIcon className="size-5 text-primary" />
                <span>
                  Trades on {selectedDayTrades?.date ? new Date(selectedDayTrades.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : ""}
                </span>
              </div>
              {selectedDayTrades && (
                <Badge
                  variant={selectedDayTrades.totalPnl >= 0 ? "default" : "destructive"}
                  className="tabular font-bold text-xs"
                >
                  {dualSignedMoney(selectedDayTrades.totalPnl, currency)}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedDayTrades?.tradesCount} execution{selectedDayTrades?.tradesCount === 1 ? "" : "s"} logged on this day
            </DialogDescription>
          </DialogHeader>

          {selectedDayTrades && (
            <div className="space-y-3 mt-3">
              {selectedDayTrades.trades.map((t, idx) => {
                const tradeProfit = pnl(t);
                const isWin = tradeProfit > 0;
                return (
                  <div
                    key={t.id || idx}
                    className="p-3.5 rounded-xl border border-border bg-surface/50 hover:bg-surface transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {t.symbol}
                        </span>
                        <Badge
                          variant={t.direction === "BUY" ? "default" : "secondary"}
                          className="text-[10px] uppercase font-bold px-1.5 py-0"
                        >
                          {t.direction}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {t.tradeType}
                        </span>
                      </div>

                      <span
                        className={cn(
                          "tabular font-bold text-sm",
                          isWin ? "text-profit" : tradeProfit < 0 ? "text-loss" : "text-muted-foreground",
                        )}
                      >
                        {signedCurrency(tradeProfit, currency)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40">
                      <div>
                        <span className="opacity-70 text-[10px] uppercase">Entry:</span>{" "}
                        <span className="font-semibold text-foreground">${t.entry}</span>
                      </div>
                      <div>
                        <span className="opacity-70 text-[10px] uppercase">Exit:</span>{" "}
                        <span className="font-semibold text-foreground">${t.exit}</span>
                      </div>
                      <div>
                        <span className="opacity-70 text-[10px] uppercase">Qty:</span>{" "}
                        <span className="font-semibold text-foreground">{t.quantity}</span>
                      </div>
                      <div>
                        <span className="opacity-70 text-[10px] uppercase">Emotion:</span>{" "}
                        <span className="font-semibold text-foreground">{t.emotion}</span>
                      </div>
                    </div>

                    {t.notes && (
                      <p className="text-xs text-muted-foreground bg-surface-2/60 p-2 rounded-lg italic">
                        "{t.notes}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

