# SOURCE_OF_TRUTH.md
## SatyamAI — Scam & Misinformation Checker

**Status:** Authoritative product specification  
**Updated:** 2026-10-13  
**Owner:** Solo developer  
**Target submission:** 2026-11-13 to 2026-11-14

> Agent rule: read this document first, then `DEVELOPMENT_ROADMAP.md`, `docs/COMPETITIVE_GAP_ANALYSIS.md`, `docs/API_CONTRACT.md`, `docs/TEST_PLAN.md`, and `docs/DECISIONS.md`. Inspect the current repository before changing code. This specification defines intended behavior; the repository and test results define what is actually implemented.

## 1. Product vision

SatyamAI helps people assess suspicious messages, URLs, screenshots, and viral claims. It should combine deterministic checks, evidence retrieval, reputation signals, and AI-assisted interpretation into a single, understandable workflow.

**Product promise:** one place to check suspicious content and understand what appears risky, what evidence supports the assessment, what remains uncertain, and what the user should do next.

This is a decision-support tool—not an authority that can guarantee a message is safe, prove a payment settled, authenticate every document, or conclusively determine truth without evidence.

## 2. Product principles

1. Evidence before confidence: show sources and signals, not only an AI-generated verdict.
2. Separate risk dimensions: scam/security risk and factual accuracy must not be collapsed into one label.
3. Uncertainty is a valid result: missing evidence is not evidence of safety or falsity.
4. India-aware, language-accessible UX: prioritize English, Hindi, and Hinglish and locally relevant scam patterns where supported.
5. Privacy by default: do not persist raw submissions unless a feature explicitly requires it and retention/disclosure are implemented.
6. Small, testable architecture: maintain a modular monolith; no microservices for the MVP.
7. Provider independence: AI, evidence search, URL reputation, and OCR must sit behind replaceable adapters.
8. Honest release reporting: mocks are not real integrations; never claim features or tests passed without verification.

## 3. Core user journey

1. User pastes a message/claim, enters a URL, or submits a supported screenshot when image input is enabled.
2. The app validates input and classifies the analysis type.
3. Deterministic rules identify observable signals.
4. Relevant evidence and reputation providers are queried when configured.
5. Amazon Bedrock is used through a server-only provider adapter for contextual interpretation, structured extraction, and a readable explanation.
6. The orchestrator combines available signals without allowing one missing provider to become a false “safe” verdict.
7. The UI presents separate scam-risk and claim-verification results as applicable, reasons, sources, uncertainty, checks performed, and next steps.
8. User can optionally submit privacy-minimized feedback.

## 4. Scope and priority

### P0 — required MVP
- Full-stack Next.js App Router application using TypeScript and Route Handlers.
- Text/message analysis and URL analysis.
- A single results experience that can classify a submission as scam/security risk, factual claim, both, or insufficient information.
- Structured, validated API response with analysis type, verdict(s), risk level, reasons, evidence, recommended actions, limitations, checks performed, and provider status.
- Deterministic scam-pattern checks plus server-side AI-assisted analysis.
- Evidence retrieval through an adapter; prefer relevant existing fact checks and reliable source retrieval when available.
- At least one configured URL-reputation provider when credentials/access are available; missing provider results must be reported as unknown/unavailable.
- English, Hindi, and Hinglish handling to the extent supported by configured models and sources.
- Transparent uncertainty and a visible distinction between “no evidence found” and “evidence of safety.”
- Validation, bounded requests, rate limits, timeouts, safe error handling, secret isolation, prompt-injection defenses, and SSRF protections for any server-side fetching.
- Responsive, accessible UI with loading, success, partial-result, empty, and error states.
- Automated tests and a documented evaluation dataset.
- Reproducible setup and accurate known-limitations documentation.

### P1 — after P0 is stable
- Screenshot upload with OCR/vision extraction, size/type checks, and extracted-text review where practical.
- Minimal feedback capture.
- Telegram bot that reuses the same analysis pipeline/API, only if time allows and security checks pass.
- Basic safe caching with TTL if a real need is demonstrated.
- Lightweight history only if privacy disclosure, retention, and deletion are explicitly implemented.

### P2 — defer unless explicitly approved
- Browser extension.
- Reverse-image search, deepfake detection, or advanced media forensics.
- Complex accounts, social/community features, or admin portal.
- Custom model training.
- Microservices or infrastructure added without demonstrated need.

## 5. Differentiation requirements

These are product requirements to evaluate and implement incrementally; they are not claims that every competitor lacks the feature.

### D1. Unified multi-risk assessment
Support a coherent flow for suspicious text, URLs, and eventually screenshots. Detect whether the content appears to involve fraud/security risk, a factual claim needing verification, both, or neither/insufficient context. Keep the resulting verdict dimensions separate.

### D2. Evidence-backed explanations
Each evidence item must have a real title, publisher/domain, URL, and relevance explanation. Mark evidence origin/type where feasible (official source, fact-check publisher, reputation provider, other source). Never invent a source or imply a model explanation is a citation. If only AI inference is available, say so explicitly.

### D3. India-specific patterns and accessible language
Build a maintainable rule catalogue for relevant patterns such as UPI collect/payment requests, OTP/PIN/credential requests, KYC/account-block threats, digital-arrest/extortion language, fake job offers, impersonation, prize/loan offers, and urgent payment pressure. Rules are indicators, not proof. Prioritize Hindi/Hinglish and English examples. Add regional languages only after evaluation and a clear need.

