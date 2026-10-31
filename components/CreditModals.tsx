'use client';

import React, { useState } from 'react';
import {
  X,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Shield,
  ArrowUpRight,
  Check,
} from 'lucide-react';
import { CreditPackage, CreditTransaction } from '@/src/lib/payments/types';
import { PaymentCurrency } from '@/src/lib/payments/types';

interface CreditModalsProps {
  isTopUpOpen: boolean;
  isLedgerOpen: boolean;
  onCloseTopUp: () => void;
  onCloseLedger: () => void;
  balance: number;
  available: number;
  packages: CreditPackage[];
  onPurchase: (packageId: string, currency: PaymentCurrency) => Promise<void>;
  isPurchasing: string | null;
  purchaseSuccess: string | null;
  purchaseError: string | null;
  transactions: CreditTransaction[];
  isLedgerLoading: boolean;
  onRefreshLedger: () => void;
  isVerifyingPayment?: boolean;
}

export function CreditModals({
  isTopUpOpen,
  isLedgerOpen,
  onCloseTopUp,
  onCloseLedger,
  balance,
  available,
  packages,
  onPurchase,
  isPurchasing,
  purchaseSuccess,
  purchaseError,
  transactions,
  isLedgerLoading,
  onRefreshLedger,
  isVerifyingPayment,
}: CreditModalsProps) {
  const [currency, setCurrency] = useState<PaymentCurrency>('USD');

  if (!isTopUpOpen && !isLedgerOpen) return null;

  return (
    <>
      {/* 1. Top Up / Purchase Modal */}
      {isTopUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl p-6 sm:p-8 overflow-y-auto max-h-[90vh]">
            {/* Close Button */}
            <button
              type="button"
              onClick={onCloseTopUp}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Get More Safety Checks</h3>
                <p className="text-xs text-slate-500">
                  Current balance: <span className="font-semibold text-slate-700">{available} checks available</span>
                </p>
              </div>
            </div>

            {/* Consumer-friendly reassurance notice */}
            <div className="mb-6 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                Choose a package below to add checks to your account. Checks never expire.
              </div>
            </div>

            <div className="mb-5 flex items-center gap-2" role="group" aria-label="Payment currency">
              {(['USD', 'INR'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={currency === option}
                  onClick={() => setCurrency(option)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    currency === option
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {option === 'INR' ? 'INR (₹)' : 'USD ($)'}
                </button>
              ))}
            </div>

            {/* Feedback Messages */}
            {isVerifyingPayment && (
              <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                <div className="font-medium">Confirming your PayPal payment and adding checks to your account...</div>
              </div>
            )}

            {purchaseSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="font-medium">{purchaseSuccess}</div>
              </div>
            )}

            {purchaseError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <div className="font-medium">{purchaseError}</div>
              </div>
            )}

            {/* Package Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {packages.map((packageOption) => {
                const pkg = {
                  ...packageOption,
                  price: packageOption.prices[currency],
                  currency,
                };
                const isSelected = isPurchasing === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className={`relative rounded-xl border p-5 flex flex-col justify-between transition ${
                      pkg.popular
                        ? 'border-blue-500 bg-blue-50/40 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-blue-600 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                        Popular
                      </span>
                    )}

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{pkg.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{pkg.description}</p>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold text-slate-900">
                          {currency === 'INR' ? '₹' : '$'}{pkg.price}
                        </span>
                        <span className="text-xs text-slate-500">{currency}</span>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-emerald-700">
                        +{pkg.credits} Checks
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={Boolean(isPurchasing) || Boolean(isVerifyingPayment)}
                      onClick={() => onPurchase(pkg.id, currency)}
                      className={`mt-5 w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 ${
                        pkg.popular
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
                          <span>Redirecting to PayPal...</span>
                        </>
                      ) : (
                        <>
                          <span>Pay with PayPal</span>
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Explanatory Costs Footer */}
            <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
              <div className="flex items-center gap-4">
                <span>Message: <strong>1 check</strong></span>
                <span>Link: <strong>1 check</strong></span>
                <span>Screenshot: <strong>2 checks</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                <span>Instant delivery to your account</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Transaction / Check History Modal */}
      {isLedgerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl p-6 sm:p-8 overflow-y-auto max-h-[90vh]">
            {/* Close Button */}
            <button
              type="button"
              onClick={onCloseLedger}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6 pr-8">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Check History</h3>
                  <p className="text-xs text-slate-500">
                    A record of your checks and purchases
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onRefreshLedger}
                disabled={isLedgerLoading}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isLedgerLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Current Balance Summary Box */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Available Checks:</span>
                <div className="text-xl font-bold text-slate-900 mt-0.5">{available}</div>
              </div>
              <div>
                <span className="text-slate-500">Total Account Checks:</span>
                <div className="text-xl font-bold text-slate-900 mt-0.5">{balance}</div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-500">Free Welcome Allowance:</span>
                <div className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>3 Free Checks Included</span>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            {isLedgerLoading ? (
              <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                <span>Loading history...</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No checks or transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="py-2.5 px-3 font-semibold">Date</th>
                      <th className="py-2.5 px-3 font-semibold">Activity</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Change</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Balance</th>
                      <th className="py-2.5 px-3 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {transactions.map((tx) => {
                      const isCredit = tx.amount > 0;
                      let typeLabel = 'Activity';
                      let dotColor = 'bg-slate-400';

                      if (tx.type === 'initial_grant') {
                        typeLabel = 'Welcome Checks';
                        dotColor = 'bg-blue-600';
                      } else if (tx.type === 'purchase_credit') {
                        typeLabel = 'Purchase';
                        dotColor = 'bg-emerald-600';
                      } else if (tx.type === 'analysis_debit') {
                        typeLabel = 'Safety Check';
                        dotColor = 'bg-slate-500';
                      } else if (tx.type === 'refund_reversal') {
                        typeLabel = 'Refund';
                        dotColor = 'bg-amber-600';
                      }

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {new Date(tx.timestamp).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 text-xs">
                              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                              <span>{typeLabel}</span>
                            </span>
                          </td>
                          <td className={`py-2.5 px-3 text-right font-semibold ${isCredit ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {isCredit ? `+${tx.amount}` : `${tx.amount}`}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-900 font-medium">
                            {tx.balanceAfter}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[180px] truncate" title={tx.metadata?.orderId || tx.metadata?.analysisId || tx.reason}>
                            {tx.metadata?.orderId ? `Order #${tx.metadata.orderId.slice(0, 8)}` : tx.reason || 'Completed'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Your usage history is securely tracked.</span>
              <button
                type="button"
                onClick={onCloseLedger}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
