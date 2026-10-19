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

## Image request

`POST /api/v1/analyze/image`

Supported Request Encodings:
1. `multipart/form-data`:
   - `file` or `image`: image binary upload (`image/png`, `image/jpeg`, `image/webp`).
   - `language_hint`: `auto`, `en`, `hi`, `hinglish` (optional).
2. `application/json`:
   - `image_data`: base64-encoded image string (with or without data URI scheme).
   - `mime_type`: `image/png`, `image/jpeg`, or `image/webp`.
   - `language_hint`: `auto`, `en`, `hi`, `hinglish` (optional).

Validation & Security expectations:
- File size capped at 5 MB (`MAX_IMAGE_SIZE_BYTES = 5,242,880`). Requests exceeding limit return HTTP 413 `FILE_TOO_LARGE`.
- Magic byte verification: validates container signatures (`PNG: \x89PNG\r\n\x1a\n`, `JPEG: \xFF\xD8\xFF`, `WebP: RIFF....WEBP`).
- Safe dimensions: parsed securely via binary headers without external dependencies; bounded between 50x50 and 8000x8000 px.
- Unreadable/blank image handling: returns safe `unverified` verdict, `insufficient_information` category, and `unknown` risk level without crashing or hallucinating safety.
- Sensitive credential guard: warns user if unmasked credit cards, CVVs, or netbanking passwords are detected in screenshot text.
- Adversarial prompt injection defense: instructions embedded within image text are treated as untrusted and cannot override system verdicts.
- Authenticity disclaimer: transparently records limitations that OCR cannot detect photoshop tampering, receipt forgery, or screenshot authenticity.

## Response model target

Illustrative shape only; exact field names/enums must match current Zod schemas. Do not introduce breaking schema changes without updating tests and all consumers.

