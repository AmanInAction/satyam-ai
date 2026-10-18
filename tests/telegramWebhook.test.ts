import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleTelegramPost, GET as handleTelegramGet, OPTIONS as handleTelegramOptions } from '../app/api/v1/telegram/webhook/route';
import { TelegramBotService } from '../src/lib/telegram/botService';
import { TelegramUpdateTracker } from '../src/lib/telegram/updateTracker';
import { AnalysisOrchestrator } from '../src/lib/analysis/orchestrator';
import { TelegramUpdate } from '../src/lib/telegram/types';
import {
  formatStartMessage,
  formatHelpMessage,
  formatAnalysisReport,
  formatUnsupportedInputMessage,
  formatRateLimitMessage,
} from '../src/lib/telegram/formatter';

describe('Phase 8: Telegram Bot Webhook Integration', () => {
  let tracker: TelegramUpdateTracker;
  let botService: TelegramBotService;

  beforeEach(() => {
    tracker = new TelegramUpdateTracker(100, 10);
    botService = new TelegramBotService({
      updateTracker: tracker,
      webhookSecret: 'test-secret-token-xyz',
      rateLimitPerChat: 3,
    });
  });

  describe('Webhook Security & Authentication', () => {
    it('accepts updates with valid X-Telegram-Bot-Api-Secret-Token', async () => {
      const update: TelegramUpdate = {
        update_id: 1001,
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 12345, type: 'private' },
          text: '/start',
        },
      };

      const req = new NextRequest('http://localhost:3000/api/v1/telegram/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-secret-token-xyz',
        },
        body: JSON.stringify(update),
      });

      // Override the service's secret for this specific test
      process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret-token-xyz';
      const res = await handleTelegramPost(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.method).toBe('sendMessage');
      expect(data.chat_id).toBe(12345);
      expect(data.text).toContain('SatyamAI');
    });

    it('rejects updates with invalid secret token with HTTP 401', async () => {
      process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret-token-xyz';

      const req = new NextRequest('http://localhost:3000/api/v1/telegram/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'wrong-unauthorized-secret',
        },
        body: JSON.stringify({ update_id: 1002 }),
      });

      const res = await handleTelegramPost(req);
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.error.code).toBe('UNAUTHORIZED_WEBHOOK');

      // Cleanup
      delete process.env.TELEGRAM_WEBHOOK_SECRET;
    });

    it('handles OPTIONS preflight with CORS headers', async () => {
      const res = await handleTelegramOptions();
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('returns GET health status without leaking secrets', async () => {
      const res = await handleTelegramGet();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('satyam-ai-telegram-webhook');
      expect(typeof data.bot_token_configured).toBe('boolean');
      expect(typeof data.webhook_secret_configured).toBe('boolean');
      expect(data.botToken).toBeUndefined();
      expect(data.webhookSecret).toBeUndefined();
    });
  });

  describe('Update Deduplication & Duplicate Guard', () => {
    it('processes update once and discards identical re-transmitted update_id', async () => {
      const update: TelegramUpdate = {
        update_id: 5555,
        message: {
          message_id: 10,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 9876, type: 'private' },
          text: 'Hello check this message',
        },
      };

      const reply1 = await botService.processUpdate(update);
      expect(reply1).not.toBeNull();
      expect(reply1?.chat_id).toBe(9876);

      // Re-transmit identical update_id
      const reply2 = await botService.processUpdate(update);
      expect(reply2).toBeNull(); // Deduplicated
    });

    it('maintains capacity bounds in update tracker', () => {
      const smallTracker = new TelegramUpdateTracker(3, 10);
      expect(smallTracker.isDuplicate(1)).toBe(false);
      expect(smallTracker.isDuplicate(2)).toBe(false);
      expect(smallTracker.isDuplicate(3)).toBe(false);
      expect(smallTracker.isDuplicate(4)).toBe(false);

      expect(smallTracker.size).toBeLessThanOrEqual(3);
    });
  });

  describe('Command Handling (/start and /help)', () => {
    it('returns bilingual welcome message on /start with 1930 Cyber Helpline', async () => {
      const update: TelegramUpdate = {
        update_id: 2001,
        message: {
          message_id: 2,
          date: Math.floor(Date.now() / 1000),
          from: { id: 111, is_bot: false, first_name: 'Rahul' },
          chat: { id: 111, type: 'private' },
          text: '/start',
        },
      };

      const reply = await botService.processUpdate(update);
      expect(reply).not.toBeNull();
      expect(reply?.chat_id).toBe(111);
      expect(reply?.text).toContain('Rahul');
      expect(reply?.text).toContain('SatyamAI');
      expect(reply?.text).toContain('नमस्ते');
      expect(reply?.text).toContain('1930');
      expect(reply?.text).toContain('cybercrime.gov.in');
    });

    it('returns instruction guide on /help with verdict explanations', async () => {
      const update: TelegramUpdate = {
        update_id: 2002,
        message: {
          message_id: 3,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 111, type: 'private' },
          text: '/help',
        },
      };

      const reply = await botService.processUpdate(update);
      expect(reply).not.toBeNull();
      expect(reply?.text).toContain('SatyamAI Help & Instructions');
      expect(reply?.text).toContain('Scam Risk');
      expect(reply?.text).toContain('Factual Claim');
      expect(reply?.text).toContain('1930');
    });
  });

  describe('Suspicious Scam Analysis & Orchestrator Reuse', () => {
    it('evaluates high-risk electricity disconnection threat via pipeline and preserves dual verdicts', async () => {
      const scamText =
        'Dear consumer, your electricity power will be disconnected tonight at 9:30 PM because your previous month bill was not updated. Immediately call electricity officer at 9876543210.';

      const update: TelegramUpdate = {
        update_id: 3001,
        message: {
          message_id: 4,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 222, type: 'private' },
          text: scamText,
        },
      };

      const reply = await botService.processUpdate(update);
      expect(reply).not.toBeNull();
      expect(reply?.chat_id).toBe(222);

      const text = reply!.text;
      // Dual-verdict checks
      expect(text).toContain('SatyamAI Verification Report');
      expect(text).toContain('Scam & Fraud Risk:');
      expect(text).toMatch(/LIKELY SCAM|SUSPICIOUS/);
      expect(text).toContain('High Risk');
      // Indian Helpline advice
      expect(text).toContain('1930');
      expect(text).toContain('cybercrime.gov.in');
      // Warning signs
      expect(text).toContain('Key Indicators:');
      // Safety limitation disclaimer
      expect(text).toContain('Absence of detected patterns does not guarantee authenticity');
    });

    it('evaluates UPI collect cashback scam via pipeline', async () => {
      const upiScam =
        'Congratulations! You won Rs 50,000 lottery. Approve the UPI collect request in GooglePay and enter your UPI PIN immediately to claim prize money.';

      const update: TelegramUpdate = {
        update_id: 3002,
        message: {
          message_id: 5,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 222, type: 'private' },
          text: upiScam,
        },
      };

      const reply = await botService.processUpdate(update);
      expect(reply).not.toBeNull();
      expect(reply!.text).toMatch(/LIKELY SCAM|SUSPICIOUS/);
    });

    it('evaluates website URL messages through safe URL analysis pipeline', async () => {
      const urlUpdate: TelegramUpdate = {
        update_id: 3003,
        message: {
          message_id: 6,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 333, type: 'private' },
          text: 'https://sbi-yono-update.top/login',
        },
      };

      const reply = await botService.processUpdate(urlUpdate);
      expect(reply).not.toBeNull();
      expect(reply!.text).toContain('SatyamAI Verification Report');
      expect(reply!.text).toMatch(/LIKELY SCAM|SUSPICIOUS/);
    });
  });

  describe('Regional Language Support (Hindi & Hinglish)', () => {
    it('analyzes Hindi Devanagari electricity scam message', async () => {
      const hindiScam =
        'प्रिय उपभोक्ता, आपका बिजली बिल अपडेट न होने के कारण आज रात 9:30 बजे बिजली काट दी जाएगी। तुरंत अधिकारी से 9876543210 पर संपर्क करें।';

      const update: TelegramUpdate = {
        update_id: 4001,
        message: {
          message_id: 7,
          date: Math.floor(Date.now() / 1000),
          from: { id: 444, is_bot: false, first_name: 'Amit', language_code: 'hi' },
          chat: { id: 444, type: 'private' },
          text: hindiScam,
        },
      };

      const reply = await botService.processUpdate(update);
      expect(reply).not.toBeNull();
      expect(reply!.text).toContain('LIKELY SCAM');
      expect(reply!.text).toContain('1930');
    });

    it('analyzes Hinglish forwarded message', async () => {
      const hinglishScam =
        'Bhai urgent hai, electricity bill update nahi hua toh light cut ho jayegi raat ko 9:30 baje. Turant iss number par call karo 9876543210.';

      const update: TelegramUpdate = {
        update_id: 4002,
        message: {
          message_id: 8,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 444, type: 'private' },
          text: hinglishScam,
        },
      };

      const reply = await botService.processUpdate(update);
      expect(reply).not.toBeNull();
      expect(reply!.text).toMatch(/LIKELY SCAM|SUSPICIOUS/);
    });
  });

  describe('Benign Messages & Absence-of-Proof Safety Rule', () => {
    it('evaluates legitimate routine bank notification as no obvious threat detected without claiming absolute safety', async () => {
      const benign =
        'Your account ending in 1234 was credited with INR 5,000.00 on 14-Oct via NEFT. Ref: N123456789. If not done by you, visit your nearest official branch or check official netbanking.';

      const update: TelegramUpdate = {
        update_id: 5001,
        message: {
          message_id: 9,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 555, type: 'private' },
          text: benign,
        },
      };

      const reply = await botService.processUpdate(update);
      expect(reply).not.toBeNull();
      expect(reply!.text).toContain('No Obvious Threat Detected');
      expect(reply!.text).not.toContain('This message is 100% safe');
      expect(reply!.text).toContain('Absence of detected patterns does not guarantee authenticity');
    });
  });

  describe('Rate Limiting & Exception Handling', () => {
    it('enforces per-chat rate limits when configured threshold is exceeded', async () => {
      process.env.TEST_TELEGRAM_RATE_LIMIT = 'true';
      const limitedService = new TelegramBotService({
        updateTracker: new TelegramUpdateTracker(),
        rateLimitPerChat: 2,
      });

      const makeUpdate = (id: number): TelegramUpdate => ({
        update_id: id,
        message: {
          message_id: id,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 9999, type: 'private' },
          text: 'Check message ' + id,
        },
      });

      const r1 = await limitedService.processUpdate(makeUpdate(1));
      const r2 = await limitedService.processUpdate(makeUpdate(2));
      const r3 = await limitedService.processUpdate(makeUpdate(3));

      expect(r1?.text).not.toContain('Rate Limit Reached');
      expect(r2?.text).not.toContain('Rate Limit Reached');
      expect(r3?.text).toContain('Rate Limit Reached');

      delete process.env.TEST_TELEGRAM_RATE_LIMIT;
    });

    it('handles empty text and photo messages gracefully', async () => {
      const emptyUpdate: TelegramUpdate = {
        update_id: 6001,
        message: {
          message_id: 11,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 777, type: 'private' },
        },
      };

      const reply = await botService.processUpdate(emptyUpdate);
      expect(reply).not.toBeNull();
      expect(reply!.text).toContain('Unsupported Input');
    });

    it('preserves deterministic safety verdict when LLM provider throws an exception', async () => {
      const failingLlm = {
        name: 'failing_llm_stub',
        isConfigured: () => true,
        analyzeText: async () => {
          throw new Error('Upstream LLM network error');
        },
      };

      const faultTolerantOrchestrator = new AnalysisOrchestrator({ llmProvider: failingLlm });
      const resilientBot = new TelegramBotService({
        orchestrator: faultTolerantOrchestrator,
        updateTracker: new TelegramUpdateTracker(),
      });

      const update: TelegramUpdate = {
        update_id: 7001,
        message: {
          message_id: 12,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 888, type: 'private' },
          text: 'Electricity connection will be disconnected tonight at 9:30 PM. Call 9876543210 immediately.',
        },
      };

      const reply = await resilientBot.processUpdate(update);
      expect(reply).not.toBeNull();
      // Deterministic rules must preserve high risk verdict despite LLM provider outage
      expect(reply!.text).toContain('LIKELY SCAM');
      expect(reply!.text).toContain('1930');
    });
  });
});
