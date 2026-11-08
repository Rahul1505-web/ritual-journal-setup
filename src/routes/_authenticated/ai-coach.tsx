import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BookMarked,
  BookOpen,
  Bot,
  Check,
  Eye,
  FileDown,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Maximize2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { askCoach } from "@/lib/coach.functions";
import { groupDiaryEntriesIntoTopics, formatDisplayDate, type TopicGroup } from "@/lib/diary";
import { useJournal } from "@/lib/journal-store";
import { exportPerformancePdf } from "@/lib/pdf-export";
import { resolveChartUrls, useSignedChartUrls, validateChartFile } from "@/lib/trade-charts";
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
  validateSearch: (
    search: Record<string, unknown>,
  ): { topicKey?: string | undefined; topicTitle?: string | undefined } => ({
    topicKey: typeof search["topicKey"] === "string" ? search["topicKey"] : undefined,
    topicTitle: typeof search["topicTitle"] === "string" ? search["topicTitle"] : undefined,
  }),
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

type Msg = {
  role: "user" | "assistant";
  content: string;
  images?: Array<{ url: string; caption?: string; name?: string }> | undefined;
  options?: Array<{ label: string; actionText: string }> | undefined;
};

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

function sanitizeSessionMessages(sessions: ChatSession[]): ChatSession[] {
  return sessions.map((s) => ({
    ...s,
    messages: s.messages.map((m) => {
      // If a user message has auto-attached screenshots from journal/diary from the previous bug, clean them
      if (
        m.role === "user" &&
        m.images &&
        m.images.length > 0 &&
        m.images.some(
          (img) =>
            img.name === "entry!" ||
            img.name === "sl hit!" ||
            img.caption === "entry!" ||
            img.caption === "sl hit!" ||
            img.name === "Diary chart" ||
            img.caption === "Diary chart" ||
            (img.caption && /liquidity|trade|chart|miss this|sweep|tp/i.test(img.caption)) ||
            (img.name && /liquidity|trade|chart|miss this|sweep|tp/i.test(img.name)) ||
            (img.url && !img.url.startsWith("data:image/")),
        )
      ) {
        const { images: _ignored, ...rest } = m;
        return rest;
      }
      return m;
    }),
  }));
}

