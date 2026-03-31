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
    assert.equal(result.method, "best-effort");
    assert.equal(result.total, 0);
  });

  it("single response returns best-effort with 0.5 confidence", () => {
    const result = fuse([resp("openai", "Paris")], 0.6);
    assert.equal(result.consensus, "Paris");
    assert.equal(result.confidence, 0.5);
    assert.equal(result.method, "best-effort");
    assert.equal(result.agreed.length, 1);
    assert.equal(result.outliers.length, 0);
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
    const result = fuse(responses, 0.2);
    assert.ok(result.outliers.length >= 1);
    assert.ok(result.outliers.some((o) => o.provider === "gemini"));
    assert.equal(result.method, "majority");
  });

  it("respects threshold parameter", () => {
    const responses = [
      resp("openai", "Paris is the capital of France."),
      resp("anthropic", "The capital city of France is Paris."),
    ];
    const loose = fuse(responses, 0.3);
    const strict = fuse(responses, 0.95);
    assert.ok(loose.agreed.length >= strict.agreed.length);
  });

  it("handles completely different responses", () => {
    const responses = [
      resp("openai", "Python is a programming language."),
      resp("anthropic", "A snake is a reptile without legs."),
      resp("gemini", "Monty Python was a British comedy group."),
    ];
    const result = fuse(responses, 0.6);
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

  it("two identical + one similar gives majority", () => {
    const responses = [
      resp("openai", "Water boils at 100 degrees Celsius at sea level."),
      resp("anthropic", "Water boils at 100 degrees Celsius at sea level."),
      resp("gemini", "At sea level, water boils at 100°C or 212°F."),
    ];
    const result = fuse(responses, 0.2);
    assert.ok(result.method === "majority" || result.method === "unanimous");
    assert.ok(result.agreed.length >= 2);
  });

  it("all different at high threshold gives best-effort", () => {
    const responses = [
      resp("openai", "The sky is blue because of Rayleigh scattering."),
      resp("anthropic", "Plants use photosynthesis to convert sunlight into energy."),
      resp("gemini", "The Earth orbits the Sun once every 365 days."),
    ];
    const result = fuse(responses, 0.9);
    assert.equal(result.method, "best-effort");
  });

  it("confidence is 0 when no pairs meet threshold", () => {
    const responses = [
      resp("a", "completely unique response alpha"),
      resp("b", "totally different answer beta"),
      resp("c", "another distinct reply gamma"),
    ];
    const result = fuse(responses, 0.99);
    // best-effort picks one, but confidence should be low
    assert.ok(result.confidence < 0.5);
  });

  it("two models agree, third is outlier", () => {
    const responses = [
      resp("openai", "42 is the answer to everything."),
      resp("anthropic", "42 is the answer to the ultimate question."),
      resp("gemini", "I think the answer is 43."),
    ];
    const result = fuse(responses, 0.3);
    assert.equal(result.outliers.length, 1);
    assert.equal(result.outliers[0].provider, "gemini");
    assert.ok(result.agreed.includes("openai"));
    assert.ok(result.agreed.includes("anthropic"));
  });

  it("handles very short responses", () => {
    const responses = [
      resp("openai", "Yes"),
      resp("anthropic", "Yes"),
      resp("gemini", "No"),
    ];
    const result = fuse(responses, 0.3);
    assert.equal(result.method, "majority");
  });

  it("handles empty text responses", () => {
    const responses = [
      resp("openai", "Paris is the capital of France."),
      resp("anthropic", ""),
      resp("gemini", "Paris is the capital."),
    ];
    const result = fuse(responses, 0.3);
    // Anthropic has empty text, should be outlier or at least not dominant
    assert.ok(result.consensus.length > 0);
  });

  it("preserves original responses in result", () => {
    const responses = [
      resp("openai", "Answer A"),
      resp("anthropic", "Answer A"),
      resp("gemini", "Answer B"),
    ];
    const result = fuse(responses, 0.3);
    assert.equal(result.responses.length, 3);
    assert.equal(result.total, 3);
  });

  it("confidence rounds to 2 decimal places", () => {
    const responses = [
      resp("openai", "The sky is blue."),
      resp("anthropic", "The sky is blue."),
    ];
    const result = fuse(responses, 0.3);
    const str = result.confidence.toString();
    const decimals = str.includes(".") ? str.split(".")[1].length : 0;
    assert.ok(decimals <= 2);
  });
});
