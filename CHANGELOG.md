# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-03-31

### Added
- Core BFT-inspired consensus engine (Jaccard bigram similarity)
- Multi-provider parallel querying (OpenAI, Anthropic, Gemini, Mistral, Groq, DeepSeek, xAI)
- Auto-detection of available providers from env vars
- Colored terminal output with spinner
- `--verbose` mode showing individual responses and outlier analysis
- `--format json` for piping
- `--quiet` mode for scripting
- `--threshold` for customizing consensus strictness
- Full test suite for consensus engine
- TypeScript types exported as library
- GitHub Actions CI
