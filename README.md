# SatyamAI — Scam & Misinformation Checker

SatyamAI helps people assess suspicious messages, URLs, screenshots (when enabled), and viral claims. It combines deterministic signals, reputation checks, source retrieval, and AI-assisted interpretation to explain potential risk, evidence, uncertainty, and next steps.

## Important product boundary

SatyamAI is an advisory decision-support tool. It does not guarantee that a message or website is safe, prove that a payment settled, authenticate every screenshot/document, or determine factual truth without evidence. “No evidence found” is not “safe.”

## Read the docs in this order

1. [`SOURCE_OF_TRUTH.md`](./SOURCE_OF_TRUTH.md) — canonical product specifications, competitive differentiation, safety, and agent workflow.
2. [`DEVELOPMENT_ROADMAP.md`](./DEVELOPMENT_ROADMAP.md) — phased roadmap, verified release gates, and agent execution playbook.
3. [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) — authoritative endpoint and response schemas (Zod).
4. [`docs/TEST_PLAN.md`](./docs/TEST_PLAN.md) — test strategy, evaluation fixtures, release gates, and feature traceability matrix (F1–F14).
5. [`docs/DECISIONS.md`](./docs/DECISIONS.md) — Architecture and Product Decision Records (ADRs D-001 through D-012).
6. [`docs/REPOSITORY_AUDIT.md`](./docs/REPOSITORY_AUDIT.md) — detailed repository audit, requirement-to-code traceability, and verification evidence.

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
