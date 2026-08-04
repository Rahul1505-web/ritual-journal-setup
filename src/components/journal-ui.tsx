import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { signedMoney } from "@/lib/trades";

export const chartTheme = {
  primary: "var(--primary)",
  profit: "var(--profit)",
  loss: "var(--loss)",
  warning: "var(--warning)",
  grid: "color-mix(in oklab, var(--foreground) 10%, transparent)",
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  tooltip: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--popover-foreground)",
    fontSize: 12,
  } as const,
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "profit" | "loss";
  icon?: LucideIcon;
}) {
  return (
    <Card className="gap-0 p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <Icon
            className={cn(
              "size-4 shrink-0",
              tone === "profit" && "text-profit",
              tone === "loss" && "text-loss",
              tone === "neutral" && "text-primary",
            )}
          />
        ) : null}
      </div>
      <p
        className={cn(
          "tabular mt-3 truncate text-2xl font-semibold sm:text-3xl",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 truncate text-xs font-medium text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  );
}

export function PnlCell({ value }: { value: number }) {
  return (
    <span className={cn("tabular font-semibold", value >= 0 ? "text-profit" : "text-loss")}>
      {signedMoney(value)}
    </span>
  );
}
