import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  ACCEPTED_CHART_TYPES,
  MAX_CHARTS,
  deleteChart,
  uploadChart,
  useSignedChartUrls,
  validateChartFile,
} from "@/lib/trade-charts";

interface ChartUploaderProps {
  value: string[];
  onChange: (paths: string[]) => void;
  onView?: (index: number) => void;
}

export function ChartUploader({ value, onChange, onView }: ChartUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const urls = useSignedChartUrls(value);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const room = MAX_CHARTS - value.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_CHARTS} screenshots per trade.`);
      return;
    }
    const accepted: File[] = [];
    for (const file of files.slice(0, room)) {
      const problem = validateChartFile(file);
      if (problem) toast.error(problem);
      else accepted.push(file);
    }
    if (files.length > room) toast.error(`Only ${MAX_CHARTS} screenshots allowed — extras skipped.`);
    if (accepted.length === 0) return;

    setUploading(accepted.length);
    const uploaded: string[] = [];
    for (const file of accepted) {
      try {
        uploaded.push(await uploadChart(file));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (uploaded.length) onChange([...value, ...uploaded]);
  };

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
        <ImagePlus className="size-4" /> Add Photo
      </Button>
      <p className="text-xs text-muted-foreground">
        JPG, PNG, WEBP or GIF · max 5MB each · up to {MAX_CHARTS} images
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_CHART_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {uploading > 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Uploading {uploading} image
          {uploading > 1 ? "s" : ""}…
        </p>
      ) : null}

      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {value.map((path, i) => (
            <button
              type="button"
              key={path}
              onClick={() => onView?.(i)}
              className="overflow-hidden rounded-xl border border-border bg-surface-2"
            >
              {urls[path] ? (
                <img
                  src={urls[path]}
                  alt="Trade chart screenshot"
                  loading="lazy"
                  className="aspect-[4/3] w-full cursor-zoom-in object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ChartLightbox({
  paths,
  index,
  onClose,
  onDelete,
}: {
  paths: string[];
  index: number | null;
  onClose: () => void;
  onDelete?: (path: string) => void;
}) {
  const urls = useSignedChartUrls(paths);
  const [confirm, setConfirm] = useState(false);
  if (index === null || !paths[index]) return null;
  const path = paths[index];
  const url = urls[path];

  return (
    <div
      role="dialog"
      aria-label="Chart screenshot"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image"
        className="absolute right-4 top-4 rounded-full bg-surface-2 p-2 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      {url ? (
        <img
          src={url}
          alt="Trade chart screenshot full size"
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-xl object-contain"
        />
      ) : (
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      )}

      {onDelete ? (
        <div className="absolute bottom-6 right-6" onClick={(e) => e.stopPropagation()}>
          <Button variant="destructive" onClick={() => setConfirm(true)}>
            <Trash2 className="size-4" /> Delete Image
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This image cannot be restored.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-loss text-white hover:bg-loss/90"
              onClick={() => {
                setConfirm(false);
                onDelete?.(path);
                void deleteChart(path);
                onClose();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
