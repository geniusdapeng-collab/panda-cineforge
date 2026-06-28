# Changelog

All notable changes to **PandaCineForge** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2025-06-28 🎉 First Public / Open-Source Release

### 🎉 Highlights
The first open-source release of the **world's first skill-forging engine built for AI Agents in film & video production**. A system-agnostic foundational base layer that fuses skill forging (production) and skill recall & orchestration (consumption) into a single self-contained engine.

### ✨ Added
- **Dual-mode main pipeline**
  - Cold Forge: batch-generate 80–150 core skills from the `COLD_FORGE_MATRIX` (6 Agents × 3 sub-domains).
  - Hot Runtime: real-time forge on recall miss, with flywheel sedimentation.
- **Layered cascade recall (R0–R5)** — structured routing → semantic vector → context → keyword/Topic → safety → real-time forge fallback.
- **Five-layer skill forging** — Knowledge Source → Knowledge Fusion → Multi-stage Forge → Combinatorial Innovation → Maturity Evolution.
- **Three-stage professionalism guarantee** — confidence gate + lightweight single-pass review + feedback natural selection (v0→v3 maturity).
- **Fully-automated external knowledge acquisition** — 7 sub-modules (`QueryComposer` → `SearchGateway` → `SourceRouter` → `CrawlDispatcher` → `ContentExtractor` → `KnowledgeFilter` → `KnowledgeCache`).
  - 7 search providers auto-detected at runtime (Bing, Google CSE, SerpAPI, Brave, Tavily, DuckDuckGo, SearXNG).
  - 40+ curated cinema seed sources across 6 trust categories.
  - 3 Scrapling sessions (`fast` / `stealth` / `dynamic`).
- **Unified `SkillAsset`** — production-side output and consumption-side recall converge to a single object (zero adapter layer).
- **Fixed AI-to-AI contract** — `ContractGateway` enforces a structured protocol between caller Agent and engine.
- **Multi-system Agent orchestration** — `module_target` namespace dispatch to any production system (system-agnostic).
- **Cinema-vertical** — three sub-domains (`cinema` / `short_video` / `ai_manga_drama`), 50+ Topics, 40+ seed sources.
- **11-dimension QA gate**.
- **Graceful degradation** — engine never crashes on missing optional dependencies (`openai`/`scrapling`/`yaml`/`jsonschema`/`jinja2`).
- Embedded self-test suite.

### 🔧 Internal
- Single-engine architecture unifying production (forging) and consumption (recall & orchestration); layered cascade R0–R5 design.

## [Unreleased]

_Planned: more sub-domain packs, additional search providers, optional vector-store backend, English-localized SystemMessage._

[1.0.0]: https://github.com/GeniusDapeng/panda-cineforge/releases/tag/v1.0.0
