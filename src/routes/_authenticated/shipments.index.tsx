import { pageHead } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, Loader2, Package, Sparkles, Printer } from "lucide-react";
import { SeedDialog } from "@/components/SeedDialog";
import { printLabels, printLabelSheet, SHEET_LAYOUTS } from "@/lib/labels";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMe, useTeam } from "@/lib/auth";
import { useShipments } from "@/lib/shipments";
import { selectCls } from "@/lib/ui";
import { STATUS_META, fmtDate, inr, type ShipmentStatus } from "@/lib/status";

const CITIES = ["Gharsana", "Anupgarh", "Suratgarh", "Raisinghnagar", "Sri Ganganagar"];

export const Route = createFileRoute("/_authenticated/shipments/")({
  validateSearch: z.object({ new: z.boolean().optional() }),
  head: () => pageHead("Shipments", "All shipments"),
  component: Shipments,
});

const shipmentSchema = z.object({
  sender_name: z.string().trim().min(2).max(100),
  sender_phone: z.string().trim().max(15),
  receiver_name: z.string().trim().min(2).max(100),
  receiver_phone: z.string().trim().regex(/^[0-9+\- ]{7,15}$/, "Enter a valid phone"),
  receiver_address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(60),
  pincode: z.string().trim().max(10),
  weight_kg: z.coerce.number().min(0.01).max(1000),
  cod_amount: z.coerce.number().min(0).max(10000000),
  notes: z.string().trim().max(500),
  rider_id: z.string(),
});

function Shipments() {
  const { role } = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/shipments/" });
  const { data: rows = [], isLoading } = useShipments();
  const { data: team = [] } = useTeam();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ShipmentStatus | "all">("all");
  const [seed, setSeed] = useState(false);
  const names = useMemo(() => new Map(team.map((t) => [t.id, t.full_name])), [team]);

  const filtered = rows.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [s.tracking_code, s.id, s.external_order_id, s.partner_awb, s.receiver_name, s.receiver_phone, s.city].some((v) => v?.toLowerCase().includes(t));
  });

  const canCreate = role && role !== "rider";

  return (
    <AppShell
      title="Shipments"
      actions={canCreate && (
        <>
          <Button variant="outline" size="sm" onClick={() => setSeed(true)}><Sparkles /> <span className="hidden sm:inline">Demo orders</span></Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" disabled={!filtered.length} onClick={() => printLabels(filtered.slice(0, 200)).catch((e) => toast.error(e.message))}><Printer /> Labels</Button>
          <select aria-label="Print barcode sheet" className="hidden h-9 rounded-md border bg-background px-2 text-sm sm:block" value="" disabled={!filtered.length}
            onChange={(e) => { const l = SHEET_LAYOUTS[Number(e.target.value)]; if (l) { try { printLabelSheet(filtered.slice(0, 500), l); } catch (err) { toast.error((err as Error).message); } } }}>
            <option value="">A4 sheet…</option>
            {SHEET_LAYOUTS.map((l, i) => <option key={l.name} value={i}>{l.name}</option>)}
          </select>
          <Button variant="hero" size="sm" onClick={() => navigate({ search: { new: true } })}><Plus /> <span className="hidden sm:inline">New</span></Button>
        </>
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search tracking, order ID, AWB, name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={`${selectCls} sm:w-48`} value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus | "all")}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border bg-card shadow-card">
        {isLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">No shipments found</p>
            {canCreate && <Button className="mt-4" variant="hero" onClick={() => navigate({ search: { new: true } })}><Plus /> Create first shipment</Button>}
          </div>
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-3">Tracking</th><th className="px-4 py-3">Receiver</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Rider</th><th className="px-4 py-3 text-right">COD</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th></tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => (
                  <tr key={s.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate({ to: "/shipments/$id", params: { id: s.id } })}>
                    <td className="px-4 py-3 font-mono font-semibold">{s.tracking_code}{s.is_demo && <span className="ml-2 rounded bg-warning/30 px-1.5 py-0.5 font-sans text-[10px]">DEMO</span>}</td>
                    <td className="px-4 py-3">{s.receiver_name}<div className="text-xs text-muted-foreground">{s.receiver_phone}</div></td>
                    <td className="px-4 py-3">{s.city}</td>
                    <td className="px-4 py-3">{s.rider_id ? names.get(s.rider_id) ?? "—" : <span className="text-muted-foreground">Unassigned</span>}</td>
                    <td className="px-4 py-3 text-right tabular">{inr(Number(s.cod_amount))}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y md:hidden">
              {filtered.map((s) => (
                <li key={s.id}>
                  <Link to="/shipments/$id" params={{ id: s.id }} className="block p-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <p className="truncate font-mono text-sm font-semibold">{s.tracking_code}</p>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="mt-1 truncate text-sm">{s.receiver_name} · {s.city}</p>
                    <p className="text-xs text-muted-foreground tabular">COD {inr(Number(s.cod_amount))} · {s.rider_id ? names.get(s.rider_id) ?? "Rider" : "Unassigned"}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {canCreate && <SeedDialog lotId={null} open={seed} onClose={() => setSeed(false)} />}
      {canCreate && (
        <CreateDialog
          open={!!search.new}
          onClose={() => navigate({ search: {} })}
          riders={team.filter((t) => t.role === "rider")}
          onCreated={(id) => navigate({ to: "/shipments/$id", params: { id } })}
        />
      )}
    </AppShell>
  );
}

function CreateDialog({ open, onClose, riders, onCreated }: {
  open: boolean; onClose: () => void; riders: { id: string; full_name: string }[]; onCreated: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = shipmentSchema.safeParse(fd);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    setBusy(true);
    const { rider_id, ...rest } = parsed.data;
    const { data, error } = await supabase.from("shipments").insert({ ...rest, rider_id: rider_id || null }).select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Shipment created — QR label ready");
    onCreated(data.id);
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>New shipment</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <F label="Sender name" name="sender_name" required />
          <F label="Sender phone" name="sender_phone" />
          <F label="Receiver name" name="receiver_name" required />
          <F label="Receiver phone" name="receiver_phone" required />
          <div className="space-y-1.5 sm:col-span-2"><Label>Delivery address</Label><Textarea name="receiver_address" required rows={2} /></div>
          <div className="space-y-1.5">
            <Label>City / branch</Label>
            <Input name="city" list="cities" required />
            <datalist id="cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <F label="Pincode" name="pincode" />
          <F label="Weight (kg)" name="weight_kg" type="number" step="0.01" defaultValue="0.5" />
          <F label="COD amount (₹)" name="cod_amount" type="number" step="1" defaultValue="0" />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Assign rider (optional)</Label>
            <select name="rider_id" className={selectCls} defaultValue="">
              <option value="">Assign later</option>
              {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Textarea name="notes" rows={2} /></div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create & generate QR</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, ...p }: { label: string } & React.ComponentProps<typeof Input>) {
  return <div className="space-y-1.5"><Label htmlFor={p.name}>{label}</Label><Input id={p.name} {...p} /></div>;
}
