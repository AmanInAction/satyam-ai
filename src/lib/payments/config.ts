import { CreditPackage } from './types';

/**
 * Global configuration for SatyamAI's Credit System and PayPal Sandbox Integration.
 */

export const FREE_INITIAL_CREDITS = 3;

export const CREDIT_COSTS = {
  text: 1,
  url: 1,
  image: 2,
} as const;

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter Package',
    nameHi: 'स्टार्टर पैक',
    credits: 10,
    price: '2.00',
    currency: 'USD',
    description: '10 Verification Credits for suspicious messages & URLs',
    descriptionHi: 'संदिग्ध संदेशों और लिंक की जांच के लिए 10 क्रेडिट',
    popular: false,
  },
  {
    id: 'plus',
    name: 'Plus Package',
    nameHi: 'प्लस पैक',
    credits: 30,
    price: '5.00',
    currency: 'USD',
    description: '30 Verification Credits (Best Value for Family Protection)',
    descriptionHi: '30 क्रेडिट (पारिवारिक सुरक्षा के लिए सर्वोत्तम मूल्य)',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro Security Package',
    nameHi: 'प्रो सुरक्षा पैक',
    credits: 100,
    price: '12.00',
    currency: 'USD',
    description: '100 Verification Credits for high-volume community or group checking',
    descriptionHi: 'कम्युनिटी या ग्रुप चेकिंग के लिए 100 सत्यापन क्रेडिट',
    popular: false,
  },
];

export function getCreditPackageById(packageId: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((pkg) => pkg.id === packageId);
}

export function getPayPalConfig() {
  const isLive = process.env.PAYPAL_ENV === 'production';
  const apiBase = isLive
    ? 'https://api-m.paypal.com'
    : process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

  return {
    isLive,
    apiBase,
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
    isConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
  };
}
