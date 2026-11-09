import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Maximize2, Minimize2, Palette, X } from "lucide-react";
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

/* ─────────────────────────── Types ─────────────────────────── */
interface ChartColors {
  upColor: string;
  downColor: string;
  borderUpColor: string;
  borderDownColor: string;
  wickUpColor: string;
  wickDownColor: string;
  background: string;
}

const DEFAULT_COLORS: ChartColors = {
  upColor: "#26a69a",
  downColor: "#ef5350",
  borderUpColor: "#26a69a",
  borderDownColor: "#ef5350",
  wickUpColor: "#26a69a",
  wickDownColor: "#ef5350",
  background: "#131722",
};

const CHARTS = [
  { symbol: "BINANCE:BTCUSDT", label: "BTC / USDT", id: "btc", accent: "#f7931a" },
  { symbol: "TVC:GOLD", label: "XAU / USD  ·  Gold", id: "xau", accent: "#ffd700" },
  { symbol: "TVC:USOIL", label: "WTI Crude Oil", id: "oil", accent: "#6cb4ee" },
];

/* ─────────────────── Color Picker Panel ──────────────────────── */
function ColorPanel({
  colors,
  onChange,
  onClose,
}: {
  colors: ChartColors;
  onChange: (c: ChartColors) => void;
  onClose: () => void;
}) {
  const fields: { key: keyof ChartColors; label: string }[] = [
    { key: "upColor", label: "Bull Candle Body" },
    { key: "downColor", label: "Bear Candle Body" },
    { key: "borderUpColor", label: "Bull Border" },
    { key: "borderDownColor", label: "Bear Border" },
    { key: "wickUpColor", label: "Bull Wick" },
    { key: "wickDownColor", label: "Bear Wick" },
    { key: "background", label: "Chart Background" },
  ];

  return (
    <div className="absolute top-12 right-2 z-50 w-64 rounded-2xl border border-border bg-surface-1 shadow-2xl p-4 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-foreground">Chart Colors</span>
        <button
          type="button"
          onClick={onClose}
          className="grid size-6 place-items-center rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="space-y-2.5">
        {fields.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <label className="text-[11px] text-muted-foreground leading-tight">{label}</label>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-muted-foreground/70">
                {colors[key]}
              </span>
              <label className="relative cursor-pointer">
                <span
                  className="block size-6 rounded-md border-2 border-border shadow-inner cursor-pointer"
                  style={{ backgroundColor: colors[key] }}
                />
                <input
                  type="color"
                  value={colors[key]}
                  onChange={(e) => onChange({ ...colors, [key]: e.target.value })}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange(DEFAULT_COLORS)}
        className="mt-3 w-full rounded-lg border border-border py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors"
      >
        Reset to Default
      </button>
    </div>
  );
}

/* ─────────────────── TradingView Chart Card ───────────────────── */
function TradingViewChart({
  symbol,
  label,
  accent,
  colors,
}: {
  symbol: string;
  label: string;
  accent: string;
  colors: ChartColors;
}) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [localColors, setLocalColors] = useState<ChartColors>(colors);

  // Sync when parent colors change
  useEffect(() => {
    setLocalColors(colors);
  }, [colors]);

  const buildWidget = useCallback(() => {
    if (!widgetRef.current) return;
    widgetRef.current.innerHTML = "";

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    container.style.height = "100%";
    container.style.width = "100%";

    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.height = "calc(100% - 32px)";
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
      enable_publishing: false,
      allow_symbol_change: true,
      /* ── Show all tools ── */
      hide_top_toolbar: false,
      hide_side_toolbar: false,  // ← drawing tools: pencil, lines, rectangle, fib etc.
      hide_legend: false,
      save_image: true,
      withdateranges: true,
      details: false,
      hotlist: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
      /* ── Candle & background color overrides ── */
      overrides: {
        "mainSeriesProperties.candleStyle.upColor": localColors.upColor,
        "mainSeriesProperties.candleStyle.downColor": localColors.downColor,
        "mainSeriesProperties.candleStyle.borderUpColor": localColors.borderUpColor,
        "mainSeriesProperties.candleStyle.borderDownColor": localColors.borderDownColor,
        "mainSeriesProperties.candleStyle.wickUpColor": localColors.wickUpColor,
        "mainSeriesProperties.candleStyle.wickDownColor": localColors.wickDownColor,
        "paneProperties.background": localColors.background,
        "paneProperties.backgroundType": "solid",
      },
    });
    container.appendChild(script);
    widgetRef.current.appendChild(container);
  }, [symbol, localColors]);

  // Rebuild widget whenever colors or symbol change
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

  const handleColorsChange = (c: ChartColors) => {
    setLocalColors(c);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "flex flex-col rounded-2xl border border-border overflow-hidden shadow-lg bg-[#131722] relative",
        isFullscreen && "rounded-none border-none",
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60 shrink-0"
        style={{ backgroundColor: `${accent}18` }}
      >
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
          <span className="text-xs font-semibold text-foreground tracking-wide">{label}</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Color palette button */}
          <button
            type="button"
            title="Customize candle colors"
            onClick={() => setShowColors((v) => !v)}
            className={cn(
              "grid size-7 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
              showColors && "bg-primary/20 text-primary border-primary/40",
            )}
          >
            <Palette className="size-3.5" />
          </button>

          {/* Fullscreen button */}
          <button
            type="button"
            title={isFullscreen ? "Exit fullscreen" : "Open fullscreen"}
            onClick={toggleFullscreen}
            className="grid size-7 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {isFullscreen ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Color panel */}
      {showColors && (
        <ColorPanel
          colors={localColors}
          onChange={handleColorsChange}
          onClose={() => setShowColors(false)}
        />
      )}

      {/* TradingView widget */}
      <div
        ref={widgetRef}
        style={{
          height: isFullscreen ? "calc(100vh - 48px)" : "520px",
          width: "100%",
        }}
      />
    </div>
  );
}

/* ─────────────────────── Page ─────────────────────────────────── */
function LiveChartPage() {
  const [globalColors] = useState<ChartColors>(DEFAULT_COLORS);

  return (
    <AppLayout
      title="Live Charts"
      subtitle="Real-time BTC · Gold (XAU) · WTI Oil — powered by TradingView"
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {CHARTS.map((c) => (
          <TradingViewChart
            key={c.id}
            symbol={c.symbol}
            label={c.label}
            accent={c.accent}
            colors={globalColors}
          />
        ))}
      </div>
    </AppLayout>
  );
}
