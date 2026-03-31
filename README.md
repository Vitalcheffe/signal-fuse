<div align="center">

# signal-fuse

### Ask 3 models, get 1 truth.

BFT-inspired multi-LLM consensus. Query multiple AI models in parallel, reject outliers, return a single confidence-scored answer.

<img src="https://img.shields.io/badge/TypeScript-5.3+-3178C6?logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/Dependencies-1-brightgreen" />
<img src="https://img.shields.io/badge/License-MIT-blue" />

</div>

---

## The Problem

You ask GPT-4o a question. It says "yes." You ask Claude the same question. It says "no." Who's right?

Most people pick one model and trust it. That's like driving with one eye closed.

## The Solution

signal-fuse queries **N models in parallel** and uses **Byzantine fault tolerance** (the same math behind distributed consensus systems) to find agreement. Outlier responses are flagged. You get one answer with a confidence score.

```
$ signal-fuse "What is the melting point of tungsten?"

  signal-fuse v1.0.0
  ──────────────────────────────────────
  prompt    What is the melting point of tungsten?
  models    openai, anthropic, gemini

  ✔ 3/3 models responded

Tungsten has a melting point of 3,422°C (6,192°F), making it
the highest melting point of any pure metal.

  Confidence: ██████████████████████████████ 98%
  Method:     unanimous (3/3 models)
  Latency:    1243ms slowest
  ──────────────────────────────────────
```

## Install

```bash
# Global
npm install -g signal-fuse

# Or run directly
npx signal-fuse "your question"
```

## Setup

Set at least **2** API keys as environment variables:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GEMINI_API_KEY="..."
```

| Provider | Env Var | Default Model |
|----------|---------|---------------|
| OpenAI | `OPENAI_API_KEY` | gpt-4o-mini |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |
| Gemini | `GEMINI_API_KEY` | gemini-2.0-flash |
| Mistral | `MISTRAL_API_KEY` | mistral-small-latest |
| Groq | `GROQ_API_KEY` | llama-3.3-70b-versatile |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat |
| xAI | `XAI_API_KEY` | grok-3-mini |
| OpenRouter | `OPENROUTER_API_KEY` | (auto-routes) |

## Usage

```bash
# Auto-detect available providers
signal-fuse "What is the capital of France?"

# Specific models
signal-fuse -m openai,anthropic,gemini "Explain quantum entanglement"

# Verbose — see individual responses + outlier analysis
signal-fuse -v "Should I use microservices or a monolith?"

# JSON output (for piping to jq)
signal-fuse -f json "Is water wet?" | jq '.confidence'

# Strict consensus (80%+ similarity required)
signal-fuse -t 0.8 "Complex nuanced question..."

# Quiet mode — just the answer, no metadata
signal-fuse -q "What is 2+2?"
```

## How It Works

```
Your prompt
    │
    ▼
┌─────────────────────────────────────┐
│  Parallel Query (native fetch)      │
│  ┌───────┐ ┌───────┐ ┌───────┐     │
│  │ OpenAI │ │Anthro.│ │Gemini │     │
│  └───┬───┘ └───┬───┘ └───┬───┘     │
└──────┼─────────┼─────────┼──────────┘
       │         │         │
       ▼         ▼         ▼
┌─────────────────────────────────────┐
│  Normalize → Bigrams → Jaccard     │
│  Pairwise similarity matrix        │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Majority clustering                │
│  Pick largest agreement group       │
│  Reject outliers                    │
└─────────────────────────────────────┘
       │
       ▼
  Consensus + Confidence score
```

1. **Parallel query** — All providers queried simultaneously via `fetch`
2. **Text normalization** — Lowercase, strip punctuation, collapse whitespace
3. **Bigram extraction** — Word-level bigrams create a fingerprint of each response
4. **Jaccard similarity** — Pairwise similarity between all response fingerprints
5. **Majority clustering** — Response with the most similar neighbors wins
6. **Confidence** = agreement_ratio × average_similarity

This is adapted from the Byzantine fault tolerance algorithm used in [Aegis](https://github.com/Vitalcheffe/Aegis) for drone swarm sensor fusion — same math, different domain.

## When to Use This

| Use Case | Why |
|----------|-----|
| **Fact-checking** | Catch hallucinations — if 2 models agree and 1 doesn't, the outlier is probably wrong |
| **Sensitive decisions** | Medical, legal, financial — don't trust one model blindly |
| **Model evaluation** | Compare how different models answer the same question |
| **Automated pipelines** | `signal-fuse -f json "..." \| jq .consensus` — scriptable consensus |
| **Research** | Find questions where models consistently disagree (interesting!) |

## API (Library Usage)

```typescript
import { queryAll, fuse } from "signal-fuse";

const responses = await queryAll("What is the capital of France?", ["openai", "anthropic"]);
const result = fuse(responses, 0.6);

console.log(result.consensus);   // The agreed answer
console.log(result.confidence);  // 0-1 confidence score
console.log(result.method);      // "unanimous" | "majority" | "best-effort"
console.log(result.outliers);    // Responses that disagreed
```

## Algorithm Details

**Jaccard similarity** on word bigrams:
- Tokenize response into word pairs: "the capital of france" → ["the_capital", "capital_of", "of_france"]
- Similarity = |intersection| / |union| of two bigram sets
- Fast, language-agnostic, no external dependencies

**Why not embeddings?**
- Embeddings need an API call per response (cost, latency)
- Bigram Jaccard is zero-dependency, runs in <1ms, and works surprisingly well for factual agreement
- For production use, you could swap in embeddings — the consensus logic is provider-agnostic

## Contributing

Issues and PRs welcome. This is a small, focused tool — keep it that way.

```bash
git clone https://github.com/Vitalcheffe/signal-fuse.git
cd signal-fuse
npm install
npm test
```

## License

MIT
