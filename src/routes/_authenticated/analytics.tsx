import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppLayout } from "@/components/app-layout";
import { StatCard, chartTheme } from "@/components/journal-ui";
import { Card } from "@/components/ui/card";
import { useJournal } from "@/lib/journal-store";
import {
  byEmotion,
  byMistake,
  bySymbol,
  monthlyPnl,
  money,
  signedMoney,
  stats,
} from "@/lib/trades";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — TradeLog Pro" },
      {
        name: "description",
        content:
          "Monthly P&L, win/loss split, emotion heatmap and mistake frequency across your trading history.",
      },
      { property: "og:title", content: "Analytics — TradeLog Pro" },
      {
        property: "og:description",
        content: "Monthly P&L, win/loss split, emotion heatmap and mistake frequency.",
      },
    ],
  }),
  component: Analytics,
});

function Analytics() {
  const { trades } = useJournal();
  const s = stats(trades);
  const monthly = monthlyPnl(trades);
  const symbols = bySymbol(trades).slice(0, 6);
  const emotions = byEmotion(trades).filter((e) => e.trades > 0);
  const mistakes = byMistake(trades).filter((m) => m.count > 0);
  const pie = [
    { name: "Wins", value: s.wins, fill: chartTheme.profit },
    { name: "Losses", value: s.losses, fill: chartTheme.loss },
  ];
  const maxEmotion = Math.max(1, ...emotions.map((e) => Math.abs(e.value)));

  return (
    <AppLayout title="Analytics" subtitle="Where your edge comes from — and where it leaks">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Total P&L" value={money(s.total)} tone={s.total >= 0 ? "profit" : "loss"} />
        <StatCard label="Win Rate" value={`${s.winRate.toFixed(1)}%`} hint={`${s.wins}W / ${s.losses}L`} />
        <StatCard label="Avg Win" value={money(s.avgWin)} tone="profit" />
        <StatCard label="Avg Loss" value={money(s.avgLoss)} tone="loss" />
        <StatCard label="Best Trade" value={money(s.best)} tone="profit" />
        <StatCard label="Worst Trade" value={money(s.worst)} tone="loss" />
        <StatCard label="Risk / Reward" value={`1 : ${s.rr.toFixed(2)}`} />
        <StatCard label="Trades Logged" value={String(s.count)} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold">Monthly P&L</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="month" tick={chartTheme.tick} tickLine={false} axisLine={false} />
                <YAxis tick={chartTheme.tick} tickLine={false} axisLine={false} width={64} />
                <Tooltip
                  cursor={{ fill: "color-mix(in oklab, var(--foreground) 6%, transparent)" }}
                  contentStyle={chartTheme.tooltip}
                  formatter={(v) => signedMoney(Number(v))}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {monthly.map((m) => (
                    <Cell key={m.month} fill={m.value >= 0 ? chartTheme.profit : chartTheme.loss} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold">Win / Loss Split</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3}>
                  {pie.map((p) => (
                    <Cell key={p.name} fill={p.fill} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTheme.tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-5 text-xs">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-profit" /> {s.wins} wins
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-loss" /> {s.losses} losses
            </span>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold">Most Traded Symbols</h2>
          <div className="space-y-3">
            {symbols.map((sym) => (
              <div key={sym.symbol} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-semibold">{sym.symbol}</span>
                    <span className="tabular text-xs text-muted-foreground">{sym.trades} trades</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(sym.trades / (symbols[0]?.trades ?? 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    "tabular shrink-0 text-sm font-semibold",
                    sym.value >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {signedMoney(sym.value)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Emotion vs P&L</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Which states of mind actually make you money.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {emotions.map((e) => {
              const intensity = Math.min(0.85, 0.15 + (Math.abs(e.value) / maxEmotion) * 0.7);
              return (
                <div
                  key={e.emotion}
                  className="rounded-xl border border-border p-3"
                  style={{
                    background: `color-mix(in oklab, var(${e.value >= 0 ? "--profit" : "--loss"}) ${Math.round(
                      intensity * 100,
                    )}%, var(--card))`,
                  }}
                >
                  <p className="truncate text-xs font-semibold">{e.emotion}</p>
                  <p className="tabular mt-1 text-sm font-bold">{signedMoney(e.value)}</p>
                  <p className="text-[11px] opacity-80">
                    {e.trades} trades · {e.winRate}% win
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-sm font-semibold">Mistake Frequency</h2>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mistakes} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 24 }}>
              <CartesianGrid stroke={chartTheme.grid} horizontal={false} />
              <XAxis type="number" tick={chartTheme.tick} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="tag"
                tick={chartTheme.tick}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip
                cursor={{ fill: "color-mix(in oklab, var(--foreground) 6%, transparent)" }}
                contentStyle={chartTheme.tooltip}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {mistakes.map((m) => (
                  <Cell
                    key={m.tag}
                    fill={
                      m.tag === "Good Trade" || m.tag === "Followed Rules"
                        ? chartTheme.profit
                        : chartTheme.warning
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </AppLayout>
  );
}
