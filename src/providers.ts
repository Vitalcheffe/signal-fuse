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

function getProviders(requested: string[]): ProviderConfig[] {
  const all: (ProviderConfig | null)[] = [
    process.env.OPENAI_API_KEY ? {
      name: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      url: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
      transformRequest: (prompt) => ({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0,
      }),
      extractResponse: (data: any) => data.choices?.[0]?.message?.content ?? "",
    } : null,

    process.env.ANTHROPIC_API_KEY ? {
      name: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      url: "https://api.anthropic.com/v1/messages",
      model: "claude-sonnet-4-20250514",
      transformRequest: (prompt) => ({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      }),
      extractResponse: (data: any) => data.content?.[0]?.text ?? "",
    } : null,

    process.env.GEMINI_API_KEY ? {
      name: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      model: "gemini-2.0-flash",
      transformRequest: (prompt) => ({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0 },
      }),
      extractResponse: (data: any) => data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    } : null,

    process.env.MISTRAL_API_KEY ? {
      name: "mistral",
      apiKey: process.env.MISTRAL_API_KEY,
      url: "https://api.mistral.ai/v1/chat/completions",
      model: "mistral-small-latest",
      transformRequest: (prompt) => ({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0,
      }),
      extractResponse: (data: any) => data.choices?.[0]?.message?.content ?? "",
    } : null,

    process.env.GROQ_API_KEY ? {
      name: "groq",
      apiKey: process.env.GROQ_API_KEY,
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.3-70b-versatile",
      transformRequest: (prompt) => ({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0,
      }),
      extractResponse: (data: any) => data.choices?.[0]?.message?.content ?? "",
    } : null,

    process.env.DEEPSEEK_API_KEY ? {
      name: "deepseek",
      apiKey: process.env.DEEPSEEK_API_KEY,
      url: "https://api.deepseek.com/v1/chat/completions",
      model: "deepseek-chat",
      transformRequest: (prompt) => ({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0,
      }),
      extractResponse: (data: any) => data.choices?.[0]?.message?.content ?? "",
    } : null,

    process.env.XAI_API_KEY ? {
      name: "xai",
      apiKey: process.env.XAI_API_KEY,
      url: "https://api.x.ai/v1/chat/completions",
      model: "grok-3-mini",
      transformRequest: (prompt) => ({
        model: "grok-3-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0,
      }),
      extractResponse: (data: any) => data.choices?.[0]?.message?.content ?? "",
    } : null,

    process.env.OPENROUTER_API_KEY ? {
      name: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "auto",
      transformRequest: (prompt) => ({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0,
      }),
      extractResponse: (data: any) => data.choices?.[0]?.message?.content ?? "",
    } : null,
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
): Promise<ProviderResponse[]> {
  const providers = getProviders(requested);
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
