import { ReasonItem, ScamVerdict, RiskLevel } from '../validation/schemas';

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  error?: string;
  errorCode?: 'INVALID_FORMAT' | 'UNSUPPORTED_SCHEME' | 'SSRF_BLOCKED' | 'UNSAFE_PORT' | 'OVERSIZED_URL';
  parsed?: URL;
}

export interface UrlSignalEvaluationResult {
  matchedReasons: ReasonItem[];
  suggestedVerdict: ScamVerdict;
  suggestedRiskLevel: RiskLevel;
  actions: string[];
  limitations: string[];
}

/**
 * List of trusted official domains for benign verification
 */
const TRUSTED_APEX_DOMAINS = new Set([
  'google.com',
  'google.co.in',
  'wikipedia.org',
  'wikimedia.org',
  'github.com',
  'sbi.co.in',
  'onlinesbi.sbi',
  'hdfcbank.com',
  'icicibank.com',
  'axisbank.com',
  'punjabnationalbank.in',
  'bankofbaroda.in',
  'paytm.com',
  'phonepe.com',
  'bhimupi.org.in',
  'npci.org.in',
  'uidai.gov.in',
  'incometax.gov.in',
  'cybercrime.gov.in',
  'cert-in.org.in',
  'rbi.org.in',
]);

const HIGH_ABUSE_TLDS = new Set([
  'top',
  'xyz',
  'tk',
  'ml',
  'ga',
  'cf',
  'gq',
  'work',
  'click',
  'buzz',
  'fit',
  'rest',
  'cam',
  'surf',
  'monster',
]);

const BRAND_KEYWORDS = [
  'sbi',
  'yono',
  'hdfc',
  'icici',
  'axis',
  'pnb',
  'paytm',
  'phonepe',
  'gpay',
  'bhim',
  'aadhaar',
  'uidai',
  'incometax',
  'electricity',
  'bijli',
  'bses',
  'billpay',
  'recharge',
];

const SAFE_WEB_PORTS = new Set(['', '80', '443', '8080', '8443']);

/**
 * Validates and normalizes user-provided URLs while enforcing strict SSRF protections.
 */
