import type { ReactNode } from "react";

export function Endpoint({ method, path, children }: { method: string; path: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <p className="font-mono text-sm"><span className="mr-2 rounded bg-primary px-2 py-0.5 font-bold text-primary-foreground">{method}</span>{path}</p>
      <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-md bg-navy p-4 font-mono text-xs leading-5 text-navy-foreground">{children}</pre>;
}

export function Fields({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto"><table className="w-full text-left text-xs">
      <thead><tr className="border-b"><th className="py-2 pr-3">Field</th><th className="py-2 pr-3">Type</th><th className="py-2">Notes</th></tr></thead>
      <tbody>{rows.map(([f, t, n]) => <tr key={f} className="border-b"><td className="py-2 pr-3 font-mono text-foreground">{f}</td><td className="py-2 pr-3">{t}</td><td className="py-2">{n}</td></tr>)}</tbody>
    </table></div>
  );
}
