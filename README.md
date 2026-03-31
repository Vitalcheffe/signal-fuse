<div align="center">

# signal-fuse

### Ask 3 models, get 1 truth.

BFT-inspired multi-LLM consensus CLI. Query multiple AI models in parallel, detect outlier responses, return a single confidence-scored answer.

<img src="https://img.shields.io/badge/TypeScript-5.3+-3178C6?logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/Dependencies-0-brightgreen" />
<img src="https://img.shields.io/badge/License-MIT-blue" />

</div>

---

## The Problem

You ask GPT-4 a question. It says "yes." You ask Claude the same question. It says "no." Who's right?

Most people pick one model and trust it. That's like asking one sensor and hoping it's not lying.

## The Solution

signal-fuse queries **N models in parallel** and uses **Byzantine fault tolerance** (the same math used in distributed systems and sensor fusion) to find consensus. Outlier responses are rejected. You get one answer with a confidence score.

```
$ signal-fuse "What is the melting point of tungsten?"

Tungsten has a melting point of 3,422°C (6,192°F), making it the
highest melting point of any metal.

Confidence: ██████████████████████████████ 96%
Method: Unanimous (3/3 models)
```

## Install

```bash
npm install -g signal-fuse
# or
npx signal-fuse "your question"
```

## Setup

Set at least 2 API keys as environment variables:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GEMINI_API_KEY="..."
```

Supported providers: OpenAI, Anthropic, Gemini, Mistral, Groq, DeepSeek, xAI, OpenRouter

## Usage

```bash
# Basic — auto-detect available providers
signal-fuse "What is the capital of France?"

# Specific models
signal-fuse -m openai,anthropic,gemini "Explain quantum entanglement"

# JSON output (for piping)
signal-fuse -f json "Is water wet?" | jq .confidence

# Verbose — see all responses + outlier analysis
signal-fuse -v "Should I use microservices?"

# Custom threshold (0-1, default 0.6)
signal-fuse -t 0.8 "Complex nuanced question..."
```

## How It Works

1. **Parallel query** — All providers are queried simultaneously via native `fetch`
2. **Text normalization** — Responses are lowercased, punctuation-stripped
3. **Bigram extraction** — Word-level bigrams create a "fingerprint" of each response
4. **Jaccard similarity** — Pairwise similarity computed between all responses
5. **Majority clustering** — Response with most similar neighbors wins
6. **Confidence** = agreement_ratio × average_similarity

This is a simplified version of the Byzantine fault tolerance algorithm used in [Aegis](https://github.com/Vitalcheffe/Aegis) for drone swarm sensor fusion (Median Absolute Deviation, 2/3 quorum).

## Why Not Just Use One Model?

| Scenario | 1 Model | signal-fuse |
|----------|---------|-------------|
| Model has outdated data | Silent wrong answer | Outlier rejected |
| Model hallucinates | You trust it | Other models disagree |
| Question is ambiguous | One interpretation | Consensus on clearest |
| All models agree | ✓ | ✓ + high confidence |

## Supported Providers

| Provider | Env Var | Default Model |
|----------|---------|---------------|
| OpenAI | `OPENAI_API_KEY` | gpt-4o-mini |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |
| Gemini | `GEMINI_API_KEY` | gemini-2.0-flash |
| Mistral | `MISTRAL_API_KEY` | mistral-small-latest |
| Groq | `GROQ_API_KEY` | llama-3.3-70b-versatile |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat |
| xAI | `XAI_API_KEY` | grok-3-mini |

## License

MIT
