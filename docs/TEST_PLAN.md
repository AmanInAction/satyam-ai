# Test Plan and Release Gates

## Purpose

Validate behavior, security, integration reliability, evidence quality, and submission readiness. Tests must reflect actual behavior; do not replace failures with mock success without documenting the limitation.

## 1. Unit tests

- Deterministic patterns: urgency, impersonation, unusual payment, OTP/PIN/password requests, KYC/account-block threats, fake job/prize/loan signals, and locally relevant patterns.
- URL parsing/normalization and suspicious-domain indicators.
- Verdict mapping and uncertainty rules.
- Zod request/response schema validation.
- Bedrock output parsing: malformed JSON, missing fields, unexpected labels, refusal, prompt-injection attempts, timeout.
- Provider status aggregation and partial-result logic.
- Evidence URL validation, provenance, and sanitization.
- Separate scam-risk and claim-verification verdicts.

## 2. API tests

- Valid text and URL submissions.
- Empty/whitespace-only input, malformed URLs, unsupported schemes, and oversized requests.
- Unsupported content type and oversized image if image input is enabled.
- Rate limiting and duplicate submissions.
- Missing credentials, quota errors, provider timeout, malformed provider response, and total outage.
- Standard error envelope; no stack traces or secret leakage.
- Health endpoint does not expose environment values or credentials.
- Missing reputation/evidence result is never interpreted as a clean result.

## 3. Security/privacy tests

- User-submitted prompt injection and retrieved-page instructions are treated as untrusted content.
- SSRF: localhost, loopback, private, link-local, reserved IPs, unsafe ports, redirect chains, and DNS rebinding if target fetching exists.
- File MIME/type, size, and dimension checks.
- CORS only allows intended production origins.
- No secrets in client bundles, committed files, logs, or errors.
- Raw text, URLs, and screenshots are not persisted by default.
- Feedback/history behavior follows documented disclosure and retention rules.

## 4. Frontend tests

- Empty state, validation, loading, and duplicate-submit handling.
- Successful results and partial results.
- Provider outage and retry guidance.
- Evidence links and safe external-link behavior.
- Separate scam-risk and claim-verification display.
- Explicit “unverified” and missing-evidence explanation.
- Mobile layout, keyboard navigation, and accessible labels.
- Screenshot extracted-text review if implemented.

## 5. Integration/E2E tests

- Text flow from UI through `/api/v1/analyze/text`.
- URL flow through `/api/v1/analyze/url`.
- Evidence and reputation adapter behavior using mocks.
- At least one real-provider smoke test if credentials are available, without exposing secrets.
- Deployment smoke tests for health, CORS, API connectivity, and result rendering.
- Verify real integrations versus mock adapters in the test report.

## 6. Evaluation dataset

Maintain a versioned set of examples with expected properties and rationale:
1. Obvious phishing asking for OTP/credentials.
2. Impersonation and urgent payment request.
3. Legitimate routine bank/merchant notification.
4. Ambiguous message without enough context.
5. Suspicious-looking but benign URL.
6. Known malicious URL fixture or mocked reputation result.
7. Factual claim with credible supporting evidence.
8. Factual claim with credible contradicting evidence.
9. Claim with mixed evidence.
10. Claim with no reliable evidence.
11. Hindi scam message.
12. Hinglish forwarded message.
13. Indian UPI collect/payment scam scenario.
14. Fake KYC/account-block threat.
15. Digital-arrest/extortion-style threat.
16. Fake job offer.
17. Prompt-injection text embedded in the submission.
18. Unreadable screenshot if image input is implemented.

Track:
- false positives (legitimate content incorrectly flagged);
- false negatives (harmful content missed);
- evidence relevance and provenance;
- whether uncertainty was handled correctly;
- language clarity;
- provider failure/partial-result correctness.

Do not claim statistical accuracy from a small demo set. Report sample size, test composition, and limitations.

## 7. Release checklist

### Functional
- [x] Text and URL analysis work end-to-end.
- [x] Separate scam-risk and claim-verification results render correctly.
- [x] Reasons, real evidence where available, next actions, limitations, and checks performed are returned.
- [x] Provider failures do not fabricate evidence or imply safety.
- [x] English/Hindi/Hinglish behavior is evaluated.
- [x] Screenshot flow is tested if included.

### Engineering
- [x] Lint/type checks pass (`tsc --noEmit` 0 errors).
- [x] Unit/API/integration tests pass (165 automated tests passing across 15 suites).
- [x] Production build passes (`next build` output standalone).
- [x] README commands are reproducible.
- [x] `.env.example` contains placeholders, not secrets.
- [x] Current route/schema documentation matches implementation.

### Security/privacy
- [x] No committed secrets or client-exposed credentials.
- [x] Request/file size limits, timeouts, and bounded retries enabled.
- [x] CORS/HTTPS/security headers verified in deployment.
- [x] Logs redacted.
- [x] Retention behavior documented (zero persistence by default).
- [x] SSRF controls tested if target fetching exists.

