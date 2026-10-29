# SatyamAI — Hackathon Pitch, Live Demo & Technical Presentation Guide

## Our goal

Present SatyamAI as a practical, trustworthy tool that helps people make better decisions when they encounter suspicious messages, links, and viral claims.

**Presentation principle:** Show what works. Explain why it matters. Be honest about what is still being validated.

---

# 1. The Three-Minute Pitch and Live Demo

## 0:00–0:35 — The problem

**Speaker script**

Imagine receiving a message saying your electricity will be disconnected tonight unless you pay immediately.

Or a message promising a cash reward if you enter your UPI PIN.

The problem isn't simply that these messages may be fraudulent. It's that they are designed to make people panic, trust the wrong source, and act before checking the facts.

And even a message containing a true fact can be used to carry out a scam.

We built **SatyamAI** to help people pause, examine the warning signs, and make a more informed decision.

## 0:35–1:35 — The live demonstration

**Action on screen**

1. Open the SatyamAI checker at `/analyze`.
2. Select the electricity-disconnection example or paste a prepared suspicious message.
3. Click **Check message**.
4. Show the resulting assessment.

**Speaker script**

Let's see how it works.

I've submitted a message that claims the recipient's electricity will be disconnected unless they act urgently.

SatyamAI examines the message for warning signs, such as urgency, impersonation, and suspicious payment requests. It can also use available evidence to help assess relevant factual claims.

The result is designed to answer three practical questions:

- What looks suspicious?
- What evidence is available?
- What should I do next?

Instead of simply returning a score, SatyamAI explains the reasons behind its assessment and provides practical guidance.

For example, a user should verify a billing problem through the electricity provider's official website or customer-service number rather than relying on contact details supplied in a threatening message.

The purpose is not to make decisions for people. It's to give them useful information before they act.

**Demo note:** Show the actual result returned by the application. Only mention sources that appear in the result. Do not claim that an official source disproves a message unless the displayed evidence supports that conclusion.

## 1:35–2:10 — What makes SatyamAI different?

**Speaker script**

One important design decision is that SatyamAI separates two questions that are often confused.

First: **Does this message show signs of a scam?**

Second: **Is the factual claim supported by evidence?**

These are different questions.

A genuine government scheme can be used as bait in a fraudulent message. A suspicious message can also contain a factual statement that happens to be true.

By separating scam risk from factual accuracy, we can give users a more useful explanation instead of reducing everything to a single verdict.

And when the available evidence isn't enough, the result should say so. We don't want people to mistake an uncertain result for a guarantee of safety.

## 2:10–2:35 — From the website to Telegram

**Action on screen**

Open the working SatyamAI Telegram bot and demonstrate a message check.

**Speaker script**

We also bring this experience to Telegram, where people already receive and share suspicious messages.

Users can send messages to the bot and receive an assessment through the same core analysis system.

That gives SatyamAI another practical way to reach people without requiring them to learn a new workflow.

## 2:35–3:00 — Closing

**Speaker script**

Our goal with SatyamAI is straightforward: help people recognize warning signs, examine available evidence, and make safer decisions online.

We're combining India-aware scam detection, factual-claim assessment, and clear guidance in one accessible experience.

We know no automated system can identify every scam or establish the truth of every claim. That's why transparency and uncertainty are part of the product, not afterthoughts.

SatyamAI is our effort to make checking before trusting a little easier.

Thank you.

---

# 2. End-to-End Product Walkthrough: Accounts, Credits and Payments

This section is for a longer demonstration or technical evaluation. It should not all be included in the three-minute pitch.

## A. Guest access and user accounts

**What to demonstrate**

- Open the checker as a new guest.
- Show the initial allowance of three free checks, if verified in the current build.
- Perform an analysis and show the updated balance.
- If account registration and guest migration have been verified, demonstrate signing in and retaining the appropriate balance.

**Suggested explanation**

We want users to try the core experience without unnecessary friction. The product uses a credit allowance so people can test the service before deciding whether they need additional checks.

The backend is responsible for maintaining balances and recording credit usage. The interface displays that information, but it does not determine how many credits a user owns.

**Technical details for judges**

The implementation describes:

- Guest sessions using a `satyam_user_id` cookie.
- Account sessions using an HTTP-only `satyam_session_token` cookie.
- Password hashing using Node.js cryptographic functions.
- Account migration for guest balances and eligible history.

Verify the current implementation and persistence behavior before claiming that all guest history and balances migrate without loss.

Never use a real personal account or password during a public demonstration.

## B. Credit usage and reservations

The documented credit costs are:

| Analysis type | Credit cost |
|---|---:|
| Text analysis | 1 |
| URL analysis | 1 |
| Screenshot analysis | 2 |
| Initial free allowance | 3 |

These values should match the actual configuration and user interface before the presentation.

**Suggested explanation**

The credit system is designed to reserve the required balance before an analysis begins and finalize the deduction after the result is produced. If an analysis fails, the system should release the reservation rather than charge the user for an unsuccessful check.

