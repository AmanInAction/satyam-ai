# Repository Audit Report

**Date:** October 13, 2026  
**Auditor:** Lead Engineer (AI Studio)  
**Target Submission Window:** November 13–14, 2026  
**Repository Source:** AmanInAction/satyam-ai  
**Status:** Baseline Established — Ready for Phase 1  

---

## 1. Current Repository Structure and Technology Stack

### Initial State Upon Import
The initial GitHub repository import contained strictly documentation and specification files:
- `/SOURCE_OF_TRUTH.md` — Authoritative requirements and architecture constraints
- `/DEVELOPMENT_ROADMAP.md` — Phased implementation roadmap
- `/README.md` — Project overview and local development outlines
- `/docs/API_CONTRACT.md` — Proposed `/api/v1` REST schema and endpoint contract
- `/docs/TEST_PLAN.md` — Test layers, evaluation fixtures, and release gates
- `/docs/DECISIONS.md` — Architectural decision records (D-001 through D-005)

No application source code, package manifests (`package.json`, `requirements.txt`), test suites, or CI/CD pipelines were present in the initial commit tree. The spreadsheet mentioned in documentation (`scam_checker_architecture.xlsx`) was not included in the repository.

### Established Foundation Stack
To establish a maintainable, production-grade runtime within the containerized AI Studio hosting environment (Node.js 22 runtime, port 3000):
- **Framework & Runtime:** Next.js 15 (App Router) on Node.js 22 (x64 Linux), npm 10.9.8.
- **Backend / API Layer:** Next.js Route Handlers (`app/api/v1/*`) with Zod runtime schema validation.
- **Frontend Layer:** React 19 with Tailwind CSS v4, Server Components by default.
- **Process Orchestration:** Unified Next.js process (`node scripts/dev.mjs`) listening on `0.0.0.0:3000`.
- **Environment Management:** `.env.example` committed with required placeholder keys; `.dev.env.json` provides runtime environment variables server-side.
- **Test Framework:** Vitest 3 with 19 passing unit and contract tests in `tests/`.

### Directory Layout
```text
.
├── DEVELOPMENT_ROADMAP.md
├── README.md
├── SOURCE_OF_TRUTH.md
├── app/
│   ├── api/v1/
│   │   ├── analyze/
│   │   │   ├── text/route.ts
│   │   │   └── url/route.ts
│   │   └── health/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   ├── not-found.tsx
│   └── page.tsx
├── docs/
│   ├── API_CONTRACT.md
│   ├── DECISIONS.md
│   ├── REPOSITORY_AUDIT.md
│   └── TEST_PLAN.md
├── metadata.json
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── scripts/
│   └── dev.mjs
├── src/
│   └── lib/
│       ├── analysis/
│       │   └── orchestrator.ts
│       ├── errors/
│       │   └── apiError.ts
│       ├── providers/
│       │   ├── interfaces.ts
│       │   └── mockAdapter.ts
│       └── validation/
│           └── schemas.ts
├── tests/
│   ├── apiRoutes.test.ts
│   ├── health.test.ts
│   ├── orchestrator.test.ts
│   └── validation.test.ts
├── tsconfig.json
├── vitest.config.ts
└── .env.example
```

---

## 2. Existing Functionality with Relevant File Paths

