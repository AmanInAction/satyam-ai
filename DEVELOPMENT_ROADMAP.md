# Scam & Misinformation Checker — Development Roadmap

**Owner:** Solo developer  
**Planning baseline:** October 13, 2026  
**Submission window:** November 13–14, 2026  
**Status:** Initial plan — update status as work is verified

> Read `SOURCE_OF_TRUTH.md` first. It defines what the product must do. This roadmap defines the order of work. Dates are targets, not permission to skip acceptance criteria.

## Delivery strategy

Build a production-oriented modular monolith, not a collection of disconnected demos. Establish a working end-to-end flow early, then improve evidence quality, safety, reliability, and UX. Do not describe the product as production-ready until release gates have been verified.

## Phase 0 — Repository audit and foundation
**Target:** October 13–14  
**Status:** Completed & Migrated to Full-Stack Next.js (Verified 2026-10-13)

### Tasks
- [x] Inspect the repository, current stack, manifests, scripts, tests, deployment configuration, and existing features.
- [x] Read `SOURCE_OF_TRUTH.md` and the original `scam_checker_architecture.xlsx` if available (noted xlsx absent from git; specs codified in SOURCE_OF_TRUTH.md).
- [x] Map each requirement to existing code or mark it missing (documented in `docs/REPOSITORY_AUDIT.md`).
- [x] Identify required API keys, accounts, pricing/free-tier limits, and unavailable services.
- [x] Establish and verify full-stack Next.js App Router baseline with Tailwind CSS, Zod runtime validation, and Vitest test framework.
- [x] Add `.env.example` files, setup instructions, and `docs/DECISIONS.md`.

### Acceptance criteria
- [x] Audit report documents the actual repository state (`docs/REPOSITORY_AUDIT.md`).
- [x] Existing working code and documentation are preserved.
- [x] Local setup steps are reproducible (`npm run lint`, `npm test`, `npm run build`, `npm run dev`).
- [x] Secrets are not committed (only `.env.example` committed).

## Phase 1 — API contracts and analysis skeleton
**Target:** October 15–16  
**Status:** Completed (Verified 2026-10-13)

### Tasks
- [x] Define versioned Route Handlers under `app/api/v1/*` (`/api/v1/health`, `/api/v1/analyze/text`, `/api/v1/analyze/url`).
- [x] Define Zod request/response models (`src/lib/validation/schemas.ts`) and synchronize API contract docs (`docs/API_CONTRACT.md`).
- [x] Separate API routes, orchestration, deterministic rules, LLM adapter, evidence adapter, and URL reputation adapter (`src/lib/*`).
- [x] Add validation, size limits (max 10,000 chars), safe error mapping with opaque request IDs, and initial tests.
- [x] Use mocked providers for reliable local development and offline resilience (`MockLLMProvider`, `MockEvidenceProvider`, `MockReputationProvider`).

### Acceptance criteria
- [x] API returns schema-valid mocked results (verified by `tests/apiRoutes.test.ts` and live curl checks).
- [x] Invalid and oversized input is rejected with HTTP 400 and structured error envelopes.
- [x] Provider failure returns a controlled error or partial result (`tests/orchestrator.test.ts`).
- [x] API contract is documented in `docs/API_CONTRACT.md`.

## Phase 2 — End-to-end text-analysis MVP
**Target:** October 17–20

### Tasks
- [ ] Implement text normalization and deterministic scam-pattern checks.
- [ ] Add an LLM provider adapter that requests structured output.
- [ ] Validate model output; do not trust arbitrary free-form text as the API response.
- [ ] Build the initial Next.js interface with input, loading, results, and error states.
- [ ] Connect frontend and backend.
- [ ] Test the primary journey with mocked providers and real credentials where available.

### Acceptance criteria
- [ ] User submits a message and receives a structured assessment.
- [ ] Reasons and recommended actions are understandable.
- [ ] Malformed model output or provider outage does not crash the app.
- [ ] The UI does not claim that an item is definitely safe or false without evidence.

## Phase 3 — URL analysis and evidence
**Target:** October 21–23

### Tasks
- [ ] Add safe URL parsing and deterministic indicators.
- [ ] Integrate at least one URL-reputation provider if access/credentials are available.
- [ ] Integrate fact-check or web-search evidence behind an adapter.
- [ ] Display evidence title, publisher/domain, URL, and relevance.
- [ ] Add partial-result behavior when an external provider fails.
- [ ] Avoid fetching arbitrary URLs directly unless SSRF defenses are implemented and tested.

### Acceptance criteria
- [ ] Text and URL analysis both work end-to-end.
- [ ] The app never invents reputation results, citations, or fact-check findings.
- [ ] Missing evidence is described as unknown/unverified, not as proof of safety.
- [ ] URL handling tests cover malformed URLs and unsafe destinations.