function matchesDateInQuery(dateStr: string | undefined, query: string): boolean {
  if (!dateStr) return false;
  const q = query.toLowerCase();

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;

  const [_, y, m, d] = match;
  if (!y || !m || !d) return false;
  const dayNum = parseInt(d, 10);
  const monthNum = parseInt(m, 10);

  const months = [
    ["january", "jan"],
    ["february", "feb"],
    ["march", "mar"],
    ["april", "apr"],
    ["may"],
    ["june", "jun"],
    ["july", "jul"],
    ["august", "aug"],
    ["september", "sep", "sept"],
    ["october", "oct"],
    ["november", "nov"],
    ["december", "dec"],
  ];

  const monthNames = months[monthNum - 1] ?? [];
  const dayPatterns = [
    `${dayNum}`,
    `${d}`,
    `${dayNum}th`,
    `${dayNum}st`,
    `${dayNum}nd`,
    `${dayNum}rd`,
  ];

  // Direct match: e.g. "2026-11-04", "11-04", "04-11"
  if (q.includes(`${y}-${m}-${d}`) || q.includes(`${m}-${d}`) || q.includes(`${d}-${m}`)) {
    return true;
  }

  for (const mName of monthNames) {
    if (q.includes(mName)) {
      for (const dPat of dayPatterns) {
        if (
          q.includes(`${dPat} ${mName}`) ||
          q.includes(`${mName} ${dPat}`) ||
          q.includes(`${dPat}${mName}`) ||
          q.includes(`${mName}${dPat}`) ||
          new RegExp(`\\b${dPat}\\s*(?:taareekh|tarikh|st|nd|rd|th)?\\s*${mName}\\b`).test(q) ||
          new RegExp(`\\b${mName}\\s*${dPat}\\b`).test(q)
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

function cleanForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatchingDiaryTopics(
  query: string,
  topicGroups: TopicGroup[],
): {
  matchedTopics: TopicGroup[];
  hasExactTitleMatch: boolean;
  extractedTitle?: string | undefined;
} {
  const cleanQ = cleanForComparison(query);

  // 1. Check if user put the topic title in quotes, e.g. "MISSING BTC TRADE!" or 'MISSING BTC TRADE!' or “MISSING BTC TRADE!”
  const quotedMatch = query.match(/["'“‘]([^"'“”‘’]{2,})["'“‘]/);
  const quotedTitle = quotedMatch?.[1]?.trim();
  const cleanQuoted = quotedTitle ? cleanForComparison(quotedTitle) : "";

  if (cleanQuoted && cleanQuoted.length >= 2) {
    const exactQuotedMatches = topicGroups.filter((g) => {
      const gTitle = cleanForComparison(g.title);
      return gTitle === cleanQuoted || gTitle.includes(cleanQuoted) || cleanQuoted.includes(gTitle);
    });
    if (exactQuotedMatches.length > 0) {
      return {
        matchedTopics: exactQuotedMatches,
        hasExactTitleMatch: true,
        extractedTitle: quotedTitle,
      };
    }
  }

  // 2. Exact or substring match against known topic titles
  // Sort topicGroups by title length descending so longer, more specific titles match first
  const sortedByLen = [...topicGroups].sort(
    (a, b) => cleanForComparison(b.title).length - cleanForComparison(a.title).length,
  );

  const matched: TopicGroup[] = [];
  for (const group of sortedByLen) {
    const cleanT = cleanForComparison(group.title);
    if (!cleanT || cleanT.length < 3) continue;

    // Check if query contains the full title as a phrase
    if (cleanQ.includes(cleanT)) {
      matched.push(group);
      continue;
    }

    // Check word-by-word match if title has at least 2 significant words
    const tWords = cleanT.split(" ").filter((w) => w.length > 2);
    if (tWords.length >= 2) {
      const allWordsInQuery = tWords.every((w) => cleanQ.includes(w));
      if (allWordsInQuery) {
        matched.push(group);
      }
    }
  }

  return {
    matchedTopics: matched,
    hasExactTitleMatch: matched.length > 0,
    extractedTitle: matched[0]?.title,
  };
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
        const cleaned = sanitizeSessionMessages(parsed);
        localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(cleaned));
        const savedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE);
        const activeExists = cleaned.some((s) => s.id === savedActiveId);
        return {
          sessions: cleaned,
          activeId: activeExists ? (savedActiveId as string) : (cleaned[0]?.id ?? "chat_default"),
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
          messages:
            sanitizeSessionMessages([
              { id: "", title: "", createdAt: 0, updatedAt: 0, messages: parsedLegacy },
            ])[0]?.messages ?? parsedLegacy,
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
  "Bhai mere recent trades audit karo aur mistakes batao",
  "Mere diary ke chart screenshots aur thoughts audit karo",
  "Reflect on my latest diary thoughts & trading mindset",
  "Generate a PDF audit of my last 4 trades",
  "FOMO me entry ho rahi hai, kaise control karu?",
  "Did my thoughts or emotions in my diary affect my recent trades?",
  "When is the next FOMC meeting?",
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
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
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
    if (seg.startsWith("`") && seg.endsWith("`") && seg.length >= 2) {
      return (
        <code
          key={i}
          className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-primary font-medium"
        >
          {seg.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{seg}</span>;
  });
}

function FormattedMessage({
  content,
  isUser,
  onOpenLightbox,
}: {
  content: string;
  isUser: boolean;
  onOpenLightbox?: (url: string, title?: string) => void;
}) {
  if (isUser) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  const lines = content.split("\n");
  return (
    <div className="space-y-2 leading-relaxed text-sm">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Markdown educational diagrams: ![alt](/diagrams/... or https://...)
        const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
        if (imageMatch) {
          const alt = imageMatch[1] || "Trading Logic Diagram";
          const src = imageMatch[2] || "";
          return (
            <div
              key={idx}
              className="my-3 rounded-2xl border border-primary/30 bg-surface-1/90 overflow-hidden shadow-sm hover:border-primary/50 transition-all"
            >
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/40 bg-surface-2/60">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">{alt}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                    Trading Logic Visual
                  </span>
                </div>
                {onOpenLightbox ? (
                  <button
                    type="button"
                    onClick={() => onOpenLightbox(src, alt)}
                    className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-medium"
                  >
                    <Maximize2 className="size-3" />
                    <span>Zoom</span>
                  </button>
                ) : null}
              </div>
              <div
                className="p-3 bg-surface-3/30 flex items-center justify-center cursor-pointer hover:bg-surface-3/50 transition-colors"
                onClick={() => onOpenLightbox?.(src, alt)}
                title="Click to view full size"
              >
                <img
                  src={src}
                  alt={alt}
                  className="max-h-72 w-auto object-contain rounded-lg shadow-xs hover:scale-[1.01] transition-transform"
                />
              </div>
            </div>
          );
        }

        // Markdown headings (#, ##, ###)
        if (trimmed.startsWith("### ")) {
          return (
            <h4
              key={idx}
              className="font-bold text-sm sm:text-base text-foreground mt-3 mb-1 tracking-tight flex items-center gap-1.5"
            >
              <span className="size-1.5 rounded-full bg-primary" />
              <span>{parseInlineMarkdown(trimmed.slice(4))}</span>
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3
              key={idx}
              className="font-bold text-base sm:text-lg text-foreground mt-3.5 mb-1.5 tracking-tight border-b border-border/40 pb-1"
            >
              {parseInlineMarkdown(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2
              key={idx}
              className="font-extrabold text-lg sm:text-xl text-foreground mt-4 mb-2 tracking-tight"
            >
              {parseInlineMarkdown(trimmed.slice(2))}
            </h2>
          );
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
            <div key={idx} className="flex items-start gap-2.5 pl-1">
              <span className="size-1.5 rounded-full bg-primary/70 shrink-0 mt-2" />
              <div className="flex-1">{parts}</div>
            </div>
          );
        }

        if (isNumbered) {
          const numberMatch = trimmed.match(/^(\d+)\.\s/);
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1">
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
  const { trades, rules, diaryEntries } = useJournal();
  const search = Route.useSearch();
  // AI Coach TanStack Server Function
  const callCoach = useServerFn(askCoach);

  const allTopicGroups = useMemo(() => groupDiaryEntriesIntoTopics(diaryEntries), [diaryEntries]);
  const [attachedTopic, setAttachedTopic] = useState<TopicGroup | null>(null);
  const [isDraggingOverChat, setIsDraggingOverChat] = useState(false);
  const [topicSearchQuery, setTopicSearchQuery] = useState("");

  const [data] = useState(loadInitialData);
  const [sessions, setSessions] = useState<ChatSession[]>(data.sessions);
  const [activeId, setActiveId] = useState<string>(data.activeId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Chat title editing state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Lightbox zoom preview modal state
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title?: string | undefined } | null>(null);

  // Journal screenshot picker modal state
  const [showJournalPicker, setShowJournalPicker] = useState(false);
  const [journalPickerTab, setJournalPickerTab] = useState<"topics" | "diary" | "trades">("topics");

  // Attached screenshots state for direct upload or clipboard paste (Ctrl + V)
  type ChatImageAttachment = {
    id: string;
    url: string;
    name?: string;
  };
  const [attachedChatImages, setAttachedChatImages] = useState<ChatImageAttachment[]>([]);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // Auto-attach topic if opened from Diary table of contents ("Ask AI" button or search param)
  useEffect(() => {
    if (search.topicKey) {
      const found = allTopicGroups.find((g) => g.topicKey === search.topicKey);
      if (found) {
        setAttachedTopic(found);
        toast.info(`Topic "${found.title}" attached from Diary`);
      }
    } else if (search.topicTitle) {
      const cleanTarget = cleanForComparison(search.topicTitle);
      const found = allTopicGroups.find((g) => cleanForComparison(g.title) === cleanTarget);
      if (found) {
        setAttachedTopic(found);
        toast.info(`Topic "${found.title}" attached from Diary`);
      }
    }
  }, [search.topicKey, search.topicTitle, allTopicGroups]);

  const handleAttachJournalScreenshot = async (rawUrl: string, caption?: string) => {
    try {
      const resolved = await resolveChartUrls([rawUrl]);
      const finalUrl = resolved[rawUrl] || rawUrl;
      setAttachedChatImages((prev) => [
        ...prev,
        {
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          url: finalUrl,
          name: caption || "Journal Chart",
        },
      ]);
      setShowJournalPicker(false);
      toast.success("Screenshot attached to chat!");
    } catch (e) {
      console.error("Failed to attach journal screenshot:", e);
      toast.error("Could not attach screenshot");
    }
  };

  const compressImageIfNeeded = (dataUrl: string, maxDim = 1280, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl.startsWith("data:image/")) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim && dataUrl.length < 500000) {
          resolve(dataUrl);
          return;
        }
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleAttachFile = async (file: File) => {
    const error = validateChartFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      const compressed = await compressImageIfNeeded(raw);
      setAttachedChatImages((prev) => [
        ...prev,
        {
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          url: compressed,
          name: file.name,
        },
      ]);
      toast.success("Chart screenshot attached to chat!");
    };
    reader.readAsDataURL(file);
  };

  const handlePasteInChat = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await handleAttachFile(file);
        }
      }
    }
  };

  const handleDragOverChat = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOverChat) {
      setIsDraggingOverChat(true);
    }
  };

  const handleDragLeaveChat = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOverChat(false);
  };

  const handleDropOnChat = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverChat(false);

    // 1. Check for Diary Topic key or title in drag data
    const topicKey = e.dataTransfer.getData("application/x-diary-topic-key");
    const topicTitle = e.dataTransfer.getData("application/x-diary-topic-title");

    if (topicKey) {
      const found = allTopicGroups.find((g) => g.topicKey === topicKey);
      if (found) {
        setAttachedTopic(found);
        toast.success(`Attached Topic: "${found.title}"`);
        return;
      }
    }

    if (topicTitle) {
      const cleanTitle = cleanForComparison(topicTitle);
      const found = allTopicGroups.find((g) => cleanForComparison(g.title) === cleanTitle);
      if (found) {
        setAttachedTopic(found);
        toast.success(`Attached Topic: "${found.title}"`);
        return;
      }
    }

    // 2. Check for image files dropped (charts / screenshots)
    const files = Array.from(e.dataTransfer.files || []);
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length > 0) {
      for (const file of imageFiles) {
        await handleAttachFile(file);
      }
      return;
    }

    // 3. Fallback: Check plain text for diary topic format
    const plainText = e.dataTransfer.getData("text/plain");
    if (plainText) {
      const match = plainText.match(/Diary Topic:\s*"([^"]+)"/i);
      if (match && match[1]) {
        const cleanT = cleanForComparison(match[1]);
        const found = allTopicGroups.find((g) => cleanForComparison(g.title) === cleanT);
        if (found) {
          setAttachedTopic(found);
          toast.success(`Attached Topic: "${found.title}"`);
          return;
        }
      }
    }
  };

  const activeSession = sessions.find((s) => s.id === activeId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [WELCOME_MSG];

  // Collect all known chart paths from session messages, diary entries, trades, and chat attachments
  const allKnownImagePaths = useMemo(() => {
    const paths: string[] = [];
    if (activeSession) {
      for (const m of activeSession.messages) {
        if (m.images) {
          for (const img of m.images) {
            if (img.url) paths.push(img.url);
          }
        }
      }
    }
    for (const entry of diaryEntries) {
      if (entry.screenshots) {
        for (const sc of entry.screenshots) {
          if (sc.url) paths.push(sc.url);
        }
      }
    }
    for (const t of trades) {
      if (t.charts) {
        for (const c of t.charts) {
          if (c) paths.push(c);
        }
      }
    }
    for (const img of attachedChatImages) {
      if (img.url) paths.push(img.url);
    }
    return Array.from(new Set(paths));
  }, [activeSession, diaryEntries, trades, attachedChatImages]);

  const signedImageMap = useSignedChartUrls(allKnownImagePaths);

  // Clean up any remaining legacy auto-attached screenshots from user messages on mount
  useEffect(() => {
    setSessions((prev) => sanitizeSessionMessages(prev));

    try {
      const raw = sessionStorage.getItem("coach_prefilled_screenshot");
      if (raw) {
        sessionStorage.removeItem("coach_prefilled_screenshot");
        const data = JSON.parse(raw);
        if (data.url) {
          setAttachedChatImages((prev) => [
            ...prev,
            {
              id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              url: data.url,
              name: data.name || "Footprint Chart",
            },
          ]);
          toast.info("Attached Live Footprint chart to AI Coach!");
        }
      }
    } catch {}
  }, []);

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

  // Auto-adjust scroll position when zooming in, zooming out, or resizing
  useEffect(() => {
    const handleResize = () => {
      if (scrollRef.current) {
        const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 250;
        if (isNearBottom) {
          scrollRef.current.scrollTo({ top: scrollHeight, behavior: "instant" });
        }
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  const isTradeOrDiaryAudit = (query: string): boolean => {
    if (!query) return false;
    const q = query.toLowerCase();
    return (
      /\b(trade|trades|trading|journal|audit|pnl|p&l|profit|loss|winrate|win rate|drawdown|balance|execution|orders?)\b/i.test(q) ||
      /\b(diary|dairy|thought|thoughts|mindset|psychology|reflect|reflection|written|wrote|note|notes|highlight)\b/i.test(q) ||
      /\b(fomo|revenge|discipline|mistake|mistakes|rule|rules|overtrading|greed|fear)\b/i.test(q) ||
      /\b(sl|tp|stop\s*loss|take\s*profit|rr|risk\s*reward|leverage|position\s*size)\b/i.test(q) ||
      /\b(pdf|report|export|download)\b/i.test(q) ||
      /\b(last\s+\d+|recent\s+\d+|previous\s+\d+|latest\s+trade|my\s+last)\b/i.test(q) ||
      /\b(mere\s+trades?|meri\s+trading|mera\s+loss|mera\s+profit|meri\s+mistake|meri\s+diary|maine\s+kya\s+likha)\b/i.test(q)
    );
  };

  const buildSummary = (query: string) => {
    const s = stats(trades);
    const isAudit = isTradeOrDiaryAudit(query);
    const now = new Date();
    const liveDateStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const liveTimeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    // Fast compact profile for general chat (avoids token bloat, delivers sub-5s response)
    if (!isAudit) {
      return [
        `CURRENT SYSTEM LIVE DATE: ${liveDateStr} (${liveTimeStr})`,
        `Trader Quick Profile: ${s.count} total trades logged, net ${signedMoney(s.total)}, win rate ${s.winRate.toFixed(1)}% (${s.wins}W/${s.losses}L).`,
        `Active Rules: ${rules.length > 0 ? rules.map((r) => r.text).join(" | ") : "No rules logged yet"}`,
      ].join("\n");
    }

    // Full comprehensive data for in-depth trade & diary analysis
    const sortedTrades = sortByDate(trades).reverse();
    const recent = sortedTrades.slice(0, 20);
    const reversedEntries = [...diaryEntries].reverse();

    return [
      `CURRENT SYSTEM LIVE DATE: ${liveDateStr} (${liveTimeStr})`,
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
      "",
      "DIARY TOPICS INDEX (Table of Contents - all topics recorded in trader's diary):",
      ...(allTopicGroups.length > 0
        ? allTopicGroups.map((tg, idx) => {
            const scList = tg.pages
              .flatMap((p) => p.screenshots || [])
              .map((sc, i) => `#${i + 1} "${sc.caption || "Chart"}"`);
            const scInfo = scList.length > 0 ? ` | Charts: ${scList.join(", ")}` : " | No charts attached";
            return `- Topic #${idx + 1}: "${tg.title}" | Date: ${tg.date} (${tg.day}) | Session: ${tg.session || "N/A"} | Mood: ${tg.mood || "N/A"} | ${tg.pages.length} page(s)${scInfo}`;
          })
        : ["No topics logged in diary yet."]),
      "",
      "TRADER DIARY & THOUGHT LOGS (All written thoughts by trader, newest first):",
      ...(reversedEntries.length > 0
        ? reversedEntries.slice(0, 20).map((entry, idx) => {
            const moodStr = entry.mood ? ` | Mood: ${entry.mood}` : "";
            const sessStr = entry.session ? ` | Session: ${entry.session}` : "";
            const titleStr = entry.title ? ` - "${entry.title}"` : "";
            const cleanThoughts = entry.content
              .replace(
                /<span style="[^"]*background-color:[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
                "⭐ [Trader Highlighted: $1] ⭐",
              )
              .replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, "⭐ [Trader Highlighted: $1] ⭐")
              .replace(/<br\s*\/?>/gi, "\n")
              .replace(/<\/div>/gi, "\n")
              .replace(/<\/p>/gi, "\n")
              .replace(/<[^>]+>/g, "")
              .trim();
            const scStr =
              entry.screenshots && entry.screenshots.length > 0
                ? `Attached Charts/Screenshots: ${entry.screenshots.map((s, i) => `#${i + 1} "${s.caption || "Chart"}"`).join(", ")}`
                : "";
            return [
              `[Diary Page #${idx + 1} | Day: ${entry.day} | Date: ${entry.date}${moodStr}${sessStr}${titleStr}]`,
              ...(scStr ? [scStr] : []),
              `THOUGHTS & RECORD:`,
              cleanThoughts || "Empty thoughts on this page.",
            ].join("\n");
          })
        : ["No diary thoughts recorded yet."]),
    ].join("\n");
  };

  const send = async (text: string) => {
    const rawQuestion = text.trim();
    const hasPastedImages = attachedChatImages.length > 0;
    if ((!rawQuestion && !hasPastedImages && !attachedTopic) || loading || !activeSession) return;

    const question =
      rawQuestion ||
      (attachedTopic
        ? `Please audit my attached diary topic "${attachedTopic.title}" (${attachedTopic.day}, ${formatDisplayDate(attachedTopic.date)})`
        : hasPastedImages
        ? "Please analyze this attached chart screenshot."
        : "");
    const isAudit = isTradeOrDiaryAudit(question);

    const targetSessionId = activeSession.id;
    const isFirstUserMsg =
      activeSession.messages.filter((m) => m.role === "user").length === 0;
    const newTitle =
      isFirstUserMsg || activeSession.title === "New Chat"
        ? question.length > 28
          ? question.slice(0, 28) + "…"
          : question
        : activeSession.title;

    const history = activeSession.messages.slice(1).slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const currentChatImages = [...attachedChatImages];
    const currentAttachedTopic = attachedTopic;
    setAttachedChatImages([]);
    setInput("");
    setLoading(true);

    // 1. Check if a topic was specified by key in the actionText (e.g. "key: ...")
    let targetTopic: TopicGroup | null = currentAttachedTopic;
    let isDisambiguationRequired = false;
    let disambiguationOptions: Array<{ label: string; actionText: string }> = [];
    let disambiguationPrompt = "";

    const keyMatch = question.match(/key:\s*([^\s)]+)/i);
    if (!targetTopic && keyMatch && keyMatch[1]) {
      const matchedByKey = allTopicGroups.find((g) => g.topicKey === keyMatch[1]);
      if (matchedByKey) {
        targetTopic = matchedByKey;
      }
    }

    // 2. If no topic attached or matched by key, search in allTopicGroups
    if (!targetTopic) {
      const topicMatchResult = findMatchingDiaryTopics(question, allTopicGroups);
      if (topicMatchResult.hasExactTitleMatch && topicMatchResult.matchedTopics.length > 0) {
        const matchingTopics = topicMatchResult.matchedTopics;

        if (matchingTopics.length === 1) {
          targetTopic = matchingTopics[0] ?? null;
        } else {
          // Multiple topics match the title!
          // Check if user specified a date in their prompt
          const dateFiltered = matchingTopics.filter((t) => matchesDateInQuery(t.date, question));
          if (dateFiltered.length === 1) {
            targetTopic = dateFiltered[0] ?? null;
          } else if (dateFiltered.length > 1) {
            // Same date, multiple records/sessions!
            isDisambiguationRequired = true;
            const theDate = dateFiltered[0]?.date ?? "";
            disambiguationPrompt = `Bhai, **${formatDisplayDate(theDate)}** ko **"${topicMatchResult.extractedTitle || dateFiltered[0]?.title}"** title ke multiple records/sessions mile hain. Tumhe konsa wala chahiye?`;
            disambiguationOptions = dateFiltered.map((t, idx) => ({
              label: `🕒 ${t.session || `Session #${idx + 1}`} (${t.pages.length} pages · ${t.pages.flatMap((p) => p.screenshots || []).length} screenshots)`,
              actionText: `Topic "${t.title}" on ${t.date} (${t.session || `Session #${idx + 1}`} · key: ${t.topicKey})`,
            }));
          } else {
            // Check if topics are on different dates or same date
            const uniqueDates = Array.from(new Set(matchingTopics.map((t) => t.date)));
            if (uniqueDates.length > 1) {
              // Different dates
              isDisambiguationRequired = true;
              disambiguationPrompt = `Bhai, tumhari diary mein **"${topicMatchResult.extractedTitle || matchingTopics[0]?.title}"** title ke multiple dates par topics mile hain. Tumhe kis date ka topic analyze / dekhna hai?`;
              disambiguationOptions = matchingTopics.map((t) => ({
                label: `📅 ${t.day}, ${formatDisplayDate(t.date)} (${t.session || "Session"} · ${t.pages.flatMap((p) => p.screenshots || []).length} screenshots)`,
                actionText: `Topic "${t.title}" on ${t.date} (${t.session || "Session"} · key: ${t.topicKey})`,
              }));
            } else {
              // Same date, multiple records
              isDisambiguationRequired = true;
              const theDate = matchingTopics[0]?.date ?? "";
              disambiguationPrompt = `Bhai, **${formatDisplayDate(theDate)}** ko **"${topicMatchResult.extractedTitle || matchingTopics[0]?.title}"** title ke multiple records/sessions mile hain. Tumhe konsa wala chahiye?`;
              disambiguationOptions = matchingTopics.map((t, idx) => ({
                label: `🕒 ${t.session || `Session #${idx + 1}`} (${t.pages.length} pages · ${t.pages.flatMap((p) => p.screenshots || []).length} screenshots)`,
                actionText: `Topic "${t.title}" on ${t.date} (${t.session || `Session #${idx + 1}`} · key: ${t.topicKey})`,
              }));
            }
          }
        }
      }
    }

    // IF DISAMBIGUATION IS REQUIRED: Ask user immediately without guessing!
    if (isDisambiguationRequired) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                title: newTitle,
                messages: [
                  ...s.messages,
                  { role: "user", content: question },
                  {
                    role: "assistant",
                    content: disambiguationPrompt,
                    options: disambiguationOptions,
                  },
                ],
                updatedAt: Date.now(),
              }
            : s,
        ),
      );
      setLoading(false);
      return;
    }

    // 3. User pasted/attached images in chat
    const chatImages = currentChatImages.map((img) => ({
      url: img.url,
      caption: img.name || "Attached Screenshot",
      source: "Chat attachment (Direct user upload/paste)",
    }));

    const userWantsToSeeScreenshots =
      /\b(dekhna|dekhne|dikhao|dikhaye|dekho|show|view|display|bhejo|lao)\b/i.test(question) &&
      /\b(screenshot|screenshots|chart|charts|photo|photos|image|images|pic|pics|ss)\b/i.test(question);

    const mentionsScreenshotsExplicitly =
      userWantsToSeeScreenshots ||
      /\b(screenshot|screenshots|chart|charts|photo|image|images|pic|pics|graph|ss)\b/i.test(question);

    let payloadImages: Array<{ url: string; caption?: string; source?: string }> = [];

    if (chatImages.length > 0) {
      payloadImages = chatImages;
    } else if (targetTopic) {
      // EXACT TOPIC MATCHED! Collect ONLY this topic's screenshots
      const topicScreenshots = targetTopic.pages
        .flatMap((p) => p.screenshots || [])
        .filter((sc) => !!sc.url);

      if (topicScreenshots.length > 0) {
        const rawPaths = topicScreenshots.map((sc) => sc.url);
        try {
          const resolvedMap = await resolveChartUrls(rawPaths);
          payloadImages = topicScreenshots.map((sc, i) => ({
            url: resolvedMap[sc.url] || signedImageMap[sc.url] || sc.url,
            caption: sc.caption || `Screenshot #${i + 1}`,
            source: `Diary Topic: "${targetTopic.title}" (${targetTopic.day}, ${targetTopic.date}${targetTopic.session ? ` - ${targetTopic.session}` : ""})`,
          }));
        } catch {
          payloadImages = topicScreenshots.map((sc, i) => ({
            url: signedImageMap[sc.url] || sc.url,
            caption: sc.caption || `Screenshot #${i + 1}`,
            source: `Diary Topic: "${targetTopic.title}" (${targetTopic.day}, ${targetTopic.date})`,
          }));
        }
      }
    } else if (mentionsScreenshotsExplicitly) {
      // General screenshot lookup (e.g. date-matched)
      const reversedEntries = [...diaryEntries].reverse();
      const dateMatchedDiary: Array<{ url: string; caption?: string; source: string }> = [];
      const dateMatchedTrades: Array<{ url: string; caption?: string; source: string }> = [];
      const otherDiary: Array<{ url: string; caption?: string; source: string }> = [];
      const otherTradeCharts: Array<{ url: string; caption?: string; source: string }> = [];

      for (const entry of reversedEntries) {
        if (entry.screenshots && entry.screenshots.length > 0) {
          const isDateMatch = matchesDateInQuery(entry.date, question);
          for (const sc of entry.screenshots) {
            if (sc.url) {
              const item = {
                url: sc.url,
                caption: sc.caption || "Diary chart",
                source: `Diary: "${entry.title || "Reflection"}" (${entry.day}, ${entry.date})`,
              };
              if (isDateMatch) {
                dateMatchedDiary.push(item);
              } else {
                otherDiary.push(item);
              }
            }
          }
        }
      }

      for (const t of trades) {
        if (t.charts && t.charts.length > 0) {
          const isDateMatch = matchesDateInQuery(t.date, question);
          t.charts.forEach((c, idx) => {
            if (c) {
              const item = {
                url: c,
                caption: `${t.symbol} Chart #${idx + 1}`,
                source: `Trade: ${t.symbol} (${formatDate(t.date)})`,
              };
              if (isDateMatch) {
                dateMatchedTrades.push(item);
              } else {
                otherTradeCharts.push(item);
              }
            }
          });
        }
      }

      const candidateImages: Array<{ url: string; caption?: string; source: string }> = [
        ...dateMatchedDiary,
        ...dateMatchedTrades,
        ...(dateMatchedDiary.length === 0 && dateMatchedTrades.length === 0
          ? [...otherDiary, ...otherTradeCharts]
          : []),
      ];

      const seen = new Set<string>();
      const uniqueCandidates = candidateImages.filter((item) => {
        if (!item.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      }).slice(0, 4);

      const rawPaths = uniqueCandidates.map((img) => img.url);
      try {
        const resolvedMap = await resolveChartUrls(rawPaths);
        payloadImages = uniqueCandidates.map((img) => ({
          url: resolvedMap[img.url] || signedImageMap[img.url] || img.url,
          ...(img.caption ? { caption: img.caption } : {}),
          ...(img.source ? { source: img.source } : {}),
        }));
      } catch {
        payloadImages = uniqueCandidates.map((img) => ({
          url: signedImageMap[img.url] || img.url,
          ...(img.caption ? { caption: img.caption } : {}),
          ...(img.source ? { source: img.source } : {}),
        }));
      }
    }

    // ONLY display images in the user's message bubble if the user EXPLICITLY attached or pasted them!
    const userMsgImages = currentChatImages.map((img) => ({
      url: img.url,
      caption: img.name || "Attached Screenshot",
      name: img.name || "Attached Screenshot",
    }));

    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? {
              ...s,
              title: newTitle,
              messages: [
                ...s.messages,
                {
                  role: "user",
                  content: question,
                  ...(userMsgImages.length > 0 ? { images: userMsgImages } : {}),
                },
              ],
              updatedAt: Date.now(),
            }
          : s,
      ),
    );

    try {
      const extraPromptInfo = targetTopic
        ? `\n\n[USER HAS ATTACHED / REFERENCED DIARY TOPIC]: "${targetTopic.title}" (Date: ${targetTopic.date}, Day: ${targetTopic.day}, Session: ${targetTopic.session || "N/A"}). This topic has ${targetTopic.pages.length} page(s) and ${payloadImages.length} attached chart screenshot(s). Focus your analysis or screenshot breakdown specifically on this topic!`
        : "";

      const res = await callCoach({
        data: {
          question: question + extraPromptInfo,
          tradeSummary: buildSummary(question),
          history,
          isGeneralChat: !isAudit && payloadImages.length === 0 && !targetTopic,
          images: payloadImages,
        },
      });

      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    role: "assistant",
                    content: res.text,
                    ...((userWantsToSeeScreenshots || Boolean(targetTopic)) && payloadImages.length > 0
                      ? { images: payloadImages }
                      : {}),
                  },
                ],
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
      fullHeight
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
      <Card className="relative flex flex-1 min-h-[440px] w-full flex-row gap-0 overflow-hidden p-0 border-border bg-card shadow-sm">
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
        <div
          onDragOver={handleDragOverChat}
          onDragLeave={handleDragLeaveChat}
          onDrop={handleDropOnChat}
          className="relative flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden bg-card/60"
        >
          {/* Drag & Drop Visual Overlay */}
          {isDraggingOverChat && (
            <div className="absolute inset-0 z-40 bg-background/85 backdrop-blur-sm border-2 border-dashed border-primary rounded-2xl flex flex-col items-center justify-center gap-3 p-6 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
              <div className="size-16 rounded-2xl bg-primary/15 border border-primary/30 text-primary grid place-items-center shadow-lg">
                <FolderOpen className="size-8" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-base font-bold text-foreground">Drop Diary Topic or Screenshot here</p>
                <p className="text-xs text-muted-foreground">Attach topic instantly to Coach Maverick for deep analysis</p>
              </div>
            </div>
          )}
          {/* Subheader: Sidebar Toggle + Horizontal Tabs Strip + Action Buttons */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 bg-surface-1/40 shrink-0">
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
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4 sm:p-6 [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.25)_transparent]"
          >
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
                      "flex gap-3 w-full",
                      m.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {isAssistant ? (
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary shadow-xs">
                        <Bot className="size-4" />
                      </span>
                    ) : null}
                    <div
                      className={cn(
                        "rounded-2xl px-4 sm:px-5 py-3 text-sm leading-relaxed shadow-xs transition-all",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground font-medium max-w-[85%] sm:max-w-[70%]"
                          : "bg-surface-2 text-foreground w-full max-w-[96%] lg:max-w-[92%] xl:max-w-[88%] border border-border/40",
                      )}
                    >
                      {/* Attached Screenshots Thumbnails */}
                      {m.images && m.images.length > 0 ? (
                        <div className="relative mb-2.5 flex flex-wrap gap-2 group/msgimgs">
                          {m.images.map((img, imgIdx) => {
                            const displaySrc = signedImageMap[img.url] || img.url;
                            return (
                              <div
                                key={imgIdx}
                                onClick={() =>
                                  setLightboxImage({
                                    url: displaySrc,
                                    title: img.caption || img.name || `Screenshot #${imgIdx + 1}`,
                                  })
                                }
                                className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/20 bg-black/40 shadow-xs hover:border-white/80 transition-all hover:scale-[1.03]"
                                title="Click to view full size"
                              >
                                <img
                                  src={displaySrc}
                                  alt={img.name || `Screenshot #${imgIdx + 1}`}
                                  className="size-20 sm:size-24 object-cover rounded-lg"
                                  onError={(e) => {
                                    if (img.url && e.currentTarget.src !== img.url) {
                                      e.currentTarget.src = img.url;
                                    }
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Eye className="size-4 text-white" />
                                </div>
                                <div className="absolute bottom-0 inset-x-0 bg-black/75 backdrop-blur-xs px-1 py-0.5 text-[9px] text-white font-medium truncate text-center">
                                  {img.caption || img.name || `#${imgIdx + 1}`}
                                </div>
                              </div>
                            );
                          })}
                          {m.role === "user" ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSessions((prev) =>
                                  prev.map((s) =>
                                    s.id === (activeSession?.id ?? "")
                                      ? {
                                          ...s,
                                          messages: s.messages.map((msg, msgIdx) =>
                                            msgIdx === i ? { ...msg, images: undefined } : msg,
                                          ),
                                          updatedAt: Date.now(),
                                        }
                                      : s,
                                  ),
                                );
                              }}
                              className="opacity-0 group-hover/msgimgs:opacity-100 transition-opacity absolute -top-2 -right-2 p-1 rounded-full bg-black/80 hover:bg-destructive text-white shadow-md"
                              title="Remove attached screenshots from this message"
                            >
                              <X className="size-3" />
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      <FormattedMessage
                        content={displayContent}
                        isUser={m.role === "user"}
                        onOpenLightbox={(url, title) => setLightboxImage({ url, title })}
                      />

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

                      {/* Interactive Disambiguation Options (e.g. choose between multiple dates or sessions) */}
                      {m.options && m.options.length > 0 ? (
                        <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap gap-2">
                          {m.options.map((opt, optIdx) => (
                            <Button
                              key={optIdx}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void send(opt.actionText)}
                              className="text-xs h-auto py-1.5 px-3 rounded-xl border-primary/30 hover:bg-primary/10 hover:border-primary/60 text-foreground transition-all shadow-2xs text-left whitespace-normal flex items-center gap-1.5"
                            >
                              <span>{opt.label}</span>
                            </Button>
                          ))}
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
          <div className="border-t border-border p-2.5 sm:p-3 shrink-0 bg-surface-1/30">
            {showSuggestions ? (
              <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
                <span className="shrink-0 text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1 pl-1">
                  <Sparkles className="size-3 text-primary shrink-0" />
                  <span>Prompts:</span>
                </span>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={loading}
                    onClick={() => void send(s)}
                    className="shrink-0 whitespace-nowrap rounded-full border border-border/80 bg-surface/60 hover:bg-surface px-2.5 py-1 text-[11px] text-muted-foreground transition-all hover:border-primary/50 hover:text-primary disabled:opacity-50 active:scale-95"
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowSuggestions(false)}
                  title="Hide quick prompts"
                  className="shrink-0 p-1 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-surface-2 transition-colors ml-1"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <div className="mb-1.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSuggestions(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 hover:text-primary transition-colors py-0.5 px-2 rounded-md hover:bg-surface/60"
                >
                  <Sparkles className="size-3 text-primary" />
                  <span>Show quick prompts</span>
                </button>
              </div>
            )}

            {/* Attached Diary Topic Pill Badge */}
            {attachedTopic && (
              <div className="mb-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-medium animate-in fade-in slide-in-from-bottom-1">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="truncate">
                    Attached Topic: <strong>&quot;{attachedTopic.title}&quot;</strong> ({attachedTopic.day}, {formatDisplayDate(attachedTopic.date)})
                    {attachedTopic.pages.flatMap((p) => p.screenshots || []).length > 0 && (
                      <span className="ml-1 opacity-80">
                        · {attachedTopic.pages.flatMap((p) => p.screenshots || []).length} charts
                      </span>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedTopic(null)}
                  className="p-1 rounded-full hover:bg-amber-500/20 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Remove attached topic"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {/* Attached Screenshots preview bar (Ctrl + V / file upload) */}
            {attachedChatImages.length > 0 ? (
              <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1">
                {attachedChatImages.map((img) => (
                  <div
                    key={img.id}
                    className="group relative flex items-center gap-1.5 rounded-xl border border-primary/40 bg-surface-2 p-1.5 pr-2.5 shadow-xs shrink-0"
                  >
                    <img
                      src={img.url}
                      alt="Attached chart"
                      className="size-8 rounded-lg object-cover border border-border"
                    />
                    <span className="max-w-[130px] truncate text-[11px] font-medium text-foreground">
                      {img.name || "Pasted Chart"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachedChatImages((prev) => prev.filter((p) => p.id !== img.id))
                      }
                      className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors ml-1"
                      title="Remove screenshot"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                <span className="text-[10px] text-muted-foreground shrink-0">
                  (Ready for visual analysis)
                </span>
              </div>
            ) : null}

            {/* Hidden File Input for Add Screenshot */}
            <input
              ref={chatFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleAttachFile(file);
                }
                e.target.value = "";
              }}
            />

            <form
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => chatFileInputRef.current?.click()}
                  title="Attach chart screenshot (or press Ctrl + V anywhere to paste)"
                  className="size-11 shrink-0 rounded-xl border-border bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-foreground shadow-xs transition-colors"
                >
                  <ImageIcon className="size-4.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowJournalPicker(true)}
                  title="Browse & attach screenshots from Diary & Trades"
                  className="size-11 shrink-0 rounded-xl border-border bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-primary shadow-xs transition-colors"
                >
                  <BookOpen className="size-4.5" />
                </Button>
              </div>

              <Textarea
                ref={inputRef}
                rows={2}
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePasteInChat}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Ask about trades, paste charts (Ctrl+V), or audit diary screenshots & thoughts…"
                className="min-h-[46px] max-h-32 resize-none text-xs sm:text-sm bg-surface-2/60 border-border/80 focus-visible:ring-primary/40 shadow-xs"
              />
              <Button
                type="submit"
                size="icon"
                className="size-11 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                disabled={loading || (!input.trim() && attachedChatImages.length === 0)}
              >
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </Card>

      {/* Fullscreen Lightbox Preview Modal */}
      {lightboxImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-[94vw] sm:max-w-4xl w-full rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-2xl flex flex-col items-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full pb-2 mb-2 border-b border-border/70">
              <span className="text-xs sm:text-sm font-semibold text-foreground truncate pr-2">
                {lightboxImage.title || "Screenshot Preview"}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="w-full flex-1 flex items-center justify-center overflow-auto max-h-[80vh] p-1">
              <img
                src={signedImageMap[lightboxImage.url] || lightboxImage.url}
                alt={lightboxImage.title || "Zoomed Screenshot"}
                className="max-h-full max-w-full object-contain rounded-lg"
                onError={(e) => {
                  if (lightboxImage.url && e.currentTarget.src !== lightboxImage.url) {
                    e.currentTarget.src = lightboxImage.url;
                  }
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Attach from Journal (Diary & Trades) Selector Modal */}
      {showJournalPicker ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowJournalPicker(false)}
        >
          <div
            className="relative max-h-[85vh] max-w-2xl w-full rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                <h3 className="font-semibold text-sm sm:text-base text-foreground">
                  Attach Screenshots from Journal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowJournalPicker(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Selector Tabs */}
            <div className="flex items-center gap-2 pt-3 pb-2">
              <Button
                type="button"
                size="sm"
                variant={journalPickerTab === "topics" ? "default" : "outline"}
                onClick={() => setJournalPickerTab("topics")}
                className="text-xs rounded-lg h-8 gap-1.5"
              >
                <BookMarked className="size-3.5" />
                <span>Diary Topics ({allTopicGroups.length})</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={journalPickerTab === "diary" ? "default" : "outline"}
                onClick={() => setJournalPickerTab("diary")}
                className="text-xs rounded-lg h-8"
              >
                All Screenshots
              </Button>
              <Button
                type="button"
                size="sm"
                variant={journalPickerTab === "trades" ? "default" : "outline"}
                onClick={() => setJournalPickerTab("trades")}
                className="text-xs rounded-lg h-8"
              >
                Trade Charts
              </Button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1 max-h-[55vh]">
              {journalPickerTab === "topics" ? (
                (() => {
                  const queryClean = cleanForComparison(topicSearchQuery);
                  const filtered = allTopicGroups.filter((tg) => {
                    if (!queryClean) return true;
                    return (
                      cleanForComparison(tg.title).includes(queryClean) ||
                      tg.date.includes(queryClean) ||
                      (tg.session && cleanForComparison(tg.session).includes(queryClean)) ||
                      cleanForComparison(tg.day).includes(queryClean)
                    );
                  });

                  return (
                    <div className="space-y-3">
                      {/* Search Bar */}
                      <input
                        type="text"
                        value={topicSearchQuery}
                        onChange={(e) => setTopicSearchQuery(e.target.value)}
                        placeholder="Search diary topics by title or date..."
                        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />

                      {filtered.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-xs">
                          No diary topics matched your search.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2.5">
                          {filtered.map((tg) => {
                            const scCount = tg.pages.flatMap((p) => p.screenshots || []).length;
                            const firstPageText = tg.pages[0]?.content
                              ? tg.pages[0].content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)
                              : "";

                            return (
                              <div
                                key={tg.topicKey}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-surface-1 hover:border-primary/50 transition-colors"
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                                      {tg.day}, {formatDisplayDate(tg.date)}
                                    </span>
                                    {tg.session && (
                                      <span className="px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground">
                                        {tg.session}
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                      {tg.pages.length} page{tg.pages.length > 1 ? "s" : ""}
                                    </span>
                                    {scCount > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                                        📷 {scCount} screenshot{scCount > 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                                    {tg.title}
                                  </p>
                                  {firstPageText && (
                                    <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                                      &quot;{firstPageText}…&quot;
                                    </p>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    setAttachedTopic(tg);
                                    setShowJournalPicker(false);
                                    toast.success(`Attached Topic: "${tg.title}"`);
                                  }}
                                  className="h-8 text-xs rounded-xl shrink-0 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                  <BookOpen className="size-3.5" />
                                  <span>Attach Topic</span>
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : journalPickerTab === "diary" ? (
                (() => {
                  const items: Array<{ url: string; caption?: string | undefined; title: string; date: string }> = [];
                  for (const entry of diaryEntries) {
                    if (entry.screenshots && entry.screenshots.length > 0) {
                      for (const sc of entry.screenshots) {
                        if (sc.url) {
                          items.push({
                            url: sc.url,
                            caption: sc.caption,
                            title: entry.title || "Diary Page",
                            date: `${entry.day}, ${entry.date}`,
                          });
                        }
                      }
                    }
                  }
                  if (items.length === 0) {
                    return (
                      <div className="text-center py-10 text-muted-foreground text-xs">
                        No diary screenshots found yet. Add screenshots in your Trader Diary first!
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-surface-1 hover:border-primary/50 transition-colors"
                        >
                          <img
                            src={signedImageMap[item.url] || item.url}
                            alt="Screenshot"
                            className="size-14 rounded-lg object-cover shrink-0 border border-border"
                            onError={(e) => {
                              if (item.url && e.currentTarget.src !== item.url) {
                                e.currentTarget.src = item.url;
                              }
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {item.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {item.date}
                            </p>
                            {item.caption ? (
                              <p className="text-[10px] text-primary/80 truncate italic">
                                &quot;{item.caption}&quot;
                              </p>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleAttachJournalScreenshot(item.url, item.caption || item.title)}
                            className="h-7 text-[11px] rounded-lg shrink-0 px-2.5"
                          >
                            Attach
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const items: Array<{ url: string; symbol: string; direction: string; date: string }> = [];
                  for (const t of trades) {
                    if (t.charts && t.charts.length > 0) {
                      for (const c of t.charts) {
                        if (c) {
                          items.push({
                            url: c,
                            symbol: t.symbol,
                            direction: t.direction,
                            date: formatDate(t.date),
                          });
                        }
                      }
                    }
                  }
                  if (items.length === 0) {
                    return (
                      <div className="text-center py-10 text-muted-foreground text-xs">
                        No trade charts found yet. Attach charts when logging your trades!
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-surface-1 hover:border-primary/50 transition-colors"
                        >
                          <img
                            src={signedImageMap[item.url] || item.url}
                            alt="Chart"
                            className="size-14 rounded-lg object-cover shrink-0 border border-border"
                            onError={(e) => {
                              if (item.url && e.currentTarget.src !== item.url) {
                                e.currentTarget.src = item.url;
                              }
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {item.symbol} {item.direction.toUpperCase()}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {item.date}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleAttachJournalScreenshot(item.url, `${item.symbol} ${item.direction}`)}
                            className="h-7 text-[11px] rounded-lg shrink-0 px-2.5"
                          >
                            Attach
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
