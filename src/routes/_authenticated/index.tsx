import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Flame, PlusCircle, Percent, Hash } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppLayout } from "@/components/app-layout";
import { PnlCell, StatCard, chartTheme } from "@/components/journal-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useJournal } from "@/lib/journal-store";
import { equityCurve, formatDate, money, pnl, sortByDate, stats } from "@/lib/trades";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TradeLog Pro Trading Journal" },
      {
        name: "description",
        content:
          "Track P&L, win rate and equity growth across every trade in your TradeLog Pro dashboard.",
      },
      { property: "og:title", content: "Dashboard — TradeLog Pro Trading Journal" },
      {
        property: "og:description",
        content: "Track P&L, win rate and equity growth across every trade.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { trades } = useJournal();
  const s = stats(trades);
  const curve = equityCurve(trades);
  const recent = sortByDate(trades).reverse().slice(0, 10);

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Your performance at a glance"
      actions={
        <Button asChild>
          <Link to="/add-trade">
            <PlusCircle className="size-4" />
            <span className="hidden sm:inline">Add Trade</span>
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total P&L"
          value={money(s.total)}
          tone={s.total >= 0 ? "profit" : "loss"}
          icon={s.total >= 0 ? ArrowUpRight : ArrowDownRight}
        />
        <StatCard label="Win Rate" value={`${s.winRate.toFixed(1)}%`} icon={Percent} />
        <StatCard label="Total Trades" value={String(s.count)} icon={Hash} />
        <StatCard
          label="Current Streak"
          value={`${s.streak} ${s.streakWin ? "wins" : "losses"}`}
          tone={s.streakWin ? "profit" : "loss"}
          icon={Flame}
        />
      </div>

      <Card className="mt-4 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Equity Curve</h2>
            <p className="text-xs text-muted-foreground">Portfolio growth over time</p>
          </div>
          <Badge variant="outline" className="shrink-0 tabular">
            {money(curve.at(-1)?.equity ?? 0)}
          </Badge>
        </div>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curve} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartTheme.primary} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={chartTheme.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="date" tick={chartTheme.tick} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={chartTheme.tick} tickLine={false} axisLine={false} width={64} />
              <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => money(Number(v))} />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={chartTheme.primary}
                strokeWidth={2}
                fill="url(#equityFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-semibold">Recent Trades</h2>
          <Link to="/trade-log" className="shrink-0 text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium sm:px-5">Symbol</th>
                <th className="px-4 py-2.5 font-medium">Direction</th>
                <th className="px-4 py-2.5 text-right font-medium">P&L</th>
                <th className="px-4 py-2.5 text-right font-medium sm:px-5">Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id} className="border-t border-border/70 hover:bg-surface-2/60">
                  <td className="px-4 py-3 font-semibold sm:px-5">
                    {t.symbol}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{t.market}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        t.direction === "BUY"
                          ? "border-profit/40 text-profit"
                          : "border-loss/40 text-loss"
                      }
                    >
                      {t.direction}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PnlCell value={pnl(t)} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground sm:px-5">
                    {formatDate(t.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppLayout>
  );
}
