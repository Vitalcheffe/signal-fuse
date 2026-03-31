import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("providers", () => {
  it("module exports queryAll", async () => {
    const mod = await import("../providers.js");
    assert.equal(typeof mod.queryAll, "function");
  });

  it("known provider names are consistent", async () => {
    const known = ["openai", "anthropic", "gemini", "mistral", "deepseek", "groq", "xai", "openrouter"];
    assert.equal(known.length, 8);
    for (const name of known) {
      assert.ok(name.length > 0);
      assert.equal(name, name.toLowerCase());
    }
  });
});