```json
{
  "analysis_id": "an_73b26be02e6c0ca8",
  "input_type": "text",
  "analysis_type": "both",
  "extracted_claim": "Government announced free laptops under PM Yuva Scheme for all students.",
  "classification": {
    "analysis_type": "both",
    "scam_risk": {
      "verdict": "likely_scam",
      "risk_level": "high"
    },
    "claim_verification": {
      "verdict": "contradicted",
      "extracted_claim": "Government announced free laptops under PM Yuva Scheme for all students.",
      "verification_source": "fact_check_database"
    }
  },
  "summary": "Dual threat detected: Exhibits scam indicators (Urgency Pressure) while asserting factual claim \"Government announced free laptops under PM Yuva Scheme for all students.\". Claim is evaluated as CONTRADICTED.",
  "reasons": [
    {
      "code": "urgency_pressure",
      "title": "Urgency Pressure",
      "explanation": "Demands immediate action under threat of penalty or fee loss.",
      "signal_type": "deterministic_rule",
      "evidence_refs": []
    },
    {
      "code": "claim_contradicted",
      "title": "Claim Verification: CONTRADICTED",
      "explanation": "Independent fact-check records and official releases contradict or refute this claim.",
      "signal_type": "fact_check_database",
      "evidence_refs": ["https://factcheck.pib.gov.in/free-laptop-scam"]
    }
  ],
  "evidence": [
    {
      "title": "Fact Check: Government is NOT giving free laptops under Yuva Scheme",
      "publisher": "PIB Fact Check",
      "url": "https://factcheck.pib.gov.in/free-laptop-scam",
      "relevance": "PIB Fact Check warns that messages promising free laptops are fake and a front for UPI fee fraud.",
      "source_type": "fact_check_organization",
      "relevance_score": 0.85,
      "verification_finding": "contradicts"
    }
  ],
  "recommended_actions": [
    "Do not send money, UPI PINs, or personal details to register for unverified schemes.",
    "Verify official government schemes only via official .gov.in or .nic.in portals."
  ],
  "limitations": [
    "Heuristic analysis based on pattern recognition; verify independently with official sources."
  ],
  "checks_performed": [
    "claim_extractor",
    "deterministic_rules",
    "amazon_bedrock",
    "composite_evidence"
  ],
  "provider_status": {
    "llm": "success",
    "evidence": "success",
    "url_reputation": "not_applicable"
  },
  "created_at": "2026-10-16T12:00:00Z"
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
- No raw content in ordinary logs.
- SSRF tests if target fetching is implemented.

## Telegram Webhook Endpoints

### 1. `GET /api/v1/telegram/webhook`
Diagnostics and configuration status endpoint.
- **Headers:** None required.
- **Response `200 OK`:**
```json
{
  "status": "ok",
  "service": "satyam-ai-telegram-webhook",
  "version": "v1",
  "bot_token_configured": true,
  "webhook_secret_configured": true,
  "timestamp": "2026-10-18T14:01:30.697Z"
}
```

### 2. `POST /api/v1/telegram/webhook`
Main update handler receiving Telegram Bot API Webhook updates.
- **Security Header:** `X-Telegram-Bot-Api-Secret-Token` (validated against `TELEGRAM_WEBHOOK_SECRET` when configured).
- **Rate Limit:** 30 requests/minute per chat ID.
- **Deduplication:** Automatic `update_id` in-memory deduplication window (15 minutes).
- **Supported Commands:** `/start`, `/help`.
- **Supported Content:** Text messages, forwarded SMS/WhatsApp forwards, URLs.
- **Response `200 OK` (Direct Telegram reply payload):**
```json
{
  "method": "sendMessage",
  "chat_id": 1234567,
  "text": "🛡️ *SatyamAI Verification Report*\n━━━━━━━━━━━━━━━━━━━━━\n*Scam & Fraud Risk:* 🚨 *LIKELY SCAM* (High Risk)...",
  "parse_mode": "Markdown",
  "disable_web_page_preview": true,
  "reply_to_message_id": 1
}
```
- **Error Responses:**
  - `401 UNAUTHORIZED_WEBHOOK`: Secret token mismatch.
  - `400 INVALID_JSON`: Malformed update payload.

## Payment & Credit Monetization Endpoints

### 1. `GET /api/v1/payments/credits`
Retrieves current user credit balance, operation costs, and available PayPal purchase packages. Idempotently grants 3 free credits to new users on initial request.
- **Headers:** Optional `X-User-Id` (or session cookie `satyam_user_id`).
- **Response `200 OK`:**
```json
{
  "userId": "usr_9f81a7b_k2x89z",
  "balance": 3,
  "reserved": 0,
  "available": 3,
  "hasReceivedFreeGrant": true,
  "transactionsCount": 1,
  "costs": {
    "text": 1,
    "url": 1,
    "image": 2
  },
  "packages": [
    {
      "id": "starter",
      "name": "Starter Package",
      "nameHi": "स्टार्टर पैक",
      "credits": 10,
      "price": "2.00",
      "currency": "USD",
      "description": "10 Verification Credits for suspicious messages & URLs",
      "popular": false
    },
    {
      "id": "plus",
      "name": "Plus Package",
      "nameHi": "प्लस पैक",
      "credits": 30,
      "price": "5.00",
      "currency": "USD",
      "description": "30 Verification Credits (Best Value for Family Protection)",
      "popular": true
    },
    {
      "id": "pro",
      "name": "Pro Security Package",
      "nameHi": "प्रो सुरक्षा पैक",
      "credits": 100,
      "price": "12.00",
      "currency": "USD",
      "description": "100 Verification Credits for high-volume community checking",
      "popular": false
    }
  ],
  "paypal": {
    "isConfigured": false,
    "isSandbox": true
  }
}
```

### 2. `POST /api/v1/payments/create-order`
Creates a PayPal checkout order for a configured credit package.
- **Request:**
```json
{
  "packageId": "plus"
}
```
- **Response `200 OK`:**
```json
{
  "orderId": "SIM_ORDER_1792411819916_AF3O4",
  "packageId": "plus",
  "amount": "5.00",
  "currency": "USD",
  "status": "CREATED",
  "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=SIM_ORDER_1792411819916_AF3O4",
  "simulated": true
}
```

### 3. `POST /api/v1/payments/capture-order`
Captures an approved PayPal order and idempotently credits the user's ledger.
- **Request:**
```json
{
  "orderId": "SIM_ORDER_1792411819916_AF3O4",
  "packageId": "plus"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "orderId": "SIM_ORDER_1792411819916_AF3O4",
  "packageId": "plus",
  "creditsAdded": 30,
  "newBalance": 33,
  "captureId": "SIM_CAPTURE_1792411819932_OEPST"
}
```

### 4. `GET /api/v1/payments/transactions`
Returns the chronological transaction history from the durable credit ledger.
- **Headers:** Optional `X-User-Id` (or session cookie `satyam_user_id`).
- **Response `200 OK`:**
```json
{
  "userId": "usr_9f81a7b_k2x89z",
  "balance": 33,
  "available": 33,
  "transactions": [
    {
      "id": "tx_1792411819910_A1B2",
      "userId": "usr_9f81a7b_k2x89z",
      "timestamp": "2026-10-19T12:10:19.910Z",
      "type": "initial_grant",
      "amount": 3,
      "balanceAfter": 3,
      "reason": "Welcome freemium credit grant (3 free credits)",
      "metadata": { "packageId": "free_grant" }
    },
    {
      "id": "tx_1792411819930_C3D4",
      "userId": "usr_9f81a7b_k2x89z",
      "timestamp": "2026-10-19T12:10:19.930Z",
      "type": "purchase_credit",
      "amount": 30,
      "balanceAfter": 33,
      "reason": "Purchased Plus Package (30 credits) via PayPal Sandbox",
      "metadata": {
        "orderId": "SIM_ORDER_1792411819916_AF3O4",
        "captureId": "SIM_CAPTURE_1792411819932_OEPST",
        "packageId": "plus",
        "price": "5.00",
        "currency": "USD"
      }
    }
  ]
}
```

### 5. `POST /api/v1/payments/webhook`
Webhook endpoint receiving verified PayPal event notifications (`PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`).
- **Security:** Verified with PayPal webhook signature (`verifyWebhookSignature`).
- **Idempotency:** Webhook events are processed idempotently; duplicate events return `200 OK` with `already_processed: true`.


