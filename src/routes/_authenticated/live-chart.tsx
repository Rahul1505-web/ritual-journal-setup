import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { FootprintCanvas, type FootprintCanvasRef } from "@/components/footprint/FootprintCanvas";
import { FootprintToolbar } from "@/components/footprint/FootprintToolbar";
import { SnapSetupModal } from "@/components/footprint/SnapSetupModal";
import { OrderFlowEngine } from "@/lib/order-flow/order-flow-engine";
import type {
  FootprintCandle,
  FootprintPriceLevel,
  MarketTicker,
  OrderFlowSettings,
} from "@/lib/order-flow/types";

export const Route = createFileRoute("/_authenticated/live-chart")({
  head: () => ({
    meta: [
      { title: "Live BTC Footprint & Order Flow Terminal — TradeLog Pro" },
      {
        name: "description",
        content:
          "Real-time institutional Bitcoin footprint chart, Bid x Ask volume clusters, Point of Control (POC), Cumulative Volume Delta (CVD) and imbalance detection.",
      },
    ],
  }),
  component: LiveChartPage,
});

function LiveChartPage() {
  const canvasRef = useRef<FootprintCanvasRef>(null);

  // Default Order Flow Settings
  const [settings, setSettings] = useState<OrderFlowSettings>({
    symbol: "BTCUSDT",
    interval: "1m",
    tickSize: 10,
    imbalanceRatio: 3.0,
    minImbalanceQty: 0.05,
    displayMode: "bidxask",
    showPoc: true,
    showCvd: true,
    showStackedImbalances: true,
    clusterColorTheme: "classic",
  });

  // Live State
  const [candles, setCandles] = useState<FootprintCandle[]>([]);
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "disconnected"
  >("connecting");

  // Hovered Level Info
  const [hoveredLevelInfo, setHoveredLevelInfo] = useState<{
    candle: FootprintCandle;
    level: FootprintPriceLevel;
    price: number;
  } | null>(null);

  // Snap & Log Modal
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  // Initialize OrderFlowEngine instance
  const engine = useMemo(() => new OrderFlowEngine(settings), [settings.symbol, settings.interval]);

  useEffect(() => {
    // Sync settings if changed (e.g. tickSize, ratio)
    engine.updateSettings(settings);
  }, [settings, engine]);

  useEffect(() => {
    const unsubCandles = engine.onCandles((updated) => setCandles(updated));
    const unsubTicker = engine.onTicker((updated) => setTicker(updated));
    const unsubConn = engine.onConnection((status) => setConnectionStatus(status));

    void engine.start();

    return () => {
      unsubCandles();
      unsubTicker();
      unsubConn();
      engine.stop();
    };
  }, [engine]);

  const handleUpdateSettings = (newSettings: Partial<OrderFlowSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleSnapSetup = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.captureScreenshot();
      if (dataUrl) {
        setSnapshotUrl(dataUrl);
      }
    }
  };

  const lastCandle = candles[candles.length - 1];
  const currentDelta = lastCandle ? lastCandle.delta : undefined;

  return (
    <AppLayout
      title="Live Footprint Terminal"
      subtitle="Real-time institutional Order Flow, Bid × Ask clusters & Cumulative Volume Delta (CVD)"
      fullHeight
    >
      <div className="flex flex-col flex-1 h-[calc(100vh-4.5rem)] min-h-[500px] overflow-hidden bg-[#07080b] rounded-2xl border border-border/80 shadow-2xl relative">
        {/* Footprint Controls & Ticker Header */}
        <FootprintToolbar
          settings={settings}
          ticker={ticker}
          connectionStatus={connectionStatus}
          currentDelta={currentDelta}
          onUpdateSettings={handleUpdateSettings}
          onSnapSetup={handleSnapSetup}
        />

        {/* Main Footprint Canvas */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
          <FootprintCanvas
            ref={canvasRef}
            candles={candles}
            settings={settings}
            livePrice={ticker?.price}
            onHoverLevel={setHoveredLevelInfo}
          />

          {/* Hover Level Inspector Pill (Floats in top left of chart) */}
          {hoveredLevelInfo && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-surface-1/90 backdrop-blur-md border border-border shadow-lg font-mono text-xs animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Level:</span>
                <span className="font-bold text-foreground">
                  ${hoveredLevelInfo.level.price.toLocaleString()}
                </span>
              </div>
              <div className="h-3 w-px bg-border/80" />
              <div className="flex items-center gap-1 text-rose-400">
                <span className="text-[10px] opacity-75">Bid:</span>
                <span className="font-semibold">{hoveredLevelInfo.level.bidVolume.toFixed(2)}</span>
              </div>
              <span className="text-muted-foreground/60">×</span>
              <div className="flex items-center gap-1 text-emerald-400">
                <span className="text-[10px] opacity-75">Ask:</span>
                <span className="font-semibold">{hoveredLevelInfo.level.askVolume.toFixed(2)}</span>
              </div>
              <div className="h-3 w-px bg-border/80" />
              <div
                className={`font-semibold ${
                  hoveredLevelInfo.level.delta >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                Δ {hoveredLevelInfo.level.delta >= 0 ? "+" : ""}
                {hoveredLevelInfo.level.delta.toFixed(2)}
              </div>

              {hoveredLevelInfo.level.isBuyImbalance && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                  BUY IMBALANCE
                </span>
              )}
              {hoveredLevelInfo.level.isSellImbalance && (
                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold text-[10px] border border-rose-500/30">
                  SELL IMBALANCE
                </span>
              )}
              {hoveredLevelInfo.level.price === hoveredLevelInfo.candle.pocPrice && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold text-[10px] border border-amber-500/30">
                  POC
                </span>
              )}
            </div>
          )}

          {/* Quick Guidance Footer Note */}
          <div className="absolute bottom-2 left-3 z-10 pointer-events-none text-[10px] text-muted-foreground/50 font-mono">
            <span>Scroll: Zoom candles · Shift+Scroll: Zoom price · Drag: Pan · Left: Bid (Sellers) × Right: Ask (Buyers) · Gold Box: POC</span>
          </div>
        </div>

        {/* Snap Setup Modal */}
        {snapshotUrl && ticker && (
          <SnapSetupModal
            screenshotUrl={snapshotUrl}
            symbol={settings.symbol}
            price={ticker.price}
            delta={currentDelta || 0}
            interval={settings.interval}
            onClose={() => setSnapshotUrl(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
