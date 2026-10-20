import Link from 'next/link';
import { Shield, PhoneCall } from 'lucide-react';
import AnalysisDashboard from '../../components/AnalysisDashboard';

export default function AnalyzePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 font-sans max-w-5xl mx-auto w-full">
      <header className="w-full flex items-center justify-between border-b border-slate-200 pb-5 mb-8">
        <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-600 outline-none">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl text-slate-900 tracking-tight">SatyamAI</h1>
            <p className="text-xs text-slate-600">Check suspicious messages, links, and screenshots</p>
          </div>
        </Link>

        <div className="hidden sm:flex items-center gap-2 text-slate-600 text-xs font-medium">
          <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
          <span>India Cyber Helpline: <strong className="text-slate-900 font-semibold">1930</strong></span>
        </div>
      </header>

      <main className="w-full flex-1">
        <AnalysisDashboard />
      </main>

      <footer className="w-full text-center text-xs text-slate-500 border-t border-slate-200 pt-6 mt-12 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>SatyamAI provides advisory safety checks and does not store personal content.</span>
        <span>National Cyber Crime Helpline: 1930 | cybercrime.gov.in</span>
      </footer>
    </div>
  );
}
