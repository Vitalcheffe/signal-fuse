#!/usr/bin/env node

/**
 * signal-fuse — Ask N models, get 1 truth.
 *
 * BFT-inspired multi-LLM consensus: query multiple models in parallel,
 * detect outlier responses, return the consensus answer with confidence.
 */

import { parseArgs } from "node:util";
import c from "picocolors";
import { queryAll } from "./providers.js";
import { fuse } from "./consensus.js";
import type { ProviderResponse, FuseResult } from "./types.js";

const VERSION = "1.0.0";

// ── Spinner ────────────────────────────────────────────────────────────────
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function spinner(text: string) {
  let i = 0;
  const interval = setInterval(() => {
    process.stderr.write(`\r${c.cyan(SPINNER_FRAMES[i])} ${text}`);
    i = (i + 1) % SPINNER_FRAMES.length;
  }, 80);
  return {
    stop(final?: string) {
      clearInterval(interval);
      process.stderr.write(`\r${final ?? " ".repeat(text.length + 3)}\r`);
    },
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const { values, positionals } = parseArgs({
    options: {
      models: { type: "string", short: "m", default: "" },
      threshold: { type: "string", short: "t", default: "0.6" },
      format: { type: "string", short: "f", default: "text" },
      timeout: { type: "string", default: "30" },
      verbose: { type: "boolean", short: "v", default: false },
      quiet: { type: "boolean", short: "q", default: false },
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
  const timeoutSec = parseInt(values.timeout as string, 10);
  const format = values.format as string;
  const verbose = values.verbose as boolean;
  const quiet = values.quiet as boolean;

  if (isNaN(threshold) || threshold < 0 || threshold > 1) {
    console.error(c.red("✖") + " Threshold must be a number between 0 and 1.");
    process.exit(1);
  }

  if (isNaN(timeoutSec) || timeoutSec < 1) {
    console.error(c.red("✖") + " Timeout must be a positive number of seconds.");
    process.exit(1);
  }

  // Resolve providers
  const requestedModels = (values.models as string)
    ? (values.models as string).split(",").map((s) => s.trim())
    : detectAvailableProviders();

  // Validate requested provider names
  const knownProviders = ["openai", "anthropic", "gemini", "mistral", "deepseek", "groq", "xai", "openrouter"];
  const unknownModels = requestedModels.filter((m) => !knownProviders.includes(m));
  if (unknownModels.length > 0) {
    console.error(c.red("✖") + ` Unknown provider(s): ${unknownModels.join(", ")}`);
    console.error(`  Available: ${knownProviders.join(", ")}`);
    process.exit(1);
  }

  if (requestedModels.length < 2) {
    console.error(c.red("✖") + " Need at least 2 providers for consensus.");
    console.error("");
    console.error("  Set API keys as environment variables:");
    console.error(`  ${c.dim("export OPENAI_API_KEY=sk-...")}`);
    console.error(`  ${c.dim("export ANTHROPIC_API_KEY=sk-ant-...")}`);
    console.error(`  ${c.dim("export GEMINI_API_KEY=...")}`);
    console.error("");
    console.error("  Or specify models explicitly:");
    console.error(`  ${c.dim("signal-fuse -m openai,anthropic \"your question\"")}`);
    process.exit(1);
  }

  if (!quiet && format === "text") {
    console.error("");
    console.error(c.bold("  signal-fuse") + c.dim(` v${VERSION}`));
    console.error(c.dim("  ─".padEnd(40, "─")));
    console.error(`  ${c.dim("prompt")}    ${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}`);
    console.error(`  ${c.dim("models")}    ${requestedModels.map((m) => c.cyan(m)).join(", ")}`);
    console.error(`  ${c.dim("threshold")} ${threshold}`);
    console.error("");
  }

  // Query all providers in parallel with spinner
  const spin = !quiet && format === "text"
    ? spinner(`Querying ${requestedModels.length} models...`)
    : null;

  const responses = await queryAll(prompt, requestedModels);

  spin?.stop(`${c.green("✔")} ${responses.length}/${requestedModels.length} models responded`);

  if (responses.length < 2) {
    console.error("");
    console.error(c.red("✖") + " Less than 2 providers responded successfully.");
    for (const r of responses) {
      if (r.error) console.error(`  ${c.dim(r.provider + ":")} ${r.error}`);
    }
    process.exit(1);
  }

  // Fuse responses
  const result = fuse(responses, threshold);

  // Output
  if (format === "json") {
    console.log(JSON.stringify(result));
  } else {
    printResult(result, verbose, quiet);
  }

  // Exit with code 2 when confidence is below threshold (useful for CI)
  if (result.confidence < threshold) {
    process.exit(2);
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

function printResult(result: FuseResult, verbose: boolean, quiet: boolean) {
  console.log("");
  // The answer
  console.log(result.consensus);
  console.log("");

  // Confidence bar
  const barLen = 30;
  const filled = Math.round(result.confidence * barLen);
  const bar = c.green("█".repeat(filled)) + c.dim("░".repeat(barLen - filled));
  const pct = (result.confidence * 100).toFixed(0);
  const pctColor = result.confidence >= 0.8 ? c.green : result.confidence >= 0.5 ? c.yellow : c.red;

  console.log(`  Confidence: ${bar} ${pctColor(pct + "%")}`);

  // Method badge
  const badges: Record<string, string> = {
    unanimous: c.green("unanimous"),
    majority: c.yellow("majority"),
    "best-effort": c.red("best-effort"),
  };
  console.log(`  Method:     ${badges[result.method]} (${result.agreed.length}/${result.total} models)`);

  // Latency
  if (!quiet) {
    const maxLatency = Math.max(...result.responses.map((r) => r.latencyMs));
    console.log(`  Latency:    ${c.dim(maxLatency + "ms slowest")}`);
  }

  // Verbose: show individual responses
  if (verbose) {
    console.log("");
    console.log(c.dim("  ── Individual responses ──────────────────────"));
    for (const r of result.responses) {
      const inConsensus = result.agreed.includes(r.provider);
      const marker = inConsensus ? c.green("✔") : c.red("✗");
      const truncated = r.text.length > 120 ? r.text.slice(0, 120) + "..." : r.text;
      console.log(`  ${marker} ${c.bold(r.provider)} ${c.dim("(" + r.latencyMs + "ms)")}`);
      console.log(`    ${c.dim(truncated)}`);
      console.log("");
    }

    if (result.outliers.length > 0) {
      console.log(c.dim("  ── Outliers rejected ─────────────────────────"));
      for (const o of result.outliers) {
        const truncated = o.text.length > 100 ? o.text.slice(0, 100) + "..." : o.text;
        console.log(`  ${c.red("✗")} ${c.strikethrough(o.provider)}: ${c.dim(truncated)}`);
      }
      console.log("");
    }
  }

  console.log(c.dim("  ─".padEnd(40, "─")));
  console.log("");
}

function printHelp() {
  console.log(`
  ${c.bold("signal-fuse")} — Ask N models, get 1 truth.

  ${c.dim("─── Usage ───────────────────────────────────────")}

    ${c.cyan("signal-fuse")} ${c.dim("[options]")} ${c.bold("<prompt>")}

  ${c.dim("─── Options ─────────────────────────────────────")}

    ${c.bold("-m, --models")} ${c.dim("<list>")}     Comma-separated providers (auto-detect by default)
    ${c.bold("-t, --threshold")} ${c.dim("<0-1>")}   Similarity threshold for consensus (default: 0.6)
    ${c.bold("-f, --format")} ${c.dim("<fmt>")}      Output format: ${c.cyan("text")} | ${c.cyan("json")}
    ${c.bold("--timeout")} ${c.dim("<sec>")}        Per-provider timeout in seconds (default: 30)
    ${c.bold("-v, --verbose")}               Show individual model responses + outlier analysis
    ${c.bold("-q, --quiet")}                 Suppress headers and metadata
    ${c.bold("-h, --help")}                  Show this help
    ${c.bold("--version")}                   Show version

  ${c.dim("─── Providers ───────────────────────────────────")}

    Set env vars to enable providers (need ${c.bold("at least 2")}):
    ${c.dim("OPENAI_API_KEY")}          → OpenAI (gpt-4o-mini)
    ${c.dim("ANTHROPIC_API_KEY")}       → Anthropic (claude-sonnet-4-20250514)
    ${c.dim("GEMINI_API_KEY")}          → Google (gemini-2.0-flash)
    ${c.dim("MISTRAL_API_KEY")}         → Mistral (mistral-small-latest)
    ${c.dim("DEEPSEEK_API_KEY")}        → DeepSeek (deepseek-chat)
    ${c.dim("GROQ_API_KEY")}            → Groq (llama-3.3-70b-versatile)
    ${c.dim("XAI_API_KEY")}             → xAI (grok-3-mini)
    ${c.dim("OPENROUTER_API_KEY")}      → OpenRouter (auto-routes)

  ${c.dim("─── Examples ────────────────────────────────────")}

    ${c.dim("# Basic — uses all available providers")}
    ${c.cyan("signal-fuse")} "What is the capital of France?"

    ${c.dim("# Specific models with verbose output")}
    ${c.cyan("signal-fuse")} ${c.bold("-m")} openai,anthropic,gemini ${c.bold("-v")} "Explain quantum entanglement"

    ${c.dim("# JSON output for piping")}
    ${c.cyan("signal-fuse")} ${c.bold("-f json")} "Is water wet?" | jq .confidence

    ${c.dim("# Strict consensus (80%+ similarity required)")}
    ${c.cyan("signal-fuse")} ${c.bold("-t 0.8")} "Complex nuanced question..."

    ${c.dim("# Quiet mode — just the answer")}
    ${c.cyan("signal-fuse")} ${c.bold("-q")} "What is 2+2?"
`);
}

main().catch((err) => {
  console.error(c.red("✖ Fatal:") + " " + err.message);
  process.exit(1);
});

// Graceful shutdown on Ctrl+C
process.on("SIGINT", () => {
  console.error(c.dim("\n  Interrupted."));
  process.exit(130);
});
