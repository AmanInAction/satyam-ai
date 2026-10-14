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
- [ ] Text and URL analysis work end-to-end.
- [ ] Separate scam-risk and claim-verification results render correctly.
- [ ] Reasons, real evidence where available, next actions, limitations, and checks performed are returned.
- [ ] Provider failures do not fabricate evidence or imply safety.
- [ ] English/Hindi/Hinglish behavior is evaluated.
- [ ] Screenshot flow is tested if included.

### Engineering
- [ ] Lint/type checks pass.
- [ ] Unit/API/integration tests pass or failures are explicitly recorded.
- [ ] Production build passes.
- [ ] README commands are reproducible.
- [ ] `.env.example` contains placeholders, not secrets.
- [ ] Current route/schema documentation matches implementation.

### Security/privacy
- [ ] No committed secrets or client-exposed credentials.
- [ ] Request/file size limits, timeouts, and bounded retries enabled.
- [ ] CORS/HTTPS/security headers verified in deployment.
- [ ] Logs redacted.
- [ ] Retention behavior documented.
- [ ] SSRF controls tested if target fetching exists.

### Submission
- [ ] Desktop/mobile smoke tests pass.
- [ ] Demo examples are reproducible and do not imply unsupported certainty.
- [ ] Known limitations and mock/real provider status documented.
- [ ] No untested major feature is introduced at the last minute.
- [ ] Demo assets ready by November 12, 2026.

## 8. Feature acceptance and traceability checklist

Traceability matrix mapping core differentiators to repository files, tests, and current status:

| ID | Requirement | Acceptance Evidence & File Paths | Tests | Status |
|---|---|---|---|---|
| **F1** | Unified text/URL flow | `app/api/v1/analyze/text/route.ts`, `url/route.ts` | `tests/apiRoutes.test.ts` | **Implemented** |
| **F2** | Separate scam-risk & claim verdicts | `src/lib/validation/schemas.ts` (`classification`) | `tests/validation.test.ts`, `tests/orchestrator.test.ts` | **Implemented** |
| **F3** | Real evidence provenance | `src/lib/validation/schemas.ts` (`source_type`, `evidence_refs`) | `tests/validation.test.ts` | **Schema Implemented / Mock Provider** |
| **F4** | Missing evidence is not safety | `src/lib/analysis/orchestrator.ts` (`unverified` defaults) | `tests/orchestrator.test.ts` | **Implemented** |
| **F5** | India-aware scam indicators | `src/lib/analysis/deterministicRules.ts` (10 scam rules + benign counterexamples) | `tests/deterministicRules.test.ts` (22 tests) | **Implemented** |
| **F6** | English/Hindi/Hinglish support | `src/lib/analysis/deterministicRules.ts` (Devanagari + Hinglish + English) | `tests/deterministicRules.test.ts`, `tests/validation.test.ts` | **Implemented** |
| **F7** | Provider partial-result behavior | `src/lib/analysis/orchestrator.ts` (`faultyOrchestrator` test) | `tests/orchestrator.test.ts` | **Implemented** |
| **F8** | Prompt-injection resistance | `src/lib/providers/bedrockAdapter.ts` (sandbox escaping neutralization) + Rule 10 | `tests/bedrockAdapter.test.ts`, `tests/deterministicRules.test.ts` | **Implemented** |
| **F9** | SSRF safety if target fetching exists | `UrlAnalysisRequestSchema` protocol guards; passive lookup only | `tests/apiRoutes.test.ts` | **Implemented** (Direct fetching disabled) |
| **F10**| Privacy by default | Zero persistent database storage; no raw body logging | Server config & routes | **Implemented** |
| **F11**| False-pos / false-neg tracking | Evaluation dataset in test plan | `tests/*.test.ts` | **Partial** (Expanded in Phase 7) |
| **F12**| Screenshot / OCR | Multipart upload, vision adapter | — | **Deferred (P1)** |
| **F13**| Telegram bot | Reuses `/api/v1/analyze` pipeline | — | **Deferred (P2 / Stretch)** |
| **F14**| Feedback / history | Data-minimized feedback schema | — | **Deferred (P1)** |

## Test report format

Record date/commit, environment, commands, pass/fail counts, failures and impact, manual checks not performed, provider mode (mock/real), and whether the release gate is `PASS`, `PARTIAL`, or `BLOCKED`.
