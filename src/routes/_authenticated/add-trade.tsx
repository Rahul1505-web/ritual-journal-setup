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
  const { addTrade, rules } = useJournal();
  const navigate = useNavigate();

  const [symbol, setSymbol] = useState("");
  const [market, setMarket] = useState<MarketType>("Stocks");
  const [direction, setDirection] = useState<Direction>("BUY");
  const [entry, setEntry] = useState("");
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

  const result = useMemo(() => {
    const e = parseFloat(entry);
    const x = parseFloat(exit);
    const q = parseFloat(quantity);
    if ([e, x, q].some((n) => Number.isNaN(n))) return null;
    const raw = (x - e) * q;
    return direction === "BUY" ? raw : -raw;
  }, [entry, exit, quantity, direction]);

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
      exit: parseFloat(exit),
      quantity: parseFloat(quantity),
      date: new Date(date).toISOString(),
      tradeType,
      emotion,
      tags,
      notes: notes.trim(),
      charts,
      rulesFollowed: followed,
        rulesBroken: rules.filter((r) => !followed.includes(r.id)).map((r) => r.id),
      });
      toast.success(`${symbol.toUpperCase()} logged — ${signedMoney(result)}`);
      navigate({ to: "/trade-log" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the trade.");
    }
  };

  return (
    <AppLayout title="Add Trade" subtitle="Log the setup, the numbers and the psychology">
      <form onSubmit={onSubmit} className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="gap-6 p-6">
            <h2 className="text-sm font-semibold">Position</h2>
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

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="entry">Entry Price</Label>
                <Input id="entry" type="number" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exit">Exit Price</Label>
                <Input id="exit" type="number" step="any" value={exit} onChange={(e) => setExit(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input id="qty" type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
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
            <h2 className="text-sm font-semibold">Psychology</h2>
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
            <h2 className="text-sm font-semibold">Chart Screenshots</h2>
            <ChartUploader value={charts} onChange={setCharts} onView={setLightbox} />
          </Card>
          <ChartLightbox paths={charts} index={lightbox} onClose={() => setLightbox(null)} />
        </div>

        <div className="space-y-4">
          <Card className="gap-3 p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Calculated Result
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
              (Exit − Entry) × Quantity{direction === "SELL" ? ", inverted for short positions" : ""}
            </p>
            <Button type="submit" className="mt-1 w-full">
              Save Trade
            </Button>
          </Card>

          <Card className="gap-3 p-6">
            <div>
              <h2 className="text-sm font-semibold">Pre-trade checklist</h2>
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
