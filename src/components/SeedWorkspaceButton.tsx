import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { seedDemoWorkspace } from "@/lib/demo.functions";

export function SeedWorkspaceButton() {
  const seed = useServerFn(seedDemoWorkspace);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await seed();
          toast.success("Demo workspace ready");
          qc.invalidateQueries();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not seed demo data");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
      <span className="hidden sm:inline">Seed demo workspace</span>
    </Button>
  );
}
