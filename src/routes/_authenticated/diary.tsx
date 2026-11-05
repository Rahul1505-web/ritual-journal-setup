import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Feather,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
  Bot,
  ExternalLink,
  Bookmark,
  ArrowRight,
  ListOrdered,
  BookMarked,
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  Maximize2,
  Paperclip,
  Highlighter,
  Eraser,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DAYS_OF_WEEK,
  DIARY_HIGHLIGHTERS,
  DIARY_MOODS,
  DIARY_SESSIONS,
  formatDisplayDate,
  getDayNameFromDate,
  getTodayDateString,
  groupDiaryEntriesIntoTopics,
  stripDiaryHtml,
  type DiaryEntry,
  type DiaryMood,
  type DiaryScreenshot,
  type DiarySession,
  type TopicGroup,
  type HighlighterColor,
} from "@/lib/diary";
import { askCoach } from "@/lib/coach.functions";
import { useJournal } from "@/lib/journal-store";
import { uploadChart, validateChartFile, useSignedChartUrls } from "@/lib/trade-charts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/diary")({
  head: () => ({
    meta: [
      { title: "Trader Diary & Thought Journal — TradeLog Pro" },
      {
        name: "description",
        content: "Write and record your daily trading thoughts, emotional state and psychology in a realistic personal diary that AI can read entirely.",
      },
      { property: "og:title", content: "Trader Diary & Thought Journal — TradeLog Pro" },
      {
        property: "og:description",
        content: "Write your raw thoughts and record your mindset. AI reads your entire diary to mentor your discipline.",
      },
    ],
  }),
  component: DiaryPage,
});

