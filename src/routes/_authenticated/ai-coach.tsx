import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  Check,
  FileDown,
  FileText,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { askCoach } from "@/lib/coach.functions";
import { useJournal } from "@/lib/journal-store";
import { exportPerformancePdf } from "@/lib/pdf-export";
import type { Trade } from "@/lib/trades";
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
  tradeRR,
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

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Msg[];
};

const STORAGE_KEY_SESSIONS = "ai-coach-sessions-v1";
const STORAGE_KEY_ACTIVE = "ai-coach-active-id";
const LEGACY_STORAGE_KEY = "ai-coach-messages";

const WELCOME_MSG: Msg = {
  role: "assistant",
  content:
    "I have read your full journal — every trade, emotion tag and rule. Ask me anything, tap a suggestion below, or ask me to generate a PDF report of your trading performance.",
};

function generateId(): string {
  return "chat_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

function createDefaultSession(title = "New Chat"): ChatSession {
  const now = Date.now();
  return {
    id: generateId(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [WELCOME_MSG],
  };
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function loadInitialData(): { sessions: ChatSession[]; activeId: string } {
  if (typeof window === "undefined") {
    const initial = createDefaultSession();
    return { sessions: [initial], activeId: initial.id };
  }

  try {
    const rawSessions = localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (rawSessions) {
      const parsed = JSON.parse(rawSessions) as ChatSession[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const savedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE);
        const activeExists = parsed.some((s) => s.id === savedActiveId);
        return {
          sessions: parsed,
          activeId: activeExists ? (savedActiveId as string) : (parsed[0]?.id ?? "chat_default"),
        };
      }
    }

    // Check legacy single-chat storage to seamlessly preserve the user's current conversation
    const rawLegacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawLegacy) {
      const parsedLegacy = JSON.parse(rawLegacy) as Msg[];
      if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
        const firstUser = parsedLegacy.find((m) => m.role === "user");
        const title = firstUser
          ? firstUser.content.slice(0, 28) + (firstUser.content.length > 28 ? "…" : "")
          : "Previous Session";
        const legacySession: ChatSession = {
          id: generateId(),
          title,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: parsedLegacy,
        };
        localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify([legacySession]));
        localStorage.setItem(STORAGE_KEY_ACTIVE, legacySession.id);
        return { sessions: [legacySession], activeId: legacySession.id };
      }
    }
  } catch (err) {
    console.error("Failed to load coach chat sessions:", err);
  }

  const initial = createDefaultSession();
  return { sessions: [initial], activeId: initial.id };
}

const SUGGESTIONS = [
  "Generate a PDF audit of my last 4 trades",
  "Generate a PDF audit of my last 3 trades",
  "When is the next FOMC meeting?",
  "What are the major macro events in 2026 and 2027?",
  "Analyse my last 10 trades",
  "Which emotion costs me the most money?",
];

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  latest: 1,
};

type ResolvedTradeScope = {
  scopedTrades: Trade[];
  isScoped: boolean;
  scopeType: "last_n" | "latest" | "symbol" | "all";
  count: number;
  fileName: string;
  reportTitle: string;
  reportSubtitle: string;
  badge: string;
};

