import {
  IReputationProvider,
  ReputationResult,
} from './interfaces';
import {
  validateAndNormalizeUrl,
  evaluateDeterministicUrlSignals,
} from '../security/urlSecurity';

export interface ReputationProviderConfig {
  safeBrowsingApiKey?: string;
  timeoutMs?: number;
}

/**
 * Cloudflare Security DNS (1.1.1.2) Threat Intelligence Provider.
 * Checks whether a domain is sinkholed or blocked as malware/phishing.
 * Completely keyless, authoritative live network threat check.
 */
export class CloudflareDnsReputationProvider implements IReputationProvider {
  name = 'cloudflare_security_dns';
  private timeoutMs: number;

  constructor(timeoutMs: number = 4000) {
    this.timeoutMs = timeoutMs;
  }

  async checkUrl(urlStr: string): Promise<ReputationResult> {
    let hostname: string;
    try {
      hostname = new URL(urlStr).hostname;
    } catch {
      return {
        isMalicious: false,
        status: 'failed',
      };
    }

    // Skip DoH check for raw IP addresses
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':')) {
      return {
        isMalicious: false,
        status: 'success',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const endpoint = `https://security.cloudflare-dns.com/dns-query?name=${encodeURIComponent(
        hostname
      )}&type=A`;

      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: { Accept: 'application/dns-json' },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          isMalicious: false,
          status: 'unavailable',
        };
      }

      const data = await response.json();
      const answers: Array<{ data?: string }> = data?.Answer || [];

      // Cloudflare Security DNS returns 0.0.0.0 for blocked malware/phishing domains
      const isSinkholed = answers.some(
        (ans) => ans.data === '0.0.0.0' || ans.data === '::'
      );

      if (isSinkholed) {
        return {
          isMalicious: true,
          threatDetails:
            'Domain is sinkholed by Cloudflare Security threat intelligence feed (classified as active malware/phishing).',
          status: 'success',
        };
      }

      return {
        isMalicious: false,
        status: 'success',
      };
    } catch {
      clearTimeout(timeout);
      return {
        isMalicious: false,
        status: 'unavailable',
      };
    }
  }
}

/**
 * Google Safe Browsing API v4 Provider.
 * Uses threatMatches:find endpoint when SAFE_BROWSING_API_KEY is configured.
 */
export class GoogleSafeBrowsingProvider implements IReputationProvider {
  name = 'google_safe_browsing';
  private apiKey: string | null;
  private timeoutMs: number;

  constructor(apiKey?: string, timeoutMs: number = 4000) {
    this.apiKey =
      apiKey ||
      process.env.SAFE_BROWSING_API_KEY ||
      process.env.GOOGLE_SAFE_BROWSING_API_KEY ||
      null;
    this.timeoutMs = timeoutMs;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async checkUrl(urlStr: string): Promise<ReputationResult> {
    if (!this.isConfigured() || !this.apiKey) {
      return {
        isMalicious: false,
        status: 'not_configured',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(
        this.apiKey
      )}`;

      const payload = {
        client: {
          clientId: 'satyam-ai',
          clientVersion: '1.0.0',
        },
        threatInfo: {
          threatTypes: [
            'MALWARE',
            'SOCIAL_ENGINEERING',
            'UNWANTED_SOFTWARE',
            'POTENTIALLY_HARMFUL_APPLICATION',
          ],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url: urlStr }],
        },
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          isMalicious: false,
          status: 'unavailable',
        };
      }

      const data = await response.json();
      const matches = data?.matches;

      if (Array.isArray(matches) && matches.length > 0) {
        const threatType = matches[0].threatType || 'THREAT';
        return {
          isMalicious: true,
          threatDetails: `Google Safe Browsing match: flagged for ${threatType}.`,
          status: 'success',
        };
      }

      return {
        isMalicious: false,
        status: 'success',
      };
    } catch {
      clearTimeout(timeout);
      return {
        isMalicious: false,
        status: 'failed',
      };
    }
  }
}

/**
 * Composite Reputation Provider.
 * Combines:
 * 1. Deterministic URL structure cues (IP hostnames, suspicious TLDs, brand spoofing, @ signs)
 * 2. Cloudflare Security DoH threat intelligence
 * 3. Google Safe Browsing (if configured)
 */
export class CompositeReputationProvider implements IReputationProvider {
  name = 'composite_reputation';
  private cloudflare: CloudflareDnsReputationProvider;
  private safeBrowsing: GoogleSafeBrowsingProvider;

  constructor(config: ReputationProviderConfig = {}) {
    this.cloudflare = new CloudflareDnsReputationProvider(config.timeoutMs);
    this.safeBrowsing = new GoogleSafeBrowsingProvider(config.safeBrowsingApiKey, config.timeoutMs);
  }

  async checkUrl(urlStr: string): Promise<ReputationResult> {
    const norm = validateAndNormalizeUrl(urlStr);
    if (!norm.isValid || !norm.parsed) {
      return {
        isMalicious: false,
        threatDetails: norm.error || 'Invalid URL format.',
        status: 'failed',
      };
    }

    // 1. Evaluate deterministic structural indicators
    const deterministicSignals = evaluateDeterministicUrlSignals(norm.parsed);
    if (deterministicSignals.suggestedVerdict === 'likely_scam') {
      const topReason = deterministicSignals.matchedReasons[0];
      return {
        isMalicious: true,
        threatDetails: topReason?.explanation || 'URL exhibits structural indicators of deception.',
        status: 'success',
      };
    }

    // 2. Query Google Safe Browsing if credentials are available
    if (this.safeBrowsing.isConfigured()) {
      try {
        const sbResult = await this.safeBrowsing.checkUrl(urlStr);
        if (sbResult.isMalicious) {
          return sbResult;
        }
      } catch {
        // Fall through to Cloudflare
      }
    }

    // 3. Query Cloudflare Security DNS threat feed
    try {
      const cfResult = await this.cloudflare.checkUrl(urlStr);
      if (cfResult.isMalicious) {
        return cfResult;
      }
    } catch {
      // Fall through
    }

    // 4. Return suspicious if medium-severity deterministic flags matched
    if (deterministicSignals.suggestedVerdict === 'suspicious') {
      const topReason = deterministicSignals.matchedReasons[0];
      return {
        isMalicious: false,
        threatDetails: topReason?.explanation,
        status: 'success',
      };
    }

    return {
      isMalicious: false,
      status: 'success',
    };
  }
}