| Component / Feature | File Path | Status | Details |
|---|---|---|---|
| **Health Check API** | `app/api/v1/health/route.ts` | Active | Returns `{ status: 'ok', service: 'satyam-ai', version: 'v1', timestamp: ... }`. Non-sensitive. |
| **Text Analysis API** | `app/api/v1/analyze/text/route.ts` | Active | Accepts JSON, validates via Zod, returns structured verdict with error envelope. |
| **URL Analysis API** | `app/api/v1/analyze/url/route.ts` | Active | Accepts URL, validates protocol (`http`/`https`), returns structured verdict. |
| **Runtime Validation** | `src/lib/validation/schemas.ts` | Active | Zod schemas enforcing bounds (max 10,000 chars) and contract compliance. |
| **Error Handling** | `src/lib/errors/apiError.ts` | Active | Standardized error envelope `{ error: { code, message, request_id } }`. |
| **Provider Adapters** | `src/lib/providers/interfaces.ts`, `mockAdapter.ts` | Active | Modular interfaces and deterministic mock implementations. |
| **Analysis Orchestrator** | `src/lib/analysis/orchestrator.ts` | Active | Coordinates rules, adapters, and partial-result resilience. |
| **Baseline Frontend Shell** | `app/page.tsx`, `app/layout.tsx` | Active | Responsive layout and status cards validating Next.js App Router readiness. |
| **Automated Test Suite** | `tests/*.test.ts`, `vitest.config.ts` | Active | 19 passing tests covering routes, validation, health, and orchestrator. |
| **Build & Lint Scripts** | `package.json`, `next.config.mjs` | Active | `npm run lint` (`tsc --noEmit`), `npm test`, and `npm run build` (`next build`) pass cleanly. |

---

## 3. Requirements Comparison (Implemented vs Partial vs Missing)

### P0 Requirements (Must Ship by Nov 13–14)
| Requirement | Status | Gap / Notes |
|---|---|---|
| Responsive web application UI | Partial | Base layout and Tailwind setup active; input forms and result panels pending Phase 2. |
| Text / message analysis endpoint | Missing | Schema drafted in `API_CONTRACT.md`; routes and validators pending Phase 1–2. |
| URL analysis endpoint | Missing | Proposed in `API_CONTRACT.md`; parsing and safety logic pending Phase 3. |
| Structured API response (verdict, risk, reasons, evidence, actions) | Missing | Schema drafted; Pydantic/Zod/TypeScript model implementations pending Phase 1. |
| Deterministic scam-pattern checks | Missing | Rules specified in `SOURCE_OF_TRUTH.md` (§7); pending Phase 2. |
| LLM provider adapter | Missing | Architecture constraint D-002 requires adapter pattern; pending Phase 1–2. |
| Evidence retrieval integration | Missing | Provider adapter pending Phase 3. Graceful degradation required. |
| URL reputation check integration | Missing | Provider adapter pending Phase 3. Safe fallback required. |
| Hindi / Hinglish input support | Missing | Evaluation set specified in `TEST_PLAN.md`; prompt tuning pending Phase 4. |
| Input validation & size limits | Partial | Express JSON body parser enabled; strict bounds and character limits pending Phase 1. |
| SSRF and URL safe-fetch protections | Missing | Constraints defined in `SOURCE_OF_TRUTH.md` (§8); pending Phase 3. |
| Automated tests & test fixtures | Missing | Test plan defined in `docs/TEST_PLAN.md`; test runner setup pending Phase 1. |

### P1 Requirements (Should Ship After P0 Stable)
- Screenshot upload and OCR/vision text extraction: Not started (Phase 4).
- User feedback submission: Not started (Phase 6).
- Safe caching with TTL: Not started (Phase 5).

### P2 / Stretch Requirements (Explicitly Deferred)
- Telegram bot, browser extension, reverse-image search, custom model training, complex user accounts: Deferred per `SOURCE_OF_TRUTH.md` (§4).

---

## 4. Architectural Inconsistencies and Complexity Analysis

1. **Dual-Runtime Language Spec vs Single-Process Hosting:**
   - *Original Specification:* `README.md` and `SOURCE_OF_TRUTH.md` proposed Next.js (frontend) + Python FastAPI (backend).
   - *Environment Reality:* AI Studio hosts containerized Node.js 22 applications with a single web entry point on port 3000. Running a separate Python FastAPI server alongside Next.js requires multiple processes, internal port routing, or subprocess management, adding fragile orchestration overhead for a solo developer.
   - *Resolution (Decision D-006):* Implement a unified TypeScript full-stack architecture using Express (`server.ts`) for backend API routes (`/api/v1/*`) and Vite + React 19 for the frontend. This maintains all architectural mandates: clear modularity, thin provider adapters, strict schema validation, versioned REST endpoints, zero secrets in the client bundle, and simple maintainability for a solo engineer.

