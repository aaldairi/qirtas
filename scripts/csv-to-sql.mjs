#!/usr/bin/env node
/**
 * Turn the product CSV into a single SQL script that can be pasted into the
 * Supabase SQL editor.
 *
 * The importer needs a personal access token, which is account-level access to
 * every project. Pasting one into a chat is the wrong trade for a one-off
 * catalogue load, so this produces SQL the owner runs in their own browser
 * instead — no credential leaves their account.
 *
 *   node scripts/csv-to-sql.mjs alhasanain-pens.csv <shop-slug> > import.sql
 *
 * Idempotent on (shop_id, sku), matching the importer: re-running updates the
 * existing row rather than creating a duplicate, so prices can be filled into
 * the CSV later and the script re-generated and re-run.
 */

import { readFileSync } from "node:fs";

const [, , file, slug] = process.argv;

if (!file || !slug) {
  console.error("usage: node scripts/csv-to-sql.mjs <file.csv> <shop-slug>");
  process.exit(1);
}

/** Minimal RFC-4180 reader: handles quoted fields and embedded commas. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Postgres string literal. Doubling the quote is the whole escape rule. */
const q = (value) =>
  value === null || value === undefined || value === ""
    ? "null"
    : `'${String(value).replace(/'/g, "''")}'`;

const rows = parseCsv(readFileSync(file, "utf8"));
const header = rows[0].map((h) => h.trim());
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

for (const column of ["name", "sku", "price", "stock", "category"]) {
  if (idx[column] === undefined) {
    console.error(`CSV is missing a "${column}" column`);
    process.exit(1);
  }
}

const products = rows.slice(1).map((r) => {
  const price = Number(r[idx.price]) || 0;
  const status = (r[idx.status] ?? "").trim().toLowerCase();
  return {
    name: r[idx.name].trim(),
    sku: r[idx.sku].trim(),
    price,
    stock: Number(r[idx.stock]) || 0,
    track: /^(yes|true|1)$/i.test((r[idx.track] ?? "").trim()),
    description: (r[idx.description] ?? "").trim(),
    category: (r[idx.category] ?? "").trim(),
    // A published product at 0.000 is orderable for free, so price gates
    // publication exactly as saveProduct() does in the app.
    active: price > 0 && status !== "draft",
  };
});

const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
const priced = products.filter((p) => p.price > 0).length;

const out = [];
out.push(`-- ${products.length} products for shop "${slug}"`);
out.push(`-- ${priced} priced and published, ${products.length - priced} drafts`);
out.push(`-- Generated from ${file}. Safe to re-run: matches on (shop_id, sku).`);
out.push("");
out.push("begin;");
out.push("");

out.push("-- Fails loudly rather than inserting against a shop that isn't there.");
out.push(`do $$ begin
  if not exists (select 1 from public.shops where slug = ${q(slug)}) then
    raise exception 'No shop with slug %. Create the shop first.', ${q(slug)};
  end if;
end $$;`);
out.push("");

for (const name of categories) {
  out.push(`insert into public.categories (shop_id, name)
select id, ${q(name)} from public.shops where slug = ${q(slug)}
  and not exists (
    select 1 from public.categories c
     where c.shop_id = shops.id and c.name = ${q(name)}
  );`);
}
out.push("");

for (const p of products) {
  out.push(`insert into public.products
  (shop_id, category_id, name, sku, price, stock, track_stock, description, active)
select s.id,
       (select c.id from public.categories c
         where c.shop_id = s.id and c.name = ${q(p.category)}),
       ${q(p.name)}, ${q(p.sku)}, ${p.price.toFixed(3)}, ${p.stock},
       ${p.track}, ${q(p.description)}, ${p.active}
  from public.shops s where s.slug = ${q(slug)}
-- Must mirror products_shop_sku_idx exactly — it is a partial index on an
-- expression, so (shop_id, sku) would not match it.
on conflict (shop_id, lower(sku)) where sku is not null and sku <> ''
do update set
  name = excluded.name,
  price = excluded.price,
  stock = excluded.stock,
  description = excluded.description,
  active = excluded.active;`);
}

out.push("");
out.push("commit;");
out.push("");
out.push(`select count(*) filter (where active) as live,
       count(*) filter (where not active) as drafts,
       count(*) as total
  from public.products p
  join public.shops s on s.id = p.shop_id
 where s.slug = ${q(slug)};`);

console.log(out.join("\n"));
