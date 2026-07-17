import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  // Read VITE_SUPABASE_* from the monorepo root .env (shared with the web app).
  envDir: "../../",
  plugins: [react(), tailwindcss(), crx({ manifest })],
  server: { port: 5174, strictPort: true },
});
