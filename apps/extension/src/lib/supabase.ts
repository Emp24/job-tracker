import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { browser } from "wxt/browser";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

// The popup is ephemeral and the service worker can be killed at any time, so
// the auth session must live in browser.storage.local (shared across both) rather
// than the default localStorage (which service workers don't have). The WXT
// browser.* API is promise-based on both Chrome and Firefox.
const browserStorageAdapter = {
  getItem: (key: string) =>
    browser.storage.local.get(key).then((r) => (r?.[key] as string | undefined) ?? null),
  setItem: (key: string, value: string) =>
    browser.storage.local.set({ [key]: value }),
  removeItem: (key: string) => browser.storage.local.remove(key),
};

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: browserStorageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // extensions have no OAuth redirect URL to parse
      },
    });
  }
  return client;
}
