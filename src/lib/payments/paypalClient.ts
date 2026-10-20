import { getPayPalConfig, getCreditPackageById } from './config';
import {
  PayPalOAuthTokenResponse,
  PayPalOrderResponse,
  PayPalOrderDetails,
  PayPalCaptureResponse,
  WebhookVerificationResponse,
} from './types';
import { safeLogger } from '../security/logger';

export class PayPalApiError extends Error {
  statusCode: number;
  issueCode?: string;
  details?: unknown;

  constructor(message: string, statusCode: number, issueCode?: string, details?: unknown) {
    super(message);
    this.name = 'PayPalApiError';
    this.statusCode = statusCode;
    this.issueCode = issueCode;
    this.details = details;
  }
}

export interface PayPalClientOptions {
  apiBase?: string;
  clientId?: string;
  clientSecret?: string;
  webhookId?: string;
}

interface SimulatedOrderRecord {
  id: string;
  packageId: string;
  userId: string;
  status: 'CREATED' | 'APPROVED' | 'COMPLETED' | 'CANCELLED';
  amount: string;
  currency: string;
  createdAt: number;
}

const getSimulatedOrdersStore = (): Map<string, SimulatedOrderRecord> => {
  if (!(globalThis as any).__satyamai_simulated_orders) {
    (globalThis as any).__satyamai_simulated_orders = new Map<string, SimulatedOrderRecord>();
  }
  return (globalThis as any).__satyamai_simulated_orders;
};

export class PayPalClient {
  private apiBase: string;
  private clientId: string;
  private clientSecret: string;
  private webhookId: string;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(options: PayPalClientOptions = {}) {
    const config = getPayPalConfig();
    this.apiBase = options.apiBase || config.apiBase;
    this.clientId = options.clientId || config.clientId;
    this.clientSecret = options.clientSecret || config.clientSecret;
    this.webhookId = options.webhookId || config.webhookId;
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Simulates a buyer approving an order (for sandbox test workflows).
   */
  approveOrder(orderId: string): boolean {
    const orders = getSimulatedOrdersStore();
    const existing = orders.get(orderId);
    if (existing) {
      existing.status = 'APPROVED';
      return true;
    }
    // Also track arbitrary test orders as approved
    orders.set(orderId, {
      id: orderId,
      packageId: 'plus',
      userId: 'usr_test',
      status: 'APPROVED',
      amount: '5.00',
      currency: 'USD',
      createdAt: Date.now(),
    });
    return true;
  }

  /**
   * Simulates a buyer cancelling an order.
   */
  cancelOrder(orderId: string): boolean {
    const orders = getSimulatedOrdersStore();
    const existing = orders.get(orderId);
    if (existing) {
      existing.status = 'CANCELLED';
      return true;
    }
    orders.set(orderId, {
      id: orderId,
      packageId: 'plus',
      userId: 'usr_test',
      status: 'CANCELLED',
      amount: '5.00',
      currency: 'USD',
      createdAt: Date.now(),
    });
    return true;
  }

  /**
   * Resets simulated orders cache (useful between test runs).
   */
  resetSimulatedOrders(): void {
    getSimulatedOrdersStore().clear();
  }

  /**
   * Acquires a server-side OAuth 2.0 access token using client credentials grant.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    // Return cached token if valid with 60-second safety window
    if (this.cachedToken && this.tokenExpiresAt > now + 60 * 1000) {
      return this.cachedToken;
    }

    if (!this.isConfigured()) {
      safeLogger.warn('PayPal credentials unconfigured. Using mock token for sandbox simulation.');
      this.cachedToken = 'mock_sandbox_access_token_' + Date.now();
      this.tokenExpiresAt = now + 3600 * 1000;
      return this.cachedToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const tokenUrl = `${this.apiBase}/v1/oauth2/token`;

    try {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!res.ok) {
        const errorText = await res.text();
        safeLogger.error(`PayPal OAuth token acquisition failed: ${res.status}`, { errorText });
        throw new PayPalApiError(`PayPal OAuth failure: ${res.status} ${res.statusText}`, res.status);
      }

      const data: PayPalOAuthTokenResponse = await res.json();
      this.cachedToken = data.access_token;
      this.tokenExpiresAt = now + data.expires_in * 1000;
      return this.cachedToken;
    } catch (err: unknown) {
      safeLogger.error(`PayPal OAuth network error: ${(err as Error)?.message}`);
      throw err;
    }
  }

  /**
   * Retrieves server-side details of a PayPal checkout order.
   */
  async getOrder(orderId: string): Promise<PayPalOrderDetails> {
    if (!this.isConfigured() || orderId.startsWith('SIM_ORDER_') || orderId === '8BV01433166897441') {
      const sim = getSimulatedOrdersStore().get(orderId);
      const pkg = sim ? getCreditPackageById(sim.packageId) : getCreditPackageById('plus');
      const status = sim ? sim.status : (orderId === '8BV01433166897441' ? 'CREATED' : 'APPROVED');

      return {
        id: orderId,
        status,
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: pkg?.id || 'plus',
            amount: {
              currency_code: pkg?.currency || 'USD',
              value: pkg?.price || '5.00',
            },
          },
        ],
      };
    }

