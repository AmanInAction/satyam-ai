# Test Plan and Release Gates

## Purpose

Validate product behavior, security boundaries, integration reliability, and submission readiness. Tests must verify actual behavior; do not replace failing tests with mocked success without documenting the limitation.

## Test layers

### 1. Unit tests
- Deterministic text rules: urgency, impersonation cues, payment requests, credential/OTP requests, suspicious link patterns.
- URL normalization and parsing.
- Verdict mapping and uncertainty rules.
- Pydantic schema validation.
- Model output parsing, including malformed JSON, missing fields, unexpected labels, and provider refusal.
- Provider status aggregation and partial-result logic.
- Output sanitization and evidence URL validation.

### 2. API tests
- Valid text and URL requests.
- Empty input, whitespace-only input, malformed URL, unsupported scheme, and oversized input.
- Unsupported content type and oversized screenshot (if enabled).
- Rate limiting.
- Provider timeout, missing credentials, quota errors, malformed provider responses, and total provider outage.
- Consistent error schema and no stack-trace leakage.
- Health endpoint does not expose secrets or sensitive configuration.

### 3. Security tests
- Prompt-injection text in user submissions and retrieved pages is treated as untrusted content.
- SSRF defenses for localhost, loopback, private, link-local, reserved IPs, unsafe ports, redirects, and DNS changes if target fetching exists.
- File upload MIME/type and size validation.
- CORS only permits intended frontend origins in deployment.
- Secrets are not present in frontend bundles, logs, committed files, or error responses.
- No raw submitted content is persisted unless explicitly designed, disclosed, and covered by retention rules.

### 4. Frontend tests
- Empty state and input validation.
- Loading state and duplicate-submit handling.
- Successful result rendering.
- Partial-result state when one provider is unavailable.
- Generic error state with retry guidance.
- Evidence links are clickable and opened safely.
- Mobile layout and keyboard navigation.
- Clear distinction between “no evidence found” and “evidence of safety.”

### 5. Integration and end-to-end tests
- Full text-analysis flow from UI to API and back.
- Full URL-analysis flow with provider adapters mocked.
- At least one integration smoke test using real provider credentials, if available and safe.
- Deployment smoke test for health, CORS, API connectivity, and result rendering.

## Evaluation dataset

Maintain a small versioned test set with expected properties, not necessarily a single rigid verdict:
1. Obvious phishing message asking for credentials or OTP.
2. Impersonation and urgent payment request.
3. Legitimate routine notification.
4. Ambiguous message with insufficient context.
5. Suspicious-looking but benign URL.
6. Known malicious URL fixture or mocked reputation result.
7. Unsupported factual claim with no reliable evidence.
8. Claim with credible supporting evidence.
9. Claim with credible contradicting evidence.
10. Hindi scam message.
11. Hinglish forwarded message.
12. Malformed or adversarial prompt-injection content.
13. Unreadable screenshot, if image input is implemented.

Record false positives, false negatives, evidence quality, language clarity, and whether the response states uncertainty correctly. Do not claim statistical accuracy from a tiny demo set.

## Release checklist

### Functional
- [ ] Text analysis works end-to-end.
- [ ] URL analysis works end-to-end.
- [ ] Results include verdict, reasons, evidence when available, actions, limitations, and check status.
- [ ] Provider failures are handled without fabricated results.
- [ ] Hindi/Hinglish and image flows are tested if included.

### Engineering
- [ ] Lint and type checks pass.
- [ ] Unit and API tests pass.
- [ ] Frontend production build passes.
- [ ] Backend starts cleanly using documented commands.
- [ ] Environment variables are documented in `.env.example`.
- [ ] Clean setup is reproducible from README instructions.

### Security and privacy
- [ ] No committed secrets.
- [ ] No credentials in client bundle.
- [ ] Request and file size limits enabled.
- [ ] Timeouts and bounded retries enabled.
- [ ] CORS and HTTPS verified in deployment.
- [ ] Logs are redacted.
- [ ] Data retention and deletion behavior documented.
- [ ] SSRF protections tested if arbitrary URL fetching exists.

### Submission
- [ ] Deployed demo smoke-tested on desktop and mobile.
- [ ] Demo examples are reproducible.
- [ ] Known limitations are documented.
- [ ] No last-minute untested major feature.
- [ ] Demo script and submission assets are ready by November 12, 2026.

## Test report format

For each run, record:
- Date and commit/hash if available.
- Environment (local/staging/production).
- Commands executed.
- Pass/fail counts.
- Failures and their impact.
- Manual checks not performed.
- Whether the release gate passes, partially passes, or is blocked.
