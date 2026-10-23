'use client';

import React from 'react';
import {
  Coins,
  PlusCircle,
  Receipt,
  ShieldAlert,
  PhoneCall,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  History,
  User as UserIcon,
  ShieldCheck,
} from 'lucide-react';

interface CreditBarProps {
  balance: number;
  available: number;
  isLoading: boolean;
  onOpenTopUp: () => void;
  onOpenLedger: () => void;
  onOpenHistory?: () => void;
  onOpenAuth?: () => void;
  isAuthenticated?: boolean;
  user?: { email?: string; displayName?: string } | null;
}

export function CreditBar({
  balance,
  available,
  isLoading,
  onOpenTopUp,
  onOpenLedger,
  onOpenHistory,
  onOpenAuth,
  isAuthenticated,
  user,
}: CreditBarProps) {
  const isExhausted = available <= 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
      {/* Left side: Balance and allowance indicator */}
      <div className="flex items-center gap-3">
        <div
          className={`p-2.5 rounded-lg border ${
            isExhausted
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}
        >
          <Coins className="w-5 h-5" />
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-slate-600 font-medium">Checks available:</span>
            <span
              className={`text-sm font-bold ${
                isExhausted ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {isLoading ? '...' : available}
            </span>
            {balance !== available && (
              <span className="text-slate-500">
                ({balance - available} pending)
              </span>
            )}
            {isAuthenticated && user && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <ShieldCheck className="w-3 h-3" />
                {user.displayName || user.email?.split('@')[0]}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isExhausted
              ? 'You have used your free checks. Get more checks below to continue checking messages.'
              : '3 free checks included for new users · 1 check per message or link · 2 per screenshot'}
          </p>
        </div>
      </div>

      {/* Right side: Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Scan history</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenLedger}
          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none"
        >
          <Receipt className="w-3.5 h-3.5 text-slate-500" />
          <span>Receipts</span>
        </button>

        {onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none"
          >
            <UserIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>{isAuthenticated ? 'Account' : 'Sign in'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenTopUp}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none ${
            isExhausted
              ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Get more checks</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Essential safety guidance card displayed when checks are exhausted,
 * guaranteeing the user always has access to vital scam prevention rules.
 */
export function EssentialSafetyGuidanceCard({ onOpenTopUp }: { onOpenTopUp: () => void }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 shrink-0">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-900">
              Checks Exhausted — Essential Safety Rules
            </h3>
            <span className="text-xs font-semibold text-amber-800">
              Always available
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Even with 0 checks remaining, keep these essential safety rules in mind before acting on any message:
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
        <div className="p-3.5 rounded-xl bg-white border border-amber-200/80 text-slate-700 space-y-1">
          <div className="font-semibold text-rose-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Never Share OTPs or Enter UPI PINs to Receive Money</span>
          </div>
          <p className="text-xs text-slate-600">
            A UPI PIN is only required to send money. You NEVER need to enter a PIN or scan a QR code to receive money, cashback, or refunds.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-amber-200/80 text-slate-700 space-y-1">
          <div className="font-semibold text-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Electricity Disconnection Threats Are Scams</span>
          </div>
          <p className="text-xs text-slate-600">
            Power utilities never send personal SMS threats warning of disconnection tonight with an unofficial mobile number or link.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-amber-200/80 text-slate-700 space-y-1">
          <div className="font-semibold text-blue-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>There Is No &quot;Digital Arrest&quot; Under Indian Law</span>
          </div>
          <p className="text-xs text-slate-600">
            Police, CBI, ED, and customs officials never arrest people over video calls or demand security deposits to clear cases.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-amber-200/80 text-slate-700 space-y-1">
          <div className="font-semibold text-emerald-700 flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5 shrink-0" />
            <span>National Cyber Crime Helpline: 1930</span>
          </div>
          <p className="text-xs text-slate-600">
            If you transferred funds to a suspected fraudster, immediately call <strong>1930</strong> to freeze transfers, or report at <strong>cybercrime.gov.in</strong>.
          </p>
        </div>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-amber-200">
        <a
          href="https://cybercrime.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-700 hover:text-blue-800 flex items-center gap-1 font-medium focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none rounded"
        >
          <span>Official National Cyber Crime Reporting Portal</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        <button
          type="button"
          onClick={onOpenTopUp}
          className="w-full sm:w-auto px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none"
        >
          <span>Get more checks</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
