import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from "./env";
import type { JobRow, ParseRequest } from "@job-analyzer/shared";

export interface ParseResponse {
  job: JobRow;
  parseStatus: "ok" | "needs_review";
  parseError: string | null;
}

/** POST the captured text to the parse-job Edge Function under the user's JWT. */
export async function saveJob(accessToken: string, body: ParseRequest): Promise<ParseResponse> {
  const res = await fetch(`${FUNCTIONS_URL}/parse-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as Partial<ParseResponse> & {
    error?: string;
    details?: string;
  };

  if (!res.ok) {
    const detail = payload.details ? `: ${payload.details}` : "";
    throw new Error(payload.error ? `${payload.error}${detail}` : `Request failed (${res.status})`);
  }
  return payload as ParseResponse;
}
