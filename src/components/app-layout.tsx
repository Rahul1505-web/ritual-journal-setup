import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  LayoutDashboard,
  ListChecks,
  PlusCircle,
  Settings,
  TableProperties,
  CandlestickChart,
  User,
  WalletCards,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { useJournal } from "@/lib/journal-store";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const NAV = [
  { to: "/", label: "Dashboard", exact: true, icon: LayoutDashboard },
  { to: "/add-trade", label: "Add Trade", exact: false, icon: PlusCircle },
  { to: "/trade-log", label: "Trade Log", exact: false, icon: TableProperties },
  { to: "/analytics", label: "Analytics", exact: false, icon: BarChart3 },
  { to: "/ai-coach", label: "AI Coach", exact: false, icon: Bot },
  { to: "/rules", label: "Rules", exact: false, icon: ListChecks },
  { to: "/accounts", label: "Accounts", exact: false, icon: WalletCards },
  { to: "/profile", label: "Profile", exact: false, icon: User },
] as const;

const SETTINGS_ITEM = {
  to: "/settings",
  label: "Settings",
  exact: false,
  icon: Settings,
} as const;

// 6 key items shown directly in mobile bottom bar
const MOBILE_BOTTOM_NAV = [
  { to: "/", label: "Dashboard", exact: true, icon: LayoutDashboard },
  { to: "/trade-log", label: "Trades", exact: false, icon: TableProperties },
  { to: "/add-trade", label: "Add Trade", exact: false, icon: PlusCircle },
  { to: "/rules", label: "Rules", exact: false, icon: ListChecks },
  { to: "/accounts", label: "Accounts", exact: false, icon: WalletCards },
  { to: "/profile", label: "Profile", exact: false, icon: User },
] as const;

export function AppLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isDemo, accounts, activeAccountId, setActiveAccountId } = useJournal();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-md lg:flex">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <CandlestickChart className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight">TradeLog Pro</p>
            <p className="truncate text-xs text-muted-foreground">Trading journal</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 px-3 py-4">
          {NAV.map((item) => (
            <div key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-foreground",
                  isActive(item.to, item.exact) && "bg-primary/15 font-semibold text-primary",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            </div>
          ))}
        </nav>

        <div className="mt-2 border-t border-sidebar-border px-3 py-4">
          <Link
            to={SETTINGS_ITEM.to}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-foreground",
              isActive(SETTINGS_ITEM.to, SETTINGS_ITEM.exact) && "bg-primary/15 font-semibold text-primary",
            )}
          >
            <SETTINGS_ITEM.icon className="size-4 shrink-0" />
            <span className="truncate">{SETTINGS_ITEM.label}</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3.5 backdrop-blur-sm sm:px-8 sm:py-5">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Drawer Trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-foreground transition-colors hover:bg-surface-3 lg:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[280px] p-0 bg-sidebar border-r border-sidebar-border flex flex-col"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation Menu</SheetTitle>
                </SheetHeader>

                {/* Drawer Branding Header */}
                <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <CandlestickChart className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold tracking-tight text-white">
                      TradeLog Pro
                    </p>
                    <p className="truncate text-xs text-muted-foreground">Trading journal</p>
                  </div>
                </div>

                {/* Drawer Navigation Links */}
                <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
                  {NAV.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-foreground",
                        isActive(item.to, item.exact) && "bg-primary/15 font-semibold text-primary",
                      )}
                    >
                      <item.icon className="size-4.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  ))}
                </nav>

                {/* Drawer Footer / Settings */}
                <div className="border-t border-sidebar-border px-3 py-3">
                  <Link
                    to={SETTINGS_ITEM.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-foreground",
                      isActive(SETTINGS_ITEM.to, SETTINGS_ITEM.exact) &&
                        "bg-primary/15 font-semibold text-primary",
                    )}
                  >
                    <SETTINGS_ITEM.icon className="size-4.5 shrink-0" />
                    <span className="truncate">{SETTINGS_ITEM.label}</span>
                  </Link>
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground sm:text-sm">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {accounts.length > 0 ? (
              <Select value={activeAccountId} onValueChange={setActiveAccountId}>
                <SelectTrigger className="h-8.5 w-[130px] border-border bg-surface-2 text-xs font-medium sm:h-9 sm:w-[190px]">
                  <WalletCards className="mr-1.5 size-3.5 shrink-0 text-primary" />
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent align="end" className="w-[220px]">
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary shrink-0" />
                      <span className="font-semibold">All Accounts (Total)</span>
                    </div>
                  </SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: acc.color || "#598bff" }}
                        />
                        <span className="truncate">{acc.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {actions}
          </div>
        </header>

        {isDemo ? (
          <div className="mx-4 mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:mx-8 sm:mt-6 sm:px-5 sm:py-3">
            Showing sample data — log your first trade and this journal switches to your real trades.
          </div>
        ) : null}

        <main className="animate-in fade-in duration-300 px-4 pb-28 pt-5 sm:px-8 sm:pt-6 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar: Includes Rules, Accounts, and Profile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-sidebar/95 backdrop-blur-md px-1 py-1.5 lg:hidden">
        {MOBILE_BOTTOM_NAV.map((item) => {
          const active = isActive(item.to, item.exact);
          const isAdd = item.to === "/add-trade";

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 px-0.5 text-[10px] font-medium transition-all duration-150",
                active
                  ? "font-semibold text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div
                className={cn(
                  "grid size-7 place-items-center rounded-lg transition-transform",
                  isAdd && "bg-primary text-primary-foreground shadow-sm scale-105",
                  active && !isAdd && "bg-primary/10",
                )}
              >
                <item.icon className={cn("size-4 shrink-0", isAdd && "text-primary-foreground")} />
              </div>
              <span className="truncate text-[9px] leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
