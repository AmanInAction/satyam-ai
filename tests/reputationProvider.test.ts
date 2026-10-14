import { describe, it, expect } from 'vitest';
import {
  CloudflareDnsReputationProvider,
  GoogleSafeBrowsingProvider,
  CompositeReputationProvider,
} from '../src/lib/providers/reputationProvider';

describe('URL Reputation Providers', () => {
  describe('CloudflareDnsReputationProvider', () => {
    it('evaluates clean domain with success status', async () => {
      const provider = new CloudflareDnsReputationProvider(6000);
      const res = await provider.checkUrl('https://www.google.com/search');
      expect(res.status).toBe('success');
      expect(res.isMalicious).toBe(false);
    });

    it('gracefully handles raw IP addresses without crashing', async () => {
      const provider = new CloudflareDnsReputationProvider(2000);
      const res = await provider.checkUrl('http://192.0.2.1/login');
      expect(res.status).toBe('success');
      expect(res.isMalicious).toBe(false);
    });
  });

  describe('GoogleSafeBrowsingProvider', () => {
    it('reports not_configured when SAFE_BROWSING_API_KEY is not set', async () => {
      const provider = new GoogleSafeBrowsingProvider('');
      expect(provider.isConfigured()).toBe(false);

      const res = await provider.checkUrl('https://example.com');
      expect(res.status).toBe('not_configured');
      expect(res.isMalicious).toBe(false);
    });
  });

  describe('CompositeReputationProvider', () => {
    it('flags deterministic high-risk structural cues as likely malicious', async () => {
      const composite = new CompositeReputationProvider({
        safeBrowsingApiKey: '',
        timeoutMs: 4000,
      });

      const res = await composite.checkUrl('http://sbi-yono-update.top/login');
      expect(res.isMalicious).toBe(true);
      expect(res.threatDetails).toContain('sbi');
    });

    it('evaluates official banking domain as non-malicious', async () => {
      const composite = new CompositeReputationProvider({
        safeBrowsingApiKey: '',
        timeoutMs: 4000,
      });

      const res = await composite.checkUrl('https://www.onlinesbi.sbi/retail/login.htm');
      expect(res.isMalicious).toBe(false);
      expect(res.status).toBe('success');
    });
  });
});
