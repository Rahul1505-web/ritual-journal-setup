import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { AppLayout } from "@/components/app-layout";

export const Route = createFileRoute("/_authenticated/live-chart")({
  head: () => ({
    meta: [
      { title: "Live Charts — TradeLog Pro" },
      {
        name: "description",
        content: "Real-time TradingView charts for Bitcoin (BTC), Gold (XAU), and WTI Crude Oil.",
      },
    ],
  }),
  component: LiveChartPage,
});

const CHARTS = [
  { symbol: "BINANCE:BTCUSDT", label: "BTC / USDT", id: "btc" },
  { symbol: "TVC:GOLD", label: "XAU / USD  ·  Gold", id: "xau" },
  { symbol: "TVC:USOIL", label: "WTI Crude Oil", id: "oil" },
];

function TradingViewChart({
  symbol,
  label,
  containerId,
}: {
  symbol: string;
  label: string;
  containerId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Clear any previous widget
    ref.current.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "calc(100% - 32px)";
    widgetDiv.style.width = "100%";
    widgetContainer.appendChild(widgetDiv);

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
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      withdateranges: true,
      details: false,
      hotlist: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    widgetContainer.appendChild(script);

    ref.current.appendChild(widgetContainer);

    return () => {
      if (ref.current) {
        ref.current.innerHTML = "";
      }
    };
  }, [symbol]);

  return (
    <div className="flex flex-col rounded-2xl border border-border overflow-hidden bg-[#131722] shadow-lg">
      {/* Chart header label */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-[#1a1f2e] shrink-0">
        <span className="size-2 rounded-full bg-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground tracking-wide">
          {label}
        </span>
      </div>
      {/* TradingView widget mount point */}
      <div ref={ref} style={{ height: "480px", width: "100%" }} />
    </div>
  );
}

function LiveChartPage() {
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
            containerId={c.id}
          />
        ))}
      </div>
    </AppLayout>
  );
}
