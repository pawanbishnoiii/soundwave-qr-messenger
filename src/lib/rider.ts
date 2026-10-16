import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Shipment } from "./status";

export const RIDER_FEE = 15;

export function useWalletTxns() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rider_wallet_txns").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
}

export function useRatings() {
  return useQuery({
    queryKey: ["ratings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rider_ratings").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
}

const isToday = (d: string | null) => !!d && new Date(d).toDateString() === new Date().toDateString();

/** Per-rider performance from shipments, wallet and ratings visible to the viewer. */
export function riderStats(riderId: string, ships: Shipment[], txns: { rider_id: string; amount: number; created_at: string }[], ratings: { rider_id: string; rating: number }[]) {
  const mine = ships.filter((s) => s.rider_id === riderId);
  const closedToday = mine.filter((s) => isToday(s.updated_at) && ["delivered", "failed", "returned", "cancelled"].includes(s.status));
  const deliveredToday = closedToday.filter((s) => s.status === "delivered").length;
  const myTx = txns.filter((t) => t.rider_id === riderId);
  const myR = ratings.filter((r) => r.rider_id === riderId);
  return {
    total: mine.length,
    pending: mine.filter((s) => ["assigned", "picked_up", "in_transit", "out_for_delivery"].includes(s.status)).length,
    delivered: mine.filter((s) => s.status === "delivered").length,
    deliveredToday,
    accuracyToday: closedToday.length ? Math.round((deliveredToday / closedToday.length) * 100) : null,
    wallet: myTx.reduce((a, t) => a + Number(t.amount), 0),
    earnedToday: myTx.filter((t) => isToday(t.created_at)).reduce((a, t) => a + Number(t.amount), 0),
    rating: myR.length ? myR.reduce((a, r) => a + r.rating, 0) / myR.length : null,
    ratingCount: myR.length,
    codPending: mine.filter((s) => s.status === "delivered" && !s.cod_collected).reduce((a, s) => a + Number(s.cod_amount), 0),
  };
}
