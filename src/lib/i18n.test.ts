import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_LANG, dir, fill, isLang, t } from "./i18n.ts";

/** Every leaf path in a dictionary, so the two languages can be compared. */
function paths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => paths(v, `${prefix}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      paths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

describe("language selection", () => {
  it("defaults to Arabic, which is the shops' first language", () => {
    assert.equal(DEFAULT_LANG, "ar");
    assert.equal(dir("ar"), "rtl");
    assert.equal(dir("en"), "ltr");
  });

  it("only accepts known languages from the cookie", () => {
    assert.equal(isLang("ar"), true);
    assert.equal(isLang("en"), true);
    for (const bad of ["fr", "", null, undefined, 1, {}]) {
      assert.equal(isLang(bad), false, String(bad));
    }
  });
});

describe("dictionary parity", () => {
  it("has identical key structure in both languages", () => {
    // A missing key would otherwise render as an empty string in the UI.
    const ar = paths(t("ar")).sort();
    const en = paths(t("en")).sort();

    const missingInEn = ar.filter((p) => !en.includes(p));
    const missingInAr = en.filter((p) => !ar.includes(p));

    assert.deepEqual(missingInEn, [], "missing from English");
    assert.deepEqual(missingInAr, [], "missing from Arabic");
  });

  it("has no blank display strings in either language", () => {
    // Two structural blanks are deliberate and not translations:
    //   dash.tableHead[0] / [6] — spacer columns for the QR and actions cells
    //   dash.nav[0][0]          — the Dashboard href suffix, "" -> /dashboard
    const structural = (path: string) =>
      path.startsWith("dash.tableHead") || /^dash\.nav\[\d+\]\[0\]$/.test(path);

    for (const lang of ["ar", "en"] as const) {
      const blanks: string[] = [];
      const walk = (value: unknown, prefix = "") => {
        if (typeof value === "string") {
          if (value.trim() === "" && !structural(prefix)) {
            blanks.push(prefix);
          }
        } else if (Array.isArray(value)) {
          value.forEach((v, i) => walk(v, `${prefix}[${i}]`));
        } else if (value && typeof value === "object") {
          for (const [k, v] of Object.entries(value)) {
            walk(v, prefix ? `${prefix}.${k}` : k);
          }
        }
      };
      walk(t(lang));
      assert.deepEqual(blanks, [], `blank strings in ${lang}`);
    }
  });

  it("keeps the two languages actually different", () => {
    // Catches an accidental copy-paste of one dictionary over the other.
    assert.notEqual(t("ar").marketing.heroTitle, t("en").marketing.heroTitle);
    assert.notEqual(t("ar").shop.checkout, t("en").shop.checkout);
  });
});

describe("fill", () => {
  it("substitutes placeholders", () => {
    assert.equal(
      fill("Only {n} available", { n: 3 }),
      "Only 3 available",
    );
    assert.equal(
      fill(t("en").auth.sentSub, { email: "a@b.com" }),
      "We sent a sign-in link to a@b.com. It's valid for one hour.",
    );
  });

  it("leaves unknown placeholders visible rather than printing 'undefined'", () => {
    assert.equal(fill("Hello {name}", {}), "Hello {name}");
  });

  it("substitutes every occurrence", () => {
    assert.equal(fill("{x} and {x}", { x: "a" }), "a and a");
  });
});
