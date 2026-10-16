import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export const Route = createFileRoute("/api/public/track/$code")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ params }) => {
        const code = String(params.code ?? "").trim();
        if (!/^[A-Za-z0-9-]{4,40}$/.test(code)) return Response.json({ error: "Invalid tracking code or order ID" }, { status: 400, headers: cors });
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data, error } = await sb.rpc("track_shipment", { _code: code });
        if (error) return Response.json({ error: "Lookup failed" }, { status: 500, headers: cors });
        if (!data) return Response.json({ error: "Not found" }, { status: 404, headers: cors });
        return Response.json(data, { headers: { ...cors, "Cache-Control": "no-store" } });
      },
    },
  },
});
