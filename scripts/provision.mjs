#!/usr/bin/env node
/**
 * One-command provisioning: Supabase project -> schema -> auth URLs ->
 * Vercel environment variables -> production deploy -> verification.
 *
 * The only thing this cannot do for you is authenticate. Create a Supabase
 * personal access token at https://supabase.com/dashboard/account/tokens,
 * then:
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run provision
 *
 * The token is read from the environment, used directly against Supabase's
 * Management API, and never written to disk or into the repository.
 *
 * Safe to re-run: it reuses an existing project of the same name rather than
 * creating a second one.
 */

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);

const API = "https://api.supabase.com/v1";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_NAME = process.env.SUPABASE_PROJECT_NAME ?? "qirtas";
const REGION = process.env.SUPABASE_REGION ?? "eu-central-1";
const VERCEL_PROJECT = process.env.VERCEL_PROJECT ?? "qirtas";

const log = (msg) => console.log(`  ${msg}`);
const step = (msg) => console.log(`\n▸ ${msg}`);
const die = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

if (!TOKEN) {
  die(
    "SUPABASE_ACCESS_TOKEN is not set.\n\n" +
      "  1. Open https://supabase.com/dashboard/account/tokens\n" +
      "  2. Generate a token\n" +
      "  3. SUPABASE_ACCESS_TOKEN=sbp_xxx npm run provision",
  );
}

/**
 * Turn a thrown error into a sentence. A top-level await rejection in an ESM
 * module bypasses process-level handlers, so main() is wrapped explicitly.
 */
function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("-> 401")) {
    die(
      "Supabase rejected the access token.\n\n" +
        "  Generate a fresh one at https://supabase.com/dashboard/account/tokens\n" +
        "  then re-run:  SUPABASE_ACCESS_TOKEN=sbp_xxx npm run provision",
    );
  }
  if (message.includes("-> 402") || message.toLowerCase().includes("quota")) {
    die(
      "Supabase refused to create the project — the organization is probably at\n" +
        "  its free-project limit. Remove an unused project, or set\n" +
        "  SUPABASE_PROJECT_NAME=<existing> to reuse one.",
    );
  }
  if (message.includes("-> 403")) {
    die("The access token lacks permission for that operation.\n\n  " + message);
  }
  die(message);
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
    const detail =
      typeof body === "object" && body?.message ? body.message : text;
    throw new Error(`${options.method ?? "GET"} ${path} -> ${res.status}: ${detail}`);
  }
  return body;
}

