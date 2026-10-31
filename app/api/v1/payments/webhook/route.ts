import { NextRequest, NextResponse } from 'next/server';
import { defaultPayPalClient } from '@/src/lib/payments/paypalClient';
import { defaultCreditLedger } from '@/src/lib/payments/ledger';
import { getCreditPackageById } from '@/src/lib/payments/config';
import { createErrorResponse, generateRequestId } from '@/src/lib/errors/apiError';
import { safeLogger } from '@/src/lib/security/logger';
import { isPaymentCurrency, PayPalWebhookEvent } from '@/src/lib/payments/types';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time',
    },
  });
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  let rawBodyText: string;
  let event: PayPalWebhookEvent;
  try {
    rawBodyText = await req.text();
    event = JSON.parse(rawBodyText);
  } catch {
    return createErrorResponse(
      400,
      'INVALID_JSON',
      'Webhook payload must be valid JSON.',
      requestId
    );
  }

  // 1. Verify Webhook Signature Authenticity
  const isSignatureValid = await defaultPayPalClient.verifyWebhookSignature(
    req.headers,
    rawBodyText
  );

  if (!isSignatureValid) {
    safeLogger.warn('Rejected PayPal webhook with invalid signature.', {
      requestId,
      transmissionId: req.headers.get('paypal-transmission-id'),
    });
    return createErrorResponse(
      400,
      'INVALID_WEBHOOK_SIGNATURE',
      'PayPal webhook signature verification failed.',
      requestId
    );
  }

  const eventType = event.event_type;
  safeLogger.info(`Processing verified PayPal webhook: ${eventType} (${event.id})`);

  try {
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const capture = event.resource;
        const captureStatus = capture.status || 'COMPLETED';

        // Never grant credits for an unapproved, pending, or failed payment
        if (captureStatus !== 'COMPLETED') {
          safeLogger.warn(
            `Ignoring webhook capture with non-completed status: ${captureStatus} for event ${event.id}`
          );
          break;
        }

        const captureId = capture.id;
        const orderId =
          capture.supplementary_data?.related_ids?.order_id || capture.invoice_id || captureId;
        const customId = capture.custom_id || ''; // formatted as "userId:packageId[:currency]"

        if (customId && customId.includes(':')) {
          const [userId, packageId, customCurrency] = customId.split(':');
          const currencyCode = capture.amount?.currency_code || customCurrency || 'USD';
          if (customCurrency && !isPaymentCurrency(customCurrency)) {
            safeLogger.error(`Unsupported payment currency in webhook custom ID: ${customCurrency}`);
            break;
          }
          if (!isPaymentCurrency(currencyCode)) {
            safeLogger.error(`Unsupported payment currency in webhook: ${currencyCode}`);
            break;
          }
          if (customCurrency && customCurrency !== currencyCode) {
            safeLogger.error(
              `Webhook currency mismatch: order expected ${customCurrency}, captured ${currencyCode}`
            );
            break;
          }
          const currency = currencyCode;
          const pkg = getCreditPackageById(packageId, currency);

          if (pkg && userId) {
            // Verify captured amount and currency
            if (capture.amount?.value && parseFloat(capture.amount.value) < parseFloat(pkg.price)) {
              safeLogger.error(
                `Amount mismatch in webhook: expected ${pkg.price}, got ${capture.amount.value}`
              );
              break;
            }
            if (capture.amount?.currency_code && capture.amount.currency_code !== pkg.currency) {
              safeLogger.error(
                `Currency mismatch in webhook: expected ${pkg.currency}, got ${capture.amount.currency_code}`
              );
              break;
            }

            const price = capture.amount?.value || pkg.price;
            const currency = capture.amount?.currency_code || pkg.currency;

            await defaultCreditLedger.addPurchaseCredits(
              userId,
              pkg.credits,
              orderId,
              captureId,
              packageId,
              price,
              currency
            );
            safeLogger.info(
              `Webhook idempotently granted ${pkg.credits} credits to ${userId} from capture ${captureId}`
            );
          }
        }
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.CAPTURE.REVERSED': {
        const refundResource = event.resource;
        const refundId = refundResource.id;
        const captureId =
          (refundResource as any).links?.find((l: any) => l.rel === 'up')?.href?.split('/').pop() ||
          refundResource.id;
        const customId = refundResource.custom_id || '';

        if (customId && customId.includes(':')) {
          const [userId, packageId] = customId.split(':');
          const pkg = getCreditPackageById(packageId);
          const creditsToDeduct = pkg ? pkg.credits : 10;

          await defaultCreditLedger.reconcileRefund(
            userId,
            captureId,
            refundId,
            creditsToDeduct
          );
          safeLogger.info(`Webhook reconciled refund ${refundId} for user ${userId}`);
        }
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
      case 'PAYMENT.CAPTURE.PENDING': {
        safeLogger.warn(`Payment capture event was not completed by PayPal: ${eventType} (${event.id})`);
        break;
      }

      default: {
        safeLogger.info(`Unhandled PayPal webhook event type: ${eventType}`);
        break;
      }
    }

    return NextResponse.json({
      status: 'ok',
      event: eventType,
      eventId: event.id,
      acknowledged: true,
    });
  } catch (err: unknown) {
    safeLogger.error(`Error processing webhook event ${eventType}: ${(err as Error)?.message}`, {
      requestId,
    });
    // Return 200 so PayPal does not endlessly retry fatal payload parsing errors
    return NextResponse.json({ status: 'error', acknowledged: true }, { status: 200 });
  }
}
