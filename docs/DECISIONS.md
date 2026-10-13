# Architecture and Product Decisions

Record material decisions here so the solo developer and coding agent can understand why the system is built this way.

**Rule:** Do not silently make major changes. Record date, decision, context, alternatives, trade-offs, and follow-up work. Routine reversible implementation choices do not need approval.

## Decision log

### D-001 — Modular monolith for the first release
- **Date:** 2026-10-13
- **Status:** Superseded by D-007 (modular monolith principle preserved; stack unified under Next.js App Router)
- **Decision:** Use a Next.js frontend and a modular backend architecture organized into clear modules rather than microservices.
- **Context:** Solo developer, fixed submission window, need to deliver and maintain a complete product.
- **Trade-off:** Less independent scaling than microservices, but substantially less operational complexity.
- **Review trigger:** Demonstrated scaling or ownership requirements that cannot be met by the modular monolith.

### D-002 — Provider integrations must use adapters
- **Date:** 2026-10-13
- **Status:** Accepted baseline
- **Decision:** Isolate LLM, evidence search, URL reputation, and OCR providers behind small interfaces.
- **Context:** Provider credentials, prices, quotas, and API behavior may vary.
- **Trade-off:** Small initial abstraction cost in exchange for easier provider replacement and testing.

### D-003 — No default persistence of raw submitted content
- **Date:** 2026-10-13
- **Status:** Accepted baseline
- **Decision:** Do not persist raw message text, URLs, or uploaded images by default.
- **Context:** Submitted content may include personal, financial, or otherwise sensitive data.
- **Trade-off:** No full analysis history by default. Any history feature requires explicit retention/deletion behavior and user disclosure.

### D-004 — Verdicts must express uncertainty
- **Date:** 2026-10-13
- **Status:** Accepted baseline
- **Decision:** Use cautious labels such as `likely_scam`, `suspicious`, `unverified`, and `no_obvious_risk_found`; do not present heuristic scores as calibrated probabilities.
- **Context:** False certainty could lead to financial or reputational harm.
- **Trade-off:** The product may sometimes return “unverified” rather than a definitive answer.

### D-005 — Core flow before optional differentiators
- **Date:** 2026-10-13
- **Status:** Accepted baseline
- **Decision:** Prioritize text analysis, URL analysis, explanations, evidence, testing, and deployment before Telegram, browser extension, deepfake detection, or advanced history.
- **Context:** The project is built by one developer with a November 13–14, 2026 submission window.
- **Trade-off:** Some features from the initial idea may be deferred.

### D-006 — Unified TypeScript modular monolith for AI Studio environment
- **Date:** 2026-10-13
- **Status:** Superseded by D-007
- **Decision:** Implement a unified TypeScript modular architecture with an Express server (`server.ts`) exposing versioned `/api/v1` routes and Vite + React 19 for the frontend on single-process port 3000, adhering strictly to modular adapters, typed schema contracts, and server-side secret handling.
- **Context:** In AI Studio's single-process container hosting environment, running independent Python FastAPI and Next.js services requires complex multi-process orchestration. A unified TypeScript stack preserves all architectural constraints and schema boundaries with lower operational overhead for a solo developer.
- **Trade-off:** Backend is written in TypeScript/Express rather than Python/FastAPI, but retains identical API contracts, modularity, and adapter boundaries.

### D-007 — Migration to Full-Stack Next.js with App Router
- **Date:** 2026-10-13
- **Status:** Accepted baseline (explicitly approved by project owner)
- **Decision:** Migrate from React + Vite + Express to a full-stack Next.js App Router application (`app/`), using Route Handlers (`app/api/v1/*`) for backend APIs, Zod runtime schemas (`src/lib/validation/schemas.ts`), Tailwind CSS, and Vitest for testing.
- **Context:** The project owner approved unifying client and server into standard full-stack Next.js. Next.js App Router provides built-in server-side execution, eliminating the need for a separate Express server process or reverse proxy, while keeping all external provider calls and API secrets strictly server-side.
- **Environment Compatibility:** Resolved control-plane argument divergence (`--host 0.0.0.0` vs Next.js `-H 0.0.0.0`) via `scripts/dev.mjs`, configured `output: 'standalone'` in `next.config.mjs`, and verified clean dev server and production builds on port 3000.
- **Trade-off:** Next.js build and dev startup require slightly more memory than Vite during compilation, but deliver native SSR, unified React Server Components, server-side Route Handlers, and frictionless deployment.

## Pending decisions

Add an entry only when the repository audit or implementation reveals a material choice. Examples:
- Final LLM provider/model and budget.
- Evidence-search provider and its quota.
- URL reputation provider and key availability.
- OCR method and upload limits.
- Hosting provider and environment layout.
- Whether feedback/history is necessary for the submission.


