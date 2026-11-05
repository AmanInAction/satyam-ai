# Test Plan and Release Gates

## Purpose

Validate behavior, security, integration reliability, evidence quality, and submission readiness. Tests must reflect actual behavior; do not replace failures with mock success without documenting the limitation. Automated local pass status is not a production or manual-release sign-off.

## 1. Unit tests

- Deterministic patterns: urgency, impersonation, unusual payment, OTP/PIN/password requests, KYC/account-block threats, fake job/prize/loan signals, and locally relevant patterns. Image cases cover SBI-style reward/UPI PIN harvesting, cashback/OTP harvesting, Hindi credential requests, Hinglish payment verification, benign bank warnings, legitimate payment receipts, and unsupported rewards.
- URL parsing/normalization and suspicious-domain indicators.
- Verdict mapping and uncertainty rules.
- Zod request/response schema validation.
- Bedrock output parsing: malformed JSON, missing fields, unexpected labels, refusal, prompt-injection attempts, timeout.
- Provider status aggregation and partial-result logic.
- Structured Bedrock vision extraction, sanitized provider failure codes, configurable long-running inference timeout, and deterministic credential-risk precedence over inconclusive LLM output.
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
- Verify exactly what text, URLs, and extracted image text are persisted, for which user/session, and for how long.
- Verify user notice/consent, history access/deletion, and deployed-database deletion behavior.
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
- [x] Screenshot flow has automated route/provider/security tests.
- [ ] Manually verify primary flows in the deployed target environment.

### Engineering
- [x] Lint/type checks pass (`npm run lint`, `tsc --noEmit`; verified 2026-11-04).
- [x] Unit/API/integration tests pass (`npm test`: 234 tests across 20 files; verified 2026-11-04).
- [x] Production build passes (`npm run build`; verified 2026-11-04).
- [ ] Verify clean setup and README commands in a fresh environment.
- [x] `.env.example` contains placeholders, not secrets.
- [ ] Reconcile all route/schema/data-handling documentation with deployed behavior.

### Security/privacy
- [ ] Verify no secrets in repository history, deployment, client bundles, logs, or errors.
- [x] Request/file size limits, timeouts, and bounded retries are implemented and covered where applicable.
- [ ] Verify CORS/HTTPS/security headers in the target deployment.
- [x] Redacted logging is implemented.
- [x] Verify analysis previews/results are saved only with explicit per-check opt-in; document that saved records remain until deleted.
- [ ] Verify retention and deletion against the deployed database.
- [x] SSRF controls are tested; the application does not fetch arbitrary target pages.

### Submission
- [ ] Desktop/mobile and keyboard/accessibility smoke tests completed.
- [ ] Demo examples checked against configured provider behavior and do not imply unsupported certainty.
- [ ] Known limitations and target-environment mock/real provider status recorded.
- [ ] Final deployment smoke test completed.
- [ ] Demo assets ready by November 12, 2026.

## 8. Feature acceptance and traceability checklist

Traceability matrix mapping core differentiators to repository files, tests, and current status:

| ID | Requirement | Acceptance Evidence & File Paths | Tests | Status |
|---|---|---|---|---|
| **F1** | Unified text/URL flow | `app/api/v1/analyze/text/route.ts`, `url/route.ts` | `tests/apiRoutes.test.ts` (8 tests) | **Implemented & Verified** |
| **F2** | Separate scam-risk & claim verdicts | `src/lib/validation/schemas.ts` (`classification`) | `tests/validation.test.ts`, `tests/orchestrator.test.ts` | **Implemented & Verified** |
| **F3** | Real evidence provenance | `src/lib/providers/evidenceProvider.ts` (`WikipediaEvidenceProvider` attributable citations + optional `GoogleFactCheckProvider`) | `tests/evidenceProvider.test.ts` | **Adapter implemented; live availability not verified in this audit** |
| **F4** | Missing evidence is not safety | `src/lib/analysis/orchestrator.ts` (`unverified` defaults) | `tests/orchestrator.test.ts` (5 tests) | **Implemented & Verified** |
| **F5** | India-aware scam indicators | `src/lib/analysis/deterministicRules.ts` (10 scam rules + benign counterexamples) | `tests/deterministicRules.test.ts` (22 tests) | **Implemented & Verified** |
| **F6** | English/Hindi/Hinglish support | `src/lib/analysis/deterministicRules.ts` (Devanagari + Hinglish + English) | `tests/deterministicRules.test.ts`, `tests/validation.test.ts` | **Implemented & Verified** |
| **F7** | Provider partial-result behavior | `src/lib/analysis/orchestrator.ts` (`CompositeReputationProvider`, `CompositeEvidenceProvider`) | `tests/orchestrator.test.ts`, `tests/evidenceProvider.test.ts` | **Implemented & Verified** |
| **F8** | Prompt-injection resistance | `src/lib/providers/bedrockAdapter.ts` (sandbox escaping neutralization) + Rule 10 | `tests/bedrockAdapter.test.ts` (12 tests), `tests/deterministicRules.test.ts` | **Implemented & Verified** |
| **F9** | SSRF safety & URL normalization | `src/lib/security/urlSecurity.ts` (Loopback, private IPv4/IPv6, link-local, cloud metadata, port checks) | `tests/urlSecurity.test.ts` (23 tests) | **Implemented & Verified** (Passive lookups only) |
| **F10**| Real URL reputation provider | `src/lib/providers/reputationProvider.ts` (`CloudflareDnsReputationProvider` + optional `GoogleSafeBrowsingProvider`) | `tests/reputationProvider.test.ts` | **Adapter implemented; live availability not verified in this audit** |
| **F11**| Grounded claim extraction & verification | `src/lib/analysis/claimExtractor.ts`, `src/lib/analysis/evidenceEvaluator.ts` (detects analysis type, extracts propositions, scores relevance, enforces verdict discipline) | `tests/claimVerification.test.ts` (15 tests) | **Implemented & Verified** |
| **F12**| Privacy by default | Raw submissions are not persisted by default; explicit per-analysis opt-in and user deletion; no automatic expiry | `app/api/v1/analyze/*/route.ts`, `app/api/v1/history/route.ts`, `tests/apiRoutes.test.ts` | **Local behavior implemented; deployed deletion/no-expiry behavior remains to verify** |
| **F13**| False-pos / false-neg tracking | Versioned evaluation dataset and automated behavior tests; small dataset is not statistically representative | `src/lib/evaluation/evaluationDataset.ts`, `tests/evaluationBenchmark.test.ts` (suite total: 234 tests across 20 files on 2026-11-04) | **Automated checks pass; live/manual release checks remain** |
| **F14**| Screenshot / OCR | Multipart upload, Bedrock vision adapter, image security, OCR review & refinement; no fabricated fallback on outage | `tests/imageSecurity.test.ts`, `tests/visionProvider.test.ts`, `tests/imageApiRoute.test.ts` | **Implemented; real OCR depends on target Bedrock configuration** |
| **F15**| Telegram bot | Webhook route, deduplication, rate limits, Markdown formatter | `tests/telegramWebhook.test.ts` | **Implementation and automated tests pass; production bot/webhook exchange not verified** |
| **F16**| Scan history & Privacy | Opt-in SQLite/Turso history with keyword search, pagination, single-scan delete, and clear all | `tests/sqliteAuthHistory.test.ts`, `tests/tursoDatabase.test.ts`, `tests/apiRoutes.test.ts` | **Implemented; remote database verification pending** |
| **F17**| Rate Limiting & Security Headers | `src/lib/security/rateLimiter.ts`, `src/lib/security/logger.ts`, `next.config.mjs` | `tests/phase6SecurityPrivacy.test.ts` (9 tests) | **Implemented & Verified** |
| **F18**| PayPal Sandbox & Credit Monetization | Credit ledger, order creation/capture, webhook idempotency, refund reversals; client supports simulated orders when unconfigured | `tests/paymentsMonetization.test.ts`, `tests/paypalApprovalCapture.test.ts` | **Automated checks pass; real configured sandbox transaction not verified in this audit** |
| **F19**| SQLite Native Auth & Migration | Node 22 native `node:sqlite` in WAL mode, salted scrypt password hashing, session tokens, and automatic guest-to-account migration | `src/lib/db/database.ts`, `src/lib/db/schema.ts`, `app/api/v1/auth/*`, `tests/sqliteAuthHistory.test.ts` | **Local implementation/tests pass; remote Turso migration and deployment verification pending** |

## Test report format

Record date/commit, environment, commands, pass/fail counts, failures and impact, manual checks not performed, provider mode (mock/real), and whether the release gate is `PASS`, `PARTIAL`, or `BLOCKED`.

### Latest local verification (2026-11-04)

- `npm test`: **PASS**, 20 test files and 234 tests.
- `npm run lint`: **PASS**, `tsc --noEmit`.
- `npm run build`: **PASS**, Next.js production build.
- Not performed: production deployment, live third-party provider calls, configured PayPal sandbox transaction, Telegram exchange, Turso migration, browser/device/accessibility checks.
- Build warning: Next.js selected the parent `C:\Users\Asus\package-lock.json` as workspace root due to multiple lockfiles. The warning should be reviewed before deployment.
- Overall release gate: **PARTIAL**.
