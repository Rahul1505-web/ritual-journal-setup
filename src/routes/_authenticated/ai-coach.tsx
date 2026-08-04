import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { askCoach } from "@/lib/coach.functions";
import { useJournal } from "@/lib/journal-store";
import {
  byEmotion,
  byMistake,
  bySymbol,
  formatDate,
  money,
  pnl,
  signedMoney,
  sortByDate,
  stats,
} from "@/lib/trades";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ai-coach")({
  head: () => ({
    meta: [
      { title: "AI Trade Coach — TradeLog Pro" },
      {
        name: "description",
        content:
          "Ask an AI trading coach about your recent trades, repeated mistakes and weekly performance summary.",
      },
      { property: "og:title", content: "AI Trade Coach — TradeLog Pro" },
      {
        property: "og:description",
        content: "Ask an AI coach about your recent trades, repeated mistakes and weekly summary.",
      },
    ],
  }),
  component: AiCoach,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Analyse my last 10 trades",
  "What mistakes am I repeating?",
  "Give me a weekly summary",
  "Which emotion costs me the most money?",
];

function AiCoach() {
  const { trades, rules } = useJournal();
  const callCoach = useServerFn(askCoach);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "I have read your full journal — every trade, emotion tag and rule. Ask me anything, or tap a suggestion below to get started.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const buildSummary = () => {
    const s = stats(trades);
    const recent = sortByDate(trades).reverse().slice(0, 10);
    return [
      `Overall: ${s.count} trades, net ${signedMoney(s.total)}, win rate ${s.winRate.toFixed(1)}% (${s.wins}W/${s.losses}L).`,
      `Avg win ${money(s.avgWin)}, avg loss ${money(s.avgLoss)}, R:R 1:${s.rr.toFixed(2)}, best ${money(s.best)}, worst ${money(s.worst)}.`,
      `Current streak: ${s.streak} ${s.streakWin ? "wins" : "losses"}.`,
      "",
      "Last 10 trades:",
      ...recent.map(
        (t) =>
          `- ${formatDate(t.date)} ${t.symbol} (${t.market}, ${t.direction}, ${t.tradeType}) P&L ${signedMoney(
            pnl(t),
          )}; emotion ${t.emotion}; tags: ${t.tags.join(", ") || "none"}; notes: ${t.notes}`,
      ),
      "",
      "By emotion: " +
        byEmotion(trades)
          .filter((e) => e.trades > 0)
          .map((e) => `${e.emotion} ${e.trades} trades ${signedMoney(e.value)} (${e.winRate}% win)`)
          .join("; "),
      "By mistake tag: " +
        byMistake(trades)
          .filter((m) => m.count > 0)
          .map((m) => `${m.tag} x${m.count} ${signedMoney(m.value)}`)
          .join("; "),
      "Most traded: " +
        bySymbol(trades)
          .slice(0, 5)
          .map((s2) => `${s2.symbol} x${s2.trades} ${signedMoney(s2.value)}`)
          .join("; "),
      "Trading rules: " + rules.map((r) => r.text).join(" | "),
    ].join("\n");
  };

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;
    const history = messages.slice(1).slice(-8);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await callCoach({
        data: { question, tradeSummary: buildSummary(), history },
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.text }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I couldn't reach the coaching model just now. Give it a moment and ask again — your journal data is safe.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title="AI Trade Coach" subtitle="Personalised feedback built from your journal">
      <Card className="flex h-[calc(100vh-13rem)] min-h-[480px] flex-col gap-0 overflow-hidden p-0">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "assistant" ? (
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Bot className="size-4" />
                </span>
              ) : null}
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[70%]",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-foreground",
                )}
              >
                {m.content}
              </div>
              {m.role === "user" ? (
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
                  <User className="size-4" />
                </span>
              ) : null}
            </div>
          ))}
          {loading ? (
            <div className="flex gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Bot className="size-4" />
              </span>
              <div className="rounded-2xl bg-surface-2 px-4 py-3">
                <span className="flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                      style={{ animationDelay: `${d * 120}ms` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-border p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={loading}
                onClick={() => void send(s)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <Textarea
              ref={inputRef}
              rows={2}
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask about your trades, mistakes or discipline…"
              className="min-h-[52px] resize-none"
            />
            <Button type="submit" size="icon" className="size-11 shrink-0" disabled={loading}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </Card>
    </AppLayout>
  );
}
