import { defineManifest } from "@crxjs/vite-plugin";

// activeTab + scripting lets us read the current tab only on an explicit user
// gesture (no broad host access to every site). host_permissions are limited to
// the Supabase API endpoints we POST to.
export default defineManifest({
  manifest_version: 3,
  name: "Job Tracker — Save Jobs",
  version: "0.1.0",
  description: "Capture job listings from any tab into your personal funnel tracker.",
  action: {
    default_popup: "index.html",
    default_title: "Save job to tracker",
  },
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  permissions: ["storage", "activeTab", "scripting", "contextMenus"],
  host_permissions: [
    "http://127.0.0.1:54321/*",
    "http://localhost:54321/*",
    "https://*.supabase.co/*",
  ],
});
