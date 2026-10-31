# Architecture and Product Decisions

Record material decisions so the solo developer and coding agent can understand why the system is built this way. Include context, alternatives, trade-offs, and follow-up work. Do not treat a planned decision as implemented functionality.

## D-001 — Modular monolith for first release
- **Date:** 2026-10-13
- **Status:** Accepted; updated to match migration report
- **Decision:** Use a full-stack Next.js App Router modular monolith with TypeScript Route Handlers.
- **Context:** Solo developer, fixed submission window, maintainability, and reduced operational complexity.
- **Trade-off:** Less independent scaling than multiple services, but simpler local development and deployment.
- **Follow-up:** Do not reintroduce FastAPI/Express/Vite without explicit approval and a migration plan.

## D-002 — Provider integrations use adapters
- **Date:** 2026-10-13
- **Status:** Accepted
- **Decision:** Keep LLM, evidence search, URL reputation, and OCR/vision behind typed interfaces.
- **Context:** Provider APIs, costs, quotas, and model availability change.
- **Trade-off:** Small abstraction cost for testability and lower vendor lock-in.

## D-003 — No default persistence of raw submissions
- **Date:** 2026-10-13
- **Status:** Accepted
- **Decision:** Do not persist raw message text, URLs, or images by default.
- **Context:** Submissions may contain personal, financial, or sensitive information.
- **Trade-off:** No full history by default. Any storage feature requires disclosure, minimization, retention, and deletion behavior.

## D-004 — Verdicts express uncertainty
- **Date:** 2026-10-13
- **Status:** Accepted
- **Decision:** Use cautious labels and distinguish missing evidence from evidence of safety.
- **Context:** False certainty may cause financial, security, or reputational harm.
- **Trade-off:** Some cases must remain `unverified`.

## D-005 — Core before optional differentiators
- **Date:** 2026-10-13
- **Status:** Accepted
- **Decision:** Text, URL, evidence, safety, evaluation, and deployment gates precede Telegram, history, browser extension, deepfake detection, and advanced forensics.
- **Context:** Solo developer and Nov 13–14 submission window.
- **Trade-off:** Some features remain deferred.

## D-006 — Prior separate frontend/backend architecture
- **Date:** 2026-10-13
- **Status:** Superseded
- **Decision:** Earlier plan proposed Next.js frontend with a separate FastAPI backend.
- **Reason superseded:** Migration report records a move to full-stack Next.js App Router and Route Handlers.
- **Rule:** Do not follow the old split architecture unless a future decision explicitly reverses this.

## D-007 — Full-stack Next.js App Router
- **Date:** 2026-10-13
- **Status:** Accepted; migration reported, re-verify repository
- **Decision:** Use Next.js App Router, TypeScript, Route Handlers under `/api/v1`, Zod validation, modular orchestrator, and server-only provider adapters.
- **Trade-off:** Keeps the MVP in one deployable application; maintain clear module boundaries.

## D-008 — Amazon Bedrock as model platform
- **Date:** 2026-10-13
- **Status:** Accepted product direction; integration status must be verified
- **Decision:** Use Amazon Bedrock rather than Gemini for model access, with model selection isolated behind an adapter.
- **Context:** Access to multiple models and ability to compare affordability/quality.
- **Trade-off:** AWS configuration and model/region availability must be verified; do not hard-code one model into domain logic.
- **Follow-up:** Verify credentials, region, model access, current pricing, quotas, structured-output capability, and fallback behavior.

## D-009 — Unified scam-risk and claim-verification dimensions
- **Date:** 2026-10-13
- **Status:** Accepted product requirement; implementation pending verification
- **Decision:** SatyamAI should assess scam/security risk and factual claim status in one workflow while keeping verdicts separate.
- **Context:** A legitimate URL can host misleading content, and a true claim can appear in a scam message.
- **Trade-off:** More careful schema and UI are required to avoid confusing the user.
- **Follow-up:** Update Zod schemas, orchestrator, UI, and tests together.

## D-010 — Evidence must be attributable and uncertainty explicit
- **Date:** 2026-10-13
- **Status:** Accepted product requirement
- **Decision:** Evidence must be real and attributable; AI inference must not be presented as a citation; missing evidence must not imply safety.
- **Follow-up:** Add provenance and missing-check behavior where compatible with the current schema.