function resolveTradeScope(
  userText: string,
  assistantText: string,
  allTrades: Trade[],
): ResolvedTradeScope {
  const combined = `${userText} \n ${assistantText}`.toLowerCase();
  const sorted = sortByDate(allTrades).reverse();

  // 1. Look for "last N trades" / "past N trades" / "recent N trades"
  const lastNMatch = combined.match(
    /(?:last|past|recent|previous)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+trades?/i,
  );
  if (lastNMatch && lastNMatch[1]) {
    const rawNum = lastNMatch[1].toLowerCase();
    const count = WORD_NUMBERS[rawNum] ?? parseInt(rawNum, 10);
    const n = Math.max(1, isNaN(count) ? 3 : count);
    const scopedTrades = sorted.slice(0, n);
    return {
      scopedTrades,
      isScoped: true,
      scopeType: "last_n",
      count: scopedTrades.length,
      fileName: `TradeLog-Last-${n}-Trades.pdf`,
      reportTitle: `Performance Audit — Last ${n} Trades`,
      reportSubtitle: `Focused audit of your last ${n} executions · ${scopedTrades.length} trades analysed`,
      badge: `Last ${n} Trades`,
    };
  }

  // 2. Look for "last trade" / "latest trade" / "most recent trade"
  if (/(?:last|latest|most recent)\s+trade\b/i.test(combined)) {
    const scopedTrades = sorted.slice(0, 1);
    return {
      scopedTrades,
      isScoped: true,
      scopeType: "latest",
      count: scopedTrades.length,
      fileName: `TradeLog-Latest-Trade.pdf`,
      reportTitle: "Performance Audit — Latest Trade Execution",
      reportSubtitle: "Single trade execution audit · 1 trade analysed",
      badge: "Latest Trade",
    };
  }

  // 3. Look for symbol specific scopes if mentioned in user request
  const uniqueSymbols = Array.from(new Set(allTrades.map((t) => t.symbol.toUpperCase()))).filter(Boolean);
  for (const sym of uniqueSymbols) {
    const symRegex = new RegExp(`\\b${sym.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (symRegex.test(userText)) {
      const scopedTrades = sorted.filter((t) => t.symbol.toUpperCase() === sym);
      if (scopedTrades.length > 0) {
        return {
          scopedTrades,
          isScoped: true,
          scopeType: "symbol",
          count: scopedTrades.length,
          fileName: `TradeLog-${sym}-Report.pdf`,
          reportTitle: `Performance Audit — ${sym}`,
          reportSubtitle: `Dedicated symbol audit for ${sym} · ${scopedTrades.length} trades analysed`,
          badge: `${sym} (${scopedTrades.length})`,
        };
      }
    }
  }

  // Default: All trades
  return {
    scopedTrades: allTrades,
    isScoped: false,
    scopeType: "all",
    count: allTrades.length,
    fileName: "TradeLog-Performance-Report.pdf",
    reportTitle: "Performance & Coaching Audit",
    reportSubtitle: `Complete journal audit · ${allTrades.length} trades analysed`,
    badge: "Full Journal",
  };
}

function isUserRequestingPdf(text: string): boolean {
  if (!text) return false;
  const t = text.trim();

  // If user is complaining, asking why PDF is appearing, or telling coach not to give a PDF:
  if (/\b(why|stop|don'?t|disable|remove|prevent|not\s+want)\b.*?\bpdf\b/i.test(t)) {
    return false;
  }

  // 1. Explicit download/export/generate request for pdf/report/audit
  if (/\b(generate|download|export|create|make|give|show|get|save)\b.*?\b(pdf|report|audit)\b/i.test(t)) {
    return true;
  }
  // 2. Scoped trades PDF request (e.g., "last 4 trades pdf", "pdf of last 3 trades", "btc trade pdf")
  if (/\btrades?\b.*?\bpdf\b/i.test(t) || /\bpdf\b.*?\btrades?\b/i.test(t)) {
    return true;
  }
  // 3. User simply says "pdf" or "pdf please"
  if (/^\s*(?:please\s+)?pdf(?:\s+please)?\s*$/i.test(t)) {
    return true;
  }
  // 4. Download/export report phrases
  if (/\b(download|export)\s+(?:performance\s+)?(?:report|audit|log)\b/i.test(t)) {
    return true;
  }

  return false;
}

function parseInlineMarkdown(text: string) {
  const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
  const segments = text.split(regex);

  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**") && seg.length >= 4) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    if (seg.startsWith("*") && seg.endsWith("*") && seg.length >= 2) {
      return (
        <em key={i} className="italic text-foreground/90">
          {seg.slice(1, -1)}
        </em>
      );
    }
    return <span key={i}>{seg}</span>;
  });
}

function FormattedMessage({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  const lines = content.split("\n");
  return (
    <div className="space-y-1.5 leading-relaxed text-sm">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
        const isNumbered = /^\d+\.\s/.test(trimmed);

        const textContent = isBullet
          ? trimmed.slice(2)
          : isNumbered
          ? trimmed.replace(/^\d+\.\s/, "")
          : trimmed;

        const parts = parseInlineMarkdown(textContent);

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="size-1.5 rounded-full bg-primary/70 shrink-0 mt-2" />
              <div className="flex-1">{parts}</div>
            </div>
          );
        }

        if (isNumbered) {
          const numberMatch = trimmed.match(/^(\d+)\.\s/);
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-xs font-bold text-primary shrink-0 mt-0.5">
                {numberMatch ? numberMatch[1] + "." : "•"}
              </span>
              <div className="flex-1">{parts}</div>
            </div>
          );
        }

        return <div key={idx}>{parts}</div>;
      })}
    </div>
  );
}

function AiCoach() {
  const { trades, rules } = useJournal();
  const callCoach = useServerFn(askCoach);

  const [data] = useState(loadInitialData);
  const [sessions, setSessions] = useState<ChatSession[]>(data.sessions);
  const [activeId, setActiveId] = useState<string>(data.activeId);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Chat title editing state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find((s) => s.id === activeId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [WELCOME_MSG];

  // Focus rename input on entering edit mode
  useEffect(() => {
    if (editingSessionId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingSessionId]);

  // Persist sessions to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.error("Failed to persist coach sessions:", e);
    }
  }, [sessions]);

  // Persist activeId to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE, activeId);
    } catch {}
  }, [activeId]);

  // Smooth scroll down on new messages or loading
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Instant scroll and input refocus when switching sessions
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "instant" });
    if (!loading) inputRef.current?.focus();
  }, [activeId]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const handleNewChat = () => {
    const newSession = createDefaultSession("New Chat");
    setSessions((prev) => [newSession, ...prev]);
    setActiveId(newSession.id);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleStartRename = (sessionId: string, currentTitle: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingSessionId(sessionId);
    setEditTitleValue(currentTitle);
  };

  const handleSaveRename = (sessionId: string) => {
    const trimmed = editTitleValue.trim();
    const finalTitle = trimmed || "Untitled Chat";
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: finalTitle, updatedAt: Date.now() } : s)),
    );
    setEditingSessionId(null);
    toast.success("Chat title updated");
  };

  const handleCancelRename = () => {
    setEditingSessionId(null);
  };

  const handleDeleteSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (filtered.length === 0) {
        const fresh = createDefaultSession();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (activeId === sessionId && filtered[0]) {
        setActiveId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleClearActiveChat = () => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId
          ? { ...s, messages: [WELCOME_MSG], updatedAt: Date.now() }
          : s,
      ),
    );
  };

  const handleExportPdf = (
    targetTrades?: Trade[],
    customTitle?: string,
    customSubtitle?: string,
    specificCoachMessages?: string[],
  ) => {
    try {
      const coachMessages =
        specificCoachMessages && specificCoachMessages.length > 0
          ? specificCoachMessages
          : messages
              .filter((m) => m.role === "assistant")
              .map((m) => m.content);

      const tradesToExport =
        targetTrades && targetTrades.length > 0 ? targetTrades : trades;

      exportPerformancePdf({
        trades: tradesToExport,
        rules,
        coachMessages,
        ...(customTitle ? { reportTitle: customTitle } : {}),
        ...(customSubtitle ? { reportSubtitle: customSubtitle } : {}),
      });

      toast.success(
        customTitle
          ? `${customTitle} downloaded!`
          : "Performance PDF downloaded!"
      );
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      toast.error("Failed to generate PDF. Please try again.");
    }
  };

  const buildSummary = () => {
    const s = stats(trades);
    const sortedTrades = sortByDate(trades).reverse();
    const recent = sortedTrades.slice(0, 20);
    return [
      `CURRENT SYSTEM DATE: Saturday, October 17, 2026`,
      `Overall Journal Stats: ${s.count} total trades, net ${signedMoney(s.total)}, win rate ${s.winRate.toFixed(1)}% (${s.wins}W/${s.losses}L).`,
      `Avg win ${money(s.avgWin)}, avg loss ${money(s.avgLoss)}, R:R 1:${s.rr.toFixed(2)}, best ${money(s.best)}, worst ${money(s.worst)}.`,
      `Current streak: ${s.streak} ${s.streakWin ? "wins" : "losses"}.`,
      "",
      "Recent Executions in Chronological Order (Trade #1 is the most recent trade):",
      ...recent.map((t, idx) => {
        const p = pnl(t);
        const lev = t.leverage && t.leverage > 1 ? `${t.leverage}x leverage` : "1x";
        const amt = t.amount ? `$${t.amount.toLocaleString()}` : (t.quantity ? `${t.quantity} qty` : "");
        const prices = t.entry && t.exit ? `Entry: $${t.entry} -> Exit: $${t.exit}` : "";
        const rrVal = tradeRR(t);
        const rrStr = rrVal !== null ? `1:${rrVal.toFixed(2)}` : "Not logged";
        const slStr = t.sl != null && t.sl > 0 ? `$${t.sl}` : "None";
        const tpStr = t.tp != null && t.tp > 0 ? `$${t.tp}` : "None";
        const thesisStr = t.notes && t.notes.trim().length > 0 ? `"${t.notes.trim()}"` : "None written";
        return [
          `- Trade #${idx + 1} (${formatDate(t.date)}): ${t.symbol} | ${t.direction.toUpperCase()} (${t.market}, ${t.tradeType}) | ${amt} @ ${lev} | ${prices} | SL: ${slStr} | TP: ${tpStr} | Calculated R:R: ${rrStr} | P&L: ${signedMoney(p)} | Emotion: ${t.emotion} | Tags: ${t.tags.join(", ") || "none"}`,
          `  TRADER THESIS / PLAN: ${thesisStr}`,
        ].join("\n");
      }),
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
      "Most traded symbols: " +
        bySymbol(trades)
          .slice(0, 5)
          .map((s2) => `${s2.symbol} x${s2.trades} ${signedMoney(s2.value)}`)
          .join("; "),
      "Active Trading Rules: " + (rules.length > 0 ? rules.map((r) => r.text).join(" | ") : "No rules logged yet"),
    ].join("\n");
  };

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || loading || !activeSession) return;

    const targetSessionId = activeSession.id;
    const isFirstUserMsg =
      activeSession.messages.filter((m) => m.role === "user").length === 0;
    const newTitle =
      isFirstUserMsg || activeSession.title === "New Chat"
        ? question.length > 28
          ? question.slice(0, 28) + "…"
          : question
        : activeSession.title;

    const history = activeSession.messages.slice(1).slice(-8);

    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? {
              ...s,
              title: newTitle,
              messages: [...s.messages, { role: "user", content: question }],
              updatedAt: Date.now(),
            }
          : s,
      ),
    );

    setInput("");
    setLoading(true);

    try {
      const res = await callCoach({
        data: { question, tradeSummary: buildSummary(), history },
      });

      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: [...s.messages, { role: "assistant", content: res.text }],
                updatedAt: Date.now(),
              }
            : s,
        ),
      );
    } catch {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    role: "assistant",
                    content:
                      "I couldn't reach the coaching model just now. Give it a moment and ask again — your journal data is safe.",
                  },
                ],
                updatedAt: Date.now(),
              }
            : s,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout
      title="AI Trade Coach"
      subtitle="Personalised feedback built from your journal"
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleExportPdf()}
            size="sm"
            title="Download detailed Performance & Coaching PDF audit"
            className="gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-xs"
          >
            <FileDown className="size-3.5 text-primary" />
            <span>Generate PDF</span>
          </Button>

          <Button
            type="button"
            onClick={handleNewChat}
            size="sm"
            className="gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>New Chat</span>
          </Button>
        </div>
      }
    >
      <Card className="relative flex h-[calc(100vh-13rem)] min-h-[520px] flex-row gap-0 overflow-hidden p-0 border-border bg-card">
        {/* Mobile backdrop */}
        {sidebarOpen ? (
          <div
            className="absolute inset-0 z-20 bg-background/70 backdrop-blur-xs md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        {/* Recent Chats Sidebar */}
        <aside
          className={cn(
            "flex flex-col border-r border-border bg-surface-1/50 transition-all duration-200 shrink-0",
            "absolute inset-y-0 left-0 z-30 w-72 md:relative md:z-0 md:inset-auto",
            sidebarOpen
              ? "translate-x-0 md:w-64 lg:w-72"
              : "-translate-x-full md:w-0 md:hidden md:border-r-0",
          )}
        >
          {/* Sidebar Top: New Chat + Collapse */}
          <div className="flex items-center justify-between gap-2 border-b border-border p-3">
            <Button
              type="button"
              onClick={handleNewChat}
              size="sm"
              className="flex-1 justify-start gap-2 rounded-xl bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 hover:text-primary transition-all text-xs font-semibold shadow-xs h-9"
            >
              <Plus className="size-4" />
              New Chat
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              title="Close history sidebar"
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <PanelLeftClose className="size-4" />
            </Button>
          </div>

          {/* Section Header */}
          <div className="flex items-center justify-between px-3.5 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
            <span>Recent Chats</span>
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
              {sessions.length}
            </span>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.map((s) => {
              const isActive = s.id === activeId;
              const isEditing = editingSessionId === s.id;
              const userMsgCount = s.messages.filter((m) => m.role === "user").length;

              if (isEditing) {
                return (
                  <form
                    key={s.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveRename(s.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 bg-surface-2 border border-primary shadow-xs"
                  >
                    <input
                      ref={editInputRef}
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") handleCancelRename();
                      }}
                      className="flex-1 min-w-0 bg-transparent text-xs text-foreground focus:outline-none"
                      placeholder="Chat title..."
                    />
                    <button
                      type="submit"
                      className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors"
                      title="Save title"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelRename}
                      className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Cancel"
                    >
                      <X className="size-3.5" />
                    </button>
                  </form>
                );
              }

              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setActiveId(s.id);
                    if (typeof window !== "undefined" && window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                  onDoubleClick={(e) => handleStartRename(s.id, s.title, e)}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs transition-all cursor-pointer select-none",
                    isActive
                      ? "bg-primary/15 text-primary font-medium border border-primary/30 shadow-xs"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground border border-transparent",
                  )}
                  title="Click to select · Double-click to rename"
                >
                  <MessageSquare
                    className={cn(
                      "size-3.5 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground/70",
                    )}
                  />
                  <div className="flex-1 min-w-0 pr-1">
                    <p className="truncate text-xs leading-snug">{s.title}</p>
                    <span className="text-[10px] text-muted-foreground/70 block mt-0.5">
                      {formatRelativeTime(s.updatedAt)}
                      {userMsgCount > 0 ? ` · ${userMsgCount} msg${userMsgCount > 1 ? "s" : ""}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleStartRename(s.id, s.title, e)}
                      title="Edit chat title"
                      className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-surface-2 transition-colors"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      title="Delete chat"
                      className="p-1 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar Footer */}
          <div className="flex items-center justify-between border-t border-border px-3 py-2.5 text-[11px] text-muted-foreground/70">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <span>Gemini 3.7 Flash</span>
            </div>
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-card/60">
          {/* Subheader: Sidebar Toggle + Horizontal Tabs Strip + Action Buttons */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 bg-surface-1/30">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {!sidebarOpen ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  title="Open recent chats history"
                  className="size-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                >
                  <PanelLeftOpen className="size-4" />
                </Button>
              ) : null}

              {/* Horizontal Tabs Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
                {sessions.slice(0, 6).map((s) => {
                  const isActive = s.id === activeId;
                  const isEditing = editingSessionId === s.id;

                  if (isEditing) {
                    return (
                      <form
                        key={s.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveRename(s.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-2 border border-primary shrink-0"
                      >
                        <input
                          ref={editInputRef}
                          value={editTitleValue}
                          onChange={(e) => setEditTitleValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") handleCancelRename();
                          }}
                          className="h-5 w-24 sm:w-28 bg-transparent text-xs text-foreground focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="text-emerald-500 hover:text-emerald-400 p-0.5"
                          title="Save"
                        >
                          <Check className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelRename}
                          className="text-muted-foreground hover:text-destructive p-0.5"
                          title="Cancel"
                        >
                          <X className="size-3" />
                        </button>
                      </form>
                    );
                  }

                  return (
                    <div
                      key={s.id}
                      onClick={() => setActiveId(s.id)}
                      onDoubleClick={(e) => handleStartRename(s.id, s.title, e)}
                      className={cn(
                        "group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 max-w-[170px] border select-none",
                        isActive
                          ? "bg-surface-2 text-foreground border-border shadow-xs"
                          : "bg-transparent text-muted-foreground border-transparent hover:bg-surface-2/60 hover:text-foreground",
                      )}
                      title="Click to select · Double-click to rename"
                    >
                      <MessageSquare className="size-3 shrink-0 opacity-70" />
                      <span className="truncate">{s.title}</span>
                      <button
                        type="button"
                        onClick={(e) => handleStartRename(s.id, s.title, e)}
                        className="opacity-0 group-hover:opacity-100 hover:text-primary rounded p-0.5 transition-opacity ml-0.5 text-muted-foreground"
                        title="Rename chat"
                      >
                        <Pencil className="size-2.5" />
                      </button>
                      {sessions.length > 1 ? (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-destructive rounded p-0.5 transition-opacity ml-0.5 text-muted-foreground"
                          title="Close tab"
                        >
                          <X className="size-2.5" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}

                {/* + Button to open a new tab right from the tab strip */}
                <button
                  type="button"
                  onClick={handleNewChat}
                  title="Open a new chat tab"
                  className="flex items-center justify-center size-7 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all shrink-0 ml-0.5"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Action Buttons: Rename + Export PDF + Clear chat */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => activeSession && handleStartRename(activeSession.id, activeSession.title)}
                title="Rename this chat"
                className="h-8 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <Pencil className="size-3" />
                <span className="hidden sm:inline">Rename</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleExportPdf()}
                title="Download complete Performance & Coaching PDF report"
                className="h-8 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <FileDown className="size-3.5 text-primary" />
                <span className="hidden sm:inline font-medium text-foreground">PDF</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearActiveChat}
                disabled={loading || messages.length <= 1}
                title="Clear messages in current chat"
                className="h-8 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
              >
                <Trash2 className="size-3" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            </div>
          </div>

          {/* Messages Stream */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            {messages.map((m, i) => {
              const isAssistant = m.role === "assistant";
              const prevMessage = i > 0 ? messages[i - 1] : null;
              const prevUserText = prevMessage?.role === "user" ? prevMessage.content : "";
              const isPdfRequest = isAssistant && isUserRequestingPdf(prevUserText);

              const scope = isPdfRequest
                ? resolveTradeScope(prevUserText, m.content, trades)
                : null;

              // If this message was not a PDF request, strip any stray PDF announcement text from previous logs
              const displayContent =
                isAssistant && !isPdfRequest
                  ? m.content
                      .replace(
                        /(?:\n\s*---\s*)?\n*Your\s+(?:custom\s+)?PDF\s+audit\s+file[^\n]*ready\s+(?:to|for)\s+download\s+below\.?/gi,
                        "",
                      )
                      .trimEnd()
                  : m.content;

              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-1.5",
                    m.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "flex gap-3 max-w-[90%] sm:max-w-[75%]",
                      m.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {isAssistant ? (
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                        <Bot className="size-4" />
                      </span>
                    ) : null}
                    <div
                      className={cn(
                        "w-full rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground font-medium"
                          : "bg-surface-2 text-foreground",
                      )}
                    >
                      <FormattedMessage content={displayContent} isUser={m.role === "user"} />

                      {isPdfRequest && scope ? (
                        <div className="mt-3.5 pt-3 border-t border-border/70">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-background/80 border border-border p-3.5 shadow-sm transition-all hover:border-primary/40">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="size-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 grid place-items-center shrink-0">
                                <FileText className="size-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground text-xs sm:text-sm truncate">
                                    {scope.fileName}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20 shrink-0">
                                    {scope.badge}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                  {scope.reportSubtitle}
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              onClick={() =>
                                handleExportPdf(
                                  scope.scopedTrades,
                                  scope.reportTitle,
                                  scope.reportSubtitle,
                                  [m.content],
                                )
                              }
                              size="sm"
                              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-xl shadow-xs shrink-0 self-start sm:self-auto transition-transform active:scale-95"
                            >
                              <FileDown className="size-4" />
                              <span>Download PDF</span>
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {m.role === "user" ? (
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
                        <User className="size-4" />
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
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

          {/* Suggestion Chips & Message Input */}
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
                placeholder="Ask about your trades, mistakes, or request a PDF report…"
                className="min-h-[52px] resize-none"
              />
              <Button type="submit" size="icon" className="size-11 shrink-0" disabled={loading}>
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </AppLayout>
  );
}
