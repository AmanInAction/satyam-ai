import { describe, it, expect } from 'vitest';
import {
  TextAnalysisRequestSchema,
  UrlAnalysisRequestSchema,
  AnalysisResponseSchema,
} from '../src/lib/validation/schemas';

describe('Validation Schemas', () => {
  describe('TextAnalysisRequestSchema', () => {
    it('accepts valid text input', () => {
      const valid = { text: 'Account suspended. Pay fee now.', language_hint: 'en' };
      const res = TextAnalysisRequestSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it('rejects empty or whitespace-only text', () => {
      const invalid = { text: '   ' };
      const res = TextAnalysisRequestSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('rejects oversized text exceeding 10,000 characters', () => {
      const oversized = { text: 'A'.repeat(10001) };
      const res = TextAnalysisRequestSchema.safeParse(oversized);
      expect(res.success).toBe(false);
    });

    it('defaults language_hint to auto if omitted', () => {
      const input = { text: 'Check this message' };
      const res = TextAnalysisRequestSchema.safeParse(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.language_hint).toBe('auto');
      }
    });
  });

  describe('UrlAnalysisRequestSchema', () => {
    it('accepts valid https URL', () => {
      const valid = { url: 'https://example.com/login' };
      const res = UrlAnalysisRequestSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it('accepts valid http URL', () => {
      const valid = { url: 'http://test-site.org/page' };
      const res = UrlAnalysisRequestSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it('rejects non-http schemes (e.g. javascript, ftp, file)', () => {
      const invalid = { url: 'javascript:alert(1)' };
      const res = UrlAnalysisRequestSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('rejects invalid or malformed URL strings', () => {
      const invalid = { url: 'not-a-valid-url' };
      const res = UrlAnalysisRequestSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });
  });

  describe('AnalysisResponseSchema', () => {
    it('validates compliant response payload', () => {
      const payload = {
        analysis_id: 'an_12345678',
        input_type: 'text' as const,
        verdict: 'likely_scam' as const,
        risk_level: 'high' as const,
        summary: 'Urgent payment scam detected.',
        reasons: [
          {
            code: 'urgency_pressure',
            title: 'Urgency Pressure',
            explanation: 'Pressures user to act swiftly.',
          },
        ],
        evidence: [],
        recommended_actions: ['Do not pay.'],
        limitations: ['Heuristic detection only.'],
        checks_performed: ['deterministic_rules', 'mock_llm'],
        provider_status: {
          llm: 'success' as const,
          url_reputation: 'not_applicable' as const,
        },
        created_at: new Date().toISOString(),
      };
      const res = AnalysisResponseSchema.safeParse(payload);
      expect(res.success).toBe(true);
    });
  });
});
