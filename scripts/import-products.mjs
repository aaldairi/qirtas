#!/usr/bin/env node
/**
 * Bulk-load a product catalogue from a CSV.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run import -- products.csv
 *
 * CSV columns (header row required, order free, extras ignored):
 *
 *   name      required   product name, any language
 *   price     required   BHD, e.g. 3.200
 *   stock     optional   whole number, default 0
 *   sku       optional   must be unique within the shop
 *   category  optional   created on demand
 *   track     optional   yes/no, default yes
 *   variants  optional   "Kraft:12|Navy:8"
 *   description optional
 *
 * Idempotent on SKU: a row whose SKU already exists updates that product
 * rather than creating a duplicate, so a corrected file can be re-run.
 */

import { readFileSync } from "node:fs";

const API = "https://api.supabase.com/v1";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_NAME = process.env.SUPABASE_PROJECT_NAME ?? "qirtas";

const log = (m) => console.log(`  ${m}`);
const step = (m) => console.log(`\n▸ ${m}`);
const die = (m) => {
  console.error(`\n✗ ${m}\n`);
  process.exit(1);
};

const file = process.argv[2];
if (!file) die("Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx npm run import -- products.csv");
if (!TOKEN) {
  die(
    "SUPABASE_ACCESS_TOKEN is not set.\n\n" +
      "  Generate one at https://supabase.com/dashboard/account/tokens\n" +
      "  then: SUPABASE_ACCESS_TOKEN=sbp_xxx npm run import -- products.csv",
  );
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} -> ${res.status}: ${body?.message ?? text}`);
  }
  return body;
}

const sql = (query) =>
  api(`/projects/${REF}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });

/** Postgres string literal — the only place row data reaches SQL. */
const q = (value) =>
  value === null || value === undefined || value === ""
    ? "null"
    : `'${String(value).replace(/'/g, "''")}'`;

/** RFC4180-ish parser: handles quoted fields, embedded commas and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  const clean = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (clean.length < 2) die("The CSV needs a header row and at least one product.");

  const headers = clean[0].map((h) => h.trim().toLowerCase());
  return clean.slice(1).map((cells, i) => {
    const record = { __line: i + 2 };
    headers.forEach((h, j) => (record[h] = (cells[j] ?? "").trim()));
    return record;
  });
}

let REF;

async function main() {
  step("Connecting");
  const projects = await api("/projects");
  const project = projects.find((p) => p.name === PROJECT_NAME);
  if (!project) die(`No Supabase project named "${PROJECT_NAME}".`);
  REF = project.id;
  log(`project: ${project.name} (${REF})`);

  const shops = await sql("select id, name, slug from public.shops order by created_at limit 2;");
  if (!shops.length) die("No shop exists yet. Complete setup at /login first.");
  if (shops.length > 1) die("More than one shop found; this script expects a single shop.");
  const shop = shops[0];
  log(`shop: ${shop.name}  (/s/${shop.slug})`);

  step(`Reading ${file}`);
  const rows = parseCsv(readFileSync(file, "utf8"));
  log(`${rows.length} row(s)`);

  // Validate everything before writing anything, so a typo on the last line
  // doesn't leave half a catalogue loaded.
  const problems = [];
  const parsed = rows.map((r) => {
    const name = r.name ?? "";
    const price = Number(String(r.price ?? "").replace(/[^\d.]/g, ""));
    if (!name) problems.push(`line ${r.__line}: missing name`);
    if (!Number.isFinite(price) || price < 0) {
      problems.push(`line ${r.__line}: invalid price "${r.price}"`);
    }
    const stock = r.stock ? parseInt(r.stock, 10) : 0;
    if (r.stock && !Number.isFinite(stock)) {
      problems.push(`line ${r.__line}: invalid stock "${r.stock}"`);
    }
    return {
      name,
      price: Math.round(price * 1000) / 1000,
      stock: Number.isFinite(stock) ? Math.max(0, stock) : 0,
      sku: r.sku || null,
      category: r.category || null,
      description: r.description || null,
      track: !/^(no|false|0)$/i.test(r.track ?? ""),
      variants: (r.variants || "")
        .split("|")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => {
          const [label, qty] = v.split(":");
          return { label: label.trim(), qty: Math.max(0, parseInt(qty ?? "0", 10) || 0) };
        }),
      line: r.__line,
    };
  });

  const seen = new Set();
  for (const p of parsed) {
    if (!p.sku) continue;
    const key = p.sku.toLowerCase();
    if (seen.has(key)) problems.push(`line ${p.line}: duplicate SKU "${p.sku}" within the file`);
    seen.add(key);
  }

  if (problems.length) {
    die(`Nothing was written. Fix these first:\n\n  ${problems.join("\n  ")}`);
  }
  log("all rows valid");

  step("Loading categories");
  const names = [...new Set(parsed.map((p) => p.category).filter(Boolean))];
  const categories = new Map();
  for (const name of names) {
    const existing = await sql(
      `select id from public.categories where shop_id = ${q(shop.id)} and name = ${q(name)} limit 1;`,
    );
    if (existing.length) {
      categories.set(name, existing[0].id);
    } else {
      const created = await sql(
        `insert into public.categories (shop_id, name) values (${q(shop.id)}, ${q(name)}) returning id;`,
      );
      categories.set(name, created[0].id);
      log(`created category: ${name}`);
    }
  }

  step("Loading products");
  let created = 0;
  let updated = 0;

  for (const p of parsed) {
    const categoryId = p.category ? categories.get(p.category) : null;
    const existing = p.sku
      ? await sql(
          `select id from public.products where shop_id = ${q(shop.id)} and lower(sku) = lower(${q(p.sku)}) limit 1;`,
        )
      : [];

    let id;
    if (existing.length) {
      id = existing[0].id;
      await sql(`update public.products set
          name = ${q(p.name)}, price = ${p.price}, stock = ${p.stock},
          track_stock = ${p.track}, description = ${q(p.description)},
          category_id = ${categoryId ? q(categoryId) : "null"}
        where id = ${q(id)} and shop_id = ${q(shop.id)};`);
      updated++;
    } else {
      const row = await sql(`insert into public.products
          (shop_id, name, sku, price, stock, track_stock, description, category_id)
        values (${q(shop.id)}, ${q(p.name)}, ${q(p.sku)}, ${p.price}, ${p.stock},
                ${p.track}, ${q(p.description)}, ${categoryId ? q(categoryId) : "null"})
        returning id;`);
      id = row[0].id;
      created++;
    }

    await sql(`delete from public.product_variants where product_id = ${q(id)};`);
    for (const [i, v] of p.variants.entries()) {
      await sql(`insert into public.product_variants (product_id, label, qty, sort)
                 values (${q(id)}, ${q(v.label)}, ${v.qty}, ${i});`);
    }

    log(`${existing.length ? "updated" : "created"}  ${p.name}  ${p.price.toFixed(3)} BHD`);
  }

  const total = await sql("select count(*)::int as n from public.products;");
  console.log(
    `\n✓ ${created} created, ${updated} updated — ${total[0].n} products in the shop\n` +
      `  Storefront: https://qirtas-rho.vercel.app/s/${shop.slug}\n` +
      `  Labels:     https://qirtas-rho.vercel.app/dashboard/labels\n`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("-> 401")) {
    die("Supabase rejected the access token. Generate a fresh one and re-run.");
  }
  die(message);
});
