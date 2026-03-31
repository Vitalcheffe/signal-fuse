/**
 * Config file support.
 * Reads optional signal-fuse.config.json or .signal-fuserc from cwd.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface FuseConfig {
  /** Default providers to use (overrides auto-detect) */
  providers?: string[];
  /** Similarity threshold (0-1) */
  threshold?: number;
  /** Output format */
  format?: "text" | "json";
  /** Per-provider timeout in seconds */
  timeout?: number;
  /** Verbose mode */
  verbose?: boolean;
  /** Quiet mode */
  quiet?: boolean;
  /** Custom model overrides per provider */
  models?: Record<string, string>;
  /** Maximum tokens per response */
  maxTokens?: number;
}

const CONFIG_FILENAMES = [
  "signal-fuse.config.json",
  ".signal-fuserc",
  ".signal-fuserc.json",
];

export function loadConfig(cwd: string = process.cwd()): FuseConfig {
  for (const filename of CONFIG_FILENAMES) {
    const path = resolve(cwd, filename);
    if (!existsSync(path)) continue;

    try {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw);
      return validateConfig(parsed);
    } catch (err: any) {
      if (err.code === "ENOENT") continue;
      throw new Error(`Invalid config file ${filename}: ${err.message}`);
    }
  }
  return {};
}

function validateConfig(raw: unknown): FuseConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Config must be a JSON object");
  }
  const config = raw as Record<string, unknown>;
  const result: FuseConfig = {};

  if (config.providers !== undefined) {
    if (!Array.isArray(config.providers) || !config.providers.every((p: unknown) => typeof p === "string")) {
      throw new Error("providers must be an array of strings");
    }
    result.providers = config.providers;
  }

  if (config.threshold !== undefined) {
    if (typeof config.threshold !== "number" || config.threshold < 0 || config.threshold > 1) {
      throw new Error("threshold must be a number between 0 and 1");
    }
    result.threshold = config.threshold;
  }

  if (config.format !== undefined) {
    if (config.format !== "text" && config.format !== "json") {
      throw new Error("format must be 'text' or 'json'");
    }
    result.format = config.format;
  }

  if (config.timeout !== undefined) {
    if (typeof config.timeout !== "number" || config.timeout < 1) {
      throw new Error("timeout must be a positive number of seconds");
    }
    result.timeout = config.timeout;
  }

  if (config.verbose !== undefined) {
    if (typeof config.verbose !== "boolean") {
      throw new Error("verbose must be a boolean");
    }
    result.verbose = config.verbose;
  }

  if (config.quiet !== undefined) {
    if (typeof config.quiet !== "boolean") {
      throw new Error("quiet must be a boolean");
    }
    result.quiet = config.quiet;
  }

  if (config.models !== undefined) {
    if (typeof config.models !== "object" || config.models === null || Array.isArray(config.models)) {
      throw new Error("models must be an object mapping provider names to model IDs");
    }
    result.models = config.models as Record<string, string>;
  }

  if (config.maxTokens !== undefined) {
    if (typeof config.maxTokens !== "number" || config.maxTokens < 1) {
      throw new Error("maxTokens must be a positive number");
    }
    result.maxTokens = config.maxTokens;
  }

  return result;
}
