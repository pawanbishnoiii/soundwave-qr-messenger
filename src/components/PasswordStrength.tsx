import { Check, X } from "lucide-react";
import { passwordChecks, passwordScore } from "@/lib/public-settings";

const LEVELS = [
  { label: "Too weak", bar: "bg-destructive" },
  { label: "Too weak", bar: "bg-destructive" },
  { label: "Weak", bar: "bg-destructive" },
  { label: "Fair", bar: "bg-warning" },
  { label: "Good", bar: "bg-warning" },
  { label: "Strong", bar: "bg-success" },
];

export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const score = passwordScore(value);
  const lvl = LEVELS[score]!;
  return (
    <div className="space-y-2 rounded-lg border bg-muted/40 p-3" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">{[1, 2, 3, 4, 5].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= score ? lvl.bar : "bg-border"}`} />)}</div>
        <span className="text-xs font-semibold">{lvl.label}</span>
      </div>
      <ul className="grid gap-1 text-xs">
        {passwordChecks(value).map((c) => (
          <li key={c.label} className={`flex items-center gap-1.5 ${c.ok ? "text-success" : "text-muted-foreground"}`}>
            {c.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}{c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
