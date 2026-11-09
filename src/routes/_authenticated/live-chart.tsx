import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import {
  ExternalLink,
  Grid2X2,
  Maximize2,
  Minimize2,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/live-chart")({
  head: () => ({
    meta: [
      { title: "Live Charts — TradeLog Pro" },
      {
        name: "description",
        content:
          "Real-time TradingView charts for Bitcoin (BTC), Gold (XAU), and WTI Crude Oil.",
      },
    ],
  }),
  component: LiveChartPage,
});

/* ─────────────────────────── Symbols & Themes ─────────────────────────── */
const PRESET_CHARTS = [
  {
    id: "btc",
    symbol: "BINANCE:BTCUSDT",
    label: "BTC / USDT",
    tvSymbol: "BINANCE:BTCUSDT",
    accent: "#f7931a",
    category: "Crypto",
  },
  {
    id: "xau",
    symbol: "TVC:GOLD",
    label: "XAU / USD · Gold",
    tvSymbol: "TVC:GOLD",
    accent: "#ffd700",
    category: "Commodities",
  },
  {
    id: "oil",
    symbol: "TVC:USOIL",
    label: "WTI Crude Oil",
    tvSymbol: "TVC:USOIL",
    accent: "#38bdf8",
    category: "Commodities",
  },
];

const BG_THEMES = [
  { id: "tv-dark", label: "TV Classic", bg: "#131722", border: "#2a2e39" },
  { id: "pitch-black", label: "OLED Black", bg: "#000000", border: "#1f242d" },
  { id: "deep-navy", label: "Deep Navy", bg: "#0b0f19", border: "#1e293b" },
  { id: "slate", label: "Slate Dark", bg: "#0f172a", border: "#334155" },
];

type BgTheme = (typeof BG_THEMES)[number];
type PresetChart = (typeof PRESET_CHARTS)[number];

/* ─────────── TV.js Loader (loads official TradingView widget script) ─────────── */
function loadTradingViewScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as any).TradingView) {
      resolve();
      return;
    }
    const existingScript = document.getElementById("tv-widget-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = "tv-widget-script";
    script.src = "https://s3.tradingview.com/tv.js";
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

/* ─────────────────── Native TradingView Chart Card ───────────────────── */
function TradingViewChart({
  id,
  symbol,
  label,
  tvSymbol,
  accent,
  bgTheme,
  height = "640px",
  allowChangeSymbol = true,
}: {
  id: string;
  symbol: string;
  label: string;
  tvSymbol: string;
  accent: string;
  bgTheme: BgTheme;
  height?: string;
  allowChangeSymbol?: boolean;
}) {
  const containerId = `tv_container_${id}`;
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const openFullTradingView = () => {
    const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const renderChart = useCallback(async () => {
    await loadTradingViewScript();
    const container = document.getElementById(containerId);
    if (!container || !(window as any).TradingView) return;

    // Clear previous instance
    container.innerHTML = "";

    new (window as any).TradingView.widget({
      autosize: true,
      symbol,
      interval: "15",
      timezone: "Asia/Kolkata",
      theme: "dark",
      style: "1",
      locale: "en",
      toolbar_bg: bgTheme.bg,
      enable_publishing: false,
      allow_symbol_change: allowChangeSymbol,
      /* ── Crucial: Enables TradingView's Real Native Drawing Toolbar & Favorites ── */
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      withdateranges: true,
      save_image: true,
      show_popup_button: true,
      popup_width: "1280",
      popup_height: "800",
      container_id: containerId,
    });
  }, [containerId, symbol, bgTheme, allowChangeSymbol]);

  useEffect(() => {
    // Delay slightly to ensure DOM container is mounted
    const timer = setTimeout(() => {
      void renderChart();
    }, 50);

    return () => {
      clearTimeout(timer);
      const container = document.getElementById(containerId);
      if (container) container.innerHTML = "";
    };
  }, [renderChart, containerId]);

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!cardRef.current) return;
    if (!document.fullscreenElement) {
      await cardRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn(
        "flex flex-col rounded-2xl border overflow-hidden shadow-xl transition-all duration-200 relative",
        isFullscreen ? "rounded-none border-none h-screen w-screen" : "",
      )}
      style={{
        backgroundColor: bgTheme.bg,
        borderColor: bgTheme.border,
      }}
    >
      {/* Chart Toolbar Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 border-b shrink-0 select-none z-20"
        style={{
          borderColor: bgTheme.border,
          backgroundColor: `${accent}12`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="size-2.5 rounded-full shrink-0 shadow-sm animate-pulse"
            style={{ backgroundColor: accent }}
          />
          <span className="text-xs font-semibold tracking-wide text-foreground">
            {label}
          </span>
          <span className="hidden sm:inline-block rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-muted-foreground border border-white/10">
            {symbol}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Direct TradingView Native App Launch Button */}
          <button
            type="button"
            onClick={openFullTradingView}
            className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-[11px] font-medium text-primary transition-all shadow-sm"
            title="Open official TradingView web page for this chart"
          >
            <span>Open in TradingView</span>
            <ExternalLink className="size-3" />
          </button>

          {/* Fullscreen Expand Button */}
          <button
            type="button"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            onClick={toggleFullscreen}
            className="grid size-7 place-items-center rounded-lg border border-border/80 bg-surface-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {isFullscreen ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Real TradingView Canvas Container */}
      <div
        id={containerId}
        style={{
          height: isFullscreen ? "calc(100vh - 44px)" : height,
          width: "100%",
        }}
      />
    </div>
  );
}