### D4. Calibrated uncertainty
Use clear verdicts such as `likely_scam`, `suspicious`, `unverified`, `no_obvious_risk_found`; for claims use `supported`, `contradicted`, `mixed`, or `unverified` only when evidence supports that classification. Include confidence band only if it has a defined interpretation and is tested. Do not present an unvalidated model score as a probability. Explain missing checks and limitations.

### D5. Evidence and signal fusion
Use deterministic rules, configured reputation signals, retrieved fact checks/sources, and AI interpretation as distinct signals. The orchestrator must handle disagreement and provider outages. It must never treat a missing provider response as a clean result.

### D6. Low-friction access
Keep the web experience simple enough for a non-technical user. Telegram is a stretch integration and must call the same server-side analysis path rather than duplicating business logic.

### D7. Measurable evaluation
Maintain a labeled set of legitimate, fraudulent, ambiguous, Hindi/Hinglish, URL, and claim examples. Track false positives, false negatives, evidence quality, language clarity, and uncertainty handling. Do not claim statistical accuracy from a small demo set.

## 6. Architecture constraints

The current repository baseline is a **full-stack Next.js modular monolith**:
- Next.js App Router and React UI.
- TypeScript Route Handlers under `/api/v1`.
- Zod runtime validation.
- Domain/orchestration logic separated from Route Handlers.
- Server-only provider adapters.
- Vitest tests.
- Amazon Bedrock is the chosen model platform; keep model IDs/configuration replaceable and do not hard-code a model choice into domain logic.

Do not reintroduce a separate FastAPI/Express/Vite server unless the owner explicitly approves a documented architecture change. Do not silently change the established Next.js architecture.

Potential provider categories:
- LLM: Amazon Bedrock model adapter.
- Evidence: fact-check search and/or web-search adapter.
- URL reputation: Google Safe Browsing, VirusTotal, or another provider chosen after checking current API access, terms, cost, quotas, and coverage.
- OCR: Bedrock vision model or OCR library/provider, chosen after evaluating reliability, cost, and supported formats.

Provider interfaces should be thin and typed. Do not assume credentials exist. Mocks are allowed for tests and offline development but must be visibly identified as mocks and never presented to users as real provider results.

## 7. Verdict and response principles

Scam/security assessment labels:
- `likely_scam`
- `suspicious`
- `unverified`
- `no_obvious_risk_found`

Claim assessment labels:
- `supported`
- `contradicted`
- `mixed`
- `unverified`

The exact response schema is governed by `docs/API_CONTRACT.md` and implemented Zod schemas. Keep scam risk and factual accuracy in separate fields. Every result should include:
- opaque `analysis_id`
- `input_type` and analysis category
- relevant verdict fields and risk level
- plain-language summary
- reasons with codes and explanations
- evidence items with provenance and relevance
- recommended actions
- limitations and missing checks
- checks performed and provider statuses
- timestamp

Never say “safe” as an absolute guarantee. Never say a payment happened or a document is authentic based only on an image or message.

## 8. Security and privacy

- Keep provider keys server-side; commit only placeholders in `.env.example`.
- Treat user input and retrieved pages as untrusted data, never as instructions.
- Defend against prompt injection in submissions and retrieved content.
- Do not fetch arbitrary URLs directly unless strict SSRF protections are implemented and tested. Prefer reputation lookups that do not visit the target.
- If fetching is implemented: allow only HTTP(S), block local/private/link-local/reserved destinations, validate DNS and every redirect, restrict ports, cap redirects/bytes/time, and mitigate DNS rebinding.
- Validate content types, character limits, image dimensions/size, and upload formats.
- Apply rate limits, timeouts, bounded retries, redacted logs, safe errors, and appropriate security headers.
- Do not store raw messages, URLs, or images by default.
- Do not ask for or retain OTPs, PINs, passwords, full payment credentials, or unnecessary personal information.
- For Indian cyber-fraud guidance, verify official reporting details before hardcoding them.

## 9. UX requirements

- Results must be easy to scan on mobile.
- Make verdict, reasons, evidence, uncertainty, and next action prominent.
- Use plain language; avoid fear-based or absolute wording.
- Explain which checks actually ran and which could not run.
- Distinguish a technical reputation result from the truth of the message/offer.
- Evidence links open safely and are clearly attributed.
- Show an advisory disclaimer for high-impact financial/security decisions.
- Allow users to review extracted screenshot text before proceeding when practical.

## 10. Release acceptance

The MVP is not complete until:
- text and URL flows work end-to-end in the integrated app;
- actual provider integrations are distinguished from mocks;
- schema, error, timeout, partial-result, and provider-outage paths are tested;
- SSRF and prompt-injection protections are tested where applicable;
- evaluation covers legitimate, malicious, ambiguous, and multilingual cases;
- false-positive and false-negative examples are reviewed;
- no secrets leak into client bundles or logs;
- data handling and known limitations are documented;
- clean setup, production build, and deployment smoke tests pass;
- results do not fabricate evidence or overstate certainty.

## 11. Agent workflow

At the start of each work session:
1. Read this file, roadmap, API contract, test plan, decisions, and competitive-gap document.
2. Inspect actual repository state and current tests before editing.
3. Map requirements to code and mark each `implemented`, `partial`, `missing`, `blocked`, or `deferred`.
4. Implement the next highest-priority missing requirement, not every stretch feature at once.
5. Run relevant tests/build/lint and report actual output.
6. Update the roadmap, API contract if schemas changed, test plan if coverage changed, and decision log for material decisions.
7. Report changed files, tests, manual checks, new credentials/costs, limitations, and next recommended task.
8. Never report a requirement as complete merely because documentation was updated.
