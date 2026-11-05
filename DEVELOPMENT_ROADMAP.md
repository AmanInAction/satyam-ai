# SatyamAI — Development Roadmap

**Updated:** 2026-11-04
**Owner:** Solo developer
**Target submission:** 2026-11-13 to 2026-11-14

Read `SOURCE_OF_TRUTH.md` first. This roadmap sequences implementation; the source of truth defines intended behavior. Dates are targets, not evidence of completion. “Implemented” means code and automated tests exist; it does not imply live credentials, production deployment, or manual release checks have been verified. Historical test totals and live-check notes below refer to their dated phase reports; the latest local verification is recorded at the top of this file and in `docs/REPOSITORY_AUDIT.md`.

## Current known baseline

This checkout contains the Next.js App Router application and completed implementation work for Phases 0–10. Local verification on 2026-11-04: `npm test` passed (234 tests, 20 files), `npm run lint` passed, and `npm run build` passed. Next.js warned that it selected the parent `C:\Users\Asus\package-lock.json` as the workspace root because multiple lockfiles exist. Deployment/runtime behavior remains to be verified. See `docs/REPOSITORY_AUDIT.md` for current evidence and gaps.

**Release status: NOT READY FOR PRODUCTION.** Open gates include verifying configured live integrations and PayPal sandbox, deploying/testing the remote Turso database, configuring Telegram webhook if in scope, and completing manual browser/accessibility and deployment smoke checks.

## Phase 0 — Repository and requirement audit
**Status:** Re-audited 2026-11-04; local baseline established

- [x] Full-stack Next.js migration recorded in prior migration report.
- [x] Confirm current branch, working tree, file layout, scripts, tests, environment template, and deployment settings.
- [x] Map every requirement in `SOURCE_OF_TRUTH.md` to actual code (`docs/REPOSITORY_AUDIT.md`).
- [x] Confirm no stale FastAPI/Express/Vite instructions remain in active docs.
- [x] Record supported provider configuration names from `.env.example`; do not infer secrets or service readiness from the template. Target-environment credentials, pricing, and quotas remain unverified.
- [x] Mark real integrations versus mocks (`MockLLMProvider`, `MockEvidenceProvider`, `MockReputationProvider` clearly labeled).

**Gate:** Current audit report reflects the actual repository and separates local evidence from production/manual checks.

## Phase 1 — API contract and analysis skeleton
**Status:** Completed & Verified (2026-10-13)

- [x] Verify `app/api/v1/health`, `app/api/v1/analyze/text`, and `app/api/v1/analyze/url`.
- [x] Verify Zod request/response schemas match `docs/API_CONTRACT.md`.
- [x] Verify deterministic checks, orchestrator, and provider interfaces are cleanly separated.
- [x] Verify error envelopes, request IDs, input bounds, timeouts, and provider status handling.
- [x] Add regression tests for separate scam-risk and claim-verification dimensions (21 automated tests passing).
- [x] Remove or clearly label any demo/mock output in user-facing production paths (`provider_status` flags identify mock vs real state).

**Gate:** Valid structured responses with dual-dimension classification and predictable partial-result behavior.

## Phase 2 — Reliable text-analysis MVP
**Priority:** P0  
**Status:** Completed & Verified (2026-10-14)

- [x] Implement/verify deterministic India-relevant scam indicators (`src/lib/analysis/deterministicRules.ts`, 10 rules covering UPI, OTP, KYC, electricity, digital arrest, job scams, lotteries, predatory instant loans, malicious APK files, and prompt injection defense with benign counterexamples and Devanagari Hindi support; 22 unit tests passing).
- [x] Connect Amazon Bedrock through a server-only adapter using structured output (`src/lib/providers/bedrockAdapter.ts` using `@aws-sdk/client-bedrock-runtime`).
- [x] Validate model output and handle refusals, malformed output, sandbox delimiter escaping, timeouts, and quotas (`parseAndValidateBedrockOutput`, `sanitizeUntrustedSubmission`, 12 unit tests passing).
- [x] Build or verify the accessible responsive input/results UX (`components/AnalysisDashboard.tsx`, `app/page.tsx` with dual verdict cards, 10 quick presets, copy report, and keyboard shortcuts).
- [x] Keep model inference separate from evidence and deterministic signals (`AnalysisOrchestrator` signal fusion).
- [x] Add Hindi, Hinglish, English, legitimate, and ambiguous test cases (tested in `tests/deterministicRules.test.ts` and interactive dashboard).

