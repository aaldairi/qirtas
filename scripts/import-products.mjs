#!/usr/bin/env node
/**
 * Bulk-load a product catalogue from a CSV.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run import -- products.csv
 *
 * With more than one shop on the project, name the target explicitly:
 *
 *   SHOP=alhasanain SUPABASE_ACCESS_TOKEN=sbp_xxx npm run import -- products.csv
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
 *   status    optional   draft/live. A row with no price is forced to draft:
 *                        a published product at 0.000 can be ordered for free.
 * Photos can also come from a local folder instead of URLs:
 *
 *   IMAGES=./photos SHOP="..." SUPABASE_ACCESS_TOKEN=sbp_xxx npm run import -- products.csv
 *
 * Files are matched to products by filename: 6900202500015.jpg attaches to the
 * product with that SKU. Shoot them on a phone, name them by barcode, done.
 *
 *   image_url optional   a public https URL. Downloaded and re-hosted in your
 *                        own storage, so the listing does not break when
 *                        someone else's server goes away. Use images you are
 *                        licensed to use — a supplier feed or your own photos.
 *
 * Idempotent on SKU: a row whose SKU already exists updates that product
 * rather than creating a duplicate, so a corrected file can be re-run.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, basename } from "node:path";

const API = "https://api.supabase.com/v1";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_NAME = process.env.SUPABASE_PROJECT_NAME ?? "qirtas";
const SHOP = process.env.SHOP;

const IMAGES_DIR = process.env.IMAGES;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Pull an image and put it in the shop's own storage bucket. Hotlinking a
 * supplier URL would leave the catalogue silently broken the day they
 * reorganise their site.
 */
