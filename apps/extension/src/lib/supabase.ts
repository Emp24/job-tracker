import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

// The popup is ephemeral and the service worker can be killed at any time, so
// the auth session must live in chrome.storage.local (shared across both) rather
// than the default localStorage (which service workers don't have).
const chromeStorageAdapter = {
  getItem: (key: string) =>
    new Promise<string | null>((resolve) =>
      chrome.storage.local.get(key, (r) => resolve((r?.[key] as string | undefined) ?? null)),
    ),
  setItem: (key: string, value: string) =>
    new Promise<void>((resolve) => chrome.storage.local.set({ [key]: value }, () => resolve())),
  removeItem: (key: string) =>
    new Promise<void>((resolve) => chrome.storage.local.remove(key, () => resolve())),
};

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: chromeStorageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // extensions have no OAuth redirect URL to parse
      },
    });
  }
  return client;
}
