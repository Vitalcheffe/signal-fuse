#!/usr/bin/env node

/**
 * signal-fuse — Ask N models, get 1 truth.
 *
 * BFT-inspired multi-LLM consensus: query multiple models in parallel,
 * detect outlier responses, return the consensus answer with confidence.
 *
 * Usage:
 *   signal-fuse "What is the capital of France?"
 *   signal-fuse --models openai,anthropic,gemini "Explain quantum entanglement"
 *   signal-fuse --threshold 0.7 --format json "Is water wet?"
 */

import { parseArgs } from "node:util";
import { queryAll } from "./providers.js";
import { fuse } from "./consensus.js";
import type { ProviderResponse, FuseResult } from "./types.js";

const VERSION = "1.0.0";

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      models: { type: "string", short: "m", default: "" },
      threshold: { type: "string", short: "t", default: "0.6" },
      format: { type: "string", short: "f", default: "text" },
      verbose: { type: "boolean", short: "v", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.version) {
    console.log(`signal-fuse v${VERSION}`);
    process.exit(0);
  }

  if (values.help || positionals.length === 0) {
    printHelp();
    process.exit(0);
  }

  const prompt = positionals.join(" ");
  const threshold = parseFloat(values.threshold as string);
  const format = values.format as string;
  const verbose = values.verbose as boolean;

  // Resolve which providers to query
  const requestedModels = (values.models as string)
    ? (values.models as string).split(",").map((s) => s.trim())
    : detectAvailableProviders();

  if (requestedModels.length < 2) {
    console.error("Error: Need at least 2 providers for consensus.");
    console.error("Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY env vars.");
    console.error("Or use --models openai,anthropic,gemini");
    process.exit(1);
  }

  if (verbose) {
    console.error(`Querying ${requestedModels.length} models: ${requestedModels.join(", ")}`);
    console.error(`Consensus threshold: ${threshold}`);
    console.error("");
  }

  // Query all providers in parallel
  const responses = await queryAll(prompt, requestedModels);

  if (responses.length < 2) {
    console.error("Error: Less than 2 providers responded successfully.");
    for (const r of responses) {
      if (r.error) console.error(`  ${r.provider}: ${r.error}`);
    }
    process.exit(1);
  }

  // Fuse responses using BFT-inspired consensus
  const result = fuse(responses, threshold);

  // Output
  if (format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result, verbose);
  }
}

function detectAvailableProviders(): string[] {
  const providers: string[] = [];
  if (process.env.OPENAI_API_KEY) providers.push("openai");
  if (process.env.ANTHROPIC_API_KEY) providers.push("anthropic");
  if (process.env.GEMINI_API_KEY) providers.push("gemini");
  if (process.env.MISTRAL_API_KEY) providers.push("mistral");
  if (process.env.DEEPSEEK_API_KEY) providers.push("deepseek");
  if (process.env.GROQ_API_KEY) providers.push("groq");
  if (process.env.XAI_API_KEY) providers.push("xai");
  if (process.env.OPENROUTER_API_KEY) providers.push("openrouter");
  return providers;
}

function printResult(result: FuseResult, verbose: boolean) {
  console.log("");
  console.log(result.consensus);
  console.log("");

  // Confidence bar
  const barLen = 30;
  const filled = Math.round(result.confidence * barLen);
  const bar = "█".repeat(filled) + "░".repeat(barLen - filled);
  const pct = (result.confidence * 100).toFixed(0);
  console.log(`Confidence: ${bar} ${pct}%`);

  if (result.method === "unanimous") {
    console.log(`Method: Unanimous (${result.agreed.length}/${result.total} models)`);
  } else if (result.method === "majority") {
    console.log(`Method: Majority (${result.agreed.length}/${result.total} models agree)`);
  } else {
    console.log(`Method: Best-effort (no clear consensus)`);
  }

  if (verbose && result.outliers.length > 0) {
    console.log(`\nOutliers rejected: ${result.outliers.length}`);
    for (const o of result.outliers) {
      console.log(`  ${o.provider}: "${o.text.slice(0, 80)}..."`);
    }
  }

  if (verbose) {
    console.log(`\nAll responses:`);
    for (const r of result.responses) {
      const marker = result.agreed.includes(r.provider) ? "✓" : "✗";
      console.log(`  ${marker} ${r.provider} (${r.latencyMs}ms): "${r.text.slice(0, 100)}..."`);
    }
  }
}

function printHelp() {
  console.log(`
signal-fuse — Ask N models, get 1 truth.

USAGE
  signal-fuse [options] <prompt>

OPTIONS
  -m, --models <list>     Comma-separated provider list (default: auto-detect)
  -t, --threshold <0-1>   Consensus threshold (default: 0.6)
  -f, --format <fmt>      Output format: text | json (default: text)
  -v, --verbose           Show all responses and outlier analysis
  -h, --help              Show this help
  --version               Show version

PROVIDERS
  Set any of these env vars to enable a provider:
  OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY,
  MISTRAL_API_KEY, DEEPSEEK_API_KEY, GROQ_API_KEY,
  XAI_API_KEY, OPENROUTER_API_KEY

EXAMPLES
  signal-fuse "What is the capital of France?"
  signal-fuse -m openai,anthropic,gemini -v "Explain quantum entanglement"
  signal-fuse -t 0.8 -f json "Is water wet?"
`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
