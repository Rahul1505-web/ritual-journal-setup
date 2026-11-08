import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

import { getEffectiveUser } from "@/lib/auth-helpers";

export const CHART_BUCKET = "trade-charts";
export const MAX_CHARTS = 5;
export const MAX_CHART_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_CHART_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validateChartFile(file: File): string | null {
  if (!ACCEPTED_CHART_TYPES.includes(file.type)) {
    return `${file.name}: only JPG, PNG, WEBP or GIF images are allowed.`;
  }
  if (file.size > MAX_CHART_BYTES) {
    return `${file.name}: image is larger than 5MB.`;
  }
  return null;
}

/** Uploads one screenshot and returns its storage path or data URL with automatic fallback. */
export async function uploadChart(file: File): Promise<string> {
  const user = await getEffectiveUser();
  if (!user) throw new Error("You must be signed in to upload screenshots.");

  if (user.isGuest) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to process local image"));
      reader.readAsDataURL(file);
    });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  try {
    const { error } = await supabase.storage.from(CHART_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      console.warn("[Trade Charts] Supabase storage upload failed, falling back to data URL:", error);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to process image locally"));
        reader.readAsDataURL(file);
      });
    }
    return path;
  } catch (err) {
    console.warn("[Trade Charts] Supabase storage exception, falling back to data URL:", err);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to process image locally"));
      reader.readAsDataURL(file);
    });
  }
}

export async function deleteChart(path: string): Promise<void> {
  if (path.startsWith("data:") || path.startsWith("blob:") || path.startsWith("http")) {
    return;
  }
  await supabase.storage.from(CHART_BUCKET).remove([path]);
}

/** Signs private storage paths so they can be rendered in <img>. */
export function useSignedChartUrls(paths: string[]): Record<string, string> {
  const key = paths.join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split("|") : [];
    if (list.length === 0) {
      setUrls({});
      return;
    }

    const immediateUrls: Record<string, string> = {};
    const storagePaths: string[] = [];

    for (const p of list) {
      if (p.startsWith("data:") || p.startsWith("blob:") || p.startsWith("http://") || p.startsWith("https://")) {
        immediateUrls[p] = p;
      } else {
        storagePaths.push(p);
      }
    }

    if (storagePaths.length === 0) {
      setUrls(immediateUrls);
      return;
    }

    void supabase.storage
      .from(CHART_BUCKET)
      .createSignedUrls(storagePaths, 60 * 60 * 24 * 7)
      .then(({ data }) => {
        if (cancelled) return;
        const next: Record<string, string> = { ...immediateUrls };
        if (data) {
          data.forEach((row, i) => {
            const p = row.path ?? storagePaths[i];
            const signed = row.signedUrl || (row as any).signedURL;
            if (p && signed) {
              next[p] = signed;
            } else if (p) {
              const { data: pubData } = supabase.storage.from(CHART_BUCKET).getPublicUrl(p);
              if (pubData?.publicUrl) next[p] = pubData.publicUrl;
            }
          });
        }
        setUrls(next);
      })
      .catch(() => {
        if (!cancelled) {
          const fallbackUrls: Record<string, string> = { ...immediateUrls };
          for (const p of storagePaths) {
            const { data: pubData } = supabase.storage.from(CHART_BUCKET).getPublicUrl(p);
            if (pubData?.publicUrl) fallbackUrls[p] = pubData.publicUrl;
          }
          setUrls(fallbackUrls);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return urls;
}

/** Resolves storage paths to signed URLs, or returns data/http URLs as-is */
export async function resolveChartUrls(paths: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const storagePaths: string[] = [];

  for (const p of paths) {
    if (!p) continue;
    if (p.startsWith("data:") || p.startsWith("blob:") || p.startsWith("http://") || p.startsWith("https://")) {
      result[p] = p;
    } else {
      storagePaths.push(p);
    }
  }

  if (storagePaths.length > 0) {
    try {
      const { data } = await supabase.storage.from(CHART_BUCKET).createSignedUrls(storagePaths, 60 * 60 * 24 * 7);
      if (data) {
        data.forEach((row, i) => {
          const p = row.path ?? storagePaths[i];
          const signed = row.signedUrl || (row as any).signedURL;
          if (p && signed) {
            result[p] = signed;
          } else if (p) {
            const { data: pubData } = supabase.storage.from(CHART_BUCKET).getPublicUrl(p);
            if (pubData?.publicUrl) result[p] = pubData.publicUrl;
          }
        });
      }
    } catch (e) {
      console.warn("Failed to sign chart paths:", e);
      for (const p of storagePaths) {
        const { data: pubData } = supabase.storage.from(CHART_BUCKET).getPublicUrl(p);
        if (pubData?.publicUrl) result[p] = pubData.publicUrl;
      }
    }
  }

  return result;
}

