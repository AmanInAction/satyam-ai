# Competitive Gap Analysis and SatyamAI Differentiation

**Date:** 2026-10-13  
**Purpose:** Translate competitor research into actionable product requirements. This is a product-gap assessment, not an independently benchmarked accuracy comparison.

## 1. Market landscape

| Product/category | Known strength | Gap SatyamAI can target |
|---|---|---|
| Scamy-style AI scam checkers | Multi-format scam analysis | Stronger explicit evidence provenance, clear uncertainty, and separated claim verification |
| India-focused scam checkers such as ScamRadar/ScamDekho | Locally relevant scam scenarios and checks | Combine scam/security assessment with source-backed factual claim verification |
| Truecaller Link Checker | URL reputation and reported threats | Assess the message/offer context as well as the URL |
| Google Safe Browsing | Known dangerous website/phishing signals | Not a general-purpose factual claim verifier |
| Google Fact Check Explorer | Search existing published fact checks | A new claim may have no existing match; distinguish retrieval from fresh analysis |
| Alt News and BOOM | Investigative fact-checking and media context | Faster user-submitted triage for personal messages/links, while preserving links to original reporting |

Competitor capabilities change. The coding agent should not hard-code unsupported claims about competitors into the app or marketing. This table is for internal strategy, not a claim that every competitor lacks every feature.

## 2. Differentiators to implement

### F1 — One submission flow, multiple risk dimensions
- Accept text and URLs in P0; add screenshots in P1.
- Classify whether the input involves a scam/security risk, factual claim, both, or insufficient information.
- Return separate fields for scam risk and claim verification.
- Acceptance: tests prove a `supported` factual claim can still appear in a suspicious message and a safe-looking URL cannot certify the offer.

### F2 — Evidence-first reports
- Show real source title, publisher/domain, URL, and relevance.
- Preserve whether a result came from an official source, fact-check publisher, reputation provider, or AI inference.
- Show what checks ran and what was unavailable.
- Acceptance: no placeholder citations; no fabricated evidence; empty search results display `unverified`/limitations rather than safety.

### F3 — India-aware and multilingual analysis
- Prioritize English, Hindi, and Hinglish.
- Build explainable signals for UPI/payment requests, OTP/PIN/credential requests, KYC/account-block threats, digital-arrest/extortion patterns, fake jobs, impersonation, and urgent payment.
- Acceptance: each rule has positive and benign counterexamples; keyword presence alone never guarantees a scam verdict.

### F4 — Transparent uncertainty
- Distinguish risk label from factual claim label.
- Explain insufficient context, missing provider data, conflicting evidence, and model limitations.
- Do not display heuristic risk scores as calibrated probabilities.
- Acceptance: tests cover no evidence, provider outage, conflicting sources, and ambiguous content.

### F5 — Hybrid analysis with graceful degradation
- Deterministic rules, Bedrock reasoning, evidence retrieval, and reputation checks remain separate signals.
- If one provider fails, return a partial result where useful and clearly identify missing checks.
- Acceptance: tests prove provider failure never silently becomes “no risk found.”

### F6 — Privacy-first workflow
- No raw content persistence by default.
- Minimize logs and feedback data.
- Never request OTPs, PINs, passwords, or full payment credentials.
- Acceptance: tests/config review show no raw content in ordinary logs and no secrets in client bundles.

### F7 — Low-friction Telegram channel (stretch)
- Add only after web analysis is reliable.
- Reuse the same analysis orchestrator and output contract.
- Avoid storing message contents unless necessary and disclosed.
- Acceptance: same verdict behavior, rate limits, abuse protections, privacy rules, and tests as web flow.

### F8 — Measured quality, not marketing claims
- Maintain an evaluation dataset of legitimate, scam, ambiguous, multilingual, URL, and claim examples.
- Track false positives, false negatives, evidence relevance, uncertainty, and language clarity.
- Acceptance: release report contains real counts and examples; no inflated accuracy claim from a small dataset.

## 3. Priority mapping

| Priority | Requirement | Why |
|---|---|---|
| P0 | Separate scam-risk and claim-verification dimensions | Core positioning and avoids ambiguous verdicts |
| P0 | Evidence provenance and missing-evidence behavior | Trustworthiness and explainability |
| P0 | English/Hindi/Hinglish evaluation | Intended user accessibility |
| P0 | Hybrid signal handling and partial results | Reliability |
| P0 | False-positive/false-negative review | Avoid unsafe or misleading output |
| P1 | Screenshot/OCR with review | Useful but increases security and cost |
| P1/stretch | Telegram bot | Access channel, not core analysis capability |
| Deferred | Browser extension, deepfake detection, reverse-image search, custom training | High effort and not required for initial release |

## 4. Non-goals and claims to avoid

- Do not claim SatyamAI is uniquely capable without testing.
- Do not promise perfect scam detection or truth verification.
- Do not imply a low-risk result proves a sender or website is legitimate.
- Do not authenticate payment screenshots or legal documents solely from image appearance.
- Do not add advanced forensics or account systems before the core flows are reliable.

## 5. Implementation evidence required

For each feature, track status as `implemented`, `partial`, `missing`, `blocked`, or `deferred`. Documentation changes alone do not mean implementation is complete. Evidence should include file paths, tests, provider mode (real/mock), and actual command output.
