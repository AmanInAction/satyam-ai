import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import {
  BedrockVisionProvider,
  MockVisionOcrProvider,
  CompositeVisionProvider,
} from '../src/lib/providers/visionProvider';
import { createTestPng } from '../src/lib/security/imageSecurity';

const structuredVisionOutput = {
  extracted_text: 'Paytm referral promotion',
  language_detected: 'English',
  claimed_organization: 'Paytm',
  claimed_offer_or_reward: 'Referral promotion',
  requested_user_action: null,
  credential_requests: [],
  payment_instructions: [],
  suspicious_indicators: [],
  impersonation_indicators: [],
  urgency_indicators: [],
  confidence: 0.95,
  visual_analysis_summary: 'A referral promotion is visible; no credential request detected.',
};

describe('Phase 5: Replaceable Vision & OCR Provider Adapters', () => {
  beforeEach(() => {
    MockVisionOcrProvider.clearFixtures();
  });

  describe('BedrockVisionProvider', () => {
    it('uses the Qwen vision default rather than the text model ID', async () => {
      const previousModelId = process.env.BEDROCK_MODEL_ID;
      const previousVisionModelId = process.env.BEDROCK_VISION_MODEL_ID;
      process.env.BEDROCK_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';
      delete process.env.BEDROCK_VISION_MODEL_ID;
      const send = vi.fn().mockResolvedValue({
        output: {
          message: {
            content: [{ text: JSON.stringify(structuredVisionOutput) }],
          },
        },
      });
      const client = { send } as unknown as BedrockRuntimeClient;

      try {
        const provider = new BedrockVisionProvider({
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
          client,
        });
        const image = createTestPng(200, 200);
        const result = await provider.extractText(image, 'image/png');

        expect(result.status).toBe('success');
        expect(result.extractedText).toBe('Paytm referral promotion');
        expect(result.visualAnalysis).toEqual(structuredVisionOutput);
        expect(result.detectedLanguage).toBe('English');
        expect(send).toHaveBeenCalledOnce();
        const command = send.mock.calls[0][0] as ConverseCommand;
        expect(command).toBeInstanceOf(ConverseCommand);
        expect(command.input.modelId).toBe('qwen.qwen3-vl-235b-a22b');
        expect(command.input.messages?.[0].content?.[0].image?.format).toBe('png');
      } finally {
        if (previousModelId === undefined) delete process.env.BEDROCK_MODEL_ID;
        else process.env.BEDROCK_MODEL_ID = previousModelId;
        if (previousVisionModelId === undefined) delete process.env.BEDROCK_VISION_MODEL_ID;
        else process.env.BEDROCK_VISION_MODEL_ID = previousVisionModelId;
      }
    });

    it('prefers the dedicated Qwen vision model setting over the text model setting', async () => {
      const previousTextModel = process.env.BEDROCK_MODEL_ID;
      const previousVisionModel = process.env.BEDROCK_VISION_MODEL_ID;
      process.env.BEDROCK_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';
      process.env.BEDROCK_VISION_MODEL_ID = 'qwen.qwen3-vl-235b-a22b';
      const send = vi.fn().mockResolvedValue({
        output: {
          message: {
            content: [{ text: JSON.stringify(structuredVisionOutput) }],
          },
        },
      });

      try {
        const provider = new BedrockVisionProvider({
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
          client: { send } as unknown as BedrockRuntimeClient,
        });
        await provider.extractText(createTestPng(200, 200), 'image/png');

        const command = send.mock.calls[0][0] as ConverseCommand;
        expect(command.input.modelId).toBe('qwen.qwen3-vl-235b-a22b');
      } finally {
        if (previousTextModel === undefined) delete process.env.BEDROCK_MODEL_ID;
        else process.env.BEDROCK_MODEL_ID = previousTextModel;
        if (previousVisionModel === undefined) delete process.env.BEDROCK_VISION_MODEL_ID;
        else process.env.BEDROCK_VISION_MODEL_ID = previousVisionModel;
      }
    });

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
      expect(res.failureCode).toBe('credentials_not_configured');
    });

    it('returns a safe error code when Bedrock rejects the vision request', async () => {
      const send = vi.fn().mockRejectedValue(
        Object.assign(new Error('Sensitive request context must not be returned.'), {
          name: 'AccessDeniedException',
        })
      );
      const provider = new BedrockVisionProvider({
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        client: { send } as unknown as BedrockRuntimeClient,
      });

      const result = await provider.extractText(createTestPng(200, 200), 'image/png');

      expect(result.status).toBe('failed');
      expect(result.failureCode).toBe('AccessDeniedException');
      expect(result.extractedText).toBe('');
    });

    it('allows Qwen image inference to take longer than the previous short timeout', async () => {
      const previousTimeout = process.env.BEDROCK_TIMEOUT_MS;
      process.env.BEDROCK_TIMEOUT_MS = '120000';
      vi.useFakeTimers();

      try {
        const send = vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(
                () =>
                  resolve({
                    output: {
                      message: {
                        content: [{ text: JSON.stringify(structuredVisionOutput) }],
                      },
                    },
                  }),
                30000
              );
            })
        );
        const provider = new BedrockVisionProvider({
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
          client: { send } as unknown as BedrockRuntimeClient,
        });

        const resultPromise = provider.extractText(createTestPng(200, 200), 'image/png');
        await vi.advanceTimersByTimeAsync(30000);

        expect((await resultPromise).status).toBe('success');
      } finally {
        vi.useRealTimers();
        if (previousTimeout === undefined) delete process.env.BEDROCK_TIMEOUT_MS;
        else process.env.BEDROCK_TIMEOUT_MS = previousTimeout;
      }
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
    it('returns an unavailable OCR result instead of fabricated text when Bedrock is unconfigured', async () => {
      const composite = new CompositeVisionProvider(
        new BedrockVisionProvider({
          accessKeyId: '',
          secretAccessKey: '',
        })
      );
      const png = createTestPng(250, 150);

      const res = await composite.extractText(png, 'image/png');

      expect(res.status).toBe('not_configured');
      expect(res.extractedText).toBe('');
      expect(res.extractedText).not.toContain('SBI Alert');
    });

    it('does not fabricate OCR text for an unrecognized image in the mock provider', async () => {
      const provider = new MockVisionOcrProvider();
      const png = Buffer.concat([
        createTestPng(250, 150),
        Buffer.from('UNRECOGNIZED_IMAGE'),
      ]);

      const res = await provider.extractText(png);

      expect(res.status).toBe('not_configured');
      expect(res.extractedText).toBe('');
    });
  });
});
