import { describe, it, expect } from 'vitest';
import {
  validateAndNormalizeUrl,
  evaluateDeterministicUrlSignals,
  extractApexDomain,
} from '../src/lib/security/urlSecurity';

describe('URL Security, SSRF Protections, and Deterministic Signals', () => {
  describe('SSRF & Protocol Guards', () => {
    it('accepts valid https and http URLs', () => {
      const resHttps = validateAndNormalizeUrl('https://example.com/login?param=1');
      expect(resHttps.isValid).toBe(true);
      expect(resHttps.parsed?.hostname).toBe('example.com');

      const resHttp = validateAndNormalizeUrl('http://example.org/path');
      expect(resHttp.isValid).toBe(true);
      expect(resHttp.parsed?.protocol).toBe('http:');
    });

    it('rejects forbidden protocols (javascript, file, ftp, data)', () => {
      expect(validateAndNormalizeUrl('javascript:alert(1)').errorCode).toBe('UNSUPPORTED_SCHEME');
      expect(validateAndNormalizeUrl('file:///etc/passwd').errorCode).toBe('UNSUPPORTED_SCHEME');
      expect(validateAndNormalizeUrl('ftp://ftp.example.com/file').errorCode).toBe('UNSUPPORTED_SCHEME');
      expect(validateAndNormalizeUrl('data:text/html,payload').errorCode).toBe('UNSUPPORTED_SCHEME');
    });

    it('blocks loopback IP addresses (127.0.0.1, 127.0.0.2)', () => {
      const res1 = validateAndNormalizeUrl('http://127.0.0.1/admin');
      expect(res1.isValid).toBe(false);
      expect(res1.errorCode).toBe('SSRF_BLOCKED');

      const res2 = validateAndNormalizeUrl('http://127.0.0.2:80/status');
      expect(res2.isValid).toBe(false);
      expect(res2.errorCode).toBe('SSRF_BLOCKED');
    });

    it('blocks localhost hostname and *.localhost', () => {
      const res1 = validateAndNormalizeUrl('http://localhost:8080/internal');
      expect(res1.isValid).toBe(false);
      expect(res1.errorCode).toBe('SSRF_BLOCKED');

      const res2 = validateAndNormalizeUrl('http://service.localhost/api');
      expect(res2.isValid).toBe(false);
      expect(res2.errorCode).toBe('SSRF_BLOCKED');
    });

    it('blocks IPv6 loopback [::1]', () => {
      const res = validateAndNormalizeUrl('http://[::1]/debug');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('SSRF_BLOCKED');
    });

    it('blocks 0.0.0.0 network', () => {
      const res = validateAndNormalizeUrl('http://0.0.0.0:80/');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('SSRF_BLOCKED');
    });

    it('blocks private RFC1918 Class A networks (10.0.0.0/8)', () => {
      const res = validateAndNormalizeUrl('http://10.1.2.3/internal');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('SSRF_BLOCKED');
    });

    it('blocks private RFC1918 Class B networks (172.16.0.0/12)', () => {
      const res = validateAndNormalizeUrl('http://172.20.14.5/admin');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('SSRF_BLOCKED');
    });

    it('blocks private RFC1918 Class C networks (192.168.0.0/16)', () => {
      const res = validateAndNormalizeUrl('http://192.168.1.1/router-login');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('SSRF_BLOCKED');
    });

    it('blocks Cloud Metadata and Link-Local addresses (169.254.169.254)', () => {
      const res = validateAndNormalizeUrl('http://169.254.169.254/latest/meta-data');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('SSRF_BLOCKED');
    });

    it('blocks metadata.google.internal hostname', () => {
      const res = validateAndNormalizeUrl('http://metadata.google.internal/computeMetadata/v1/');
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('SSRF_BLOCKED');
    });

    it('blocks hex / integer obfuscated IPs', () => {
      const resHex = validateAndNormalizeUrl('http://0x7f000001/admin');
      expect(resHex.isValid).toBe(false);
      expect(resHex.errorCode).toBe('SSRF_BLOCKED');

      const resDword = validateAndNormalizeUrl('http://2130706433/admin');
      expect(resDword.isValid).toBe(false);
      expect(resDword.errorCode).toBe('SSRF_BLOCKED');
    });

    it('blocks non-standard unsafe ports (e.g. SSH 22, Redis 6379, MySQL 3306)', () => {
      expect(validateAndNormalizeUrl('http://example.com:22/').errorCode).toBe('UNSAFE_PORT');
      expect(validateAndNormalizeUrl('http://example.com:6379/').errorCode).toBe('UNSAFE_PORT');
      expect(validateAndNormalizeUrl('http://example.com:3306/').errorCode).toBe('UNSAFE_PORT');
    });

    it('permits standard web ports (80, 443, 8080, 8443)', () => {
      expect(validateAndNormalizeUrl('https://example.com:443/').isValid).toBe(true);
      expect(validateAndNormalizeUrl('http://example.com:8080/').isValid).toBe(true);
    });
  });

  describe('extractApexDomain', () => {
    it('correctly handles standard gTLDs', () => {
      expect(extractApexDomain('sub.example.com')).toBe('example.com');
      expect(extractApexDomain('deep.nest.domain.org')).toBe('domain.org');
    });

    it('correctly handles multi-part ccTLDs (.co.in, .gov.in)', () => {
      expect(extractApexDomain('retail.onlinesbi.co.in')).toBe('onlinesbi.co.in');
      expect(extractApexDomain('portal.uidai.gov.in')).toBe('uidai.gov.in');
    });
  });

  describe('Deterministic Suspicious-URL Signals & Benign Counterexamples', () => {
    it('detects direct public IP hostname', () => {
      const parsed = new URL('http://192.0.2.1/login');
      const signals = evaluateDeterministicUrlSignals(parsed);
      expect(signals.suggestedVerdict).toBe('likely_scam');
      expect(signals.matchedReasons.some((r) => r.code === 'ip_address_hostname')).toBe(true);
    });

    it('detects brand impersonation in non-official domain', () => {
      const parsed = new URL('http://sbi-yono-update.top/portal');
      const signals = evaluateDeterministicUrlSignals(parsed);
      expect(signals.suggestedVerdict).toBe('likely_scam');
      expect(signals.matchedReasons.some((r) => r.code === 'brand_impersonation_in_domain')).toBe(true);
    });

    it('detects embedded credentials / @ symbol trickery', () => {
      const parsed = new URL('http://www.google.com@phishing-target.com/login');
      const signals = evaluateDeterministicUrlSignals(parsed);
      expect(signals.suggestedVerdict).toBe('likely_scam');
      expect(signals.matchedReasons.some((r) => r.code === 'userinfo_in_url')).toBe(true);
    });

    it('detects punycode homoglyph deception', () => {
      const parsed = new URL('https://xn--pple-43d.com/store');
      const signals = evaluateDeterministicUrlSignals(parsed);
      expect(signals.matchedReasons.some((r) => r.code === 'punycode_homoglyph_deception')).toBe(true);
      expect(signals.suggestedVerdict).toBe('suspicious');
    });

    it('detects high-risk TLD on suspicious domain', () => {
      const parsed = new URL('https://daily-cash-rewards.xyz/claim');
      const signals = evaluateDeterministicUrlSignals(parsed);
      expect(signals.matchedReasons.some((r) => r.code === 'suspicious_tld')).toBe(true);
      expect(signals.suggestedVerdict).toBe('suspicious');
    });

    it('evaluates official trusted banking domain as benign counterexample', () => {
      const parsed = new URL('https://www.onlinesbi.sbi/retail/login.htm');
      const signals = evaluateDeterministicUrlSignals(parsed);
      expect(signals.suggestedVerdict).toBe('no_obvious_risk_found');
      expect(signals.suggestedRiskLevel).toBe('low');
      expect(signals.matchedReasons.length).toBe(0);
    });

    it('evaluates official Wikipedia page as benign counterexample', () => {
      const parsed = new URL('https://en.wikipedia.org/wiki/Computer_security');
      const signals = evaluateDeterministicUrlSignals(parsed);
      expect(signals.suggestedVerdict).toBe('no_obvious_risk_found');
      expect(signals.suggestedRiskLevel).toBe('low');
    });
  });
});
