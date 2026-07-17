#!/usr/bin/env node
// Copies the canonical data contract into supabase/functions/_shared/ so the
// Supabase Edge Runtime (which only bundles files under supabase/functions/)
// can import it. Run `pnpm sync:shared` after editing the canonical schema;
// `pnpm sync:shared --check` verifies the copy is up to date (use in CI/predeploy).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(root, "packages/shared/src/schema.ts");
const DEST = resolve(root, "supabase/functions/_shared/schema.ts");

const BANNER = `// ⚠️  GENERATED FILE — DO NOT EDIT.
// Source of truth: packages/shared/src/schema.ts
// Regenerate with: pnpm sync:shared
// The Supabase Edge Runtime only bundles files under supabase/functions/, so the
// shared data contract is copied here for the parse-job function to import.

`;

const expected = BANNER + readFileSync(SRC, "utf8");

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(DEST, "utf8");
  } catch {
    /* missing counts as out of date */
  }
  if (current !== expected) {
    console.error("✗ supabase/functions/_shared/schema.ts is out of date. Run: pnpm sync:shared");
    process.exit(1);
  }
  console.log("✓ shared schema copy is in sync");
} else {
  mkdirSync(dirname(DEST), { recursive: true });
  writeFileSync(DEST, expected);
  console.log("✓ wrote supabase/functions/_shared/schema.ts");
}