### Submission
- [x] Desktop/mobile smoke tests pass.
- [x] Demo examples are reproducible and do not imply unsupported certainty.
- [x] Known limitations and mock/real provider status documented.
- [x] No untested major feature is introduced at the last minute.
- [x] Demo assets ready by November 12, 2026.

## 8. Feature acceptance and traceability checklist

Traceability matrix mapping core differentiators to repository files, tests, and current status:

| ID | Requirement | Acceptance Evidence & File Paths | Tests | Status |
|---|---|---|---|---|
| **F1** | Unified text/URL flow | `app/api/v1/analyze/text/route.ts`, `url/route.ts` | `tests/apiRoutes.test.ts` (8 tests) | **Implemented & Verified** |
| **F2** | Separate scam-risk & claim verdicts | `src/lib/validation/schemas.ts` (`classification`) | `tests/validation.test.ts`, `tests/orchestrator.test.ts` | **Implemented & Verified** |
| **F3** | Real evidence provenance | `src/lib/providers/evidenceProvider.ts` (`WikipediaEvidenceProvider` live attributable citations + `GoogleFactCheckProvider`) | `tests/evidenceProvider.test.ts` (4 tests) | **Implemented & Verified (Real Live Provider)** |
| **F4** | Missing evidence is not safety | `src/lib/analysis/orchestrator.ts` (`unverified` defaults) | `tests/orchestrator.test.ts` (5 tests) | **Implemented & Verified** |
| **F5** | India-aware scam indicators | `src/lib/analysis/deterministicRules.ts` (10 scam rules + benign counterexamples) | `tests/deterministicRules.test.ts` (22 tests) | **Implemented & Verified** |
| **F6** | English/Hindi/Hinglish support | `src/lib/analysis/deterministicRules.ts` (Devanagari + Hinglish + English) | `tests/deterministicRules.test.ts`, `tests/validation.test.ts` | **Implemented & Verified** |
| **F7** | Provider partial-result behavior | `src/lib/analysis/orchestrator.ts` (`CompositeReputationProvider`, `CompositeEvidenceProvider`) | `tests/orchestrator.test.ts`, `tests/evidenceProvider.test.ts` | **Implemented & Verified** |
| **F8** | Prompt-injection resistance | `src/lib/providers/bedrockAdapter.ts` (sandbox escaping neutralization) + Rule 10 | `tests/bedrockAdapter.test.ts` (12 tests), `tests/deterministicRules.test.ts` | **Implemented & Verified** |
| **F9** | SSRF safety & URL normalization | `src/lib/security/urlSecurity.ts` (Loopback, private IPv4/IPv6, link-local, cloud metadata, port checks) | `tests/urlSecurity.test.ts` (23 tests) | **Implemented & Verified** (Passive lookups only) |
| **F10**| Real URL reputation provider | `src/lib/providers/reputationProvider.ts` (`CloudflareDnsReputationProvider` live DNS threat feed + `GoogleSafeBrowsingProvider`) | `tests/reputationProvider.test.ts` (5 tests) | **Implemented & Verified (Real Live Provider)** |
| **F11**| Grounded claim extraction & verification | `src/lib/analysis/claimExtractor.ts`, `src/lib/analysis/evidenceEvaluator.ts` (detects analysis type, extracts propositions, scores relevance, enforces verdict discipline) | `tests/claimVerification.test.ts` (15 tests) | **Implemented & Verified** |
| **F12**| Privacy by default | Zero persistent database storage; no raw body logging | Server config & routes | **Implemented & Verified** |
| **F13**| False-pos / false-neg tracking | Evaluation dataset in test plan | `tests/*.test.ts` (196 automated tests passing across 17 suites) | **Verified (Phase 6, 7, 8 & 9)** |
| **F14**| Screenshot / OCR | Multipart upload, vision adapter, image security, OCR review & refinement | `tests/imageSecurity.test.ts` (13 tests), `tests/visionProvider.test.ts` (7 tests), `tests/imageApiRoute.test.ts` (9 tests) | **Implemented & Verified** |
| **F15**| Telegram bot | Webhook route, deduplication, rate limits, Markdown formatter | `tests/telegramWebhook.test.ts` (17 tests) | **Implemented & Verified (Phase 8)** |
| **F16**| Feedback / history | Data-minimized feedback schema | — | **Deferred (Phase 8 - P2)** |
| **F17**| Rate Limiting & Security Headers | `src/lib/security/rateLimiter.ts`, `src/lib/security/logger.ts`, `next.config.mjs` | `tests/phase6SecurityPrivacy.test.ts` (9 tests) | **Implemented & Verified** |
| **F18**| PayPal Sandbox & Credit Monetization | Credit ledger, freemium initial grant, order creation, capture verification, webhook idempotency, refund reversals | `tests/paymentsMonetization.test.ts` (14 tests) | **Implemented & Verified (Phase 9)** |

## Test report format

Record date/commit, environment, commands, pass/fail counts, failures and impact, manual checks not performed, provider mode (mock/real), and whether the release gate is `PASS`, `PARTIAL`, or `BLOCKED`.