export function validateAndNormalizeUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      isValid: false,
      errorCode: 'INVALID_FORMAT',
      error: 'URL cannot be empty.',
    };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    return {
      isValid: false,
      errorCode: 'OVERSIZED_URL',
      error: 'URL exceeds maximum permitted length of 2,048 characters.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      errorCode: 'INVALID_FORMAT',
      error: 'Invalid URL format.',
    };
  }

  // 1. Enforce strict http/https protocols only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      errorCode: 'UNSUPPORTED_SCHEME',
      error: `Unsupported protocol "${parsed.protocol}". Only "http:" and "https:" are supported.`,
    };
  }

  // 2. Enforce safe web ports
  if (!SAFE_WEB_PORTS.has(parsed.port)) {
    return {
      isValid: false,
      errorCode: 'UNSAFE_PORT',
      error: `Port ${parsed.port} is not permitted. Only standard web ports (80, 443, 8080, 8443) are allowed.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Block loopback, localhost, and internal hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'instance-data'
  ) {
    return {
      isValid: false,
      errorCode: 'SSRF_BLOCKED',
      error: 'SSRF protection: Loopback and internal network hostnames are forbidden.',
    };
  }

  // 4. Block decimal/hex/octal encoded IP representations
  if (/^0x[0-9a-f]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
    return {
      isValid: false,
      errorCode: 'SSRF_BLOCKED',
      error: 'SSRF protection: Obfuscated integer/hex IP addresses are forbidden.',
    };
  }

  // 5. IPv4 range checks
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4Match) {
    const octets = [
      parseInt(ipv4Match[1], 10),
      parseInt(ipv4Match[2], 10),
      parseInt(ipv4Match[3], 10),
      parseInt(ipv4Match[4], 10),
    ];

    if (octets.some((o) => o < 0 || o > 255)) {
      return {
        isValid: false,
        errorCode: 'INVALID_FORMAT',
        error: 'Invalid IP address octets.',
      };
    }

    const [a, b] = octets;

    // Loopback (127.0.0.0/8)
    if (a === 127) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        error: 'SSRF protection: 127.0.0.0/8 loopback addresses are forbidden.',
      };
    }

    // Zero network (0.0.0.0/8)
    if (a === 0) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        error: 'SSRF protection: 0.0.0.0/8 addresses are forbidden.',
      };
    }

    // Private Class A: 10.0.0.0/8
    if (a === 10) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        error: 'SSRF protection: Private network address (10.0.0.0/8) is forbidden.',
      };
    }

    // Private Class B: 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        error: 'SSRF protection: Private network address (172.16.0.0/12) is forbidden.',
      };
    }

    // Private Class C: 192.168.0.0/16
    if (a === 192 && b === 168) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        error: 'SSRF protection: Private network address (192.168.0.0/16) is forbidden.',
      };
    }

    // Link-Local / Cloud Metadata: 169.254.0.0/16
    if (a === 169 && b === 254) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        error: 'SSRF protection: Link-local and cloud metadata addresses (169.254.0.0/16) are forbidden.',
      };
    }

    // Carrier-grade NAT: 100.64.0.0/10
    if (a === 100 && b >= 64 && b <= 127) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        error: 'SSRF protection: Shared address space (100.64.0.0/10) is forbidden.',
      };
    }

    // Multicast & Broadcast: 224.0.0.0/4 and above
    if (a >= 224) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        error: 'SSRF protection: Multicast and reserved IP addresses are forbidden.',
      };
    }
  }

  // 6. IPv6 checks
  if (hostname.includes(':') || hostname.startsWith('[') || hostname.endsWith(']')) {
    const rawIpv6 = hostname.replace(/[\[\]]/g, '');
    if (
      rawIpv6 === '::1' ||
      rawIpv6 === '::' ||
      rawIpv6.startsWith('fe80:') ||
      rawIpv6.startsWith('fc') ||
      rawIpv6.startsWith('fd')
    ) {
      return {
        isValid: false,
        errorCode: 'SSRF_BLOCKED',
        error: 'SSRF protection: IPv6 loopback, link-local, and unique local addresses are forbidden.',
      };
    }
  }

  // Canonicalize normalized URL
  const normalized = parsed.toString();

  return {
    isValid: true,
    normalizedUrl: normalized,
    parsed,
  };
}

/**
 * Extracts apex domain (e.g. "sub.example.co.in" -> "example.co.in", "login.bank.com" -> "bank.com")
 */
export function extractApexDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split('.');
  if (parts.length <= 2) {
    return hostname;
  }

  // Handle multi-part ccTLDs like .co.in, .gov.in, .org.uk, .com.au
  const secondLast = parts[parts.length - 2];
  if (['co', 'gov', 'org', 'ac', 'edu', 'res', 'nic'].includes(secondLast) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }

  return parts.slice(-2).join('.');
}

/**
 * Evaluates deterministic suspicious-URL signals with benign counterexample checks.
 */
export function evaluateDeterministicUrlSignals(parsedUrl: URL): UrlSignalEvaluationResult {
  const matchedReasons: ReasonItem[] = [];
  const actions: string[] = [];
  const hostname = parsedUrl.hostname.toLowerCase();
  const apex = extractApexDomain(hostname);
  const isTrustedApex = TRUSTED_APEX_DOMAINS.has(apex);

  // 1. Check for Direct IP address in hostname
  const isDirectIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':');
  if (isDirectIp) {
    matchedReasons.push({
      code: 'ip_address_hostname',
      title: 'Direct IP Hostname',
      explanation:
        'The link uses a raw IP address instead of a registered domain name. Legitimate organizations host public services under branded domains.',
      signal_type: 'deterministic_rule',
      evidence_refs: [],
    });
    actions.push('Do not enter passwords, OTPs, or financial details on IP-hosted web addresses.');
  }

  // 2. Check for Punycode / IDN Homoglyph deception
  if (hostname.includes('xn--')) {
    matchedReasons.push({
      code: 'punycode_homoglyph_deception',
      title: 'Internationalized Punycode Domain',
      explanation:
        'Contains punycode characters (xn--) often used to spoof visual characters in legitimate brand names (IDN homograph attack).',
      signal_type: 'deterministic_rule',
      evidence_refs: [],
    });
    actions.push('Inspect the actual destination domain carefully in the browser address bar.');
  }

  // 3. Userinfo in URL (@ trickery)
  if (parsedUrl.username || parsedUrl.password) {
    matchedReasons.push({
      code: 'userinfo_in_url',
      title: 'Embedded Credentials / @ Sign Trickery',
      explanation:
        'The URL contains embedded userinfo before an @ symbol, a common trick used to mislead readers into believing they are visiting the prefix domain.',
      signal_type: 'deterministic_rule',
      evidence_refs: [],
    });
    actions.push('Avoid clicking links that contain @ symbols in the address.');
  }

  // 4. Excessive Subdomain Nesting (> 3 subdomains) on non-trusted domain
  const subdomains = hostname.split('.');
  if (subdomains.length > 4 && !isTrustedApex) {
    matchedReasons.push({
      code: 'excessive_subdomains',
      title: 'Excessive Subdomain Stacking',
      explanation:
        'The URL contains deeply nested subdomains, frequently used by phishing kits to conceal the actual apex domain from casual inspection.',
      signal_type: 'deterministic_rule',
      evidence_refs: [],
    });
  }

  // 5. Brand Impersonation in non-trusted domain or path
  if (!isTrustedApex) {
    const fullPathAndDomain = `${hostname}${parsedUrl.pathname}`.toLowerCase();
    const matchedBrand = BRAND_KEYWORDS.find((brand) => fullPathAndDomain.includes(brand));

    if (matchedBrand) {
      matchedReasons.push({
        code: 'brand_impersonation_in_domain',
        title: `Possible Brand Spoofing (${matchedBrand.toUpperCase()})`,
        explanation: `The URL references well-known financial/utility brand "${matchedBrand}", but the host domain "${apex}" is not an authorized official domain.`,
        signal_type: 'deterministic_rule',
        evidence_refs: [],
      });
      actions.push(
        `Only access ${matchedBrand.toUpperCase()} services through verified official portals or official mobile applications.`
      );
    }
  }

  // 6. High-Abuse Top-Level Domain (TLD)
  const tld = subdomains[subdomains.length - 1];
  if (HIGH_ABUSE_TLDS.has(tld) && !isTrustedApex) {
    matchedReasons.push({
      code: 'suspicious_tld',
      title: `High-Risk Top-Level Domain (.${tld})`,
      explanation: `The domain uses the .${tld} top-level domain, which is statistically associated with disposable phishing campaigns and malvertising.`,
      signal_type: 'deterministic_rule',
      evidence_refs: [],
    });
  }

  // 7. Phishing / Reward Lure in non-trusted domain or path
  if (!isTrustedApex) {
    const fullPathAndDomain = `${hostname}${parsedUrl.pathname}`.toLowerCase();
    const hasPhishingLure =
      /free-gift|gift-reward|free-reward|claim-reward|reward-claim|verify-login|login-verify|account-update|bank-secure|security-update|cashback-claim/i.test(
        fullPathAndDomain
      );

    if (hasPhishingLure) {
      matchedReasons.push({
        code: 'flagged_domain',
        title: 'Suspicious Domain / Phishing Lure',
        explanation:
          'The URL contains deceptive wording typical of credential-harvesting phishing kits or fraudulent reward campaigns.',
        signal_type: 'deterministic_rule',
        evidence_refs: [],
      });
      actions.push('Do not enter personal credentials or passwords on unsolicited reward or verification links.');
    }
  }

  let suggestedVerdict: ScamVerdict = 'no_obvious_risk_found';
  let suggestedRiskLevel: RiskLevel = 'low';

  const hasHighRiskReason = matchedReasons.some(
    (r) =>
      r.code === 'ip_address_hostname' ||
      r.code === 'brand_impersonation_in_domain' ||
      r.code === 'userinfo_in_url' ||
      r.code === 'flagged_domain'
  );

  if (hasHighRiskReason) {
    suggestedVerdict = 'likely_scam';
    suggestedRiskLevel = 'high';
  } else if (matchedReasons.length > 0) {
    suggestedVerdict = 'suspicious';
    suggestedRiskLevel = 'medium';
  }

  const limitations = [
    'Deterministic URL analysis evaluates syntax and structural patterns; absence of flags does not guarantee safety.',
    'Passive telemetry evaluation only; the server does not fetch or execute the destination web page (SSRF-safe).',
  ];

  return {
    matchedReasons,
    suggestedVerdict,
    suggestedRiskLevel,
    actions,
    limitations,
  };
}
