# SatyamAI — Scam & Misinformation Checker

[![Next.js 15](https://img.shields.io/badge/Next.js-15%2B-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-Node_22_Native-003B57?style=flat&logo=sqlite)](https://nodejs.org/api/sqlite.html)
[![Vitest](https://img.shields.io/badge/Tests-218_Passed-success?style=flat&logo=vitest)](https://vitest.dev/)
[![National Cyber Helpline](https://img.shields.io/badge/Helpline-1930-red?style=flat)](https://cybercrime.gov.in)

> **SatyamAI** (सत्यम् AI) is a production-grade, India-aware decision-support platform designed to protect citizens from deceptive messages, phishing links, viral claims, and extortion traps. It uniquely separates **Scam/Fraud Risk** from **Factual Claim Verification**, backed by deterministic heuristic rules, live source citations, and contextual AI reasoning.

---

## 🏛️ Comprehensive Mermaid Architecture

### 1. High-Level System Architecture & Component Topology

```mermaid
graph TD
    subgraph ClientLayer ["Client Layer (Web & Messaging)"]
        UI["Next.js 15 Web Dashboard<br/>(/analyze & /)"]
        TGBot["Telegram Bot User<br/>(@SatyamAIBot)"]
        PaypalModal["Payment Sandbox UI<br/>(PayPal / Razorpay)"]
    end

    subgraph GatewayLayer ["Edge & Security Middleware"]
        RateLimit["In-Memory Rate Limiter<br/>(IP & User Bounded)"]
        SSRF["SSRF Defense Guard<br/>(Blocks 127.0.0.1, 169.254.169.254)"]
        SessionParser["Session Resolver<br/>(Cookie / Bearer Token)"]
    end

    subgraph CoreEngine ["Analysis & Verification Engine"]
        CreditGuard["Two-Phase Credit Guard<br/>(res_xxx with 2-min TTL)"]
        RulesEngine["Deterministic Rules Engine (&lt;2ms)<br/>- UPI PIN / QR Reversals<br/>- Electricity Disconnection Threats<br/>- 'Digital Arrest' Extortion<br/>- KYC / Bank Block Scare Tactics<br/>- Hindi & Hinglish Linguistic Cues"]
        Orchestrator["Analysis Orchestrator<br/>(Signal Fusion & Multi-Verdict Logic)"]
    end

    subgraph ExternalAdapters ["External Provider Adapters"]
        Bedrock["Amazon Bedrock Adapter<br/>(Claude 3 Haiku / Nova)"]
        FactCheck["Google Fact Check Tools API<br/>(Attributable Citations)"]
        SafeBrowsing["Safe Browsing / URL Reputation<br/>(Phishing Domain Telemetry)"]
        VisionOCR["OCR & Vision Adapter<br/>(Screenshot Text Extraction)"]
    end

    subgraph DataPersistence ["Persistence & Storage Layer (ACID)"]
        SQLiteDB["Node 22 Native SQLite (WAL Mode)<br/>- users (salted scrypt)<br/>- sessions (token auth)<br/>- analyses (scan history)<br/>- transactions (audit ledger)"]
        
    end

    UI --> SessionParser
    UI --> PaypalModal
    TGBot --> SessionParser
    SessionParser --> RateLimit
    RateLimit --> SSRF
    SSRF --> CreditGuard
    CreditGuard --> Orchestrator
    Orchestrator --> RulesEngine
    Orchestrator --> Bedrock
    Orchestrator --> FactCheck
    Orchestrator --> SafeBrowsing
    Orchestrator --> VisionOCR
    Orchestrator --> SQLiteDB
    CreditGuard --> SQLiteDB
    PaypalModal --> SQLiteDB
```

---

### 2. End-to-End Analysis & Verification Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Judge
    participant UI as Web Dashboard
    participant API as /api/v1/analyze/*
    participant Guard as Credit Guard
    participant Rules as Deterministic Rules
    participant LLM as Amazon Bedrock / Gemini
    participant Evidence as Fact Check Tools
    participant DB as SQLite DB & Journal

    User->>UI: Submits message, URL, or screenshot
    UI->>API: POST /api/v1/analyze/text (with Cookie/Header)
    API->>Guard: checkAndReserveCredits(req, cost=1)
    alt Available Credits < Cost
        Guard-->>API: Throw INSUFFICIENT_CREDITS
        API-->>UI: HTTP 402 with purchase options
    else Credits Available
        Guard->>Guard: Issue reservation (res_xxx, TTL=120s)
        Guard-->>API: Reservation confirmed
    end

    API->>Rules: Evaluate deterministic patterns (<2ms)
    opt Pattern Detected (e.g. Electricity Scam or UPI Trap)
        Rules-->>API: High-confidence scam verdict + reasons
    end

    API->>Evidence: Query fact-checks / domain reputation
    Evidence-->>API: Source title, publisher, URL, rating

    API->>LLM: Synthesize contextual reasoning (Bedrock / Gemini)
    LLM-->>API: Structured explanation + recommended actions

    API->>Guard: finalizeCreditUsage(reservation, analysisId, success=true)
    Guard->>DB: Commit debit transaction (-1 check)
    API->>DB: saveAnalysis(id, user_id, verdict, preview, fullResult)
    API-->>UI: HTTP 200 { scam_risk, claim_verification, reasons, evidence, credits }
    UI-->>User: Renders Dual Verdict, Safety Checklist & Helpline (1930)
```

---

### 3. SQLite Authentication & Anonymous Guest Data Migration

```mermaid
sequenceDiagram
    autonumber
    actor Guest as Anonymous Guest
    participant Frontend as Browser
    participant AuthAPI as /api/v1/auth/register
    participant Ledger as Credit Ledger
    participant DB as SQLite Database

    Guest->>Frontend: Visited site as guest (satyam_user_id = usr_anon_123)
    Note over Guest,Frontend: Granted 3 free checks, performed 1 scan
    Guest->>Frontend: Clicks "Sign in" -> "Create Account"
    Frontend->>AuthAPI: POST { email, password, displayName } + x-user-id header
    AuthAPI->>DB: createUser(email, scrypt_hash, salt)
    AuthAPI->>Ledger: migrateUser(from: usr_anon_123, to: usr_auth_456)
    Ledger->>DB: UPDATE transactions SET user_id = usr_auth_456 WHERE user_id = usr_anon_123
    Ledger->>DB: UPDATE analyses SET user_id = usr_auth_456 WHERE user_id = usr_anon_123
    Ledger->>Ledger: Consolidate remaining check balances
    AuthAPI->>DB: createSession(usr_auth_456)
    AuthAPI-->>Frontend: HTTP 200 { success: true, token, balance } + Set-Cookie (satyam_session_token)
    Frontend-->>Guest: Shows "Active & Synced" with all credits & history preserved!
```

---

### 4. Payment Gateway Sandbox & Credit Monetization Engine

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant UI as Credit Bar / Top-Up Modal
    participant PayAPI as /api/v1/payments/*
    participant Gateway as PayPal Sandbox / Razorpay
    participant Ledger as Durable Credit Ledger
    participant DB as SQLite DB

    User->>UI: Selects Package and currency (USD or INR)
    UI->>PayAPI: POST /api/v1/payments/create-order { packageId: "plus", currency: "INR" }
    PayAPI->>Gateway: Create order with validated currency & price
    Gateway-->>PayAPI: Order ID (ORD-12345) + approvalUrl
    PayAPI-->>UI: Order details

    User->>Gateway: Approves payment in Sandbox window
    Gateway-->>UI: Redirect back with token & PayerID
    UI->>PayAPI: POST /api/v1/payments/capture-order { orderId: "ORD-12345" }
    PayAPI->>Gateway: Capture authorized order
    Gateway-->>PayAPI: Status: COMPLETED, Amount: ₹419.00 INR
    PayAPI->>Ledger: addPurchaseCredits(userId, credits=25, orderId, captureId)
    Note over Ledger: Idempotency check: rejects if orderId already credited
    Ledger->>DB: Record purchase_credit transaction
    Ledger->>Ledger: Update running balance (+25)
    PayAPI-->>UI: HTTP 200 { balance: 27, transactionId: "tx_..." }
    UI-->>User: Balance updated instantly, receipt logged to ledger
```

---

## 🌟 Core Features & Differentiation

### 1. Dual-Dimension Risk Separation
Traditional AI chatbots collapse complex information into a single generic label ("looks safe" or "suspicious"). SatyamAI separates evaluations into **two distinct dimensions**:
* **Dimension 1: Scam & Financial Fraud Threat** (Phishing, credential harvesting, malware APKs, extortion).
* **Dimension 2: Factual Claim Accuracy** (False quotes, fabricated policies, debunked viral claims).
> *Why this matters:* A deceptive phishing lure can quote a 100% factual news event to sound convincing. Collapsing the dimensions leads to dangerous false positives or false negatives.

### 2. India-Centric Fraud Intelligence
* **UPI PIN Reversal Traps:** Detects scam offers requesting a UPI PIN to "receive" cashbacks or lottery winnings.
* **Fake Electricity Cutoff SMS:** Catches urgent threats warning that power will be disconnected tonight at 9:30 PM.
* **Fake "Digital Arrest":** Debunks Skype/WhatsApp law enforcement extortion by directly quoting Indian criminal procedure.
* **Multilingual:** Handles English, Hindi (Devanagari), and Hinglish (colloquial Roman script).
* **Helpline Routing:** Directly displays the **National Cyber Crime Helpline: 1930** and **cybercrime.gov.in**.

### 3. Native Zero-Dependency SQLite Engine
* Uses Node 22 native `node:sqlite` (`DatabaseSync`) in **WAL mode**.
* Zero external native compilation dependencies (no `node-gyp` or C++ build tools required).
* Persistent storage for:
  - Users with salted `scrypt` password hashing.
  - Session tokens with 30-day expiry.
  - Saved scan history with search and privacy deletion.
  - Financial transaction audit ledger.

### 4. Two-Phase Credit Guard & Monetization
* **3 Free Checks** for every guest on first visit.
* **Two-Phase Reservation:** Checks are reserved prior to analysis and debited only on success.
* **Fail-Safe Restoration:** If an analysis or provider aborts, credits are immediately returned.
* **PayPal Sandbox Integration:** Secure server-authoritative checkout with anti-tampering guards and cryptographic idempotency.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 15+ (App Router) | High-performance server components and API route handlers |
| **Language** | TypeScript 5.7 | End-to-end type safety |
| **Styling** | Tailwind CSS v4 | High-contrast light theme, accessible ARIA roles, responsive UI |
| **Database** | Node 22 Native SQLite (`node:sqlite`) | ACID transactional storage in WAL mode |
| **Validation** | Zod 3.24 | Strict runtime schema parsing on all requests and responses |
| **AI Inference** | Amazon Bedrock & Gemini API Adapter | Server-side LLM inference with structured JSON output |
| **Evidence Retrieval** | Google Fact Check Tools API | Attributable citations with publisher and canonical URL |
| **Security** | SSRF & In-Memory Rate Limiter | Loopback / cloud metadata IP blocking and DDoS mitigation |
| **Testing** | Vitest 4 | Unit, integration, security, and benchmark suites |

---

## 🚀 Getting Started

### Prerequisites
* Node.js `v22.13.0` or higher
* npm `10.0+`

### Installation
```bash
# Clone the repository
git clone https://github.com/AmanInAction/satyam-ai.git
cd satyam-ai

# Install dependencies
npm install
```

### Local Development
```bash
# Run the local development server (runs on port 3000)
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running Tests & Quality Checks
```bash
# Run all 218 automated Vitest tests across 19 suites
npm run test

# Run TypeScript type validation (0 errors)
npm run lint

# Build production bundle
npm run build
```

---

## 📡 API Endpoints Summary

### Core Analysis
* `POST /api/v1/analyze/text`: Evaluates suspicious messages or viral claims (Cost: 1 check).
* `POST /api/v1/analyze/url`: Inspects links for phishing and brand spoofing (Cost: 1 check).
* `POST /api/v1/analyze/image`: Extracts and analyzes screenshot text (Cost: 2 checks).
* `GET /api/v1/health`: System health and provider availability diagnostics.

### Authentication & User Accounts (SQLite)
* `POST /api/v1/auth/register`: Creates an account, hashes password with salted scrypt, and migrates guest credits/scans.
* `POST /api/v1/auth/login`: Verifies credentials and issues a secure session token.
* `GET /api/v1/auth/me`: Retrieves current authenticated profile and check balance.
* `POST /api/v1/auth/logout`: Invalidates active session token and clears cookies.

### Scan History & Privacy Controls
* `GET /api/v1/history`: Retrieves user's past scans with search, filtering, and pagination.
* `DELETE /api/v1/history?id=...`: Deletes a specific scan or wipes all history (Privacy by Default).

### Monetization & Payments Sandbox
* `GET /api/v1/payments/credits`: Retrieves current check balance, allowance, and purchase packs.
* `POST /api/v1/payments/create-order`: Generates a server-authoritative sandbox order.
* `POST /api/v1/payments/capture-order`: Validates approval status, currency, and idempotently credits checks.
* `GET /api/v1/payments/transactions`: Returns chronological audit trail of all grants, debits, and purchases.
* `POST /api/v1/payments/webhook`: Handles asynchronous payment events.

### Telegram Bot Webhook
* `POST /api/v1/telegram/webhook`: Reuses the central analysis pipeline for text and links sent via Telegram.
* To sync paid website checks with Telegram: sign in on the website, open **Account**, generate a one-time link code, then send `/link CODE` to the bot in a private chat. Use `/credits` to check the shared balance. Codes expire after 10 minutes.

---

## 🔒 Security & Privacy Guarantees

1. **Privacy by Default:** Raw submissions are not permanently stored unless explicitly saved to your SQLite history, which you can wipe at any time.
2. **SSRF Protection:** Server-side fetching strictly blocks `127.0.0.1`, `localhost`, private ranges (`10.0.0.0/8`, `192.168.0.0/16`), and cloud metadata services (`169.254.169.254`).
3. **Adversarial Defenses:** User input containing prompt-injection tokens (`"Ignore all previous instructions"`) is treated as untrusted text and cannot override classification rules.
4. **Idempotency:** Payment captures and webhook retries are guarded by database-backed unique indexes to eliminate duplicate crediting.

---

## 📄 License
This project is licensed under the MIT License.
