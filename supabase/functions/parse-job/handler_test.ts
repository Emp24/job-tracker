import { assert, assertEquals } from "jsr:@std/assert@1";
import { createParseHandler, type AuthedContext, type ParseHandlerDeps } from "./handler.ts";
import type { JobExtraction, JobInsert } from "@job-analyzer/shared";

const SAMPLE_EXTRACTION: JobExtraction = {
  companyName: "Stripe",
  jobTitle: "Senior Engineer",
  relevantSkills: ["go", "postgresql"],
  yearsOfExperience: 3,
  mainField: "Tech",
  workArrangement: "Remote",
  country: "United States",
  city: "San Francisco",
};

const VALID_BODY = { rawText: "About the role: build payments...", sourceUrl: "https://ex.com/j/1" };

interface Opts {
  parse?: (rawText: string) => Promise<JobExtraction>;
  authed?: boolean;
  authThrows?: boolean;
  upsertThrows?: boolean;
}

/** Build injected deps plus a handle on whatever insert reached upsertJob. */
function build(opts: Opts = {}) {
  const captured: { insert?: JobInsert } = {};
  const deps: ParseHandlerDeps = {
    authenticate: async () => {
      if (opts.authThrows) throw new Error("infra down");
      if (opts.authed === false) return null;
      const ctx: AuthedContext = {
        userId: "user-1",
        upsertJob: async (insert) => {
          captured.insert = insert;
          if (opts.upsertThrows) throw new Error("db exploded");
          return {
            id: "job-1",
            created_at: "t",
            updated_at: "t",
            status: "Saved",
            ...insert,
          } as never;
        },
      };
      return ctx;
    },
    parseJob: opts.parse ?? (async () => SAMPLE_EXTRACTION),
  };
  return { handler: createParseHandler(deps), captured };
}

function post(body: unknown, headers: Record<string, string> = { Authorization: "Bearer t" }): Request {
  return new Request("http://localhost/parse-job", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

Deno.test("OPTIONS returns a CORS preflight", async () => {
  const { handler } = build();
  const res = await handler(
    new Request("http://localhost", { method: "OPTIONS", headers: { Origin: "chrome-extension://abc" } }),
  );
  assertEquals(res.status, 200);
  assert(res.headers.get("Access-Control-Allow-Origin"));
});

Deno.test("non-POST is rejected with 405", async () => {
  const { handler } = build();
  assertEquals((await handler(new Request("http://localhost", { method: "GET" }))).status, 405);
});

Deno.test("missing Authorization header → 401", async () => {
  const { handler } = build();
  const res = await handler(post(VALID_BODY, {}));
  assertEquals(res.status, 401);
});

Deno.test("invalid token (authenticate returns null) → 401", async () => {
  const { handler } = build({ authed: false });
  assertEquals((await handler(post(VALID_BODY))).status, 401);
});

Deno.test("auth infra failure (authenticate throws) → 502", async () => {
  const { handler } = build({ authThrows: true });
  assertEquals((await handler(post(VALID_BODY))).status, 502);
});

Deno.test("invalid body (bad URL) → 400", async () => {
  const { handler } = build();
  const res = await handler(post({ rawText: "hi", sourceUrl: "not-a-url" }));
  assertEquals(res.status, 400);
});

Deno.test("malformed JSON body → 400", async () => {
  const { handler } = build();
  const res = await handler(post("{ not json"));
  assertEquals(res.status, 400);
});

Deno.test("successful parse → persists an 'ok' row and echoes parseStatus", async () => {
  const { handler, captured } = build();
  const res = await handler(post(VALID_BODY));
  assertEquals(res.status, 200);

  const json = await res.json();
  assertEquals(json.parseStatus, "ok");
  assertEquals(json.parseError, null);

  // The persisted row is the mapped extraction, owned by the authed user.
  assertEquals(captured.insert?.parse_status, "ok");
  assertEquals(captured.insert?.user_id, "user-1");
  assertEquals(captured.insert?.company_name, "Stripe");
  assertEquals(captured.insert?.relevant_skills, ["go", "postgresql"]);
  assertEquals(captured.insert?.source_url, VALID_BODY.sourceUrl);
});

Deno.test("parse failure → persists a needs_review row (raw text retained), still 200", async () => {
  const { handler, captured } = build({
    parse: () => Promise.reject(new Error("gemini 500")),
  });
  const res = await handler(post(VALID_BODY));
  assertEquals(res.status, 200);

  const json = await res.json();
  assertEquals(json.parseStatus, "needs_review");
  assertEquals(json.parseError, "gemini 500");

  assertEquals(captured.insert?.parse_status, "needs_review");
  assertEquals(captured.insert?.user_id, "user-1");
  assertEquals(captured.insert?.raw_text, VALID_BODY.rawText);
});

Deno.test("database write failure → 500", async () => {
  const { handler } = build({ upsertThrows: true });
  assertEquals((await handler(post(VALID_BODY))).status, 500);
});
