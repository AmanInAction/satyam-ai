# SatyamAI — Scam & Misinformation Checker

SatyamAI helps people assess suspicious messages, URLs, screenshots (when enabled), and viral claims. It combines deterministic signals, reputation checks, source retrieval, and AI-assisted interpretation to explain potential risk, evidence, uncertainty, and next steps.

## Important product boundary

SatyamAI is an advisory decision-support tool. It does not guarantee that a message or website is safe, prove that a payment settled, authenticate every screenshot/document, or determine factual truth without evidence. “No evidence found” is not “safe.”

## Read the docs in this order

1. [`SOURCE_OF_TRUTH.md`](./SOURCE_OF_TRUTH.md) — authoritative product requirements, priorities, architecture, safety, and agent workflow.
2. [`DEVELOPMENT_ROADMAP.md`](./DEVELOPMENT_ROADMAP.md) — phased next steps and acceptance gates.
3. [`docs/COMPETITIVE_GAP_ANALYSIS.md`](./docs/COMPETITIVE_GAP_ANALYSIS.md) — differentiators, competitor-inspired gaps, and scope decisions.
4. [`docs/AGENT_NEXT_STEPS.md`](./docs/AGENT_NEXT_STEPS.md) — actionable instructions for the coding agent.
5. [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) — expected endpoint and response behavior; synchronize with implemented Zod schemas.
6. [`docs/TEST_PLAN.md`](./docs/TEST_PLAN.md) — test strategy, evaluation, and release gates.
7. [`docs/DECISIONS.md`](./docs/DECISIONS.md) — architecture and product decisions.

## Architecture baseline

- Full-stack Next.js App Router and TypeScript.
- Route Handlers under `/api/v1`.
- Zod validation.
- Modular analysis orchestrator and server-only provider adapters.
- Amazon Bedrock as the chosen LLM platform, behind a replaceable adapter.
- Vitest for automated tests.

Do not reintroduce Express, Vite, or a separate FastAPI service without an explicitly approved decision record. The current repository—not a generic template—determines exact scripts and paths.

## Integrations

Potential provider categories:
- AI: Amazon Bedrock.
- Evidence: Google Fact Check Tools and/or a suitable web-search provider.
- URL reputation: Google Safe Browsing, VirusTotal, or another evaluated provider.
- OCR/vision: Bedrock vision model or a suitable OCR implementation.

Before connecting a provider, verify current official API docs, model availability in the intended AWS region, pricing, quotas, privacy terms, required secrets, and fallback behavior. Never expose credentials in browser code. Keep mocks visibly separate from real results.

## Local development

Use the scripts that actually exist in `package.json`. At minimum, the coding agent must verify and document:
- dependency installation;
- development server startup;
- lint/type-check command;
- test command;
- production build;
- required environment variables.

Do not guess commands or mark them verified without running them.

## Agent rules

Read the docs above, inspect current code, map requirements to implemented/partial/missing/blocked/deferred, then work on the highest-priority missing requirement. Update docs when schemas or decisions change. Report actual test outcomes and limitations honestly.
