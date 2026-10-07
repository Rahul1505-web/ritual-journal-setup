import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Crown,
  Eye,
  Layers,
  MoreVertical,
  Percent,
  Plus,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  WalletCards,
  Edit2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useJournal } from "@/lib/journal-store";
import {
  ACCOUNT_TYPES,
  BROKERS,
  CURRENCIES,
  formatCurrency,
  pnl,
  signedCurrency,
  type AccountStatus,
  type AccountType,
  type TradingAccount,
} from "@/lib/trades";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: "Trading Accounts Portfolio — TradeLog Pro" },
      {
        name: "description",
        content:
          "Manage up to 15 segregated trading accounts, monitor multi-account P&L, starting funds, and performance.",
      },
      { property: "og:title", content: "Trading Accounts Portfolio — TradeLog Pro" },
      {
        property: "og:description",
        content:
          "Segregated trading accounts management with portfolio insights and top performer analysis.",
      },
    ],
  }),
  component: AccountsPage,
});

const COLOR_PRESETS = [
  "#598bff", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#f43f5e", // Rose
  "#ec4899", // Pink
  "#14b8a6", // Teal
];

function AccountsPage() {
  const {
    accounts,
    trades,
    activeAccountId,
    setActiveAccountId,
    addAccount,
    updateAccount,
    deleteAccount,
  } = useJournal();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("Personal Live");
  const [broker, setBroker] = useState("Zerodha");
  const [customBroker, setCustomBroker] = useState("");
  const [initialBalance, setInitialBalance] = useState("25000");
  const [currency, setCurrency] = useState("$");
  const [targetProfitPercent, setTargetProfitPercent] = useState("");
  const [maxDrawdownPercent, setMaxDrawdownPercent] = useState("");
  const [color, setColor] = useState("#598bff");
  const [status, setStatus] = useState<AccountStatus>("active");
  const [description, setDescription] = useState("");

  const openAddDialog = () => {
    if (accounts.length >= 15) {
      toast.error("Account limit reached! You can have up to 15 trading accounts.");
      return;
    }
    setEditingAccount(null);
    setName(`Account ${accounts.length + 1}`);
    setType("Personal Live");
    setBroker("Zerodha");
    setCustomBroker("");
    setInitialBalance("25000");
    setCurrency("$");
    setTargetProfitPercent("");
    setMaxDrawdownPercent("");
    setColor(COLOR_PRESETS[accounts.length % COLOR_PRESETS.length]);
    setStatus("active");
    setDescription("");
    setDialogOpen(true);
  };

  const openEditDialog = (acc: TradingAccount) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    if (BROKERS.includes(acc.broker)) {
      setBroker(acc.broker);
      setCustomBroker("");
    } else {
      setBroker("Other Broker");
      setCustomBroker(acc.broker);
    }
    setInitialBalance(String(acc.initialBalance));
    setCurrency(acc.currency || "$");
    setTargetProfitPercent(acc.targetProfitPercent != null ? String(acc.targetProfitPercent) : "");
    setMaxDrawdownPercent(acc.maxDrawdownPercent != null ? String(acc.maxDrawdownPercent) : "");
    setColor(acc.color || "#598bff");
    setStatus(acc.status || "active");
    setDescription(acc.description || "");
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter an account name.");
      return;
    }
    const balanceNum = parseFloat(initialBalance);
    if (isNaN(balanceNum) || balanceNum < 0) {
      toast.error("Please enter a valid starting balance.");
      return;
    }

    const finalBroker = broker === "Other Broker" ? customBroker.trim() || "Custom Broker" : broker;
    const targetNum = targetProfitPercent ? parseFloat(targetProfitPercent) : undefined;
    const drawdownNum = maxDrawdownPercent ? parseFloat(maxDrawdownPercent) : undefined;

    setBusy(true);
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, {
          name: name.trim(),
          type,
          broker: finalBroker,
          initialBalance: balanceNum,
          currency,
          targetProfitPercent: targetNum,
          maxDrawdownPercent: drawdownNum,
          color,
          status,
          description: description.trim(),
        });
        toast.success(`Account "${name.trim()}" updated successfully!`);
      } else {
        await addAccount({
          name: name.trim(),
          type,
          broker: finalBroker,
          initialBalance: balanceNum,
          currency,
          targetProfitPercent: targetNum,
          maxDrawdownPercent: drawdownNum,
          color,
          status,
          description: description.trim(),
        });
        toast.success(`New account "${name.trim()}" created!`);
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save account.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (accounts.length <= 1) {
      toast.error("You must maintain at least one trading account.");
      return;
    }
    setBusy(true);
    try {
      await deleteAccount(id);
      toast.success("Account deleted.");
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete account.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  // Compute metrics per account
  const accountMetrics = useMemo(() => {
    const defaultAccId = accounts[0]?.id;
    return accounts.map((acc) => {
      const accTrades = trades.filter((t) => (t.accountId ?? defaultAccId) === acc.id);
      const totalPnl = accTrades.reduce((sum, t) => sum + pnl(t), 0);
      const currentBalance = acc.initialBalance + totalPnl;
      const roiPercent = acc.initialBalance > 0 ? (totalPnl / acc.initialBalance) * 100 : 0;
      const wins = accTrades.filter((t) => pnl(t) > 0);
      const losses = accTrades.filter((t) => pnl(t) <= 0);
      const winRate = accTrades.length > 0 ? (wins.length / accTrades.length) * 100 : 0;

      const grossProfit = wins.reduce((sum, t) => sum + pnl(t), 0);
      const grossLoss = Math.abs(losses.reduce((sum, t) => sum + pnl(t), 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;

      // Drawdown calculation
      let peak = acc.initialBalance;
      let maxDrawdownDollars = 0;
      let running = acc.initialBalance;
      for (const t of accTrades) {
        running += pnl(t);
        if (running > peak) peak = running;
        const dd = peak - running;
        if (dd > maxDrawdownDollars) maxDrawdownDollars = dd;
      }
      const maxDrawdownPct = peak > 0 ? (maxDrawdownDollars / peak) * 100 : 0;

      // Target progress
      let targetProgress: number | null = null;
      if (acc.targetProfitPercent && acc.targetProfitPercent > 0) {
        const targetDollars = (acc.initialBalance * acc.targetProfitPercent) / 100;
        targetProgress = Math.min(100, Math.max(0, (totalPnl / targetDollars) * 100));
      }

      return {
        account: acc,
        tradesCount: accTrades.length,
        winsCount: wins.length,
        lossesCount: losses.length,
        totalPnl,
        currentBalance,
        roiPercent,
        winRate,
        profitFactor,
        maxDrawdownPct,
        targetProgress,
      };
    });
  }, [accounts, trades]);

  // Executive Combined Portfolio Summary
  const portfolioSummary = useMemo(() => {
    const totalInitialFunds = accountMetrics.reduce((s, m) => s + m.account.initialBalance, 0);
    const totalCombinedPnl = accountMetrics.reduce((s, m) => s + m.totalPnl, 0);
    const totalNetWorth = totalInitialFunds + totalCombinedPnl;
    const totalTrades = accountMetrics.reduce((s, m) => s + m.tradesCount, 0);
    const totalWins = accountMetrics.reduce((s, m) => s + m.winsCount, 0);
    const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
    const overallRoi = totalInitialFunds > 0 ? (totalCombinedPnl / totalInitialFunds) * 100 : 0;

    // MVP / Most Profitable Account
    const sortedByProfit = [...accountMetrics].sort((a, b) => b.totalPnl - a.totalPnl);
    const topPerformer = sortedByProfit[0];

    // Total positive profits for share calculation
    const totalPositiveProfit = accountMetrics
      .filter((m) => m.totalPnl > 0)
      .reduce((s, m) => s + m.totalPnl, 0);

    const topPerformerShare =
      topPerformer && topPerformer.totalPnl > 0 && totalPositiveProfit > 0
        ? (topPerformer.totalPnl / totalPositiveProfit) * 100
        : 0;

    // Highest Win Rate Account (min 1 trade)
    const activeWithTrades = accountMetrics.filter((m) => m.tradesCount >= 1);
    const sortedByWinRate = [...activeWithTrades].sort((a, b) => b.winRate - a.winRate);
    const topWinRate = sortedByWinRate[0];

    return {
      totalInitialFunds,
      totalCombinedPnl,
      totalNetWorth,
      totalTrades,
      overallWinRate,
      overallRoi,
      topPerformer,
      topPerformerShare,
      topWinRate,
    };
  }, [accountMetrics]);

  return (
    <AppLayout
      title="Trading Accounts"
      subtitle="Manage up to 15 segregated accounts, allocate initial funds, and track portfolio P&L"
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-9 px-3 text-xs font-semibold">
            {accounts.length} / 15 Accounts
          </Badge>
          <Button
            onClick={openAddDialog}
            disabled={accounts.length >= 15}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Account</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* EXECUTIVE PORTFOLIO OVERVIEW */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="gap-2 p-5 bg-gradient-to-br from-surface to-surface-2 border-border/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Portfolio Value
              </span>
              <WalletCards className="size-4 text-primary" />
            </div>
            <p className="tabular text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {formatCurrency(portfolioSummary.totalNetWorth, "$")}
            </p>
            <p className="text-xs text-muted-foreground">
              Initial Capital:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(portfolioSummary.totalInitialFunds, "$")}
              </span>
            </p>
          </Card>

          <Card className="gap-2 p-5 bg-gradient-to-br from-surface to-surface-2 border-border/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Combined Realized P&amp;L
              </span>
              {portfolioSummary.totalCombinedPnl >= 0 ? (
                <ArrowUpRight className="size-4 text-profit" />
              ) : (
                <ArrowDownRight className="size-4 text-loss" />
              )}
            </div>
            <p
              className={cn(
                "tabular text-2xl font-bold tracking-tight sm:text-3xl",
                portfolioSummary.totalCombinedPnl >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {signedCurrency(portfolioSummary.totalCombinedPnl, "$")}
            </p>
            <p className="text-xs text-muted-foreground">
              Portfolio ROI:{" "}
              <span
                className={cn(
                  "font-semibold",
                  portfolioSummary.overallRoi >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {portfolioSummary.overallRoi >= 0 ? "+" : ""}
                {portfolioSummary.overallRoi.toFixed(2)}%
              </span>
            </p>
          </Card>

          <Card className="gap-2 p-5 bg-gradient-to-br from-surface to-surface-2 border-border/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Portfolio Win Rate
              </span>
              <Percent className="size-4 text-primary" />
            </div>
            <p className="tabular text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {portfolioSummary.overallWinRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              Total Executed Trades:{" "}
              <span className="font-semibold text-foreground">{portfolioSummary.totalTrades}</span>
            </p>
          </Card>

          <Card className="gap-2 p-5 bg-gradient-to-br from-surface to-surface-2 border-border/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active View
              </span>
              <Eye className="size-4 text-primary" />
            </div>
            <p className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {activeAccountId === "all"
                ? "All Accounts (Global)"
                : accounts.find((a) => a.id === activeAccountId)?.name ?? "Selected Account"}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-profit animate-pulse" />
              <span>Data synchronized across devices</span>
            </div>
          </Card>
        </div>

        {/* PERFORMANCE INSIGHTS & MVP ACCOUNT HIGHLIGHT */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Most Profitable Account */}
          <Card className="relative overflow-hidden p-6 border-profit/30 bg-gradient-to-br from-surface to-surface-2 lg:col-span-2">
            <div className="absolute right-4 top-4 rounded-full bg-profit/15 p-2 text-profit">
              <Crown className="size-5" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-profit/20 px-2.5 py-0.5 text-xs font-bold text-profit uppercase tracking-wider">
                  🏆 Top Performing Account
                </span>
                {portfolioSummary.topPerformerShare > 0 && (
                  <span className="text-xs font-medium text-muted-foreground">
                    Generated {portfolioSummary.topPerformerShare.toFixed(1)}% of total profits
                  </span>
                )}
              </div>

              {portfolioSummary.topPerformer ? (
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">
                    {portfolioSummary.topPerformer.account.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-surface-3 px-2 py-0.5 font-medium">
                      {portfolioSummary.topPerformer.account.broker}
                    </span>
                    <span>·</span>
                    <span>{portfolioSummary.topPerformer.account.type}</span>
                    <span>·</span>
                    <span className="font-semibold text-foreground">
                      {portfolioSummary.topPerformer.tradesCount} trades
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Net P&amp;L</p>
                      <p
                        className={cn(
                          "tabular text-lg font-bold",
                          portfolioSummary.topPerformer.totalPnl >= 0 ? "text-profit" : "text-loss",
                        )}
                      >
                        {signedCurrency(
                          portfolioSummary.topPerformer.totalPnl,
                          portfolioSummary.topPerformer.account.currency,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Return on Capital</p>
                      <p
                        className={cn(
                          "tabular text-lg font-bold",
                          portfolioSummary.topPerformer.roiPercent >= 0 ? "text-profit" : "text-loss",
                        )}
                      >
                        {portfolioSummary.topPerformer.roiPercent >= 0 ? "+" : ""}
                        {portfolioSummary.topPerformer.roiPercent.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                      <p className="tabular text-lg font-bold text-foreground">
                        {portfolioSummary.topPerformer.winRate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Profit Factor</p>
                      <p className="tabular text-lg font-bold text-foreground">
                        {portfolioSummary.topPerformer.profitFactor > 0
                          ? portfolioSummary.topPerformer.profitFactor.toFixed(2)
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Log your first trades to unlock top performing account insights.
                </p>
              )}
            </div>
          </Card>

          {/* Capital Allocation Breakdown */}
          <Card className="flex flex-col justify-between p-6 bg-surface">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold tracking-tight">Capital Allocation</h3>
                <Layers className="size-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Funds distribution across your {accounts.length} trading accounts
              </p>

              <div className="space-y-3">
                {accountMetrics.map((m) => {
                  const sharePct =
                    portfolioSummary.totalInitialFunds > 0
                      ? (m.account.initialBalance / portfolioSummary.totalInitialFunds) * 100
                      : 0;
                  return (
                    <div key={m.account.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: m.account.color || "#598bff" }}
                          />
                          <span className="font-medium truncate">{m.account.name}</span>
                        </div>
                        <span className="tabular font-semibold text-muted-foreground shrink-0">
                          {sharePct.toFixed(1)}%
                        </span>
                      </div>
                      <Progress
                        value={sharePct}
                        className="h-1.5"
                        style={
                          {
                            "--progress-background": m.account.color || "#598bff",
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Seed Capital</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(portfolioSummary.totalInitialFunds, "$")}
              </span>
            </div>
          </Card>
        </div>

        {/* ACCOUNT CARDS GRID */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Your Accounts ({accounts.length}/15)</h2>
              <p className="text-xs text-muted-foreground">
                Each account holds segregated trade statistics, balance, and rules
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={activeAccountId === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveAccountId("all")}
                className="h-8 text-xs font-medium"
              >
                All Accounts View
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accountMetrics.map((m) => {
              const acc = m.account;
              const isSelected = activeAccountId === acc.id;

              return (
                <Card
                  key={acc.id}
                  className={cn(
                    "relative flex flex-col justify-between overflow-hidden p-5 transition-all duration-200 border",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                      : "border-border bg-surface hover:border-border/80",
                  )}
                >
                  {/* Top Color Accent Line */}
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ backgroundColor: acc.color || "#598bff" }}
                  />

                  <div>
                    {/* Header: Name, Broker & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: acc.color || "#598bff" }}
                          />
                          <h3 className="truncate font-bold text-base text-foreground">
                            {acc.name}
                          </h3>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px] font-semibold py-0">
                            {acc.broker}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">
                            {acc.type}
                          </Badge>
                          {acc.status && acc.status !== "active" && (
                            <Badge
                              className={cn(
                                "text-[10px] py-0 capitalize",
                                acc.status === "funded"
                                  ? "bg-profit/20 text-profit border-profit/30"
                                  : "bg-loss/20 text-loss border-loss/30",
                              )}
                            >
                              {acc.status}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openEditDialog(acc)}
                          title="Edit Account"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        {accounts.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-loss hover:text-loss"
                            onClick={() => setDeleteConfirmId(acc.id)}
                            title="Delete Account"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Balances Section */}
                    <div className="mt-4 rounded-xl bg-surface-2 p-3.5 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Current Equity</span>
                        <span className="tabular text-xl font-bold text-foreground">
                          {formatCurrency(m.currentBalance, acc.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Starting Capital</span>
                        <span className="tabular font-medium text-foreground">
                          {formatCurrency(acc.initialBalance, acc.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                        <span className="text-muted-foreground">Net P&amp;L</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "tabular font-bold",
                              m.totalPnl >= 0 ? "text-profit" : "text-loss",
                            )}
                          >
                            {signedCurrency(m.totalPnl, acc.currency)}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.2 text-[10px] font-semibold",
                              m.roiPercent >= 0
                                ? "bg-profit/15 text-profit"
                                : "bg-loss/15 text-loss",
                            )}
                          >
                            {m.roiPercent >= 0 ? "+" : ""}
                            {m.roiPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Trading Stats */}
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-surface-2/60 p-2">
                        <p className="text-[10px] text-muted-foreground">Win Rate</p>
                        <p className="tabular font-bold text-foreground mt-0.5">
                          {m.winRate.toFixed(1)}%
                        </p>
                      </div>
                      <div className="rounded-lg bg-surface-2/60 p-2">
                        <p className="text-[10px] text-muted-foreground">Trades</p>
                        <p className="tabular font-bold text-foreground mt-0.5">
                          {m.tradesCount} <span className="text-[10px] text-muted-foreground font-normal">({m.winsCount}W-{m.lossesCount}L)</span>
                        </p>
                      </div>
                      <div className="rounded-lg bg-surface-2/60 p-2">
                        <p className="text-[10px] text-muted-foreground">Profit Factor</p>
                        <p className="tabular font-bold text-foreground mt-0.5">
                          {m.profitFactor > 0 ? m.profitFactor.toFixed(2) : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Prop Firm / Target Goals (if specified) */}
                    {(m.targetProgress !== null || (acc.maxDrawdownPercent && acc.maxDrawdownPercent > 0)) && (
                      <div className="mt-3 rounded-lg border border-border/70 p-2.5 text-xs space-y-2">
                        {m.targetProgress !== null && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 text-muted-foreground font-medium">
                                <Target className="size-3 text-profit" /> Target ({acc.targetProfitPercent}%)
                              </span>
                              <span className="tabular font-semibold text-profit">
                                {m.targetProgress.toFixed(1)}%
                              </span>
                            </div>
                            <Progress value={m.targetProgress} className="h-1.5" />
                          </div>
                        )}

                        {acc.maxDrawdownPercent && acc.maxDrawdownPercent > 0 && (
                          <div className="flex items-center justify-between text-[11px] pt-1">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <ShieldAlert className="size-3 text-yellow-400" /> Max Drawdown
                            </span>
                            <span
                              className={cn(
                                "tabular font-semibold",
                                m.maxDrawdownPct >= acc.maxDrawdownPercent
                                  ? "text-loss"
                                  : m.maxDrawdownPct >= acc.maxDrawdownPercent * 0.75
                                  ? "text-yellow-400"
                                  : "text-muted-foreground",
                              )}
                            >
                              {m.maxDrawdownPct.toFixed(1)}% / {acc.maxDrawdownPercent}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveAccountId(acc.id)}
                      className="h-8 text-xs font-semibold flex-1"
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="size-3.5 mr-1" /> Active Account
                        </>
                      ) : (
                        "Select Account"
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActiveAccountId(acc.id);
                        void navigate({ to: "/trade-log" });
                      }}
                      className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Trades <ChevronRight className="size-3.5 ml-0.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* ADD / EDIT ACCOUNT MODAL */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg bg-surface border-border">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Edit Trading Account" : "Add New Trading Account"}
              </DialogTitle>
              <DialogDescription>
                Configure initial capital, broker, and risk targets. Maximum 15 accounts allowed.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="acc-name">Account Name *</Label>
                <Input
                  id="acc-name"
                  placeholder="e.g. FTMO 100K Challenge, Zerodha F&O"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Account Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Broker / Platform</Label>
                  <Select value={broker} onValueChange={setBroker}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BROKERS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {broker === "Other Broker" && (
                <div className="grid gap-2">
                  <Label htmlFor="custom-broker">Broker Name</Label>
                  <Input
                    id="custom-broker"
                    placeholder="Enter broker or exchange name"
                    value={customBroker}
                    onChange={(e) => setCustomBroker(e.target.value)}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="initial-balance">Starting Funds / Balance *</Label>
                  <Input
                    id="initial-balance"
                    type="number"
                    step="any"
                    placeholder="25000"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Account Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c} ({c === "$" ? "USD" : c === "₹" ? "INR" : c === "€" ? "EUR" : c === "£" ? "GBP" : c})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="target-profit">Target Profit % (Optional)</Label>
                  <Input
                    id="target-profit"
                    type="number"
                    step="any"
                    placeholder="e.g. 10 (for 10% goal)"
                    value={targetProfitPercent}
                    onChange={(e) => setTargetProfitPercent(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="max-dd">Max Drawdown Limit % (Optional)</Label>
                  <Input
                    id="max-dd"
                    type="number"
                    step="any"
                    placeholder="e.g. 10 (for prop firms)"
                    value={maxDrawdownPercent}
                    onChange={(e) => setMaxDrawdownPercent(e.target.value)}
                  />
                </div>
              </div>

              {/* Color Accent Picker */}
              <div className="grid gap-2">
                <Label>Account Color Accent</Label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "size-6 rounded-full transition-transform",
                        color === c && "ring-2 ring-foreground ring-offset-2 scale-110",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="grid gap-2">
                <Label>Account Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as AccountStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="funded">Funded / Passed</SelectItem>
                    <SelectItem value="breached">Breached / Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="acc-desc">Strategy Description (Optional)</Label>
                <Textarea
                  id="acc-desc"
                  rows={2}
                  placeholder="e.g. 5-min scalp strategy on NIFTY options, strict 1:2 R:R"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : editingAccount ? "Save Changes" : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-loss flex items-center gap-2">
              <Trash2 className="size-5" /> Delete Trading Account?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this account? Existing logged trades associated with this account will remain in your journal and can be reassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => deleteConfirmId && void handleDelete(deleteConfirmId)}
            >
              {busy ? "Deleting…" : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
