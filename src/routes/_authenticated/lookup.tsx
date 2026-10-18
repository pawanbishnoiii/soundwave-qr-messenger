import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useMe } from "@/lib/auth";
import { pageHead } from "@/lib/seo";
import { inr, type ShipmentStatus } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/lookup")({
  head: () => pageHead("Parcel search", "Find parcels by barcode, tracking number or customer phone and see counts by location."),
  component: Lookup,
});

type Row = { id: string; tracking_code: string; status: ShipmentStatus; receiver_name: string; receiver_phone: string; city: string; pincode: string | null; cod_amount: number };

function Lookup() {
  const { role } = useMe();
  const [q, setQ] = useState("");
  const term = q.trim();
  const res = useQuery({
    queryKey: ["lookup", term], enabled: role === "admin",
    queryFn: async () => {
      let req = supabase.from("shipments").select("id,tracking_code,status,receiver_name,receiver_phone,city,pincode,cod_amount").order("created_at", { ascending: false }).limit(500);
      const digits = term.replace(/\D/g, "");
      if (term) {
        const safe = term.replace(/[,()%]/g, "");
        req = digits.length >= 6 && digits === term ? req.or(`receiver_phone.ilike.%${digits}%,pincode.eq.${digits}`) : req.or(`tracking_code.ilike.%${safe}%,external_order_id.ilike.%${safe}%,partner_awb.ilike.%${safe}%`);
      }
      return ((await req).data ?? []) as Row[];
    },
  });
  const byCity = useMemo(() => {
    const m = new Map<string, { n: number; open: number }>();
    for (const r of res.data ?? []) { const k = r.city || "Unknown"; const v = m.get(k) ?? { n: 0, open: 0 }; v.n++; if (!["delivered", "cancelled", "returned"].includes(r.status)) v.open++; m.set(k, v); }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [res.data]);

  if (role && role !== "admin") return <AppShell title="Parcel search"><p className="text-sm text-muted-foreground">Admins only.</p></AppShell>;
  return <AppShell title="Parcel search">
    <div className="space-y-6">
      <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus aria-label="Search parcels" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Scan barcode, tracking number, order ID or customer phone" className="h-12 pl-9 font-mono" /></div>
      <section><h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold"><MapPin className="size-4 text-primary" />Parcels by location</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {res.isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          {byCity.map(([c, v]) => <button key={c} onClick={() => setQ("")} className="rounded-2xl border bg-card p-4 text-left shadow-card"><p className="truncate text-sm font-semibold">{c}</p><p className="font-display text-2xl font-bold">{v.n}</p><p className="text-xs text-muted-foreground">{v.open} still moving</p></button>)}
        </div></section>
      <section><h2 className="mb-2 font-display text-lg font-semibold">{res.data?.length ?? 0} parcels{term ? ` for “${term}”` : ""}</h2>
        <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2">Tracking</th><th className="px-4 py-2">Customer</th><th className="px-4 py-2">Location</th><th className="px-4 py-2">COD</th><th className="px-4 py-2">Status</th></tr></thead>
          <tbody>{res.data?.map((r) => <tr key={r.id} className="border-t"><td className="px-4 py-2 font-mono"><Link to="/shipments/$id" params={{ id: r.id }} className="text-primary">{r.tracking_code}</Link></td><td className="px-4 py-2">{r.receiver_name}<span className="block text-xs text-muted-foreground">{r.receiver_phone}</span></td><td className="px-4 py-2">{r.city} {r.pincode}</td><td className="px-4 py-2">{Number(r.cod_amount) > 0 ? inr(Number(r.cod_amount)) : "Prepaid"}</td><td className="px-4 py-2"><StatusBadge status={r.status} /></td></tr>)}
            {res.data && !res.data.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No parcels match.</td></tr>}</tbody></table></div></section>
    </div>
  </AppShell>;
}
