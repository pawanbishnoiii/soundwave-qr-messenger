import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Reveal } from "@/components/motion";

export type Field = {
  key: string; label: string;
  type?: "text" | "number" | "date" | "time" | "select" | "tags";
  options?: { value: string; label: string }[];
  required?: boolean; placeholder?: string; hideInTable?: boolean;
  render?: (row: Row) => ReactNode;
};
type Row = Record<string, unknown> & { id: string };

/** Generic list + create/edit form backed directly by a table; RLS decides who may write. */
export function CrudTable({ table, fields, canEdit, select = "*", order = "created_at", searchKeys, empty }: {
  table: string; fields: Field[]; canEdit: boolean; select?: string; order?: string; searchKeys: string[]; empty: ReactNode;
}) {
  const qc = useQueryClient();
  const db = supabase as unknown as { from: (t: string) => any };
  const q = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await db.from(table).select(select).order(order, { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const [term, setTerm] = useState("");
  const [edit, setEdit] = useState<Partial<Row> | null>(null);
  const rows = useMemo(() => (q.data ?? []).filter((r) => !term || searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(term.toLowerCase()))), [q.data, term, searchKeys]);

  const save = useMutation({
    mutationFn: async (row: Partial<Row>) => {
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        let v = row[f.key];
        if (v === "" || v === undefined) v = null;
        if (f.type === "number" && v !== null) v = Number(v);
        if (f.type === "tags") v = typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : (v ?? []);
        payload[f.key] = v;
      }
      const res = row.id ? await db.from(table).update(payload).eq("id", row.id) : await db.from(table).insert(payload);
      if (res.error) throw res.error;
    },
    onSuccess: () => { toast.success("Saved"); setEdit(null); qc.invalidateQueries({ queryKey: [table] }); },
    onError: (e: Error) => toast.error(e.message.includes("row-level") ? "You don't have permission for this change" : e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from(table).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: [table] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cols = fields.filter((f) => !f.hideInTable);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search" placeholder="Search…" value={term} onChange={(e) => setTerm(e.target.value)} className="pl-9" />
        </div>
        {canEdit && <Button onClick={() => setEdit({})}><Plus /> Add</Button>}
      </div>

      {q.isLoading && <div className="h-40 animate-pulse rounded-xl bg-muted" />}
      {q.error && <div role="alert" className="rounded-xl border bg-card p-6"><p className="font-semibold">Couldn't load this list.</p><Button variant="outline" className="mt-3" onClick={() => q.refetch()}>Retry</Button></div>}
      {q.data && !rows.length && <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">{empty}</div>}
      {!!rows.length && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{cols.map((c) => <th key={c.key} scope="col" className="px-4 py-3 font-semibold">{c.label}</th>)}{canEdit && <th className="px-4 py-3"><span className="sr-only">Actions</span></th>}</tr>
            </thead>
            <Reveal as="tbody" stagger={0.025} y={8}>
              {rows.map((r) => (
                <tr key={r.id} data-reveal className="border-t transition-colors hover:bg-muted/40">
                  {cols.map((c) => <td key={c.key} className="whitespace-nowrap px-4 py-3">{c.render ? c.render(r) : fmt(r[c.key], c)}</td>)}
                  {canEdit && (
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ ...r, ...Object.fromEntries(fields.filter((f) => f.type === "tags").map((f) => [f.key, ((r[f.key] as string[]) ?? []).join(", ")])) })}><Pencil /></Button>
                      <Button size="icon" variant="ghost" aria-label="Delete" className="text-destructive" onClick={() => confirm("Delete this record?") && del.mutate(r.id)}><Trash2 /></Button>
                    </td>
                  )}
                </tr>
              ))}
            </Reveal>
          </table>
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit" : "Add new"}</DialogTitle></DialogHeader>
          {edit && (
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(edit); }}>
              {fields.map((f) => (
                <div key={f.key} className={f.type === "tags" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                  <Label htmlFor={`f-${f.key}`}>{f.label}{f.required && " *"}</Label>
                  {f.type === "select" ? (
                    <select id={`f-${f.key}`} required={f.required} value={String(edit[f.key] ?? "")} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                      {!f.required && <option value="">—</option>}
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <Input id={`f-${f.key}`} type={f.type === "tags" ? "text" : f.type ?? "text"} step="any" required={f.required} placeholder={f.placeholder}
                      value={String(edit[f.key] ?? "")} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
                  )}
                </div>
              ))}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
                <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin" />} Save</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fmt(v: unknown, f: Field) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
  if (Array.isArray(v)) return v.join(", ");
  if (f.type === "select") return f.options?.find((o) => o.value === v)?.label ?? String(v);
  return String(v);
}

export const Pill = ({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: ReactNode }) => (
  <span className={{ ok: "bg-success/15 text-success", warn: "bg-warning/25 text-foreground", bad: "bg-destructive/15 text-destructive", muted: "bg-muted text-muted-foreground" }[tone] + " rounded-full px-2 py-0.5 text-xs font-semibold"}>{children}</span>
);
