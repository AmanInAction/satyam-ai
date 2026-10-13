# Agent Instructions — Proactive Next Steps

Read `SOURCE_OF_TRUTH.md`, `DEVELOPMENT_ROADMAP.md`, `docs/COMPETITIVE_GAP_ANALYSIS.md`, `docs/API_CONTRACT.md`, `docs/TEST_PLAN.md`, and `docs/DECISIONS.md` before implementation.

## First: inspect, do not assume

1. Check git status, current branch, repository structure, `package.json`, route files, Zod schemas, provider adapters, orchestrator, UI, environment examples, tests, and deployment config.
2. Run the existing documented test/lint/build commands. Record actual results.
3. Confirm the existing full-stack Next.js architecture remains intact. Do not recreate FastAPI/Express/Vite.
4. Identify which providers are real and which are mocks. Verify whether Bedrock, evidence retrieval, and URL reputation are actually configured.
5. Create/update a requirement map with statuses: `implemented`, `partial`, `missing`, `blocked`, `deferred`.

## Implementation order

### Step A — contract and result model
- Compare `docs/API_CONTRACT.md` with current Zod schemas and actual route outputs.
- If missing, add separate `scam_risk` and `claim_verification` dimensions without breaking existing clients unexpectedly.
- Include reasons, evidence provenance/relevance, recommended actions, limitations, checks performed, and provider statuses.
- Add schema tests before UI changes.

### Step B — analysis orchestration
- Verify deterministic rules, Bedrock adapter, evidence adapter, and reputation adapter are separate.
- Keep submitted text and retrieved pages untrusted; protect against prompt injection.
- Ensure provider errors, missing credentials, no evidence, and conflicting signals have distinct outcomes.
- Do not treat model output as source evidence.
- Do not replace real integrations with hardcoded success. If credentials are missing, test a clearly labeled mock path and report the blocker.

### Step C — evidence retrieval and URL reputation
- Confirm one real evidence provider and one real reputation provider can be used with current credentials and terms.
- Verify current official API docs, AWS region/model availability, cost, quota, privacy, and error behavior before selecting/implementing providers.
- Keep all secrets server-side.
- Prefer reputation lookups over fetching target pages. If fetching exists, test SSRF defenses.
- Return only real evidence with verifiable source links and provenance.

### Step D — user experience
- Ensure results explain the verdict, key signals, evidence, missing checks, uncertainty, and next safe action.
- Use plain English/Hindi/Hinglish when supported.
- Keep scam risk and claim truth as separate concepts.
- Distinguish “no evidence found” from “evidence of safety.”
- Make mobile, keyboard, loading, error, and partial-result states usable.

### Step E — tests and evaluation
- Add legitimate counterexamples for each deterministic rule.
- Test English, Hindi, Hinglish, suspicious and benign URLs, supported/contradicted/mixed/unverified claims, provider outages, and prompt injection.
- Track false positives and false negatives separately.
- Do not report accuracy percentages as meaningful without a sufficiently designed dataset.
- Run tests, lint/type checks, and production build; report real output.

### Step F — screenshot and Telegram only after core is stable
- Screenshot: strict upload limits, OCR/vision adapter, extracted text review, same analysis pipeline.
- Telegram: reuse same orchestrator and schemas; rate limit; do not duplicate business logic; minimize data retention.
- If the release window is at risk, defer both rather than weakening P0.

## Required completion report

For each work session, report:
1. Current state and requirements changed.
2. Files changed and why.
3. Commands actually run and results.
4. Real vs mock provider status.
5. Manual checks and credentials still needed.
6. Security/privacy issues and known limitations.
7. Roadmap and decision-log updates.
8. One clear next action.

Never say a feature is complete because the docs mention it. Never claim the repository itself was updated unless the code changes were actually applied and verified.