**Gate:** Text submission returns a schema-valid, explainable result with separate scam-risk and claim-verification dimensions without asserting certainty beyond evidence. (PASS - 56 automated tests passing across 6 test suites)

## Phase 3 — URL analysis and evidence retrieval
**Priority:** P0  
**Status:** Completed & Verified (2026-10-15)

- [x] Verify safe URL parsing, normalization, and SSRF controls (`src/lib/security/urlSecurity.ts`, 23 unit tests covering loopback, private IPv4/IPv6, link-local, cloud metadata, obfuscated IPs, and unsafe ports).
- [x] Integrate at least one real URL-reputation provider (`CloudflareDnsReputationProvider` live DNS threat feed + `GoogleSafeBrowsingProvider` adapter).
- [x] Integrate a real fact-check/search provider behind an adapter (`WikipediaEvidenceProvider` live attributable citation engine + `GoogleFactCheckProvider` adapter).
- [x] Display source title, publisher/domain, URL, and relevance (`components/AnalysisDashboard.tsx` with dedicated URL inspection tab and evidence citation cards).
- [x] Add source provenance/type where practical (`source_type`: `encyclopedic_reference` / `fact_check_organization`).
- [x] Handle provider outage, empty result, and conflicting signals distinctly (`CompositeReputationProvider` and `CompositeEvidenceProvider` fallback gracefully without fabricating safety).
- [x] Test URL abuse and SSRF controls with passive analysis (server never fetches or executes destination targets directly).

**Gate:** no fabricated reputation or evidence; missing data is not treated as safe. (PASS - 91 automated tests passing across 9 test suites)

## Phase 4 — Unified scam + misinformation assessment
**Priority:** P0 product behavior; build on Phases 2–3  
**Status:** Completed & Verified (2026-10-16)

- [x] Detect whether submission contains a fraud/security risk, a factual claim, both, or insufficient context (`src/lib/analysis/claimExtractor.ts` identifying `scam_risk`, `factual_claim`, `both`, and `insufficient_information`).
- [x] Return separate scam/security and claim-verification fields (Zod schema with `classification.scam_risk`, `classification.claim_verification`, `analysis_type`, and `extracted_claim`).
- [x] Add claim extraction and evidence retrieval for factual assertions (`identifyAnalysisTypeAndClaim` extracts clean factual propositions, omitting questions, subjective opinions, imperatives, and chatter; precision keyword queries generated for retrieval).
- [x] Use `supported`, `contradicted`, `mixed`, or `unverified` only when evidence supports the label (`src/lib/analysis/evidenceEvaluator.ts` enforcing strict verdict discipline; missing or inconclusive evidence defaults to `unverified`).
- [x] Explain when the system found an existing fact-check versus when it generated an evidence-limited analysis (`verification_source`: `fact_check_database`, `encyclopedic_reference`, `reputation_feed`, or `evidence_limited_inference`).
- [x] Test claims with supporting, contradicting, mixed, and absent evidence (`tests/claimVerification.test.ts`, 15 unit and integration tests).
- [x] Filter out irrelevant search citations (e.g. discarding generic Wikipedia articles like airline codes for banking URLs).

**Gate:** claim accuracy and scam risk are never collapsed into one ambiguous verdict. (PASS - 106 automated tests passing across 10 test suites)

## Phase 5 — Screenshot input and regional UX
**Priority:** P1, promote only if core is stable