/* ─────────────────────── Page ─────────────────────────────────── */
function LiveChartPage() {
  const [viewMode, setViewMode] = useState<"focus" | "grid">("focus");
  const [focusedId, setFocusedId] = useState<string>("btc");
  const [activeBgTheme, setActiveBgTheme] = useState<BgTheme>(BG_THEMES[0]!);

  const focusedChart: PresetChart =
    PRESET_CHARTS.find((c) => c.id === focusedId) ?? PRESET_CHARTS[0]!;

  return (
    <AppLayout
      title="Live Charts"
      subtitle="Real-time BTC · Gold (XAU) · WTI Oil — powered by TradingView"
    >
      <div className="flex flex-col gap-3">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-1/80 p-2.5 backdrop-blur-md">
          {/* View Mode Toggle: Single Focus vs 3-Grid */}
          <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setViewMode("focus")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                viewMode === "focus"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Monitor className="size-3.5" />
              <span>Single Chart (Maximized)</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Grid2X2 className="size-3.5" />
              <span>3-Chart Grid</span>
            </button>
          </div>

          {/* Focused Asset Switcher Pills */}
          {viewMode === "focus" && (
            <div className="flex items-center gap-1.5">
              {PRESET_CHARTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFocusedId(c.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                    focusedId === c.id
                      ? "border-primary/50 bg-primary/15 text-primary font-semibold shadow-sm"
                      : "border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.accent }}
                  />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Background Theme Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground hidden lg:inline">
              Background:
            </span>
            <div className="flex items-center gap-1">
              {BG_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setActiveBgTheme(theme)}
                  title={`Switch to ${theme.label}`}
                  className={cn(
                    "flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-all",
                    activeBgTheme.id === theme.id
                      ? "border-primary text-primary bg-primary/10 font-medium"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-surface-2",
                  )}
                >
                  <span
                    className="size-2.5 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: theme.bg }}
                  />
                  <span className="text-[10px]">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Charts View */}
        {viewMode === "focus" ? (
          <div className="w-full">
            <TradingViewChart
              key={`focus_${focusedChart.id}`}
              id={`focus_${focusedChart.id}`}
              symbol={focusedChart.symbol}
              label={focusedChart.label}
              tvSymbol={focusedChart.tvSymbol}
              accent={focusedChart.accent}
              bgTheme={activeBgTheme}
              height="750px"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {PRESET_CHARTS.map((c) => (
              <TradingViewChart
                key={`grid_${c.id}`}
                id={`grid_${c.id}`}
                symbol={c.symbol}
                label={c.label}
                tvSymbol={c.tvSymbol}
                accent={c.accent}
                bgTheme={activeBgTheme}
                height="560px"
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
