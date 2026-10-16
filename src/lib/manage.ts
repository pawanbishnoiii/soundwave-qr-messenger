import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export const opts = (...v: string[]) => v.map((x) => ({ value: x, label: x.replace(/_/g, " ") }));
export function useHubOptions() {
  return useQuery({ queryKey: ["hub-options"], queryFn: async () => ((await supabase.from("hubs").select("id,name").order("name")).data ?? []).map((h) => ({ value: h.id, label: h.name })) }).data ?? [];
}
export function useRiderOptions() {
  return useQuery({ queryKey: ["rider-options"], queryFn: async () => {
    const { data: r } = await supabase.from("user_roles").select("user_id").eq("role", "rider");
    const ids = (r ?? []).map((x) => x.user_id);
    if (!ids.length) return [];
    const { data } = await supabase.from("profiles").select("id,full_name").in("id", ids);
    return (data ?? []).map((p) => ({ value: p.id, label: p.full_name }));
  } }).data ?? [];
}
