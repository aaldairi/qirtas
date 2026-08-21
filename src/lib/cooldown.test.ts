import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COOLDOWN_SECONDS, parseLastRequest, secondsLeft } from "./cooldown.ts";

const NOW = 1_700_000_000_000;

describe("secondsLeft", () => {
  it("holds the form for the full window right after a send", () => {
    assert.equal(secondsLeft({ at: NOW, email: "a@b.com" }, NOW), COOLDOWN_SECONDS);
  });

  it("counts down as the window elapses", () => {
    const entry = { at: NOW, email: "a@b.com" };
    assert.equal(secondsLeft(entry, NOW + 15_000), 45);
    assert.equal(secondsLeft(entry, NOW + 59_000), 1);
  });

  it("releases exactly at the boundary, not a tick later", () => {
    const entry = { at: NOW, email: "a@b.com" };
    assert.equal(secondsLeft(entry, NOW + 60_000), 0);
    assert.equal(secondsLeft(entry, NOW + 61_000), 0);
  });

  it("never waits on a first visit", () => {
    assert.equal(secondsLeft(null, NOW), 0);
  });

  it("clamps a future timestamp so a wrong clock cannot lock anyone out", () => {
    // A device clock an hour fast would otherwise strand the owner.
    const entry = { at: NOW + 3_600_000, email: "a@b.com" };
    assert.equal(secondsLeft(entry, NOW), COOLDOWN_SECONDS);
  });

  it("ignores a corrupt timestamp rather than blocking on it", () => {
    assert.equal(secondsLeft({ at: NaN, email: "" }, NOW), 0);
  });
});

describe("parseLastRequest", () => {
  it("reads back what was stored", () => {
    const raw = JSON.stringify({ at: NOW, email: "owner@shop.com" });
    assert.deepEqual(parseLastRequest(raw), { at: NOW, email: "owner@shop.com" });
  });

  it("treats an empty store as no pending request", () => {
    assert.equal(parseLastRequest(null), null);
  });

  it("survives junk left by anything else on the origin", () => {
    assert.equal(parseLastRequest("not json"), null);
    assert.equal(parseLastRequest("{}"), null);
    assert.equal(parseLastRequest('{"at":"soon"}'), null);
  });

  it("tolerates a missing email, since only the timestamp gates sending", () => {
    assert.deepEqual(parseLastRequest(`{"at":${NOW}}`), { at: NOW, email: "" });
  });
});