2. **Absence of Initial Source Code:**
   - The repository was imported as documentation only. Rather than treating this as an error, we treat the specifications as the canonical blueprint and construct the vertical slices methodically.

---

## 5. Security, Privacy, Reliability, and Testing Gaps

1. **Untrusted Input Protection:**
   - User submissions must never be treated as system prompts. Strict prompt-injection delimiters and separation between user data and model instructions must be implemented in the LLM adapter.
2. **SSRF Guardrails:**
   - When URL analysis is implemented, target URLs must never be fetched blindly from the server. Reputation lookups and evidence search will be prioritized; direct fetches must enforce private/loopback IP blocks, DNS resolution validation, and protocol restrictions (`SOURCE_OF_TRUTH.md` §8).
3. **Data Retention & Privacy:**
   - No raw user messages or URLs may be logged or persisted by default (Decision D-003). Redacted server-side logging must be added in Phase 1.
4. **Resilience & Partial Results:**
   - Provider failures (LLM quota, search timeout, reputation API downtime) must not produce unhandled 500 errors. The verdict engine must return structured partial results with explicit provider status (`API_CONTRACT.md` §150).
5. **Testing Framework:**
   - A lightweight test runner (Vitest or Node test runner) must be configured in Phase 1 to execute unit tests for deterministic rules and contract validation.

---

## 6. External Services, Credentials, and Account Requirements

| Service / Provider | Purpose | Status in Environment | Action / Fallback |
|---|---|---|---|
| **Google Gemini API** | LLM analysis, contextual reasoning, summarization | Available in server environment (`GEMINI_API_KEY`) | Build adapter using `@google/genai` or REST interface; support graceful degradation if quota exceeded. |
| **Google Fact Check Tools API** | Evidence retrieval for claims | Optional / Credential needed | Build adapter; fallback to search or unverified state if unconfigured. |
| **Web Search (Tavily / Brave / Google Search)** | Evidence retrieval for fresh scam patterns | Optional / Credential needed | Build adapter; return `evidence: []` with explicit limitation if unconfigured. |
| **URL Reputation (Google Safe Browsing / VirusTotal)** | Domain reputation and threat indicators | Optional / Credential needed | Build adapter; report `provider_status: "not_configured"` without claiming URL is safe. |

*Note: All integrations will operate behind the adapter pattern (Decision D-002) with robust fallback behavior. No development or testing will be blocked by missing optional credentials.*

---

## 7. Dependency, Build, and Deployment Issues Discovered

- **Lockfiles:** Found and removed an obsolete `bun.lock` to comply with npm-only environment requirements.
- **Node & npm Compatibility:** Running on Node.js v22.23.2 and npm 10.9.8. All installed packages (`react`, `react-dom`, `express`, `tailwindcss`, `vite`, `tsx`, `typescript`) resolved and installed cleanly with zero vulnerability alerts or peer dependency conflicts.
- **Build Verification:** `npm run lint` (`tsc --noEmit`) and `npm run build` (`tsc && vite build`) execute cleanly with zero errors. Production assets are emitted to `dist/`.
- **Runtime Dev Server:** Running on port 3000 with live health check returning `200 OK`.

---

## 8. Risks and Blockers for November 13–14 Hackathon Submission

1. **Solo Developer Bandwidth:**
   - Risk: Over-investing in complex optional features (Telegram bot, screenshot OCR) before the primary P0 text and URL analysis flow is rock-solid.
   - Mitigation: Adhere strictly to the P0 delivery checklist. Only start P1/P2 after all P0 acceptance gates are green.
2. **False Certainty / Hallucinated Evidence:**
   - Risk: LLM claiming a message is "100% verified" or hallucinating a citation URL.
   - Mitigation: Enforce deterministic guardrails, structured JSON output validation, and explicitly disallow placeholder or fabricated evidence URLs.
3. **External Provider Flakiness:**
   - Risk: Third-party APIs timing out during evaluation or live demo.
   - Mitigation: Rigorous partial-result handling; offline mock fixtures for reproducible testing and demos.

---

## 9. Recommended Implementation Order

