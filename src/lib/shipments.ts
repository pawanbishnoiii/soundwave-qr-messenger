import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Shipment } from "./status";

/** Shipments visible to the user (RLS scoped), live-updated via realtime. */
export function useShipments() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("shipments-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments" }, () => {
        qc.invalidateQueries({ queryKey: ["shipments"] });
        qc.invalidateQueries({ queryKey: ["shipment"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return useQuery({
    queryKey: ["shipments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipments").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data as Shipment[];
    },
  });
}

/** Extract a tracking code from scanned text (raw code or a /track?code= URL). */
export function parseScanned(text: string) {
  const t = text.trim();
  try {
    const u = new URL(t);
    const c = u.searchParams.get("code");
    if (c) return c.toUpperCase();
  } catch { /* not a URL */ }
  return t.toUpperCase();
}

export function trackUrl(code: string) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/track?code=${encodeURIComponent(code)}`;
}
