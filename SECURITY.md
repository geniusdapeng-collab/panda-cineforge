# Security Policy

## Supported Versions

PandaCineForge is at v1.0.0. Security fixes are applied to the latest release.

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | ✅                 |
| < 1.0   | ❌ (pre-release)   |

## Reporting a Vulnerability

The PandaCineForge engine fetches external knowledge from the web (search APIs + Scrapling crawler) and calls LLM providers. If you find a security issue — especially around:

- **Web crawling safety** (SSRF, malicious seed-source handling, unbounded fetches),
- **LLM / prompt-injection** exposure when forging skills from untrusted external content,
- **Credential handling** (API keys read from environment variables),
- **Supply-chain** concerns in optional dependencies (`scrapling[all]`, `openai`, etc.),

please report it **privately**. Do **not** open a public issue.

- Open a **private security advisory** via GitHub: `Security` tab → `Report a vulnerability`.
- Or contact the maintainer **GeniusDapeng** directly through GitHub.

Please include:
- A clear description of the issue and its impact.
- Steps to reproduce (proof-of-concept if possible).
- The version you tested against.

You should receive an initial response within **72 hours**. Please do not disclose the vulnerability publicly until a fix is released.

## Hardening recommendations for deployers

- **Pin your dependencies** and audit `scrapling[all]` transitive deps regularly.
- **Sandbox the engine** when running Cold Forge (it performs live web crawling). A container/VM with egress allow-listing to the `CINEMA_SEED_SOURCES` whitelist is recommended.
- **Never commit API keys**. Use environment variables or a secrets manager.
- Treat externally-fetched knowledge as **untrusted input** — the engine filters and confidence-gates it, but downstream Agents should still validate before executing high-stakes actions.

## Scope

This policy covers the PandaCineForge engine in this repository. Issues in downstream production systems or third-party dependencies should be reported to their respective maintainers.
