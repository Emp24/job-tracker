import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// activeTab + scripting lets us read the current tab only on an explicit user
// gesture (no broad host access to every site). host_permissions are limited to
// the Supabase API endpoints we POST to. WXT auto-wires action.default_popup and
// emits background.service_worker (Chrome) / background.scripts (Firefox) per
// target; browser_specific_settings is emitted only in the Firefox build.
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  // Firefox defaults to MV2 in WXT; force MV3 so both targets share one manifest
  // shape (Chrome → service_worker, Firefox → event-page scripts).
  manifestVersion: 3,
  // Read VITE_SUPABASE_* from the monorepo root .env (shared with the web app).
  vite: () => ({ envDir: "../../", plugins: [tailwindcss()] }),
  manifest: {
    name: "Job Tracker — Save Jobs",
    description: "Capture job listings from any tab into your personal funnel tracker.",
    // action.default_popup and default_title are auto-wired from the popup
    // entrypoint (its <script> and <title> respectively).
    permissions: ["storage", "activeTab", "scripting", "contextMenus"],
    host_permissions: [
      "http://127.0.0.1:54321/*",
      "http://localhost:54321/*",
      "https://*.supabase.co/*",
    ],
    // Firefox requires an email-style id (name@host) or a {GUID}; the host part
    // is just a namespace and need not be a real/owned domain.
    browser_specific_settings: { gecko: { id: "job-tracker@job-analyzer" } },
  },
});
