import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, MapPin, Navigation, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useMe, useTeam } from "@/lib/auth";
import { selectCls } from "@/lib/ui";
import { fmtDate } from "@/lib/status";
import { pageHead } from "@/lib/seo";
import { photos } from "@/lib/photography";

export const Route = createFileRoute("/_authenticated/returns")({
  head: () => pageHead("Returns & cancellations", "Reverse pickups with photo proof and live rider location."),
  component: Returns,
});

const RETURN_LABEL: Record<string, string> = {
  requested: "Requested", pickup_assigned: "Pickup assigned", picked_up: "Picked up from customer",
  in_transit: "Returning to hub", received: "Received at hub", cancelled: "Closed",
};
const KIND_LABEL: Record<string, string> = { customer_return: "Customer return", rto: "Return to origin", cancellation: "Cancellation" };
const NEXT: Record<string, string | undefined> = { pickup_assigned: "picked_up", picked_up: "in_transit", in_transit: "received" };

type Ret = {
  id: string; shipment_id: string; kind: string; status: string; reason: string; pickup_address: string | null;
  rider_id: string | null; last_lat: number | null; last_lng: number | null; last_location_at: string | null; created_at: string;
  shipments: { tracking_code: string; receiver_name: string; receiver_address: string; city: string } | null;
};

function Returns() {
  const { role } = useMe();
  const { data: team = [] } = useTeam();
  const [filter, setFilter] = useState("open");
  const q = useQuery({
    queryKey: ["returns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("return_requests")
        .select("*, shipments(tracking_code, receiver_name, receiver_address, city)").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as unknown as Ret[];
    },
  });
  const rows = (q.data ?? []).filter((r) => filter === "all" || (filter === "open" ? !["received", "cancelled"].includes(r.status) : r.status === filter));
  const riders = team.filter((t) => t.role === "rider");
  const names = new Map(team.map((t) => [t.id, t.full_name]));

  return (
    <AppShell title="Returns & cancellations">
      <section className="photo-frame relative mb-6 aspect-[4/1] min-h-32 overflow-hidden rounded-md">
        <img src={photos.returnPickup} alt="Rider photographing a return parcel at the customer's door" width={1280} height={960} className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-navy/85 to-transparent p-5 text-navy-foreground">
          <p className="max-w-lg text-sm">Riders collect parcels from customers, attach photos and location, and every step is visible in public tracking.</p>
        </div>
      </section>
      <div className="mb-4 flex flex-wrap gap-2">
        {["open", "pickup_assigned", "picked_up", "received", "all"].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f === "open" ? "Open" : f === "all" ? "All" : RETURN_LABEL[f]}</Button>
        ))}
      </div>
      {q.isLoading && <Loader2 className="mx-auto animate-spin" />}
      {!q.isLoading && rows.length === 0 && (
        <div className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
          <Undo2 className="mx-auto mb-3 size-6" />No returns here. Start one from a shipment's page using “Request return” or “Cancel parcel”.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r) => <ReturnCard key={r.id} r={r} role={role} riders={riders} riderName={r.rider_id ? names.get(r.rider_id) : undefined} />)}
      </div>
    </AppShell>
  );
}

