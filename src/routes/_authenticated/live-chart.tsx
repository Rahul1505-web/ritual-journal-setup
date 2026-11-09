import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import {
  ExternalLink,
  Grid2X2,
  Maximize2,
  Minimize2,
  Monitor,
  GripVertical,
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

/* ──────────────────── Favorite Drawing Tools Toolbar ──────────────────── */
interface DrawingToolDef {
  id: string;
  name: string;
  shortcut?: string;
  icon: (active: boolean) => React.ReactNode;
}

const FAVORITE_TOOLS: DrawingToolDef[] = [
  {
    id: "trendline",
    name: "Trend Line (Alt + T)",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="5" cy="19" r="2.5" />
        <circle cx="19" cy="5" r="2.5" />
        <line x1="7.2" y1="16.8" x2="16.8" y2="7.2" />
      </svg>
    ),
  },
  {
    id: "fib-retrace",
    name: "Fibonacci Retracement (Alt + F)",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="18" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
        <circle cx="19.5" cy="12" r="1.5" />
      </svg>
    ),
  },
  {
    id: "fib-ext",
    name: "Trend-Based Fib Extension",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="3" y1="5" x2="21" y2="5" />
        <circle cx="5" cy="5" r="1.5" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="19" x2="21" y2="19" />
        <text x="10" y="16" fontSize="7" fill="currentColor" fontWeight="bold">s</text>
      </svg>
    ),
  },
  {
    id: "text",
    name: "Text (T)",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="12" y1="6" x2="12" y2="19" />
        <line x1="9" y1="19" x2="15" y2="19" />
      </svg>
    ),
  },
  {
    id: "brush",
    name: "Brush / Pencil (Alt + B)",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18.3 4.2c-1.4-1.4-3.6-1.4-5 0L5 12.5V17h4.5l8.8-8.8c1.4-1.4 1.4-3.6 0-5z" />
        <path d="M12.5 7l4.5 4.5" />
      </svg>
    ),
  },
  {
    id: "rectangle",
    name: "Rectangle (Alt + Shift + R)",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="5" y="6" width="14" height="12" rx="1.5" />
        <circle cx="5" cy="6" r="1.5" fill="currentColor" />
        <circle cx="19" cy="6" r="1.5" fill="currentColor" />
        <circle cx="5" cy="18" r="1.5" fill="currentColor" />
        <circle cx="19" cy="18" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "polyline",
    name: "Path / Polyline",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="4,18 10,12 15,15 20,6" />
        <circle cx="4" cy="18" r="1.8" />
        <circle cx="10" cy="12" r="1.8" />
        <circle cx="15" cy="15" r="1.8" />
        <polyline points="16,6 20,6 20,10" />
      </svg>
    ),
  },
  {
    id: "vertical-line",
    name: "Vertical Line (Alt + V)",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="12" y1="3" x2="12" y2="21" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    id: "channel",
    name: "Parallel Channel",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="4" y1="18" x2="16" y2="6" />
        <line x1="8" y1="20" x2="20" y2="8" />
        <circle cx="4" cy="18" r="1.5" />
        <circle cx="16" cy="6" r="1.5" />
        <circle cx="8" cy="20" r="1.5" />
        <circle cx="20" cy="8" r="1.5" />
      </svg>
    ),
  },
  {
    id: "callout",
    name: "Callout / Flag",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 21V4l14 5-14 5" />
        <circle cx="4" cy="21" r="1.5" />
      </svg>
    ),
  },
  {
    id: "speech",
    name: "Comment / Speech Bubble",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 15a3 3 0 0 1-3 3H7l-4 3V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v9z" />
      </svg>
    ),
  },
  {
    id: "balloon",
    name: "Balloon / Price Tag",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 6a5 5 0 0 1 10 0c0 4-5 9-5 9s-5-5-5-9z" />
        <line x1="10" y1="15" x2="10" y2="21" />
      </svg>
    ),
  },
  {
    id: "long-position",
    name: "Long Position Tool",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="6" width="16" height="6" fill="#10b981" fillOpacity="0.2" stroke="#10b981" />
        <rect x="4" y="12" width="16" height="6" fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" />
        <circle cx="5" cy="12" r="1.5" fill="currentColor" />
        <text x="11" y="10.5" fontSize="6" fill="#10b981" fontWeight="bold">L</text>
      </svg>
    ),
  },
  {
    id: "horizontal-line",
    name: "Horizontal Line (Alt + H)",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="3" y1="12" x2="21" y2="12" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    id: "candlestick-pattern",
    name: "Candlestick Patterns",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="7" y1="4" x2="7" y2="20" />
        <rect x="5.5" y="8" width="3" height="7" rx="0.5" fill="currentColor" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <rect x="10.5" y="6" width="3" height="9" rx="0.5" fill="currentColor" />
        <line x1="17" y1="5" x2="17" y2="19" />
        <rect x="15.5" y="10" width="3" height="6" rx="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "volume-profile",
    name: "Volume Profile / Fixed Range",
    icon: (a) => (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="5" y1="3" x2="5" y2="21" />
        <line x1="5" y1="6" x2="14" y2="6" />
        <line x1="5" y1="9" x2="19" y2="9" />
        <line x1="5" y1="12" x2="16" y2="12" />
        <line x1="5" y1="15" x2="20" y2="15" />
        <line x1="5" y1="18" x2="11" y2="18" />
        <circle cx="5" cy="21" r="1.5" />
      </svg>
    ),
  },
];

