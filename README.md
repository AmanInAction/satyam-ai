# Scam & Misinformation Checker

A web application to help users assess suspicious messages, URLs, and eventually screenshots. It combines deterministic indicators, AI-assisted analysis, and evidence retrieval to provide a cautious assessment, explain the reasons, link available evidence, and suggest next steps.

## Project status

Planning baseline dated October 13, 2026. Target submission window: November 13–14, 2026. Check the roadmap for current phase status; do not infer completion from the planned dates.

## Documentation

- [`SOURCE_OF_TRUTH.md`](./SOURCE_OF_TRUTH.md) — authoritative product requirements, architecture constraints, security/privacy expectations, and agent workflow.
- [`DEVELOPMENT_ROADMAP.md`](./DEVELOPMENT_ROADMAP.md) — phased implementation plan, target dates, and acceptance criteria.
- [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) — initial API contract proposal; update to match the implemented OpenAPI schema.
- [`docs/TEST_PLAN.md`](./docs/TEST_PLAN.md) — test strategy and release gates.
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — record of material architecture and product decisions.

## Baseline architecture

- Frontend: Next.js + Tailwind CSS.
- API: Python + FastAPI.
- AI: provider adapter; initial planning spreadsheet proposed Claude Sonnet/Haiku.
- Evidence: Google Fact Check Tools and/or a web-search provider such as Tavily or Brave.
- URL reputation: Google Safe Browsing and/or VirusTotal.
- Persistence: PostgreSQL/Supabase only where needed.
- Cache: optional Redis/Upstash, only when justified.
- Deployment: Vercel for frontend; Render or Railway for API are initial options.

Provider selection must account for current API contracts, available credentials, pricing, quotas, privacy terms, and fallback behavior. Keep integrations behind adapters to reduce lock-in.

## Local development

The exact commands depend on the repository audit and implemented scripts. The agent must update this section after inspecting the repository. Do not copy guessed commands into production instructions.

Typical intended layout:

```text
frontend/          Next.js application
backend/           FastAPI application
docs/
  API_CONTRACT.md
  DECISIONS.md
  TEST_PLAN.md
SOURCE_OF_TRUTH.md
DEVELOPMENT_ROADMAP.md
README.md
```

## Product safety note

This tool provides decision support, not a guarantee that a message or website is safe or that a claim is true/false. It must distinguish lack of evidence from evidence of safety, show source links where available, and state limitations clearly.