## D-011 — India-aware patterns and evaluation
- **Date:** 2026-10-13
- **Status:** Accepted product requirement
- **Decision:** Prioritize English/Hindi/Hinglish and evaluate India-relevant scam patterns such as UPI, OTP/PIN, KYC threats, fake jobs, impersonation, and extortion.
- **Trade-off:** Patterns are signals, not proof; avoid hard-coded certainty based on keywords alone.

## D-012 — Telegram is a stretch channel, not a separate engine
- **Date:** 2026-10-13
- **Status:** Accepted conditional scope
- **Decision:** If implemented, Telegram must reuse the same server-side analysis pipeline and safety rules.
- **Gate:** Only after core web flow and release gates pass.

## D-013 — Phase 2 Reliable Text-Analysis MVP & Bedrock Provider Adapter Architecture
- **Date:** 2026-10-14
- **Status:** Implemented and Verified
- **Decision:** Implement a dual-verdict analysis pipeline combining India-specific deterministic rules (`src/lib/analysis/deterministicRules.ts`) with a server-only Amazon Bedrock provider adapter (`src/lib/providers/bedrockAdapter.ts`) and a resilient mock fallback (`MockLLMProvider`).
- **Context:** Bedrock credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) may be unconfigured in certain dev/test environments. The system must not crash or fabricate certainty, but gracefully report provider status (`not_configured` or `failed`) while continuing to evaluate deterministic security rules.
- **Safety Safeguards:**
  1. User input within prompt templates is strictly encapsulated in `<untrusted_user_submission>` XML blocks, and all user tags attempting to break boundaries (`</untrusted_user_submission>`) are neutralized.
  2. Structured JSON model outputs are strictly validated via Zod (`BedrockStructuredOutputSchema`).
  3. Explicit model refusals and timeouts (AbortController) return safe, cautious `unverified` verdicts with honest limitation reporting.
  4. 10 India-relevant deterministic rules with benign counterexamples cover UPI PIN traps, OTP theft, electricity cut threats, digital arrest, job scams, lotteries, predatory loans, malicious APK files, and prompt injection attempts, including Devanagari Hindi text matching.

## D-014 — Phase 3 URL Analysis, SSRF Protections, and Real Evidence/Reputation Provider Architecture
- **Date:** 2026-10-15
- **Status:** Implemented and Verified
- **Decision:** Implement safe URL normalization, comprehensive SSRF protection controls, and live external intelligence providers behind modular adapters:
  1. `WikipediaEvidenceProvider` (`src/lib/providers/evidenceProvider.ts`): Live, keyless attributable citation retrieval engine using Wikipedia search APIs, returning source title, publisher, and canonical URL.
  2. `CloudflareDnsReputationProvider` (`src/lib/providers/reputationProvider.ts`): Live DNS-over-HTTPS (1.1.1.2) network threat lookup checking for domain sinkholing without exposing or calling target URLs directly.
  3. `GoogleFactCheckProvider` and `GoogleSafeBrowsingProvider`: Server-only adapters supporting Google Fact Check Tools API and Google Safe Browsing v4 with graceful fallback when unconfigured.
  4. `validateAndNormalizeUrl` (`src/lib/security/urlSecurity.ts`): Strict SSRF firewall blocking loopback (127.0.0.0/8, ::1), private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7), link-local/cloud metadata (169.254.169.254, metadata.google.internal), non-standard ports, and obfuscated integer/hex representations.
- **Context:** Preventing SSRF while retrieving real, traceable evidence and reputation signals without ever fetching or executing untrusted destination web pages on the application server.

## D-015 — Phase 4 Unified Scam + Misinformation Assessment Architecture
- **Date:** 2026-10-16
- **Status:** Implemented and Verified
- **Decision:** Implement a unified analysis pipeline that evaluates submissions across two orthogonal dimensions without collapsing them into an ambiguous score:
  1. **Analysis-Type Identification (`src/lib/analysis/claimExtractor.ts`):** Classifies inputs into `scam_risk`, `factual_claim`, `both` (e.g. fraudulent schemes using fake government policies as bait), or `insufficient_information`.
  2. **Claim Extraction:** Extracts clean, declarative factual assertions while strictly excluding questions, imperative instructions, subjective opinions, and conversational banter. Precision keyword queries are generated for evidence retrieval.
  3. **Evidence Relevance Scoring & Quality Filtering (`src/lib/analysis/evidenceEvaluator.ts`):** Scores candidate citations against target queries and claims. Irrelevant search results (such as unrelated Wikipedia articles for banking URLs) are filtered out, avoiding misleading citations.
  4. **Strict Verdict Discipline:** Employs `supported`, `contradicted`, `mixed`, or `unverified` strictly when substantiated by relevant evidence. An absence or failure of evidence defaults to `unverified` with explicit disclosures; missing data is never equated to safety or truth.
  5. **Provenance Transparency:** Distinguishes between `fact_check_database`, `encyclopedic_reference`, `reputation_feed`, and `evidence_limited_inference`.
