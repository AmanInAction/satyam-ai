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

## Pending verification
- **Real AWS Bedrock live API call:** **VERIFIED** on 2026-10-18 using live AWS Bedrock `Converse` API in `ap-south-1` (`meta.llama3-70b-instruct-v1:0` with automatic fallback for legacy model IDs and seamless permanent IAM AKIA credential handling). Live responses returned high-confidence scam detection and claim debunking with 5.3s latency.
- Google Fact Check Tools API and Google Safe Browsing API keys (optional key-based providers; live Cloudflare Security DNS and Wikipedia Search operate out-of-the-box).
- Telegram stretch channel (Phase 8 / Stretch).



