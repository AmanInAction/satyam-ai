/**
 * TypeScript types for Telegram Bot API Webhook updates and payloads.
 * Based on official Telegram Bot API v6/v7 specification.
 */

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  date: number;
  chat: TelegramChat;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  forward_date?: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

export interface TelegramSendMessagePayload {
  method: 'sendMessage';
  chat_id: number | string;
  text: string;
  parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  reply_to_message_id?: number;
}

export interface TelegramWebhookConfig {
  botToken?: string;
  webhookSecret?: string;
  rateLimitPerUserPerMinute?: number;
}