## Phase 4 — Regional language and screenshot input
**Target:** October 24–28

### Tasks
- [ ] Evaluate Hindi and Hinglish messages.
- [ ] Tune output for clear, accessible language without overstating certainty.
- [ ] Add screenshot upload and OCR/vision extraction only after the core flow is stable.
- [ ] Validate MIME type, file size, and supported formats.
- [ ] Where practical, show extracted text for user review before analysis.

### Acceptance criteria
- [ ] Hindi/Hinglish examples have understandable results.
- [ ] Unsupported files and unreadable screenshots fail gracefully.
- [ ] Uploads are bounded and processed safely.
- [ ] Core text and URL flows remain stable.

## Phase 5 — Security, privacy, reliability, and UX
**Target:** October 29–November 2

### Tasks
- [ ] Add rate limiting, bounded retries, provider timeouts, and redacted logs.
- [ ] Review secrets, CORS, security headers, dependencies, and deployment configuration.
- [ ] Define data retention before storing raw submissions.
- [ ] Avoid persisting raw submitted content by default.
- [ ] Polish accessibility and mobile responsiveness.
- [ ] Test provider outages, malformed inputs, and partial results.

### Acceptance criteria
- [ ] Security/privacy checklist is completed with exceptions documented.
- [ ] Failure paths are tested.
- [ ] UI works on desktop and mobile and supports keyboard navigation.
- [ ] No secrets are exposed to the browser or logs.

## Phase 6 — Optional differentiators
**Target:** November 3–5

Choose only after all P0 features and release gates are passing.

Possible options:
- [ ] Telegram bot that reuses the same backend API.
- [ ] Minimal feedback collection with explicit data-minimization.
- [ ] Lightweight analysis history, only if retention and deletion behavior are defined.
- [ ] PWA polish.

Do not start browser extensions, deepfake detection, reverse-image search, custom model training, or microservices during this phase.

### Acceptance criteria
- [ ] Optional feature is integrated, not a mock.
- [ ] Core app remains stable.
- [ ] Revert or disable the optional feature if it regresses the core product.

## Phase 7 — Evaluation, deployment, and submission readiness
**Target:** November 6–12

### Tasks
- [ ] Run lint, type checks, unit tests, API tests, and end-to-end smoke tests.
- [ ] Evaluate obvious scams, legitimate messages, ambiguous cases, Hindi/Hinglish samples, phishing URLs, and unsupported claims.
- [ ] Review false positives/negatives and revise unsafe wording.
- [ ] Deploy frontend and backend.
- [ ] Verify environment variables, CORS, health checks, logs, and external-provider behavior.
- [ ] Finalize README, architecture notes, known limitations, and demo script.
- [ ] Rehearse the demo from a clean browser session.

### Acceptance criteria
- [ ] Setup and test commands are documented and reproducible.
- [ ] Automated checks pass, or remaining failures are explicitly documented.
- [ ] Deployed primary user journey passes smoke tests on desktop and mobile.
- [ ] No secrets are present in the repository or client bundle.
- [ ] Demo and submission assets are ready by November 12.

## Submission buffer
**November 13–14**

- [ ] Fix submission-blocking bugs only.
- [ ] Run the final smoke test.
- [ ] Verify demo examples and links.
- [ ] Avoid major features or architecture changes.

## Priority guide

| Priority | Scope | Rule |
|---|---|---|
| P0 — Must ship | Text analysis, URL analysis, structured verdict, reasons, evidence where available, safe next steps, tests, deployment | Do not sacrifice these for optional features. |
| P1 — Should ship | Hindi/Hinglish, screenshot OCR, limited feedback, basic caching | Implement after the primary flow is stable. |
| P2 — Stretch | Telegram bot, history, PWA extras | Select only if time and release quality allow. |
| Defer | Browser extension, deepfake detection, reverse-image search, complex accounts/admin, microservices | Do not begin without explicit approval. |

## Definition of done

A feature is done only when:
- behavior matches `SOURCE_OF_TRUTH.md`;
- inputs and outputs are validated;
- success, error, timeout, and partial-result paths are handled;
- relevant tests pass and results are reported honestly;
- secrets and user data are handled safely;
- documentation and configuration are updated;
- it works in the integrated application;
- limitations are explicit.

## Required phase report from the agent

After every phase, report:
1. Status: `PASS`, `PARTIAL`, or `BLOCKED`.
2. Files created or changed and why.
3. Commands run and actual test/lint/build results.
4. Manual verification still required.
5. New environment variables, accounts, or API keys needed.
6. Known bugs, risks, and deferred work.
7. Roadmap status and `docs/DECISIONS.md` updates.
