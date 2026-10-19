'use client';

import React from 'react';
import {
  Coins,
  PlusCircle,
  Receipt,
  ShieldAlert,
  PhoneCall,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface CreditBarProps {
  balance: number;
  available: number;
  isLoading: boolean;
  onOpenTopUp: () => void;
  onOpenLedger: () => void;
}

export function CreditBar({
  balance,
  available,
  isLoading,
  onOpenTopUp,
  onOpenLedger,
}: CreditBarProps) {
  const isExhausted = available <= 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
      {/* Left side: Balance and Freemium indicator */}
      <div className="flex items-center gap-3">
        <div
          className={`p-2.5 rounded-xl border ${
            isExhausted
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}
        >
          <Coins className="w-5 h-5" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Verification Credits:</span>
            <span
              className={`text-sm font-extrabold ${
                isExhausted ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {isLoading ? '...' : `${available} Available`}
            </span>
            {balance !== available && (
              <span className="text-[11px] text-slate-500 font-mono">
                ({balance - available} reserved)
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            {isExhausted
              ? 'Credits exhausted. Top up via PayPal Sandbox to continue.'
              : 'Every new user gets 3 free credits. 1 credit/text, 1 credit/URL, 2 credits/screenshot.'}
          </p>
        </div>
      </div>

      {/* Right side: Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenLedger}
          className="px-3 py-1.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
        >
          <Receipt className="w-3.5 h-3.5 text-purple-400" />
          <span>Ledger History</span>
        </button>

        <button
          type="button"
          onClick={onOpenTopUp}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm ${
            isExhausted
              ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Top Up Credits</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/20 uppercase font-mono">
            PayPal
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * Essential safety guidance card displayed when credits are exhausted,
 * guaranteeing the user never loses access to vital scam prevention rules.
 */
export function EssentialSafetyGuidanceCard({ onOpenTopUp }: { onOpenTopUp: () => void }) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 sm:p-6 backdrop-blur-sm shadow-xl space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-bold text-amber-200">
              Credits Exhausted — Essential Scam Safety Guidance
            </h3>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
              Active Protection
            </span>
          </div>
          <p className="text-xs text-amber-300/80 mt-1">
            Even with 0 credits remaining, SatyamAI ensures you stay protected. Review these essential Indian cybercrime defense rules before acting on any suspicious message:
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 space-y-1">
          <div className="font-semibold text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Never Share OTPs or UPI PINs</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Entering a UPI PIN always deducts money from your account. You NEVER need to enter a PIN or scan a QR code to receive cashback or refunds.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 space-y-1">
          <div className="font-semibold text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Beware Electricity Cut-Off Threats</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Power utilities never send personal SMS messages threatening disconnection tonight with a mobile callback number or asking to install an APK.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 space-y-1">
          <div className="font-semibold text-blue-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>No "Digital Arrest" Under Indian Law</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Police, CBI, ED, and customs officials never place citizens under arrest via Skype or WhatsApp video calls or demand financial security deposits.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 space-y-1">
          <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5" />
            <span>National Cyber Crime Helpline: 1930</span>
          </div>
          <p className="text-[11px] text-slate-400">
            If you transferred funds to a fraudulent party, immediately dial <strong>1930</strong> within the golden hour to freeze bank transfers, or report at <strong>cybercrime.gov.in</strong>.
          </p>
        </div>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-amber-500/20">
        <a
          href="https://cybercrime.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5 underline"
        >
          <span>Visit Official National Cyber Crime Reporting Portal</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        <button
          type="button"
          onClick={onOpenTopUp}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
        >
          <Sparkles className="w-4 h-4" />
          <span>Top Up Credits with PayPal Sandbox</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
