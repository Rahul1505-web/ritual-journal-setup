import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  X,
  Camera,
  Download,
  PlusCircle,
  BookOpen,
  Bot,
  Flame,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useJournal } from "@/lib/journal-store";
import { toast } from "sonner";
import { getTodayDateString, getDayNameFromDate } from "@/lib/diary";

interface SnapSetupModalProps {
  screenshotUrl: string | null;
  symbol: string;
  price: number;
  delta: number;
  interval: string;
  onClose: () => void;
}

export function SnapSetupModal({
  screenshotUrl,
  symbol,
  price,
  delta,
  interval,
  onClose,
}: SnapSetupModalProps) {
  const navigate = useNavigate();
  const { addDiaryEntry, accounts, activeAccountId } = useJournal();

  const [diaryNote, setDiaryNote] = useState(
    `${symbol} ${interval} Order Flow: Net Delta ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}. Market price at $${price.toLocaleString()}.`,
  );
  const [isSavingDiary, setIsSavingDiary] = useState(false);

  if (!screenshotUrl) return null;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = screenshotUrl;
    a.download = `Footprint-${symbol}-${interval}-${Date.now()}.png`;
    a.click();
    toast.success("Footprint chart downloaded!");
  };

  const handleGoToAddTrade = () => {
    const isLong = delta >= 0;
    // We pass state via query params or session storage so Add Trade picks it up cleanly
    sessionStorage.setItem(
      "prefilled_chart_screenshot",
      JSON.stringify({
        url: screenshotUrl,
        symbol,
        entry: price,
        direction: isLong ? "long" : "short",
      }),
    );
    navigate({ to: "/add-trade" });
    onClose();
  };

  const handleSaveToDiary = async () => {
    setIsSavingDiary(true);
    try {
      const today = getTodayDateString();
      const day = getDayNameFromDate(today);
      const targetAccId = activeAccountId !== "all" ? activeAccountId : accounts[0]?.id ?? "acc_main";

      await addDiaryEntry({
        accountId: targetAccId,
        date: today,
        day,
        title: `${symbol} Order Flow Footprint`,
        content: diaryNote,
        mood: delta >= 0 ? "Focused" : "Disciplined",
        session: "Live Trading",
        screenshots: [
          {
            id: `sc_${Date.now()}`,
            url: screenshotUrl,
            caption: `${symbol} ${interval} Footprint (Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(1)})`,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      toast.success("Footprint setup logged to your Trader Diary!");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save to diary");
    } finally {
      setIsSavingDiary(false);
    }
  };

  const handleAskAiCoach = () => {
    sessionStorage.setItem(
      "coach_prefilled_screenshot",
      JSON.stringify({
        url: screenshotUrl,
        name: `${symbol} Footprint (${interval})`,
        caption: `Footprint chart at $${price.toLocaleString()}, Net Delta: ${delta.toFixed(1)}`,
      }),
    );
    navigate({ to: "/ai-coach" });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] max-w-2xl w-full rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera className="size-4 text-primary" />
            <h3 className="font-semibold text-sm sm:text-base text-foreground">
              Snap &amp; Log Footprint Setup
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
          {/* Screenshot Preview */}
          <div className="relative rounded-xl border border-border overflow-hidden bg-black/60 shadow-inner max-h-64 flex items-center justify-center">
            <img
              src={screenshotUrl}
              alt="Footprint chart snapshot"
              className="w-full h-full object-contain"
            />
            {/* Overlay Badges */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-black/80 text-white font-mono text-xs font-bold border border-white/20">
                {symbol} ({interval})
              </span>
              <span className="px-2 py-0.5 rounded-md bg-black/80 text-emerald-400 font-mono text-xs font-bold border border-white/20">
                ${price.toLocaleString()}
              </span>
            </div>

            <div className="absolute top-2 right-2">
              <span
                className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold border ${
                  delta >= 0
                    ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/30"
                    : "bg-rose-950/80 text-rose-400 border-rose-500/30"
                }`}
              >
                Δ {delta >= 0 ? "+" : ""}
                {delta.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Diary Thoughts / Execution Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Setup Notes / Hypothesis</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                (Will be saved in your Trader Diary)
              </span>
            </label>
            <textarea
              rows={2}
              value={diaryNote}
              onChange={(e) => setDiaryNote(e.target.value)}
              className="w-full rounded-xl bg-surface-2 border border-border p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
              placeholder="What order flow signal did you see? (e.g. aggressive buyers trapped, absorption at POC)"
            />
          </div>

          {/* Action Destination Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {/* Card 1: Add to Trade Log */}
            <button
              type="button"
              onClick={handleGoToAddTrade}
              className="group flex flex-col items-start gap-1 p-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/15 hover:border-primary/60 transition-all text-left shadow-2xs"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <PlusCircle className="size-3.5" />
                <span>Log as Trade</span>
              </div>
              <p className="text-[11px] text-muted-foreground group-hover:text-foreground/90 transition-colors">
                Prefills trade entry at ${price.toLocaleString()} with chart attached.
              </p>
            </button>

            {/* Card 2: Save to Diary */}
            <button
              type="button"
              disabled={isSavingDiary}
              onClick={handleSaveToDiary}
              className="group flex flex-col items-start gap-1 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 hover:border-amber-500/60 transition-all text-left shadow-2xs disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                <BookOpen className="size-3.5" />
                <span>{isSavingDiary ? "Saving..." : "Save to Diary"}</span>
              </div>
              <p className="text-[11px] text-muted-foreground group-hover:text-foreground/90 transition-colors">
                Adds setup snapshot &amp; notes to today&apos;s thought journal.
              </p>
            </button>

            {/* Card 3: Ask Coach Maverick */}
            <button
              type="button"
              onClick={handleAskAiCoach}
              className="group flex flex-col items-start gap-1 p-3 rounded-xl border border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/15 hover:border-sky-500/60 transition-all text-left shadow-2xs"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                <Bot className="size-3.5" />
                <span>Ask AI Coach</span>
              </div>
              <p className="text-[11px] text-muted-foreground group-hover:text-foreground/90 transition-colors">
                Review this footprint cluster &amp; absorption with Coach Maverick.
              </p>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="text-xs h-8 gap-1.5 rounded-xl border-border"
          >
            <Download className="size-3.5" />
            <span>Download PNG</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs h-8 rounded-xl text-muted-foreground hover:text-foreground"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
