# Architecture and Product Decisions

Record material decisions here so the solo developer and coding agent can understand why the system is built this way.

**Rule:** Do not silently make major changes. Record date, decision, context, alternatives, trade-offs, and follow-up work. Routine reversible implementation choices do not need approval.

## Decision log

### D-001 — Modular monolith for the first release
- **Date:** 2026-10-13
- **Status:** Accepted baseline
- **Decision:** Use a Next.js frontend and a FastAPI backend, organized into clear modules rather than microservices.
- **Context:** Solo developer, fixed submission window, need to deliver and maintain a complete product.
- **Trade-off:** Less independent scaling than microservices, but substantially less operational complexity.
- **Review trigger:** Demonstrated scaling or ownership requirements that cannot be met by the modular monolith.

### D-002 — Provider integrations must use adapters
- **Date:** 2026-10-13
- **Status:** Accepted baseline
- **Decision:** Isolate LLM, evidence search, URL reputation, and OCR providers behind small interfaces.
- **Context:** Provider credentials, prices, quotas, and API behavior may vary.
- **Trade-off:** Small initial abstraction cost in exchange for easier provider replacement and testing.

### D-003 — No default persistence of raw submitted content
- **Date:** 2026-10-13
- **Status:** Accepted baseline
- **Decision:** Do not persist raw message text, URLs, or uploaded images by default.
- **Context:** Submitted content may include personal, financial, or otherwise sensitive data.
- **Trade-off:** No full analysis history by default. Any history feature requires explicit retention/deletion behavior and user disclosure.

### D-004 — Verdicts must express uncertainty
- **Date:** 2026-10-13
- **Status:** Accepted baseline
- **Decision:** Use cautious labels such as `likely_scam`, `suspicious`, `unverified`, and `no_obvious_risk_found`; do not present heuristic scores as calibrated probabilities.
- **Context:** False certainty could lead to financial or reputational harm.
- **Trade-off:** The product may sometimes return “unverified” rather than a definitive answer.

### D-005 — Core flow before optional differentiators
- **Date:** 2026-10-13
- **Status:** Accepted baseline
- **Decision:** Prioritize text analysis, URL analysis, explanations, evidence, testing, and deployment before Telegram, browser extension, deepfake detection, or advanced history.
- **Context:** The project is built by one developer with a November 13–14, 2026 submission window.
- **Trade-off:** Some features from the initial idea may be deferred.

## Pending decisions

Add an entry only when the repository audit or implementation reveals a material choice. Examples:
- Final LLM provider/model and budget.
- Evidence-search provider and its quota.
- URL reputation provider and key availability.
- OCR method and upload limits.
- Hosting provider and environment layout.
- Whether feedback/history is necessary for the submission.