/* ──────────────── Draggable Floating Favorites Bar ──────────────── */
function FloatingDrawingToolbar({
  activeTool,
  onSelectTool,
}: {
  activeTool: string;
  onSelectTool: (id: string) => void;
}) {
  const [pos, setPos] = useState({ x: 24, y: 14 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({
        x: Math.max(8, dragRef.current.initX + dx),
        y: Math.max(8, dragRef.current.initY + dy),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
      }}
      className={cn(
        "absolute z-30 flex items-center gap-0.5 rounded-lg border border-[#2a2e39] bg-[#1e222d]/95 backdrop-blur-md px-1.5 py-1 shadow-2xl transition-shadow select-none",
        isDragging && "ring-2 ring-primary/50 shadow-primary/20",
      )}
    >
      {/* 6-dot drag handle :: */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center cursor-grab active:cursor-grabbing px-1 py-1 text-[#787b86] hover:text-[#d1d4dc] transition-colors"
        title="Drag Favorites Toolbar"
      >
        <GripVertical className="size-4 shrink-0" />
      </div>

      <div className="h-4 w-px bg-[#2a2e39] mx-0.5" />

      {/* Tool Icons */}
      <div className="flex items-center gap-0.5 overflow-x-auto max-w-[85vw] no-scrollbar">
        {FAVORITE_TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              title={tool.name}
              className={cn(
                "grid size-7 place-items-center rounded-md transition-all duration-150 shrink-0",
                isActive
                  ? "bg-primary/25 text-primary border border-primary/40 shadow-sm"
                  : "text-[#b2b5be] hover:bg-white/10 hover:text-white",
              )}
            >
              {tool.icon(isActive)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────── TradingView Chart Card ───────────────────── */
function TradingViewChart({
  symbol,
  label,
  tvSymbol,
  accent,
  bgTheme,
  height = "640px",
  allowChangeSymbol = true,
  showFloatingBar = true,
}: {
  symbol: string;
  label: string;
  tvSymbol: string;
  accent: string;
  bgTheme: BgTheme;
  height?: string;
  allowChangeSymbol?: boolean;
  showFloatingBar?: boolean;
}) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<string>("trendline");

  const openFullTradingView = () => {
    const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const buildWidget = useCallback(() => {
    if (!widgetRef.current) return;
    widgetRef.current.innerHTML = "";

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    container.style.height = "100%";
    container.style.width = "100%";

    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.height = "100%";
    inner.style.width = "100%";
    container.appendChild(inner);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "15",
      timezone: "Asia/Kolkata",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: bgTheme.bg,
      gridColor: "rgba(255, 255, 255, 0.04)",
      enable_publishing: false,
      allow_symbol_change: allowChangeSymbol,
      /* ── Full Left Tools & Drawing Toolbars ── */
      hide_top_toolbar: false,
      hide_side_toolbar: false, // Drawings: pencil, trend lines, fib, boxes, measure
      hide_legend: false,
      save_image: true,
      withdateranges: true,
      show_popup_button: true,
      popup_width: "1280",
      popup_height: "800",
      details: false,
      hotlist: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);
    widgetRef.current.appendChild(container);
  }, [symbol, bgTheme, allowChangeSymbol]);

  useEffect(() => {
    buildWidget();
    return () => {
      if (widgetRef.current) widgetRef.current.innerHTML = "";
    };
  }, [buildWidget]);

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

      {/* Chart Stage & Overlaid Floating Drawing Tools Toolbar */}
      <div className="relative flex-1 w-full min-h-0">
        {showFloatingBar && (
          <FloatingDrawingToolbar
            activeTool={activeTool}
            onSelectTool={(id) => setActiveTool(id)}
          />
        )}

        <div
          ref={widgetRef}
          style={{
            height: isFullscreen ? "calc(100vh - 44px)" : height,
            width: "100%",
          }}
        />
      </div>
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
              key={focusedChart.id}
              symbol={focusedChart.symbol}
              label={focusedChart.label}
              tvSymbol={focusedChart.tvSymbol}
              accent={focusedChart.accent}
              bgTheme={activeBgTheme}
              height="740px"
              showFloatingBar={true}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {PRESET_CHARTS.map((c) => (
              <TradingViewChart
                key={c.id}
                symbol={c.symbol}
                label={c.label}
                tvSymbol={c.tvSymbol}
                accent={c.accent}
                bgTheme={activeBgTheme}
                height="560px"
                showFloatingBar={true}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
