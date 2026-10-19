# SatyamAI — Scam & Misinformation Checker

SatyamAI helps people assess suspicious messages, URLs, screenshots (when enabled), and viral claims. It combines deterministic signals, reputation checks, source retrieval, and AI-assisted interpretation to explain potential risk, evidence, uncertainty, and next steps.

## Important product boundary

SatyamAI is an advisory decision-support tool. It does not guarantee that a message or website is safe, prove that a payment settled, authenticate every screenshot/document, or determine factual truth without evidence. “No evidence found” is not “safe.”

## Read the docs in this order

1. [`SOURCE_OF_TRUTH.md`](./SOURCE_OF_TRUTH.md) — canonical product specifications, competitive differentiation, safety, and agent workflow.
2. [`DEVELOPMENT_ROADMAP.md`](./DEVELOPMENT_ROADMAP.md) — phased roadmap, verified release gates, and agent execution playbook.
3. [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) — authoritative endpoint and response schemas (Zod).
4. [`docs/TEST_PLAN.md`](./docs/TEST_PLAN.md) — test strategy, evaluation fixtures, release gates, and feature traceability matrix (F1–F14).
5. [`docs/DECISIONS.md`](./docs/DECISIONS.md) — Architecture and Product Decision Records (ADRs D-001 through D-012).
6. [`docs/REPOSITORY_AUDIT.md`](./docs/REPOSITORY_AUDIT.md) — detailed repository audit, requirement-to-code traceability, and verification evidence.

## Architecture baseline

- Full-stack Next.js App Router and TypeScript.
- Route Handlers under `/api/v1`.
- Zod validation.
- Modular analysis orchestrator and server-only provider adapters.
- Amazon Bedrock as the chosen LLM platform, behind a replaceable adapter.
- Vitest for automated tests.

Do not reintroduce Express, Vite, or a separate FastAPI service without an explicitly approved decision record. The current repository—not a generic template—determines exact scripts and paths.

## Integrations

Potential provider categories:
- AI: Amazon Bedrock.
- Evidence: Google Fact Check Tools and/or a suitable web-search provider.
- URL reputation: Google Safe Browsing, VirusTotal, or another evaluated provider.
- OCR/vision: Bedrock vision model or a suitable OCR implementation.

Before connecting a provider, verify current official API docs, model availability in the intended AWS region, pricing, quotas, privacy terms, required secrets, and fallback behavior. Never expose credentials in browser code. Keep mocks visibly separate from real results.

## Local development

Use the scripts that actually exist in `package.json`. At minimum, the coding agent must verify and document:
- dependency installation (`npm install`);
- development server startup (`npm run dev`);
- lint/type-check command (`npm run lint`);
- test command (`npm test`);
- production build (`npm run build`);
- required environment variables (`.env.example`).

Do not guess commands or mark them verified without running them.

## Telegram Bot Integration

SatyamAI includes a production-grade Telegram Bot Webhook endpoint reusing the central analysis pipeline:

- **Webhook URL:** `https://<YOUR_DEPLOYED_DOMAIN>/api/v1/telegram/webhook`
- **Diagnostics Check:** `GET /api/v1/telegram/webhook`
- **Environment Variables:**
  - `TELEGRAM_BOT_TOKEN`: The API token provided by `@BotFather` (server-side only).
  - `TELEGRAM_WEBHOOK_SECRET`: Secret token for validating `X-Telegram-Bot-Api-Secret-Token` header.
- **Webhook Registration Command:**
  ```bash
  curl -F "url=https://<YOUR_DOMAIN>/api/v1/telegram/webhook" \
       -F "secret_token=<YOUR_TELEGRAM_WEBHOOK_SECRET>" \
       https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook
  ```
- **Features Supported:**
  - Commands: `/start`, `/help` (Bilingual English + Hindi with National Cyber Crime Helpline 1930).
  - Text & Forwarded Messages: Full scam risk & factual accuracy analysis.
  - Links: Phishing and domain spoofing assessment.
  - Deduplication: In-memory `update_id` cache prevents duplicate processing on network retries.
  - Per-Chat Rate Limiting: 30 requests/minute.
  - Zero raw message persistence.

## PayPal Sandbox & Credit Monetization Engine

SatyamAI implements an idempotent credit-based freemium architecture and official PayPal Sandbox integration:

- **Freemium Initial Grant:**
  - Every eligible new user automatically receives **3 free verification credits**, granted exactly once.
  - Idempotent: Repeated sign-ins, page reloads, and webhook retries never grant additional free credits.
- **Verification Credit Costs:**
  - Text message or viral claim check: **1 credit**.
  - Website link or URL inspection: **1 credit**.
  - Screenshot image OCR verification: **2 credits**.
- **PayPal Sandbox Purchase Packages:**
  - **Starter Package:** 10 Credits for $2.00 USD.
  - **Plus Package (Popular):** 30 Credits for $5.00 USD.
  - **Pro Security Package:** 100 Credits for $12.00 USD.
- **Durable Credit Ledger:**
  - Durable append-only journal (`.data/credit_ledger.jsonl`) recording chronological balance changes, references, and reasons.
  - Two-Phase Reservation & Commit: Credits are reserved prior to analysis execution and committed only upon success. On pipeline or provider failure, reserved credits are immediately restored.
  - Concurrent Mutex Locks: Prevents race conditions or double-spending.
  - PayPal Webhook Idempotency: Duplicate payment callbacks or webhooks cannot grant credits twice.
- **Active Scam Defense Guarantee:**
  - When credits are exhausted, SatyamAI's **Essential Scam Safety Guidance Card** activates, ensuring Indian users never lose access to critical cybercrime prevention guidance (National Cyber Crime Helpline 1930, never share OTP/UPI PIN, and no digital arrest).
- **Environment Configuration:**
  - `PAYPAL_CLIENT_ID`: PayPal Developer Sandbox App Client ID.
  - `PAYPAL_CLIENT_SECRET`: PayPal Developer Sandbox Secret.
  - `PAYPAL_WEBHOOK_ID`: PayPal Webhook ID for signature verification.
  - `PAYPAL_ENV`: Defaults to `sandbox` (`api-m.sandbox.paypal.com`).
  - Simulation Mode: When credentials are unconfigured in test/dev environments, safe sandbox simulation enables end-to-end checkout, capture, and verification without failing.

## Agent rules

Read the docs above, inspect current code, map requirements to implemented/partial/missing/blocked/deferred, then work on the highest-priority missing requirement. Update docs when schemas or decisions change. Report actual test outcomes and limitations honestly.
