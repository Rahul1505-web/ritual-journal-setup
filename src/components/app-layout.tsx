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
} from "lucide-react";
import type { ReactNode } from "react";

import { useJournal } from "@/lib/journal-store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", exact: true, icon: LayoutDashboard },
  { to: "/add-trade", label: "Add Trade", exact: false, icon: PlusCircle },
  { to: "/trade-log", label: "Trade Log", exact: false, icon: TableProperties },
  { to: "/analytics", label: "Analytics", exact: false, icon: BarChart3 },
  { to: "/ai-coach", label: "AI Coach", exact: false, icon: Bot },
  { to: "/rules", label: "Rules", exact: false, icon: ListChecks },
  { to: "/profile", label: "Profile", exact: false, icon: User },
] as const;

const SETTINGS_ITEM = {
  to: "/settings",
  label: "Settings",
  exact: false,
  icon: Settings,
} as const;

const MOBILE_NAV = NAV.filter((n) => n.label !== "Rules" && n.label !== "Profile");


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
  const { isDemo } = useJournal();

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-background text-foreground">
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

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-background/80 px-5 py-5 backdrop-blur-sm sm:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            {subtitle ? (
              <p className="mt-1 truncate text-xs font-medium text-muted-foreground sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
        </header>
        {isDemo ? (
          <div className="mx-5 mt-6 rounded-xl border border-warning/30 bg-warning/10 px-5 py-3 text-xs font-medium text-muted-foreground sm:mx-8">
            Showing sample data — log your first trade and this journal switches to your real trades.
          </div>
        ) : null}
        <main className="animate-in fade-in duration-300 px-5 pb-28 pt-6 sm:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-sidebar/95 backdrop-blur-sm lg:hidden">
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-1 py-3 text-[10px] font-medium text-muted-foreground transition-all duration-200",
              isActive(item.to, item.exact) && "font-semibold text-primary",
            )}
          >
            <item.icon className="size-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
