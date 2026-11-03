import { useEffect, useRef, useState } from "react";
import { Clipboard, ImagePlus, Loader2, Trash2, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface ChartUploaderProps {
  value: string[];
  onChange: (paths: string[]) => void;
  onView?: (index: number) => void;
}

export function ChartUploader({ value, onChange, onView }: ChartUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const urls = useSignedChartUrls(value);

  const handleFiles = async (fileList: FileList | File[] | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;
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
        setUploading((n) => Math.max(0, n - 1));
      }
    }
    if (uploaded.length) {
      onChange([...value, ...uploaded]);
      toast.success(
        uploaded.length === 1
          ? "Screenshot attached to trade!"
          : `${uploaded.length} screenshots attached to trade!`,
      );
    }
  };

  // ── Global & Container Ctrl + V Paste Listener ──
  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        void handleFiles(imageFiles);
      }
    };

    window.addEventListener("paste", onWindowPaste);
    return () => {
      window.removeEventListener("paste", onWindowPaste);
    };
  }, [value, onChange]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone & Ctrl + V paste card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative rounded-xl border border-dashed transition-all p-5 flex flex-col items-center justify-center text-center gap-3 cursor-pointer group",
          isDragging
            ? "border-primary bg-primary/10 shadow-sm"
            : "border-border/80 bg-surface-2/40 hover:bg-surface-2/80 hover:border-primary/50",
          value.length >= MAX_CHARTS && "opacity-50 pointer-events-none",
        )}
      >
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="gap-2 font-medium bg-background hover:bg-muted"
          >
            <ImagePlus className="size-4 text-primary" />
            <span>Add Photo</span>
          </Button>

          <span className="text-xs text-muted-foreground font-medium select-none">or</span>

          {/* Prominent Ctrl + V Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium select-none shadow-xs">
            <Clipboard className="size-3.5" />
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-primary/30 font-mono text-[11px] font-bold text-foreground">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-primary/30 font-mono text-[11px] font-bold text-foreground">
              V
            </kbd>
            <span>to paste screenshot</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Paste clipboard chart (<kbd className="font-mono text-[10px]">Ctrl+V</kbd>), drag & drop image file, or click to browse · max 5MB each · {value.length}/{MAX_CHARTS} attached
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
      </div>

      {uploading > 0 ? (
        <div className="flex items-center gap-2 text-xs font-medium text-primary p-2.5 rounded-lg bg-primary/10 border border-primary/20 animate-pulse">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>Uploading {uploading} screenshot{uploading > 1 ? "s" : ""} from clipboard/file...</span>
        </div>
      ) : null}

      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {value.map((path, i) => (
            <div
              key={path}
              className="group relative overflow-hidden rounded-xl border border-border bg-surface-2 aspect-[4/3] shadow-xs"
            >
              {urls[path] ? (
                <img
                  src={urls[path]}
                  alt="Trade chart screenshot"
                  loading="lazy"
                  onClick={() => onView?.(i)}
                  className="size-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Hover overlay with action buttons */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                <span className="text-[11px] font-medium text-white px-2 py-1 rounded bg-black/60 backdrop-blur-xs">
                  Click to Zoom
                </span>
              </div>

              {/* Quick remove button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((_, idx) => idx !== i));
                  void deleteChart(path);
                  toast.success("Screenshot removed.");
                }}
                className="absolute top-2 right-2 size-7 rounded-lg bg-background/85 backdrop-blur-xs text-muted-foreground hover:text-loss hover:bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                title="Remove screenshot"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
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
