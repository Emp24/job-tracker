const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env at the repo root.",
  );
}

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anon;
export const FUNCTIONS_URL = `${url.replace(/\/$/, "")}/functions/v1`;
