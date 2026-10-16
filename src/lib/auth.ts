import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Profile } from "./status";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, loading };
}

export function useMe() {
  const { user, loading } = useUser();
  const q = useQuery({
    queryKey: ["me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { profile: null, role: null };
      const [{ data: profile }, { data: role }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.rpc("get_user_role", { _user_id: user.id }),
      ]);
      return { profile: profile as Profile | null, role: (role ?? null) as AppRole | null };
    },
  });
  return {
    user,
    profile: q.data?.profile ?? null,
    role: q.data?.role ?? null,
    loading: loading || (!!user && q.isLoading),
  };
}

/** All team members visible to the current user (RLS scopes it to their subtree). */
export function useTeam() {
  return useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      const roleMap = new Map<string, AppRole>();
      for (const r of roles ?? []) roleMap.set(r.user_id, r.role);
      return (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null }));
    },
  });
}
export type TeamMember = Profile & { role: AppRole | null };
