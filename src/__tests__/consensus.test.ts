import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fuse } from "../consensus.js";
import type { ProviderResponse } from "../types.js";

function resp(provider: string, text: string): ProviderResponse {
  return { provider, text, latencyMs: 100 };
}

describe("consensus", () => {
  it("returns empty result for no responses", () => {
    const result = fuse([], 0.6);
    assert.equal(result.consensus, "");
    assert.equal(result.confidence, 0);
  });

  it("single response returns best-effort with 0.5 confidence", () => {
    const result = fuse([resp("openai", "Paris")], 0.6);
    assert.equal(result.consensus, "Paris");
    assert.equal(result.confidence, 0.5);
    assert.equal(result.method, "best-effort");
  });

  it("identical responses give unanimous consensus", () => {
    const responses = [
      resp("openai", "The capital of France is Paris."),
      resp("anthropic", "The capital of France is Paris."),
      resp("gemini", "The capital of France is Paris."),
    ];
    const result = fuse(responses, 0.6);
    assert.equal(result.method, "unanimous");
    assert.equal(result.agreed.length, 3);
    assert.equal(result.outliers.length, 0);
    assert.ok(result.confidence > 0.8);
  });

  it("detects outlier response", () => {
    const responses = [
      resp("openai", "The capital of France is Paris, located on the Seine river."),
      resp("anthropic", "Paris is the capital of France, situated on the Seine."),
      resp("gemini", "The capital of Australia is Canberra, not Paris."),
    ];
    const result = fuse(responses, 0.4);
    assert.equal(result.outliers.length, 1);
    assert.equal(result.outliers[0].provider, "gemini");
    assert.equal(result.method, "majority");
  });

  it("respects threshold parameter", () => {
    const responses = [
      resp("openai", "Paris is the capital of France."),
      resp("anthropic", "The capital city of France is Paris."),
    ];
    const loose = fuse(responses, 0.3);
    const strict = fuse(responses, 0.95);
    // With a very high threshold, even similar responses may not agree
    assert.ok(loose.agreed.length >= strict.agreed.length);
  });

  it("handles completely different responses", () => {
    const responses = [
      resp("openai", "Python is a programming language."),
      resp("anthropic", "A snake is a reptile without legs."),
      resp("gemini", "Monty Python was a British comedy group."),
    ];
    const result = fuse(responses, 0.6);
    // No consensus — all different topics
    assert.ok(result.confidence < 0.7);
  });

  it("picks the longest response in agreed cluster", () => {
    const long = "Paris is the capital of France. It is the largest city in France and a major European cultural center.";
    const responses = [
      resp("openai", long),
      resp("anthropic", "Paris is the capital of France."),
      resp("gemini", "Paris, France's capital, is the largest city."),
    ];
    const result = fuse(responses, 0.3);
    assert.equal(result.consensus, long);
  });
});
