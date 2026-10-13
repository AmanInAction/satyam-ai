# Competitor-Inspired Feature Acceptance Checklist

Use this as a traceability checklist during implementation.

| ID | Requirement | Acceptance evidence | Priority |
|---|---|---|---|
| F1 | Unified text/URL flow | End-to-end tests for both inputs | P0 |
| F2 | Separate scam-risk and claim verdicts | Schema + UI tests show separate dimensions | P0 |
| F3 | Real evidence provenance | Test verifies title/publisher/URL/relevance; no placeholders | P0 |
| F4 | Missing evidence is not safety | Unit/API tests for empty evidence and unavailable providers | P0 |
| F5 | India-aware scam indicators | Rule tests with benign counterexamples | P0 |
| F6 | English/Hindi/Hinglish support | Evaluation cases and reviewed output | P0 |
| F7 | Provider partial-result behavior | Outage/timeout tests and UI state | P0 |
| F8 | Prompt-injection resistance | Adversarial input tests | P0 |
| F9 | SSRF safety if target fetching exists | Private IP, redirect, DNS, port tests | P0 conditional |
| F10 | Privacy by default | Logs/config/storage review | P0 |
| F11 | False-positive/false-negative tracking | Versioned dataset and evaluation report | P0 |
| F12 | Screenshot/OCR | Upload validation, extraction review, end-to-end tests | P1 |
| F13 | Telegram bot | Reuses same analysis pipeline, rate limits, privacy tests | Stretch |
| F14 | Feedback/history | Data minimization, retention, deletion, disclosure tests | P1/conditional |

For each item, annotate actual repository file paths, test names, and current status. Documentation alone is not proof of implementation.
