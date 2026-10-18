import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MapPin, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { supabase } from "@/integrations/supabase/client";
import { requireLocation } from "@/lib/location";

export function LocationGate({ children }: { children: ReactNode }) {
  const protectedPage = useRouterState({ select: (state) => state.matches.some((match) => match.routeId.startsWith("/_authenticated")) });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!protectedPage || !navigator.permissions) return;
    let permission: PermissionStatus | undefined;
    let disposed = false;
    navigator.permissions.query({ name: "geolocation" }).then((result) => {
      if (disposed) return;
      permission = result;
      result.onchange = () => { if (result.state !== "granted") setReady(false); };
    }).catch(() => {});
    return () => { disposed = true; if (permission) permission.onchange = null; };
  }, [protectedPage]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") setReady(false); });
    return () => data.subscription.unsubscribe();
  }, []);
  async function enable() {
    setBusy(true); setError("");
    try { await requireLocation(); setReady(true); } catch (failure) { setError(failure instanceof Error ? failure.message : "Location unavailable"); }
    finally { setBusy(false); }
  }
  if (!protectedPage || ready) return children;
  return <main className="grid min-h-dvh place-items-center bg-background px-6">
    <div className="w-full max-w-md space-y-6 py-12"><Brand /><MapPin className="size-12 text-primary" />
      <div><h1 className="text-3xl font-semibold">Enable your location</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Location is required for every staff account. Parcel scans and handovers record where work happens. Your location is visible only to authorized operations staff.</p></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="h-12 w-full" onClick={enable} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <MapPin />} {busy ? "Finding your location…" : "Enable location"}</Button>
      <Button variant="ghost" onClick={() => supabase.auth.signOut()}><LogOut />Sign out</Button>
    </div>
  </main>;
}