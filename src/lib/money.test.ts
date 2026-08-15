import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fils, money, parsePrice } from "./money.ts";

describe("money", () => {
  it("always renders three decimals, because BHD has 1000 fils", () => {
    assert.equal(money(3), "3.000");
    assert.equal(money(3.2), "3.200");
    assert.equal(money(0), "0.000");
    assert.equal(money(12.345), "12.345");
  });

  it("accepts the strings Postgres returns for numeric columns", () => {
    assert.equal(money("3.200"), "3.200");
    assert.equal(money("0"), "0.000");
  });

  it("never renders NaN or undefined into a price label", () => {
    assert.equal(money(null), "0.000");
    assert.equal(money(undefined), "0.000");
    assert.equal(money("not a number"), "0.000");
    assert.equal(money(Infinity), "0.000");
  });
});

describe("fils", () => {
  it("kills float drift so totals don't end in stray thousandths", () => {
    // 0.1 + 0.2 === 0.30000000000000004
    assert.equal(fils(0.1 + 0.2), 0.3);
    assert.equal(fils(3.2 * 3), 9.6);
  });

  it("rounds to the nearest fils", () => {
    assert.equal(fils(1.0004), 1);
    assert.equal(fils(1.0005), 1.001);
  });

  it("keeps a line total exact across a realistic cart", () => {
    const lines = [
      { price: 3.2, qty: 2 },
      { price: 0.7, qty: 1 },
      { price: 1.1, qty: 4 },
    ];
    const total = fils(
      lines.reduce((sum, l) => sum + fils(l.price * l.qty), 0),
    );
    assert.equal(total, 11.5);
    assert.equal(money(total), "11.500");
  });
});

describe("parsePrice", () => {
  it("reads what a shop owner actually types", () => {
    assert.equal(parsePrice("3.200"), 3.2);
    assert.equal(parsePrice(" 3.2 "), 3.2);
    assert.equal(parsePrice("0"), 0);
  });

  it("strips stray currency text rather than rejecting the input", () => {
    assert.equal(parsePrice("3.200 BHD"), 3.2);
  });

  it("rejects anything that isn't a usable price", () => {
    assert.equal(parsePrice(""), null);
    assert.equal(parsePrice("   "), null);
    assert.equal(parsePrice("abc"), null);
  });

  it("rounds to fils so a long decimal can't become an unpayable price", () => {
    assert.equal(parsePrice("3.2005"), 3.201);
  });
});
