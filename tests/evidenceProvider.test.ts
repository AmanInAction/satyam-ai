import { describe, it, expect } from 'vitest';
import {
  WikipediaEvidenceProvider,
  GoogleFactCheckProvider,
  CompositeEvidenceProvider,
} from '../src/lib/providers/evidenceProvider';

describe('Evidence Retrieval Providers', () => {
  describe('WikipediaEvidenceProvider', () => {
    it('retrieves attributable encyclopedic evidence citations with title, publisher, and canonical URL', async () => {
      const provider = new WikipediaEvidenceProvider(8000);
      const result = await provider.searchEvidence('Digital arrest scam in India');

      expect(result.status).toBe('success');
      expect(Array.isArray(result.evidence)).toBe(true);

      if (result.evidence.length > 0) {
        const item = result.evidence[0];
        expect(item.title).toBeDefined();
        expect(item.publisher).toBe('Wikipedia, The Free Encyclopedia');
        expect(item.url).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
        expect(item.source_type).toBe('encyclopedic_reference');
      }
    });

    it('returns empty evidence gracefully for empty or very short queries', async () => {
      const provider = new WikipediaEvidenceProvider(2000);
      const res = await provider.searchEvidence('  ');
      expect(res.status).toBe('success');
      expect(res.evidence.length).toBe(0);
    });
  });

  describe('GoogleFactCheckProvider', () => {
    it('reports not_configured when API credentials are absent', async () => {
      const provider = new GoogleFactCheckProvider('');
      expect(provider.isConfigured()).toBe(false);

      const res = await provider.searchEvidence('Election fraud claim');
      expect(res.status).toBe('not_configured');
      expect(res.evidence.length).toBe(0);
    });
  });

  describe('CompositeEvidenceProvider', () => {
    it('successfully queries fallback knowledge base when fact check tools is not configured', async () => {
      const composite = new CompositeEvidenceProvider({
        factCheckApiKey: '',
        timeoutMs: 8000,
      });

      const res = await composite.searchEvidence('Phishing and cyber fraud');
      expect(res.status).toBe('success');
      expect(Array.isArray(res.evidence)).toBe(true);
    });
  });
});
