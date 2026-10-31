import crypto from 'node:crypto';
import { TelegramUpdate, TelegramSendMessagePayload } from './types';
import { defaultUpdateTracker, TelegramUpdateTracker } from './updateTracker';
import {
  formatStartMessage,
  formatHelpMessage,
  formatAnalysisReport,
  formatUnsupportedInputMessage,
  formatRateLimitMessage,
  formatErrorMessage,
  formatCreditsExhaustedMessage,
  formatCreditsStatusMessage,
  formatTelegramLinkInstructions,
  formatTelegramLinkResult,
} from './formatter';
import { AnalysisOrchestrator, defaultOrchestrator } from '../analysis/orchestrator';
import { defaultCreditLedger } from '../payments/ledger';
import { CreditReservation } from '../payments/types';
import { safeLogger } from '../security/logger';
import { generateRequestId } from '../errors/apiError';
import { defaultDb } from '../db/database';

export interface TelegramBotServiceOptions {
  orchestrator?: AnalysisOrchestrator;
  updateTracker?: TelegramUpdateTracker;
  rateLimitPerChat?: number; // max requests per minute
  botToken?: string;
  webhookSecret?: string;
}

export class TelegramBotService {
  private orchestrator: AnalysisOrchestrator;
  private updateTracker: TelegramUpdateTracker;
  private rateLimitPerChat: number;
  private chatRateLimitMap: Map<number, number[]> = new Map();
  private botToken?: string;
  private webhookSecret?: string;

  constructor(options: TelegramBotServiceOptions = {}) {
    this.orchestrator = options.orchestrator || defaultOrchestrator;
    this.updateTracker = options.updateTracker || defaultUpdateTracker;
    this.rateLimitPerChat = options.rateLimitPerChat || 30;
    this.botToken = options.botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.webhookSecret = options.webhookSecret || process.env.TELEGRAM_WEBHOOK_SECRET;
  }

