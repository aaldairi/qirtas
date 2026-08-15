import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fileSize } from "./format.ts";

describe("fileSize", () => {
  it("never shows a real upload as 0 KB", () => {
    // Regression: a small receipt rendered as "0 KB" and looked broken.
    assert.equal(fileSize(68), "1 KB");
    assert.equal(fileSize(1), "1 KB");
  });

  it("reports KB and MB at the sizes phone screenshots actually hit", () => {
    assert.equal(fileSize(218 * 1024), "218 KB");
    assert.equal(fileSize(2 * 1024 * 1024), "2.0 MB");
  });

  it("renders nothing when the size is unknown", () => {
    assert.equal(fileSize(0), "");
    assert.equal(fileSize(null), "");
    assert.equal(fileSize(undefined), "");
  });
});
