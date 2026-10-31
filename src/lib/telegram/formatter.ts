import { AnalysisResponse, ScamVerdict, ClaimVerdict, RiskLevel } from '../validation/schemas';

/**
 * Formats Telegram messages for SatyamAI bot responses.
 * Uses standard Telegram Markdown formatting.
 */

export function formatStartMessage(userName?: string): string {
  const greeting = userName ? `Hello *${escapeMarkdown(userName)}*!` : 'Hello!';
  return `${greeting} Welcome to *SatyamAI* 🛡️
_India's Scam Detection & Viral Claim Verification Bot_

नमस्ते! संदिग्ध संदेश, बैंक अलर्ट, लॉटरी SMS या लिंक की सत्यता जांचें।

*What I do:*
1️⃣ *Scam & Fraud Risk:* Detects phishing, UPI collect traps, electricity cut threats, fake KYC, and digital arrest extortion.
2️⃣ *Factual Claim Verification:* Verifies viral government schemes, news, and health claims against authoritative encyclopedic sources.

*How to use:*
• Just *forward* any suspicious message or SMS here.
• Paste a *link/URL* to check for phishing or domain spoofing.
• Send a forwarded WhatsApp forward to verify its claims.
• Use \`/link CODE\` to sync checks with your signed-in website account.

📞 *Emergency Helpline:*
For urgent cyber fraud in India, call *1930* or visit [cybercrime.gov.in](https://cybercrime.gov.in).

_Disclaimer: SatyamAI provides decision support and does not replace official institutional confirmation._`;
}

export function formatHelpMessage(): string {
  return `ℹ️ *SatyamAI Help & Instructions*

*Commands:*
• \`/start\` - Restart bot & overview
• \`/help\` - Show this help guide
• \`/credits\` - Check your available credits
• \`/link CODE\` - Sync credits with your signed-in SatyamAI website account

*Supported Checks:*
• 📩 *Text Messages:* Bank alerts, job offers, electricity bill warnings, lottery SMS.
• 🔗 *Website Links:* Check whether a link is impersonating trusted Indian banks or government portals.
• 🗣️ *Languages:* English, Hindi (हिंदी), and Hinglish are natively supported.

*How to read the two verdicts:*
• *Scam Risk:* Whether the message attempts to steal money, OTP, PIN, or extort you.
• *Factual Claim:* Whether the factual assertions in the message are backed by verifiable evidence.

⚠️ *Safety Reminder:*
No detection system can guarantee 100% safety. Always confirm directly with official bank helplines before sharing credentials.

🚨 *Cyber Helpline:* Dial *1930* (Toll-Free, India)`;
}

export function formatTelegramLinkInstructions(): string {
  return `To sync website and Telegram credits:
1. Sign in to your SatyamAI website account and open *Account*.
2. Generate a one-time Telegram link code.
3. Send \`/link CODE\` here within 10 minutes.

The code can only be used once. Never share it with anyone else.`;
}

export function formatTelegramLinkResult(
  status: 'linked' | 'already_linked' | 'chat_linked' | 'user_linked' | 'invalid_code'
): string {
  switch (status) {
    case 'linked':
      return `✅ *Account linked.* Your website and Telegram now use the same checks balance. Use \`/credits\` to see your available checks.`;
    case 'already_linked':
      return `✅ This Telegram account is already linked to that SatyamAI account. Use \`/credits\` to check your balance.`;
    case 'chat_linked':
      return `⚠️ This Telegram account is already linked to a different SatyamAI account. Sign in to the intended website account and contact support if you need to change the link.`;
    case 'user_linked':
      return `⚠️ That SatyamAI account is already linked to another Telegram account.`;
    default:
      return `❌ That link code is invalid or expired. Generate a new code from your signed-in SatyamAI website account.`;
  }
}

export function formatUnsupportedInputMessage(): string {
  return `⚠️ *Unsupported Input*

SatyamAI currently analyzes *text messages*, *forwarded SMS*, and *website URLs*.

Please copy and paste the text message or link you would like to verify, or forward the message directly to this chat.`;
}

export function formatRateLimitMessage(): string {
  return `⏳ *Rate Limit Reached*

You have sent multiple requests in a short time. Please wait a minute before submitting another message for analysis.

_For urgent financial fraud reporting, call 1930 immediately._`;
}

export function formatErrorMessage(requestId?: string): string {
  const reqStr = requestId ? `\n_Ref: \`${requestId}\`_` : '';
  return `❌ *Analysis Error*

An unexpected issue occurred while analyzing your submission. Please try again in a few moments.${reqStr}

If this is an urgent financial emergency, do not click any links or share OTPs. Contact your bank directly or call *1930*.`;
}

/**
 * Formats an AnalysisResponse into a clean Telegram Markdown message.
 */