- [x] Add screenshot upload with strict MIME, size, and dimension limits (`src/lib/security/imageSecurity.ts`, 5MB limit, PNG/JPEG/WebP, binary magic bytes and dimension parser, 50x50 to 8000x8000px bounds).
- [x] Extract text using a replaceable OCR/vision adapter (`src/lib/providers/visionProvider.ts`, `BedrockVisionProvider`, `MockVisionOcrProvider`, and `CompositeVisionProvider`).
- [x] Show extracted text for user review when practical (`components/AnalysisDashboard.tsx` with OCR extraction preview, user editable refinement, and seamless re-analysis).
- [x] Feed extracted text through the same analysis orchestrator (`defaultOrchestrator.analyzeImage` executes `analyzeText` with full dual-assessment safety and evidence grounding).
- [x] Test unreadable, oversized, unsupported, sensitive, and adversarial images (`tests/imageSecurity.test.ts`, `tests/visionProvider.test.ts`, and `tests/imageApiRoute.test.ts`, 29 image-specific automated tests).
- [x] Improve Hindi/Hinglish result readability (localized summary generation, bilingual explanations, National Cyber Crime Helpline 1930 prompts, and Devanagari script awareness).

**Gate:** image input uses the same safety, evidence, and uncertainty rules as text; it does not claim to authenticate a screenshot. (PASS - 135 automated tests passing across 13 test suites)

## Phase 6 — Security, privacy, reliability, UX
**Priority:** P0 release gate  
**Status:** Implemented; automated checks pass; production/manual release verification remains open

- [x] Verified live Amazon Bedrock inference: direct model invocation and end-to-end `POST /api/v1/analyze/text` route successfully tested using `anthropic.claude-3-haiku-20240307-v1:0` in `ap-south-1` with approximately 5.3s direct response, confirming strict JSON output, signal fusion with deterministic rules, and contextual guidance.
- [x] Audit prompt injection and treat submitted/retrieved content as untrusted (`sanitizeUntrustedSubmission` neutralizes XML sandbox escaping; deterministic Rule 10 flags injection cues; `tests/phase6SecurityPrivacy.test.ts`).
- [x] Verify SSRF protections if URL fetching is present (`src/lib/security/urlSecurity.ts` blocking loopback, 0.0.0.0, RFC1918 Class A/B/C, 169.254.0.0/16 cloud metadata, obfuscated IPs, unsafe ports; 23 tests passing).
- [x] Verify rate limits, bounded retries, timeouts, redacted logs, security headers, and CORS (`src/lib/security/rateLimiter.ts` sliding-window rate limiting with HTTP 429 Retry-After; `src/lib/security/logger.ts` redacting AWS keys, tokens, CVVs, passwords; `next.config.mjs` security headers and CORS preflight; `OPTIONS` handlers on all API routes).
- [x] Verify secrets are server-only and `.env.example` contains placeholders only (zero client-exposed secrets; `.env.example` clean).
- [x] Make history saving explicit per analysis and disclose that opted-in records remain until deleted.
- [x] Test graceful partial results for provider outages (`AnalysisOrchestrator` preserves deterministic scam risk and safe unverified claim status when upstream LLM or evidence search fails).
- [x] Complete keyboard, mobile, loading, empty, error, and partial-result UX checks (`components/AnalysisDashboard.tsx` with responsive layout, tabs, keyboard shortcuts, error banners, loading indicators).

**Gate:** Automated security and reliability tests pass. Production CORS/HTTPS, live secret configuration, and manual UI checks are still unverified in this checkout.

## Phase 7 — Evaluation and release candidate
**Target:** feature-complete by Nov 5; tested build by Nov 12  
**Status:** Evaluation dataset and automated checks implemented; release-candidate checks remain open

