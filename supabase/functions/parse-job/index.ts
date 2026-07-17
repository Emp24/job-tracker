import { createClient } from "@supabase/supabase-js";
import {
  ParseRequestSchema,
  extractionToDbInsert,
  needsReviewInsert,
  type JobInsert,
} from "@job-analyzer/shared";
import { corsHeaders } from "../_shared/cors.ts";
import { parseJobText } from "../_shared/gemini.ts";

// Injected automatically by the Supabase platform (local serve + deployed).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Missing Authorization header" }, cors);

  // Scope the client to the USER's JWT (not service_role) so RLS enforces
  // user_id = auth.uid() on the upsert. This is the multi-tenant guarantee.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string;
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return json(401, { error: "Invalid or expired token", details: userErr?.message ?? null }, cors);
    }
    userId = userData.user.id;
  } catch (e) {
    console.error("parse-job: getUser threw:", e);
    return json(502, {
      error: "Auth lookup failed",
      details: e instanceof Error ? e.message : String(e),
    }, cors);
  }

  let payload;
  try {
    payload = ParseRequestSchema.parse(await req.json());
  } catch (e) {
    return json(400, {
      error: "Invalid request body",
      details: e instanceof Error ? e.message : String(e),
    }, cors);
  }

  // Parse with Gemini. On any failure, fall back to a needs_review row so the
  // scrape is never lost (Phase 3 will let users retry/fix it).
  let insert: JobInsert;
  let parseError: string | null = null;
  try {
    const extraction = await parseJobText(payload.rawText);
    insert = extractionToDbInsert(extraction, {
      userId,
      sourceUrl: payload.sourceUrl,
      rawText: payload.rawText,
      parseStatus: "ok",
    });
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
    console.error("parse-job: parse failed, routing to needs_review:", parseError);
    insert = needsReviewInsert({
      userId,
      sourceUrl: payload.sourceUrl,
      rawText: payload.rawText,
    });
  }

  // Upsert on (user_id, source_url): re-saving a known URL refreshes the parsed
  // fields but preserves the user's kanban `status` (omitted from the payload).
  const { data, error } = await supabase
    .from("jobs")
    .upsert(insert, { onConflict: "user_id,source_url" })
    .select()
    .single();

  if (error) {
    console.error("parse-job: db upsert failed:", error.message);
    return json(500, { error: "Database write failed", details: error.message }, cors);
  }

  return json(200, { job: data, parseStatus: insert.parse_status, parseError }, cors);
});
