import Link from 'next/link';
import Image from 'next/image';
import { PhoneCall } from 'lucide-react';
import AnalysisDashboard from '../../components/AnalysisDashboard';

export default function AnalyzePage() {
  return (
    <div className="min-h-screen bg-[#f7f6f2] px-4 py-4 font-sans text-[#20251f] sm:px-8 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col sm:min-h-[calc(100vh-3rem)]">
      <header className="mb-8 flex w-full items-center justify-between border-b border-[#e2e4dc] pb-4">
        <Link href="/" className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#244a38]">
          <Image src="/satyam.jpeg" alt="SatyamAI shield" width={48} height={48} className="h-10 w-10 rounded-full object-cover" />
          <span>
            <span className="block text-lg font-bold tracking-tight">SatyamAI</span>
            <span className="block text-[11px] text-[#667066]">A clearer second look</span>
          </span>
        </Link>

        <div className="hidden items-center gap-2 text-xs font-medium text-[#667066] sm:flex">
          <PhoneCall className="h-3.5 w-3.5 text-[#52715d]" />
          <span>India Cyber Helpline: <strong className="font-semibold text-[#28352b]">1930</strong></span>
        </div>
      </header>

      <main className="w-full flex-1">
        <AnalysisDashboard />
      </main>

      <footer className="mt-12 flex w-full flex-col items-center justify-between gap-2 border-t border-[#e2e4dc] pt-6 text-center text-xs text-[#70786f] sm:flex-row">
        <span>SatyamAI provides advisory safety checks and does not store personal content.</span>
        <span>National Cyber Crime Helpline: 1930 | cybercrime.gov.in</span>
      </footer>
      </div>
    </div>
  );
}
