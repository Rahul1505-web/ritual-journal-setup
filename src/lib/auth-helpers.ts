import { supabase } from "@/integrations/supabase/client";

export interface EffectiveUser {
  id: string;
  email: string;
  user_metadata?: {
    name?: string | undefined;
    full_name?: string | undefined;
  } | undefined;
  isGuest?: boolean | undefined;
}

const GUEST_KEY = "tradelog_guest_user";

export function getStoredGuestUser(): EffectiveUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EffectiveUser;
  } catch {
    return null;
  }
}

export function setGuestUser(email?: string, name?: string): EffectiveUser {
  const cleanEmail = email?.trim() || "trader@tradelog.local";
  const guest: EffectiveUser = {
    id: `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    email: cleanEmail,
    user_metadata: {
      name: name || cleanEmail.split("@")[0] || "Trader",
      full_name: name || cleanEmail.split("@")[0] || "Trader",
    },
    isGuest: true,
  };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
    } catch {
      // ignore storage errors
    }
  }
  return guest;
}

export function clearGuestUser(): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      // ignore
    }
  }
}

export async function getEffectiveUser(): Promise<EffectiveUser | null> {
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const meta = data.user.user_metadata as { name?: string; full_name?: string } | undefined;
      return {
        id: data.user.id,
        email: data.user.email ?? "",
        ...(meta ? { user_metadata: meta } : {}),
        isGuest: false,
      };
    }
  } catch {
    // network or supabase issue
  }

  const guest = getStoredGuestUser();
  if (guest) return guest;

  return null;
}
