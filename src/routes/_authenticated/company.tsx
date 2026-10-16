import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, ImageUp, Loader2, Printer, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Barcode } from "@/components/Barcode";
import { useMe } from "@/lib/auth";
import { pageHead } from "@/lib/seo";
import { getCompany, type Company } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/company")({
  head: () => pageHead("Company settings & branding", "Set your company name, logo, GSTIN and contact details printed on every label and bill."),
  component: CompanyPage,
});

const FIELDS: { k: keyof Company; label: string; ph?: string }[] = [
  { k: "name", label: "Company name", ph: "Bnoy Logistics" },
  { k: "tagline", label: "Tagline", ph: "Fast rural delivery" },
  { k: "phone", label: "Support phone", ph: "+91 98XXXXXXXX" },
  { k: "email", label: "Support email", ph: "support@yourcompany.in" },
  { k: "gstin", label: "GSTIN", ph: "08ABCDE1234F1Z5" },
  { k: "address", label: "Registered address", ph: "Main Bazaar, Gharsana, Rajasthan" },
  { k: "footer", label: "Bill footer note", ph: "Thank you for shipping with us." },
];

function CompanyPage() {
  const { role } = useMe();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["app_settings", "company"], queryFn: getCompany });
  const [c, setC] = useState<Company>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setC(q.data); }, [q.data]);

  if (role && role !== "admin") return <AppShell title="Company settings"><p className="text-sm text-muted-foreground">Only admins can change company branding.</p></AppShell>;

  function onLogo(f?: File) {
    if (!f) return undefined;
    if (!f.type.startsWith("image/")) { toast.error("Choose an image file"); return undefined; }
    if (f.size > 300_000) { toast.error("Logo must be under 300 KB"); return undefined; }
    const r = new FileReader();
    r.onload = () => setC((x) => ({ ...x, logo: String(r.result) }));
    r.readAsDataURL(f);
    return undefined;
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("app_settings").upsert({ key: "company", value: c as never, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Branding saved — new labels and bills will use it");
    qc.invalidateQueries({ queryKey: ["app_settings", "company"] });
  }

  return (
    <AppShell title="Company settings" actions={<Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Save</Button>}>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border bg-card p-6 shadow-card">
          <h2 className="flex items-center gap-2 font-bold"><Building2 className="size-4 text-primary" />Branding</h2>
          <div className="mt-5 flex items-center gap-4">
            <div className="grid size-20 place-items-center overflow-hidden rounded-xl border bg-muted">
              {c.logo ? <img src={c.logo} alt="Company logo" className="h-full w-full object-contain" /> : <ImageUp className="size-6 text-muted-foreground" />}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild><label className="cursor-pointer"><ImageUp />Upload logo<input type="file" accept="image/*" className="sr-only" onChange={(e) => onLogo(e.target.files?.[0])} /></label></Button>
              {c.logo && <Button variant="ghost" onClick={() => setC({ ...c, logo: "" })}><Trash2 />Remove</Button>}
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.k} className={`space-y-1.5 ${f.k === "address" || f.k === "footer" ? "sm:col-span-2" : ""}`}>
                <Label htmlFor={f.k}>{f.label}</Label>
                <Input id={f.k} placeholder={f.ph} value={c[f.k] ?? ""} onChange={(e) => setC({ ...c, [f.k]: e.target.value })} maxLength={200} />
              </div>
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border bg-card p-5 shadow-card">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Printer className="size-3.5" />Label preview</p>
          <div className="mt-3 rounded-lg border-2 border-foreground p-4">
            <div className="flex items-center justify-between border-b border-dashed border-foreground pb-2 text-xs font-extrabold tracking-widest">
              <span className="flex items-center gap-2">{c.logo && <img src={c.logo} alt="" className="h-5 w-auto" />}{(c.name || "Bnoy Logistics").toUpperCase()}</span><span>GHARSANA</span>
            </div>
            <div className="mt-3"><Barcode value="BNY12345678" height={70} /></div>
            <p className="mt-1 text-center font-mono font-bold">BNY12345678</p>
            <p className="mt-2 text-xs"><b>TO:</b> Priya Verma · 98XXXXXXXX<br />12, Ward 4, Main Bazaar</p>
            <p className="mt-2 text-[10px] text-muted-foreground">{[c.phone, c.gstin && `GSTIN ${c.gstin}`].filter(Boolean).join(" · ")}</p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