/** A database password we generate, so no human secret passes through here. */
function generatePassword() {
  const alphabet =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // ---------------------------------------------------------------- project

  step("Checking Supabase account");
  const orgs = await api("/organizations");
  if (!orgs?.length) die("No Supabase organization found on this account.");
  const org = orgs[0];
  log(`organization: ${org.name}`);

  const projects = await api("/projects");
  let project = projects.find((p) => p.name === PROJECT_NAME);

  if (project) {
    step(`Reusing existing project "${PROJECT_NAME}"`);
    log(`ref: ${project.id}   region: ${project.region}`);
  } else {
    step(`Creating project "${PROJECT_NAME}" in ${REGION}`);
    const dbPass = generatePassword();
    project = await api("/projects", {
      method: "POST",
      body: JSON.stringify({
        name: PROJECT_NAME,
        organization_id: org.id,
        region: REGION,
        db_pass: dbPass,
      }),
    });
    log(`ref: ${project.id}`);
    console.log(
      `\n  ⚠ Database password (store this now — it is not shown again):\n\n      ${dbPass}\n`,
    );
  }

  const ref = project.id;

  step("Waiting for the database to come online");
  for (let i = 0; i < 60; i++) {
    const current = await api(`/projects/${ref}`);
    if (current.status === "ACTIVE_HEALTHY") {
      log("healthy");
      break;
    }
    log(`status: ${current.status} — waiting…`);
    await sleep(10_000);
    if (i === 59) die("Timed out waiting for the project to become healthy.");
  }

  // ----------------------------------------------------------------- schema

  step("Applying supabase/schema.sql");
  const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  await api(`/projects/${ref}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query: sql }),
  });
  log("schema applied");

  step("Verifying schema objects");
  const check = await api(`/projects/${ref}/database/query`, {
    method: "POST",
    body: JSON.stringify({
      query: `select
          (select count(*) from information_schema.tables
            where table_schema='public'
              and table_name in ('shops','categories','products','product_variants',
                                 'orders','order_items','scan_events')) as tables,
          (select count(*) from information_schema.routines
            where routine_schema='public'
              and routine_name in ('next_order_code','adjust_stock')) as functions,
          (select count(*) from storage.buckets
            where id in ('product-images','receipts')) as buckets,
          (select count(*) from storage.buckets
            where id='receipts' and public=false) as receipts_private;`,
    }),
  });
  const counts = Array.isArray(check) ? check[0] : check;
  log(`tables ${counts.tables}/7   functions ${counts.functions}/2   buckets ${counts.buckets}/2`);
  if (Number(counts.tables) !== 7 || Number(counts.functions) !== 2 || Number(counts.buckets) !== 2) {
    die("Schema did not fully apply. Re-run, or paste schema.sql into the SQL Editor.");
  }
  if (Number(counts.receipts_private) !== 1) {
    die("The receipts bucket is public. Refusing to continue — payment receipts must stay private.");
  }
  log("receipts bucket is private ✓");

  // ------------------------------------------------------------------ keys

  step("Fetching API keys");
  const keys = await api(`/projects/${ref}/api-keys`);
  const anon = keys.find((k) => k.name === "anon")?.api_key;
  const service = keys.find((k) => k.name === "service_role")?.api_key;
  if (!anon || !service) die("Could not read the anon/service_role keys.");
  const url = `https://${ref}.supabase.co`;
  log(`url: ${url}`);
  log("anon and service_role keys retrieved");

  // ------------------------------------------------------------- auth URLs

  async function vercel(args) {
    const { stdout } = await run("npx", ["--yes", "vercel@latest", ...args], {
      cwd: new URL("..", import.meta.url).pathname,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  }

  step("Resolving the production URL");
  let siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    try {
      const out = await vercel(["project", "inspect", VERCEL_PROJECT]);
      const match = out.match(/https:\/\/[a-z0-9-]+\.vercel\.app/i);
      if (match) siteUrl = match[0];
    } catch {
      /* fall through */
    }
  }
  if (!siteUrl) die("Could not determine the production URL. Set SITE_URL=https://… and re-run.");
  log(siteUrl);

  step("Configuring auth redirect URLs");
  await api(`/projects/${ref}/config/auth`, {
    method: "PATCH",
    body: JSON.stringify({
      site_url: siteUrl,
      uri_allow_list: [`${siteUrl}/auth/callback`, "http://localhost:3000/auth/callback"].join(","),
    }),
  });
  log(`site_url ${siteUrl}`);
  log(`callback ${siteUrl}/auth/callback`);

  // -------------------------------------------------------- vercel env vars

  step("Setting Vercel environment variables");
  for (const [name, value] of [
    ["NEXT_PUBLIC_SUPABASE_URL", url],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anon],
    ["SUPABASE_SERVICE_ROLE_KEY", service],
  ]) {
    try {
      await vercel(["env", "rm", name, "production", "--yes"]);
    } catch {
      /* not set yet */
    }
    await run("sh", [
      "-c",
      `printf %s ${JSON.stringify(value)} | npx --yes vercel@latest env add ${name} production`,
    ], { cwd: new URL("..", import.meta.url).pathname, maxBuffer: 10 * 1024 * 1024 });
    log(`${name} set`);
  }

  // ----------------------------------------------------------- deploy + check

  step("Deploying to production");
  const deployOut = await vercel(["--prod", "--yes"]);
  const dep = deployOut.match(/https:\/\/[a-z0-9-]+\.vercel\.app/i)?.[0];
  log(dep ?? "deployed");

  step("Verifying the live site");
  await sleep(5000);
  let ok = true;
  for (const path of ["/", "/login"]) {
    const res = await fetch(`${siteUrl}${path}`);
    const body = await res.text();
    const stillUnconfigured = body.includes("one setup step left");
    const good = res.status === 200 && !stillUnconfigured;
    log(`${path.padEnd(8)} HTTP ${res.status}${stillUnconfigured ? "  (still showing setup screen)" : ""}`);
    if (!good) ok = false;
  }

  const leaked = await fetch(siteUrl)
    .then((r) => r.text())
    .then((t) => /eyJhbGciOi|sb_secret/.test(t));
  log(leaked ? "⚠ a key appears in the HTML" : "no keys in served HTML ✓");
  if (leaked) ok = false;

  console.log(
    ok
      ? `\n✓ Live at ${siteUrl}\n\n  Open it, sign in with your email, and create your shop.\n`
      : `\n✗ Deployed, but the checks above did not pass. See README.md → Setup.\n`,
  );
  process.exit(ok ? 0 : 1);

}

main().catch(fail);
