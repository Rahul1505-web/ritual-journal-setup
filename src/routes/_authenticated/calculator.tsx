import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Copy,
  DollarSign,
  Info,
  Layers,
  Percent,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useJournal } from "@/lib/journal-store";
import { money, type Direction, type MarketType } from "@/lib/trades";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calculator")({
  head: () => ({
    meta: [
      { title: "Position Size & Leverage Calculator — TradeLog Pro" },
      {
        name: "description",
        content:
          "Calculate exact position size, risk-based leverage, required margin, and liquidation safety from your account size, stop loss, and dollar risk.",
      },
      { property: "og:title", content: "Position Size & Leverage Calculator — TradeLog Pro" },
      {
        property: "og:description",
        content:
          "Institutional position sizing and leverage calculator for crypto, stocks, forex and futures.",
      },
    ],
  }),
  component: PositionCalculatorPage,
});

interface CalculationHistoryItem {
  id: string;
  timestamp: string;
  accountSize: number;
  slPercent: number;
  riskDollars: number;
  positionSize: number;
  accountLeverage: number;
  chosenLeverage: number;
  symbol?: string | undefined;
}

const STORAGE_KEY = "tradelog_calc_history";

export function PositionCalculatorPage() {
  const { accounts, activeAccountId } = useJournal();
  const navigate = useNavigate();

  // Find active account or default
  const activeAccount = useMemo(() => {
    if (activeAccountId && activeAccountId !== "all") {
      return accounts.find((a) => a.id === activeAccountId) ?? accounts[0];
    }
    return accounts[0];
  }, [accounts, activeAccountId]);

  // Core Inputs
  const [accountSizeInput, setAccountSizeInput] = useState<string>(() =>
    activeAccount?.initialBalance ? String(activeAccount.initialBalance) : "10000",
  );
  const [slPercentInput, setSlPercentInput] = useState<string>("2.0");
  const [riskDollarsInput, setRiskDollarsInput] = useState<string>("100");

  // Exchange Leverage / Margin preferences
  const [leverageSlider, setLeverageSlider] = useState<number>(10);
  const [marginMode, setMarginMode] = useState<"byLeverage" | "byMargin">("byLeverage");
  const [customMarginInput, setCustomMarginInput] = useState<string>("500");

  // Price Action Helper (Optional Entry & SL Price calculator)
  const [showPriceHelper, setShowPriceHelper] = useState<boolean>(false);
  const [symbol, setSymbol] = useState<string>("BTCUSDT");
  const [market, setMarket] = useState<MarketType>("Crypto");
  const [direction, setDirection] = useState<Direction>("BUY");
  const [entryPriceInput, setEntryPriceInput] = useState<string>("");
  const [slPriceInput, setSlPriceInput] = useState<string>("");

  // History state
  const [history, setHistory] = useState<CalculationHistoryItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CalculationHistoryItem[]) : [];
    } catch {
      return [];
    }
  });

  // Numeric parses
  const accountSize = useMemo(() => {
    const val = parseFloat(accountSizeInput.replace(/[^0-9.]/g, ""));
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [accountSizeInput]);

  const slPercent = useMemo(() => {
    const val = parseFloat(slPercentInput.replace(/[^0-9.]/g, ""));
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [slPercentInput]);

  const riskDollars = useMemo(() => {
    const val = parseFloat(riskDollarsInput.replace(/[^0-9.]/g, ""));
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [riskDollarsInput]);

  // Update SL% automatically if Entry Price and SL Price are entered
  useEffect(() => {
    if (!showPriceHelper) return;
    const entry = parseFloat(entryPriceInput);
    const sl = parseFloat(slPriceInput);
    if (!isNaN(entry) && entry > 0 && !isNaN(sl) && sl > 0) {
      let pct = 0;
      if (direction === "BUY") {
        pct = ((entry - sl) / entry) * 100;
      } else {
        pct = ((sl - entry) / entry) * 100;
      }
      if (pct > 0) {
        setSlPercentInput(pct.toFixed(2));
      }
    }
  }, [showPriceHelper, entryPriceInput, slPriceInput, direction]);

  // Primary Position Size Formula:
  // Position Size ($) = Risk ($) / (SL% / 100)
  const positionSize = useMemo(() => {
    if (riskDollars <= 0 || slPercent <= 0) return 0;
    return riskDollars / (slPercent / 100);
  }, [riskDollars, slPercent]);

  // Account-wide Portfolio Leverage (Position Size / Account Size)
  const accountLeverage = useMemo(() => {
    if (positionSize <= 0 || accountSize <= 0) return 0;
    return positionSize / accountSize;
  }, [positionSize, accountSize]);

  // Risk % of Account
  const riskPercentOfAccount = useMemo(() => {
    if (riskDollars <= 0 || accountSize <= 0) return 0;
    return (riskDollars / accountSize) * 100;
  }, [riskDollars, accountSize]);

  // Isolated Margin & Required Leverage calculations
  const parsedCustomMargin = useMemo(() => {
    const val = parseFloat(customMarginInput.replace(/[^0-9.]/g, ""));
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [customMarginInput]);

  // Required Leverage if using custom margin
  const impliedLeverageFromMargin = useMemo(() => {
    if (positionSize <= 0 || parsedCustomMargin <= 0) return 1;
    return positionSize / parsedCustomMargin;
  }, [positionSize, parsedCustomMargin]);

  // Margin required if using chosen leverage
  const marginRequiredFromLeverage = useMemo(() => {
    if (positionSize <= 0 || leverageSlider <= 0) return 0;
    return positionSize / leverageSlider;
  }, [positionSize, leverageSlider]);

  // Active trade leverage to display
  const effectiveTradeLeverage =
    marginMode === "byLeverage" ? leverageSlider : impliedLeverageFromMargin;

  // Active trade margin to display
  const effectiveTradeMargin =
    marginMode === "byLeverage" ? marginRequiredFromLeverage : parsedCustomMargin;

  // Margin as percentage of total account
  const marginPercentOfAccount = useMemo(() => {
    if (effectiveTradeMargin <= 0 || accountSize <= 0) return 0;
    return (effectiveTradeMargin / accountSize) * 100;
  }, [effectiveTradeMargin, accountSize]);

  // Liquidation Safety Guard
  // Estimated liquidation distance: ~ 100 / leverage %
  const estimatedLiqDistancePct = useMemo(() => {
    if (effectiveTradeLeverage <= 0) return 100;
    return 100 / effectiveTradeLeverage;
  }, [effectiveTradeLeverage]);

  // Safe max leverage recommendation (gives at least 25% buffer past SL)
  const safeMaxLeverage = useMemo(() => {
    if (slPercent <= 0) return 50;
    return Math.max(1, Math.floor(100 / (slPercent * 1.35)));
  }, [slPercent]);

  const liquidationStatus = useMemo(() => {
    if (effectiveTradeLeverage <= 1) return { status: "safe", label: "No Liquidation (Spot / 1x)" };
    if (estimatedLiqDistancePct < slPercent) {
      return {
        status: "critical",
        label: "CRITICAL HAZARD",
        message: `At ${effectiveTradeLeverage.toFixed(1)}x leverage, estimated liquidation is ~${estimatedLiqDistancePct.toFixed(2)}%, which triggers BEFORE your ${slPercent.toFixed(2)}% Stop Loss! You will be liquidated and lose 100% of your margin!`,
      };
    }
    if (estimatedLiqDistancePct <= slPercent * 1.25) {
      return {
        status: "warning",
        label: "Tight Buffer",
        message: `Liquidation (~${estimatedLiqDistancePct.toFixed(2)}%) is very close to your SL (${slPercent.toFixed(2)}%). Market wicks or slippage may liquidate you before your stop loss fills.`,
      };
    }
    return {
      status: "safe",
      label: "Safe Buffer",
      message: `Stop Loss (${slPercent.toFixed(2)}%) will execute well before liquidation (~${estimatedLiqDistancePct.toFixed(2)}%). Buffer: +${(estimatedLiqDistancePct - slPercent).toFixed(2)}%.`,
    };
  }, [effectiveTradeLeverage, estimatedLiqDistancePct, slPercent]);

  // Units / Contracts (if Entry Price provided)
  const units = useMemo(() => {
    const entry = parseFloat(entryPriceInput);
    if (isNaN(entry) || entry <= 0 || positionSize <= 0) return null;
    return positionSize / entry;
  }, [entryPriceInput, positionSize]);

  // Risk/Reward targets matrix
  const rrMatrix = useMemo(() => {
    if (riskDollars <= 0) return [];
    const entry = parseFloat(entryPriceInput);
    const hasValidEntry = !isNaN(entry) && entry > 0 && slPercent > 0;

    return [
      { ratio: "1:1", r: 1 },
      { ratio: "1:1.5", r: 1.5 },
      { ratio: "1:2", r: 2 },
      { ratio: "1:3", r: 3 },
      { ratio: "1:4", r: 4 },
      { ratio: "1:5", r: 5 },
    ].map(({ ratio, r }) => {
      const profit = riskDollars * r;
      const accountGainPct = accountSize > 0 ? (profit / accountSize) * 100 : 0;
      let targetPrice: number | null = null;
      if (hasValidEntry) {
        const movePct = (slPercent * r) / 100;
        targetPrice = direction === "BUY" ? entry * (1 + movePct) : entry * (1 - movePct);
      }
      return { ratio, r, profit, accountGainPct, targetPrice };
    });
  }, [riskDollars, accountSize, entryPriceInput, slPercent, direction]);

  // Quick preset handlers
  const handleQuickRiskPercent = (pct: number) => {
    if (accountSize <= 0) {
      toast.error("Please enter a valid Account Size first");
      return;
    }
    const dollars = (accountSize * pct) / 100;
    setRiskDollarsInput(dollars.toFixed(2));
  };

  const handleQuickAccountSize = (amount: number) => {
    setAccountSizeInput(String(amount));
  };

  const handleQuickSl = (pct: number) => {
    setSlPercentInput(pct.toFixed(2));
  };

  const handleSaveCalculation = () => {
    if (positionSize <= 0) {
      toast.error("Enter valid inputs to save calculation.");
      return;
    }
    const newItem: CalculationHistoryItem = {
      id: "calc_" + Date.now(),
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      accountSize,
      slPercent,
      riskDollars,
      positionSize,
      accountLeverage,
      chosenLeverage: effectiveTradeLeverage,
      symbol: symbol.trim() || undefined,
    };
    const updated = [newItem, ...history.slice(0, 7)];
    setHistory(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      toast.success("Saved calculation to history!");
    } catch {
      // ignore
    }
  };

  const handleLoadCalculation = (item: CalculationHistoryItem) => {
    setAccountSizeInput(String(item.accountSize));
    setSlPercentInput(String(item.slPercent));
    setRiskDollarsInput(String(item.riskDollars));
    setLeverageSlider(Math.round(item.chosenLeverage) || 10);
    if (item.symbol) setSymbol(item.symbol);
    toast.info("Loaded calculation from history.");
  };

  const handleCopySummary = async () => {
    if (positionSize <= 0) {
      toast.error("Enter valid parameters first.");
      return;
    }

    const text = [
      `📐 TradeLog Pro — Position Size & Risk Plan`,
      `• Account Capital: ${money(accountSize)}`,
      `• Risk per Trade: ${money(riskDollars)} (${riskPercentOfAccount.toFixed(2)}% of account)`,
      `• Stop Loss Distance: ${slPercent.toFixed(2)}%`,
      `• EXACT POSITION SIZE: ${money(positionSize)}`,
      `• Account-Wide Leverage: ${accountLeverage.toFixed(2)}x`,
      `• Trade Leverage: ${effectiveTradeLeverage.toFixed(1)}x`,
      `• Margin Committed: ${money(effectiveTradeMargin)} (${marginPercentOfAccount.toFixed(1)}% of account)`,
      `• Liquidation Buffer: ~${estimatedLiqDistancePct.toFixed(2)}% (${liquidationStatus.label})`,
      ...(units ? [`• Asset Units: ${units.toFixed(4)} ${symbol}`] : []),
      ...(entryPriceInput ? [`• Entry Price: $${entryPriceInput}`] : []),
      ...(slPriceInput ? [`• Stop Loss Price: $${slPriceInput}`] : []),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Position Size Summary copied to clipboard!");
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const handlePlanInAddTrade = () => {
    if (positionSize <= 0) {
      toast.error("Calculate your position size first.");
      return;
    }

    try {
      const prefill = {
        amount: Math.round(effectiveTradeMargin),
        leverage: Math.round(effectiveTradeLeverage) || 1,
        entry: entryPriceInput ? parseFloat(entryPriceInput) : undefined,
        sl: slPriceInput ? parseFloat(slPriceInput) : undefined,
        direction,
        symbol: symbol.trim() || undefined,
        market,
        notes: `Calculated via Position Size Calculator: Risk ${money(riskDollars)} (${riskPercentOfAccount.toFixed(1)}%), SL ${slPercent.toFixed(2)}%, Position Size ${money(positionSize)} at ${effectiveTradeLeverage.toFixed(1)}x leverage.`,
        accountId: activeAccount?.id,
      };
      sessionStorage.setItem("calculator_prefill", JSON.stringify(prefill));
      toast.success("Opening Add Trade with prefilled position details...");
      navigate({ to: "/add-trade" });
    } catch {
      navigate({ to: "/add-trade" });
    }
  };

  return (
    <AppLayout
      title="Position Size & Leverage Calculator"
      subtitle="Input your account size, stop loss %, and dollar risk to get your exact position size and safe leverage"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopySummary}
            disabled={positionSize <= 0}
            className="hidden sm:inline-flex gap-1.5 h-8.5 text-xs font-semibold"
          >
            <Copy className="size-3.5" />
            Copy Plan
          </Button>
          <Button
            size="sm"
            onClick={handlePlanInAddTrade}
            disabled={positionSize <= 0}
            className="h-8.5 text-xs font-semibold gap-1.5 shadow-sm"
          >
            Log in Add Trade
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Main Grid: Inputs on Left, Results on Right */}
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* ========================================================= */}
          {/* LEFT COLUMN: INPUTS & CONTROLS (7 Cols)                   */}
          {/* ========================================================= */}
          <div className="space-y-6 lg:col-span-7">
            {/* Core Parameters Card */}
            <Card className="p-5 sm:p-6 border-border bg-card shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Calculator className="size-4.5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      Risk & Position Sizing Parameters
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Fill the 3 required fields to calculate your position
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAccountSizeInput(activeAccount?.initialBalance ? String(activeAccount.initialBalance) : "10000");
                    setSlPercentInput("2.0");
                    setRiskDollarsInput("100");
                    setLeverageSlider(10);
                    toast.info("Reset to default parameters");
                  }}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <RotateCcw className="size-3" />
                  Reset
                </Button>
              </div>

              {/* 1. Account Size ($) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="accountSize" className="text-sm font-semibold flex items-center gap-1.5">
                    <Wallet className="size-3.5 text-primary" />
                    1. Account Size (in Dollars $)
                  </Label>
                  <span className="text-xs text-muted-foreground font-mono">
                    Total balance: {money(accountSize)}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    $
                  </span>
                  <Input
                    id="accountSize"
                    type="text"
                    inputMode="decimal"
                    value={accountSizeInput}
                    onChange={(e) => setAccountSizeInput(e.target.value)}
                    placeholder="10000"
                    className="pl-8 text-base font-medium h-11 bg-surface-2 border-border"
                  />
                </div>

                {/* Quick Account Size Presets & Account Selector */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground font-medium mr-1">Quick:</span>
                  {[1000, 2500, 5000, 10000, 25000, 50000, 100000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAccountSize(val)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors border",
                        accountSize === val
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-surface-3 border-border text-muted-foreground hover:text-foreground hover:bg-surface-4",
                      )}
                    >
                      ${val.toLocaleString()}
                    </button>
                  ))}
                  {activeAccount && (
                    <button
                      type="button"
                      onClick={() => setAccountSizeInput(String(activeAccount.initialBalance))}
                      className="ml-auto rounded-md px-2 py-0.5 text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      Use {activeAccount.name} (${activeAccount.initialBalance.toLocaleString()})
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Stop Loss (SL) in % */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label htmlFor="slPercent" className="text-sm font-semibold flex items-center gap-1.5">
                    <TrendingDown className="size-3.5 text-rose-500" />
                    2. Stop Loss (SL) in Percentage (%)
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowPriceHelper((prev) => !prev)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    {showPriceHelper ? "Hide Price Inputs" : "Calculate SL % from Prices"}
                  </button>
                </div>

                <div className="relative">
                  <Input
                    id="slPercent"
                    type="text"
                    inputMode="decimal"
                    value={slPercentInput}
                    onChange={(e) => setSlPercentInput(e.target.value)}
                    placeholder="2.0"
                    className="pr-8 text-base font-medium h-11 bg-surface-2 border-border"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    %
                  </span>
                </div>

                {/* Quick SL Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground font-medium mr-1">Presets:</span>
                  {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 5.0, 8.0].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleQuickSl(pct)}
                      className={cn(
                        "rounded-md px-2.5 py-0.5 text-[11px] font-medium transition-colors border",
                        slPercent === pct
                          ? "bg-rose-500 text-white border-rose-500"
                          : "bg-surface-3 border-border text-muted-foreground hover:text-foreground hover:bg-surface-4",
                      )}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                {/* Optional Price Action Calculator Dropdown */}
                {showPriceHelper && (
                  <div className="mt-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Percent className="size-3.5 text-primary" />
                        Price Level Invalidation Calculator
                      </span>
                      <div className="flex rounded-lg border border-border p-0.5 bg-background">
                        <button
                          type="button"
                          onClick={() => setDirection("BUY")}
                          className={cn(
                            "px-2.5 py-0.5 rounded text-xs font-semibold transition-colors",
                            direction === "BUY"
                              ? "bg-emerald-500 text-white"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          Long (BUY)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDirection("SELL")}
                          className={cn(
                            "px-2.5 py-0.5 rounded text-xs font-semibold transition-colors",
                            direction === "SELL"
                              ? "bg-rose-500 text-white"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          Short (SELL)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="entryPrice" className="text-xs text-muted-foreground">
                          Entry Price ($)
                        </Label>
                        <Input
                          id="entryPrice"
                          type="number"
                          step="any"
                          value={entryPriceInput}
                          onChange={(e) => setEntryPriceInput(e.target.value)}
                          placeholder="e.g. 68000"
                          className="h-9 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <Label htmlFor="slPrice" className="text-xs text-muted-foreground">
                          Stop Loss Price ($)
                        </Label>
                        <Input
                          id="slPrice"
                          type="number"
                          step="any"
                          value={slPriceInput}
                          onChange={(e) => setSlPriceInput(e.target.value)}
                          placeholder="e.g. 66640"
                          className="h-9 text-xs bg-background"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>Symbol:</span>
                      <Input
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                        placeholder="BTCUSDT"
                        className="h-7 w-28 text-xs font-mono uppercase bg-background"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Risk Willing to Take ($) */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label htmlFor="riskDollars" className="text-sm font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="size-3.5 text-amber-500" />
                    3. Risk Amount (in Dollars $)
                  </Label>
                  <span
                    className={cn(
                      "text-xs font-semibold font-mono",
                      riskPercentOfAccount > 3 ? "text-rose-400" : "text-primary",
                    )}
                  >
                    {riskPercentOfAccount.toFixed(2)}% of Account
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    $
                  </span>
                  <Input
                    id="riskDollars"
                    type="text"
                    inputMode="decimal"
                    value={riskDollarsInput}
                    onChange={(e) => setRiskDollarsInput(e.target.value)}
                    placeholder="100"
                    className="pl-8 text-base font-medium h-11 bg-surface-2 border-border"
                  />
                </div>

                {/* Quick Risk % Presets based on Account Size */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground font-medium mr-1">Presets:</span>
                  {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((pct) => {
                    const dollarVal = (accountSize * pct) / 100;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleQuickRiskPercent(pct)}
                        className={cn(
                          "rounded-md px-2.5 py-0.5 text-[11px] font-medium transition-colors border",
                          Math.abs(riskDollars - dollarVal) < 0.05
                            ? "bg-amber-500 text-black font-semibold border-amber-500"
                            : "bg-surface-3 border-border text-muted-foreground hover:text-foreground hover:bg-surface-4",
                        )}
                      >
                        {pct}% (${Math.round(dollarVal).toLocaleString()})
                      </button>
                    );
                  })}
                </div>

                {/* Risk Warning if high */}
                {riskPercentOfAccount > 3 && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>
                      High Risk Warning: Risking {riskPercentOfAccount.toFixed(1)}% of your account per trade exposes you to high drawdown during a losing streak. Standard risk is 1.0% to 2.0%.
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Leverage & Margin Strategy Card */}
            <Card className="p-5 sm:p-6 border-border bg-card shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Layers className="size-4.5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">
                      Execution Leverage & Margin Allocation
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Adjust your exchange leverage multiplier or allocated trade margin
                    </p>
                  </div>
                </div>

                {/* Toggle Mode */}
                <div className="flex rounded-lg border border-border p-0.5 bg-surface-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setMarginMode("byLeverage")}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-medium transition-colors",
                      marginMode === "byLeverage"
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    By Leverage (x)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarginMode("byMargin")}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-medium transition-colors",
                      marginMode === "byMargin"
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    By Margin ($)
                  </button>
                </div>
              </div>

              {marginMode === "byLeverage" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Exchange Leverage Multiplier
                    </Label>
                    <span className="text-base font-bold font-mono text-primary">
                      {leverageSlider}x Leverage
                    </span>
                  </div>

                  <Slider
                    value={[leverageSlider]}
                    min={1}
                    max={100}
                    step={1}
                    onValueChange={(vals) => setLeverageSlider(vals[0] ?? 1)}
                    className="py-1"
                  />

                  {/* Leverage Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 5, 10, 15, 20, 25, 30, 50, 75, 100].map((lev) => (
                      <button
                        key={lev}
                        type="button"
                        onClick={() => setLeverageSlider(lev)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-colors border",
                          leverageSlider === lev
                            ? "bg-primary text-primary-foreground border-primary font-bold"
                            : "bg-surface-2 border-border text-muted-foreground hover:text-foreground hover:bg-surface-3",
                        )}
                      >
                        {lev}x
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="p-3 rounded-lg bg-surface-2 border border-border">
                      <p className="text-muted-foreground">Required Margin:</p>
                      <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {money(marginRequiredFromLeverage)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        ({marginPercentOfAccount.toFixed(1)}% of account capital)
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-2 border border-border">
                      <p className="text-muted-foreground">Est. Liquidation Distance:</p>
                      <p
                        className={cn(
                          "text-sm font-bold font-mono mt-0.5",
                          liquidationStatus.status === "critical"
                            ? "text-rose-500"
                            : liquidationStatus.status === "warning"
                              ? "text-amber-500"
                              : "text-emerald-500",
                        )}
                      >
                        ~{estimatedLiqDistancePct.toFixed(2)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        SL is at {slPercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="customMargin" className="text-xs text-muted-foreground">
                        Margin You Want to Put in This Trade ($)
                      </Label>
                      <span className="text-xs text-muted-foreground font-mono">
                        {accountSize > 0
                          ? `${((parsedCustomMargin / accountSize) * 100).toFixed(1)}% of account`
                          : ""}
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                        $
                      </span>
                      <Input
                        id="customMargin"
                        type="text"
                        inputMode="decimal"
                        value={customMarginInput}
                        onChange={(e) => setCustomMarginInput(e.target.value)}
                        placeholder="500"
                        className="pl-8 text-base font-medium h-10 bg-surface-2 border-border"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="p-3 rounded-lg bg-surface-2 border border-border">
                      <p className="text-muted-foreground">Required Leverage:</p>
                      <p className="text-base font-bold font-mono text-primary mt-0.5">
                        {impliedLeverageFromMargin.toFixed(2)}x
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Set exchange leverage to ~{Math.ceil(impliedLeverageFromMargin)}x
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-2 border border-border">
                      <p className="text-muted-foreground">Liquidation Distance:</p>
                      <p
                        className={cn(
                          "text-base font-bold font-mono mt-0.5",
                          liquidationStatus.status === "critical"
                            ? "text-rose-500"
                            : liquidationStatus.status === "warning"
                              ? "text-amber-500"
                              : "text-emerald-500",
                        )}
                      >
                        ~{estimatedLiqDistancePct.toFixed(2)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Stop Loss at {slPercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Liquidation Guard Banner */}
              <div
                className={cn(
                  "p-3 rounded-xl border flex items-start gap-2.5 text-xs",
                  liquidationStatus.status === "critical"
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    : liquidationStatus.status === "warning"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
                )}
              >
                {liquidationStatus.status === "critical" ? (
                  <ShieldAlert className="size-4.5 shrink-0 text-rose-400 mt-0.5" />
                ) : liquidationStatus.status === "warning" ? (
                  <AlertTriangle className="size-4.5 shrink-0 text-amber-400 mt-0.5" />
                ) : (
                  <ShieldCheck className="size-4.5 shrink-0 text-emerald-400 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p className="font-semibold">{liquidationStatus.label}</p>
                  <p className="leading-relaxed">{liquidationStatus.message}</p>
                  {liquidationStatus.status === "critical" && (
                    <p className="font-semibold text-white underline pt-0.5">
                      Recommended Max Safe Leverage for this trade: &le; {safeMaxLeverage}x
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: HERO RESULTS & ANALYTICS (5 Cols)           */}
          {/* ========================================================= */}
          <div className="space-y-6 lg:col-span-5">
            {/* HERO RESULT CARD */}
            <Card className="p-6 border-primary/30 bg-gradient-to-b from-card via-card to-primary/5 shadow-lg relative overflow-hidden space-y-6">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 size-44 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider uppercase text-primary">
                  Calculated Position Size
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono text-xs font-bold",
                    accountLeverage <= 1
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : "border-primary/30 text-primary bg-primary/10",
                  )}
                >
                  {accountLeverage <= 1 ? "Spot / 1x" : `${accountLeverage.toFixed(2)}x Account Leverage`}
                </Badge>
              </div>

              {/* Exact Position Size Display */}
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-foreground">
                    {positionSize > 0 ? money(positionSize) : "$0.00"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (positionSize > 0) {
                        navigator.clipboard.writeText(positionSize.toFixed(2));
                        toast.success("Position Size copied!");
                      }
                    }}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                  >
                    <Copy className="size-3.5" />
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Exact total notional exposure required for a {slPercent.toFixed(2)}% SL to lose exactly{" "}
                  <strong className="text-foreground">{money(riskDollars)}</strong>.
                </p>
              </div>

              {/* Asset Units breakdown if entry entered */}
              {units !== null && (
                <div className="p-3 rounded-lg bg-surface-2 border border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Asset Contracts / Quantity:</span>
                  <span className="text-sm font-bold font-mono text-foreground">
                    {units.toFixed(units < 1 ? 4 : 2)} {symbol}
                  </span>
                </div>
              )}

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/80">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    Total Risk
                  </span>
                  <p className="text-lg font-bold font-mono text-rose-400">
                    {money(riskDollars)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {riskPercentOfAccount.toFixed(2)}% of account capital
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    Account Leverage
                  </span>
                  <p className="text-lg font-bold font-mono text-primary">
                    {accountLeverage.toFixed(2)}x
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Position / Total Capital
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-border/60">
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    Trade Leverage
                  </span>
                  <p className="text-lg font-bold font-mono text-foreground">
                    {effectiveTradeLeverage.toFixed(1)}x
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Exchange contract multiplier
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-border/60">
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    Margin Required
                  </span>
                  <p className="text-lg font-bold font-mono text-foreground">
                    {money(effectiveTradeMargin)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {marginPercentOfAccount.toFixed(1)}% of your capital
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handlePlanInAddTrade}
                  disabled={positionSize <= 0}
                  className="flex-1 font-semibold text-xs h-10 gap-2 shadow-sm"
                >
                  Plan in Add Trade
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveCalculation}
                  disabled={positionSize <= 0}
                  className="text-xs h-10 gap-1.5 font-semibold"
                >
                  <CheckCircle2 className="size-3.5" />
                  Save
                </Button>
              </div>
            </Card>

            {/* Take Profit & Risk/Reward Targets Matrix */}
            <Card className="p-5 border-border bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Take Profit (R:R Targets)
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Base Risk: {money(riskDollars)}
                </span>
              </div>

              <div className="divide-y divide-border/60 text-xs">
                {rrMatrix.map((item) => (
                  <div
                    key={item.ratio}
                    className="py-2 flex items-center justify-between hover:bg-surface-2/50 px-1 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground w-12">
                        {item.ratio}
                      </span>
                      <span className="text-emerald-500 font-mono font-semibold">
                        +{money(item.profit)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-mono">
                        +{item.accountGainPct.toFixed(1)}%
                      </span>
                      {item.targetPrice !== null && (
                        <span className="font-mono font-semibold text-foreground bg-surface-3 px-1.5 py-0.5 rounded text-[11px]">
                          TP: ${item.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Leverage Comparison Quick Matrix */}
            <Card className="p-5 border-border bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5 text-primary" />
                  Leverage Comparison Matrix
                </span>
                <span className="text-[11px] text-muted-foreground">At ${Math.round(positionSize).toLocaleString()} size</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/50 text-[11px]">
                      <th className="pb-1.5 font-medium">Lev</th>
                      <th className="pb-1.5 font-medium">Margin</th>
                      <th className="pb-1.5 font-medium">Est. Liq</th>
                      <th className="pb-1.5 font-medium text-right">Safety</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {[1, 2, 5, 10, 20, 50].map((lev) => {
                      const m = positionSize > 0 ? positionSize / lev : 0;
                      const liq = 100 / lev;
                      const isDanger = liq <= slPercent;
                      return (
                        <tr
                          key={lev}
                          onClick={() => {
                            setMarginMode("byLeverage");
                            setLeverageSlider(lev);
                          }}
                          className={cn(
                            "cursor-pointer hover:bg-surface-2 transition-colors",
                            leverageSlider === lev && marginMode === "byLeverage" && "bg-primary/10 font-bold",
                          )}
                        >
                          <td className="py-1.5">{lev}x</td>
                          <td className="py-1.5 text-foreground">{money(m)}</td>
                          <td className="py-1.5 text-muted-foreground">~{liq.toFixed(1)}%</td>
                          <td className="py-1.5 text-right">
                            {isDanger ? (
                              <span className="text-rose-400 font-semibold">Hazard</span>
                            ) : liq <= slPercent * 1.5 ? (
                              <span className="text-amber-400 font-semibold">Tight</span>
                            ) : (
                              <span className="text-emerald-400 font-semibold">Safe</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Recent Calculations History */}
            {history.length > 0 && (
              <Card className="p-4 border-border bg-card shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-semibold text-foreground">
                    Recent Calculations ({history.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setHistory([]);
                      try {
                        localStorage.removeItem(STORAGE_KEY);
                      } catch {}
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>

                <div className="space-y-1.5">
                  {history.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleLoadCalculation(item)}
                      className="p-2 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold font-mono text-foreground">
                            {money(item.positionSize)}
                          </span>
                          {item.symbol && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                              {item.symbol}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Risk: {money(item.riskDollars)} | SL: {item.slPercent}% | {item.chosenLeverage.toFixed(0)}x
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground">{item.timestamp}</span>
                        <p className="text-[11px] font-semibold text-primary">Load</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
