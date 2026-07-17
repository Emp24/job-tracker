import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Read VITE_SUPABASE_* from the monorepo root .env (shared with the extension).
  envDir: "../../",
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
});
