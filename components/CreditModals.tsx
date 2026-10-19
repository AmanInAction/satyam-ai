'use client';

import React from 'react';
import {
  X,
  CreditCard,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Shield,
  Lock,
  ArrowUpRight,
  HelpCircle,
  Clock,
  Check,
} from 'lucide-react';
import { CreditPackage, CreditTransaction } from '@/src/lib/payments/types';

interface CreditModalsProps {
  isTopUpOpen: boolean;
  isLedgerOpen: boolean;
  onCloseTopUp: () => void;
  onCloseLedger: () => void;
  balance: number;
  available: number;
  packages: CreditPackage[];
  onPurchase: (packageId: string) => Promise<void>;
  isPurchasing: string | null;
  purchaseSuccess: string | null;
  purchaseError: string | null;
  transactions: CreditTransaction[];
  isLedgerLoading: boolean;
  onRefreshLedger: () => void;
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
}: CreditModalsProps) {
  if (!isTopUpOpen && !isLedgerOpen) return null;

  return (
    <>
      {/* 1. Top Up / PayPal Sandbox Modal */}
      {isTopUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 sm:p-8 overflow-y-auto max-h-[90vh]">
            {/* Close Button */}
            <button
              type="button"
              onClick={onCloseTopUp}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-100">Top Up Verification Credits</h3>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    PayPal Sandbox
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Current Balance: <span className="font-semibold text-slate-200">{available} Credits</span> available ({balance} total)
                </p>
              </div>
            </div>

            {/* Sandbox Notice Banner */}
            <div className="mb-6 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-blue-200">PayPal Developer Sandbox Active:</span> All transactions are processed in a safe sandbox simulation environment. No real funds or real credit cards are charged.
              </div>
            </div>

            {/* Feedback Messages */}
            {purchaseSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="font-medium">{purchaseSuccess}</div>
              </div>
            )}

            {purchaseError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div className="font-medium">{purchaseError}</div>
              </div>
            )}

            {/* Package Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {packages.map((pkg) => {
                const isSelected = isPurchasing === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className={`relative rounded-xl border p-5 flex flex-col justify-between transition ${
                      pkg.popular
                        ? 'border-blue-500/50 bg-blue-950/20 ring-1 ring-blue-500/30'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                    }`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-blue-600 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                        Best Value
                      </span>
                    )}

                    <div>
                      <h4 className="font-bold text-slate-200 text-sm">{pkg.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-1">{pkg.description}</p>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold text-white">${pkg.price}</span>
                        <span className="text-xs text-slate-400 font-mono">USD</span>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-emerald-400">
                        +{pkg.credits} Credits ({Math.round((parseFloat(pkg.price) / pkg.credits) * 100)}¢/check)
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={Boolean(isPurchasing)}
                      onClick={() => onPurchase(pkg.id)}
                      className={`mt-5 w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 ${
                        pkg.popular
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold">PayPal</span>
                          <span>Checkout</span>
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Explanatory Costs Footer */}
            <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
              <div className="flex items-center gap-4">
                <span>Text Check: <strong className="text-slate-300">1 Credit</strong></span>
                <span>URL Check: <strong className="text-slate-300">1 Credit</strong></span>
                <span>Screenshot OCR: <strong className="text-slate-300">2 Credits</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Idempotent Server Ledger</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Transaction Ledger Modal */}
      {isLedgerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 sm:p-8 overflow-y-auto max-h-[90vh]">
            {/* Close Button */}
            <button
              type="button"
              onClick={onCloseLedger}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6 pr-8">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Credit Ledger &amp; Purchase History</h3>
                  <p className="text-xs text-slate-400">
                    Transparent, auditable server-side transaction journal
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onRefreshLedger}
                disabled={isLedgerLoading}
                className="px-3 py-1.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isLedgerLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Current Balance Summary Box */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400">Available Credits:</span>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">{available}</div>
              </div>
              <div>
                <span className="text-slate-400">Total Booked Balance:</span>
                <div className="text-xl font-bold text-slate-200 mt-0.5">{balance}</div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-400">Freemium Grant:</span>
                <div className="text-xs font-semibold text-blue-400 mt-1 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>3 Free Credits Granted</span>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            {isLedgerLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-400/20 border-t-slate-400 rounded-full animate-spin" />
                <span>Loading transaction journal...</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                      <th className="py-2.5 px-3 font-semibold">Date &amp; Time</th>
                      <th className="py-2.5 px-3 font-semibold">Transaction Type</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Change</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Balance</th>
                      <th className="py-2.5 px-3 font-semibold">Reference</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {transactions.map((tx) => {
                      const isCredit = tx.amount > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                            {new Date(tx.timestamp).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                tx.type === 'initial_grant'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : tx.type === 'purchase_credit'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : tx.type === 'analysis_debit'
                                  ? 'bg-slate-800 text-slate-300'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {tx.type.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${isCredit ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {isCredit ? `+${tx.amount}` : `${tx.amount}`}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-200">
                            {tx.balanceAfter}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 max-w-[140px] truncate" title={tx.metadata?.orderId || tx.metadata?.analysisId || tx.reason}>
                            {tx.metadata?.orderId || tx.metadata?.analysisId || tx.reason}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400">
                              Booked
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>All ledger mutations are cryptographically validated &amp; idempotent.</span>
              <button
                type="button"
                onClick={onCloseLedger}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
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
