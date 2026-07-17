import {
  ParseRequestSchema,
  extractionToDbInsert,
  needsReviewInsert,
  type JobExtraction,
  type JobInsert,
  type JobRow,
} from "@job-analyzer/shared";
import { corsHeaders } from "../_shared/cors.ts";

/** Per-request, user-scoped capabilities produced after authentication. */
export interface AuthedContext {
  userId: string;
  /** Upsert on (user_id, source_url) under the user's identity (RLS applies). */
  upsertJob: (insert: JobInsert) => Promise<JobRow>;
}

/**
 * IO the handler depends on, injected so the request/branch logic can be tested
 * without Gemini, Supabase, or the network. The production wiring lives in
 * index.ts; tests pass fakes.
 */
export interface ParseHandlerDeps {
  /** Resolve the caller from their JWT. Returns null for an invalid token; throws on infra failure. */
  authenticate: (authHeader: string) => Promise<AuthedContext | null>;
  /** Parse raw job text into a validated extraction; throws on any failure. */
  parseJob: (rawText: string) => Promise<JobExtraction>;
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export function createParseHandler(deps: ParseHandlerDeps) {
  return async function handle(req: Request): Promise<Response> {
    const cors = corsHeaders(req.headers.get("Origin"));

    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing Authorization header" }, cors);

    let ctx: AuthedContext | null;
    try {
      ctx = await deps.authenticate(authHeader);
    } catch (e) {
      console.error("parse-job: auth lookup threw:", e);
      return json(502, { error: "Auth lookup failed", details: errMsg(e) }, cors);
    }
    if (!ctx) return json(401, { error: "Invalid or expired token" }, cors);

    let payload;
    try {
      payload = ParseRequestSchema.parse(await req.json());
    } catch (e) {
      return json(400, { error: "Invalid request body", details: errMsg(e) }, cors);
    }

    // Parse with Gemini. On ANY failure, fall back to a needs_review row so the
    // scrape is never lost.
    let insert: JobInsert;
    let parseError: string | null = null;
    try {
      const extraction = await deps.parseJob(payload.rawText);
      insert = extractionToDbInsert(extraction, {
        userId: ctx.userId,
        sourceUrl: payload.sourceUrl,
        rawText: payload.rawText,
        parseStatus: "ok",
      });
    } catch (e) {
      parseError = errMsg(e);
      console.error("parse-job: parse failed, routing to needs_review:", parseError);
      insert = needsReviewInsert({
        userId: ctx.userId,
        sourceUrl: payload.sourceUrl,
        rawText: payload.rawText,
      });
    }

    let job: JobRow;
    try {
      job = await ctx.upsertJob(insert);
    } catch (e) {
      console.error("parse-job: db upsert failed:", errMsg(e));
      return json(500, { error: "Database write failed", details: errMsg(e) }, cors);
    }

    return json(200, { job, parseStatus: insert.parse_status, parseError }, cors);
  };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
