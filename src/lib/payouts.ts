import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePayoutSettings() {
  return useQuery({
    queryKey: ["payout-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payout_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useBonuses() {
  return useQuery({
    queryKey: ["payout-bonuses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payout_bonuses").select("*").order("starts_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function activeBonusTotal(bonuses: { active: boolean; starts_on: string; ends_on: string; rider_bonus: number }[]) {
  const today = new Date().toISOString().slice(0, 10);
  return bonuses.filter((b) => b.active && b.starts_on <= today && b.ends_on >= today).reduce((a, b) => a + Number(b.rider_bonus), 0);
}