The important engineering challenge is ensuring that simultaneous requests, retries, and failed operations don't create incorrect balances.

The current implementation should be described as using a reservation protocol only where that behavior has been verified in the relevant routes.

## C. PayPal Sandbox and monetization

**Demonstrate this section only after completing an actual Sandbox transaction.**

The documented package proposals are:

| Package | Checks | Price |
|---|---:|---:|
| Starter | 10 | $2.00 |
| Value | 25 | $5.00 |
| Pro | 60 | $10.00 |

Verify these prices and packages against the current server configuration before presenting them.

**Suggested explanation**

SatyamAI has a credit-based payment model. Users can purchase additional checks, while the backend validates the order and payment before granting credits.

The intended flow is:

1. The server creates an order.
2. The buyer approves it through PayPal.
3. The server captures and verifies the payment.
4. The ledger grants the corresponding credits once.
5. Webhook notifications help reconcile payment events.

We test this integration using PayPal Sandbox before considering any live payment rollout.

**Important verification requirements**

- A completed Sandbox transaction must be demonstrated before describing the flow as end-to-end verified.
- Credits must match the purchased package.
- Duplicate capture attempts and webhook deliveries must not grant credits twice.
- Cancelled, pending, denied, refunded, or reversed payments must be handled according to the implemented payment lifecycle.
- Sandbox activity must not be presented as real customer revenue.

Do not show the payment section if the buyer-approval flow, capture, or credit grant is still failing.

---

# 3. Technology Stack and Architecture

## A. Technology overview

The project's documented stack includes:

| Layer | Technology | Purpose |
|---|---|---|
| Application | Next.js App Router | Website and server-side API routes |
| Language | TypeScript | Typed application code |
| UI | Tailwind CSS and shared components | Responsive interface |
| Validation | Zod | Request and response validation |
| AI reasoning | Amazon Bedrock | Contextual analysis |
| Detection | Deterministic rules | Recognition of known scam patterns |
| Evidence | External evidence and reputation adapters | Additional context for assessments |
| Storage | SQLite and/or JSONL ledger, according to the deployed configuration | Account, history, or credit persistence |
| Testing | Vitest | Automated verification |

Confirm the actual dependencies and implementation before presenting this table as the current stack. Amazon Bedrock is the project's designated primary AI platform; do not describe another model provider as an active fallback unless it is genuinely configured and supported.

## B. How an analysis works

The high-level workflow is:

1. A user submits text, a link, or a supported screenshot.
2. Input validation and security checks run.
3. Credit and rate-limit checks are applied where configured.
4. Deterministic rules identify recognizable warning signs.
5. Available evidence and AI-assisted reasoning contribute to the assessment.
6. The application returns a result with an appropriate level of uncertainty.
7. The system records the relevant outcome and finalizes credit usage according to the implemented workflow.

**Suggested explanation for judges**

We use multiple signals rather than relying entirely on a language model's answer. Recognizable patterns can be handled by deterministic rules, while contextual reasoning helps assess less obvious messages.

External evidence can provide additional context, but a source being related to a topic does not automatically prove a claim. The application must distinguish useful evidence from unrelated or inconclusive results.

The goal is to provide a reasoned assessment, not to claim that every message can be classified with certainty.

## C. Security and privacy

The documented security measures include URL validation intended to mitigate server-side request forgery, input validation, prompt-injection defenses, rate limiting, and server-side payment checks.

**Suggested explanation**

Security is part of the design because this product processes potentially malicious content. We validate submitted inputs, apply restrictions to URL analysis, and keep payment verification on the server.

We also aim to minimize unnecessary storage of submitted content. Account history and credit records require their own access, retention, and deletion controls.

These protections reduce specific risks, but they don't eliminate every possible attack. Deployment configuration, storage durability, and operational monitoring remain important parts of a production review.

---

# 4. What Makes SatyamAI Useful?

## A. Separate scam risk from factual accuracy

SatyamAI assesses two different dimensions:

- **Scam and security risk:** whether a message shows signs of phishing, impersonation, coercion, or other fraudulent behavior.
- **Factual accuracy:** whether a factual claim is supported or contradicted by the available evidence.

Keeping these dimensions separate helps prevent a true statement from making a fraudulent message appear trustworthy.

## B. India-aware scam patterns

The documented rule set includes patterns associated with:

- UPI and OTP-related fraud.
- Fake KYC and account-blocking alerts.
- Electricity-disconnection threats.
- Digital-arrest extortion.
- Suspicious prize and task messages.
- Hindi and Hinglish scam language.

These examples should be demonstrated using actual application results, not only screenshots or prepared claims.

## C. Uncertainty and evidence

When evidence is insufficient, the application should communicate that limitation rather than manufacture certainty.

A result should explain what was checked, what was found, and what remains unknown. Citations should link to relevant sources and must not imply stronger support than those sources provide.

## D. Multi-channel access

The website and Telegram bot are two interfaces to the same core analysis system.

