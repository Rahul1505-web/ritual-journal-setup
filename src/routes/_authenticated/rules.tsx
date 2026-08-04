import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useJournal } from "@/lib/journal-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/rules")({
  head: () => ({
    meta: [
      { title: "Trading Rules — TradeLog Pro" },
      {
        name: "description",
        content: "Write your trading rules and run the pre-trade checklist before every entry.",
      },
      { property: "og:title", content: "Trading Rules — TradeLog Pro" },
      {
        property: "og:description",
        content: "Write your trading rules and run the pre-trade checklist before every entry.",
      },
    ],
  }),
  component: Rules,
});

function Rules() {
  const { rules, addRule, removeRule, updateRule } = useJournal();
  const [draft, setDraft] = useState("");
  const [checked, setChecked] = useState<string[]>([]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    addRule(draft.trim());
    setDraft("");
    toast.success("Rule added to your playbook");
  };

  const toggle = (id: string) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  return (
    <AppLayout title="Rules" subtitle="Your playbook and pre-trade checklist">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="gap-6 p-6">
          <div>
            <h2 className="text-lg font-semibold">Trading rules</h2>
            <p className="text-xs text-muted-foreground">Edit any rule inline, or add a new one.</p>
          </div>
          <form onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Never trade without a stop loss"
            />
            <Button type="submit" size="icon" className="shrink-0">
              <Plus className="size-4" />
            </Button>
          </form>
          <div className="space-y-2">
            {rules.map((rule, i) => (
              <div
                key={rule.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2"
              >
                <span className="tabular shrink-0 text-xs text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Input
                  value={rule.text}
                  onChange={(e) => updateRule(rule.id, e.target.value)}
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-loss"
                  onClick={() => removeRule(rule.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="gap-6 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck className="size-4 text-primary" /> Pre-trade checklist
              </h2>
              <p className="text-xs text-muted-foreground">
                Run this before every entry — mark each rule followed or broken.
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0",
                checked.length === rules.length ? "border-profit/40 text-profit" : "border-warning/40 text-warning",
              )}
            >
              {checked.length}/{rules.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {rules.map((rule) => {
              const ok = checked.includes(rule.id);
              return (
                <label
                  key={rule.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors",
                    ok ? "border-profit/35 bg-profit/10" : "border-border bg-surface-2",
                  )}
                >
                  <Checkbox checked={ok} onCheckedChange={() => toggle(rule.id)} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="block">{rule.text}</span>
                    <span className={cn("text-xs", ok ? "text-profit" : "text-loss")}>
                      {ok ? "Followed" : "Broken / unchecked"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <Button
            variant={checked.length === rules.length ? "default" : "secondary"}
            onClick={() =>
              toast[checked.length === rules.length ? "success" : "warning"](
                checked.length === rules.length
                  ? "All rules cleared — you are good to trade."
                  : `${rules.length - checked.length} rule(s) unchecked. Think twice.`,
              )
            }
          >
            Validate checklist
          </Button>
        </Card>
      </div>
    </AppLayout>
  );
}
