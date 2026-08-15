#!/usr/bin/env node
/**
 * Checks that this deployment is actually wired up: env vars present,
 * Supabase reachable, schema applied, storage buckets created.
 *
 *   npm run verify
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// Load .env.local without pulling in a dependency.
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const checks = [];
const warnings = [];
const record = (name, ok, detail = "") => checks.push({ name, ok, detail });
const warn = (name, detail) => warnings.push({ name, detail });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = process.env.NEXT_PUBLIC_SITE_URL;

record("NEXT_PUBLIC_SUPABASE_URL", Boolean(url) && !url.includes("YOUR-PROJECT") && !url.includes("placeholder"), url ?? "missing");
record("NEXT_PUBLIC_SUPABASE_ANON_KEY", Boolean(anon) && !anon.startsWith("your-"), anon ? "set" : "missing");
record("SUPABASE_SERVICE_ROLE_KEY", Boolean(service) && !service.startsWith("your-"), service ? "set" : "missing");
record("NEXT_PUBLIC_SITE_URL", Boolean(site), site ?? "missing");

// Fine while developing; fatal only in the sense that you must change it
// before printing labels, so it's a warning rather than a failure.
if (site?.includes("localhost")) {
  warn(
    "NEXT_PUBLIC_SITE_URL is localhost",
    "set it to the real domain before printing any QR labels",
  );
}

if (!checks.every((c) => c.ok)) {
  report();
  process.exit(1);
}

const db = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
  "shops",
  "categories",
  "products",
  "product_variants",
  "orders",
  "order_items",
  "scan_events",
];

for (const table of TABLES) {
  const { error } = await db.from(table).select("*", { head: true, count: "exact" });
  record(`table ${table}`, !error, error?.message ?? "ok");
}

// The order-number allocator is a function, not a table — check it runs.
{
  const { error } = await db.rpc("next_order_code", {
    p_shop: "00000000-0000-0000-0000-000000000000",
  });
  const missing = error?.message?.includes("Could not find the function");
  record(
    "function next_order_code",
    !missing,
    missing ? "not created — re-run supabase/schema.sql" : "ok",
  );
}

{
  const { data, error } = await db.storage.listBuckets();
  const names = new Set((data ?? []).map((b) => b.id));
  record("bucket product-images", !error && names.has("product-images"), error?.message ?? "");
  record("bucket receipts", !error && names.has("receipts"), error?.message ?? "");

  const receipts = (data ?? []).find((b) => b.id === "receipts");
  if (receipts) {
    record(
      "receipts bucket is private",
      receipts.public === false,
      receipts.public ? "PUBLIC — payment receipts would be world-readable" : "ok",
    );
  }
}

report();
process.exit(checks.every((c) => c.ok) ? 0 : 1);

function report() {
  console.log("");
  for (const c of checks) {
    console.log(`${c.ok ? "  ✓" : "  ✗"} ${c.name}${c.detail && !c.ok ? ` — ${c.detail}` : ""}`);
  }
  for (const w of warnings) {
    console.log(`  ! ${w.name} — ${w.detail}`);
  }
  const failed = checks.filter((c) => !c.ok).length;
  console.log(
    failed === 0
      ? "\n  All checks passed. The system is wired up.\n"
      : `\n  ${failed} check(s) failed. See README.md → Setup.\n`,
  );
}
