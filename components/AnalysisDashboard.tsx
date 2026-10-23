'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  RotateCcw,
  PhoneCall,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  Link as LinkIcon,
  ExternalLink,
  Globe,
  FileText,
  Image as ImageIcon,
  FileSearch,
  Edit3,
  ArrowRight,
  BookCheck,
  Upload,
} from 'lucide-react';
import {
  AnalysisResponse,
  ScamVerdict,
  ClaimVerdict,
  RiskLevel,
  AnalysisType,
} from '../src/lib/validation/schemas';
import { CreditBar, EssentialSafetyGuidanceCard } from './CreditBar';
import { CreditModals } from './CreditModals';
import { CreditPackage, CreditTransaction } from '@/src/lib/payments/types';

interface PresetScenario {
  id: string;
  label: string;
  category: string;
  badge: string;
  text: string;
  languageHint: 'auto' | 'en' | 'hi' | 'hinglish';
}

interface UrlPreset {
  id: string;
  label: string;
  badge: string;
  url: string;
}

interface ScreenshotPreset {
  id: string;
  label: string;
  badge: string;
  mockText: string;
  languageHint: 'auto' | 'en' | 'hi' | 'hinglish';
}

const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'electricity_threat',
    label: 'Electricity Disconnection Threat',
    category: 'Scam Threat',
    badge: 'Urgent Threat',
    languageHint: 'en',
    text: 'Dear consumer, your electricity power will be cut tonight at 9:30 PM because your previous month bill was not updated. Immediately call electricity officer at 9876543210.',
  },
  {
    id: 'upi_pin_trap',
    label: 'Cashback / UPI PIN Trap',
    category: 'Financial Scam',
    badge: 'UPI Scam',
    languageHint: 'en',
    text: 'Congratulations! You won Rs 3500 Diwali Cashback. Scan this QR code and enter your UPI PIN immediately to receive money in your bank account.',
  },
  {
    id: 'digital_arrest',
    label: 'Police / "Digital Arrest" Call',
    category: 'Extortion',
    badge: 'Extortion',
    languageHint: 'en',
    text: 'This is Crime Branch Cyber Police. An illegal parcel containing contraband has been intercepted in your name. A digital arrest warrant has been issued. Transfer Rs 25,000 security deposit or face immediate arrest.',
  },
  {
    id: 'malicious_apk',
    label: 'Fake App Download (.apk)',
    category: 'Dangerous Download',
    badge: 'Malicious App',
    languageHint: 'en',
    text: 'Urgent: Electricity bill unpaid. Download and install BijliBill_Update.apk from link to avoid immediate power disconnection.',
  },
  {
    id: 'instant_loan',
    label: 'Instant Loan Offer',
    category: 'Loan Fraud',
    badge: 'Loan Trap',
    languageHint: 'en',
    text: 'Loan approved! Rs 3,00,000 instant personal loan in 5 mins with zero documents and no CIBIL. Pay processing fee of Rs 1,499 to disburse amount immediately.',
  },
  {
    id: 'hindi_bijli',
    label: 'बिजली बिल धमकी (हिन्दी)',
    category: 'Hindi Scam',
    badge: 'हिन्दी',
    languageHint: 'hi',
    text: 'प्रिय उपभोक्ता, आपका बिजली बिल अपडेट न होने के कारण आज रात 9:30 बजे बिजली काट दी जाएगी। तुरंत बिजली अधिकारी से 9876543210 पर संपर्क करें।',
  },
  {
    id: 'benign_bank_otp',
    label: 'Normal Bank OTP SMS',
    category: 'Normal Notice',
    badge: 'Real Bank OTP',
    languageHint: 'en',
    text: '482910 is your OTP for transaction of Rs 1,850.00 at Swiggy on Card ending 4012. Do NOT share this OTP with anyone, including bank officials.',
  },
  {
    id: 'viral_claim',
    label: 'Free Electricity Policy Rumor',
    category: 'Fact Check',
    badge: 'News Rumor',
    languageHint: 'en',
    text: 'Government has announced that starting next week, all citizen electricity bills under 300 units are completely free across all states under a new national energy decree.',
  },
  {
    id: 'debunked_currency_ban',
    label: '500 Note Ban Claim',
    category: 'Fact Check',
    badge: 'Debunked',
    languageHint: 'en',
    text: 'RBI has announced that 500 rupee currency notes will be completely banned and demonetized from December 2026. Exchange old notes immediately.',
  },
  {
    id: 'dual_scam_scheme',
    label: 'Government Scheme Fee Trap',
    category: 'Dual Risk',
    badge: 'Fake Scheme',
    languageHint: 'en',
    text: 'Government has announced free laptops under PM Yuva Scheme for all students. Pay Rs 150 processing fee via UPI to claim your laptop immediately at bit.ly/pm-laptop-scheme.',
  },
];