export function formatAnalysisReport(analysis: AnalysisResponse, remainingCredits?: number): string {
  const parts: string[] = [];

  // 1. Header
  parts.push(`🛡️ *SatyamAI Verification Report*`);
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);

  // 2. Scam Risk Verdict
  const scamBadge = formatScamVerdict(analysis.classification?.scam_risk?.verdict || analysis.verdict);
  const riskLevelStr = formatRiskLevel(analysis.classification?.scam_risk?.risk_level || analysis.risk_level);
  parts.push(`*Scam & Fraud Risk:* ${scamBadge} (${riskLevelStr})`);

  // 3. Factual Claim Verification (if present or applicable)
  const claimVerdict = analysis.classification?.claim_verification?.verdict;
  if (claimVerdict && (analysis.analysis_type === 'factual_claim' || analysis.analysis_type === 'both' || claimVerdict !== 'unverified')) {
    const claimBadge = formatClaimVerdict(claimVerdict);
    parts.push(`*Factual Accuracy:* ${claimBadge}`);
    if (analysis.extracted_claim) {
      parts.push(`_Claim:_ "${escapeMarkdown(truncate(analysis.extracted_claim, 120))}"`);
    }
  }

  // 4. Summary
  if (analysis.summary) {
    parts.push(`\n📝 *Assessment:*`);
    parts.push(escapeMarkdown(analysis.summary));
  }

  // 5. Reasons / Warning Signs
  if (analysis.reasons && analysis.reasons.length > 0) {
    parts.push(`\n⚠️ *Key Indicators:*`);
    for (const reason of analysis.reasons.slice(0, 4)) {
      const title = escapeMarkdown(reason.title);
      const explanation = escapeMarkdown(reason.explanation);
      parts.push(`• *${title}:* ${explanation}`);
    }
  }

  // 6. Evidence Sources (if any)
  if (analysis.evidence && analysis.evidence.length > 0) {
    parts.push(`\n📚 *Verified Sources:*`);
    for (const ev of analysis.evidence.slice(0, 3)) {
      const title = escapeMarkdown(ev.title || 'Reference Source');
      const publisher = escapeMarkdown(ev.publisher || 'Reference');
      const url = ev.url;
      parts.push(`• [${title}](${url}) _(${publisher})_`);
    }
  }

  // 7. Actionable Guidance & Safety Advice
  if (analysis.recommended_actions && analysis.recommended_actions.length > 0) {
    parts.push(`\n✅ *Recommended Next Steps:*`);
    for (const action of analysis.recommended_actions.slice(0, 3)) {
      parts.push(`• ${escapeMarkdown(action)}`);
    }
  }

  // 8. Cyber Helpline Notice for High/Medium Risk
  const isHighOrMedium =
    analysis.classification?.scam_risk?.risk_level === 'high' ||
    analysis.classification?.scam_risk?.risk_level === 'medium' ||
    analysis.risk_level === 'high' ||
    analysis.risk_level === 'medium';

  if (isHighOrMedium) {
    parts.push(`\n🚨 *National Cyber Crime Helpline:* Call *1930* or visit [cybercrime.gov.in](https://cybercrime.gov.in) to report fraud.`);
  }

  // 9. Remaining Credits (if provided)
  if (remainingCredits !== undefined) {
    parts.push(`\n⭐ *Remaining Credits:* ${remainingCredits}`);
  }

  // 10. Limitations & Footer
  parts.push(`━━━━━━━━━━━━━━━━━━━━━`);
  parts.push(`_⚠️ SatyamAI provides decision support. Absence of detected patterns does not guarantee authenticity._`);

  return parts.join('\n');
}

export function formatCreditsExhaustedMessage(): string {
  return `⏳ *Checks Exhausted*

You have used all your free safety checks.

To get more safety checks, visit the SatyamAI web app or choose a package:
• *Starter Pack:* 10 Checks ($2.00)
• *Plus Pack:* 30 Checks ($5.00)

_For urgent cyber fraud reporting in India, call 1930 immediately._`;
}

export function formatCreditsStatusMessage(balance: number, available: number): string {
  return `⭐ *SatyamAI Check Balance*

• *Total Checks:* ${balance}
• *Available Checks:* ${available}
• *Cost per Check:* 1 Check (Message / Link), 2 Checks (Screenshot)

Every new account receives 3 free checks upon signup. Additional check packages can be purchased in the web app.`;
}

function formatScamVerdict(verdict: ScamVerdict): string {
  switch (verdict) {
    case 'likely_scam':
      return '🚨 *LIKELY SCAM*';
    case 'suspicious':
      return '⚠️ *SUSPICIOUS*';
    case 'no_obvious_risk_found':
      return 'ℹ️ *No Obvious Threat Detected*';
    case 'unverified':
    default:
      return '❓ *Unverified Risk*';
  }
}

function formatRiskLevel(risk: RiskLevel): string {
  switch (risk) {
    case 'high':
      return 'High Risk';
    case 'medium':
      return 'Medium Risk';
    case 'low':
      return 'Low Risk';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

function formatClaimVerdict(verdict: ClaimVerdict): string {
  switch (verdict) {
    case 'supported':
      return '✅ *Supported by Evidence*';
    case 'contradicted':
      return '❌ *Contradicted by Evidence*';
    case 'mixed':
      return '⚖️ *Mixed Evidence*';
    case 'unverified':
    default:
      return '❓ *Unverified Claim*';
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Escapes characters that have special meaning in Telegram Markdown.
 * Note: Asterisks and underscores used intentionally for formatting are preserved.
 */
function escapeMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/[`]/g, "'")
    .replace(/[\[\]]/g, (match) => `\\${match}`);
}
