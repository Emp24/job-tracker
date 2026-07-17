import { createClient } from "@supabase/supabase-js";
import type { JobRow } from "@job-analyzer/shared";
import { parseJobText } from "../_shared/gemini.ts";
import { createParseHandler } from "./handler.ts";

// Injected automatically by the Supabase platform (local serve + deployed).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(
  createParseHandler({
    parseJob: parseJobText,
    authenticate: async (authHeader) => {
      // Scope the client to the USER's JWT (not service_role) so RLS enforces
      // user_id = auth.uid() on the upsert — the multi-tenant guarantee.
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) return null;

      return {
        userId: data.user.id,
        upsertJob: async (insert) => {
          const { data, error } = await supabase
            .from("jobs")
            .upsert(insert, { onConflict: "user_id,source_url" })
            .select()
            .single();
          if (error) throw new Error(error.message);
          return data as JobRow;
        },
      };
    },
  }),
);