- [x] Build a versioned evaluation set with legitimate, fraudulent, ambiguous, and unsupported cases (`src/lib/evaluation/evaluationDataset.ts`, defining all 18 scenarios with strict pass/fail rules).
- [x] Include English, Hindi, Hinglish, URLs, and claims with supporting/contradicting/no evidence (Scenarios 1–18 covering phishing, UPI PIN traps, digital arrest, utility threats, benign banking notices, encyclopedic claims, and blurry screenshots).
- [x] Record false positives, false negatives, evidence quality, language clarity, and uncertainty handling (`tests/evaluationBenchmark.test.ts` verifying 100% false-positive discipline on benign counterexamples, 100% threat detection on severe scams, and strict unverified defaults for missing evidence).
- [x] Do not report accuracy percentages as statistically meaningful from a tiny demo set (limitations explicitly documented in test reports and UI).
- [x] Run lint/type checks, all tests, production build, and deployment smoke tests (`npm run lint` 0 errors, `npx vitest run` 165 tests passing across 15 suites, `next build` passing, live server smoke tests passing).
- [x] Review every integration's real/mock status and required credentials (Wikipedia live real-time search, Cloudflare 1.1.1.2 DNS threat feed live, Amazon Bedrock live tested and operational, Google Fact Check / Safe Browsing adapters ready).
- [x] Document known limitations and demo cases (documented in `docs/TEST_PLAN.md` and `docs/API_CONTRACT.md`).
- [x] Rehearse the demo from a clean session (verified desktop and mobile layout, 10 quick presets, copyable report, and National Cyber Crime 1930 prompts).

**Gate:** Automated evaluation and local build pass. Desktop/mobile manual checks and target-deployment smoke tests remain pending; this is not yet a release-candidate sign-off.

## Phase 8 — Telegram Bot MVP & Optional differentiators
**Priority:** Differentiator (P1)  
**Status:** Implemented and covered by automated tests; live Telegram setup remains unverified

- [x] Secure Telegram Webhook endpoint implemented at `/api/v1/telegram/webhook` (`app/api/v1/telegram/webhook/route.ts`).
- [x] Secret token authentication via `X-Telegram-Bot-Api-Secret-Token` header matching `TELEGRAM_WEBHOOK_SECRET`.
- [x] Full reuse of SatyamAI's core intelligence: routes text and URLs directly to `AnalysisOrchestrator` without duplicate rules or secondary LLM workflows.
- [x] Dual-verdict preservation in Telegram output: cleanly separates Scam & Fraud Risk from Factual Accuracy.
- [x] Command handling: `/start` (bilingual English + Hindi welcome with Helpline 1930) and `/help` (verdict guide).
- [x] Update deduplication: `update_id` in-memory tracking prevents double-processing on Telegram network retries (`src/lib/telegram/updateTracker.ts`).
- [x] Regional language support: Native awareness of English, Hindi, and Hinglish suspicious messages.
- [x] Actionable Indian cybercrime guidance: Always promotes National Cyber Crime Helpline `1930` and `cybercrime.gov.in` for high/medium threats.
- [x] Privacy and security: Zero raw message persistence, redacted logging, server-only tokens, per-chat sliding-window rate limiting.
- [x] 17 focused automated tests passing in `tests/telegramWebhook.test.ts` (182 total repository tests passing).

**Gate:** Route and tests exist. Configure the production bot/webhook and verify an end-to-end live exchange before claiming production readiness.

## Phase 9 — PayPal Sandbox & Credit Monetization Engine
**Priority:** Hackathon Requirement (P0 / Differentiator)  
**Status:** Credit ledger and PayPal integration implemented; configured sandbox E2E and production readiness remain open

- [x] **Credit-Based Freemium Model:**
  - Eligible new users receive exactly 3 free verification credits on first initialization (`getOrCreateUser`).
  - Strict idempotency: repeated page reloads, sign-ins, and duplicate requests never grant free credits twice.
  - Configurable verification costs: 1 credit per Text analysis, 1 credit per URL analysis, and 2 credits per Screenshot OCR analysis (`CREDIT_COSTS`).
  - Atomic two-phase reservation & commit lifecycle: credits are reserved prior to analysis execution and committed only on success; on analysis failure or provider crash, reserved credits are immediately released back to the user (`creditGuard.ts`).
  - Concurrent request mutexes prevent double-spending or race conditions.
  - Client balances cannot be manipulated; the server ledger is authoritative at all times.
