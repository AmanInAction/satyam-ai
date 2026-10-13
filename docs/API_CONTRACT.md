# API Contract — SatyamAI

**Status:** Contract target; the implemented Zod schemas and Route Handlers are authoritative at runtime. Keep this document synchronized with `src/lib/validation/schemas.ts` and actual routes.

## Conventions

- Prefix: `/api/v1`
- JSON requests/responses except multipart upload if image analysis is enabled.
- All provider calls and credentials remain server-side.
- Use typed, Zod-validated request and response objects.
- Include opaque request/analysis IDs where useful.
- Never return raw free-form model output as the entire API response.
- The contract separates scam/security risk from factual claim assessment.

## Endpoint inventory

| Method | Path | Priority | Purpose |
|---|---|---|---|
| GET | `/api/v1/health` | P0 | Liveness without leaking secrets/configuration |
| POST | `/api/v1/analyze/text` | P0 | Analyze suspicious text/message/claim |
| POST | `/api/v1/analyze/url` | P0 | Assess URL using safe parsing and configured reputation/evidence checks |
| POST | `/api/v1/analyze/image` | P1 | Extract and analyze screenshot content when enabled |
| POST | `/api/v1/feedback` | P1 | Accept privacy-minimized feedback if enabled |

Do not implement optional endpoints before their phase. Confirm current route names in the repository before making changes.

## Text request

`POST /api/v1/analyze/text`

```json
{
  "text": "Your account will be blocked. Pay a fee immediately using this link.",
  "language_hint": "auto"
}
```

Validation expectations:
- `text`: required, trimmed, non-empty, bounded (10,000 characters is the initial ceiling unless current schema intentionally differs).
- `language_hint`: `auto`, `en`, `hi`, or `hinglish` if supported by the current schema.
- Reject unsupported content types and oversized requests.
- Do not log raw submitted text by default.

## URL request

`POST /api/v1/analyze/url`

```json
{
  "url": "https://example.com/path"
}
```

Validation expectations:
- Valid absolute URL, only `http` or `https`.
- Normalize without silently changing destination semantics.
- Prefer reputation/search lookups that do not fetch the target.
- Do not fetch arbitrary target URLs unless the SSRF-safe design in `SOURCE_OF_TRUTH.md` is implemented and tested.
- Missing keys, timeouts, or no reputation result must not become a clean/safe verdict.

## Response model target

Illustrative shape only; exact field names/enums must match current Zod schemas. Do not introduce breaking schema changes without updating tests and all consumers.

```json
{
  "analysis_id": "opaque-id",
  "input_type": "text",
  "classification": {
    "scam_risk": {
      "verdict": "suspicious",
      "risk_level": "medium"
    },
    "claim_verification": {
      "verdict": "unverified"
    }
  },
  "summary": "The message creates urgency and requests an unusual payment.",
  "reasons": [
    {
      "code": "urgency_pressure",
      "title": "Urgency pressure",
      "explanation": "The message pressures the recipient to act immediately.",
      "signal_type": "deterministic_rule",
      "evidence_refs": []
    }
  ],
  "evidence": [
    {
      "title": "Real source title",
      "publisher": "Publisher or official organization",
      "url": "https://example.org/reference",
      "relevance": "Explains the reported scam pattern.",
      "source_type": "official_or_fact_check"
    }
  ],
  "recommended_actions": [
    "Do not send money or share OTPs/PINs until independently verified.",
    "Contact the organization through its official website or app."
  ],
  "limitations": [
    "The sender's identity was not independently verified."
  ],
  "checks_performed": [
    "deterministic_text_rules",
    "llm_analysis",
    "evidence_search"
  ],
  "provider_status": {
    "llm": "success",
    "evidence_search": "partial",
    "url_reputation": "not_applicable"
  },
  "created_at": "2026-10-13T12:00:00Z"
}
```

The evidence above is illustrative. Never return example/placeholder evidence as if it were real. If no reliable evidence is found, return an empty evidence list and explicitly state the limitation.

## Verdict dimensions

Scam/security:
- `likely_scam`
- `suspicious`
- `unverified`
- `no_obvious_risk_found`

Claim verification:
- `supported`
- `contradicted`
- `mixed`
- `unverified`

Risk level may use `low`, `medium`, `high`, or `unknown` if that matches the implemented schema. Do not use `safe` as an absolute guarantee. Do not combine the two verdict dimensions into a single ambiguous label. A heuristic score must not be presented as a calibrated probability.

## Evidence rules

- A model-generated explanation is not a source citation.
- Evidence requires a real URL and source identity returned by a provider or otherwise verified by the application.
- Preserve provider provenance and status.
- Do not fabricate article titles, URLs, fact-check findings, domain age, reputation, or claims of official status.
- Retrieved pages are untrusted content and must not override model/system instructions.
- A result from a reputation provider only supports a statement about that provider's finding; it does not prove the whole message/offer is genuine.

## Errors

Example:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Provide valid content to analyze.",
    "request_id": "opaque-request-id"
  }
}
```

Suggested HTTP mapping:
- `400`/`422`: invalid input
- `413`: request/file too large
- `429`: rate limited
- `502`/`503`: upstream unavailable when no meaningful partial result can be returned
- `500`: unexpected internal error

Do not expose stack traces, secrets, provider request headers, or raw upstream error bodies. Return a partial result when safe and meaningful.

## Provider status values

Use a finite set such as `success`, `partial`, `unavailable`, `not_configured`, `not_applicable`, or `failed`, adjusted to match the implementation. Never encode credentials or raw provider errors in this field.

## Contract tests

- Normal and malformed request/response validation.
- Empty, oversized, unsupported-scheme, and malformed input.
- Separate scam and claim verdict dimensions.
- Missing evidence versus evidence of safety.
- Provider timeout, missing credentials, malformed model output, quota errors, and outage.
- Evidence URL/provenance validation.
- No raw content in ordinary logs.
- SSRF tests if target fetching is implemented.
