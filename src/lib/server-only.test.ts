import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

// siteUrl() reads VERCEL_PROJECT_PRODUCTION_URL, which has no NEXT_PUBLIC_
// prefix and so is absent from client bundles. Called from a client component
// it would skip that rung and fall through to localhost — silently, with no
// error, minting QR labels that point at the printer's own laptop.
//
// Next has no way to fail that at build time without the `server-only`
// package, and this project stays dependency-free, so the invariant is
// enforced here instead: it costs nothing and fails loudly the moment someone
// imports the URL helpers into a client component.

const SERVER_ONLY = ["@/lib/env", "@/lib/urls"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

describe("server-only modules", () => {
  it("are never imported by a client component", () => {
    const offenders: string[] = [];

    for (const path of sourceFiles("src")) {
      const source = readFileSync(path, "utf8");
      // "use client" is only a directive when it opens the file.
      if (!/^\s*["']use client["']/.test(source)) continue;

      for (const mod of SERVER_ONLY) {
        if (new RegExp(`from\\s+["']${mod}["']`).test(source)) {
          offenders.push(`${path} imports ${mod}`);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `These would resolve siteUrl() to localhost in the browser:\n  ${offenders.join("\n  ")}`,
    );
  });

  it("actually scans something, so the check cannot pass vacuously", () => {
    const files = sourceFiles("src");
    const clients = files.filter((p) =>
      /^\s*["']use client["']/.test(readFileSync(p, "utf8")),
    );

    assert.ok(files.length > 20, `only found ${files.length} source files`);
    assert.ok(clients.length > 0, "found no client components to check");
  });
});
