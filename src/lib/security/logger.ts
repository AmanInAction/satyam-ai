/**
 * Redacted logging utility for SatyamAI.
 * Ensures no AWS access keys, secret tokens, bearer authorization tokens,
 * passwords, or sensitive PII are leaked into server logs or stdout.
 */

const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // AWS Access Key ID (AKIA...)
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY_ID]' },
  // AWS Secret Access Key (approx 40 chars base64)
  { pattern: /(aws_secret_access_key|secretAccessKey|secret_key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi, replacement: '$1: [REDACTED_SECRET]' },
  // AWS Session Token
  { pattern: /(aws_session_token|sessionToken)\s*[:=]\s*["']?([A-Za-z0-9/+=]{100,})["']?/gi, replacement: '$1: [REDACTED_TOKEN]' },
  // Authorization / Bearer tokens
  { pattern: /Bearer\s+([A-Za-z0-9._~+/-]{15,})/gi, replacement: 'Bearer [REDACTED_BEARER_TOKEN]' },
  // Generic API Keys in query/headers
  { pattern: /(api[_-]?key|apikey|token|secret)\s*[:=]\s*["']?([A-Za-z0-9\-_]{16,})["']?/gi, replacement: '$1=[REDACTED_KEY]' },
  // 16-digit credit/debit card numbers
  { pattern: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, replacement: '[REDACTED_CARD_NUMBER]' },
  // 3 or 4 digit CVV codes in context
  { pattern: /(cvv|cvc|security\s*code)\s*[:=]?\s*\d{3,4}\b/gi, replacement: '$1: [REDACTED_CVV]' },
  // Passwords
  { pattern: /(password|passwd|pwd)\s*[:=]\s*["']?[^"'\s]{4,}["']?/gi, replacement: '$1: [REDACTED_PASSWORD]' },
];

export function redactSensitiveData(input: string): string {
  if (!input || typeof input !== 'string') return input;
  let redacted = input;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

export const safeLogger = {
  info(message: string, ...meta: unknown[]): void {
    const formatted = formatLog('INFO', message, meta);
    console.log(redactSensitiveData(formatted));
  },
  warn(message: string, ...meta: unknown[]): void {
    const formatted = formatLog('WARN', message, meta);
    console.warn(redactSensitiveData(formatted));
  },
  error(message: string, ...meta: unknown[]): void {
    const formatted = formatLog('ERROR', message, meta);
    console.error(redactSensitiveData(formatted));
  },
};

function formatLog(level: string, message: string, meta: unknown[]): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta.length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}
