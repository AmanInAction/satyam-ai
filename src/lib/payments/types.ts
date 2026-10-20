/**
 * TypeScript types and interfaces for SatyamAI's Credit-Based Freemium
 * and PayPal Sandbox Monetization Engine.
 */

export type CreditTransactionType =
  | 'initial_grant'
  | 'analysis_debit'
  | 'purchase_credit'
  | 'refund_reversal'
  | 'administrative_adjustment';

export interface CreditTransaction {
  id: string;
  userId: string;
  timestamp: string;
  type: CreditTransactionType;
  amount: number; // positive for credits added, negative for debits
  balanceAfter: number;
  reason: string;
  idempotencyKey?: string;
  metadata?: {
    orderId?: string;
    captureId?: string;
    packageId?: string;
    analysisId?: string;
    analysisType?: 'text' | 'url' | 'image';
    ip?: string;
    currency?: string;
    price?: string;
    refundId?: string;
  };
}

export interface CreditPackage {
  id: string;
  name: string;
  nameHi: string;
  credits: number;
  price: string; // e.g. "2.00"
  currency: string; // e.g. "USD"
  description: string;
  descriptionHi: string;
  popular?: boolean;
}

export interface CreditBalanceResponse {
  userId: string;
  balance: number;
  reserved: number;
  available: number;
  hasReceivedFreeGrant: boolean;
  transactionsCount: number;
}

export interface CreditReservation {
  reservationId: string;
  userId: string;
  amount: number;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'committed' | 'released';
  analysisType: 'text' | 'url' | 'image';
}

export interface PayPalOAuthTokenResponse {
  scope: string;
  access_token: string;
  token_type: string;
  app_id: string;
  expires_in: number;
}

export interface PayPalOrderResponse {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  approvalUrl?: string | null;
  approveUrl?: string | null;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalOrderDetails {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  intent?: string;
  purchase_units?: Array<{
    reference_id?: string;
    amount?: {
      currency_code: string;
      value: string;
    };
  }>;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalCaptureResponse {
  id: string; // Order ID or Capture ID
  status: 'COMPLETED' | 'DECLINED' | 'PARTIALLY_REFUNDED' | 'PENDING' | 'FAILED';
  purchase_units?: Array<{
    reference_id?: string;
    payments?: {
      captures?: Array<{
        id: string;
        status: 'COMPLETED' | 'DECLINED' | 'PARTIALLY_REFUNDED' | 'PENDING' | 'FAILED';
        amount: {
          currency_code: string;
          value: string;
        };
        seller_protection?: {
          status: string;
        };
      }>;
    };
  }>;
  payer?: {
    email_address?: string;
    payer_id?: string;
  };
}

export interface PayPalWebhookEvent {
  id: string;
  event_version?: string;
  create_time: string;
  resource_type: string;
  event_type: string;
  summary?: string;
  resource: {
    id: string;
    status?: string;
    amount?: {
      currency_code: string;
      value: string;
    };
    custom_id?: string;
    invoice_id?: string;
    supplementary_data?: {
      related_ids?: {
        order_id?: string;
      };
    };
    [key: string]: unknown;
  };
}

export interface WebhookVerificationResponse {
  verification_status: 'SUCCESS' | 'FAILURE';
}
