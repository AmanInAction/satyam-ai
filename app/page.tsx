import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import AnalysisDashboard from '../components/AnalysisDashboard';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 font-sans max-w-5xl mx-auto w-full">
      {/* Header */}
      <header className="w-full flex items-center justify-between border-b border-slate-800 pb-5 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl text-slate-100 tracking-tight">SatyamAI</h1>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                Phase 2 MVP
              </span>
            </div>
            <p className="text-xs text-slate-400">Decision-Support Scam &amp; Misinformation Checker</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Dual Verdict Engine</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full flex-1">
        <AnalysisDashboard />
      </main>

      {/* Footer */}
      <footer className="w-full text-center text-xs text-slate-500 border-t border-slate-800/60 pt-6 mt-12 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>SatyamAI — Advisory decision support system. Does not store personal content.</span>
        <span>Helpline 1930 | cybercrime.gov.in</span>
      </footer>
    </div>
  );
}
