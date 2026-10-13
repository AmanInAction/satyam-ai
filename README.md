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

- Full-Stack: Next.js App Router with TypeScript and React 19.
- Styling: Tailwind CSS v4.
- API & Route Handlers: Server-side Next.js Route Handlers under `/api/v1/*`.
- Schema Validation: Zod runtime validation (`src/lib/validation/schemas.ts`).
- AI: Server-only provider adapter (Gemini API with Claude/OpenAI adapter compatibility).
- Evidence: Google Fact Check Tools and/or a web-search provider such as Tavily or Brave behind adapters.
- URL reputation: Google Safe Browsing and/or VirusTotal behind adapters.
- Persistence: PostgreSQL only where needed; no raw user messages stored by default.
- Cache: In-memory or optional Redis, only when justified.
- Deployment: Standalone Node.js server (Docker/Render/Railway) or Vercel.

Provider selection must account for current API contracts, available credentials, pricing, quotas, privacy terms, and fallback behavior. Keep integrations behind adapters to reduce lock-in.

## Local development

Verified commands following the architecture migration to full-stack Next.js:

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Run automated tests (Vitest)
npm test

# Run type checking and lint
npm run lint

# Compile production bundle
npm run build
```

Layout:

```text
app/
  page.tsx             Landing page & status UI
  layout.tsx           Root HTML shell & metadata
  globals.css          Global Tailwind CSS styles
  api/
    v1/
      health/route.ts  Liveness health check
      analyze/
        text/route.ts  Text analysis route handler
        url/route.ts   URL analysis route handler
src/
  lib/
    validation/        Zod request and response schemas
    errors/            Standardized API error envelope helpers
    providers/         LLM, Evidence, and Reputation provider adapters
    analysis/          Analysis orchestrator and deterministic heuristics
tests/                 Automated test suites (Vitest)
docs/
  API_CONTRACT.md      Endpoint specifications and schema rules
  DECISIONS.md         Architecture Decision Records (ADRs)
  REPOSITORY_AUDIT.md  Repository audit and migration log
  TEST_PLAN.md         Test strategy and release gates
SOURCE_OF_TRUTH.md     Canonical product requirements
DEVELOPMENT_ROADMAP.md Phased delivery roadmap
README.md              Project overview
```

## Product safety note

This tool provides decision support, not a guarantee that a message or website is safe or that a claim is true/false. It must distinguish lack of evidence from evidence of safety, show source links where available, and state limitations clearly.