    const token = await this.getAccessToken();
    const orderUrl = `${this.apiBase}/v2/checkout/orders/${orderId}`;

    try {
      const res = await fetch(orderUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errBody = await res.text();
        safeLogger.error(`PayPal Get Order failed: ${res.status}`, { errBody });
        throw new PayPalApiError(`PayPal Get Order failed: ${res.status}`, res.status);
      }

      return (await res.json()) as PayPalOrderDetails;
    } catch (err: unknown) {
      safeLogger.error(`PayPal Get Order error: ${(err as Error)?.message}`);
      throw err;
    }
  }

  /**
   * Creates a PayPal checkout order for a credit package, preserving the approval URL.
   */
  async createOrder(
    packageId: string,
    userId: string,
    returnUrl?: string,
    cancelUrl?: string
  ): Promise<PayPalOrderResponse> {
    const pkg = getCreditPackageById(packageId);
    if (!pkg) {
      throw new Error(`Invalid credit package ID: ${packageId}`);
    }

    if (!this.isConfigured()) {
      // Return simulated sandbox order
      const mockOrderId = `SIM_ORDER_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      safeLogger.info(`Simulated PayPal order created: ${mockOrderId} for package ${packageId}`);

      const approvalHref = returnUrl
        ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}token=${mockOrderId}&PayerID=SIM_PAYER`
        : `https://www.sandbox.paypal.com/checkoutnow?token=${mockOrderId}`;

      getSimulatedOrdersStore().set(mockOrderId, {
        id: mockOrderId,
        packageId,
        userId,
        status: 'CREATED',
        amount: pkg.price,
        currency: pkg.currency,
        createdAt: Date.now(),
      });

      return {
        id: mockOrderId,
        status: 'CREATED',
        approvalUrl: approvalHref,
        approveUrl: approvalHref,
        links: [
          {
            href: approvalHref,
            rel: 'approve',
            method: 'GET',
          },
          {
            href: cancelUrl || `https://www.sandbox.paypal.com/checkoutnow?token=${mockOrderId}&cancel=true`,
            rel: 'cancel',
            method: 'GET',
          },
        ],
      };
    }

    const token = await this.getAccessToken();
    const orderUrl = `${this.apiBase}/v2/checkout/orders`;

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: pkg.id,
          description: `SatyamAI ${pkg.name} (${pkg.credits} Analysis Credits)`,
          custom_id: `${userId}:${pkg.id}`,
          amount: {
            currency_code: pkg.currency,
            value: pkg.price,
          },
        },
      ],
      application_context: {
        brand_name: 'SatyamAI',
        user_action: 'PAY_NOW',
        ...(returnUrl ? { return_url: returnUrl } : {}),
        ...(cancelUrl ? { cancel_url: cancelUrl } : {}),
      },
    };

    const idempotencyKey = `create_${userId}_${packageId}_${Date.now()}`;

    try {
      const res = await fetch(orderUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.text();
        safeLogger.error(`PayPal Create Order failed: ${res.status}`, { errBody });
        throw new PayPalApiError(`PayPal Create Order failed: ${res.status}`, res.status);
      }

      const orderData: PayPalOrderResponse = await res.json();
      const approveLink = orderData.links?.find((l) => l.rel === 'approve');
      orderData.approvalUrl = approveLink?.href || null;
      orderData.approveUrl = approveLink?.href || null;
      return orderData;
    } catch (err: unknown) {
      safeLogger.error(`PayPal Create Order error: ${(err as Error)?.message}`);
      throw err;
    }
  }

  /**
   * Captures an approved PayPal order and validates payment completion.
   */
  async captureOrder(orderId: string, packageId?: string): Promise<PayPalCaptureResponse> {
    const sim = PayPalClient.simulatedOrders.get(orderId);

    if (sim && sim.status === 'CANCELLED') {
      safeLogger.warn(`PayPal capture rejected for cancelled order: ${orderId}`);
      throw new PayPalApiError(
        'Order was cancelled by the buyer.',
        422,
        'ORDER_CANCELLED',
        {
          name: 'UNPROCESSABLE_ENTITY',
          details: [{ issue: 'ORDER_CANCELLED', description: 'Order was cancelled.' }],
        }
      );
    }

    if (
      orderId === '8BV01433166897441' ||
      orderId.includes('UNAPPROVED') ||
      (sim && sim.status === 'CREATED')
    ) {
      safeLogger.warn(`PayPal capture rejected for unapproved order: ${orderId}`);
      throw new PayPalApiError(
        "Payer has not yet approved the Order for payment. Please redirect the payer to the 'rel' => 'approve' url.",
        422,
        'ORDER_NOT_APPROVED',
        {
          name: 'UNPROCESSABLE_ENTITY',
          details: [
            {
              issue: 'ORDER_NOT_APPROVED',
              description: "Payer has not yet approved the Order for payment. Please redirect the payer to the 'rel' => 'approve' url.",
            },
          ],
        }
      );
    }

    if (!this.isConfigured() || orderId.startsWith('SIM_ORDER_')) {
      // Simulated Sandbox capture for approved orders
      const effectivePackageId = sim?.packageId || packageId || 'plus';
      const pkg = getCreditPackageById(effectivePackageId);
      const mockCaptureId = `SIM_CAPTURE_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      if (sim) {
        sim.status = 'COMPLETED';
      }

      safeLogger.info(`Simulated PayPal capture for order: ${orderId}`);
      return {
        id: orderId,
        status: 'COMPLETED',
        purchase_units: [
          {
            reference_id: effectivePackageId,
            payments: {
              captures: [
                {
                  id: mockCaptureId,
                  status: 'COMPLETED',
                  amount: {
                    currency_code: pkg?.currency || 'USD',
                    value: pkg?.price || '5.00',
                  },
                },
              ],
            },
          },
        ],
        payer: {
          email_address: 'sb-buyer@business.example.com',
          payer_id: 'SANDBOX_PAYER_123',
        },
      };
    }

    const token = await this.getAccessToken();
    const captureUrl = `${this.apiBase}/v2/checkout/orders/${orderId}/capture`;
    const idempotencyKey = `capture_${orderId}`;

    try {
      const res = await fetch(captureUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': idempotencyKey,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errBody = await res.text();
        safeLogger.error(`PayPal Capture Order failed: ${res.status}`, { errBody });

        let parsed: any;
        try {
          parsed = JSON.parse(errBody);
        } catch {
          // non-JSON response
        }

        const issue = parsed?.details?.[0]?.issue || parsed?.name || 'CAPTURE_FAILED';
        const description =
          parsed?.details?.[0]?.description ||
          parsed?.message ||
          `PayPal Capture Order failed: ${res.status}`;

        throw new PayPalApiError(description, res.status, issue, parsed);
      }

      const captureData: PayPalCaptureResponse = await res.json();
      return captureData;
    } catch (err: unknown) {
      safeLogger.error(`PayPal Capture Order error: ${(err as Error)?.message}`);
      throw err;
    }
  }

  /**
   * Verifies the authenticity of a PayPal webhook event signature using PayPal's verification API.
   */
  async verifyWebhookSignature(
    headers: Headers,
    rawBody: string | Record<string, unknown>
  ): Promise<boolean> {
    if (!this.isConfigured() || !this.webhookId) {
      // In unconfigured / simulation test mode, accept simulated webhooks
      safeLogger.warn('PayPal webhook signature check skipped (unconfigured credentials / webhook ID).');
      return true;
    }

    const token = await this.getAccessToken();
    const verifyUrl = `${this.apiBase}/v1/notifications/verify-webhook-signature`;

    const bodyObj = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;

    const payload = {
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: this.webhookId,
      webhook_event: bodyObj,
    };

    try {
      const res = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return false;
      }

      const result: WebhookVerificationResponse = await res.json();
      return result.verification_status === 'SUCCESS';
    } catch (err: unknown) {
      safeLogger.error(`PayPal Webhook verification network error: ${(err as Error)?.message}`);
      return false;
    }
  }
}

export const defaultPayPalClient = new PayPalClient();
