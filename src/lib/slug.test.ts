import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isReservedSlug, isValidSlug, slugify } from "./slug.ts";

describe("slugify", () => {
  it("turns a shop name into something safe for a printed URL", () => {
    assert.equal(slugify("Seef Stationery"), "seef-stationery");
    assert.equal(slugify("  Paper   Corner  "), "paper-corner");
    assert.equal(slugify("Ali's Books & Pens"), "ali-s-books-pens");
  });

  it("strips accents rather than emitting non-ASCII into a QR target", () => {
    assert.equal(slugify("Café Papeterie"), "cafe-papeterie");
  });

  it("yields empty for Arabic names, so setup must ask for a link", () => {
    // Deliberate: transliteration would be guesswork and the slug is printed.
    assert.equal(slugify("مكتبة السيف"), "");
  });

  it("never produces leading or trailing dashes", () => {
    assert.equal(slugify("--hello--"), "hello");
    assert.equal(slugify("!!!"), "");
  });

  it("caps length without leaving a trailing dash", () => {
    const out = slugify("a".repeat(60));
    assert.ok(out.length <= 40);
    assert.ok(!out.endsWith("-"));
  });
});

describe("isValidSlug", () => {
  it("accepts realistic store links", () => {
    for (const s of ["seef-stationery", "abc", "a1b2c3", "shop-1"]) {
      assert.equal(isValidSlug(s), true, s);
    }
  });

  it("rejects anything that would break a URL or look ambiguous", () => {
    for (const s of ["", "ab", "-abc", "abc-", "AB C", "shop_1", "shop.1", "مكتبة"]) {
      assert.equal(isValidSlug(s), false, s);
    }
  });

  it("agrees with the CHECK constraint in schema.sql", () => {
    const dbRe = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
    for (const s of ["seef-stationery", "ab", "abc", "a-b", "-x", "x-"]) {
      assert.equal(isValidSlug(s), dbRe.test(s), s);
    }
  });
});

describe("isReservedSlug", () => {
  it("blocks names that collide with app routes", () => {
    for (const s of ["dashboard", "login", "api", "s", "admin"]) {
      assert.equal(isReservedSlug(s), true, s);
    }
  });

  it("leaves ordinary shop names alone", () => {
    assert.equal(isReservedSlug("seef-stationery"), false);
  });
});
