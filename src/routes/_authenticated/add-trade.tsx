import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app-layout";
import { ChartLightbox, ChartUploader } from "@/components/chart-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useJournal } from "@/lib/journal-store";
import {
  EMOTIONS,
  MARKETS,
  MISTAKE_TAGS,
  TRADE_TYPES,
  signedMoney,
  type Direction,
  type Emotion,
  type MarketType,
  type MistakeTag,
  type TradeType,
} from "@/lib/trades";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/add-trade")({
  head: () => ({
    meta: [
      { title: "Add Trade — TradeLog Pro" },
      {
        name: "description",
        content:
          "Log a new trade with entry, exit, emotion, mistake tags and your pre-trade rule checklist.",
      },
      { property: "og:title", content: "Add Trade — TradeLog Pro" },
      {
        property: "og:description",
        content: "Log a new trade with entry, exit, emotion and mistake tags.",
      },
    ],
  }),
  component: AddTrade,
});

function AddTrade() {
  const { addTrade, rules, accounts, activeAccountId } = useJournal();
  const navigate = useNavigate();

  const [selectedAccount, setSelectedAccount] = useState<string>(() => {
    if (activeAccountId && activeAccountId !== "all") return activeAccountId;
    return accounts[0]?.id ?? "acc_main";
  });
  const [symbol, setSymbol] = useState("");
  const [market, setMarket] = useState<MarketType>("Stocks");
  const [direction, setDirection] = useState<Direction>("BUY");
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [exit, setExit] = useState("");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [tradeType, setTradeType] = useState<TradeType>("Intraday");
  const [emotion, setEmotion] = useState<Emotion>("Neutral");
  const [tags, setTags] = useState<MistakeTag[]>([]);
  const [notes, setNotes] = useState("");
  const [followed, setFollowed] = useState<string[]>([]);
  const [charts, setCharts] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);

  // P&L result
  const result = useMemo(() => {
    const e = parseFloat(entry);
    const x = parseFloat(exit);
    const q = parseFloat(quantity);
    if ([e, x, q].some((n) => Number.isNaN(n))) return null;
    const raw = (x - e) * q;
    return direction === "BUY" ? raw : -raw;
  }, [entry, exit, quantity, direction]);

  // Realized R:R (from Exit Price and Stop Loss)
  const realizedRR = useMemo(() => {
    const e = parseFloat(entry);
    const s = parseFloat(sl);
    const x = parseFloat(exit);
    if ([e, s, x].some((n) => Number.isNaN(n) || n <= 0)) return null;

    const risk = direction === "BUY" ? e - s : s - e;
    const reward = direction === "BUY" ? x - e : e - x;

    if (risk <= 0) return null;
    return reward / risk;
  }, [entry, sl, exit, direction]);

  // Planned R:R (from Take Profit and Stop Loss - Initial Plan)
  const plannedRR = useMemo(() => {
    const e = parseFloat(entry);
    const s = parseFloat(sl);
    const t = parseFloat(tp);
    if ([e, s, t].some((n) => Number.isNaN(n) || n <= 0)) return null;

    const risk = direction === "BUY" ? e - s : s - e;
    const reward = direction === "BUY" ? t - e : e - t;

    if (risk <= 0 || reward <= 0) return null;
    return reward / risk;
  }, [entry, sl, tp, direction]);

  const toggleTag = (tag: MistakeTag) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const toggleRule = (id: string) =>
    setFollowed((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() || result === null) {
      toast.error("Add a symbol plus entry, exit and quantity.");
      return;
    }
    try {
      await addTrade({
        symbol: symbol.trim().toUpperCase(),
        market,
        direction,
        entry: parseFloat(entry),
        sl: sl ? parseFloat(sl) : undefined,
        tp: tp ? parseFloat(tp) : undefined,
        exit: parseFloat(exit),
        quantity: parseFloat(quantity),
        date: new Date(date).toISOString(),
        tradeType,
        emotion,
        tags,
        notes: notes.trim(),
        accountId: selectedAccount,
        charts,
        rulesFollowed: followed,
        rulesBroken: rules.filter((r) => !followed.includes(r.id)).map((r) => r.id),
      });
      toast.success(`${symbol.toUpperCase()} logged — ${signedMoney(result)}`);
      navigate({ to: "/trade-log" });
    } catch (err: unknown) {
      console.error("Save trade error:", err);
      let msg = "Could not save the trade.";
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === "object" && err !== null) {
        if ("message" in err && typeof (err as { message: unknown }).message === "string") {
          msg = (err as { message: string }).message;
        } else if ("error_description" in err && typeof (err as { error_description: unknown }).error_description === "string") {
          msg = (err as { error_description: string }).error_description;
        }
      }
      toast.error(msg);
    }
  };

  return (
    <AppLayout title="Add Trade" subtitle="Log the setup, the numbers and the psychology">
      <form onSubmit={onSubmit} className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="gap-6 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Position</h2>
              {accounts.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Target Account:{" "}
                  <strong className="text-foreground">
                    {accounts.find((a) => a.id === selectedAccount)?.name ?? "Main Account"}
                  </strong>
                </span>
              )}
            </div>

            {/* Trading Account Selector */}
            {accounts.length > 0 && (
              <div className="space-y-2">
                <Label>Trading Account</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="w-full bg-surface-2 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: acc.color || "#598bff" }}
                          />
                          <span className="font-semibold">{acc.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({acc.broker} · {acc.currency}{acc.initialBalance.toLocaleString()})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol / Instrument</Label>
                <Input
                  id="symbol"
                  placeholder="AAPL"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Market Type</Label>
                <Select value={market} onValueChange={(v) => setMarket(v as MarketType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKETS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Direction</Label>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1">
                {(["BUY", "SELL"] as Direction[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className={cn(
                      "rounded-lg py-2 text-sm font-semibold text-muted-foreground transition-colors",
                      direction === d &&
                        (d === "BUY"
                          ? "bg-profit/15 text-profit"
                          : "bg-loss/15 text-loss"),
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Entry Price */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="entry">Entry Price</Label>
                <Input
                  id="entry"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                />
              </div>

              {/* Stop Loss */}
              <div className="space-y-2">
                <Label htmlFor="sl" className="flex items-center gap-1.5">
                  Stop Loss (SL)
                  <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-loss/15 text-loss">Risk</span>
                </Label>
                <Input
                  id="sl"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={sl}
                  onChange={(e) => setSl(e.target.value)}
                  style={{ borderColor: sl ? "rgba(239,68,68,0.4)" : undefined }}
                />
              </div>

              {/* Take Profit */}
              <div className="space-y-2">
                <Label htmlFor="tp" className="flex items-center gap-1.5">
                  Take Profit (TP)
                  <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-profit/15 text-profit">Reward</span>
                </Label>
                <Input
                  id="tp"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={tp}
                  onChange={(e) => setTp(e.target.value)}
                  style={{ borderColor: tp ? "rgba(16,185,129,0.4)" : undefined }}
                />
              </div>
            </div>

            {/* Exit Price + Quantity */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exit">Exit Price</Label>
                <Input
                  id="exit"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={exit}
                  onChange={(e) => setExit(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  step="any"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date &amp; Time</Label>
                <Input id="date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Trade Type</Label>
                <Select value={tradeType} onValueChange={(v) => setTradeType(v as TradeType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADE_TYPES.map((tt) => (
                      <SelectItem key={tt} value={tt}>
                        {tt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="gap-6 p-6">
            <h2 className="text-lg font-semibold">Psychology</h2>
            <div className="space-y-2">
              <Label>Emotion at entry</Label>
              <Select value={emotion} onValueChange={(v) => setEmotion(v as Emotion)}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMOTIONS.map((em) => (
                    <SelectItem key={em} value={em}>
                      {em}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mistake / behaviour tags</Label>
              <div className="flex flex-wrap gap-2">
                {MISTAKE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                      tags.includes(tag) && "border-primary/50 bg-primary/15 text-primary",
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Trade thesis</Label>
              <Textarea
                id="notes"
                rows={4}
                placeholder="Why did you take this trade? What was the plan?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </Card>

          <Card className="gap-6 p-6">
            <h2 className="text-lg font-semibold">Chart Screenshots</h2>
            <ChartUploader value={charts} onChange={setCharts} onView={setLightbox} />
          </Card>
          <ChartLightbox paths={charts} index={lightbox} onClose={() => setLightbox(null)} />
        </div>

        <div className="space-y-4">
          {/* R/R Ratio Card */}
          <Card className="gap-3 p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {realizedRR !== null
                  ? "Realized R:R (Exit / SL)"
                  : plannedRR !== null
                  ? "Planned R:R (Target)"
                  : "Risk / Reward Ratio"}
              </p>
              {plannedRR !== null && realizedRR !== null && (
                <span className="text-[11px] font-medium text-muted-foreground">
                  Target: 1 : {plannedRR.toFixed(2)}
                </span>
              )}
            </div>

            <div className="flex items-end gap-2">
              <p
                className={cn(
                  "tabular text-3xl font-bold",
                  (realizedRR ?? plannedRR) === null
                    ? "text-muted-foreground"
                    : (realizedRR ?? plannedRR)! >= 2
                    ? "text-profit"
                    : (realizedRR ?? plannedRR)! >= 1
                    ? "text-yellow-400"
                    : "text-loss",
                )}
              >
                {(() => {
                  const val = realizedRR ?? plannedRR;
                  if (val === null) return "—";
                  if (val >= 0) return `1 : ${val.toFixed(2)}`;
                  return `-1 : ${Math.abs(val).toFixed(2)}`;
                })()}
              </p>
              {(realizedRR ?? plannedRR) !== null && (
                <span
                  className={cn(
                    "mb-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    (realizedRR ?? plannedRR)! >= 2
                      ? "bg-profit/15 text-profit"
                      : (realizedRR ?? plannedRR)! >= 1
                      ? "bg-yellow-400/15 text-yellow-400"
                      : "bg-loss/15 text-loss",
                  )}
                >
                  {(realizedRR ?? plannedRR)! >= 2
                    ? "Good"
                    : (realizedRR ?? plannedRR)! >= 1
                    ? "Acceptable"
                    : "Poor"}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {realizedRR !== null
                ? direction === "BUY"
                  ? "Realized = Exit − Entry  |  Risk = Entry − SL"
                  : "Realized = Entry − Exit  |  Risk = SL − Entry"
                : direction === "BUY"
                ? "Reward = TP − Entry  |  Risk = Entry − SL"
                : "Reward = Entry − TP  |  Risk = SL − Entry"}
            </p>

            {/* SL / TP / Exit breakdown */}
            {(sl || tp || exit) && (
              <div className="mt-1 grid grid-cols-3 gap-2 rounded-lg border border-border p-2.5 text-xs text-center">
                <div>
                  <p className="text-muted-foreground">Stop Loss</p>
                  <p className="font-mono font-semibold text-loss">{sl || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Plan (TP)</p>
                  <p className="font-mono font-semibold text-profit">{tp || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Exit Price</p>
                  <p className="font-mono font-semibold text-primary">{exit || "—"}</p>
                </div>
              </div>
            )}
          </Card>

          {/* P&L Card */}
          <Card className="gap-3 p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Calculated P&amp;L
            </p>
            <p
              className={cn(
                "tabular text-3xl font-bold",
                result === null ? "text-muted-foreground" : result >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {result === null ? "—" : signedMoney(result)}
            </p>
            <p className="text-xs text-muted-foreground">
              (Exit − Entry) × Quantity{direction === "SELL" ? ", inverted for short" : ""}
            </p>
            <Button type="submit" className="mt-1 w-full">
              Save Trade
            </Button>
          </Card>

          <Card className="gap-3 p-6">
            <div>
              <h2 className="text-lg font-semibold">Pre-trade checklist</h2>
              <p className="text-xs text-muted-foreground">
                Tick every rule you followed on this trade.
              </p>
            </div>
            <div className="space-y-3">
              {rules.map((rule) => (
                <label key={rule.id} className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    checked={followed.includes(rule.id)}
                    onCheckedChange={() => toggleRule(rule.id)}
                    className="mt-0.5"
                  />
                  <span className={cn(followed.includes(rule.id) ? "" : "text-muted-foreground")}>
                    {rule.text}
                  </span>
                </label>
              ))}
            </div>
            <Badge variant="outline" className="w-fit">
              {followed.length}/{rules.length} rules followed
            </Badge>
          </Card>
        </div>
      </form>
    </AppLayout>
  );
}
