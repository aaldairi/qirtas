#!/usr/bin/env node
/**
 * Delete every shop, product, order, uploaded image and user, returning the
 * project to a freshly-provisioned schema.
 *
 * This is irreversible. It runs in two passes on purpose: without CONFIRM it
 * only counts and prints what it would destroy, so the blast radius is read
 * before it is taken.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/wipe.mjs            # dry run
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx CONFIRM=DELETE node scripts/wipe.mjs
 *
 * The schema itself, its policies and grants are left intact — this empties
 * the tables, it does not drop them. Re-running the importer restores the
 * catalogue from alhasanain-pens.csv.
 */

const API = "https://api.supabase.com/v1";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const CONFIRM = process.env.CONFIRM === "DELETE";
const PROJECT_NAME = process.env.SUPABASE_PROJECT_NAME ?? "qirtas";

const log = (m) => console.log(`  ${m}`);
const step = (m) => console.log(`\n▸ ${m}`);
const die = (m) => {
  console.error(`\n✗ ${m}\n`);
  process.exit(1);
};

if (!TOKEN) {
  die(
    "SUPABASE_ACCESS_TOKEN is not set.\n\n" +
      "  1. Open https://supabase.com/dashboard/account/tokens\n" +
      "  2. Generate a token\n" +
      "  3. SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/wipe.mjs",
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
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const detail = typeof body === "object" && body?.message ? body.message : text;
    throw new Error(`${options.method ?? "GET"} ${path} -> ${res.status}: ${detail}`);
  }
  return body;
}

const sql = (ref, query) =>
  api(`/projects/${ref}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });

async function main() {
  step("Finding the project");
  const projects = await api("/projects");
  const project = projects.find((p) => p.name === PROJECT_NAME);
  if (!project) die(`No Supabase project named "${PROJECT_NAME}".`);
  log(`${project.name}  (${project.id}, ${project.region})`);

  const ref = project.id;

  // ---------------------------------------------------------------- counts
  step("What is currently stored");
  const counts = await sql(
    ref,
    `select
       (select count(*) from public.shops)            as shops,
       (select count(*) from public.categories)       as categories,
       (select count(*) from public.products)         as products,
       (select count(*) from public.product_variants) as variants,
       (select count(*) from public.orders)           as orders,
       (select count(*) from public.order_items)      as order_items,
       (select count(*) from public.scan_events)      as scans,
       (select count(*) from auth.users)              as users;`,
  );
  const c = counts[0];
  for (const [k, v] of Object.entries(c)) log(`${String(v).padStart(5)}  ${k}`);

  const shops = await sql(
    ref,
    `select s.name, s.slug, u.email, count(p.id)::int as products
       from public.shops s
       left join auth.users u on u.id = s.owner_id
       left join public.products p on p.shop_id = s.id
      group by s.name, s.slug, u.email
      order by s.name;`,
  );
  if (shops.length) {
    step("Shops that will be destroyed");
    for (const s of shops) log(`${s.name}  /s/${s.slug}  ${s.email ?? "—"}  ${s.products} products`);
  }

  const users = await sql(ref, `select email from auth.users order by email;`);
  if (users.length) {
    step("Users that will be deleted");
    for (const u of users) log(u.email);
  }

  if (!CONFIRM) {
    console.log(
      "\n— dry run, nothing deleted —\n\n" +
        "  To actually wipe:\n" +
        `  SUPABASE_ACCESS_TOKEN=sbp_xxx CONFIRM=DELETE node scripts/wipe.mjs\n`,
    );
    return;
  }

  // ------------------------------------------------------------- storage
  // Files first: once products are gone their image paths are unrecoverable,
  // which would leave the bucket holding orphans nothing references.
  step("Deleting uploaded images");
  const keyRows = await api(`/projects/${ref}/api-keys?reveal=true`);
  const serviceKey = keyRows.find((k) => k.name === "service_role")?.api_key;
  if (!serviceKey) die("Could not read the service_role key.");

  const base = `https://${ref}.supabase.co`;
  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  };

  let removed = 0;
  const listing = await fetch(`${base}/storage/v1/object/list/product-images`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prefix: "", limit: 1000, offset: 0 }),
  });

  if (listing.ok) {
    // Objects live under <shop-id>/<file>, so the root listing returns folders.
    const roots = await listing.json();
    for (const folder of roots) {
      const inner = await fetch(`${base}/storage/v1/object/list/product-images`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prefix: folder.name, limit: 1000, offset: 0 }),
      });
      if (!inner.ok) continue;
      const files = await inner.json();
      const paths = files.filter((f) => f.id).map((f) => `${folder.name}/${f.name}`);
      if (!paths.length) continue;
      const del = await fetch(`${base}/storage/v1/object/product-images`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ prefixes: paths }),
      });
      if (del.ok) removed += paths.length;
    }
  }
  log(`${removed} file(s) removed`);

  // ---------------------------------------------------------------- rows
  // Truncate rather than delete: one statement, cascades through every
  // foreign key, and resets nothing else in the schema.
  step("Emptying tables");
  await sql(
    ref,
    `truncate table
       public.order_items,
       public.orders,
       public.scan_events,
       public.product_variants,
       public.products,
       public.categories,
       public.shops
     restart identity cascade;`,
  );
  log("shops, categories, products, variants, orders, order_items, scan_events");

  // --------------------------------------------------------------- users
  step("Deleting users");
  const remaining = await sql(ref, `select id, email from auth.users;`);
  let deleted = 0;
  for (const u of remaining) {
    const res = await fetch(`${base}/auth/v1/admin/users/${u.id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      deleted += 1;
      log(`deleted ${u.email}`);
    } else {
      log(`could not delete ${u.email} (${res.status})`);
    }
  }
  log(`${deleted} user(s) deleted`);

  // --------------------------------------------------------------- verify
  step("Verifying the database is empty");
  const after = await sql(
    ref,
    `select
       (select count(*) from public.shops)     as shops,
       (select count(*) from public.products)  as products,
       (select count(*) from public.orders)    as orders,
       (select count(*) from auth.users)       as users;`,
  );
  const a = after[0];
  for (const [k, v] of Object.entries(a)) log(`${String(v).padStart(5)}  ${k}`);

  const clean = Object.values(a).every((n) => Number(n) === 0);
  console.log(
    clean
      ? "\n✓ Wiped. Sign up at https://qertas.app/login to create the first shop.\n"
      : "\n✗ Something survived — see the counts above.\n",
  );
  if (!clean) process.exit(1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("-> 401")) {
    die("Supabase rejected the access token. Generate a fresh one and re-run.");
  }
  die(message);
});