async function fetchImage(url) {
  if (!/^https:\/\//i.test(url)) return { error: "not an https URL" };
  let res;
  try {
    res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000) });
  } catch {
    return { error: "could not be fetched" };
  }
  if (!res.ok) return { error: `HTTP ${res.status}` };

  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!IMAGE_TYPES.includes(type)) return { error: `unsupported type ${type || "unknown"}` };

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) return { error: "larger than 5 MB" };
  if (buf.byteLength === 0) return { error: "empty file" };

  return { bytes: buf, type };
}

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

  const shops = await sql("select id, name, slug from public.shops order by created_at;");
  if (!shops.length) die("No shop exists yet. Complete setup at /login first.");

  // Writing a catalogue into the wrong shop would be tedious to unpick, so
  // an ambiguous target stops the run rather than picking one.
  let shop;
  if (SHOP) {
    shop = shops.find(
      (s) => s.slug.toLowerCase() === SHOP.toLowerCase() ||
             s.name.toLowerCase() === SHOP.toLowerCase(),
    );
    if (!shop) {
      die(
        `No shop matching "${SHOP}". Available:\n\n  ` +
          shops.map((s) => `${s.slug}  (${s.name})`).join("\n  "),
      );
    }
  } else if (shops.length === 1) {
    shop = shops[0];
  } else {
    die(
      `${shops.length} shops on this project — name the target with SHOP=<slug>:\n\n  ` +
        shops.map((s) => `SHOP=${s.slug}   # ${s.name}`).join("\n  "),
    );
  }
  log(`shop: ${shop.name}  (/s/${shop.slug})`);

  step(`Reading ${file}`);
  const rows = parseCsv(readFileSync(file, "utf8"));
  log(`${rows.length} row(s)`);

  // Validate everything before writing anything, so a typo on the last line
  // doesn't leave half a catalogue loaded.
  const problems = [];
  const parsed = rows.map((r) => {
    const name = r.name ?? "";
    const raw = String(r.price ?? "").replace(/[^\d.]/g, "");
    const price = raw === "" ? 0 : Number(raw);
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
      imageUrl: (r.image_url || "").trim() || null,
      track: !/^(no|false|0)$/i.test(r.track ?? ""),
      // Never publish something with no price — it would be orderable for
      // free. Priced rows follow the status column, defaulting to live.
      active: price > 0 && !/^(draft|no|false|0|hidden)$/i.test(r.status ?? ""),
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

  // Index a local photo folder by SKU, so a phone-shot library can be
  // attached in bulk without editing the CSV at all.
  const localImages = new Map();
  if (IMAGES_DIR) {
    step(`Indexing photos in ${IMAGES_DIR}`);
    for (const entry of readdirSync(IMAGES_DIR)) {
      const full = join(IMAGES_DIR, entry);
      if (!statSync(full).isFile()) continue;
      const ext = extname(entry).toLowerCase();
      if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) continue;
      localImages.set(basename(entry, extname(entry)).trim().toLowerCase(), full);
    }
    const matched = parsed.filter((p) => p.sku && localImages.has(p.sku.toLowerCase())).length;
    log(`${localImages.size} photo(s) found, ${matched} match a SKU in the file`);
    if (matched === 0) {
      log("nothing matched — name each file after its barcode, e.g. 6900202500015.jpg");
    }
  }

  // The service key is only needed when images are involved.
  let SERVICE_KEY = null;
  if (parsed.some((p) => p.imageUrl) || localImages.size) {
    const keys = await api(`/projects/${REF}/api-keys`);
    SERVICE_KEY = keys.find((k) => k.name === "service_role")?.api_key;
    if (!SERVICE_KEY) die("Could not read the service_role key needed to upload images.");
  }

  step("Loading products");
  let created = 0;
  let updated = 0;
  let imagesLoaded = 0;
  const imageProblems = [];

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
          active = ${p.active},
          category_id = ${categoryId ? q(categoryId) : "null"}
        where id = ${q(id)} and shop_id = ${q(shop.id)};`);
      updated++;
    } else {
      const row = await sql(`insert into public.products
          (shop_id, name, sku, price, stock, track_stock, description, category_id, active)
        values (${q(shop.id)}, ${q(p.name)}, ${q(p.sku)}, ${p.price}, ${p.stock},
                ${p.track}, ${q(p.description)}, ${categoryId ? q(categoryId) : "null"}, ${p.active})
        returning id;`);
      id = row[0].id;
      created++;
    }

    await sql(`delete from public.product_variants where product_id = ${q(id)};`);
    for (const [i, v] of p.variants.entries()) {
      await sql(`insert into public.product_variants (product_id, label, qty, sort)
                 values (${q(id)}, ${q(v.label)}, ${v.qty}, ${i});`);
    }

    // Images last: a failure here should not cost us the product row.
    let imageNote = "";
    const localPath = p.sku ? localImages.get(p.sku.toLowerCase()) : null;

    if (localPath) {
      const bytes = new Uint8Array(readFileSync(localPath));
      const ext = extname(localPath).toLowerCase().replace(".", "").replace("jpeg", "jpg");
      const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        imageNote = "  photo skipped (larger than 5 MB)";
        imageProblems.push(`${p.name}: local file larger than 5 MB`);
      } else {
        const path = `${shop.id}/${id}.${ext}`;
        const upload = await fetch(
          `https://${REF}.supabase.co/storage/v1/object/product-images/${path}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": type,
              "x-upsert": "true",
            },
            body: bytes,
          },
        );
        if (upload.ok) {
          await sql(`update public.products set image_path = ${q(path)} where id = ${q(id)};`);
          imageNote = "  + photo";
          imagesLoaded++;
        } else {
          imageNote = `  photo upload failed (${upload.status})`;
          imageProblems.push(`${p.name}: upload ${upload.status}`);
        }
      }
    } else if (p.imageUrl) {
      const img = await fetchImage(p.imageUrl);
      if (img.error) {
        imageNote = `  image skipped (${img.error})`;
        imageProblems.push(`${p.name}: ${img.error}`);
      } else {
        const ext = img.type === "image/png" ? "png" : img.type === "image/webp" ? "webp" : "jpg";
        const path = `${shop.id}/${id}.${ext}`;
        const upload = await fetch(
          `https://${REF}.supabase.co/storage/v1/object/product-images/${path}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": img.type,
              "x-upsert": "true",
            },
            body: img.bytes,
          },
        );
        if (upload.ok) {
          await sql(`update public.products set image_path = ${q(path)} where id = ${q(id)};`);
          imageNote = "  + photo";
          imagesLoaded++;
        } else {
          imageNote = `  image upload failed (${upload.status})`;
          imageProblems.push(`${p.name}: upload ${upload.status}`);
        }
      }
    }

    log(
      `${existing.length ? "updated" : "created"}  ${p.name}  ` +
        `${p.price.toFixed(3)} BHD  ${p.active ? "live" : "draft"}${imageNote}`,
    );
  }

  const drafts = parsed.filter((p) => !p.active).length;
  const total = await sql("select count(*)::int as n from public.products;");
  console.log(
    `\n✓ ${created} created, ${updated} updated — ${total[0].n} products in the shop` +
      (drafts ? `\n  ${drafts} imported as drafts (no price) — hidden from customers` : "") +
      (imagesLoaded ? `\n  ${imagesLoaded} photo(s) downloaded and re-hosted` : "") +
      (imageProblems.length
        ? `\n  ${imageProblems.length} photo(s) skipped:\n    ` + imageProblems.slice(0, 8).join("\n    ")
        : "") +
      `\n` +
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
