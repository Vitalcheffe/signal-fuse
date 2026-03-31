import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ProviderResponse, FuseResult, FusedCluster } from "../types.js";

describe("types", () => {
  it("ProviderResponse shape is correct", () => {
    const resp: ProviderResponse = {
      provider: "openai",
      text: "hello",
      latencyMs: 100,
    };
    assert.equal(resp.provider, "openai");
    assert.equal(resp.text, "hello");
    assert.equal(resp.latencyMs, 100);
    assert.equal(resp.error, undefined);
  });

  it("ProviderResponse with error", () => {
    const resp: ProviderResponse = {
      provider: "openai",
      text: "",
      latencyMs: 500,
      error: "timeout",
    };
    assert.equal(resp.error, "timeout");
  });

  it("FuseResult shape is correct", () => {
    const result: FuseResult = {
      consensus: "Paris",
      confidence: 0.95,
      method: "unanimous",
      agreed: ["openai", "anthropic"],
      outliers: [],
      responses: [],
      total: 2,
    };
    assert.equal(result.consensus, "Paris");
    assert.equal(result.confidence, 0.95);
    assert.equal(result.method, "unanimous");
    assert.equal(result.agreed.length, 2);
  });

  it("FuseResult method is one of three values", () => {
    const methods: FuseResult["method"][] = ["unanimous", "majority", "best-effort"];
    for (const method of methods) {
      const result: FuseResult = {
        consensus: "",
        confidence: 0,
        method,
        agreed: [],
        outliers: [],
        responses: [],
        total: 0,
      };
      assert.ok(methods.includes(result.method));
    }
  });

  it("FusedCluster shape is correct", () => {
    const cluster: FusedCluster = {
      members: ["openai", "anthropic"],
      representative: "The answer is Paris.",
      similarity: 0.85,
    };
    assert.equal(cluster.members.length, 2);
    assert.equal(cluster.representative, "The answer is Paris.");
    assert.equal(cluster.similarity, 0.85);
  });
});
