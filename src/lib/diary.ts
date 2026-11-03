export type DiaryMood =
  | "Disciplined"
  | "Calm"
  | "Focused"
  | "FOMO"
  | "Anxious"
  | "Greedy"
  | "Frustrated"
  | "Confident"
  | "Reflective"
  | "Fatigued";

export type DiarySession =
  | "Pre-Market"
  | "Live Trading"
  | "Post-Market"
  | "Weekend Review"
  | "Weekly Planning"
  | "General Thoughts";

export interface DiaryScreenshot {
  id: string;
  url: string; // Storage path or base64 Data URL
  caption?: string | undefined;
  createdAt: string;
}

export interface DiaryEntry {
  id: string;
  date: string; // "YYYY-MM-DD" e.g. "2026-11-02"
  day: string; // e.g. "Monday"
  title: string; // e.g. "Pre-FOMC Mindset & Risk Discipline"
  content: string; // Raw journal thoughts
  mood?: DiaryMood | undefined;
  session?: DiarySession | undefined;
  tags?: string[] | undefined;
  screenshots?: DiaryScreenshot[] | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface TopicGroup {
  topicKey: string;
  title: string;
  day: string;
  date: string;
  session?: DiarySession | undefined;
  mood?: DiaryMood | undefined;
  pages: DiaryEntry[];
}

/**
 * Groups diary entries into distinct topics:
 * Entries with the same title and the same day are grouped into continuous pages of the same topic.
 * If either the title or the day is different, they are presented as separate topics.
 */
export function groupDiaryEntriesIntoTopics(entries: DiaryEntry[]): TopicGroup[] {
  const groups: TopicGroup[] = [];
  const keyMap = new Map<string, TopicGroup>();

  for (const entry of entries) {
    const normTitle = (entry.title || "").trim().toLowerCase();
    const normDay = (entry.day || "").trim().toLowerCase();
    const key = `${normDay}__${normTitle || "untitled"}`;

    const existing = keyMap.get(key);
    if (existing) {
      existing.pages.push(entry);
    } else {
      const newGroup: TopicGroup = {
        topicKey: key,
        title: entry.title?.trim() || "Untitled Reflection",
        day: entry.day,
        date: entry.date,
        session: entry.session,
        mood: entry.mood,
        pages: [entry],
      };
      keyMap.set(key, newGroup);
      groups.push(newGroup);
    }
  }

  // Sort pages inside each topic chronologically (earliest page first = Page 1)
  for (const group of groups) {
    group.pages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  return groups;
}

export const DIARY_MOODS: { label: DiaryMood; emoji: string; color: string }[] = [
  { label: "Disciplined", emoji: "🛡️", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" },
  { label: "Calm", emoji: "🧘", color: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
  { label: "Focused", emoji: "🎯", color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30" },
  { label: "Confident", emoji: "⚡", color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  { label: "Reflective", emoji: "📖", color: "text-purple-500 bg-purple-500/10 border-purple-500/30" },
  { label: "FOMO", emoji: "🌪️", color: "text-orange-500 bg-orange-500/10 border-orange-500/30" },
  { label: "Anxious", emoji: "😰", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30" },
  { label: "Frustrated", emoji: "😤", color: "text-rose-500 bg-rose-500/10 border-rose-500/30" },
  { label: "Greedy", emoji: "🤑", color: "text-red-500 bg-red-500/10 border-red-500/30" },
  { label: "Fatigued", emoji: "💤", color: "text-stone-500 bg-stone-500/10 border-stone-500/30" },
];

export const DIARY_SESSIONS: { label: DiarySession; icon: string }[] = [
  { label: "Pre-Market", icon: "🌅" },
  { label: "Live Trading", icon: "📈" },
  { label: "Post-Market", icon: "🏁" },
  { label: "Weekend Review", icon: "☕" },
  { label: "Weekly Planning", icon: "🗓️" },
  { label: "General Thoughts", icon: "💭" },
];

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDayNameFromDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "Monday";
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", { weekday: "long" });
  } catch {
    return "Monday";
  }
}

export function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function stripDiaryHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<\/div>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export interface HighlighterColor {
  id: string;
  label: string;
  bgHex: string;
  textHex: string;
  badgeBg: string;
  emoji: string;
}

export const DIARY_HIGHLIGHTERS: HighlighterColor[] = [
  {
    id: "yellow",
    label: "Neon Yellow",
    bgHex: "#fef08a",
    textHex: "#1c1917",
    badgeBg: "bg-yellow-200/90 text-stone-900 border-yellow-400/80 hover:bg-yellow-200",
    emoji: "🟡",
  },
  {
    id: "green",
    label: "Mint Green",
    bgHex: "#bbf7d0",
    textHex: "#14532d",
    badgeBg: "bg-emerald-200/90 text-emerald-950 border-emerald-400/80 hover:bg-emerald-200",
    emoji: "🟢",
  },
  {
    id: "pink",
    label: "Rose Pink",
    bgHex: "#fbcfe8",
    textHex: "#831843",
    badgeBg: "bg-pink-200/90 text-pink-950 border-pink-400/80 hover:bg-pink-200",
    emoji: "🌸",
  },
  {
    id: "blue",
    label: "Sky Blue",
    bgHex: "#bae6fd",
    textHex: "#0c4a6e",
    badgeBg: "bg-sky-200/90 text-sky-950 border-sky-400/80 hover:bg-sky-200",
    emoji: "💧",
  },
  {
    id: "orange",
    label: "Peach Orange",
    bgHex: "#fed7aa",
    textHex: "#7c2d12",
    badgeBg: "bg-orange-200/90 text-orange-950 border-orange-400/80 hover:bg-orange-200",
    emoji: "🍊",
  },
  {
    id: "purple",
    label: "Lavender Lilac",
    bgHex: "#e9d5ff",
    textHex: "#581c87",
    badgeBg: "bg-purple-200/90 text-purple-950 border-purple-400/80 hover:bg-purple-200",
    emoji: "💜",
  },
];

export const DEFAULT_DIARY_ENTRIES: DiaryEntry[] = [
  {
    id: "diary_starter_001",
    date: "2026-11-02",
    day: "Monday",
    title: "Fresh Week Mindset & Risk Discipline",
    content:
      "Starting the trading week with complete emotional equilibrium. The market doesn't owe me anything today—my sole objective is to protect capital, execute only A+ setups according to my checklist, and let the edge work.\n\nKey rules for today:\n1. No trading during the first 15 minutes of the open; wait for the initial balance to establish.\n2. Strict 1% risk per trade limit. Absolutely no moving stop losses.\n3. If I take two consecutive stop-outs, mandatory 45-minute step away from the screens.\n\nMarket Context:\nFOMC rate decision fallout and upcoming macro prints require patience. Beware of low liquidity chop and fake-out breakouts.",
    mood: "Disciplined",
    session: "Pre-Market",
    tags: ["Risk Management", "Mindset", "Weekly Plan"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

