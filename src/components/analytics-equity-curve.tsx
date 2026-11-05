import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, ArrowDownRight, ArrowUpRight, ShieldAlert, Award } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { chartTheme } from "@/components/journal-ui";
import { calculateDetailedEquityCurve } from "@/lib/analytics-helpers";
import { dualMoney, dualSignedMoney, formatCurrency, signedCurrency, type Trade } from "@/lib/trades";
import { cn } from "@/lib/utils";

interface AnalyticsEquityCurveProps {
  trades: Trade[];
  currency?: string;
  initialBalance?: number;
  accountName?: string;
}

const TIME_RANGES = [
  { id: "7D", label: "7D" },
  { id: "30D", label: "30D" },
  { id: "90D", label: "90D" },
  { id: "1Y", label: "1Y" },
  { id: "ALL", label: "All Time" },
] as const;

type RangeKey = (typeof TIME_RANGES)[number]["id"];

export function AnalyticsEquityCurve({
  trades,
  currency = "$",
  initialBalance = 25000,
  accountName = "All Accounts",
}: AnalyticsEquityCurveProps) {
  const [range, setRange] = useState<RangeKey>("ALL");

  const summary = useMemo(
    () => calculateDetailedEquityCurve(trades, initialBalance, range),
    [trades, initialBalance, range],
  );

  const isNetProfit = summary.netPnl >= 0;

  return (
    <Card className="p-4 sm:p-6 shadow-md border-border/80">
      {/* ── HEADER WITH TIME RANGE BUTTONS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              Enhanced Equity Growth & Drawdown Curve
            </h2>
            <Badge variant="outline" className="text-xs font-medium">
              {accountName}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Realized cumulative portfolio balance, starting baseline, peak watermarks, and risk drawdowns.
          </p>
        </div>

        {/* Range Buttons */}
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-1 self-start sm:self-auto">
          {TIME_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                range === r.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── STATS ROW OVERVIEW ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4 py-3 px-4 rounded-xl bg-surface-2/60 border border-border/60">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Current Equity
          </p>
          <p className="text-base sm:text-lg font-bold tabular mt-0.5 text-foreground">
            {dualMoney(summary.currentEquity, currency)}
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Net Growth (ROI)
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={cn(
                "text-base sm:text-lg font-bold tabular",
                isNetProfit ? "text-profit" : "text-loss",
              )}
            >
              {dualSignedMoney(summary.netPnl, currency)}
            </span>
            <span
              className={cn(
                "text-xs font-semibold px-1.5 py-0.5 rounded",
                isNetProfit ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
              )}
            >
              {summary.roiPercent > 0 ? "+" : ""}
              {summary.roiPercent}%
            </span>
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
            <Award className="size-3 text-amber-500" />
            <span>Peak Watermark</span>
          </p>
          <p className="text-base sm:text-lg font-bold tabular mt-0.5 text-foreground">
            {dualMoney(summary.peakEquity, currency)}
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
            <ShieldAlert className="size-3 text-rose-500" />
            <span>Max Drawdown</span>
          </p>
          <p className="text-base sm:text-lg font-bold tabular mt-0.5 text-loss">
            -{formatCurrency(summary.maxDrawdownDollars, currency)}{" "}
            <span className="text-xs font-normal opacity-80">
              (-{summary.maxDrawdownPercent}%)
            </span>
          </p>
        </div>
      </div>

      {/* ── EQUITY RECHARTS AREA GRAPH ── */}
      <div className="h-[290px] sm:h-[320px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={summary.points}
            margin={{ top: 10, right: 12, bottom: 0, left: -8 }}
          >
            <defs>
              <linearGradient id="equityGradientProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--profit)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--profit)" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="equityGradientLoss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--loss)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--loss)" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={chartTheme.tick}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={chartTheme.tick}
              tickLine={false}
              axisLine={false}
              width={68}
              domain={["auto", "auto"]}
              tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
            />

            {/* Baseline Reference Line at starting equity */}
            <ReferenceLine
              y={summary.startEquity}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{
                value: `Start $${summary.startEquity.toLocaleString()}`,
                position: "insideBottomRight",
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const pt = payload[0]?.payload;
                if (!pt) return null;

                return (
                  <div
                    style={chartTheme.tooltip}
                    className="p-3 rounded-xl border border-border shadow-2xl space-y-1.5 min-w-[210px] text-xs"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5">
                      <span className="font-bold text-foreground">
                        {pt.date} · {pt.time}
                      </span>
                      {pt.symbol && pt.symbol !== "Starting Balance" && (
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {pt.symbol}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Portfolio Balance:</span>
                      <span className="font-extrabold text-foreground tabular">
                        {dualMoney(pt.equity, currency)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Cumulative P&L:</span>
                      <span
                        className={cn(
                          "font-bold tabular",
                          pt.cumulativePnl >= 0 ? "text-profit" : "text-loss",
                        )}
                      >
                        {dualSignedMoney(pt.cumulativePnl, currency)}
                      </span>
                    </div>

                    {pt.tradePnl !== 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Trade Result:</span>
                        <span
                          className={cn(
                            "font-semibold tabular",
                            pt.tradePnl > 0 ? "text-profit" : "text-loss",
                          )}
                        >
                          {signedCurrency(pt.tradePnl, currency)}
                        </span>
                      </div>
                    )}

                    {pt.drawdownDollars > 0 && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-loss font-semibold">
                        <span>Drawdown from Peak:</span>
                        <span className="tabular">
                          -{formatCurrency(pt.drawdownDollars, currency)} (-{pt.drawdownPercent}%)
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="equity"
              stroke={isNetProfit ? "var(--profit)" : "var(--loss)"}
              strokeWidth={2.5}
              fill={isNetProfit ? "url(#equityGradientProfit)" : "url(#equityGradientLoss)"}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

