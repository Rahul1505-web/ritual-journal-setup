import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import {
  ExternalLink,
  Grid2X2,
  Maximize2,
  Minimize2,
  Monitor,
  Sparkles,
  Star,
  Info,
  X,
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

/* ─────────────────── TradingView Chart Card ───────────────────── */
function TradingViewChart({
  symbol,
  label,
  tvSymbol,
  accent,
  bgTheme,
  height = "560px",
  allowChangeSymbol = true,
}: {
  symbol: string;
  label: string;
  tvSymbol: string;
  accent: string;
  bgTheme: BgTheme;
  height?: string;
  allowChangeSymbol?: boolean;
}) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const openFullTradingView = () => {
    // Opens TradingView's full web application with right-click settings, alerts, orders, templates
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
      /* ── Full Tools & Drawing Toolbars ── */
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
      /* ── Favorites & Tool Starring Features ── */
      enabled_features: [
        "items_favoriting",
        "show_favorite_drawing_tools_toolbar",
        "side_toolbar_in_fullscreen_mode",
        "header_settings",
      ],
      disabled_features: [],
      favorites: {
        drawingTools: [
          "LineToolTrendLine",
          "LineToolRay",
          "LineToolFibRetracement",
          "LineToolRectangle",
          "LineToolBrush",
          "LineToolText",
          "LineToolCallout",
        ],
      },
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
        className="flex items-center justify-between gap-3 px-4 py-2.5 border-b shrink-0 select-none"
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
            title="Open official TradingView web page with starred favorites, Right-Click Settings, Cloud Templates, Alerts, and Broker Execution"
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

      {/* Widget Container */}
      <div
        ref={widgetRef}
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
  const [viewMode, setViewMode] = useState<"grid" | "focus">("grid");
  const [focusedId, setFocusedId] = useState<string>("btc");
  const [activeBgTheme, setActiveBgTheme] = useState<BgTheme>(BG_THEMES[0]!);
  const [showStarGuide, setShowStarGuide] = useState<boolean>(false);

  const focusedChart: PresetChart =
    PRESET_CHARTS.find((c) => c.id === focusedId) ?? PRESET_CHARTS[0]!;

  return (
    <AppLayout
      title="Live Charts"
      subtitle="Real-time BTC · Gold (XAU) · WTI Oil — powered by TradingView"
    >
      <div className="flex flex-col gap-4">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-1/80 p-3 backdrop-blur-md">
          {/* View Mode Toggle: Grid vs Focus */}
          <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-surface-2 p-1">
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
          </div>

          {/* Focused Asset Switcher Pills (Visible when in Focus mode) */}
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

          {/* Action Tools & Theme Selector */}
          <div className="flex items-center gap-3">
            {/* Star Tool Guide Button */}
            <button
              type="button"
              onClick={() => setShowStarGuide((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                showStarGuide
                  ? "border-amber-400/50 bg-amber-400/15 text-amber-300 font-semibold shadow-sm"
                  : "border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground",
              )}
              title="How to Star & Pin favorite drawing tools into the floating toolbar"
            >
              <Star className={cn("size-3.5", showStarGuide ? "fill-amber-400 text-amber-400" : "text-amber-400")} />
              <span>Favorite Tools Bar Guide</span>
            </button>

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
        </div>

        {/* Favorite Drawings Interactive Guide Banner */}
        {showStarGuide && (
          <div className="relative rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-surface-1 to-surface-1 p-4 shadow-xl animate-in fade-in slide-in-from-top-2">
            <button
              type="button"
              onClick={() => setShowStarGuide(false)}
              className="absolute top-3 right-3 grid size-6 place-items-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/30">
                <Star className="size-5 fill-amber-400" />
              </span>
              <div className="flex-1 min-w-0 pr-6">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span>How to Star Tools to create your Floating Favorites Toolbar:</span>
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  TradingView lets you pin your most-used drawing tools (Trendlines, Fibonacci, Rectangles, Brush, Text) into the floating quick-access bar shown in your screenshot.
                </p>

                {/* Steps Grid */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2.5">
                  <div className="rounded-xl border border-border/70 bg-surface-2/60 p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <span className="grid size-5 place-items-center rounded-full bg-primary/20 text-primary text-[10px]">1</span>
                      <span>Left Toolbar</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Hover over any tool icon on the left (e.g. Lines, Fib, Shapes).
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-surface-2/60 p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <span className="grid size-5 place-items-center rounded-full bg-primary/20 text-primary text-[10px]">2</span>
                      <span>Click Arrow (▶)</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Click the small arrow next to the tool to expand its flyout list.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-surface-2/60 p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <span className="grid size-5 place-items-center rounded-full bg-amber-400/20 text-amber-300 text-[10px]">3</span>
                      <span>Click the Star (⭐)</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Hover over any drawing tool in the list and click the Star icon on the right!
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-surface-2/60 p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <span className="grid size-5 place-items-center rounded-full bg-emerald-400/20 text-emerald-300 text-[10px]">4</span>
                      <span>Floating Bar Appears!</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Drag the 6-dot handle (<GripVertical className="inline size-3" />) to move your favorites bar anywhere on the screen!
                    </p>
                  </div>
                </div>

                {/* Pro tip */}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Info className="size-3.5 text-primary shrink-0" />
                    <span>
                      Tip: Clicking <strong>"Open in TradingView"</strong> on any chart syncs all your starred favorite tools directly to your personal TradingView cloud account!
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Banner Explaining Full TradingView Integration */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary shrink-0" />
            <span>
              All drawing tools are active. Hover over any tool on the left toolbar & click the <strong>Star (⭐)</strong> to show your floating Favorites Toolbar.
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              window.open(
                "https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT",
                "_blank",
                "noopener,noreferrer",
              )
            }
            className="hidden md:flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0"
          >
            Launch Web App <ExternalLink className="size-3" />
          </button>
        </div>

        {/* Charts View */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {PRESET_CHARTS.map((c) => (
              <TradingViewChart
                key={c.id}
                symbol={c.symbol}
                label={c.label}
                tvSymbol={c.tvSymbol}
                accent={c.accent}
                bgTheme={activeBgTheme}
                height="540px"
              />
            ))}
          </div>
        ) : (
          <div className="w-full">
            <TradingViewChart
              key={focusedChart.id}
              symbol={focusedChart.symbol}
              label={focusedChart.label}
              tvSymbol={focusedChart.tvSymbol}
              accent={focusedChart.accent}
              bgTheme={activeBgTheme}
              height="750px"
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