- **Trade-off:** Requires separate classification objects and UI panels, but provides users with complete clarity on why a message is risky and whether its claims are factual.

## D-011: Screenshot Analysis, Image Security Controls & Regional Readability
- **Date:** 2026-10-17
- **Status:** Implemented and Verified
- **Decision:** Implement screenshot analysis with rigorous defensive security controls and localized UX:
  1. **Strict Defensive Boundary (`src/lib/security/imageSecurity.ts`):** Enforces 5 MB size ceiling (HTTP 413 `FILE_TOO_LARGE`), validates binary magic bytes (`PNG: \x89PNG\r\n\x1a\n`, `JPEG: \xFF\xD8\xFF`, `WebP: RIFF`), and verifies dimensions via pure binary header parsing (bounded between 50x50 and 8000x8000 px) with zero external native binary dependencies.
  2. **Replaceable OCR / Vision Provider (`src/lib/providers/visionProvider.ts`):** Implements `BedrockVisionProvider` (Claude 3 Haiku vision model via `@aws-sdk/client-bedrock-runtime`), `MockVisionOcrProvider` (deterministic local test & dev extraction), and `CompositeVisionProvider` for graceful fallback.
  3. **Graceful Handling of Unreadable & Blank Images:** Completely unreadable or textless screenshots evaluate gracefully to `unverified` verdict, `insufficient_information` category, and `unknown` risk with explanatory guidance, without crashing or hallucinating safety.
  4. **Sensitive Data Detection:** Detects unmasked card numbers, CVV codes, and passwords in extracted text, placing cautionary guidance in recommended actions.
  5. **OCR Review & Refinement Flow:** Frontend provides OCR text inspection and an inline editor allowing users to correct OCR mistakes before re-evaluating.
  6. **Unified Orchestration & Explicit Authenticity Disclaimer:** Extracted text is evaluated through the exact same orchestrator pipeline with dual assessment, deterministic rules, and evidence grounding. Transparently adds a disclaimer that OCR cannot authenticate screenshots or detect photoshop tampering.
  7. **Regional UX (Hindi & Hinglish):** Detects Devanagari script or language hints, formulating localized Hindi/Hinglish summaries, risk labels (`उच्च जोखिम`), and India National Cyber Crime Helpline (1930) actions.

## Verified External Integrations
- **Real AWS Bedrock live API call:** **VERIFIED** on 2026-10-18 using live AWS Bedrock `Converse` API in `ap-south-1` with 5.3s response time.
- **Wikipedia Evidence Provider:** **VERIFIED** live keyless attributable citations.
- **Cloudflare DNS 1.1.1.2 Reputation Provider:** **VERIFIED** live DNS-over-HTTPS threat queries.
- **Telegram Webhook Integration:** **VERIFIED** on 2026-10-18 via Next.js App Router Webhook endpoint (`/api/v1/telegram/webhook`) reusing `AnalysisOrchestrator`.

## D-016 — Phase 8 Telegram Webhook Integration & Pipeline Reuse
- **Date:** 2026-10-18
- **Status:** Implemented and Verified
- **Decision:** Implement a secure, server-side Telegram Webhook handler at `/api/v1/telegram/webhook` that routes messages directly through the existing `AnalysisOrchestrator` without creating a second intelligence workflow or duplicating analysis rules.
- **Key Safeguards:**
  1. **Direct Webhook Responses:** Uses Telegram's direct JSON response payload (`{ method: 'sendMessage', chat_id, text, parse_mode: 'Markdown' }`) for zero-latency responses.
  2. **Secret Token Verification:** Validates `X-Telegram-Bot-Api-Secret-Token` matching `TELEGRAM_WEBHOOK_SECRET` before processing.
  3. **Update Deduplication:** In-memory `update_id` cache prevents duplicate processing on Telegram network retries.
  4. **Per-Chat Rate Limiting:** Sliding-window per-chat rate limiter (30 req/min) prevents spam abuse.
  5. **Dual-Verdict Output:** Formats separate Scam Risk and Factual Claim assessments with citations and Helpline 1930 prompts.
  6. **Privacy by Default:** Zero message persistence; logs are stripped of credentials and sensitive content.

