import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Barcode } from "@/components/Barcode";
import { useShipments } from "@/lib/shipments";
import { STATUS_META, type ShipmentStatus } from "@/lib/status";
import { selectCls } from "@/lib/ui";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/manifest")({
  head: () => pageHead("Barcode manifest", "Printable barcode sheet for parcels by status and city"),
  component: ManifestPage,
});

function ManifestPage() {
  const { data: rows = [] } = useShipments();
  const [status, setStatus] = useState<string>("all");
  const [city, setCity] = useState<string>("all");
  const cities = useMemo(() => [...new Set(rows.map((r) => r.city))].sort(), [rows]);
  const list = rows.filter((r) => (status === "all" || r.status === status) && (city === "all" || r.city === city)).slice(0, 200);

  return (
    <AppShell title="Barcode manifest" actions={<Button size="sm" variant="hero" onClick={() => window.print()}><Printer /> <span className="hidden sm:inline">Print</span></Button>}>
      <div className="mb-4 flex flex-wrap gap-3 print:hidden">
        <select className={`${selectCls} w-44`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_META) as ShipmentStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <select className={`${selectCls} w-44`} value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
          <option value="all">All cities</option>
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
        <p className="self-center text-sm text-muted-foreground">{list.length} parcels{list.length === 200 ? " (first 200)" : ""}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">#</th><th className="p-3">Tracking</th><th className="p-3 min-w-48">Barcode</th><th className="p-3">Receiver</th><th className="p-3">City</th><th className="p-3">COD</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={r.id} className="border-t break-inside-avoid">
                <td className="p-3 tabular text-muted-foreground">{i + 1}</td>
                <td className="p-3 font-mono text-xs">{r.tracking_code}</td>
                <td className="p-3"><div className="w-48"><Barcode value={r.tracking_code} height={36} /></div></td>
                <td className="p-3">{r.receiver_name}</td>
                <td className="p-3">{r.city}</td>
                <td className="p-3 tabular">{r.cod_amount ? `₹${r.cod_amount}` : "Prepaid"}</td>
                <td className="p-3">{STATUS_META[r.status].label}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No parcels match.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