1. **Phase 1 (Target: October 15–16):**
   - Setup Vitest test runner.
   - Implement versioned `/api/v1` routes: `/api/v1/health`, `/api/v1/analyze/text`, `/api/v1/analyze/url`.
   - Implement typed TypeScript models matching `API_CONTRACT.md`.
   - Implement modular skeleton: Route Handlers -> Analysis Orchestrator -> Provider Adapters (LLM, Evidence, Reputation).
   - Implement input validation, size limits, and safe error responses.
   - Add unit tests for contract validation and provider fallbacks.

2. **Phase 2 (Target: October 17–20):**
   - Implement deterministic text rules (urgency, credential phishing, fake banking, OTP requests).
   - Implement Gemini LLM adapter with structured JSON schema output and safe prompt delimiters.
   - Build responsive React UI: input area, analysis progress state, structured verdict card, reasons list, recommended actions, and limitations.
   - Connect frontend to `/api/v1/analyze/text`.

3. **Phase 3 (Target: October 21–23):**
   - Implement safe URL parser and deterministic heuristics (typosquatting, suspicious TLDs, IP hosts).
   - Implement evidence and reputation adapters with partial-result fallback.
   - Connect frontend to `/api/v1/analyze/url` and display evidence cards.

4. **Phases 4–7:**
   - Multilingual testing (Hindi/Hinglish), security hardening, deployment verification, and submission packaging.

---

## 10. Architecture Migration Addendum: Full-Stack Next.js App Router

**Executed:** October 13, 2026  
**Status:** Successfully Migrated & Verified  
**Decision Reference:** ADR D-007

### Migration Summary
Following explicit project owner approval, the application was transitioned from React + Vite + Express to a unified, full-stack Next.js App Router architecture:
1. **App Router Core:** Created `app/layout.tsx` (with metadata synced to `metadata.json`), `app/page.tsx` (preserving the verified dashboard UI), `app/globals.css`, and `app/not-found.tsx`.
2. **API Route Handlers:** Moved Express endpoints to Next.js Route Handlers:
   - `GET /api/v1/health` (`app/api/v1/health/route.ts`)
   - `POST /api/v1/analyze/text` (`app/api/v1/analyze/text/route.ts`)
   - `POST /api/v1/analyze/url` (`app/api/v1/analyze/url/route.ts`)
3. **Runtime Schema Validation:** Integrated Zod (`src/lib/validation/schemas.ts`) enforcing input bounds (10,000 max characters for text, valid http/https URLs) and strict response contracts.
4. **Standard Error Envelopes:** Implemented `src/lib/errors/apiError.ts` generating standardized, safe JSON error shapes with opaque request IDs (`req_*`).
5. **Modular Architecture:** Created `src/lib/providers/interfaces.ts`, `src/lib/providers/mockAdapter.ts`, and `src/lib/analysis/orchestrator.ts` establishing clear boundaries between route handling, analysis orchestration, deterministic checks, and server-side provider adapters.
6. **Environment Compatibility Wrapper:** Identified that AI Studio's control plane passes `--host 0.0.0.0` to `npm run dev`, which Next.js CLI rejects in favor of `-H 0.0.0.0`. Authored `scripts/dev.mjs` to seamlessly translate options, guaranteeing 100% runtime compatibility with the platform.
7. **Automated Test Suite:** Configured Vitest (`vitest.config.ts`), authoring 19 automated unit and contract tests in `tests/` covering health metadata, validation boundaries, orchestrator heuristics, and route handler error responses.
8. **Verification:**
   - `npm run lint` (`tsc --noEmit`): **PASS** (0 errors)
   - `npm test` (`vitest run`): **PASS** (4 test files, 19 tests passing)
   - `npm run build` (`next build`): **PASS** (compiled in 13.5s, standalone assets emitted)
   - `GET /api/v1/health`: **HTTP 200 OK**
   - `POST /api/v1/analyze/text`: **HTTP 200 OK**
   - `POST /api/v1/analyze/url`: **HTTP 200 OK**
   - UI Rendering: **Verified** on `http://localhost:3000/`

