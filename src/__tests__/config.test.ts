import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Test config validation by importing the module and testing the exported function

describe("config", () => {
  it("returns empty config when no file exists", async () => {
    const { loadConfig } = await import("../config.js");
    const config = loadConfig("/nonexistent/path");
    assert.deepEqual(config, {});
  });

  it("loads valid config file", async () => {
    const dir = join(tmpdir(), `signal-fuse-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "signal-fuse.config.json");
    writeFileSync(path, JSON.stringify({
      threshold: 0.8,
      format: "json",
      providers: ["openai", "anthropic"],
      timeout: 60,
      verbose: true,
      quiet: false,
      models: { openai: "gpt-4o" },
      maxTokens: 2048,
    }));

    const { loadConfig } = await import("../config.js");
    const config = loadConfig(dir);

    assert.equal(config.threshold, 0.8);
    assert.equal(config.format, "json");
    assert.deepEqual(config.providers, ["openai", "anthropic"]);
    assert.equal(config.timeout, 60);
    assert.equal(config.verbose, true);
    assert.equal(config.quiet, false);
    assert.deepEqual(config.models, { openai: "gpt-4o" });
    assert.equal(config.maxTokens, 2048);

    unlinkSync(path);
  });

  it("rejects invalid threshold", async () => {
    const dir = join(tmpdir(), `signal-fuse-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "signal-fuse.config.json");
    writeFileSync(path, JSON.stringify({ threshold: 1.5 }));

    const { loadConfig } = await import("../config.js");
    assert.throws(() => loadConfig(dir), /threshold must be a number between 0 and 1/);

    unlinkSync(path);
  });

  it("rejects invalid format", async () => {
    const dir = join(tmpdir(), `signal-fuse-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "signal-fuse.config.json");
    writeFileSync(path, JSON.stringify({ format: "xml" }));

    const { loadConfig } = await import("../config.js");
    assert.throws(() => loadConfig(dir), /format must be/);

    unlinkSync(path);
  });

  it("rejects invalid providers type", async () => {
    const dir = join(tmpdir(), `signal-fuse-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "signal-fuse.config.json");
    writeFileSync(path, JSON.stringify({ providers: "openai" }));

    const { loadConfig } = await import("../config.js");
    assert.throws(() => loadConfig(dir), /providers must be an array/);

    unlinkSync(path);
  });

  it("rejects non-object config", async () => {
    const dir = join(tmpdir(), `signal-fuse-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "signal-fuse.config.json");
    writeFileSync(path, JSON.stringify("not an object"));

    const { loadConfig } = await import("../config.js");
    assert.throws(() => loadConfig(dir), /must be a JSON object/);

    unlinkSync(path);
  });

  it("rejects invalid JSON", async () => {
    const dir = join(tmpdir(), `signal-fuse-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "signal-fuse.config.json");
    writeFileSync(path, "{ invalid json");

    const { loadConfig } = await import("../config.js");
    assert.throws(() => loadConfig(dir), /Invalid config file/);

    unlinkSync(path);
  });
});
