# Contributing to PandaCineForge 🐼

First off — **thank you** for taking the time to contribute! 🎉

PandaCineForge is the world's first skill-forging engine built for **AI Agents** in film & video production. The single most important principle for any contribution:

> **Keep it AI-first.** Skills are consumed by AI Agents, not humans. Outputs are structured `SkillAsset`s, not Markdown for people.

## 🧭 Ways to contribute

- 🐛 **Report bugs** — [open a bug report](./.github/ISSUE_TEMPLATE/bug_report.md)
- ✨ **Suggest features** — [open a feature request](./.github/ISSUE_TEMPLATE/feature_request.md)
- 🎬 **Add cinema-domain knowledge** — new seed sources, Topic rules, domain packs
- 🔧 **Improve the engine** — recall layers, forging, QA gate
- 📖 **Improve docs** — especially usage examples & translations
- 🌐 **Translate** — help us reach more AI-builders worldwide

## 🚀 Getting started

1. **Fork** the repo and clone your fork.
2. The engine lives in a single self-contained file: [`panda_cineforge.skill.md`](./panda_cineforge.skill.md). It embeds:
   - `panda_cineforge.py` — the engine body (inside the `### 内嵌引擎代码` code block)
   - `system_message.txt`, `user_message_template.txt`, `input_schema.json`, `render_template.md`
3. (Optional) Install deps to run the full pipeline:
   ```bash
   pip install "scrapling[all]" openai pyyaml jsonschema jinja2
   scrapling install
   ```
4. Create a branch: `git checkout -b feat/my-feature`.

## 🧪 Before you submit a PR

- **Self-test**: the skill.md ships with an embedded self-test entry (`if __name__ == "__main__"` section). Make sure it passes.
- **Degradation safety**: if you touch a code path that depends on an optional package (`openai`/`scrapling`/`yaml`/`jsonschema`/`jinja2`), verify it **still runs with that package missing**. The engine must never crash on a missing dependency.
- **Contract stability**: the AI-to-AI `serve()` contract (`call_id`, `route_fields`, `status`, `skills`, `workflow`) is a public API. Changes must be backward-compatible or clearly flagged as a breaking change in the PR.
- **Cinema-vertical**: keep knowledge bases, Topic rules, and seed sources cinema-focused (cinema / short_video / ai_manga_drama).

## 📝 Commit & PR conventions

- Use clear commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Reference issues in your PR description (`Closes #123`).
- Fill in the [PR template](./.github/PULL_REQUEST_TEMPLATE.md).

## 🏗️ Architecture refresher (where things live)

| Concern | Location in `panda_cineforge.py` |
|---|---|
| Unified asset object | `class SkillAsset` (Layer 0) |
| External knowledge fetch | `ExternalKnowledgeFetcher` + 7 sub-modules (Layer 1) |
| Forging pipeline | `SkillForgeEngine` + `MultiStageForger` + 4 sub-layers |
| Index & recall | `SkillIndexer` + `RecallEngine` (R0–R5) |
| Ranking | `RankingOptimizer` |
| Orchestration | `Orchestrator` (multi-system dispatch) |
| QA gate | `QAGate` (11-dimension scoring) |
| Contract | `ContractGateway` (AI-AI protocol) |
| Main engine | `class PandaCineForge` (assembles Layer 0–7) |

## 💬 Questions?

Open a [Discussion](https://github.com/GeniusDapeng/panda-cineforge/discussions) — happy to help.

By participating, you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

— Built with 🐼 by [GeniusDapeng](https://github.com/GeniusDapeng)