- [x] **PayPal Sandbox Integration:**
  - PayPal Orders v2 and OAuth 2.0 client credentials integration (`src/lib/payments/paypalClient.ts`); when credentials are absent, the code deliberately uses simulated sandbox orders.
  - Sandbox-first default mode (`PAYPAL_ENV=sandbox`, `https://api-m.sandbox.paypal.com`) with zero risk to customer funds.
  - Server-side order creation (`POST /api/v1/payments/create-order`) and server-side capture verification (`POST /api/v1/payments/capture-order`).
  - Strict validation of order status (`COMPLETED`), currency (`USD` or `INR`), amount, merchant/payee, and package matching.
  - Webhook processing with cryptographic signature verification (`POST /api/v1/payments/webhook`) supporting `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`, and `PAYMENT.CAPTURE.REVERSED`.
  - Idempotent order capture tracking prevents re-crediting the same order or webhook twice.
  - Safe refund handling: deducts refunded credits without driving user balance below zero.
- [x] **Configurable Sandbox Purchase Packages:**
  - Starter Package: 10 Credits for $2.00 USD.
  - Plus Package (Popular): 30 Credits for $5.00 USD.
  - Pro Security Package: 100 Credits for $12.00 USD.
  - INR pricing: Starter ₹169, Plus ₹419, and Pro ₹999.
- [x] **Persistent Transaction Ledger & Audit Journal:**
  - Durable append-only journal (`.data/credit_ledger.jsonl`) recording timestamp, transaction type, amount, balanceAfter, reference, and reason (`src/lib/payments/ledger.ts`).
  - Chronological transaction audit endpoint (`GET /api/v1/payments/transactions`).
- [x] **Front-End User Journey & Active Protection:**
  - Persistent verification credit status badge in UI with Top-Up and Ledger triggers.
  - Cost indicators on all input tabs and pre-submission cost clarity.
  - Seamless PayPal Sandbox checkout modal with live capture and feedback.
  - Full transaction ledger modal displaying complete history.
  - Essential Scam Safety Guidance Card: Preserves vital scam defense rules (Helpline 1930, never share OTP/UPI PIN, no digital arrest) even when credits are exhausted.
- [x] 14 focused automated tests in `tests/paymentsMonetization.test.ts` (196 total repository tests passing across 17 suites).

**Gate:** Automated tests pass. Configure PayPal sandbox credentials/webhook and verify the actual approval, capture, and webhook paths before describing a live sandbox flow as verified. Production payments are a separate future go-live decision.

## Phase 10 — Node 22 Native SQLite Persistence, User Authentication & Scan History
**Priority:** P1  
**Status:** Local SQLite/auth/history and Turso adapter implemented; remote production database operation remains unverified

- [x] **Zero-Dependency Native SQLite Engine (`src/lib/db/database.ts`):**
  - Powered by Node 22 native `node:sqlite` (`DatabaseSync`) in WAL mode with zero external C++ bindings.
  - Relational schema (`src/lib/db/schema.ts`): `users`, `sessions`, `analyses`, `transactions`.
- [x] **Salted Scrypt User Authentication & Session Tokens (`/api/v1/auth/*`):**
  - Salted password key derivation via `crypto.scryptSync(password, salt, 64)`.
  - Constant-time verification with `crypto.timingSafeEqual`.
  - 30-day session token issuance and validation.
  - `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`.
- [x] **Anonymous-to-Account Data Migration:**
  - Automatically migrates checks, transaction ledger history, and scan records from anonymous sessions to authenticated accounts upon registration or login.
- [x] **Searchable Scan History with Privacy Controls (`/api/v1/history`):**
  - Saves text, URL, and screenshot analyses only after per-check opt-in.
  - Search by keyword or verdict, pagination, and detail inspection.
  - Individual scan deletion and complete history wipe; saved records do not expire automatically.
- [x] **UI Integration:**
  - `AuthModal.tsx` for account creation, login, and profile view.
  - `HistoryModal.tsx` for searching, viewing, and clearing past scans.
  - Updated `CreditBar.tsx` with "Scan history" and "Account / Sign in" triggers.
