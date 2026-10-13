import React from 'react';
import { ShieldAlert, CheckCircle2, FileText, Cpu, Clock, Layers } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-between p-6 sm:p-10 font-sans">
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-slate-100 tracking-tight">Satyam AI</h1>
            <p className="text-xs text-slate-400">Scam &amp; Misinformation Checker</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Next.js App Router Active
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full my-auto py-12">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 sm:p-10 backdrop-blur-sm shadow-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium mb-4">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Full-Stack Next.js Baseline Established
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 mb-3">
            Full-Stack Next.js Architecture Verified
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-8 max-w-2xl">
            Successfully migrated from React/Vite/Express to a unified full-stack Next.js App Router architecture. Backend API Route Handlers under <span className="text-slate-300 font-mono text-xs px-1.5 py-0.5 rounded bg-slate-800">/api/v1/*</span>, Zod runtime schemas, server-only provider adapters, and Vitest test suites are configured.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border-t border-slate-800/80 pt-6">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
              <Layers className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-300">App Router</p>
                <p className="text-xs text-slate-500 mt-0.5">SSR &amp; Route Handlers</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
              <FileText className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-300">API Contract</p>
                <p className="text-xs text-slate-500 mt-0.5">/api/v1/health &amp; /analyze</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
              <Cpu className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-300">Validation</p>
                <p className="text-xs text-slate-500 mt-0.5">Zod runtime models</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
              <Clock className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-300">Standing By</p>
                <p className="text-xs text-slate-500 mt-0.5">Ready for Phase 1</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-slate-500 border-t border-slate-800/60 pt-6">
        Satyam AI — Decision support system for scam and misinformation detection
      </footer>
    </div>
  );
}
