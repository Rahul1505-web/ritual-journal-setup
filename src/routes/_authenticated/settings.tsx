import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useJournal } from "@/lib/journal-store";
import { stats } from "@/lib/trades";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TradeLog Pro" },
      {
        name: "description",
        content: "Configure journaling reminders, checklists and app preferences for your trading journal.",
      },
      { property: "og:title", content: "Settings — TradeLog Pro" },
      {
        property: "og:description",
        content: "Configure journaling reminders, checklists and app preferences.",
      },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { trades, rules } = useJournal();
  const s = stats(trades);

  return (
    <AppLayout title="Settings" subtitle="App preferences">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">

          <Card className="gap-6 p-6">
            <h2 className="text-sm font-semibold">Journaling</h2>
            {[
              ["Require checklist before saving a trade", true],
              ["Daily journaling reminder", true],
              ["Warn me after 3 trades in a day", false],
              ["Weekly AI coach summary", true],
            ].map(([label, on]) => (
              <div key={String(label)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <span className="text-sm">{label}</span>
                <Switch defaultChecked={on as boolean} />
              </div>
            ))}
          </Card>

          <Card className="gap-2 p-6">
            <h2 className="text-sm font-semibold">Journal snapshot</h2>
            <p className="text-sm text-muted-foreground">
              {s.count} trades logged · {rules.length} active rules · {s.winRate.toFixed(1)}% win rate
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm">
                Export CSV
              </Button>
              <Button variant="outline" size="sm">
                Import trades
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