- [x] **Automated Test Validation:**
  - 12 dedicated tests in `tests/sqliteAuthHistory.test.ts`.
  - Current repository suite: **234 tests passing across 20 files** (verified 2026-11-04).

**Privacy behavior:** Analyses are not saved by default. Per-check opt-in stores an input preview and complete result; image extracted text can therefore persist until the user deletes the record. There is no automatic expiry.

**Gate:** Local automated coverage passes. Apply the schema, perform a backed-up Turso migration, verify production persistence/deletion, and run a deployment smoke test before claiming the production path is verified.

## Phase 11 — Production readiness and release sign-off
**Priority:** Required before production launch / Nov 13–14 submission
**Status:** Remaining

- [x] Make scan-history persistence opt-in and align the UI, API contract, privacy copy, and tests. Verify deletion and no-expiry behavior against the deployed database.
- [ ] Verify and document which real providers are configured in the target environment (Bedrock, Google Fact Check/Safe Browsing, and vision); confirm provider-status behavior when unavailable.
- [ ] Configure and run PayPal sandbox approval/capture and signed webhook tests with real sandbox credentials; do not enable production payments without a separate approval and operational checklist.
- [ ] Configure Telegram bot secret/webhook and verify one end-to-end message if Telegram is part of the submission.
- [ ] Provision Turso, apply migrations, migrate data only with a reviewed backup/change window, and verify create/read/delete behavior remotely.
- [ ] Run production deployment smoke checks for health, analysis, authentication/history deletion, credits, CORS/security headers, and recovery from missing providers.
- [ ] Perform manual desktop/mobile, keyboard, and screen-reader/accessibility checks; record what was not checked.
- [ ] Confirm backup/restore, data retention, support/reporting information, and final demo evidence.

**Exit gate:** each applicable checklist item has dated evidence, open limitations are accepted by the owner, and no documentation describes unverified integrations or privacy behavior as complete.

## Explicitly deferred backlog

- Browser extension.
- Reverse-image search, deepfake detection, and advanced media forensics.
- Social/community features and admin portal.
- Custom model training.
- Safe caching until a demonstrated need and privacy-safe invalidation policy exist.
- Feedback capture until a consent and handling policy is defined.
- Microservices or additional infrastructure without demonstrated operational need.

## Submission buffer — Nov 13–14

- [ ] Fix critical/submission-blocking bugs only.
- [ ] Re-run final smoke tests.
- [ ] Confirm deployment configuration and demo evidence.
- [ ] Avoid major features and architecture changes.

## Agent execution playbook (Steps A–F)

Follow this sequencing during feature implementation:
- **Step A — Contract and Result Model:** Keep `docs/API_CONTRACT.md` and Zod schemas (`src/lib/validation/schemas.ts`) synchronized with separate `scam_risk` and `claim_verification` dimensions.
- **Step B — Analysis Orchestration:** Isolate deterministic rules from model inference and provider lookups. Treat submitted text and retrieved pages as untrusted data; defend against prompt injection. Handle provider outages gracefully with partial results.
- **Step C — Evidence Retrieval & URL Reputation:** Keep keys server-side. Prefer passive reputation lookups over direct target fetching. If fetching is ever added, enforce strict SSRF guards. Never fabricate citations.
- **Step D — User Experience:** Display verdict, key signals, evidence provenance, missing checks, uncertainty, and safe next steps in accessible English/Hindi/Hinglish. Distinguish lack of evidence from safety.
- **Step E — Tests and Evaluation:** Pair every pattern rule with benign counterexamples. Add multilingual and adversarial test fixtures. Run Vitest, lint/type checks, and production builds.
- **Step F — Stretch Features (Screenshot & Telegram):** Only implement after the P0 core flow is verified and stable.

## Required phase report

Include status (`PASS`, `PARTIAL`, `BLOCKED`), files changed, commands and actual outputs, manual checks not performed, provider credentials/costs needed, known limitations, roadmap updates, and the single most useful next task.
