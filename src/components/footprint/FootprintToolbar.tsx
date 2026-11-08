import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Camera,
  Activity,
  Flame,
  Layers,
  ChevronDown,
  Sparkles,
  Download,
  BookOpen,
  PlusCircle,
  Bot,
  Settings2,
  Check,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketTicker, OrderFlowSettings, FootprintDisplayMode } from "@/lib/order-flow/types";
import { cn } from "@/lib/utils";

interface FootprintToolbarProps {
  settings: OrderFlowSettings;
  ticker: MarketTicker | null;
  connectionStatus: "connecting" | "connected" | "reconnecting" | "disconnected";
  currentDelta?: number | undefined;
  onUpdateSettings: (newSettings: Partial<OrderFlowSettings>) => void;
  onSnapSetup: () => void;
}

export function FootprintToolbar({
  settings,
  ticker,
  connectionStatus,
  currentDelta,
  onUpdateSettings,
  onSnapSetup,
}: FootprintToolbarProps) {
  const [showConfigDropdown, setShowConfigDropdown] = useState(false);

  const symbols = [
    { label: "BTC/USDT", value: "BTCUSDT", icon: "₿", tickSizes: [5, 10, 25, 50] },
    { label: "ETH/USDT", value: "ETHUSDT", icon: "Ξ", tickSizes: [0.5, 1, 2, 5] },
    { label: "SOL/USDT", value: "SOLUSDT", icon: "◎", tickSizes: [0.1, 0.25, 0.5, 1] },
  ];

  const currentSymConfig = symbols.find((s) => s.value === settings.symbol) || symbols[0]!;

  const timeframes: Array<"1m" | "3m" | "5m" | "15m"> = ["1m", "3m", "5m", "15m"];

  const displayModes: Array<{ label: string; mode: FootprintDisplayMode; icon: any }> = [
    { label: "Bid × Ask", mode: "bidxask", icon: Layers },
    { label: "Delta", mode: "delta", icon: Flame },
    { label: "Volume", mode: "volume", icon: Activity },
  ];

  const formatPrice = (p: number) => {
    if (p >= 1000) return p.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    return p.toFixed(2);
  };

  return (
    <div className="flex flex-col border-b border-border bg-surface-1/90 backdrop-blur-md px-3 py-2 gap-2 shrink-0">
      {/* Top Row: Symbol, Ticker metrics, Connection, Snap Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Symbol & Timeframe pills */}
        <div className="flex items-center gap-2">
          {/* Symbol Selectors */}
          <div className="flex items-center p-0.5 rounded-xl bg-surface-2 border border-border">
            {symbols.map((sym) => {
              const isSelected = settings.symbol === sym.value;
              return (
                <button
                  key={sym.value}
                  type="button"
                  onClick={() => {
                    const defaultTick = sym.tickSizes[1] || sym.tickSizes[0] || 10;
                    onUpdateSettings({ symbol: sym.value, tickSize: defaultTick });
                  }}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs scale-102"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-3",
                  )}
                >
                  <span className="font-mono text-[11px] opacity-80">{sym.icon}</span>
                  <span>{sym.label.replace("/USDT", "")}</span>
                </button>
              );
            })}
          </div>

          {/* Timeframe Selectors */}
          <div className="flex items-center p-0.5 rounded-xl bg-surface-2 border border-border">
            {timeframes.map((tf) => {
              const isSelected = settings.interval === tf;
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => onUpdateSettings({ interval: tf })}
                  className={cn(
                    "px-2 py-1 rounded-lg text-xs font-medium transition-all select-none",
                    isSelected
                      ? "bg-primary/20 text-primary font-bold border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-3",
                  )}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          {/* Connection Status Pill */}
          <div
            className={cn(
              "hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border",
              connectionStatus === "connected"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : connectionStatus === "connecting" || connectionStatus === "reconnecting"
                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                : "bg-rose-500/10 text-rose-500 border-rose-500/20",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                connectionStatus === "connected"
                  ? "bg-emerald-500 animate-pulse"
                  : connectionStatus === "connecting"
                  ? "bg-amber-500 animate-ping"
                  : "bg-rose-500",
              )}
            />
            <span className="capitalize">{connectionStatus === "connected" ? "Live Stream" : connectionStatus}</span>
          </div>
        </div>

        {/* Center: Live Price & 24h Stats */}
        {ticker && (
          <div className="flex items-center gap-4 text-xs">
            {/* Live Price with side highlight */}
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-muted-foreground text-[11px]">Price:</span>
              <span
                className={cn(
                  "font-bold text-sm tracking-tight px-1.5 py-0.5 rounded transition-colors",
                  ticker.lastTradeSide === "buy"
                    ? "text-emerald-400 bg-emerald-500/10"
                    : "text-rose-400 bg-rose-500/10",
                )}
              >
                ${formatPrice(ticker.price)}
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold px-1 rounded",
                  ticker.change24h >= 0 ? "text-emerald-500" : "text-rose-500",
                )}
              >
                {ticker.change24h >= 0 ? "+" : ""}
                {ticker.change24h.toFixed(2)}%
              </span>
            </div>

            {/* High / Low 24h */}
            <div className="hidden md:flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
              <div>
                <span className="opacity-70">24h H: </span>
                <span className="text-foreground">${formatPrice(ticker.high24h)}</span>
              </div>
              <div>
                <span className="opacity-70">24h L: </span>
                <span className="text-foreground">${formatPrice(ticker.low24h)}</span>
              </div>
            </div>

            {/* Current Delta Badge */}
            {currentDelta !== undefined && (
              <div
                className={cn(
                  "hidden lg:flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[11px] border font-semibold",
                  currentDelta >= 0
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20",
                )}
              >
                <Flame className="size-3" />
                <span>Delta: {currentDelta >= 0 ? "+" : ""}{currentDelta.toFixed(1)}</span>
              </div>
            )}
          </div>
        )}

        {/* Right: Snap Setup & Config Button */}
        <div className="flex items-center gap-2">
          {/* Snap Setup to Journal button */}
          <Button
            type="button"
            onClick={onSnapSetup}
            size="sm"
            className="h-8 gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs transition-transform active:scale-95"
            title="Take screenshot and log into Trade Log or Diary"
          >
            <Camera className="size-3.5" />
            <span className="hidden sm:inline">Snap &amp; Log</span>
          </Button>

          {/* Quick Settings Dropdown Toggle */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowConfigDropdown(!showConfigDropdown)}
            className="h-8 px-2.5 rounded-xl border-border bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-foreground"
            title="Configure Order Flow & Footprint settings"
          >
            <Settings2 className="size-3.5" />
            <ChevronDown className="size-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* Second Row: Mode Buttons (Bid x Ask / Delta / Vol) + Tick Size + POC toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
        {/* Footprint Display Mode Tabs */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Mode:</span>
          <div className="flex items-center p-0.5 rounded-lg bg-surface-2 border border-border">
            {displayModes.map((dm) => {
              const isSelected = settings.displayMode === dm.mode;
              const Icon = dm.icon;
              return (
                <button
                  key={dm.mode}
                  type="button"
                  onClick={() => onUpdateSettings({ displayMode: dm.mode })}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all select-none",
                    isSelected
                      ? "bg-primary/20 text-primary font-bold border border-primary/30"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3" />
                  <span>{dm.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tick Size & Imbalance Quick Buttons */}
        <div className="flex items-center gap-2">
          {/* Tick Size */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Tick:</span>
            <div className="flex items-center p-0.5 rounded-lg bg-surface-2 border border-border">
              {currentSymConfig.tickSizes.map((ts) => (
                <button
                  key={ts}
                  type="button"
                  onClick={() => onUpdateSettings({ tickSize: ts })}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-all",
                    settings.tickSize === ts
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  ${ts}
                </button>
              ))}
            </div>
          </div>

          {/* Imbalance Ratio */}
          <div className="hidden sm:flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Ratio:</span>
            <div className="flex items-center p-0.5 rounded-lg bg-surface-2 border border-border">
              {[2.5, 3.0, 4.0].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onUpdateSettings({ imbalanceRatio: r })}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-all",
                    settings.imbalanceRatio === r
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>

          {/* Point of Control (POC) Toggle */}
          <button
            type="button"
            onClick={() => onUpdateSettings({ showPoc: !settings.showPoc })}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium border transition-colors select-none",
              settings.showPoc
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "text-muted-foreground border-border hover:bg-surface-2",
            )}
            title="Toggle Point of Control (POC) Golden Box"
          >
            <span className="size-1.5 rounded-full bg-amber-400" />
            <span>POC</span>
          </button>
        </div>
      </div>

      {/* Quick Settings Drawer (if open) */}
      {showConfigDropdown && (
        <div className="p-3 my-1 rounded-xl bg-surface-2 border border-border/80 text-xs grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-1">
          <div>
            <span className="font-semibold text-foreground block mb-1">Imbalance Highlight Ratio</span>
            <p className="text-[11px] text-muted-foreground mb-2">
              Ratio of aggressive market buyers vs sellers diagonally (e.g. 3.0x = 300% volume surge).
            </p>
            <div className="flex items-center gap-2">
              {[2.0, 2.5, 3.0, 4.0, 5.0].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onUpdateSettings({ imbalanceRatio: val })}
                  className={cn(
                    "px-2 py-1 rounded-lg text-xs font-mono font-medium border",
                    settings.imbalanceRatio === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface-1 border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {val}x
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="font-semibold text-foreground block mb-1">Candle Price Tick Aggregation</span>
            <p className="text-[11px] text-muted-foreground mb-2">
              Bucket size for grouping trades into vertical cluster cells.
            </p>
            <div className="flex items-center gap-2">
              {currentSymConfig.tickSizes.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onUpdateSettings({ tickSize: val })}
                  className={cn(
                    "px-2 py-1 rounded-lg text-xs font-mono font-medium border",
                    settings.tickSize === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface-1 border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  ${val}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between">
            <div>
              <span className="font-semibold text-foreground block mb-1">Order Flow Features</span>
              <p className="text-[11px] text-muted-foreground mb-2">
                Toggle Cumulative Volume Delta (CVD) and Stacked Absorption alerts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ showPoc: !settings.showPoc })}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5",
                  settings.showPoc
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-surface-1 border-border text-muted-foreground",
                )}
              >
                <span>Golden POC</span>
                {settings.showPoc && <Check className="size-3" />}
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ showStackedImbalances: !settings.showStackedImbalances })}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5",
                  settings.showStackedImbalances
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-surface-1 border-border text-muted-foreground",
                )}
              >
                <span>Stacked Imbalances</span>
                {settings.showStackedImbalances && <Check className="size-3" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
