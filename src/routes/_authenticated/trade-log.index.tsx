import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Filter, SearchX, X } from "lucide-react";

import { AppLayout } from "@/components/app-layout";
import { PnlCell } from "@/components/journal-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJournal } from "@/lib/journal-store";
import { MARKETS, TRADE_TYPES, formatDate, pnl, signedMoney } from "@/lib/trades";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trade-log/")({
  head: () => ({
    meta: [
      { title: "Trade Log — TradeLog Pro" },
      {
        name: "description",
        content: "Browse, filter and sort your complete trade history by market, direction and result.",
      },
      { property: "og:title", content: "Trade Log — TradeLog Pro" },
      {
        property: "og:description",
        content: "Browse, filter and sort your complete trade history.",
      },
    ],
  }),
  component: TradeLog,
});

type SortKey = "date" | "pnl" | "symbol";

function TradeLog() {
  const { trades, accounts, activeAccountId } = useJournal();
  const navigate = useNavigate();
  const [selectedAccount, setSelectedAccount] = useState<string>(activeAccountId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [market, setMarket] = useState("all");
  const [direction, setDirection] = useState("all");
  const [tradeType, setTradeType] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [sort, setSort] = useState<SortKey>("date");
  const [asc, setAsc] = useState(false);

  useEffect(() => {
    setSelectedAccount(activeAccountId);
  }, [activeAccountId]);

  const rows = useMemo(() => {
    const defaultAccId = accounts[0]?.id;
    const filtered = trades.filter((t) => {
      if (selectedAccount !== "all") {
        if ((t.accountId ?? defaultAccId) !== selectedAccount) return false;
      }
      const d = new Date(t.date);
      if (from && d < new Date(from)) return false;
      if (to && d > new Date(`${to}T23:59:59`)) return false;
      if (market !== "all" && t.market !== market) return false;
      if (direction !== "all" && t.direction !== direction) return false;
      if (tradeType !== "all" && t.tradeType !== tradeType) return false;
      if (outcome === "win" && pnl(t) <= 0) return false;
      if (outcome === "loss" && pnl(t) > 0) return false;
      return true;
    });
    const dir = asc ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sort === "pnl") return (pnl(a) - pnl(b)) * dir;
      if (sort === "symbol") return a.symbol.localeCompare(b.symbol) * dir;
      return (+new Date(a.date) - +new Date(b.date)) * dir;
    });
  }, [trades, from, to, market, direction, tradeType, outcome, sort, asc]);

  const totalPnl = rows.reduce((acc, t) => acc + pnl(t), 0);

  const reset = () => {
    setFrom("");
    setTo("");
    setMarket("all");
    setDirection("all");
    setTradeType("all");
    setOutcome("all");
  };

  const headerButton = (key: SortKey, label: string, className?: string) => (
    <th className={cn("px-4 py-2.5 font-medium", className)}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => {
          if (sort === key) setAsc((v) => !v);
          else {
            setSort(key);
            setAsc(false);
          }
        }}
      >
        {label}
        <ArrowUpDown className="size-3" />
      </button>
    </th>
  );

  return (
    <AppLayout title="Trade Log" subtitle={`${rows.length} trades · ${signedMoney(totalPnl)} net`}>
      <Card className="gap-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="size-4 text-primary" /> Filters
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            <X className="size-4" /> Reset
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div className="space-y-1.5">
            <Label className="text-xs">Account</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <FilterSelect label="Market" value={market} onChange={setMarket} options={MARKETS} />
          <FilterSelect label="Direction" value={direction} onChange={setDirection} options={["BUY", "SELL"]} />
          <FilterSelect label="Trade Type" value={tradeType} onChange={setTradeType} options={TRADE_TYPES} />
          <div className="space-y-1.5">
            <Label className="text-xs">Result</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="win">Wins</SelectItem>
                <SelectItem value="loss">Losses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                {headerButton("symbol", "Symbol", "pl-4 sm:pl-5")}
                <th className="px-4 py-2.5 font-semibold">Account</th>
                <th className="px-4 py-2.5 font-semibold">Market</th>
                <th className="px-4 py-2.5 font-semibold">Direction</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">R:R</th>
                <th className="px-4 py-2.5 font-semibold">Emotion</th>
                {headerButton("pnl", "P&L", "text-right")}
                {headerButton("date", "Date", "text-right pr-4 sm:pr-5")}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  onClick={() =>
                    void navigate({
                      to: "/trade-log/$tradeId",
                      params: { tradeId: t.id },
                    })
                  }
                  className="cursor-pointer border-b border-border/50 transition-colors duration-200 hover:bg-muted/40"
                >
                  <td className="px-4 py-3 font-mono font-semibold sm:px-5">{t.symbol}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const acc = accounts.find((a) => a.id === t.accountId) ?? accounts[0];
                      return acc ? (
                        <span
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold border"
                          style={{
                            borderColor: `${acc.color || "#598bff"}40`,
                            backgroundColor: `${acc.color || "#598bff"}15`,
                            color: acc.color || "#598bff",
                          }}
                        >
                          {acc.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.market}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={t.direction === "BUY" ? "border-profit/40 text-profit" : "border-loss/40 text-loss"}
                    >
                      {t.direction}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.tradeType}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {t.sl != null ? (() => {
                      const risk = t.direction === "BUY" ? t.entry - t.sl : t.sl - t.entry;
                      const reward = t.direction === "BUY" ? t.exit - t.entry : t.entry - t.exit;
                      if (risk <= 0) return <span className="text-muted-foreground">—</span>;
                      if (reward >= 0) {
                        return <span className="text-profit">1 : {(reward / risk).toFixed(2)}</span>;
                      } else {
                        return <span className="text-loss">-1 : {(Math.abs(reward) / risk).toFixed(2)}</span>;
                      }
                    })() : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.emotion}</td>
                  <td className="px-4 py-3 text-right">
                    <PnlCell value={pnl(t)} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground sm:pr-5">
                    {formatDate(t.date)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <span className="grid size-12 place-items-center rounded-full border border-border bg-muted/40 text-muted-foreground">
                        <SearchX className="size-5" />
                      </span>
                      <p className="text-base font-semibold">No trades found</p>
                      <p className="max-w-xs text-sm text-muted-foreground">
                        No trades match these filters. Try clearing them or log a new trade.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </AppLayout>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
