# SatyamAI — Development Roadmap

**Updated:** 2026-10-13  
**Owner:** Solo developer  
**Target submission:** 2026-11-13 to 2026-11-14

Read `SOURCE_OF_TRUTH.md` first. This roadmap sequences implementation; the source of truth defines intended behavior. Dates are targets, not evidence of completion.

## Current known baseline

The migration report says the repository was moved to a full-stack Next.js App Router modular monolith, with TypeScript Route Handlers, Zod, provider interfaces, a mock adapter, an analysis orchestrator, and 19 passing tests at the time of that report. Real Bedrock/evidence/reputation integrations and user-facing accuracy are **not verified by that report**. Re-run commands and inspect current files before relying on prior status.

## Phase 0 — Repository and requirement audit
**Status:** Reported completed previously; re-verify after any changes.

- [x] Full-stack Next.js migration recorded in prior migration report.
- [ ] Confirm current branch, working tree, file layout, scripts, tests, environment template, and deployment settings.
- [ ] Map every requirement in `SOURCE_OF_TRUTH.md` to actual code.
- [ ] Confirm no stale FastAPI/Express/Vite instructions remain in active docs.
- [ ] Identify provider credentials, account setup, current API contracts, pricing, and quotas.
- [ ] Mark real integrations versus mocks.

**Gate:** current audit report reflects the actual repository, not assumed status.

## Phase 1 — API contract and analysis skeleton
**Status:** Baseline reported present; verify.

- [ ] Verify `app/api/v1/health`, `app/api/v1/analyze/text`, and `app/api/v1/analyze/url`.
- [ ] Verify Zod request/response schemas match `docs/API_CONTRACT.md`.
- [ ] Verify deterministic checks, orchestrator, and provider interfaces are cleanly separated.
- [ ] Verify error envelopes, request IDs, input bounds, timeouts, and provider status handling.
- [ ] Add regression tests for separate scam-risk and claim-verification dimensions.
- [ ] Remove or clearly label any demo/mock output in user-facing production paths.

**Gate:** valid structured responses and predictable partial-result behavior.

## Phase 2 — Reliable text-analysis MVP
**Priority:** P0

- [ ] Implement/verify deterministic India-relevant scam indicators.
- [ ] Connect Amazon Bedrock through a server-only adapter using structured output.
- [ ] Validate model output and handle refusals, malformed output, timeouts, and quotas.
- [ ] Build or verify the accessible responsive input/results UX.
- [ ] Keep model inference separate from evidence and deterministic signals.
- [ ] Add Hindi, Hinglish, English, legitimate, and ambiguous test cases.

**Gate:** text submission returns a schema-valid, explainable result without asserting certainty beyond evidence.

## Phase 3 — URL analysis and evidence retrieval
**Priority:** P0

- [ ] Verify safe URL parsing and normalization.
- [ ] Integrate at least one real URL-reputation provider when credentials/access are available.
- [ ] Integrate a real fact-check/search provider behind an adapter.
- [ ] Display source title, publisher/domain, URL, and relevance.
- [ ] Add source provenance/type where practical.
- [ ] Handle provider outage, empty result, and conflicting signals distinctly.
- [ ] Test URL abuse and SSRF controls if any server-side target fetching exists.

**Gate:** no fabricated reputation or evidence; missing data is not treated as safe.

## Phase 4 — Unified scam + misinformation assessment
**Priority:** P0 product behavior; build on Phases 2–3

- [ ] Detect whether submission contains a fraud/security risk, a factual claim, both, or insufficient context.
- [ ] Return separate scam/security and claim-verification fields.
- [ ] Add claim extraction and evidence retrieval for factual assertions.
- [ ] Use `supported`, `contradicted`, `mixed`, or `unverified` only when evidence supports the label.
- [ ] Explain when the system found an existing fact-check versus when it generated an evidence-limited analysis.
- [ ] Test claims with supporting, contradicting, mixed, and absent evidence.

**Gate:** claim accuracy and scam risk are never collapsed into one ambiguous verdict.

## Phase 5 — Screenshot input and regional UX
**Priority:** P1, promote only if core is stable

- [ ] Add screenshot upload with strict MIME, size, and dimension limits.
- [ ] Extract text using a replaceable OCR/vision adapter.
- [ ] Show extracted text for user review when practical.
- [ ] Feed extracted text through the same analysis orchestrator.
- [ ] Test unreadable, oversized, unsupported, sensitive, and adversarial images.
- [ ] Improve Hindi/Hinglish result readability.

**Gate:** image input uses the same safety, evidence, and uncertainty rules as text; it does not claim to authenticate a screenshot.

## Phase 6 — Security, privacy, reliability, UX
**Priority:** P0 release gate

- [ ] Audit prompt injection and treat submitted/retrieved content as untrusted.
- [ ] Verify SSRF protections if URL fetching is present.
- [ ] Verify rate limits, bounded retries, timeouts, redacted logs, security headers, and CORS.
- [ ] Verify secrets are server-only and `.env.example` contains placeholders only.
- [ ] Confirm raw content is not persisted by default.
- [ ] Test graceful partial results for provider outages.
- [ ] Complete keyboard, mobile, loading, empty, error, and partial-result UX checks.

**Gate:** all exceptions are documented and high-risk failures are fixed before optional work.

## Phase 7 — Evaluation and release candidate
**Target:** feature-complete by Nov 5; tested build by Nov 12

- [ ] Build a versioned evaluation set with legitimate, fraudulent, ambiguous, and unsupported cases.
- [ ] Include English, Hindi, Hinglish, URLs, and claims with supporting/contradicting/no evidence.
- [ ] Record false positives, false negatives, evidence quality, language clarity, and uncertainty handling.
- [ ] Do not report accuracy percentages as statistically meaningful from a tiny demo set.
- [ ] Run lint/type checks, all tests, production build, and deployment smoke tests.
- [ ] Review every integration's real/mock status and required credentials.
- [ ] Document known limitations and demo cases.
- [ ] Rehearse the demo from a clean session.

**Gate:** primary flows work on desktop/mobile; no unreported critical failure or fabricated evidence.

## Phase 8 — Optional differentiators
**Only after P0 release gates pass; target Nov 3–5 if timing permits**

Order of preference:
1. Telegram bot reusing the same server-side analysis flow.
2. Minimal feedback collection with data minimization.
3. Basic cache only where useful and safe.
4. History only if retention/deletion and disclosure are fully implemented.

Do not start browser extensions, deepfake detection, reverse-image search, complex accounts, admin portals, custom training, or microservices during the submission window.

**Gate:** feature is real, tested, documented, and does not regress core functionality. If time is short, defer it.

## Submission buffer — Nov 13–14

- [ ] Fix critical/submission-blocking bugs only.
- [ ] Re-run final smoke tests.
- [ ] Confirm deployment configuration and demo evidence.
- [ ] Avoid major features and architecture changes.

## Agent's next-step selection rule

At each session, inspect the repository and choose the highest-priority item that is both missing and feasible. Prefer the smallest complete vertical slice. If a provider needs credentials, implement/test the adapter and mock path, clearly report the blocker, and continue with other work. Do not invent keys or claim real integration success.

## Required phase report

Include status (`PASS`, `PARTIAL`, `BLOCKED`), files changed, commands and actual outputs, manual checks not performed, provider credentials/costs needed, known limitations, roadmap updates, and the single most useful next task.