This reduces the need to maintain separate scam-detection logic for each interface and gives users another way to access the service.

---

# 5. Judge Q&A Preparation

## Q1. Why not use a general-purpose chatbot?

**Answer:**

A general-purpose chatbot can explain a suspicious message, but SatyamAI is designed around a more focused workflow. It combines known scam-pattern checks, available external evidence, and contextual reasoning.

It also separates fraud risk from factual accuracy and provides practical next steps. We don't claim that this approach eliminates hallucinations or guarantees a correct verdict; instead, we aim to make the assessment more transparent and useful.

## Q2. How do you reduce false positives and false negatives?

**Answer:**

We use deterministic rules for recognizable patterns and contextual reasoning for more complex cases. We also need to evaluate the system against legitimate messages, different scam categories, multilingual examples, and cases where evidence is inconclusive.

No detection system is perfect. Our focus is to improve the quality of the assessment and communicate uncertainty instead of treating every output as definitive.

## Q3. How do you protect user privacy?

**Answer:**

We aim to minimize the information retained from user submissions. The system's account, history, and credit features have separate storage requirements, and those records need appropriate access and deletion controls.

Our privacy claims are tied to the actual storage behavior of the deployed application. We don't treat the absence of raw-message storage as proof that every form of user data is absent.

## Q4. How do you prevent users from manipulating credits?

**Answer:**

The backend controls credit balances and validates the operations that consume or add credits. The payment flow is designed to validate the captured amount and currency and prevent duplicate credit grants.

We also test concurrent requests and duplicate events. The strength of those protections depends on the correctness and durability of the storage and transaction implementation.

## Q5. What happens when the AI provider is unavailable?

**Answer:**

The application is designed to handle provider failures without automatically treating a message as safe. Deterministic checks may still identify recognizable warning signs, while results requiring unavailable evidence or reasoning should communicate the limitation.

The exact behavior depends on the type of analysis and which components remain available.

## Q6. How does SatyamAI handle factual claims?

**Answer:**

The system attempts to identify claims and assess them using available evidence. It should distinguish supporting evidence, contradictory evidence, mixed findings, and cases where the available sources are insufficient.

Finding a related article is not enough to verify a claim. The relationship between the claim and the evidence matters.

## Q7. Is the project production-ready?

**Answer:**

SatyamAI has a substantial working implementation covering analysis, multiple input types, Telegram access, and a credit-based payment design. We are validating the complete payment flow and the reliability of the deployed environment before treating the product as production-ready.

We would rather identify those limitations honestly than claim that passing automated tests guarantees operational readiness.

## Q8. How would you improve the product next?

**Answer:**

Our immediate priorities are reliable payment processing, evidence quality, security and privacy validation, and a simpler consumer experience. We want users to understand a result quickly and know what to do next.

After those foundations are dependable, feedback from real users will guide which additional features are worth building.

---

# 6. Verification and Demo Readiness

## A. Run the verification commands

From the repository root, use the commands configured by the project:

```bash
npm run test
npm run build
```

Run the dedicated TypeScript check if the project defines one. Do not assume that `npm run lint` performs type checking; inspect `package.json`.

Record the actual results from the current repository immediately before the presentation.

## B. Report results accurately

| Check | What to record |
|---|---|
| Automated tests | Actual passed, failed, and skipped totals |
| TypeScript | Actual typecheck result |
| Production build | Actual build result |
| Code coverage | Measured coverage, if collected |
| Text analysis | Tested result and known limitations |
| URL analysis | Tested result and known limitations |
| Screenshot analysis | Tested result and known limitations |
| Telegram | Actual end-to-end result |
| PayPal Sandbox | Actual completed transaction or not yet verified |
| Deployment | Local, staging, or public environment |

Do not reuse historical test counts without rerunning the tests. Passing tests do not establish 100% code coverage, perfect detection, or production readiness.

## C. Live-demo preparation checklist

Before recording or presenting:

- [ ] Confirm the deployed application opens correctly.
- [ ] Test the chosen message against the current analysis pipeline.
- [ ] Ensure displayed evidence is relevant and attributable.
- [ ] Confirm the verdict and explanation match the actual response.
- [ ] Test the Telegram bot if it is part of the demonstration.
- [ ] Demonstrate PayPal only if a Sandbox purchase has completed successfully.
- [ ] Use disposable demo accounts and never expose tokens or secrets.
- [ ] Keep a prepared example available in case an external service fails.
- [ ] Clearly distinguish a prepared example from a live analysis.
- [ ] Close unrelated tabs and hide personal information before recording.

## D. Final presentation principle

SatyamAI is intended to help people make more informed decisions about suspicious messages and claims. Its value comes from combining practical detection, available evidence, clear explanations, and honest communication about uncertainty.

We should demonstrate the product's actual capabilities, explain the engineering choices that support them, and be transparent about the limitations that remain.

**A credible demonstration of a working product is stronger than a list of promises about a perfect one.**