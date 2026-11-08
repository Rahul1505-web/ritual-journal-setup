import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import type { FootprintCandle, FootprintPriceLevel, OrderFlowSettings } from "@/lib/order-flow/types";

export interface FootprintCanvasRef {
  captureScreenshot: () => string | null;
  resetView: () => void;
}

interface FootprintCanvasProps {
  candles: FootprintCandle[];
  settings: OrderFlowSettings;
  livePrice?: number | undefined;
  onHoverLevel?: ((info: { candle: FootprintCandle; level: FootprintPriceLevel; price: number } | null) => void) | undefined;
}

export const FootprintCanvas = forwardRef<FootprintCanvasRef, FootprintCanvasProps>(
  ({ candles, settings, livePrice, onHoverLevel }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Zoom & Pan state
    const [candleWidth, setCandleWidth] = useState(120); // Width of each candle column in px
    const [cellHeight, setCellHeight] = useState(18); // Height of each price level in px
    const [panOffsetX, setPanOffsetX] = useState(0); // Horizontal scroll offset
    const [panOffsetY, setPanOffsetY] = useState(0); // Vertical price scroll offset
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number; y: number; initialOffsetX: number; initialOffsetY: number } | null>(null);

    // Crosshair state
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
    const [isAutoScrollToLatest, setIsAutoScrollToLatest] = useState(true);

    const formatVol = (val: number): string => {
      if (val >= 1000) return (val / 1000).toFixed(1) + "k";
      if (val >= 100) return val.toFixed(0);
      if (val >= 10) return val.toFixed(1);
      return val.toFixed(2);
    };

    const formatPrice = (p: number): string => {
      if (p >= 1000) return p.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
      if (p >= 1) return p.toFixed(2);
      return p.toFixed(4);
    };

    // Auto-align view to the latest candle when requested
    const alignToLatestCandle = useCallback(() => {
      const container = containerRef.current;
      if (!container || candles.length === 0) return;
      const width = container.clientWidth;
      const height = container.clientHeight;

      const rightMargin = 140; // Space on right for price axis & padding
      const latestX = (candles.length - 1) * (candleWidth + 16);
      const targetOffsetX = width - rightMargin - latestX;

      const lastCandle = candles[candles.length - 1];
      const targetPrice = livePrice || lastCandle?.close || 0;
      const chartAreaHeight = height - 120; // Excluding bottom CVD panel
      const targetOffsetY = chartAreaHeight / 2;

      setPanOffsetX(targetOffsetX);
      setPanOffsetY(targetOffsetY);
      setIsAutoScrollToLatest(true);
    }, [candles, candleWidth, livePrice]);

    useImperativeHandle(ref, () => ({
      captureScreenshot: () => {
        if (!canvasRef.current) return null;
        return canvasRef.current.toDataURL("image/png", 0.95);
      },
      resetView: () => {
        alignToLatestCandle();
      },
    }));

    // On initial mount or symbol change, auto-align to latest
    useEffect(() => {
      if (isAutoScrollToLatest && candles.length > 0) {
        alignToLatestCandle();
      }
    }, [candles.length, settings.symbol]);

    // Handle mouse drag & wheel interactions
    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      setIsDragging(true);
      setIsAutoScrollToLatest(false);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        initialOffsetX: panOffsetX,
        initialOffsetY: panOffsetY,
      };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }

      if (isDragging && dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPanOffsetX(dragStartRef.current.initialOffsetX + dx);
        setPanOffsetY(dragStartRef.current.initialOffsetY + dy);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      setIsAutoScrollToLatest(false);

      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        // Vertical price zoom (change cell height)
        const zoomDelta = e.deltaY < 0 ? 1 : -1;
        setCellHeight((prev) => Math.min(32, Math.max(12, prev + zoomDelta)));
      } else {
        // Horizontal candle zoom (spread footprint boxes)
        const zoomDelta = e.deltaY < 0 ? 8 : -8;
        setCandleWidth((prev) => Math.min(220, Math.max(40, prev + zoomDelta)));
      }
    };

    // ── MAIN CANVAS RENDERING LOOP ──
    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#0c0e14");
      bgGrad.addColorStop(1, "#07080b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const cvdPanelHeight = 90;
      const statsBarHeight = 44;
      const priceAxisWidth = 85;
      const chartHeight = height - cvdPanelHeight - statsBarHeight;
      const chartWidth = width - priceAxisWidth;

      // Price anchor level (use latest candle close as center anchor)
      const lastCandle = candles[candles.length - 1];
      const anchorPrice = livePrice || lastCandle?.close || 75000;
      const tickSize = settings.tickSize;

      // Function to map a price to Y coordinate
      const priceToY = (price: number): number => {
        const diffInTicks = (anchorPrice - price) / tickSize;
        return panOffsetY + diffInTicks * cellHeight;
      };

      const yToPrice = (y: number): number => {
        const diffInPixels = y - panOffsetY;
        const diffInTicks = diffInPixels / cellHeight;
        return anchorPrice - diffInTicks * tickSize;
      };

      // 1. Draw Subtle Background Horizontal Price Grid Lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "10px monospace";

      const visibleTopPrice = yToPrice(0);
      const visibleBottomPrice = yToPrice(chartHeight);
      const topTick = Math.ceil(visibleTopPrice / tickSize) * tickSize;
      const bottomTick = Math.floor(visibleBottomPrice / tickSize) * tickSize;

      const tickStep = cellHeight < 14 ? tickSize * 5 : tickSize * 2;
      for (let p = bottomTick; p <= topTick; p += tickStep) {
        const y = priceToY(p);
        if (y >= 0 && y <= chartHeight) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(chartWidth, y);
          ctx.stroke();

          // Price label on right axis
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          ctx.fillText(formatPrice(p), chartWidth + 8, y + 3);
        }
      }

      // 2. Draw Footprint Candles
      const candleSpacing = 14;
      const totalCandleSlot = candleWidth + candleSpacing;

      let hoveredItem: { candle: FootprintCandle; level: FootprintPriceLevel; price: number } | null = null;

      candles.forEach((c, cIdx) => {
        const candleX = panOffsetX + cIdx * totalCandleSlot;
        // Skip rendering if completely off screen
        if (candleX + candleWidth < -50 || candleX > chartWidth + 50) return;

        const isUp = c.close >= c.open;
        const candleCenter = candleX + candleWidth / 2;

        // Draw Candle Wick (connecting High and Low)
        const highY = priceToY(c.high);
        const lowY = priceToY(c.low);
        ctx.strokeStyle = isUp ? "rgba(16, 185, 129, 0.45)" : "rgba(244, 63, 94, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(candleCenter, highY);
        ctx.lineTo(candleCenter, lowY);
        ctx.stroke();

        // Find max level volume in this candle for relative heatmap shading
        let maxCandleVol = 1;
        for (const lvl of c.sortedLevels) {
          if (lvl.totalVolume > maxCandleVol) maxCandleVol = lvl.totalVolume;
        }

        // Draw Footprint Cells (Price levels from High to Low)
        c.sortedLevels.forEach((lvl) => {
          const levelY = priceToY(lvl.price);
          // Only draw if within chart visible viewport
          if (levelY < -cellHeight || levelY > chartHeight + cellHeight) return;

          const isPoc = settings.showPoc && lvl.price === c.pocPrice;
          const isMouseOver =
            mousePos &&
            mousePos.x >= candleX &&
            mousePos.x <= candleX + candleWidth &&
            mousePos.y >= levelY - cellHeight / 2 &&
            mousePos.y <= levelY + cellHeight / 2;

          if (isMouseOver) {
            hoveredItem = { candle: c, level: lvl, price: lvl.price };
          }

          // Volume intensity opacity (0.12 to 0.65)
          const volRatio = Math.min(1, lvl.totalVolume / maxCandleVol);
          const cellTop = levelY - cellHeight / 2;

          // ── MODE: BID x ASK CLUSTER ──
          if (settings.displayMode === "bidxask" || settings.displayMode === "clusters") {
            const halfW = (candleWidth - 2) / 2;

            // Left Box: Bid (Market Sellers)
            const bidRatio = Math.min(1, (lvl.bidVolume * 2) / maxCandleVol);
            ctx.fillStyle = lvl.isSellImbalance
              ? "rgba(244, 63, 94, 0.55)"
              : `rgba(244, 63, 94, ${0.08 + bidRatio * 0.45})`;
            ctx.fillRect(candleX, cellTop, halfW, cellHeight - 1);

            // Right Box: Ask (Market Buyers)
            const askRatio = Math.min(1, (lvl.askVolume * 2) / maxCandleVol);
            ctx.fillStyle = lvl.isBuyImbalance
              ? "rgba(16, 185, 129, 0.55)"
              : `rgba(16, 185, 129, ${0.08 + askRatio * 0.45})`;
            ctx.fillRect(candleX + halfW + 2, cellTop, halfW, cellHeight - 1);

            // Dividing centerline
            ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
            ctx.fillRect(candleX + halfW, cellTop, 2, cellHeight - 1);

            // Imbalance Highlight borders
            if (lvl.isSellImbalance) {
              ctx.strokeStyle = "#f43f5e";
              ctx.lineWidth = 1.2;
              ctx.strokeRect(candleX, cellTop, halfW, cellHeight - 1);
            }
            if (lvl.isBuyImbalance) {
              ctx.strokeStyle = "#10b981";
              ctx.lineWidth = 1.2;
              ctx.strokeRect(candleX + halfW + 2, cellTop, halfW, cellHeight - 1);
            }

            // Text Labels (Bid x Ask numbers) - Only render if candle width is readable
            if (candleWidth >= 70 && cellHeight >= 11) {
              const fontSize = Math.min(10, Math.max(8, cellHeight - 6));
              ctx.font = `600 ${fontSize}px monospace`;
              ctx.textBaseline = "middle";

              // Bid Text
              ctx.fillStyle = lvl.isSellImbalance ? "#ffffff" : "rgba(255, 255, 255, 0.85)";
              ctx.textAlign = "right";
              ctx.fillText(formatVol(lvl.bidVolume), candleX + halfW - 3, levelY);

              // Ask Text
              ctx.fillStyle = lvl.isBuyImbalance ? "#ffffff" : "rgba(255, 255, 255, 0.85)";
              ctx.textAlign = "left";
              ctx.fillText(formatVol(lvl.askVolume), candleX + halfW + 5, levelY);
            }
          }
          // ── MODE: DELTA PROFILE ──
          else if (settings.displayMode === "delta") {
            const isPosDelta = lvl.delta >= 0;
            const deltaRatio = Math.min(1, Math.abs(lvl.delta) / maxCandleVol);

            // Background cell base
            ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
            ctx.fillRect(candleX, cellTop, candleWidth, cellHeight - 1);

            // Directional Delta Bar
            const barW = (candleWidth / 2) * deltaRatio;
            if (isPosDelta) {
              ctx.fillStyle = "rgba(16, 185, 129, 0.45)";
              ctx.fillRect(candleCenter, cellTop, barW, cellHeight - 1);
            } else {
              ctx.fillStyle = "rgba(244, 63, 94, 0.45)";
              ctx.fillRect(candleCenter - barW, cellTop, barW, cellHeight - 1);
            }

            // Centerline
            ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
            ctx.fillRect(candleCenter - 0.5, cellTop, 1, cellHeight - 1);

            // Delta text
            if (candleWidth >= 55 && cellHeight >= 11) {
              ctx.font = `600 ${Math.min(10, cellHeight - 6)}px monospace`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = isPosDelta ? "#34d399" : "#fb7185";
              const sign = isPosDelta ? "+" : "";
              ctx.fillText(sign + formatVol(lvl.delta), candleCenter, levelY);
            }
          }
          // ── MODE: VOLUME PROFILE ──
          else {
            const barW = candleWidth * volRatio;
            ctx.fillStyle = isUp ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)";
            ctx.fillRect(candleX, cellTop, barW, cellHeight - 1);

            if (candleWidth >= 50 && cellHeight >= 11) {
              ctx.font = `600 ${Math.min(10, cellHeight - 6)}px monospace`;
              ctx.textAlign = "left";
              ctx.textBaseline = "middle";
              ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
              ctx.fillText(formatVol(lvl.totalVolume), candleX + 4, levelY);
            }
          }

          // Point of Control (POC) Golden Frame
          if (isPoc) {
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 1.6;
            ctx.strokeRect(candleX - 1, cellTop - 0.5, candleWidth + 2, cellHeight);

            // POC Marker on Right
            ctx.fillStyle = "#fbbf24";
            ctx.fillRect(candleX + candleWidth - 3, cellTop, 3, cellHeight - 1);
          }
        });

        // 3. Candle Summary Stats Box (at bottom of chart area)
        const summaryY = chartHeight + 2;
        ctx.fillStyle = "rgba(18, 22, 31, 0.85)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.fillRect(candleX, summaryY, candleWidth, statsBarHeight);
        ctx.strokeRect(candleX, summaryY, candleWidth, statsBarHeight);

        // Delta & Vol metrics in summary footer
        ctx.font = "9px monospace";
        ctx.textAlign = "center";

        const deltaColor = c.delta >= 0 ? "#10b981" : "#f43f5e";
        ctx.fillStyle = deltaColor;
        ctx.fillText(`Δ ${c.delta >= 0 ? "+" : ""}${formatVol(c.delta)}`, candleCenter, summaryY + 12);

        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctx.fillText(`Vol ${formatVol(c.volume)}`, candleCenter, summaryY + 24);

        // Time label
        const timeObj = new Date(c.time);
        const timeStr = `${timeObj.getHours().toString().padStart(2, "0")}:${timeObj.getMinutes().toString().padStart(2, "0")}`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
        ctx.fillText(timeStr, candleCenter, summaryY + 36);
      });

      // 4. Sub-Chart: Cumulative Volume Delta (CVD) Panel
      const cvdY = chartHeight + statsBarHeight + 6;
      ctx.fillStyle = "rgba(10, 12, 16, 0.95)";
      ctx.fillRect(0, cvdY, chartWidth, cvdPanelHeight);

      // CVD Panel Header
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.textAlign = "left";
      ctx.fillText("CUMULATIVE VOLUME DELTA (CVD)", 10, cvdY + 14);

      // Find min & max CVD
      let minCvd = 0;
      let maxCvd = 0;
      candles.forEach((c) => {
        if (c.cvd < minCvd) minCvd = c.cvd;
        if (c.cvd > maxCvd) maxCvd = c.cvd;
      });
      const cvdRange = Math.max(1, maxCvd - minCvd);

      const cvdZeroY = cvdY + 20 + ((maxCvd - 0) / cvdRange) * (cvdPanelHeight - 28);

      // Draw zero line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, cvdZeroY);
      ctx.lineTo(chartWidth, cvdZeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw CVD Line & Area
      ctx.beginPath();
      candles.forEach((c, idx) => {
        const x = panOffsetX + idx * totalCandleSlot + candleWidth / 2;
        const y = cvdY + 20 + ((maxCvd - c.cvd) / cvdRange) * (cvdPanelHeight - 28);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // 5. Draw Live Price Horizontal Pulsing Line
      if (livePrice) {
        const liveY = priceToY(livePrice);
        if (liveY >= 0 && liveY <= chartHeight) {
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, liveY);
          ctx.lineTo(chartWidth, liveY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Live Price Tag on Right Axis
          ctx.fillStyle = "#10b981";
          ctx.fillRect(chartWidth + 2, liveY - 9, priceAxisWidth - 4, 18);
          ctx.fillStyle = "#000000";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "center";
          ctx.fillText(formatPrice(livePrice), chartWidth + priceAxisWidth / 2, liveY + 3.5);
        }
      }

      // 6. Draw Crosshair & Hover Tooltip
      if (mousePos && mousePos.x < chartWidth && mousePos.y < chartHeight) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // Horizontal crosshair
        ctx.beginPath();
        ctx.moveTo(0, mousePos.y);
        ctx.lineTo(chartWidth, mousePos.y);
        ctx.stroke();

        // Vertical crosshair
        ctx.beginPath();
        ctx.moveTo(mousePos.x, 0);
        ctx.lineTo(mousePos.x, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Hovered price label on Y-axis
        const hoverPrice = yToPrice(mousePos.y);
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(chartWidth + 2, mousePos.y - 9, priceAxisWidth - 4, 18);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(formatPrice(hoverPrice), chartWidth + priceAxisWidth / 2, mousePos.y + 3.5);
      }

      ctx.restore();

      if (onHoverLevel) {
        onHoverLevel(hoveredItem);
      }
    }, [
      candles,
      settings,
      livePrice,
      candleWidth,
      cellHeight,
      panOffsetX,
      panOffsetY,
      mousePos,
      onHoverLevel,
    ]);

    // Animation frame loop
    useEffect(() => {
      let animId: number;
      const render = () => {
        draw();
        animId = requestAnimationFrame(render);
      };
      animId = requestAnimationFrame(render);
      return () => cancelAnimationFrame(animId);
    }, [draw]);

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full select-none overflow-hidden cursor-crosshair bg-[#090b0e]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setMousePos(null);
          onHoverLevel?.(null);
        }}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Floating Zoom & Reset View Controls */}
        <div className="absolute bottom-28 right-24 z-20 flex items-center gap-1.5 bg-surface-1/80 backdrop-blur-md border border-border/80 px-2 py-1 rounded-xl shadow-lg">
          <button
            type="button"
            onClick={() => setCandleWidth((w) => Math.min(220, w + 16))}
            className="p-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-lg transition-colors"
            title="Zoom In (Candle width)"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setCandleWidth((w) => Math.max(40, w - 16))}
            className="p-1 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-lg transition-colors"
            title="Zoom Out"
          >
            −
          </button>
          <div className="h-3 w-px bg-border/60 mx-0.5" />
          <button
            type="button"
            onClick={alignToLatestCandle}
            className="px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/15 rounded-lg transition-colors flex items-center gap-1"
            title="Jump to latest live candle"
          >
            <span>Latest</span>
          </button>
        </div>
      </div>
    );
  },
);

FootprintCanvas.displayName = "FootprintCanvas";
