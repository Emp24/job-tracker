// CORS for the browser extension + web app. Requests carry a Bearer JWT (not
// cookies), so we don't need Allow-Credentials. Set ALLOWED_ORIGINS (comma-
// separated) as a function secret in production, e.g.:
//   chrome-extension://<your-extension-id>,https://your-app.vercel.app
// If ALLOWED_ORIGINS is unset (local dev), we reflect the caller's Origin.

const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  let allowOrigin = "*";
  if (configured.length > 0) {
    allowOrigin = origin && configured.includes(origin) ? origin : configured[0]!;
  } else if (origin) {
    allowOrigin = origin; // dev fallback: reflect the caller
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
