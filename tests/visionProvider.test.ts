import { describe, it, expect, beforeEach } from 'vitest';
import {
  BedrockVisionProvider,
  MockVisionOcrProvider,
  CompositeVisionProvider,
} from '../src/lib/providers/visionProvider';
import { createTestPng } from '../src/lib/security/imageSecurity';

describe('Phase 5: Replaceable Vision & OCR Provider Adapters', () => {
  beforeEach(() => {
    MockVisionOcrProvider.clearFixtures();
  });

  describe('BedrockVisionProvider', () => {
    it('accurately identifies unconfigured state when credentials are unset in environment', () => {
      const provider = new BedrockVisionProvider({
        accessKeyId: '',
        secretAccessKey: '',
      });

      expect(provider.isConfigured()).toBe(false);
      expect(provider.name).toBe('amazon_bedrock_vision');
    });

    it('returns not_configured status gracefully when called without credentials', async () => {
      const provider = new BedrockVisionProvider({
        accessKeyId: '',
        secretAccessKey: '',
      });

      const png = createTestPng(200, 200);
      const res = await provider.extractText(png, 'image/png');

      expect(res.status).toBe('not_configured');
      expect(res.extractedText).toBe('');
    });
  });

  describe('MockVisionOcrProvider', () => {
    it('extracts embedded text payload from test image fixtures', async () => {
      const provider = new MockVisionOcrProvider();
      const sampleText = 'Urgent notice: Pay electricity bill immediately to avoid disconnection.';
      const png = createTestPng(250, 150, sampleText);

      const res = await provider.extractText(png);

      expect(res.status).toBe('success');
      expect(res.extractedText).toBe(sampleText);
      expect(res.confidence).toBeGreaterThan(0.9);
      expect(res.isSensitiveContent).toBe(false);
    });

    it('returns empty text with low confidence for unreadable or blurry image tags', async () => {
      const provider = new MockVisionOcrProvider();
      const png = createTestPng(200, 200, '[UNREADABLE]');

      const res = await provider.extractText(png);

      expect(res.status).toBe('success');
      expect(res.extractedText).toBe('');
      expect(res.confidence).toBeLessThan(0.3);
    });

    it('flags isSensitiveContent when OCR text contains sensitive credentials', async () => {
      const provider = new MockVisionOcrProvider();
      const sensitiveText = 'Card verification: CVV: 719 for card 4111 2222 3333 4444';
      const png = createTestPng(300, 200, sensitiveText);

      const res = await provider.extractText(png);

      expect(res.status).toBe('success');
      expect(res.isSensitiveContent).toBe(true);
    });

    it('supports registered fixtures for targeted regression tests', async () => {
      const provider = new MockVisionOcrProvider();
      const fixtureKey = 'CUSTOM_NOTICE_HASH_123';
      const fixtureText = 'Government announced special subsidy scheme for farmers.';
      MockVisionOcrProvider.registerFixture(fixtureKey, fixtureText);

      const png = createTestPng(200, 100, fixtureKey);
      const res = await provider.extractText(png);

      expect(res.extractedText).toBe(fixtureText);
    });
  });

  describe('CompositeVisionProvider', () => {
    it('falls back to MockVisionOcrProvider when Bedrock credentials are unconfigured', async () => {
      const composite = new CompositeVisionProvider();
      const sampleText = 'State Bank notice regarding KYC renewal.';
      const png = createTestPng(250, 150, sampleText);

      const res = await composite.extractText(png, 'image/png');

      expect(res.status).toBe('success');
      expect(res.extractedText).toBe(sampleText);
    });
  });
});