function ReturnCard({ r, role, riders, riderName }: { r: Ret; role: string | null; riders: { id: string; full_name: string }[]; riderName?: string | undefined }) {
  const qc = useQueryClient();
  const { user } = useMe();
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const watch = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isMine = r.rider_id === user?.id;
  const closed = ["received", "cancelled"].includes(r.status);
  const pics = useQuery({
    queryKey: ["return-photos", r.id],
    queryFn: async () => {
      const { data } = await supabase.from("return_photos").select("*").eq("return_id", r.id).order("created_at");
      const out: { id: string; url: string; lat: number | null; lng: number | null }[] = [];
      for (const p of data ?? []) {
        const { data: s } = await supabase.storage.from("return-photos").createSignedUrl(p.path, 3600);
        if (s?.signedUrl) out.push({ id: p.id, url: s.signedUrl, lat: p.lat, lng: p.lng });
      }
      return out;
    },
  });
  useEffect(() => () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); }, []);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["returns"] }); qc.invalidateQueries({ queryKey: ["return-photos", r.id] }); };
  async function patch(p: Partial<{ status: string; rider_id: string | null; last_lat: number; last_lng: number; last_location_at: string }>, msg: string): Promise<void> {
    setBusy(true);
    const { error } = await supabase.from("return_requests").update(p).eq("id", r.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(msg); refresh();
  }
  function getPos(): Promise<GeolocationPosition | null> {
    return new Promise((res) => {
      if (!navigator.geolocation) { res(null); return; }
      navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 10000 });
    });
  }
  function toggleLive() {
    if (!navigator.geolocation) { toast.error("Location is not available on this device"); return; }
    if (watch.current !== null) { navigator.geolocation.clearWatch(watch.current); watch.current = null; setSharing(false); return; }
    let last = 0;
    watch.current = navigator.geolocation.watchPosition(async (p) => {
      if (Date.now() - last < 15000) return; last = Date.now();
      await supabase.from("return_requests").update({ last_lat: p.coords.latitude, last_lng: p.coords.longitude, last_location_at: new Date().toISOString() }).eq("id", r.id);
      qc.invalidateQueries({ queryKey: ["returns"] });
    }, () => { toast.error("Location permission denied"); setSharing(false); }, { enableHighAccuracy: true });
    setSharing(true); toast.success("Sharing live location every 15 seconds");
  }
  async function upload(files: FileList | null) {
    if (!files?.length || !user) return;
    setBusy(true);
    const pos = await getPos();
    let ok = 0;
    for (const f of Array.from(files).slice(0, 10)) {
      if (!f.type.startsWith("image/")) continue;
      const path = `${r.id}/${crypto.randomUUID()}.${f.name.split(".").pop() || "jpg"}`;
      const { error } = await supabase.storage.from("return-photos").upload(path, f, { contentType: f.type });
      if (error) { toast.error(error.message); continue; }
      await supabase.from("return_photos").insert({ return_id: r.id, path, captured_by: user.id, lat: pos?.coords.latitude ?? null, lng: pos?.coords.longitude ?? null, accuracy_m: pos?.coords.accuracy ?? null });
      ok++;
    }
    if (pos) await supabase.from("return_requests").update({ last_lat: pos.coords.latitude, last_lng: pos.coords.longitude, last_location_at: new Date().toISOString() }).eq("id", r.id);
    setBusy(false);
    if (ok) toast.success(`${ok} photo${ok > 1 ? "s" : ""} uploaded${pos ? " with location" : ""}`);
    refresh();
  }
  async function advance() {
    const next = NEXT[r.status]; if (!next) return;
    if (next === "picked_up" && (pics.data?.length ?? 0) === 0) { toast.error("Add at least one parcel photo before pickup"); return; }
    const pos = await getPos();
    await patch({ status: next, ...(pos ? { last_lat: pos.coords.latitude, last_lng: pos.coords.longitude, last_location_at: new Date().toISOString() } : {}) }, `Marked ${RETURN_LABEL[next]}`);
  }

  return (
    <article className="rounded-md border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{KIND_LABEL[r.kind]} · {fmtDate(r.created_at)}</p>
          <Link to="/shipments/$id" params={{ id: r.shipment_id }} className="font-mono font-bold text-primary">{r.shipments?.tracking_code}</Link>
          <p className="truncate text-sm">{r.shipments?.receiver_name} · {r.pickup_address || `${r.shipments?.receiver_address}, ${r.shipments?.city}`}</p>
        </div>
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{RETURN_LABEL[r.status]}</span>
      </div>
      <p className="mt-3 rounded bg-muted p-2 text-sm">{r.reason}</p>
      <p className="mt-3 text-xs text-muted-foreground">Rider: {riderName ?? (r.rider_id ? "Assigned" : "Unassigned")}</p>
      {r.last_lat != null && r.last_lng != null && (
        <a className="mt-1 inline-flex items-center gap-1 text-xs text-primary" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${r.last_lat},${r.last_lng}`}>
          <MapPin className="size-3" /> Last location {fmtDate(r.last_location_at)}
        </a>
      )}
      {(pics.data?.length ?? 0) > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {pics.data!.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="Return parcel proof" className="aspect-square w-full rounded object-cover" loading="lazy" /></a>)}
        </div>
      )}
      {!closed && (
        <div className="mt-4 flex flex-wrap gap-2">
          {role !== "rider" && (
            <select aria-label="Assign pickup rider" className={`${selectCls} max-w-48`} disabled={busy} value={r.rider_id ?? ""} onChange={(e) => patch({ rider_id: e.target.value || null }, "Pickup rider updated")}>
              <option value="">Assign rider…</option>
              {riders.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
            </select>
          )}
          {(isMine || role === "admin" || role === "manager") && r.status !== "requested" && (
            <>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
              <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}><Camera /> Add photos</Button>
              {isMine && <Button size="sm" variant={sharing ? "default" : "outline"} onClick={toggleLive}><Navigation /> {sharing ? "Stop live location" : "Share live location"}</Button>}
              {NEXT[r.status] && <Button size="sm" disabled={busy} onClick={advance}>{busy && <Loader2 className="animate-spin" />} Mark {RETURN_LABEL[NEXT[r.status]!]}</Button>}
            </>
          )}
          {role !== "rider" && <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => patch({ status: "cancelled" }, "Return closed")}>Close</Button>}
        </div>
      )}
    </article>
  );
}
