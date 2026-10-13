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

## Pending verification
- Actual Bedrock integration and chosen model/region.
- Real evidence provider and URL reputation provider.
- Screenshot/OCR implementation.
- Current test count and build result after this documentation update.
- Whether Telegram can fit without jeopardizing the submission target.
