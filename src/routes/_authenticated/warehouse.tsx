import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Box, Camera, Lock, PackagePlus, Plus, Printer, ScanLine, Send, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Barcode } from "@/components/Barcode";
import { QrScanner } from "@/components/QrScanner";
import { Pill } from "@/components/CrudPage";
import { useMe } from "@/lib/auth";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/warehouse")({
  head: () => pageHead("Warehouse sorting & packing", "Scan products into stock, pack them into bags or boxes and print dispatch bills."),
  component: Warehouse,
});

type Bag = { id: string; code: string; kind: string; destination: string | null; pincode: string | null; status: string; created_at: string };
type Item = { id: string; bag_id: string; qty: number; product_id: string | null; shipment_id: string | null; wh_products: { name: string; sku: string } | null; shipments: { tracking_code: string; receiver_name: string; city: string } | null };

function Warehouse() {
  const { role, user } = useMe();
  const qc = useQueryClient();
  const [scan, setScan] = useState("");
  const [camera, setCamera] = useState(false);
  const [name, setName] = useState("");
  const [bagId, setBagId] = useState<string | null>(null);
  const [dest, setDest] = useState(""); const [pin, setPin] = useState(""); const [kind, setKind] = useState<"bag" | "box">("bag");

  const q = useQuery({ queryKey: ["warehouse"], enabled: !!user, queryFn: async () => {
    const [p, b, i] = await Promise.all([
      supabase.from("wh_products").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("wh_bags").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("wh_bag_items").select("*, wh_products(name,sku), shipments(tracking_code,receiver_name,city)").limit(1000),
    ]);
    return { products: p.data ?? [], bags: (b.data ?? []) as Bag[], items: (i.data ?? []) as unknown as Item[] };
  } });
  const refresh = () => qc.invalidateQueries({ queryKey: ["warehouse"] });
  if (role && role !== "admin" && role !== "warehouse") return <AppShell title="Warehouse"><p className="text-sm text-muted-foreground">Only warehouse staff and admins can open this page.</p></AppShell>;

  const bag = q.data?.bags.find((b) => b.id === bagId) ?? null;

  async function handleCode(raw: string) {
    const code = raw.trim(); if (!code) return;
    setScan("");
    if (bag) {
      if (bag.status !== "open") { toast.error("This bag is sealed"); return; }
      const { data: s } = await supabase.from("shipments").select("id,tracking_code").eq("tracking_code", code.toUpperCase()).maybeSingle();
      const prod = s ? null : q.data?.products.find((p) => p.sku === code);
      if (!s && !prod) { toast.error(`No parcel or product with code ${code}`); return; }
      const { error } = await supabase.from("wh_bag_items").insert({ bag_id: bag.id, shipment_id: s?.id ?? null, product_id: prod?.id ?? null, qty: 1 });
      if (error) { toast.error(error.message); return; }
      toast.success(`${s ? s.tracking_code : prod!.name} added to ${bag.code}`); refresh(); return;
    }
    const existing = q.data?.products.find((p) => p.sku === code);
    if (existing) {
      const { error } = await supabase.from("wh_products").update({ quantity: existing.quantity + 1 }).eq("id", existing.id);
      error ? toast.error(error.message) : toast.success(`${existing.name}: ${existing.quantity + 1} in stock`);
    } else {
      const { error } = await supabase.from("wh_products").insert({ sku: code, name: name.trim() || `Product ${code}`, quantity: 1, created_by: user!.id });
      error ? toast.error(error.message) : toast.success(`New product ${code} added`); setName("");
    }
    refresh();
  }
  async function createBag() {
    const code = `${kind === "bag" ? "BAG" : "BOX"}-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase.from("wh_bags").insert({ code, kind, destination: dest || null, pincode: pin || null, status: "open", created_by: user!.id }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success(`${code} created — scan items into it`); setBagId(data.id); setDest(""); setPin(""); refresh();
  }
  async function setStatus(b: Bag, status: "sealed" | "dispatched") {
    const patch = status === "sealed" ? { status, sealed_at: new Date().toISOString() } : { status, dispatched_at: new Date().toISOString() };
    const { error } = await supabase.from("wh_bags").update(patch).eq("id", b.id);
    error ? toast.error(error.message) : toast.success(`${b.code} ${status}`); refresh();
  }
  const itemsOf = (id: string) => q.data?.items.filter((i) => i.bag_id === id) ?? [];

  return <AppShell title="Warehouse">
    <div className="space-y-6 print:hidden">
      <section className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><ScanLine className="size-5 text-primary" />{bag ? `Scanning into ${bag.code}` : "Scan product into stock"}</h2>
          {bag && <Button variant="ghost" size="sm" onClick={() => setBagId(null)}>Back to stock scanning</Button>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{bag ? "Scan a parcel tracking barcode or product SKU to put it in this bag." : "Scan a product barcode/QR. A new code creates the product; a known code adds one more to stock."}</p>
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void handleCode(scan); }}>
          <Input autoFocus aria-label="Barcode" placeholder="Scan or type barcode" value={scan} onChange={(e) => setScan(e.target.value)} className="h-11 max-w-xs font-mono" />
          {!bag && <Input aria-label="Product name" placeholder="Product name (for new items)" value={name} onChange={(e) => setName(e.target.value)} className="h-11 max-w-xs" />}
          <Button type="submit" className="h-11"><Plus />Add</Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => setCamera((c) => !c)}><Camera />{camera ? "Close camera" : "Camera"}</Button>
        </form>
        {camera && <div className="mt-4 max-w-sm overflow-hidden rounded-xl"><QrScanner onScan={(c) => { setCamera(false); void handleCode(c); }} /></div>}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-2"><h2 className="flex items-center gap-2 font-display text-lg font-semibold"><PackagePlus className="size-5 text-primary" />Stock ({q.data?.products.length ?? 0})</h2>
          <div className="max-h-[480px] divide-y overflow-auto rounded-xl border bg-card">
            {q.isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="m-3 h-10" />)}
            {q.data?.products.map((p) => <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm"><span><span className="font-medium">{p.name}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{p.sku}</span></span><span className="font-semibold">× {p.quantity}</span></div>)}
            {q.data && !q.data.products.length && <p className="p-6 text-center text-sm text-muted-foreground">Scan your first product.</p>}
          </div></section>

        <section className="space-y-3"><h2 className="flex items-center gap-2 font-display text-lg font-semibold"><ShoppingBag className="size-5 text-primary" />Bags & boxes</h2>
          <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3">
            <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value as "bag" | "box")} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="bag">Bag</option><option value="box">Box</option></select>
            <Input className="h-9 w-40" placeholder="Destination" value={dest} onChange={(e) => setDest(e.target.value)} />
            <Input className="h-9 w-28" placeholder="Pincode" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            <Button size="sm" className="h-9" onClick={createBag}><Box />New</Button>
          </div>
          {q.data?.bags.map((b) => { const items = itemsOf(b.id); return (
            <div key={b.id} className={`rounded-xl border bg-card p-4 ${bagId === b.id ? "ring-2 ring-primary" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-mono font-semibold">{b.code}</p><p className="text-xs text-muted-foreground">{b.kind} · {b.destination ?? "—"} {b.pincode ?? ""} · {items.length} items</p></div>
                <div className="flex flex-wrap items-center gap-2"><Pill tone={b.status === "dispatched" ? "ok" : b.status === "sealed" ? "warn" : "muted"}>{b.status}</Pill>
                  {b.status === "open" && <><Button size="sm" variant="outline" onClick={() => setBagId(b.id)}><ScanLine />Scan in</Button><Button size="sm" variant="outline" onClick={() => setStatus(b, "sealed")}><Lock />Seal</Button></>}
                  {b.status === "sealed" && <Button size="sm" onClick={() => setStatus(b, "dispatched")}><Send />Dispatch</Button>}
                  <Button size="sm" variant="ghost" onClick={() => { setBagId(b.id); setTimeout(() => window.print(), 50); }}><Printer />Bill</Button></div>
              </div>
              {!!items.length && <ul className="mt-2 flex flex-wrap gap-1.5">{items.map((i) => <li key={i.id} className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">{i.shipments?.tracking_code ?? i.wh_products?.sku}</li>)}</ul>}
            </div>); })}
        </section>
      </div>
    </div>

    {bag && <div className="hidden print:block">
      <h1 className="text-2xl font-bold">Dispatch bill — {bag.kind.toUpperCase()} {bag.code}</h1>
      <p>Destination: {bag.destination ?? "—"} {bag.pincode ?? ""} · Status: {bag.status} · {new Date().toLocaleString("en-IN")}</p>
      <div className="my-3"><Barcode value={bag.code} /></div>
      <table className="w-full border text-sm"><thead><tr><th className="border p-1 text-left">#</th><th className="border p-1 text-left">Code</th><th className="border p-1 text-left">Description</th><th className="border p-1">Qty</th></tr></thead>
        <tbody>{itemsOf(bag.id).map((i, n) => <tr key={i.id}><td className="border p-1">{n + 1}</td><td className="border p-1 font-mono">{i.shipments?.tracking_code ?? i.wh_products?.sku}</td><td className="border p-1">{i.shipments ? `${i.shipments.receiver_name}, ${i.shipments.city}` : i.wh_products?.name}</td><td className="border p-1 text-center">{i.qty}</td></tr>)}</tbody></table>
      <p className="mt-8">Packed by: ____________ &nbsp;&nbsp; Received by: ____________</p>
    </div>}
  </AppShell>;
}
