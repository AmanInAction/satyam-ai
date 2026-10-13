# API Contract — Initial Proposal

**Status:** Draft baseline. The implemented Pydantic schemas and generated FastAPI OpenAPI document are authoritative once committed. Keep this document synchronized with them.

## Conventions

- API prefix: `/api/v1`
- Content type: `application/json`, except multipart upload endpoints if screenshot analysis is implemented.
- All external-provider credentials remain on the backend.
- Use structured response schemas. Never return the model's unvalidated free-form response as the complete API result.
- Include request IDs in logs/responses where useful, but never expose secrets or internal stack traces.

## Endpoint inventory

| Method | Path | Purpose | Priority |
|---|---|---|---|
| `GET` | `/api/v1/health` | Liveness/health check without leaking configuration | P0 |
| `POST` | `/api/v1/analyze/text` | Analyze a suspicious message or claim | P0 |
| `POST` | `/api/v1/analyze/url` | Assess a URL using safe parsing and configured reputation checks | P0 |
| `POST` | `/api/v1/analyze/image` | Extract and analyze screenshot content | P1 |
| `POST` | `/api/v1/feedback` | Accept minimal user feedback, if implemented | P1 |

Do not implement optional endpoints until their phase begins. Avoid a health endpoint that returns keys, environment values, provider secrets, or sensitive diagnostics.

## Text analysis request

`POST /api/v1/analyze/text`

```json
{
  "text": "Your account will be blocked. Pay a fee immediately using this link.",
  "language_hint": "auto"
}
```

Proposed validation:
- `text`: required, trimmed, non-empty, bounded length; initial suggested maximum 10,000 characters.
- `language_hint`: optional; `auto`, `en`, `hi`, or `hinglish` are initial suggestions. Final enum should match actual implementation.
- Reject unsupported content types and oversized requests.
- Do not log raw text by default.

## URL analysis request

`POST /api/v1/analyze/url`

```json
{
  "url": "https://example.com/path"
}
```

Proposed validation:
- Require a valid absolute URL.
- Permit only `http` and `https`.
- Normalize carefully without silently changing the destination.
- Do not fetch arbitrary target URLs from the backend unless the safe-fetch/SSRF requirements in `SOURCE_OF_TRUTH.md` are implemented and tested.
- Reputation lookups should be made through configured provider adapters.
- A provider timeout or missing API key must not be misrepresented as a clean result.

## Analysis response

Illustrative response. The final schema must be typed, versioned, and validated.

```json
{
  "analysis_id": "opaque-id",
  "input_type": "text",
  "verdict": "suspicious",
  "risk_level": "medium",
  "summary": "The message uses urgency and requests an unusual payment.",
  "reasons": [
    {
      "code": "urgency_pressure",
      "title": "Urgency pressure",
      "explanation": "The message pressures the recipient to act immediately.",
      "source_ref": null
    }
  ],
  "evidence": [
    {
      "title": "Example source title",
      "publisher": "Example publisher",
      "url": "https://example.org/reference",
      "relevance": "Explains the reported scam pattern."
    }
  ],
  "recommended_actions": [
    "Do not send money or share one-time passwords until independently verified.",
    "Contact the organization through its official website or app."
  ],
  "limitations": [
    "No definitive identity verification was performed."
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

The example source is illustrative only. Never emit placeholder evidence in real responses. If there are no reliable sources, return an empty evidence list and explain the limitation.

## Allowed verdicts

For scam/phishing assessment:
- `likely_scam`
- `suspicious`
- `unverified`
- `no_obvious_risk_found`

For claim verification, use a separate field or clearly separate result type:
- `supported`
- `contradicted`
- `unverified`

Do not combine scam likelihood and factual accuracy into one ambiguous verdict. Do not use `safe` as an absolute guarantee.

## Error shape

Use a consistent error response, for example:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Provide a valid message to analyze.",
    "request_id": "opaque-request-id"
  }
}
```

Do not expose stack traces, API keys, provider request headers, or internal infrastructure details. Keep messages useful but generic.

Suggested mappings:
- `400` or `422`: malformed or invalid input
- `413`: request/file too large
- `429`: rate limit exceeded
- `502`/`503`: required upstream service unavailable when no meaningful partial result can be returned
- `500`: unexpected internal error, with details only in redacted server logs

Use partial results when safe and meaningful; do not force every provider failure into a 500 response.

## Provider status values

Choose a finite enum such as `success`, `partial`, `unavailable`, `not_configured`, `not_applicable`, and `failed`. Do not include secrets or raw provider error bodies.

## Contract tests

- Validate normal request/response schemas.
- Reject empty, malformed, and oversized inputs.
- Verify provider timeout and malformed model-output behavior.
- Verify evidence URLs are valid and are not fabricated.
- Verify that provider failures cannot be mistaken for a clean reputation result.
- Verify no sensitive request content is written to normal application logs.
