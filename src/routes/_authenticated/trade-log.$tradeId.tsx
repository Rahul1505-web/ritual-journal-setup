import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/app-layout";
import { ChartLightbox, ChartUploader } from "@/components/chart-uploader";
import { PnlCell } from "@/components/journal-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useJournal } from "@/lib/journal-store";
import { formatDate, money, pnl } from "@/lib/trades";

export const Route = createFileRoute("/_authenticated/trade-log/$tradeId")({
  head: () => ({
    meta: [
      { title: "Trade Detail — TradeLog Pro" },
      {
        name: "description",
        content: "Full detail of a single trade: entry, exit, P&L, emotion, notes and chart screenshots.",
      },
      { property: "og:title", content: "Trade Detail — TradeLog Pro" },
      {
        property: "og:description",
        content: "Full detail of a single logged trade including chart screenshots.",
      },
    ],
  }),
  component: TradeDetail,
});

function TradeDetail() {
  const { tradeId } = Route.useParams();
  const navigate = useNavigate();
  const { trades, updateTradeCharts, deleteTrade, isDemo, loading } = useJournal();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const trade = trades.find((t) => t.id === tradeId);
  const charts = trade?.charts ?? [];

  const back = (
    <Link
      to="/trade-log"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to Trade Log
    </Link>
  );

  if (!trade) {
    return (
      <AppLayout title="Trade" subtitle="Trade detail">
        {back}
        <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">
          {loading ? "Loading trade…" : "This trade no longer exists."}
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={trade.symbol} subtitle={`${trade.market} · ${formatDate(trade.date)}`}>
      {back}

      <Card className="mt-6 gap-4 p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">{trade.symbol}</h2>
          <Badge
            variant="outline"
            className={
              trade.direction === "BUY" ? "border-profit/40 text-profit" : "border-loss/40 text-loss"
            }
          >
            {trade.direction}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Detail label="Market" value={trade.market} />
          <Detail label="Trade type" value={trade.tradeType} />
          <Detail label="Entry" value={money(trade.entry)} />
          <Detail label="Exit" value={money(trade.exit)} />
          <Detail label="Quantity" value={String(trade.quantity)} />
          <Detail label="Emotion" value={trade.emotion} />
          <Detail label="Date" value={formatDate(trade.date)} />
          <div>
            <p className="text-xs text-muted-foreground">P&L</p>
            <PnlCell value={pnl(trade)} />
          </div>
        </div>
        {trade.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {trade.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted-foreground">
          {trade.notes || "No notes recorded for this trade."}
        </p>
      </Card>

      <Card className="mt-6 gap-3 p-6">
        <h3 className="text-sm font-semibold">Chart Screenshots</h3>
        {isDemo ? (
          <p className="text-xs text-muted-foreground">
            Screenshots are available once you log your own trades.
          </p>
        ) : (
          <ChartUploader
            value={charts}
            onChange={(paths) => void updateTradeCharts(trade.id, paths)}
            onView={setLightbox}
          />
        )}
      </Card>

      {!isDemo ? (
        <Card className="mt-6 gap-3 border-loss/30 p-6">
          <h3 className="text-sm font-semibold text-loss">Danger zone</h3>
          <p className="text-xs text-muted-foreground">
            Permanently remove this trade and all of its chart screenshots.
          </p>
          <div>
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> Delete Trade
            </Button>
          </div>
        </Card>
      ) : null}

      <ChartLightbox
        paths={charts}
        index={lightbox}
        onClose={() => setLightbox(null)}
        onDelete={(path) => void updateTradeCharts(trade.id, charts.filter((p) => p !== path))}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this trade?</AlertDialogTitle>
            <AlertDialogDescription>
              This trade will be permanently deleted and cannot be restored. All associated data
              including chart screenshots will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-loss text-white hover:bg-loss/90"
              onClick={() => {
                void (async () => {
                  try {
                    await deleteTrade(trade.id);
                    toast.success("Trade deleted.");
                    void navigate({ to: "/trade-log" });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not delete trade.");
                  }
                })();
              }}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
