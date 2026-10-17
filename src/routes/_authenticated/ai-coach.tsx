import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
    "I have read your full journal — every trade, emotion tag and rule. Ask me anything, or tap a suggestion below to get started.",
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
          activeId: activeExists ? (savedActiveId as string) : parsed[0].id,
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
  "Analyse my last 10 trades",
  "What mistakes am I repeating?",
  "Give me a weekly summary",
  "Which emotion costs me the most money?",
];

function AiCoach() {
  const { trades, rules } = useJournal();
  const callCoach = useServerFn(askCoach);

  const [data] = useState(loadInitialData);
  const [sessions, setSessions] = useState<ChatSession[]>(data.sessions);
  const [activeId, setActiveId] = useState<string>(data.activeId);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find((s) => s.id === activeId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [WELCOME_MSG];

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

  const handleDeleteSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (filtered.length === 0) {
        const fresh = createDefaultSession();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (activeId === sessionId) {
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
        <Button
          type="button"
          onClick={handleNewChat}
          size="sm"
          className="gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-xs"
        >
          <Plus className="size-3.5" />
          <span>New Chat</span>
        </Button>
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

        {/* Recent Chats Sidebar (ChatGPT & Claude Style) */}
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
              const userMsgCount = s.messages.filter((m) => m.role === "user").length;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setActiveId(s.id);
                    if (typeof window !== "undefined" && window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs transition-all cursor-pointer select-none",
                    isActive
                      ? "bg-primary/15 text-primary font-medium border border-primary/30 shadow-xs"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground border border-transparent",
                  )}
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
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    title="Delete chat"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Sidebar Footer */}
          <div className="flex items-center justify-between border-t border-border px-3 py-2.5 text-[11px] text-muted-foreground/70">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <span>Gemini 3.8 Flash</span>
            </div>
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-card/60">
          {/* Subheader: Sidebar Toggle + Horizontal Tabs Strip + Actions */}
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
                  return (
                    <div
                      key={s.id}
                      onClick={() => setActiveId(s.id)}
                      className={cn(
                        "group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 max-w-[170px] border select-none",
                        isActive
                          ? "bg-surface-2 text-foreground border-border shadow-xs"
                          : "bg-transparent text-muted-foreground border-transparent hover:bg-surface-2/60 hover:text-foreground",
                      )}
                    >
                      <MessageSquare className="size-3 shrink-0 opacity-70" />
                      <span className="truncate">{s.title}</span>
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

            {/* Clear active chat button */}
            <div className="flex items-center gap-1.5 shrink-0">
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
                <span className="hidden sm:inline">Clear chat</span>
              </Button>
            </div>
          </div>

          {/* Messages Stream */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
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
                      ? "bg-primary text-primary-foreground font-medium"
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
                placeholder="Ask about your trades, mistakes or discipline…"
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