  /**
   * Validates the secret token header sent by Telegram in webhook updates.
   */
  validateWebhookSecret(secretHeader: string | null): boolean {
    const expected = this.webhookSecret || process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expected) {
      // If no secret configured in environment, allow in development/testing
      return true;
    }
    return secretHeader === expected;
  }

  /**
   * Processes an incoming Telegram Webhook update.
   * Returns a TelegramSendMessagePayload for direct webhook reply, or null if ignored.
   */
  async processUpdate(update: TelegramUpdate): Promise<TelegramSendMessagePayload | null> {
    if (!update || typeof update.update_id !== 'number') {
      safeLogger.warn('Telegram update received without valid update_id');
      return null;
    }

    // 1. Deduplication check
    if (this.updateTracker.isDuplicate(update.update_id)) {
      safeLogger.info(`Ignored duplicate Telegram update_id: ${update.update_id}`);
      return null;
    }

    const message = update.message || update.edited_message;
    if (!message || !message.chat || !message.chat.id) {
      // Non-message update (e.g. inline query, channel post without chat)
      return null;
    }

    const chatId = message.chat.id;

    // 2. Per-chat rate limiting
    if (!this.checkRateLimit(chatId)) {
      safeLogger.warn(`Telegram rate limit exceeded for chat_id: ${chatId}`);
      return {
        method: 'sendMessage',
        chat_id: chatId,
        text: formatRateLimitMessage(),
        parse_mode: 'Markdown',
        reply_to_message_id: message.message_id,
      };
    }

    // 3. Extract text content (either direct text, caption with photo, or command)
    const rawText = (message.text || message.caption || '').trim();

    // Handle empty or media-only inputs without text
    if (!rawText) {
      if (message.photo && message.photo.length > 0) {
        return {
          method: 'sendMessage',
          chat_id: chatId,
          text: `📸 *Screenshot Received*\n\nPlease provide a short text caption describing this screenshot, or copy-paste the text/link from the image directly into this chat for complete verification.`,
          parse_mode: 'Markdown',
          reply_to_message_id: message.message_id,
        };
      }

      return {
        method: 'sendMessage',
        chat_id: chatId,
        text: formatUnsupportedInputMessage(),
        parse_mode: 'Markdown',
        reply_to_message_id: message.message_id,
      };
    }

    // 4. Handle Telegram Commands
    const commandLower = rawText.toLowerCase().split(/\s+/)[0].split('@')[0];
    if (commandLower === '/start') {
      return {
        method: 'sendMessage',
        chat_id: chatId,
        text: formatStartMessage(message.from?.first_name),
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      };
    }

    if (commandLower === '/help') {
      return {
        method: 'sendMessage',
        chat_id: chatId,
        text: formatHelpMessage(),
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      };
    }

    if (commandLower === '/link') {
      if (message.chat.type !== 'private' || message.from?.id !== chatId) {
        return {
          method: 'sendMessage',
          chat_id: chatId,
          text: 'For account security, link your SatyamAI account in a private chat with this bot.',
          parse_mode: 'Markdown',
          reply_to_message_id: message.message_id,
        };
      }

      const code = rawText.split(/\s+/)[1] || '';
      if (!/^[A-Za-z0-9_-]{43}$/.test(code)) {
        return {
          method: 'sendMessage',
          chat_id: chatId,
          text: formatTelegramLinkInstructions(),
          parse_mode: 'Markdown',
          reply_to_message_id: message.message_id,
        };
      }

      try {
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        const claim = await defaultDb.claimTelegramLinkCode(codeHash, String(chatId));
        if (claim.status === 'already_linked') {
          return {
            method: 'sendMessage',
            chat_id: chatId,
            text: formatTelegramLinkResult('already_linked'),
            parse_mode: 'Markdown',
            reply_to_message_id: message.message_id,
          };
        }
        if (claim.status !== 'claimed') {
          return {
            method: 'sendMessage',
            chat_id: chatId,
            text: formatTelegramLinkResult(claim.status),
            parse_mode: 'Markdown',
            reply_to_message_id: message.message_id,
          };
        }

        await defaultCreditLedger.migrateUser(`telegram_${chatId}`, claim.userId);
        const linked = await defaultDb.completeTelegramAccountLink(
          codeHash,
          String(chatId),
          claim.userId
        );
        if (!linked) {
          return {
            method: 'sendMessage',
            chat_id: chatId,
            text: formatTelegramLinkResult('invalid_code'),
            parse_mode: 'Markdown',
            reply_to_message_id: message.message_id,
          };
        }

        return {
          method: 'sendMessage',
          chat_id: chatId,
          text: formatTelegramLinkResult('linked'),
          parse_mode: 'Markdown',
          reply_to_message_id: message.message_id,
        };
      } catch (err: unknown) {
        safeLogger.error(`Unable to link Telegram account: ${(err as Error)?.message}`, {
          chatId,
        });
        return {
          method: 'sendMessage',
          chat_id: chatId,
          text: '❌ Account linking failed unexpectedly. Please generate a new code and try again.',
          parse_mode: 'Markdown',
          reply_to_message_id: message.message_id,
        };
      }
    }

    const telegramUserId =
      await defaultDb.getTelegramLinkedUserId(String(chatId)) || `telegram_${chatId}`;

    if (commandLower === '/credits' || commandLower === '/balance') {
      const balance = await defaultCreditLedger.getBalance(telegramUserId);
      return {
        method: 'sendMessage',
        chat_id: chatId,
        text: formatCreditsStatusMessage(balance.balance, balance.available),
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      };
    }

    // 5. Check and Reserve Credits (1 credit for text or URL)
    const isCleanUrl = /^https?:\/\/[^\s]+$/i.test(rawText);
    let reservation: CreditReservation | null = null;

    try {
      reservation = await defaultCreditLedger.reserveCredits(
        telegramUserId,
        1,
        isCleanUrl ? 'url' : 'text'
      );
    } catch (creditErr: unknown) {
      if ((creditErr as any)?.code === 'INSUFFICIENT_CREDITS') {
        return {
          method: 'sendMessage',
          chat_id: chatId,
          text: formatCreditsExhaustedMessage(),
          parse_mode: 'Markdown',
          reply_to_message_id: message.message_id,
        };
      }
    }

    // 6. Route to SatyamAI Orchestrator (Unified Intelligence)
    try {
      let analysis;
      if (isCleanUrl) {
        safeLogger.info(`Telegram analyzing URL for chat ${chatId}`);
        analysis = await this.orchestrator.analyzeUrl(rawText);
      } else {
        safeLogger.info(`Telegram analyzing text (${rawText.length} chars) for chat ${chatId}`);
        const langCode = message.from?.language_code;
        const langHint = langCode === 'hi' ? 'hi' : 'auto';
        analysis = await this.orchestrator.analyzeText(rawText, langHint);
      }

      // Commit credit reservation
      if (reservation) {
        await defaultCreditLedger.commitReservation(reservation.reservationId, analysis.analysis_id);
      }

      const balance = await defaultCreditLedger.getBalance(telegramUserId);

      return {
        method: 'sendMessage',
        chat_id: chatId,
        text: formatAnalysisReport(analysis, balance.available),
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_to_message_id: message.message_id,
      };
    } catch (err: unknown) {
      if (reservation) {
        await defaultCreditLedger.releaseReservation(reservation.reservationId, 'analysis_failed');
      }

      const requestId = generateRequestId();
      safeLogger.error(`Error processing Telegram message: ${(err as Error)?.message}`, {
        chatId,
        requestId,
      });
      return {
        method: 'sendMessage',
        chat_id: chatId,
        text: formatErrorMessage(requestId),
        parse_mode: 'Markdown',
        reply_to_message_id: message.message_id,
      };
    }
  }

  /**
   * Enforces sliding-window rate limit per chat ID (e.g. 30 requests/min).
   */
  private checkRateLimit(chatId: number): boolean {
    if (process.env.VITEST && !process.env.TEST_TELEGRAM_RATE_LIMIT) {
      return true;
    }

    const now = Date.now();
    const windowMs = 60 * 1000;
    let timestamps = this.chatRateLimitMap.get(chatId) || [];

    timestamps = timestamps.filter((t) => now - t < windowMs);
    if (timestamps.length >= this.rateLimitPerChat) {
      return false;
    }

    timestamps.push(now);
    this.chatRateLimitMap.set(chatId, timestamps);
    return true;
  }

  /**
   * Clears per-chat rate limiting state (for testing).
   */
  resetRateLimits(): void {
    this.chatRateLimitMap.clear();
  }
}

export const defaultTelegramBotService = new TelegramBotService();