function DiaryPage() {
  const {
    diaryEntries,
    addDiaryEntry,
    updateDiaryEntry,
    deleteDiaryEntry,
    trades,
    rules,
    accounts,
    activeAccountId,
  } = useJournal();
  const callCoach = useServerFn(askCoach);

  const currentAccount = accounts.find((a) => a.id === activeAccountId);

  // Filter entries according to active account:
  // If "all", show all entries across all accounts.
  // If specific account, show only that account's entries (or default to primary account if unassigned).
  const displayedDiaryEntries = useMemo(() => {
    if (activeAccountId === "all") return diaryEntries;
    const defaultAccId = accounts[0]?.id ?? "acc_main";
    return diaryEntries.filter((d) => (d.accountId ?? defaultAccId) === activeAccountId);
  }, [diaryEntries, activeAccountId, accounts]);

  // View mode: starts on "topics" (Table of Contents / Topic Page) when opening the diary
  const [viewMode, setViewMode] = useState<"topics" | "entry">("topics");

  // Active entry state
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Form fields for active diary page
  const [entryAccountId, setEntryAccountId] = useState<string>(() =>
    activeAccountId !== "all" ? activeAccountId : accounts[0]?.id ?? "acc_main",
  );
  const [day, setDay] = useState<string>(() => getDayNameFromDate(getTodayDateString()));
  const [date, setDate] = useState<string>(getTodayDateString);
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [mood, setMood] = useState<DiaryMood>("Disciplined");
  const [session, setSession] = useState<DiarySession>("Pre-Market");
  const [screenshots, setScreenshots] = useState<DiaryScreenshot[]>([]);

  // UI styling states
  const [paperTheme, setPaperTheme] = useState<"ivory" | "dark">("ivory");
  const [fontStyle, setFontStyle] = useState<"handwriting" | "serif" | "clean">("serif");
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved");
  const [archiveSearch, setArchiveSearch] = useState("");

  // Screenshot upload & zoom state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ContentEditable DOM ref and loaded ID cache
  const editorRef = useRef<HTMLDivElement>(null);
  const lastLoadedIdRef = useRef<string | null>(null);

  // Floating highlighter toolbar state
  const [floatingToolbar, setFloatingToolbar] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // AI coach analysis state on this page
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiNotes, setShowAiNotes] = useState(false);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active entry resolved from journal store (using displayedDiaryEntries)
  const activeEntry = useMemo(() => {
    if (selectedEntryId) {
      const found = displayedDiaryEntries.find((e) => e.id === selectedEntryId);
      if (found) return found;
    }
    return displayedDiaryEntries[0] || null;
  }, [displayedDiaryEntries, selectedEntryId]);

  // Synchronize inputs when active entry changes or updates
  useEffect(() => {
    if (activeEntry) {
      setSelectedEntryId(activeEntry.id);
      setEntryAccountId(
        activeEntry.accountId ||
          (activeAccountId !== "all" ? activeAccountId : accounts[0]?.id ?? "acc_main"),
      );
      setDay(activeEntry.day || getDayNameFromDate(activeEntry.date));
      setDate(activeEntry.date);
      setTitle(activeEntry.title || "");
      setContent(activeEntry.content || "");
      setMood(activeEntry.mood || "Disciplined");
      setSession(activeEntry.session || "Pre-Market");
      setScreenshots(activeEntry.screenshots || []);
      setSaveStatus("saved");
      setAiAnalysis(null);
      setShowAiNotes(false);
      setFloatingToolbar(null);
    } else {
      // If store is completely empty, create an initial blank sheet for today
      setEntryAccountId(
        activeAccountId !== "all" ? activeAccountId : accounts[0]?.id ?? "acc_main",
      );
      setDay(getDayNameFromDate(getTodayDateString()));
      setDate(getTodayDateString());
      setTitle("");
      setContent("");
      setMood("Disciplined");
      setSession("Pre-Market");
      setScreenshots([]);
      setSaveStatus("saved");
      setFloatingToolbar(null);
    }
  }, [activeEntry?.id, activeEntry?.updatedAt, activeAccountId]);

  // Synchronize editor DOM innerHTML safely:
  // - Runs on entering viewMode === "entry" or switching activeEntry
  // - Fills the notebook if the DOM is empty but activeEntry has content
  // - NEVER interrupts or overwrites the DOM while the user is actively focused or typing
  const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
  useIsomorphicLayoutEffect(() => {
    if (viewMode === "entry" && editorRef.current) {
      const isFocused =
        typeof document !== "undefined" && document.activeElement === editorRef.current;
      const targetContent = activeEntry?.content || "";

      const shouldLoad =
        lastLoadedIdRef.current !== activeEntry?.id ||
        (!editorRef.current.innerHTML.trim() && targetContent.trim()) ||
        (!isFocused && saveStatus === "saved" && editorRef.current.innerHTML !== targetContent);

      if (shouldLoad) {
        lastLoadedIdRef.current = activeEntry?.id || "empty";
        editorRef.current.innerHTML = targetContent;
      }
    }
    if (viewMode === "topics") {
      lastLoadedIdRef.current = null;
    }
  }, [viewMode, activeEntry?.id, activeEntry?.content, saveStatus]);

  // Signed chart URLs for attached screenshots
  const screenshotPaths = useMemo(() => screenshots.map((s) => s.url), [screenshots]);
  const signedUrls = useSignedChartUrls(screenshotPaths);

  // Topic grouping: groups pages having identical title, day, and account
  const topicGroups = useMemo(() => {
    const filtered = archiveSearch.trim()
      ? displayedDiaryEntries.filter((e) => {
          const q = archiveSearch.toLowerCase();
          return (
            e.title?.toLowerCase().includes(q) ||
            stripDiaryHtml(e.content).toLowerCase().includes(q) ||
            e.day.toLowerCase().includes(q) ||
            e.date.includes(q) ||
            e.mood?.toLowerCase().includes(q) ||
            e.session?.toLowerCase().includes(q)
          );
        })
      : displayedDiaryEntries;
    return groupDiaryEntriesIntoTopics(filtered);
  }, [displayedDiaryEntries, archiveSearch]);

  // Current topic group that activeEntry belongs to
  const currentTopic = useMemo(() => {
    if (!activeEntry) return null;
    const all = groupDiaryEntriesIntoTopics(displayedDiaryEntries);
    return all.find((t) => t.pages.some((p) => p.id === activeEntry.id)) || null;
  }, [displayedDiaryEntries, activeEntry]);

  const currentTopicPages = useMemo(() => {
    return currentTopic ? currentTopic.pages : activeEntry ? [activeEntry] : [];
  }, [currentTopic, activeEntry]);

  const pageIndexInTopic = useMemo(() => {
    return currentTopicPages.findIndex((p) => p.id === activeEntry?.id);
  }, [currentTopicPages, activeEntry?.id]);

  const pageNumberInTopic = pageIndexInTopic >= 0 ? pageIndexInTopic + 1 : 1;
  const totalPagesInTopic = Math.max(1, currentTopicPages.length);

  // Handle date change: automatically update day if user picks a new date
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    const computedDay = getDayNameFromDate(newDate);
    setDay(computedDay);
    markDirty();
  };

  const markDirty = () => {
    setSaveStatus("unsaved");
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      void handleSave(false);
    }, 1500);
  };

  // ContentEditable handlers
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setContent(html);
    markDirty();
  };

  const handleSelectionChange = () => {
    const selection = window.getSelection();
    if (
      !selection ||
      selection.isCollapsed ||
      !editorRef.current ||
      !editorRef.current.contains(selection.anchorNode)
    ) {
      setFloatingToolbar(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setFloatingToolbar(null);
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const parent = editorRef.current.parentElement;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();

      const top = Math.max(8, rect.top - parentRect.top - 46);
      const left = Math.max(
        10,
        Math.min(parentRect.width - 280, rect.left - parentRect.left + rect.width / 2 - 140),
      );

      setFloatingToolbar({ top, left });
    } catch {
      setFloatingToolbar(null);
    }
  };

  // ── HIGHLIGHT FUNCTION: APPLIES TO SELECTED TEXT ──
  const applyHighlight = (bgHex: string, textHex?: string, label?: string) => {
    const selection = window.getSelection();
    if (
      !selection ||
      selection.rangeCount === 0 ||
      selection.isCollapsed ||
      !selection.toString().trim()
    ) {
      toast.info("Select the words you want to highlight, then pick a highlighter color!");
      return;
    }

    if (editorRef.current && !editorRef.current.contains(selection.anchorNode)) {
      toast.info("Please select text inside the diary notebook page.");
      return;
    }

    if (bgHex === "clear" || bgHex === "transparent") {
      document.execCommand("removeFormat", false);
      document.execCommand("hiliteColor", false, "transparent");
      document.execCommand("backColor", false, "transparent");
      toast.success("Highlight removed");
    } else {
      const ok = document.execCommand("hiliteColor", false, bgHex);
      if (!ok) {
        document.execCommand("backColor", false, bgHex);
      }
      if (textHex) {
        document.execCommand("foreColor", false, textHex);
      }
      toast.success(`Highlighted in ${label || "color"}!`);
    }

    if (editorRef.current) {
      const newHtml = editorRef.current.innerHTML;
      setContent(newHtml);
      markDirty();
    }
    setFloatingToolbar(null);
  };

  // Save current entry (create new or update existing)
  const handleSave = async (showToast = true) => {
    // Read from DOM if mounted and has content; safely fallback to content state to prevent accidental wipes
    let editorHtml = content;
    if (editorRef.current) {
      const currentDomHtml = editorRef.current.innerHTML;
      if (currentDomHtml.trim() || !content.trim()) {
        editorHtml = currentDomHtml;
      }
    }
    const plainText = stripDiaryHtml(editorHtml);

    if (!plainText && !title.trim() && screenshots.length === 0) {
      if (showToast) toast.info("Write your thoughts or add a screenshot before saving.");
      return;
    }

    try {
      setSaveStatus("saving");
      if (activeEntry) {
        await updateDiaryEntry(activeEntry.id, {
          accountId: entryAccountId,
          day,
          date,
          title: title.trim(),
          content: editorHtml,
          mood,
          session,
          screenshots,
        });
        setSaveStatus("saved");
        if (showToast) toast.success("Diary page saved to journal!");
      } else {
        const created = await addDiaryEntry({
          accountId: entryAccountId,
          day,
          date,
          title: title.trim(),
          content: editorHtml,
          mood,
          session,
          screenshots,
        });
        setSelectedEntryId(created.id);
        lastLoadedIdRef.current = created.id;
        setSaveStatus("saved");
        if (showToast) toast.success("New diary entry created!");
      }
    } catch (err) {
      console.error("Failed to save diary entry:", err);
      setSaveStatus("unsaved");
      if (showToast) toast.error("Could not save diary entry. Please try again.");
    }
  };

  // Open a specific topic page directly from Table of Contents
  const handleOpenTopic = (entryId: string) => {
    setSelectedEntryId(entryId);
    lastLoadedIdRef.current = null;
    setViewMode("entry");
  };

  // Create a clean new blank topic entry
  const handleNewTopic = async () => {
    if (saveStatus === "unsaved" && stripDiaryHtml(content) && viewMode === "entry") {
      await handleSave(false);
    }

    const todayStr = getTodayDateString();
    const todayDay = getDayNameFromDate(todayStr);
    const targetAccId = activeAccountId !== "all" ? activeAccountId : accounts[0]?.id ?? "acc_main";

    try {
      const created = await addDiaryEntry({
        accountId: targetAccId,
        date: todayStr,
        day: todayDay,
        title: "",
        content: "",
        mood: "Disciplined",
        session: "Pre-Market",
        screenshots: [],
      });
      setSelectedEntryId(created.id);
      lastLoadedIdRef.current = created.id;
      setEntryAccountId(targetAccId);
      setDay(todayDay);
      setDate(todayStr);
      setTitle("");
      setContent("");
      setMood("Disciplined");
      setSession("Pre-Market");
      setScreenshots([]);
      setSaveStatus("saved");
      setAiAnalysis(null);
      setShowAiNotes(false);
      setFloatingToolbar(null);
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
      }
      setViewMode("entry");
      toast.success("Turned to a fresh new diary page");
    } catch (err) {
      console.error("Failed to create new page:", err);
      toast.error("Failed to create new page");
    }
  };

  // Continue writing: add another continuous page to this exact same topic!
  const handleContinueTopicNextPage = async () => {
    if (saveStatus === "unsaved") {
      await handleSave(false);
    }

    try {
      const created = await addDiaryEntry({
        accountId: entryAccountId,
        date,
        day,
        title: title.trim(), // Keep exact same title & day so it continues the same topic!
        content: "",
        mood,
        session,
        screenshots: [],
      });
      setSelectedEntryId(created.id);
      lastLoadedIdRef.current = created.id;
      setContent("");
      setScreenshots([]);
      setSaveStatus("saved");
      setAiAnalysis(null);
      setShowAiNotes(false);
      setFloatingToolbar(null);
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
      }
      setViewMode("entry");
      toast.success(`Turned to continuous Page ${totalPagesInTopic + 1} for this topic!`);
    } catch (err) {
      console.error("Failed to continue topic on next page:", err);
      toast.error("Failed to add continuous page");
    }
  };

  // Delete current page
  const handleDeleteCurrentPage = async () => {
    if (!activeEntry) return;
    if (confirm("Are you sure you want to tear out and delete this diary page?")) {
      try {
        await deleteDiaryEntry(activeEntry.id);
        toast.success("Diary page deleted");
        setViewMode("topics");
      } catch (err) {
        console.error("Failed to delete diary page:", err);
        toast.error("Failed to delete page");
      }
    }
  };

  // Delete all pages of a topic from the Table of Contents
  const handleDeleteTopicGroup = async (group: TopicGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    const msg =
      group.pages.length > 1
        ? `Delete this topic and all ${group.pages.length} continuous pages?`
        : "Delete this topic from your diary?";
    if (confirm(msg)) {
      try {
        for (const p of group.pages) {
          await deleteDiaryEntry(p.id);
        }
        toast.success("Topic deleted");
      } catch (err) {
        console.error("Failed to delete topic:", err);
        toast.error("Failed to delete topic");
      }
    }
  };

  // Page navigation within the topic
  const canGoPrevious = pageIndexInTopic >= 0; // if 0, clicking goes to Topics Index
  const canGoNext = pageIndexInTopic >= 0 && pageIndexInTopic < totalPagesInTopic - 1;

  const goToPreviousPage = () => {
    if (pageIndexInTopic === 0) {
      // Turn back to the Topics Index
      setViewMode("topics");
      return;
    }
    if (pageIndexInTopic > 0 && currentTopicPages[pageIndexInTopic - 1]) {
      setSelectedEntryId(currentTopicPages[pageIndexInTopic - 1]?.id || null);
    }
  };

  const goToNextPage = () => {
    if (canGoNext && currentTopicPages[pageIndexInTopic + 1]) {
      setSelectedEntryId(currentTopicPages[pageIndexInTopic + 1]?.id || null);
    }
  };

  // ── SCREENSHOT UPLOAD & PASTE LOGIC ──
  const handleAddScreenshotFile = async (file: File) => {
    const error = validateChartFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    try {
      setUploadingImage(true);
      const url = await uploadChart(file);
      const newScreenshot: DiaryScreenshot = {
        id: `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        url,
        caption: "",
        createdAt: new Date().toISOString(),
      };
      const updatedScreenshots = [...screenshots, newScreenshot];
      setScreenshots(updatedScreenshots);

      if (activeEntry) {
        await updateDiaryEntry(activeEntry.id, { screenshots: updatedScreenshots });
      }
      toast.success("Screenshot attached to diary page!");
    } catch (err) {
      console.error("Failed to upload screenshot:", err);
      toast.error("Failed to attach screenshot. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  // Support pasting image anywhere on the diary page
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await handleAddScreenshotFile(file);
          return;
        }
      }
    }
  };

  // Update caption of a screenshot
  const handleUpdateCaption = async (id: string, newCaption: string) => {
    const updated = screenshots.map((s) => (s.id === id ? { ...s, caption: newCaption } : s));
    setScreenshots(updated);
    if (activeEntry) {
      await updateDiaryEntry(activeEntry.id, { screenshots: updated });
    }
  };

  // Delete a screenshot from the page
  const handleDeleteScreenshot = async (id: string) => {
    const updated = screenshots.filter((s) => s.id !== id);
    setScreenshots(updated);
    if (activeEntry) {
      await updateDiaryEntry(activeEntry.id, { screenshots: updated });
    }
    toast.success("Screenshot removed");
  };

  // Instant AI Mindset & Discipline Reflection on this diary page
  const handleAnalyzeThoughts = async () => {
    const plain = stripDiaryHtml(content);
    if (!plain && screenshots.length === 0) {
      toast.info("Write your thoughts or add a screenshot first so the AI can reflect on them.");
      return;
    }

    setAiLoading(true);
    setShowAiNotes(true);

    try {
      const recentTradesSummary = trades
        .slice(0, 5)
        .map(
          (t) =>
            `${t.symbol} (${t.direction}, ${t.tradeType}): Entry $${t.entry} Exit $${t.exit} | Emotion: ${t.emotion} | Tags: ${t.tags.join(", ") || "none"} | Thesis: "${t.notes}"`,
        )
        .join("\n");

      const screenshotsSummary =
        screenshots.length > 0
          ? `[Attached Screenshots: ${screenshots.map((s, i) => `#${i + 1} "${s.caption || "Chart snapshot"}"`).join(", ")}]`
          : "No screenshots attached.";

      const aiFormattedThoughts = content
        .replace(
          /<span style="[^"]*background-color:[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
          "⭐ [Trader Highlighted: $1] ⭐",
        )
        .replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, "⭐ [Trader Highlighted: $1] ⭐")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "");

      const question = [
        `DIARY REFLECTION REQUEST:`,
        `I am writing in my trader diary for ${day}, ${date} [Session: ${session}, Mood: ${mood}].`,
        `My diary entry title: "${title || "Untitled"}" (Page ${pageNumberInTopic} of ${totalPagesInTopic})`,
        `Screenshots on page: ${screenshotsSummary}`,
        `Here are my raw thoughts written on this page:`,
        `"""`,
        aiFormattedThoughts.trim(),
        `"""`,
        ``,
        `Please read my thoughts completely (including any words I explicitly highlighted with ⭐ [Trader Highlighted: ...] ⭐). Provide a direct, compassionate, yet disciplined trading psychologist reflection:`,
        `1. Evaluate my emotional state, clarity, and mindset on this day.`,
        `2. Highlight any subconscious leaks (e.g. overconfidence, revenge impulse, fear of losing, fatigue, or FOMO).`,
        `3. Provide one concrete mental rule or routine to maintain discipline before my next trade.`,
        ``,
        `LANGUAGE REQUIREMENT: Match the language of my diary entry! If my thoughts are written in Hinglish, mentor me in natural Hinglish. If in English, mentor in English. If I wrote in both, use both languages naturally.`,
      ].join("\n");

      const response = await callCoach({
        data: {
          question,
          tradeSummary: `Active Rules: ${rules.map((r) => r.text).join(" | ")}\n\nRecent Trades Context:\n${recentTradesSummary}`,
          history: [],
        },
      });

      setAiAnalysis(response.text);
    } catch (err) {
      console.error("AI Coach reflection error:", err);
      toast.error("Could not generate AI reflection. Please check your AI API key.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <AppLayout
      title="Trader Diary"
      subtitle="A personal handwritten record of your thoughts, psychology, and market reflections"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* AI Status pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
            <Sparkles className="size-3.5 text-primary animate-pulse" />
            <span>AI Reader Active</span>
          </div>

          {/* Toggle between Topics Index and Active Page */}
          <Button
            variant={viewMode === "topics" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode(viewMode === "topics" ? "entry" : "topics")}
            className="gap-2 text-xs border-border/80"
          >
            <BookMarked className="size-3.5" />
            <span>{viewMode === "topics" ? "Open Active Page" : "Topics Index"}</span>
          </Button>

          {/* New Page / New Topic Button */}
          <Button
            size="sm"
            onClick={handleNewTopic}
            className="gap-1.5 bg-primary text-primary-foreground font-medium text-xs shadow-sm hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            <span>New Topic</span>
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6 pb-12" onPaste={handlePaste}>
        {/* Banner informing user AI reads everything */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary">
              <Bot className="size-5" />
            </span>
            <div className="text-xs">
              <p className="font-semibold text-foreground">
                AI Coach Reads Your Entire Diary & Screenshots Seamlessly
              </p>
              <p className="text-muted-foreground mt-0.5">
                Every reflection, fear, lesson, thesis, and chart screenshot you add here is fully remembered by the AI
                Coach when mentoring your discipline and evaluating your trading psychology.
              </p>
            </div>
          </div>
          <Link
            to="/ai-coach"
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <span>Open Coach Chat</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </div>

        {/* Toolbar: Paper theme & typography controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Paper:</span>
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setPaperTheme("ivory")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all font-medium",
                  paperTheme === "ivory"
                    ? "bg-[#faf6ee] text-stone-900 shadow-sm border border-stone-300 font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                📜 Vintage Ivory
              </button>
              <button
                type="button"
                onClick={() => setPaperTheme("dark")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all font-medium",
                  paperTheme === "dark"
                    ? "bg-stone-900 text-stone-100 shadow-sm border border-stone-700 font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                🌙 Midnight Leather
              </button>
            </div>

            <span className="text-muted-foreground font-medium ml-2">Font:</span>
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setFontStyle("serif")}
                className={cn(
                  "px-2 py-1 rounded-md transition-all font-diary-serif",
                  fontStyle === "serif"
                    ? "bg-primary/20 text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Classic Book
              </button>
              <button
                type="button"
                onClick={() => setFontStyle("handwriting")}
                className={cn(
                  "px-2 py-1 rounded-md transition-all font-handwriting text-sm",
                  fontStyle === "handwriting"
                    ? "bg-primary/20 text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Handwritten
              </button>
              <button
                type="button"
                onClick={() => setFontStyle("clean")}
                className={cn(
                  "px-2 py-1 rounded-md transition-all",
                  fontStyle === "clean"
                    ? "bg-primary/20 text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Sans Clean
              </button>
            </div>
          </div>

          {/* Top-level view indicator / Save status */}
          <div className="flex items-center gap-2">
            {viewMode === "entry" ? (
              <>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                    saveStatus === "saved"
                      ? "text-emerald-400 bg-emerald-500/10"
                      : saveStatus === "saving"
                      ? "text-amber-400 bg-amber-500/10 animate-pulse"
                      : "text-rose-400 bg-rose-500/10",
                  )}
                >
                  {saveStatus === "saved" ? (
                    <>
                      <Check className="size-3" />
                      <span>Saved to Diary</span>
                    </>
                  ) : saveStatus === "saving" ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Clock className="size-3" />
                      <span>Unsaved changes</span>
                    </>
                  )}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSave(true)}
                  className="h-8 gap-1 text-xs"
                >
                  <span>Save</span>
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground font-serif italic text-xs">
                Showing {topicGroups.length} unique topics
              </span>
            )}
          </div>
        </div>

        {/* ── REALISTIC PHYSICAL DIARY CONTAINER ── */}
        <div
          className={cn(
            "relative rounded-3xl p-3 sm:p-7 shadow-2xl transition-all duration-300",
            "bg-gradient-to-br from-[#261811] via-[#1a110c] to-[#0f0906] border-4 border-[#3d271c]",
            "shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.1)]",
          )}
        >
          {/* Brass metal corner ornaments */}
          <div className="absolute top-2 left-2 size-6 border-t-2 border-l-2 border-amber-600/70 rounded-tl-xl pointer-events-none" />
          <div className="absolute top-2 right-2 size-6 border-t-2 border-r-2 border-amber-600/70 rounded-tr-xl pointer-events-none" />
          <div className="absolute bottom-2 left-2 size-6 border-b-2 border-l-2 border-amber-600/70 rounded-bl-xl pointer-events-none" />
          <div className="absolute bottom-2 right-2 size-6 border-b-2 border-r-2 border-amber-600/70 rounded-br-xl pointer-events-none" />

          {/* Stitched leather border accent */}
          <div className="absolute inset-2 sm:inset-3 rounded-2xl border border-dashed border-amber-800/40 pointer-events-none" />

          {/* ── THE DIARY NOTEBOOK PAPER SPREAD ── */}
          <div
            className={cn(
              "relative rounded-2xl overflow-hidden transition-colors duration-300 shadow-lg flex flex-col",
              paperTheme === "ivory" ? "diary-page-ivory" : "diary-page-dark",
              fontStyle === "handwriting"
                ? "font-handwriting"
                : fontStyle === "serif"
                ? "font-diary-serif"
                : "font-sans",
            )}
            style={{ minHeight: "680px" }}
          >
            {/* ═════════════════════════════════════════════════════════════ */}
            {/* VIEW MODE 1: TOPIC PAGE (TABLE OF CONTENTS / INDEX)         */}
            {/* ═════════════════════════════════════════════════════════════ */}
            {viewMode === "topics" ? (
              <div className="p-6 sm:p-10 flex-1 flex flex-col">
                {/* Index Page Header */}
                <div className="border-b-2 border-stone-300/80 dark:border-stone-700/80 pb-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <BookMarked className="size-5 text-amber-700 dark:text-amber-500" />
                        <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
                          Index of Topics & Reflections
                        </h2>
                      </div>
                      <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1 font-serif italic">
                        {activeAccountId === "all"
                          ? "All Accounts combined — sorted chronologically by date and time"
                          : `Showing diary entries for ${currentAccount?.name ?? "Selected Account"}`}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={handleNewTopic}
                      className="gap-1.5 bg-amber-800 hover:bg-amber-900 text-white font-medium text-xs self-start sm:self-auto shadow-sm"
                    >
                      <Plus className="size-3.5" />
                      <span>Write New Page</span>
                    </Button>
                  </div>

                  {/* Search inside topics */}
                  <div className="relative mt-4 max-w-md">
                    <Search className="absolute left-3 top-2.5 size-4 text-stone-500" />
                    <Input
                      placeholder="Filter topics by title, day, date, or feelings..."
                      value={archiveSearch}
                      onChange={(e) => setArchiveSearch(e.target.value)}
                      className={cn(
                        "pl-9 h-9 text-xs transition-colors",
                        paperTheme === "ivory"
                          ? "bg-stone-200/50 border-stone-300 focus:bg-stone-100 text-stone-900"
                          : "bg-stone-900/60 border-stone-700 focus:bg-stone-900 text-stone-100",
                      )}
                    />
                  </div>
                </div>

                {/* Topics List Table: Only unique topics (different title OR different day) */}
                <div className="flex-1 mt-6 space-y-3">
                  {topicGroups.length === 0 ? (
                    <div className="py-16 text-center font-serif">
                      <p className="text-lg text-stone-600 dark:text-stone-400">
                        {archiveSearch
                          ? "No topics match your filter."
                          : activeAccountId === "all"
                          ? "Your journal is waiting for its first topic across all accounts."
                          : `No diary topics yet for ${currentAccount?.name ?? "this account"}.`}
                      </p>
                      <Button
                        size="sm"
                        onClick={handleNewTopic}
                        className="mt-4 bg-amber-800 hover:bg-amber-900 text-white font-medium text-xs"
                      >
                        <Plus className="size-3.5 mr-1" />
                        <span>Start Page 1</span>
                      </Button>
                    </div>
                  ) : (
                    topicGroups.map((group, idx) => {
                      const firstPage = group.pages[0];
                      const moodObj = DIARY_MOODS.find((m) => m.label === group.mood);
                      const totalScreenshots = group.pages.reduce(
                        (acc, p) => acc + (p.screenshots?.length || 0),
                        0,
                      );
                      const entryAcc = accounts.find(
                        (a) => a.id === (firstPage?.accountId || group.accountId || accounts[0]?.id),
                      );

                      return (
                        <div
                          key={group.topicKey}
                          onClick={() => firstPage && handleOpenTopic(firstPage.id)}
                          className={cn(
                            "group cursor-pointer rounded-xl p-4 sm:p-5 border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                            paperTheme === "ivory"
                              ? "bg-stone-100/70 hover:bg-white border-stone-300/80 hover:border-amber-700/50 hover:shadow-md"
                              : "bg-stone-900/60 hover:bg-stone-850 border-stone-800 hover:border-amber-500/50 hover:shadow-md",
                          )}
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            {/* Metadata line: Page #, Date, Day, Mood, Account */}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-serif font-bold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-amber-700/10 text-amber-800 dark:text-amber-400 border border-amber-700/20">
                                {group.pages.length > 1
                                  ? `Pages 1–${group.pages.length} (${group.pages.length} pages)`
                                  : `Page ${idx + 1}`}
                              </span>
                              <span className="font-serif font-semibold text-stone-600 dark:text-stone-400">
                                {group.day}, {formatDisplayDate(group.date)}
                              </span>
                              {entryAcc && (
                                <span
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-serif font-medium border"
                                  style={{
                                    backgroundColor: `${entryAcc.color || "#598bff"}18`,
                                    borderColor: `${entryAcc.color || "#598bff"}45`,
                                    color: entryAcc.color || "#598bff",
                                  }}
                                  title={`Trading Account: ${entryAcc.name}`}
                                >
                                  <span
                                    className="size-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: entryAcc.color || "#598bff" }}
                                  />
                                  <span className="truncate max-w-[130px]">{entryAcc.name}</span>
                                </span>
                              )}
                              {group.session && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                                  {group.session}
                                </span>
                              )}
                              {moodObj && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center gap-1">
                                  <span>{moodObj.emoji}</span>
                                  <span>{moodObj.label}</span>
                                </span>
                              )}
                              {totalScreenshots > 0 && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                  <Camera className="size-3" />
                                  <span>{totalScreenshots} screenshot{totalScreenshots > 1 ? "s" : ""}</span>
                                </span>
                              )}
                            </div>

                            {/* Topic Title */}
                            <h3 className="font-serif font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100 group-hover:text-amber-800 dark:group-hover:text-amber-400 transition-colors truncate">
                              {group.title}
                            </h3>

                            {/* Thought Preview snippet */}
                            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed">
                              {stripDiaryHtml(firstPage?.content || "") || (totalScreenshots > 0 ? "Attached chart screenshots..." : "Empty thoughts on this page...")}
                            </p>
                          </div>

                          {/* Action Arrow */}
                          <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                            <span className="text-xs font-serif italic text-amber-800 dark:text-amber-400 font-semibold group-hover:underline flex items-center gap-1">
                              <span>Open Topic</span>
                              <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDeleteTopicGroup(group, e)}
                              className="size-7 text-stone-400 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete topic"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer of Index Page */}
                <div className="mt-8 pt-4 border-t border-stone-300/80 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 font-serif">
                  <span>TradeLog Pro Personal Mindset Archive</span>
                  <span>{topicGroups.length} unique topics ({diaryEntries.length} total pages)</span>
                </div>
              </div>
            ) : (
              /* ═════════════════════════════════════════════════════════════ */
              /* VIEW MODE 2: ACTIVE DIARY PAGE (WRITING & READING SPREAD)    */
              /* ═════════════════════════════════════════════════════════════ */
              <div className="flex-1 flex flex-col">
                {/* Top Header Margin Band: DAY on TOP LEFT, DATE on TOP RIGHT */}
                <div
                  className={cn(
                    "pt-6 pb-4 px-4 sm:px-8 border-b transition-colors",
                    paperTheme === "ivory"
                      ? "border-stone-300/80 bg-stone-100/40"
                      : "border-stone-700/80 bg-stone-900/40",
                  )}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* ── TOP LEFT: DAY (Option to write and pick day) ── */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode("topics")}
                        className="h-7 px-2 text-xs font-serif font-semibold text-amber-800 dark:text-amber-400 hover:bg-black/5 mr-1"
                        title="Back to Topics Index"
                      >
                        <ArrowLeft className="size-3.5 mr-1" />
                        <span>Index</span>
                      </Button>

                      <span
                        className={cn(
                          "font-serif italic font-bold tracking-wider text-sm select-none",
                          paperTheme === "ivory" ? "text-stone-600" : "text-stone-400",
                        )}
                      >
                        Day:
                      </span>
                      <div className="relative inline-flex items-center">
                        <input
                          type="text"
                          value={day}
                          onChange={(e) => {
                            setDay(e.target.value);
                            markDirty();
                          }}
                          placeholder="e.g. Monday"
                          className={cn(
                            "bg-transparent border-b border-dashed focus:border-solid font-serif font-bold text-base sm:text-lg focus:outline-none px-1.5 py-0.5 w-32 sm:w-36 transition-all",
                            paperTheme === "ivory"
                              ? "border-stone-400 text-stone-900 focus:border-stone-900"
                              : "border-stone-600 text-stone-100 focus:border-stone-300",
                          )}
                        />
                      </div>

                      {/* Quick day buttons */}
                      <div className="hidden md:flex items-center gap-1 ml-1">
                        {DAYS_OF_WEEK.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              setDay(d);
                              markDirty();
                            }}
                            className={cn(
                              "px-1.5 py-0.5 text-[10px] rounded font-serif transition-colors",
                              day.toLowerCase() === d.toLowerCase()
                                ? paperTheme === "ivory"
                                ? "bg-stone-800 text-white font-bold"
                                : "bg-stone-200 text-stone-900 font-bold"
                              : paperTheme === "ivory"
                              ? "hover:bg-stone-300 text-stone-600"
                              : "hover:bg-stone-800 text-stone-400",
                            )}
                          >
                            {d.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── TOP RIGHT: DATE (Option to write or pick date) ── */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span
                        className={cn(
                          "font-serif italic font-bold tracking-wider text-sm select-none",
                          paperTheme === "ivory" ? "text-stone-600" : "text-stone-400",
                        )}
                      >
                        Date:
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => handleDateChange(e.target.value)}
                          className={cn(
                            "bg-transparent border-b border-dashed focus:border-solid font-serif font-semibold text-xs sm:text-sm focus:outline-none px-1.5 py-0.5 transition-all cursor-pointer",
                            paperTheme === "ivory"
                              ? "border-stone-400 text-stone-900 focus:border-stone-900"
                              : "border-stone-600 text-stone-100 focus:border-stone-300",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => handleDateChange(getTodayDateString())}
                          className={cn(
                            "text-[10px] uppercase font-serif px-1.5 py-0.5 rounded border transition-colors",
                            paperTheme === "ivory"
                              ? "border-stone-300 hover:bg-stone-200 text-stone-700"
                              : "border-stone-700 hover:bg-stone-800 text-stone-300",
                          )}
                        >
                          Today
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stamped Badges: Session, Mood, and Screenshot Action */}
                  <div className="mt-3.5 pt-3 border-t border-dashed border-stone-300/60 dark:border-stone-800/60 flex flex-wrap items-center justify-between gap-2.5">
                    {/* Session Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={cn(
                          "text-[11px] font-serif font-semibold uppercase tracking-wider",
                          paperTheme === "ivory" ? "text-stone-500" : "text-stone-400",
                        )}
                      >
                        Session:
                      </span>
                      {DIARY_SESSIONS.map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => {
                            setSession(s.label);
                            markDirty();
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-sans transition-all",
                            session === s.label
                              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                              : paperTheme === "ivory"
                              ? "bg-stone-200/70 hover:bg-stone-300/80 text-stone-700"
                              : "bg-stone-800 hover:bg-stone-700 text-stone-300",
                          )}
                        >
                          <span>{s.icon}</span>
                          <span>{s.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Mood Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={cn(
                          "text-[11px] font-serif font-semibold uppercase tracking-wider",
                          paperTheme === "ivory" ? "text-stone-500" : "text-stone-400",
                        )}
                      >
                        Mindset:
                      </span>
                      {DIARY_MOODS.slice(0, 6).map((m) => (
                        <button
                          key={m.label}
                          type="button"
                          onClick={() => {
                            setMood(m.label);
                            markDirty();
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-sans transition-all",
                            mood === m.label
                              ? "bg-amber-600 text-white font-semibold shadow-sm"
                              : paperTheme === "ivory"
                              ? "bg-stone-200/70 hover:bg-stone-300/80 text-stone-700"
                              : "bg-stone-800 hover:bg-stone-700 text-stone-300",
                          )}
                        >
                          <span>{m.emoji}</span>
                          <span>{m.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Account Attribution Chip */}
                    {accounts.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={cn(
                            "text-[11px] font-serif font-semibold uppercase tracking-wider",
                            paperTheme === "ivory" ? "text-stone-500" : "text-stone-400",
                          )}
                        >
                          Account:
                        </span>
                        <select
                          value={entryAccountId}
                          onChange={(e) => {
                            setEntryAccountId(e.target.value);
                            markDirty();
                          }}
                          className={cn(
                            "text-[11px] px-2 py-0.5 rounded-full font-serif font-semibold border transition-all cursor-pointer focus:outline-none",
                            paperTheme === "ivory"
                              ? "bg-stone-200/80 border-stone-300 text-stone-900"
                              : "bg-stone-800 border-stone-700 text-stone-100",
                          )}
                        >
                          {accounts.map((acc) => (
                            <option
                              key={acc.id}
                              value={acc.id}
                              className="text-stone-900 bg-white dark:bg-stone-900 dark:text-stone-100 font-sans"
                            >
                              {acc.name} ({acc.currency})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Title / Topic of Today's Entry + Topic Page Counter */}
                <div className="px-4 sm:px-8 pt-4 pb-2 border-b border-stone-200/60 dark:border-stone-800/60 flex items-center justify-between gap-3">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      markDirty();
                    }}
                    placeholder="Topic / Reflection Title (e.g., Trading on the FOMC meeting)..."
                    className={cn(
                      "w-full bg-transparent font-serif font-bold text-lg sm:text-xl focus:outline-none px-1 py-1 transition-all",
                      paperTheme === "ivory"
                        ? "text-stone-900 placeholder:text-stone-400"
                        : "text-stone-100 placeholder:text-stone-500",
                    )}
                  />

                  {/* Topic Continuation Indicator */}
                  {totalPagesInTopic > 1 && (
                    <span className="shrink-0 text-xs font-serif italic text-amber-800 dark:text-amber-400 font-semibold px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
                      Topic Page {pageNumberInTopic} of {totalPagesInTopic}
                    </span>
                  )}
                </div>

                {/* ── HIGHLIGHTER PEN TOOLBAR (Highlight text in different colours) ── */}
                <div
                  className={cn(
                    "px-4 sm:px-8 py-2 border-b flex flex-wrap items-center justify-between gap-2.5 text-xs transition-colors select-none",
                    paperTheme === "ivory"
                      ? "bg-stone-200/40 border-stone-300/60 text-stone-700"
                      : "bg-stone-900/60 border-stone-800/60 text-stone-300",
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 font-serif font-bold text-stone-800 dark:text-stone-200 mr-1">
                      <Highlighter className="size-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Highlighter:</span>
                    </div>

                    {/* Color Highlighter Pens */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {DIARY_HIGHLIGHTERS.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyHighlight(h.bgHex, h.textHex, h.label)}
                          className={cn(
                            "group relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-xs transition-all border cursor-pointer",
                            h.badgeBg,
                            "hover:scale-105 active:scale-95",
                          )}
                          title={`Highlight selected words in ${h.label}`}
                        >
                          <span
                            className="size-2.5 rounded-full border border-black/20 shrink-0 shadow-xs"
                            style={{ backgroundColor: h.bgHex }}
                          />
                          <span className="text-[11px] font-sans font-medium">
                            {h.label.split(" ")[1] || h.label}
                          </span>
                        </button>
                      ))}

                      {/* Clear Highlight Eraser */}
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyHighlight("clear", undefined, "Clear")}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-sans font-medium border transition-all hover:scale-105 active:scale-95 cursor-pointer ml-1",
                          paperTheme === "ivory"
                            ? "border-stone-300 hover:bg-stone-300/60 text-stone-700"
                            : "border-stone-700 hover:bg-stone-800 text-stone-300",
                        )}
                        title="Remove highlight from selected text"
                      >
                        <Eraser className="size-3 text-stone-500" />
                        <span>Clear</span>
                      </button>
                    </div>
                  </div>

                  <span className="text-[11px] font-serif italic text-stone-500 dark:text-stone-400 hidden sm:inline-block">
                    Select words, then click any color to highlight
                  </span>
                </div>

                {/* ── NOTEBOOK WRITING AREA WITH EXACT LINE & TEXT ALIGNMENT ── */}
                <div
                  className="relative px-4 sm:px-8 py-3 flex-1 flex flex-col min-h-[420px] cursor-text"
                  onClick={(e) => {
                    if (e.target === e.currentTarget && editorRef.current) {
                      editorRef.current.focus();
                    }
                  }}
                >
                  {/* Floating mini-palette when user selects text with mouse */}
                  {floatingToolbar && (
                    <div
                      style={{
                        top: `${floatingToolbar.top}px`,
                        left: `${floatingToolbar.left}px`,
                      }}
                      className="absolute z-30 flex items-center gap-1 p-1 rounded-full bg-stone-900/95 text-stone-100 shadow-2xl border border-stone-700 backdrop-blur-xs select-none animate-in fade-in zoom-in-95 duration-150"
                    >
                      <span className="text-[10px] uppercase font-bold text-stone-400 pl-2 pr-1 font-serif">
                        Highlight:
                      </span>
                      {DIARY_HIGHLIGHTERS.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyHighlight(h.bgHex, h.textHex, h.label)}
                          className="size-5 rounded-full border border-white/30 hover:scale-125 transition-transform shadow-xs cursor-pointer"
                          style={{ backgroundColor: h.bgHex }}
                          title={h.label}
                        />
                      ))}
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyHighlight("clear", undefined, "Clear")}
                        className="size-5 rounded-full grid place-items-center bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors border border-stone-600 ml-0.5 cursor-pointer"
                        title="Clear highlight"
                      >
                        <Eraser className="size-2.5" />
                      </button>
                    </div>
                  )}

                  {/* Ruled contentEditable Notebook Paper */}
                  <div
                    ref={editorRef}
                    contentEditable="true"
                    suppressContentEditableWarning
                    onInput={handleEditorInput}
                    onKeyUp={handleSelectionChange}
                    onMouseUp={handleSelectionChange}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        document.execCommand("insertText", false, "    ");
                      }
                    }}
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (items) {
                        for (let i = 0; i < items.length; i++) {
                          if (items[i]?.type.startsWith("image/")) {
                            const file = items[i]?.getAsFile();
                            if (file) {
                              e.preventDefault();
                              void handleAddScreenshotFile(file);
                              return;
                            }
                          }
                        }
                      }
                      const plainText = e.clipboardData.getData("text/plain");
                      if (plainText) {
                        e.preventDefault();
                        document.execCommand("insertText", false, plainText);
                        handleEditorInput();
                      }
                    }}
                    className={cn(
                      "diary-editor w-full flex-1 focus:outline-none transition-all px-2 sm:px-3 text-base sm:text-[17px] border-none whitespace-pre-wrap break-words min-h-[380px]",
                      paperTheme === "ivory"
                        ? "diary-ruled-textarea-ivory text-stone-800 selection:bg-amber-200 selection:text-stone-900"
                        : "diary-ruled-textarea-dark text-stone-100 selection:bg-amber-800 selection:text-white",
                    )}
                    style={{
                      lineHeight: "36px",
                      paddingTop: "10px",
                    }}
                  />

                  {/* Empty state placeholder when no text has been entered */}
                  {(!content || content === "<br>" || !stripDiaryHtml(content)) && (
                    <div
                      onClick={() => editorRef.current?.focus()}
                      className="pointer-events-none absolute top-5 left-6 sm:left-11 text-stone-400 dark:text-stone-500 font-serif italic text-base sm:text-[17px] leading-[36px] select-none max-w-xl"
                    >
                      Write your raw, honest thoughts here... (Select any text to highlight in colors, or paste chart screenshots anywhere with Ctrl+V)
                    </div>
                  )}
                </div>

                {/* ── SCREENSHOTS SECTION (In Between / Below Pages Anywhere) ── */}
                <div className="px-4 sm:px-8 py-3 border-t border-dashed border-stone-300/80 dark:border-stone-800/80">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Camera className="size-4 text-amber-700 dark:text-amber-500" />
                      <span className="font-serif font-bold text-xs sm:text-sm text-stone-800 dark:text-stone-200">
                        Page Screenshots & Charts ({screenshots.length})
                      </span>
                    </div>

                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleAddScreenshotFile(file);
                        e.target.value = "";
                      }}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 text-xs gap-1 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-black/5"
                    >
                      {uploadingImage ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      <span>Add Screenshot</span>
                    </Button>
                  </div>

                  {/* Screenshots Polaroid/Taped Gallery */}
                  {screenshots.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pb-2">
                      {screenshots.map((s, sIdx) => {
                        const displayUrl = signedUrls[s.url] || s.url;
                        return (
                          <div
                            key={s.id}
                            className={cn(
                              "relative rounded-xl border p-2.5 transition-all shadow-md group flex flex-col justify-between",
                              paperTheme === "ivory"
                                ? "bg-white border-stone-200 text-stone-900"
                                : "bg-stone-900 border-stone-800 text-stone-100",
                            )}
                          >
                            {/* Washi tape decorative strip */}
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-14 h-4 bg-amber-100/80 border border-amber-300/40 rounded-xs shadow-xs transform -rotate-1 pointer-events-none" />

                            {/* Image container */}
                            <div
                              className="relative cursor-pointer overflow-hidden rounded-lg bg-black/10 aspect-video flex items-center justify-center group/img"
                              onClick={() => setZoomImage(s.url)}
                            >
                              <img
                                src={displayUrl}
                                alt={s.caption || `Screenshot ${sIdx + 1}`}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                                <Maximize2 className="size-4" />
                                <span className="text-[11px] font-medium">Zoom Chart</span>
                              </div>
                            </div>

                            {/* Caption input & delete */}
                            <div className="mt-2 flex items-center gap-1.5">
                              <input
                                type="text"
                                value={s.caption || ""}
                                onChange={(e) => void handleUpdateCaption(s.id, e.target.value)}
                                placeholder="Chart caption (e.g. 15m breakout setup)..."
                                className={cn(
                                  "flex-1 text-xs bg-transparent border-b border-dashed focus:border-solid focus:outline-none px-1 py-0.5",
                                  paperTheme === "ivory"
                                    ? "border-stone-300 text-stone-800 placeholder:text-stone-400 focus:border-stone-700"
                                    : "border-stone-700 text-stone-200 placeholder:text-stone-500 focus:border-stone-400",
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => void handleDeleteScreenshot(s.id)}
                                className="size-6 text-stone-400 hover:text-rose-500 hover:bg-rose-500/10"
                                title="Remove screenshot"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "rounded-xl border border-dashed p-4 text-center cursor-pointer transition-colors text-xs font-serif italic",
                        paperTheme === "ivory"
                          ? "border-stone-300/80 hover:bg-stone-200/50 text-stone-500"
                          : "border-stone-800 hover:bg-stone-850 text-stone-400",
                      )}
                    >
                      <Camera className="size-5 mx-auto mb-1 text-amber-700/60 dark:text-amber-500/60" />
                      <span>Click to upload or press Ctrl+V to paste chart screenshots anywhere on this page</span>
                    </div>
                  )}
                </div>

                {/* ── DIARY FOOTER / PAGE CONTROLS ── */}
                <div
                  className={cn(
                    "p-4 sm:px-8 border-t flex flex-wrap items-center justify-between gap-3 text-xs mt-auto",
                    paperTheme === "ivory"
                      ? "border-stone-300/80 bg-stone-100/50 text-stone-600"
                      : "border-stone-800 bg-stone-900/50 text-stone-400",
                  )}
                >
                  {/* Page Number indicator & Topics link */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode("topics")}
                      className="h-7 px-2 text-xs font-serif italic text-stone-700 dark:text-stone-300 hover:bg-black/10"
                    >
                      <BookOpen className="size-3.5 mr-1 text-amber-700 dark:text-amber-500" />
                      <span>Topics Index</span>
                    </Button>

                    <span className="font-serif italic font-semibold border-l border-stone-300 dark:border-stone-700 pl-3">
                      Topic Page {pageNumberInTopic} of {totalPagesInTopic}
                    </span>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={goToPreviousPage}
                        disabled={!canGoPrevious}
                        className="size-7 hover:bg-black/10"
                        title={pageIndexInTopic === 0 ? "Back to Topics Index" : "Previous page in this topic"}
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={goToNextPage}
                        disabled={!canGoNext}
                        className="size-7 hover:bg-black/10"
                        title="Next page in this topic"
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>

                    {/* Add continuous page to this topic */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleContinueTopicNextPage}
                      className="h-7 text-[11px] gap-1 font-serif text-amber-800 dark:text-amber-400 border-amber-600/30 hover:bg-amber-600/10 ml-1"
                    >
                      <Plus className="size-3" />
                      <span>Continue on Next Page</span>
                    </Button>
                  </div>

                  {/* Action buttons on this page */}
                  <div className="flex items-center gap-2">
                    {/* Instant AI reflection button */}
                    <Button
                      size="sm"
                      onClick={handleAnalyzeThoughts}
                      disabled={aiLoading}
                      className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-sm"
                    >
                      {aiLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      <span>AI Mentor Reflection</span>
                    </Button>

                    {/* Delete page */}
                    {activeEntry && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDeleteCurrentPage}
                        className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        title="Delete page"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── AI MENTOR STICKY NOTE / PSYCHOLOGICAL INSIGHT CARD ── */}
        {showAiNotes && viewMode === "entry" && (
          <Card className="border-indigo-500/30 bg-indigo-500/5 p-6 shadow-xl relative overflow-hidden transition-all">
            <div className="flex items-start justify-between gap-4 border-b border-indigo-500/20 pb-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-md">
                  <Bot className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-foreground text-base">
                    AI Mentor Reflection: {day}, {date}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Psychological audit of your written thoughts, mindset leaks, and discipline rules
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAiNotes(false)}
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-4">
              {aiLoading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="size-8 animate-spin text-indigo-500" />
                  <p className="text-sm font-medium text-foreground">
                    Reading your raw thoughts and analyzing your discipline...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cross-referencing your mindset with your recent trade executions and playbook rules.
                  </p>
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {aiAnalysis}
                  <div className="pt-4 border-t border-indigo-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">
                      Want to discuss this further with your coach?
                    </span>
                    <Link
                      to="/ai-coach"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <Bot className="size-3.5" />
                      <span>Continue Chat in AI Coach →</span>
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        )}

        {/* ── ZOOM MODAL FOR SCREENSHOTS ── */}
        {zoomImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200"
            onClick={() => setZoomImage(null)}
          >
            <div
              className="relative max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl bg-card border border-border shadow-2xl p-2 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={signedUrls[zoomImage] || zoomImage}
                alt="Enlarged chart screenshot"
                className="max-h-[82vh] w-auto object-contain rounded-xl mx-auto shadow-md"
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-4 right-4 size-8 rounded-full shadow-lg"
                onClick={() => setZoomImage(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
