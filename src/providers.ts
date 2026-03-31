/**
 * Multi-provider LLM query layer.
 * Zero dependencies — uses native fetch + each provider's chat completions API.
 */

import type { ProviderResponse } from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;

interface ProviderConfig {
  name: string;
  apiKey: string;
  url: string;
  model: string;
  transformRequest: (prompt: string) => unknown;
  extractResponse: (data: unknown) => string;
}

export type ProviderOptions = {
  /** Custom model override per provider */
  models?: Record<string, string>;
  /** Max tokens per response */
  maxTokens?: number;
};

function getProviders(requested: string[], opts: ProviderOptions = {}): ProviderConfig[] {
  const maxTokens = opts.maxTokens ?? 1024;
  const customModels = opts.models ?? {};

  const all: (ProviderConfig | null)[] = [
    process.env.OPENAI_API_KEY ? (() => {
      const model = customModels.openai ?? "gpt-4o-mini";
      return {
        name: "openai",
        apiKey: process.env.OPENAI_API_KEY,
        url: "https://api.openai.com/v1/chat/completions",
        model,
        transformRequest: (prompt: string) => ({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0,
        }),
        extractResponse: (data: any) => data.choices?.[0]?.message?.content ?? "",
      };
    })() : null,

    process.env.ANTHROPIC_API_KEY ? (() => {
      const model = customModels.anthropic ?? "claude-sonnet-4-20250514";
      return {
        name: "anthropic",
        apiKey: process.env.ANTHROPIC_API_KEY,
        url: "https://api.anthropic.com/v1/messages",
        model,
        transformRequest: (prompt: string) => ({
          model,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
        }),
        extractResponse: (data: any) => data.content?.[0]?.text ?? "",
      };
    })() : null,

    process.env.GEMINI_API_KEY ? (() => {
      const model = customModels.gemini ?? "gemini-2.0-flash";
      return {
        name: "gemini",
        apiKey: process.env.GEMINI_API_KEY,
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        model,
        transformRequest: (prompt: string) => ({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0 },
        }),
        extractResponse: (data: any) => data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
      };
    })() : null,

    process.env.MISTRAL_API_KEY ? (() => {
      const model = customModels.mistral ?? "mistral-small-latest";
      return {
        name: "mistral",
        apiKey: process.env.MISTRAL_API_KEY,
        url: "https://api.mistral.ai/v1/chat/completions",
        model,
        transformRequest: (prompt: string) => ({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0,
        }),
        extractResponse: (data: any) => data.choices?.[0]?.message?.content ?? "",
      };
    })() : null,

    process.env.GROQ_API_KEY ? (() => {
      const model = customModels.groq ?? "llama-3.3-70b-versatile";
      return {
        name: "groq",
        apiKey: process.env.GROQ_API_KEY,
        url: "https://api.groq.com/openai/v1/chat/completions",
        model,
        transformRequest: (prompt: string) => ({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0,
        }),
        extractResponse: (data: any) => data.choices?.[0]?.message?.content ?? "",
      };
    })() : null,

    process.env.DEEPSEEK_API_KEY ? (() => {
      const model = customModels.deepseek ?? "deepseek-chat";
      return {
        name: "deepseek",
        apiKey: process.env.DEEPSEEK_API_KEY,
        url: "https://api.deepseek.com/v1/chat/completions",
        model,
        transformRequest: (prompt: string) => ({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0,
        }),
        extractResponse: (data: any) => data.choices?.[0]?.message?.content ?? "",
      };
    })() : null,

    process.env.XAI_API_KEY ? (() => {
      const model = customModels.xai ?? "grok-3-mini";
      return {
        name: "xai",
        apiKey: process.env.XAI_API_KEY,
        url: "https://api.x.ai/v1/chat/completions",
        model,
        transformRequest: (prompt: string) => ({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0,
        }),
        extractResponse: (data: any) => data.choices?.[0]?.message?.content ?? "",
      };
    })() : null,

    process.env.OPENROUTER_API_KEY ? (() => {
      const model = customModels.openrouter ?? "meta-llama/llama-3.3-70b-instruct:free";
      return {
        name: "openrouter",
        apiKey: process.env.OPENROUTER_API_KEY,
        url: "https://openrouter.ai/api/v1/chat/completions",
        model,
        transformRequest: (prompt: string) => ({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0,
        }),
        extractResponse: (data: any) => data.choices?.[0]?.message?.content ?? "",
      };
    })() : null,
  ];

  const available = all.filter(Boolean) as ProviderConfig[];

  if (requested.length > 0) {
    return available.filter((p) => requested.includes(p.name));
  }
  return available;
}

async function queryProvider(config: ProviderConfig, prompt: string): Promise<ProviderResponse> {
  const start = performance.now();

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // Anthropic uses x-api-key, others use Bearer
  if (config.name === "anthropic") {
    headers["x-api-key"] = config.apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (config.name === "gemini") {
    // API key is in the URL
  } else {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  // OpenRouter attribution headers
  if (config.name === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/Vitalcheffe/signal-fuse";
    headers["X-Title"] = "signal-fuse";
  }

  const body = JSON.stringify(config.transformRequest(prompt));
  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const res = await fetch(config.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        lastError = `HTTP ${res.status}: ${errText.slice(0, 200)}`;
        // Don't retry on 4xx client errors (auth, bad request, etc.)
        if (res.status >= 400 && res.status < 500) break;
        continue;
      }

      const data = await res.json();
      const text = config.extractResponse(data);

      if (!text) {
        return {
          provider: config.name,
          text: "",
          latencyMs: Math.round(performance.now() - start),
          error: "Empty response from provider",
        };
      }

      return {
        provider: config.name,
        text: text.trim(),
        latencyMs: Math.round(performance.now() - start),
      };
    } catch (err: any) {
      lastError = err.name === "AbortError"
        ? `Timeout after ${DEFAULT_TIMEOUT_MS}ms`
        : err.message || "Unknown error";
    }
  }

  return {
    provider: config.name,
    text: "",
    latencyMs: Math.round(performance.now() - start),
    error: lastError,
  };
}

export async function queryAll(
  prompt: string,
  requested: string[],
  opts: ProviderOptions = {},
): Promise<ProviderResponse[]> {
  const providers = getProviders(requested, opts);
  if (providers.length === 0) return [];

  const results = await Promise.allSettled(
    providers.map((p) => queryProvider(p, prompt)),
  );

  return results
    .map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { provider: providers[i].name, text: "", latencyMs: 0, error: r.reason?.message ?? "Rejected" },
    )
    .filter((r) => !r.error);
}
