import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Guards the palette against silently drifting below WCAG AA. The muted
 * greys are used for small metadata text — order meta, SKUs, scan counts —
 * which is exactly the text that becomes unreadable first.
 */

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `--color-${name} not found in globals.css`);
  return match![1];
}

function channels(hex: string): number[] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT_SURFACES = ["paper", "sand", "soft", "shell"] as const;

describe("palette contrast (WCAG AA)", () => {
  it("muted body and metadata text clears 4.5:1 on every light surface", () => {
    for (const text of ["mute", "mute-2", "mute-4", "ink", "ink-3"]) {
      for (const surface of LIGHT_SURFACES) {
        const ratio = contrast(token(text), token(surface));
        assert.ok(
          ratio >= 4.5,
          `${text} on ${surface} is ${ratio.toFixed(2)}:1, needs 4.5:1`,
        );
      }
    }
  });

  it("decorative grey clears the 3:1 non-text threshold", () => {
    for (const surface of LIGHT_SURFACES) {
      const ratio = contrast(token("mute-5"), token(surface));
      assert.ok(
        ratio >= 3,
        `mute-5 on ${surface} is ${ratio.toFixed(2)}:1, needs 3:1`,
      );
    }
  });

  it("text on ink surfaces clears 4.5:1", () => {
    // Darkening these the way the light-surface tokens were darkened would
    // reduce contrast here — hence the separate mute-ink token.
    for (const text of ["mute-ink", "mute-3", "chalk", "paper"]) {
      const ratio = contrast(token(text), token("ink"));
      assert.ok(
        ratio >= 4.5,
        `${text} on ink is ${ratio.toFixed(2)}:1, needs 4.5:1`,
      );
    }
  });

  it("keeps mute-ink lighter than mute-2, since they serve opposite surfaces", () => {
    assert.ok(
      luminance(token("mute-ink")) > luminance(token("mute-2")),
      "mute-ink must stay lighter than mute-2",
    );
  });
});