const URL_PRESETS: UrlPreset[] = [
  {
    id: 'legit_bank',
    label: 'Official SBI Netbanking',
    badge: 'Official Bank',
    url: 'https://retail.onlinesbi.sbi/retail/login.htm',
  },
  {
    id: 'phishing_brand',
    label: 'Fake YONO Login',
    badge: 'Phishing Link',
    url: 'https://sbi-yono-update.xyz/login.php',
  },
  {
    id: 'free_gift_trap',
    label: 'Free Gift Card Link',
    badge: 'Scam Link',
    url: 'https://free-gift-rewards-claim.top/win',
  },
  {
    id: 'apk_download',
    label: 'Unofficial APK Download',
    badge: 'Suspicious Domain',
    url: 'https://power-bill-pay.site/BijliBill.apk',
  },
];

const SCREENSHOT_PRESETS: ScreenshotPreset[] = [
  {
    id: 'screenshot_phish',
    label: 'Fake Bank Alert Screenshot',
    badge: 'Phishing Image',
    mockText: 'SBI Alert: Your YONO account blocked. Update KYC immediately at https://sbi-kyc-update.xyz/login',
    languageHint: 'en',
  },
  {
    id: 'screenshot_electricity',
    label: 'Power Cut Threat Screenshot',
    badge: 'Scare Tactic',
    mockText: 'Urgent notice: Power will be disconnected tonight at 9:30 PM. Call electricity officer at 9876543210 immediately.',
    languageHint: 'en',
  },
  {
    id: 'screenshot_hindi',
    label: 'हिन्दी बिजली बिल स्क्रीनशॉट',
    badge: 'हिन्दी',
    mockText: 'प्रिय उपभोक्ता, आपकी बिजली का पावर आज रात 9:30 बजे काट दिया जाएगा। तुरंत बिजली अधिकारी से 9876543210 पर संपर्क करें।',
    languageHint: 'hi',
  },
];