## D-017 — Phase 9: PayPal Sandbox Integration & Credit-Based Freemium Ledger
- **Date:** 2026-10-19
- **Status:** Implemented and Verified
- **Decision:** Implement a server-controlled credit-based freemium model and PayPal Sandbox integration without introducing external microservices or heavy SQL databases:
  1. **Idempotent Freemium Grant (`src/lib/payments/ledger.ts`):** Each eligible new user receives 3 free verification credits exactly once on their initial request. Repeated sign-ins, page reloads, and webhook retries cannot grant additional free credits.
  2. **Two-Phase Reservation & Commit Lifecycle (`src/lib/payments/creditGuard.ts`):**
     - Credits are reserved atomically before pipeline execution (`reserveCredits`), decrementing available balance while locking total balance.
     - On analysis success: credits are committed (`commitReservation`) and debited.
     - On analysis failure or provider timeout: reserved credits are immediately released back to the user (`releaseReservation`).
     - Race-Condition Protection: Per-user asynchronous mutex locks serialize concurrent requests to prevent double-spending.
  3. **Official PayPal Sandbox Integration (`src/lib/payments/paypalClient.ts`):**
     - Server-side OAuth 2.0 access-token acquisition with token caching.
     - PayPal Orders v2 API checkout creation (`POST /api/v1/payments/create-order`) and capture verification (`POST /api/v1/payments/capture-order`).
     - Strict verification: matches captured status (`COMPLETED`), amount, currency (`USD` or `INR`), and package configuration.
     - Webhook handler (`POST /api/v1/payments/webhook`) with cryptographic signature check (`verifyWebhookSignature`).
     - Safe refund reconciliation: reduces credit balances on `PAYMENT.CAPTURE.REFUNDED` while bounding balances at 0.
  4. **Durable Append-Only Transaction Journal:**
     - Journaled transactions (`.data/credit_ledger.jsonl`) record transaction ID, user ID, timestamp, type, amount, balanceAfter, reference, and reason.
  5. **Active Protection UX:**
     - Credit exhaustion never leaves users defenseless: the Essential Scam Safety Guidance card is rendered prominently, delivering vital Indian cybercrime rules (Helpline 1930, never share OTP/UPI PIN, no digital arrest) with direct links to the national reporting portal.
## D-018 — Phase 10: Node 22 Native SQLite for User Authentication, Persistent Scan History, and Data Migration
- **Date:** 2026-10-23
- **Status:** Implemented and Verified
- **Decision:** Implement zero-dependency native SQLite persistence using Node 22's built-in `node:sqlite` (`DatabaseSync`) in WAL mode for persistent user accounts, session tokens, searchable scan history, and financial transactions:
  1. **Zero-Dependency Native SQLite:** By leveraging Node 22's native `DatabaseSync`, SatyamAI eliminates external native C++ bindings (`better-sqlite3`, `sqlite3`), preventing cross-platform compiler mismatches or container deployment failures while retaining full ACID compliance.
  2. **Salted Scrypt Cryptography:** User passwords are hashed using Node's standard `crypto.scryptSync(password, salt, 64)` with unique 16-byte cryptographically random salts and constant-time verification (`crypto.timingSafeEqual`).
  3. **Dual-Mode Session Resolution:** Route handlers transparently accept either 30-day authenticated session tokens (`satyam_session_token` cookie or `Authorization: Bearer` header) or anonymous guest session identifiers (`x-user-id`).
  4. **Anonymous-to-Account Migration:** When a guest registers or logs in, `migrateUser` and `migrateAnonymousData` automatically transfer all remaining check balances, past transaction ledger rows, and scan records from the anonymous user to the new authenticated user.
  5. **Privacy-Preserving User History:** Saved analyses in SQLite can be searched by keyword or verdict, retrieved by ID, and deleted either individually or entirely via `DELETE /api/v1/history`, fulfilling Product Principle 5 (Privacy by Default).
  6. **Automated Test Validation:** 12 dedicated tests in `tests/sqliteAuthHistory.test.ts` verify table creation, user hashing, session expiration, search, privacy deletion, and data migration, bringing the total test suite to 218 passing tests across 19 suites.
