import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AuthPolicy = { mode: "both" | "otp" | "password"; email_required: boolean };
export type MapsSetting = { provider: "google" | "osm"; google_key?: string };

export const DEFAULT_AUTH_POLICY: AuthPolicy = { mode: "both", email_required: false };

async function read<T>(key: string, fallback: T): Promise<T> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  return { ...fallback, ...((data?.value as object) ?? {}) } as T;
}

export function useAuthPolicy() {
  return useQuery({ queryKey: ["app_settings", "auth_policy"], queryFn: () => read<AuthPolicy>("auth_policy", DEFAULT_AUTH_POLICY), staleTime: 60_000 });
}
export function useMapsSetting() {
  return useQuery({ queryKey: ["app_settings", "maps"], queryFn: () => read<MapsSetting>("maps", { provider: "google" }), staleTime: 60_000 });
}

/** Password rules checked live under the input. Strong passwords avoid the "weak password" sign-up error. */
export function passwordChecks(pw: string) {
  return [
    { ok: pw.length >= 8, label: "At least 8 characters" },
    { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), label: "Upper and lower case letters" },
    { ok: /[0-9]/.test(pw), label: "A number" },
    { ok: /[^A-Za-z0-9]/.test(pw), label: "A symbol (e.g. @ # !)" },
    { ok: pw.length > 0 && !/^(.)\1+$/.test(pw) && !/(password|123456|qwerty|bnoy|abcdef)/i.test(pw), label: "Not a common or repeated pattern" },
  ];
}
export function passwordScore(pw: string) {
  return passwordChecks(pw).filter((c) => c.ok).length;
}
export const isStrongPassword = (pw: string) => passwordScore(pw) === 5;