function makePresetPngBlob(text: string): Blob {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array([
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  const idat = new Uint8Array([
    0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54,
    0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00
  ]);
  const iend = new Uint8Array([
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
  const padding = new Uint8Array(80);
  const tag = new TextEncoder().encode(`\nMOCK_OCR:${text}`);
  return new Blob([signature, ihdr, idat, padding, iend, tag], { type: 'image/png' });
}

export default function AnalysisDashboard() {
  const [activeTab, setActiveTab] = useState<'text' | 'url' | 'image'>('text');
  const [inputText, setInputText] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [extractedReviewText, setExtractedReviewText] = useState<string>('');
  const [isEditingExtractedText, setIsEditingExtractedText] = useState(false);
  const [languageHint, setLanguageHint] = useState<'auto' | 'en' | 'hi' | 'hinglish'>('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Credit & Allowance state
  const [creditBalance, setCreditBalance] = useState<number>(3);
  const [creditAvailable, setCreditAvailable] = useState<number>(3);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [isCreditsLoading, setIsCreditsLoading] = useState<boolean>(true);
  const [isCreditsExhausted, setIsCreditsExhausted] = useState<boolean>(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState<boolean>(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState<boolean>(false);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const capturedOrdersRef = useRef<Set<string>>(new Set());

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/payments/credits');
      if (res.ok) {
        const data = await res.json();
        setCreditBalance(data.balance ?? 3);
        setCreditAvailable(data.available ?? 3);
        if (data.packages) setCreditPackages(data.packages);
        if (typeof data.available === 'number' && data.available <= 0) {
          setIsCreditsExhausted(true);
        } else {
          setIsCreditsExhausted(false);
        }
      }
    } catch {
      // Fallback to default initial 3
    } finally {
      setIsCreditsLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setIsLedgerLoading(true);
    try {
      const res = await fetch('/api/v1/payments/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        if (typeof data.balance === 'number') setCreditBalance(data.balance);
        if (typeof data.available === 'number') setCreditAvailable(data.available);
      }
    } catch {
      // ignore
    } finally {
      setIsLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Handle return from PayPal approval or cancellation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const isReturn = urlParams.get('paypal_return') === 'true' || urlParams.has('token');
    const isCancel = urlParams.get('paypal_cancel') === 'true' || urlParams.get('cancel') === 'true';
    const token = urlParams.get('token') || urlParams.get('order_id') || urlParams.get('orderId');
    const paramPackageId = urlParams.get('package_id') || urlParams.get('packageId');

    // Retrieve saved pending order from sessionStorage if available
    let storedPending: { orderId: string; packageId: string } | null = null;
    try {
      const stored = sessionStorage.getItem('satyamai_pending_paypal');
      if (stored) {
        storedPending = JSON.parse(stored);
      }
    } catch {
      // ignore
    }

    const effectiveOrderId = token || storedPending?.orderId;
    const effectivePackageId = paramPackageId || storedPending?.packageId || 'plus';

    if (isCancel) {
      try {
        sessionStorage.removeItem('satyamai_pending_paypal');
      } catch {
        // ignore
      }
      window.history.replaceState({}, '', window.location.pathname);
      setPurchaseError('Checkout was cancelled. No charges were made.');
      setIsTopUpOpen(true);
      return;
    }

    if (isReturn && effectiveOrderId) {
      if (capturedOrdersRef.current.has(effectiveOrderId)) {
        return;
      }
      capturedOrdersRef.current.add(effectiveOrderId);

      // Clean URL immediately so refresh won't loop
      window.history.replaceState({}, '', window.location.pathname);

      setIsVerifyingPayment(true);
      setIsTopUpOpen(true);
      setPurchaseError(null);
      setPurchaseSuccess(null);

      fetch('/api/v1/payments/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: effectiveOrderId,
          packageId: effectivePackageId,
        }),
      })
        .then(async (res) => {
          const captureData = await res.json();
          if (!res.ok) {
            if (captureData?.error?.code === 'ORDER_NOT_APPROVED') {
              throw new Error('Payment was not approved at PayPal. No charges were made and no checks were added.');
            }
            throw new Error(captureData?.error?.message || 'Payment confirmation failed.');
          }

          if (captureData.alreadyRedeemed) {
            setPurchaseSuccess('This payment was already verified and credited to your account.');
          } else {
            setPurchaseSuccess(`Payment confirmed! +${captureData.creditsGranted} checks added to your account.`);
          }

          if (typeof captureData.currentBalance === 'number') {
            setCreditBalance(captureData.currentBalance);
            setCreditAvailable(captureData.available ?? captureData.currentBalance);
            if (captureData.available > 0) {
              setIsCreditsExhausted(false);
            }
          }
          try {
            sessionStorage.removeItem('satyamai_pending_paypal');
          } catch {
            // ignore
          }
          await fetchTransactions();
        })
        .catch((err: unknown) => {
          try {
            sessionStorage.removeItem('satyamai_pending_paypal');
          } catch {
            // ignore
          }
          setPurchaseError((err as Error)?.message || 'Payment confirmation failed. Please try again.');
        })
        .finally(() => {
          setIsVerifyingPayment(false);
        });
    }
  }, [fetchTransactions]);

  const handlePurchasePackage = async (packageId: string) => {
    setIsPurchasing(packageId);
    setPurchaseError(null);
    setPurchaseSuccess(null);

    try {
      const returnUrl = `${window.location.origin}/analyze?paypal_return=true&package_id=${packageId}`;
      const cancelUrl = `${window.location.origin}/analyze?paypal_cancel=true&package_id=${packageId}`;

      // 1. Create order on server
      const createRes = await fetch('/api/v1/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, returnUrl, cancelUrl }),
      });
      const orderData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(orderData?.error?.message || 'Payment initiation failed.');
      }

      const approvalUrl =
        orderData.approveUrl ||
        orderData.approvalUrl ||
        orderData.links?.find((l: { rel: string; href: string }) => l.rel === 'approve')?.href;

      if (!approvalUrl) {
        throw new Error('PayPal approval link was not returned by the server.');
      }

      // Save pending order details in sessionStorage
      try {
        sessionStorage.setItem(
          'satyamai_pending_paypal',
          JSON.stringify({
            orderId: orderData.orderId,
            packageId,
            createdAt: Date.now(),
          })
        );
      } catch {
        // ignore
      }

      // 2. Redirect buyer to PayPal's approval URL
      window.location.href = approvalUrl;
    } catch (err: unknown) {
      setPurchaseError((err as Error)?.message || 'Payment could not be started. Please try again.');
      setIsPurchasing(null);
    }
  };

  const handleSelectTextPreset = (preset: PresetScenario) => {
    setInputText(preset.text);
    setLanguageHint(preset.languageHint);
    setErrorMessage(null);
  };

  const handleSelectUrlPreset = (preset: UrlPreset) => {
    setInputUrl(preset.url);
    setErrorMessage(null);
  };

  const handleSelectScreenshotPreset = (preset: ScreenshotPreset) => {
    const blob = makePresetPngBlob(preset.mockText);
    const file = new File([blob], `${preset.id}.png`, { type: 'image/png' });
    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(blob));
    setLanguageHint(preset.languageHint);
    setExtractedReviewText(preset.mockText === '[UNREADABLE]' ? '' : preset.mockText);
    setErrorMessage(null);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image exceeds the 5 MB limit. Please choose a smaller screenshot.');
      return;
    }

    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setExtractedReviewText('');
    setErrorMessage(null);
  };

  const handleClear = () => {
    setInputText('');
    setInputUrl('');
    setSelectedImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    setExtractedReviewText('');
    setIsEditingExtractedText(false);
    setResult(null);
    setErrorMessage(null);
    setCopied(false);
  };

  const handleCopyReport = async () => {
    if (!result) return;
    const scamVerdict = result.classification?.scam_risk?.verdict ?? result.verdict ?? 'unverified';
    const claimVerdict = result.classification?.claim_verification?.verdict ?? 'unverified';
    const extractedClaim = result.classification?.claim_verification?.extracted_claim || result.extracted_claim;

    const formattedScam =
      scamVerdict === 'likely_scam'
        ? 'LIKELY SCAM'
        : scamVerdict === 'suspicious'
        ? 'SUSPICIOUS'
        : scamVerdict === 'no_obvious_risk_found'
        ? 'NO OBVIOUS SCAM DETECTED'
        : 'UNABLE TO VERIFY';

    const textToCopy = `SatyamAI Safety Report
Input: ${result.input_type.toUpperCase()}
Safety Result: ${formattedScam}
${extractedClaim ? `Factual Claim: "${extractedClaim}" (${claimVerdict.toUpperCase()})` : ''}

Summary:
${result.summary}

Recommended Actions:
${result.recommended_actions?.map((a) => `- ${a}`).join('\n') || 'None'}

Helpline (India): 1930 | cybercrime.gov.in`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleAnalyzeText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) {
      setErrorMessage('Please paste a message or choose a sample to check.');
      return;
    }

    if (creditAvailable < 1) {
      setIsCreditsExhausted(true);
      setErrorMessage('You have used your free checks. Please get more checks below to continue.');
      setIsTopUpOpen(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/v1/analyze/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText.trim(),
          language_hint: languageHint,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402 || data?.error?.code === 'INSUFFICIENT_CREDITS') {
          setIsCreditsExhausted(true);
          setCreditAvailable(0);
          setErrorMessage('You have used your free checks. Please get more checks below.');
        } else {
          setErrorMessage(data?.error?.message || 'Could not complete check. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      setResult(data as AnalysisResponse);
      if (typeof data?.credits?.remaining === 'number') {
        setCreditAvailable(data.credits.remaining);
        setCreditBalance(data.credits.remaining);
      } else {
        setCreditAvailable((prev) => Math.max(0, prev - 1));
      }
    } catch {
      setErrorMessage('Network connection error. Please ensure the server is active.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputUrl.trim()) {
      setErrorMessage('Please enter a web link to check.');
      return;
    }

    if (creditAvailable < 1) {
      setIsCreditsExhausted(true);
      setErrorMessage('You have used your free checks. Please get more checks below to continue.');
      setIsTopUpOpen(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/v1/analyze/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: inputUrl.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402 || data?.error?.code === 'INSUFFICIENT_CREDITS') {
          setIsCreditsExhausted(true);
          setCreditAvailable(0);
          setErrorMessage('You have used your free checks. Please get more checks below.');
        } else {
          setErrorMessage(data?.error?.message || 'Could not complete link check. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      setResult(data as AnalysisResponse);
      if (typeof data?.credits?.remaining === 'number') {
        setCreditAvailable(data.credits.remaining);
        setCreditBalance(data.credits.remaining);
      } else {
        setCreditAvailable((prev) => Math.max(0, prev - 1));
      }
    } catch {
      setErrorMessage('Network connection error. Please ensure the server is active.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeImage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedImageFile) {
      setErrorMessage('Please select or upload a screenshot to inspect.');
      return;
    }

    if (creditAvailable < 2) {
      setIsCreditsExhausted(true);
      setErrorMessage('Screenshot checks require 2 checks. Please get more checks below.');
      setIsTopUpOpen(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedImageFile);
      formData.append('language_hint', languageHint);

      const response = await fetch('/api/v1/analyze/image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402 || data?.error?.code === 'INSUFFICIENT_CREDITS') {
          setIsCreditsExhausted(true);
          setCreditAvailable(0);
          setErrorMessage('You have used your free checks. Please get more checks below.');
        } else {
          setErrorMessage(data?.error?.message || 'Could not analyze screenshot. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      setResult(data as AnalysisResponse);
      setExtractedReviewText(data.extracted_text || '');
      setIsEditingExtractedText(false);
      if (typeof data?.credits?.remaining === 'number') {
        setCreditAvailable(data.credits.remaining);
        setCreditBalance(data.credits.remaining);
      } else {
        setCreditAvailable((prev) => Math.max(0, prev - 2));
      }
    } catch {
      setErrorMessage('Network connection error. Please ensure the server is active.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReanalyzeEditedText = async () => {
    if (!extractedReviewText.trim()) {
      setErrorMessage('Extracted text cannot be empty.');
      return;
    }

    if (creditAvailable < 1) {
      setIsCreditsExhausted(true);
      setErrorMessage('Re-checking text requires 1 check. Please get more checks below.');
      setIsTopUpOpen(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/v1/analyze/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: extractedReviewText.trim(),
          language_hint: languageHint,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402 || data?.error?.code === 'INSUFFICIENT_CREDITS') {
          setIsCreditsExhausted(true);
          setCreditAvailable(0);
          setErrorMessage('Checks exhausted. Please get more checks below.');
        } else {
          setErrorMessage(data?.error?.message || 'Could not re-check text.');
        }
        setIsLoading(false);
        return;
      }

      const updatedResponse: AnalysisResponse = {
        ...(data as AnalysisResponse),
        input_type: 'image',
        extracted_text: extractedReviewText.trim(),
      };

      setResult(updatedResponse);
      setIsEditingExtractedText(false);
      if (typeof data?.credits?.remaining === 'number') {
        setCreditAvailable(data.credits.remaining);
        setCreditBalance(data.credits.remaining);
      } else {
        setCreditAvailable((prev) => Math.max(0, prev - 1));
      }
    } catch {
      setErrorMessage('Network connection error while checking refined text.');
    } finally {
      setIsLoading(false);
    }
  };

  // Plain language verdict configurations for clean light theme
  const getScamVerdictConfig = (verdict: ScamVerdict, _risk: RiskLevel) => {
    switch (verdict) {
      case 'likely_scam':
        return {
          title: 'Likely Scam',
          desc: 'Shows strong warning signs of fraud, phishing, or financial trickery.',
          cardBorder: 'border-rose-200 bg-rose-50/60',
          textColor: 'text-rose-700',
          icon: <ShieldAlert className="w-5 h-5 text-rose-600" />,
          statusText: 'High Risk',
        };
      case 'suspicious':
        return {
          title: 'Suspicious — Be Cautious',
          desc: 'Contains pressure tactics or suspicious cues often seen in scams.',
          cardBorder: 'border-amber-200 bg-amber-50/60',
          textColor: 'text-amber-800',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
          statusText: 'Medium Risk',
        };
      case 'unverified':
        return {
          title: 'Unable to Verify',
          desc: 'Not enough information or verifiable patterns to determine risk with confidence.',
          cardBorder: 'border-slate-200 bg-slate-50',
          textColor: 'text-slate-700',
          icon: <HelpCircle className="w-5 h-5 text-slate-500" />,
          statusText: 'Inconclusive',
        };
      case 'no_obvious_risk_found':
      default:
        return {
          title: 'No Obvious Scam Signs Found',
          desc: 'Did not match known scam patterns. Always verify the sender independently before sharing sensitive info or money.',
          cardBorder: 'border-emerald-200 bg-emerald-50/50',
          textColor: 'text-emerald-800',
          icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
          statusText: 'Low Risk',
        };
    }
  };

  const getClaimVerdictConfig = (verdict: ClaimVerdict) => {
    switch (verdict) {
      case 'supported':
        return {
          title: 'Claim Supported by Sources',
          desc: 'Credible reference sources or official records support this statement.',
          cardBorder: 'border-emerald-200 bg-emerald-50/50',
          textColor: 'text-emerald-800',
          icon: <CheckCircle className="w-5 h-5 text-emerald-600" />,
          statusText: 'Supported',
        };
      case 'contradicted':
        return {
          title: 'Claim Contradicted / False',
          desc: 'Reliable fact-checks or official records refute this statement.',
          cardBorder: 'border-rose-200 bg-rose-50/60',
          textColor: 'text-rose-700',
          icon: <XCircle className="w-5 h-5 text-rose-600" />,
          statusText: 'Refuted',
        };
      case 'mixed':
        return {
          title: 'Mixed Evidence',
          desc: 'Some aspects of the claim are accurate while other parts are misleading or unverified.',
          cardBorder: 'border-amber-200 bg-amber-50/60',
          textColor: 'text-amber-800',
          icon: <AlertCircle className="w-5 h-5 text-amber-600" />,
          statusText: 'Mixed',
        };
      case 'unverified':
      default:
        return {
          title: 'Not Verified',
          desc: 'No conclusive fact-check sources were found. Absence of proof does not mean it is true or false.',
          cardBorder: 'border-slate-200 bg-slate-50',
          textColor: 'text-slate-700',
          icon: <HelpCircle className="w-5 h-5 text-slate-500" />,
          statusText: 'Unverified',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Allowance & Checks Bar */}
      <CreditBar
        balance={creditBalance}
        available={creditAvailable}
        isLoading={isCreditsLoading}
        onOpenTopUp={() => setIsTopUpOpen(true)}
        onOpenLedger={() => {
          fetchTransactions();
          setIsLedgerOpen(true);
        }}
      />

      {/* Safety guidance card if checks are exhausted */}
      {isCreditsExhausted && (
        <EssentialSafetyGuidanceCard onOpenTopUp={() => setIsTopUpOpen(true)} />
      )}

      {/* Mode Switch Tabs */}
      <div role="tablist" aria-label="Check options" className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 max-w-fit">
        <button
          role="tab"
          aria-selected={activeTab === 'text'}
          type="button"
          onClick={() => {
            setActiveTab('text');
            setErrorMessage(null);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-600 outline-none ${
            activeTab === 'text'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Check Message</span>
          <span className="text-slate-400 font-normal">· 1 check</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'url'}
          type="button"
          onClick={() => {
            setActiveTab('url');
            setErrorMessage(null);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-600 outline-none ${
            activeTab === 'url'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Check Link</span>
          <span className="text-slate-400 font-normal">· 1 check</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'image'}
          type="button"
          onClick={() => {
            setActiveTab('image');
            setErrorMessage(null);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-600 outline-none ${
            activeTab === 'image'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Check Screenshot</span>
          <span className="text-slate-400 font-normal">· 2 checks</span>
        </button>
      </div>

      {/* Input Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        {activeTab === 'text' ? (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Check a Message or Viral Claim
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paste suspicious SMS, WhatsApp forwards, emails, or rumors in English or Hindi.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="language_select" className="text-xs text-slate-500 font-medium">
                  Language:
                </label>
                <select
                  id="language_select"
                  value={languageHint}
                  onChange={(e) => setLanguageHint(e.target.value as any)}
                  className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="hinglish">Hinglish</option>
                </select>
              </div>
            </div>

            {/* Quick samples */}
            <div className="mb-4">
              <p className="text-xs text-slate-500 font-medium mb-2">
                Or try a sample message:
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESET_SCENARIOS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectTextPreset(preset)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text input form */}
            <form onSubmit={handleAnalyzeText} className="space-y-3">
              <div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAnalyzeText();
                    }
                  }}
                  placeholder="Paste message text here... (Ctrl+Enter to check)"
                  rows={4}
                  maxLength={10000}
                  className="w-full rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 transition resize-y leading-relaxed"
                />
                <div className="flex justify-end mt-1 px-1 text-xs text-slate-400">
                  <span>{inputText.length.toLocaleString()} / 10,000 characters</span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isLoading || (!inputText && !result)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition disabled:opacity-40 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>

                <button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none"
                >
                  {isLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Checking message...</span>
                    </>
                  ) : (
                    <>
                      <span>Check Message</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : activeTab === 'url' ? (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Check a Web Link or Domain
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Checks for impersonation, suspicious website domains, and known threat lists.
              </p>
            </div>

            {/* URL Presets */}
            <div className="mb-4">
              <p className="text-xs text-slate-500 font-medium mb-2">
                Or try a sample link:
              </p>
              <div className="flex flex-wrap gap-2">
                {URL_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectUrlPreset(preset)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* URL Input Form */}
            <form onSubmit={handleAnalyzeUrl} className="space-y-3">
              <div>
                <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-1 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition">
                  <LinkIcon className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
                  <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://example.com/login"
                    maxLength={2048}
                    className="w-full bg-transparent p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isLoading || (!inputUrl && !result)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition disabled:opacity-40 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>

                <button
                  type="submit"
                  disabled={isLoading || !inputUrl.trim()}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none"
                >
                  {isLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Checking link...</span>
                    </>
                  ) : (
                    <>
                      <span>Check Link</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Upload a Screenshot to Inspect
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload screenshots of suspicious chats, alerts, or payment requests.
              </p>
            </div>

            {/* Screenshot Presets */}
            <div className="mb-4">
              <p className="text-xs text-slate-500 font-medium mb-2">
                Or try a sample screenshot:
              </p>
              <div className="flex flex-wrap gap-2">
                {SCREENSHOT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectScreenshotPreset(preset)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Upload Form */}
            <form onSubmit={handleAnalyzeImage} className="space-y-4">
              <div className="relative border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 bg-slate-50/50 hover:bg-blue-50/20 text-center cursor-pointer transition">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                {imagePreviewUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={imagePreviewUrl}
                      alt="Selected Screenshot"
                      className="max-h-48 rounded-lg shadow-xs border border-slate-200 object-contain"
                    />
                    <p className="text-xs text-slate-600">
                      {selectedImageFile?.name} ({(selectedImageFile?.size ? (selectedImageFile.size / 1024).toFixed(0) : 0)} KB) — Click or drop another image to replace
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        Drop screenshot here, or <span className="text-blue-600 underline">browse</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        PNG, JPEG, WebP up to 5 MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isLoading || (!selectedImageFile && !result)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition disabled:opacity-40 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>

                <button
                  type="submit"
                  disabled={isLoading || !selectedImageFile}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none"
                >
                  {isLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Reading image...</span>
                    </>
                  ) : (
                    <>
                      <span>Check Screenshot</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Analysis Results Display */}
      {result && (
        <div className="space-y-6 pt-2">
          {/* Result Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs text-slate-500">
              Safety Check Result
            </span>
            <button
              type="button"
              onClick={handleCopyReport}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 transition flex items-center gap-1.5 shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Copied to clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy report</span>
                </>
              )}
            </button>
          </div>

          {/* Extracted Screenshot Text & User Review Panel */}
          {result.input_type === 'image' && (
            <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/40 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                    <FileSearch className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Text Read from Screenshot
                    </h3>
                    <p className="text-xs text-slate-500">
                      Review the text below to make sure it was read accurately.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingExtractedText(!isEditingExtractedText)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs text-slate-700 transition flex items-center gap-1.5 shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>{isEditingExtractedText ? 'Close editor' : 'Edit text if misread'}</span>
                </button>
              </div>

              {isEditingExtractedText ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600">
                    Correct any misread words, numbers, or names, then click Re-check:
                  </p>
                  <textarea
                    value={extractedReviewText}
                    onChange={(e) => setExtractedReviewText(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-blue-300 bg-white p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setExtractedReviewText(result.extracted_text || '');
                        setIsEditingExtractedText(false);
                      }}
                      className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={handleReanalyzeEditedText}
                      disabled={isLoading || !extractedReviewText.trim()}
                      className="px-3.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 outline-none"
                    >
                      {isLoading ? 'Checking...' : 'Re-check corrected text'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  {extractedReviewText ? (
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {extractedReviewText}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      No readable text detected in this screenshot.
                    </p>
                  )}
                </div>
              )}

              {/* Sensitive Cues Warning */}
              {result.recommended_actions?.some(
                (a) =>
                  a.toLowerCase().includes('sensitive') ||
                  a.toLowerCase().includes('cvv') ||
                  a.toLowerCase().includes('password')
              ) && (
                <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Sensitive data warning:</strong> Never share screenshots showing unmasked bank card numbers, CVVs, or account passwords.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 1. What We Found: Dual Verdict Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dimension 1: Scam & Fraud Risk */}
            {(() => {
              const scamVerdict = result.classification?.scam_risk?.verdict ?? result.verdict ?? 'unverified';
              const riskLevel = result.classification?.scam_risk?.risk_level ?? result.risk_level ?? 'unknown';
              const cfg = getScamVerdictConfig(scamVerdict, riskLevel);

              return (
                <div className={`p-6 rounded-2xl border ${cfg.cardBorder} flex flex-col justify-between shadow-xs`}>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Scam &amp; Fraud Risk
                      </span>
                      <span className={`text-xs font-bold tracking-tight ${cfg.textColor}`}>
                        {cfg.statusText}
                      </span>
                    </div>

                    <div className="flex items-start gap-3 mt-1">
                      <div className="mt-0.5 shrink-0">{cfg.icon}</div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{cfg.title}</h3>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{cfg.desc}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Dimension 2: Factual Claim Verification */}
            {(() => {
              const claimVerdict = result.classification?.claim_verification?.verdict ?? 'unverified';
              const extractedClaim = result.classification?.claim_verification?.extracted_claim || result.extracted_claim;
              const cfg = getClaimVerdictConfig(claimVerdict);

              return (
                <div className={`p-6 rounded-2xl border ${cfg.cardBorder} flex flex-col justify-between shadow-xs`}>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Factual Accuracy
                      </span>
                      <span className={`text-xs font-bold tracking-tight ${cfg.textColor}`}>
                        {cfg.statusText}
                      </span>
                    </div>

                    <div className="flex items-start gap-3 mt-1">
                      <div className="mt-0.5 shrink-0">{cfg.icon}</div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{cfg.title}</h3>
                        {extractedClaim ? (
                          <p className="text-xs text-slate-700 mt-1 italic leading-relaxed">
                            Claim checked: &ldquo;{extractedClaim}&rdquo;
                          </p>
                        ) : (
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{cfg.desc}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 2. Plain Language Summary */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Summary
            </h4>
            <p className="text-sm text-slate-800 leading-relaxed font-normal">{result.summary}</p>
          </div>

          {/* 3. Why: Warning Signs & Signals */}
          {result.reasons && result.reasons.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                <span>Warning signs found</span>
                <span className="text-xs font-normal text-slate-500">
                  {result.reasons.length} {result.reasons.length === 1 ? 'sign' : 'signs'} detected
                </span>
              </h4>

              <div className="space-y-3">
                {result.reasons.map((reason, idx) => (
                  <div
                    key={`${reason.code}-${idx}`}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex flex-col gap-1"
                  >
                    <span className="text-xs font-bold text-slate-900">{reason.title}</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{reason.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. What To Do Next: Actionable Advice */}
          {result.recommended_actions && result.recommended_actions.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>What you should do next</span>
              </h4>
              <ul className="space-y-2">
                {result.recommended_actions.map((action, idx) => (
                  <li key={idx} className="text-xs text-slate-700 flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-600">
                <PhoneCall className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>
                  National Cyber Crime Helpline (India): <strong>1930</strong> | Official portal:{' '}
                  <a
                    href="https://cybercrime.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium focus-visible:ring-2 focus-visible:ring-blue-600 outline-none rounded"
                  >
                    cybercrime.gov.in
                  </a>
                </span>
              </div>
            </div>
          )}

          {/* 5. Sources Checked (when relevant) */}
          {result.evidence && result.evidence.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookCheck className="w-4 h-4 text-blue-600" />
                  <span>Sources checked</span>
                </h4>
                <span className="text-xs text-slate-500">
                  {result.evidence.length} {result.evidence.length === 1 ? 'source' : 'sources'}
                </span>
              </div>

              <div className="space-y-3">
                {result.evidence.map((ev, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <span className="text-xs font-semibold text-slate-900">{ev.title}</span>
                      {ev.verification_finding && ev.verification_finding !== 'neutral' && (
                        <span
                          className={`text-xs font-semibold self-start sm:self-auto flex items-center gap-1.5 ${
                            ev.verification_finding === 'contradicts'
                              ? 'text-rose-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              ev.verification_finding === 'contradicts'
                                ? 'bg-rose-600'
                                : 'bg-emerald-600'
                            }`}
                          />
                          <span>
                            {ev.verification_finding === 'contradicts'
                              ? 'Refutes claim'
                              : 'Corroborates claim'}
                          </span>
                        </span>
                      )}
                    </div>
                    {ev.relevance && (
                      <p className="text-xs text-slate-600 leading-relaxed">{ev.relevance}</p>
                    )}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-slate-500">
                        Source: <strong className="text-slate-700">{ev.publisher}</strong>
                      </span>
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium focus-visible:ring-2 focus-visible:ring-blue-600 outline-none rounded"
                      >
                        <span>Visit source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Honest Guidance Footer */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-700">Notice:</p>
            <p>
              SatyamAI provides advisory safety evaluations to help you spot scams and deceptive messages. It cannot guarantee safety or authenticate digital documents. When in doubt, contact official organizations directly using their verified customer care numbers.
            </p>
          </div>
        </div>
      )}

      {/* Check Purchase & History Modals */}
      <CreditModals
        isTopUpOpen={isTopUpOpen}
        isLedgerOpen={isLedgerOpen}
        onCloseTopUp={() => setIsTopUpOpen(false)}
        onCloseLedger={() => setIsLedgerOpen(false)}
        balance={creditBalance}
        available={creditAvailable}
        packages={creditPackages}
        onPurchase={handlePurchasePackage}
        isPurchasing={isPurchasing}
        purchaseSuccess={purchaseSuccess}
        purchaseError={purchaseError}
        transactions={transactions}
        isLedgerLoading={isLedgerLoading}
        onRefreshLedger={fetchTransactions}
        isVerifyingPayment={isVerifyingPayment}
      />
    </div>
  );
}
