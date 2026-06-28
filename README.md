<div align="center">

# 🐼 PandaCineForge

### The World's First Skill-Forging Engine Built for AI Agents in Film & Video Production

**全球首个面向 AI Agent 的影视创作技能生成引擎**

*A single-file, self-contained skill engine that forges, recalls & orchestrates cinematic skills — for AI Agents, not humans.*

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](./LICENSE)
[![Python 3.8+](https://img.shields.io/badge/Python-3.8+-3776AB.svg)](https://www.python.org/)
[![Version](https://img.shields.io/badge/version-1.0.0-FF6B35.svg)](#)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-FF6B35.svg)](./CONTRIBUTING.md)
[![Made for AI Agents](https://img.shields.io/badge/Made%20for-AI%20Agents-9B59B6.svg)](#-why-built-for-ai-agents-not-humans)
[![Stars](https://img.shields.io/badge/⭐-Star%20if%20useful-FFD700.svg)](#-support)

**[English](#-overview) · [中文](#-中文概述)**

</div>

<p align="center">
  <img src="./assets/hero_banner.png" alt="PandaCineForge — Hero Banner" width="100%">
</p>

---

> ### 💡 The one-line pitch
> **PandaCineForge is a skill engine *for AI*. It forges professional cinematic skills and serves them to AI Agents through a structured contract — so your AI video-making agents stop guessing and start executing industry-grade workflows.**

---

## 🌍 Overview

Most "skill" / "prompt" tools are built **for humans**: they output Markdown a person reads. PandaCineForge is built **for AI Agents**: it outputs a **structured `SkillAsset`** that an Agent can execute directly, through a **fixed AI-to-AI contract**.

It is the **world's first skill-generation engine purpose-built for the AI filmmaking domain** — a foundational base layer that powers any AI video-production system by giving its Agents on-demand, professionally-forged, self-evolving skills.

PandaCineForge fuses **skill forging (production)** and **skill recall & orchestration (consumption)** into a single engine, unified by one object: the **`SkillAsset`** — where *production output* and *consumption input* finally converge, with **zero adapter layer**.

### What it does, in one diagram

```
            ┌─────────────────────────────────────────────┐
            │            AI Agent (caller)                 │
            │   "I need a color script for Act 1"          │
            └───────────────────┬─────────────────────────┘
                                │  fixed structured contract
                                ▼
            ┌─────────────────────────────────────────────┐
            │            PandaCineForge                    │
            │  R0→R1→R2→R3→R4→R5  layered cascade recall  │
            │     (miss? → real-time Hot Forge)            │
            └───────────────────┬─────────────────────────┘
                                │  structured SkillAsset[]
                                ▼
            ┌─────────────────────────────────────────────┐
            │   AI Agent executes the skill directly      │
            │   (no human in the loop, no Markdown parsing)│
            └─────────────────────────────────────────────┘
```

---

## 🤖 Why: Built for AI Agents, not humans

This is the single most important thing to understand about PandaCineForge. **It is a skill engine *for AI*. The skills it generates are *consumed by AI Agents*.**

| Dimension | Legacy tools (built for humans) | PandaCineForge (built for AI) |
|---|---|---|
| **Query shape** | Vague natural language | Structured contract + `route_fields` exact routing |
| **Retrieval** | 7 parallel channels, full scan | **R0–R5 layered cascade**, return on first hit |
| **Output** | Human-readable Markdown | **Structured `SkillAsset`**, AI-executable |
| **Professionalism** | Single LLM shot | Dual knowledge source + 3-stage guarantee + feedback flywheel |
| **Asset object** | generator output ≠ orchestrator input | **Unified `SkillAsset`**, production≈consumption |
| **Knowledge** | Model's internal knowledge only | Internal + **real-time external fetch** (search + Scrapling) |
| **Evolution** | One-shot | **v0→v3 maturity** + natural selection + knowledge reflux |

> If your "AI filmmaking" stack still has Agents reading Markdown prompts written for humans, you're doing it the slow way. PandaCineForge is the base layer that fixes that.

---

## ✨ Features

### 🏗️ Dual-mode main pipeline
- **Cold Forge** — batch-generate **80–150 core skills** from the full-domain matrix at system init / project kickoff, so runtime recall has **zero generation latency**.
- **Hot Runtime** — when recall misses at runtime, **forge in real time** and immediately sediment the new skill back into the index (**flywheel feedback**).

### 🔎 Layered cascade recall (R0–R5)
| Layer | Name | Mechanism | Latency |
|---|---|---|---|
| R0 | Structured exact routing | filter by `module_target` + `cinematic_role` + `deliverable_type` + `project_stage` + `sub_domain` | <1ms |
| R1 | Semantic vector recall | ANN over `SkillAsset` embeddings (core layer) | <10ms |
| R2 | Context recall | predictive recall from caller context (project type / stage / upstream-downstream skills) | <5ms |
| R3 | Keyword / Topic supplement | BM25 + Topic Match + Slot Match | <10ms |
| R4 | Safety fallback | copyright / review / crash / loss emergency bottom-line | <5ms |
| R5 | Real-time forge fallback | trigger `SkillForgeEngine`, forge-and-sediment | async |

`recall_mode=fast` runs R0+R1 (speed); `recall_mode=full` runs R0–R5 (coverage). During R5, a degraded answer is returned first — **the main pipeline never blocks**.

### 🔩 Five-layer skill forging
`Knowledge Source → Knowledge Fusion → Multi-stage Forge → Combinatorial Innovation → Maturity Evolution`

### 🛡️ Three-stage professionalism guarantee
1. **Knowledge-confidence gate** — high-confidence sources (mainstream standards) skip review, directly reach `v2`.
2. **Lightweight single-pass review** — for medium-confidence skills (minority).
3. **Feedback natural selection** — the ultimate arbiter: 3 consecutive passes → `v3`; 2 consecutive fails → demote.

### 🌐 Fully-automated external knowledge acquisition (7 sub-modules)
`QueryComposer → SearchGateway → SourceRouter → CrawlDispatcher(Scrapling) → ContentExtractor → KnowledgeFilter → KnowledgeCache`
- **7 search providers** auto-detected at runtime: Bing, Google CSE, SerpAPI, Brave, Tavily, DuckDuckGo, SearXNG.
- **40+ curated cinema seed sources** (SMPTE, ACES, ITU, Netflix partners, Blackmagic, Adobe, Blender, Foundry, Midjourney, Runway, OpenAI, Kling, arXiv, SIGGRAPH, …) across 6 trust categories.
- **3 Scrapling sessions** — `fast` (Chrome HTTP/3) / `stealth` (Cloudflare-solving) / `dynamic` (network-idle headless).

### 📦 Unified `SkillAsset` & fixed contract
An **AI-to-AI structured protocol**. The caller sends a request per schema; the engine returns a structured `SkillAsset[]` the Agent executes directly. Production-side output and consumption-side recall **converge to the same object — no adapter layer**.

### 🎬 Multi-system Agent orchestration
`module_target` supports multi-system namespaces (`SystemName.AgentName`). After recall, TopK skills are **grouped by `module_target` and dispatched** to the corresponding production-system Agents — a true **base layer** powering any video-production system.

### 🎥 Cinema-vertical
Three sub-domains, 50+ Topics, 40+ seed sources:
- **`cinema`** — feature films, SMPTE/Rec.2020/5.1, industrial delivery.
- **`short_video`** — 9:16, 3-sec hooks, completion rate, platform compliance.
- **`ai_manga_drama`** — character consistency, voiceover sync, serialized hooks.

### 🧯 Graceful degradation — never crashes on missing deps
No `openai`? LLM + embedding return empty, index/recall/BM25/Topic still work. No `scrapling`? Crawler falls back to `urllib`. No `yaml`/`jsonschema`/`jinja2`? JSON substitutes. **The engine never crashes because a dependency is missing.**

---

## 🚀 Quick Start

### Install

```bash
# Core deps (ALL optional — engine auto-degrades if missing)
pip install "scrapling[all]" openai pyyaml jsonschema jinja2
scrapling install

# Env vars
export OPENAI_API_KEY=your_key
export OPENAI_MODEL=gpt-4.1
# Search API (pick any, auto-detected at runtime)
export TAVILY_API_KEY=...        # or BING_API_KEY / BRAVE_API_KEY / SERPAPI_API_KEY / GOOGLE_CSE_API_KEY+GOOGLE_CSE_ID
```

### Use (3 steps)

```python
import panda_cineforge as pcf

# 1. Init — extract the engine + configs from skill.md in one command:
#      python extract.py panda_cineforge.skill.md .
#    This produces panda_cineforge.py + 4 config files. Then:
engine = pcf.PandaCineForge(
    system_message=open("system_message.txt").read(),
    user_template=open("user_message_template.txt").read(),
)

# 2. Cold start — batch-forge 80-150 core skills (once, at init)
result = engine.cold_start()
print(result["generated_count"], result["maturity_dist"])

# 3. Hot serve — your AI Agent calls via fixed contract
response = engine.serve({
    "call_id": "call_001",
    "caller_agent": "VisualLanguage",
    "route_fields": {
        "module_target": ["MyStudio.VisualLanguage"],
        "cinematic_role": "visual_language",
        "deliverable_type": "color_script",
        "project_stage": "postproduction",
        "sub_domain": "cinema",
    },
    "context": {"project_id": "proj_001", "project_type": "feature_film",
                "current_task": "Design Act-1 color script"},
    "query_text": "film color grading",
    "recall_mode": "full",   # or "fast"
    "topk": 3,
})
# response.skills  -> structured SkillAsset[], AI executes directly
# response.workflow -> steps grouped by module_target, ready to dispatch
```

> **The skills PandaCineForge returns are NOT for you to read. They are for your AI Agent to execute.** That's the whole point.

📖 Full 6-step workflow (cold start, hot serve, recall layers, feedback flywheel, multi-system orchestration, QA) is documented inside [`panda_cineforge.skill.md`](./panda_cineforge.skill.md#操作指令agent-安装后执行流程).

---

## 🏗️ Architecture

Two "heavyweight" architecture diagrams live in [`/assets`](./assets):

| Diagram | What it shows |
|---|---|
| [`assets/architecture_01_pipeline.png`](./assets/architecture_01_pipeline.png) | End-to-end pipeline: dual-mode Cold/Hot Forge → 5-layer forging → R0–R5 cascade recall → ranking → orchestration → QA gate |
| [`assets/architecture_02_system.png`](./assets/architecture_02_system.png) | System topology: 8 layers (Layer 0 SkillAsset → Layer 7 Contract) + external-knowledge 7-submodule fan-out + multi-system dispatch |

<p align="center">
  <img src="./assets/architecture_01_pipeline.png" alt="PandaCineForge Pipeline Architecture" width="100%">
</p>
<p align="center"><em>Fig 1 — End-to-end forge & recall pipeline</em></p>

<p align="center">
  <img src="./assets/architecture_02_system.png" alt="PandaCineForge System Architecture" width="100%">
</p>
<p align="center"><em>Fig 2 — 8-layer system topology & multi-system orchestration</em></p>

---

## 🧠 How it works

### The flywheel: forge → recall → execute → feedback → evolve

```
   Cold Forge (batch)           Hot Runtime (per call)
        │                              │
        ▼                              ▼
   ┌─────────┐    sediment      ┌──────────────┐
   │ 5-layer │ ───────────────▶ │  Skill Index  │
   │  forge  │                  └──────┬───────┘
   └─────────┘                         │ R0→R5 cascade
                                       ▼
                              ┌──────────────┐  miss?   ┌──────────┐
                              │   Recall     │─────────▶│ Hot Forge│
                              └──────┬───────┘          │ (R5)     │
                                     │ hit              └────┬─────┘
                                     ▼                       │ sediment
                              ┌──────────────┐               │
                              │  AI executes │◀──────────────┘
                              └──────┬───────┘
                                     │ outcome + score
                                     ▼
                              ┌──────────────┐
                              │  Feedback →  │  v0→v3 maturity
                              │  natural sel │  + knowledge reflux
                              └──────────────┘
```

### The 6 Agents × 3 sub-domains cold-start matrix

The engine ships with a **`COLD_FORGE_MATRIX`** that pre-defines core skills across **6 cinematic Agents** and **3 sub-domains**:

| Agent | cinema | short_video | ai_manga_drama |
|---|:---:|:---:|:---:|
| SceneDesign | three-act, hero's journey, beat sheet | hook script, viral copy | episode outline, serialization hooks |
| VisualLanguage | storyboard, color script, lighting | vertical storyboard, visual hook | AI-image storyboard, char-consistency ref |
| AudioDesign | 5.1 mix, Foley, dialogue | BGM, hook SFX | voiceover pacing, lip-sync |
| ContinuityReview | 180° line, match cut | cross-shot continuity | character-drift detection |
| PromptFusion | Midjourney/Runway/Sora/ComfyUI | vertical AI-gen prompts | char-consistency + LoRA lock |
| OpeningDesign | cold/hot open, title sequence | 3-sec open, brand bumper | drama open, recap |

---

## 🌍 Ecosystem

PandaCineForge is a **base layer** — it is *not* any one production system. It is system-agnostic and powers **any** AI video-production stack:

- **Any AI video-production system** — point your Agents at the engine via `module_target` namespaces (e.g. `MyStudio.SceneDesign`, `MyStudio.VisualLanguage`, `MyStudio.AudioDesign`, `MyStudio.ContinuityReview`, `MyStudio.PromptFusion`, `MyStudio.OpeningDesign`).
- **OpenClaw** — Agent platform; install the `skill.md` in one click.
- *…your system here?* The `module_target` namespace is designed for multi-system extensibility. PRs welcome.

---

## 📦 Project Structure

```
panda-cineforge/
├── panda_cineforge.skill.md   # ⭐ The engine — self-contained single file (install this)
├── extract.py                 # One-shot extractor: skill.md → panda_cineforge.py + 4 configs
├── requirements.txt           # Optional deps (all degrade gracefully)
├── README.md                  # You are here (English)
├── README.zh-CN.md            # 中文文档
├── LICENSE                    # Apache-2.0
├── CONTRIBUTING.md            # How to contribute
├── CODE_OF_CONDUCT.md         # Community standards
├── CHANGELOG.md               # Version history
├── SECURITY.md                # Vulnerability reporting
├── .gitignore
├── assets/                    # Architecture diagrams & promo art
│   ├── hero_banner.png
│   ├── architecture_01_pipeline.png
│   └── architecture_02_system.png
├── examples/                  # Usage examples (quickstart.py)
├── docs/                      # MARKETING.md · OPEN_SOURCE_CHECKLIST.md
└── .github/                   # Issue/PR templates, community health
```

---

## 🤝 Contributing

We welcome contributions that keep PandaCineForge **AI-first**. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

- 🐛 [Report a bug](./.github/ISSUE_TEMPLATE/bug_report.md)
- ✨ [Request a feature](./.github/ISSUE_TEMPLATE/feature_request.md)
- 💬 [Start a discussion](https://github.com/GeniusDapeng/panda-cineforge/discussions)
- 🔀 [Open a PR](./.github/PULL_REQUEST_TEMPLATE.md)

---

## 📄 License

**Apache-2.0** — see [`LICENSE`](./LICENSE). Commercial-friendly, with explicit patent grant.

---

## 🌟 Support

If PandaCineForge makes your AI filmmaking Agents smarter, **give it a star ⭐** — it helps other AI-builders discover the project.

[![Star History Chart](https://api.star-history.com/svg?repos=GeniusDapeng/panda-cineforge&type=Date)](https://star-history.com/#GeniusDapeng/panda-cineforge&Date)

---

# 🇨🇳 中文概述

> **如果你更习惯中文，看这一节就够了。完整英文文档见上方。**

## 一句话定位

**PandaCineForge（大熊猫影视创作技能引擎）是给 AI 用的技能引擎。它锻造专业影视技能，通过固定化契约服务于 AI Agent——让你的 AI 视频制作 Agent 不再靠猜，而是直接执行工业级工作流。**

这是**全球首个面向 AI Agent 的影视创作技能生成引擎**，一个通用化支撑底座，为任意 AI 视频制作系统的 Agent 提供按需锻造、自我进化的专业技能。

## 核心特点

- **给 AI 用，不是给人用**：输出结构化 `SkillAsset`，AI 直接执行；AI-AI 结构化契约。
- **双模式主链路**：Cold Forge 冷启动批量预置 80-150 技能 / Hot Runtime 热运行实时生成（飞轮反哺）。
- **R0-R5 分层级联回**：命中即返，未命中实时生成兜底，主链路永不阻塞。
- **五层锻造 + 三段式专业性保障**：知识源→融合→多阶段锻造→组合创新→成熟度进化；置信度门禁 + 轻量评审 + 实战反馈自然选择。
- **外部知识全自动获取**：7 子模块 + Scrapling 爬虫 + 7 种搜索 API + 40+ 影视可信种子源。
- **统一 SkillAsset**：生产侧输出与消费侧召回收敛为同一对象，零适配层。
- **多系统 Agent 编排**：按 `module_target` 分组分发至各类制作系统（通用，不绑定具体系统）。
- **影视垂直化**：cinema / short_video / ai_manga_drama 三大子领域。
- **永不因缺依赖崩溃**：全部依赖可选，缺失自动降级。

## 解决的问题

传统"技能/提示词"工具是**给人看的**（输出 Markdown）；AI Agent 用起来要二次解析、模糊匹配、单次生成质量不稳。PandaCineForge 把这些问题一次性解决：结构化契约精确路由、分层级联回极速召回、双知识源 + 三段式保障保证专业度、统一资产对象消除适配层、实战反馈驱动 v0→v3 成熟度进化。

## 快速开始

```bash
pip install "scrapling[all]" openai pyyaml jsonschema jinja2 && scrapling install
export OPENAI_API_KEY=your_key
```

```python
import panda_cineforge as pcf
engine = pcf.PandaCineForge(system_message=..., user_template=...)
engine.cold_start()                 # 冷启动批量预置
resp = engine.serve(request_dict)   # Agent 热运行调用，返回结构化 SkillAsset
```

> **引擎返回的技能不是给你读的，是给你的 AI Agent 执行的。** 这就是全部要点。

完整使用流程见 [`panda_cineforge.skill.md`](./panda_cineforge.skill.md)。

## 许可证

Apache-2.0，商用友好，含明确专利授权。

## 支持

如果 PandaCineForge 让你的 AI 影视 Agent 更聪明，**点个 Star ⭐**，帮更多 AI 开发者发现它。

---

<div align="center">

<sub>Built with 🐼 by <a href="https://github.com/GeniusDapeng">GeniusDapeng</a> · The first skill engine that speaks <b>AI-to-AI</b> in filmmaking.</sub>

</div>
