import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { isConfigured, missingEnv, siteUrl } from "./env.ts";

const KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function only(env: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
}

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k]!;
  }
});

describe("siteUrl", () => {
  it("falls back to localhost in development", () => {
    only({});
    assert.equal(siteUrl(), "http://localhost:3000");
  });

  it("uses Vercel's stable production domain when no domain is configured", () => {
    // The whole point: this survives redeploys, so printed labels keep working.
    only({ VERCEL_PROJECT_PRODUCTION_URL: "qirtas-rho.vercel.app" });
    assert.equal(siteUrl(), "https://qirtas-rho.vercel.app");
  });

  it("prefers an explicit custom domain once one exists", () => {
    only({
      VERCEL_PROJECT_PRODUCTION_URL: "qirtas-rho.vercel.app",
      NEXT_PUBLIC_SITE_URL: "https://qirtas.bh",
    });
    assert.equal(siteUrl(), "https://qirtas.bh");
  });

  it("ignores a localhost value on a real deployment", () => {
    // Guards against .env.example being copied into hosting config, which
    // would print QR labels pointing at somebody's laptop.
    for (const local of [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost",
    ]) {
      only({
        VERCEL_PROJECT_PRODUCTION_URL: "qirtas-rho.vercel.app",
        NEXT_PUBLIC_SITE_URL: local,
      });
      assert.equal(siteUrl(), "https://qirtas-rho.vercel.app", local);
    }
  });

  it("keeps localhost when there is no deployment to prefer", () => {
    only({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" });
    assert.equal(siteUrl(), "http://localhost:3000");
  });

  it("strips a trailing slash so URLs don't end up doubled", () => {
    only({ NEXT_PUBLIC_SITE_URL: "https://qirtas.bh/" });
    assert.equal(siteUrl(), "https://qirtas.bh");
  });

  it("does not mistake a hostname merely containing 'localhost'", () => {
    only({
      VERCEL_PROJECT_PRODUCTION_URL: "qirtas-rho.vercel.app",
      NEXT_PUBLIC_SITE_URL: "https://localhost-shop.bh",
    });
    assert.equal(siteUrl(), "https://localhost-shop.bh");
  });
});

describe("missingEnv", () => {
  it("names every absent variable on a bare deployment", () => {
    only({});
    assert.deepEqual(missingEnv(), [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);
    assert.equal(isConfigured(), false);
  });

  it("reports configured once all three are present", () => {
    only({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
    });
    assert.deepEqual(missingEnv(), []);
    assert.equal(isConfigured(), true);
  });

  it("still flags a partially configured deployment", () => {
    only({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" });
    assert.equal(isConfigured(), false);
    assert.ok(missingEnv().includes("SUPABASE_SERVICE_ROLE_KEY"));
  });
});
