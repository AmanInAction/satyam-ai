import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  Link as LinkIcon,
  MessageSquareText,
  PhoneCall,
  Send,
} from 'lucide-react';
import { CREDIT_COSTS, CREDIT_PACKAGES, FREE_INITIAL_CREDITS } from '@/src/lib/payments/config';

export default function Home() {
  const features = [
    { icon: MessageSquareText, title: 'Messages & claims', detail: 'Look for pressure tactics, suspicious requests, and claims that need checking.', cost: `${CREDIT_COSTS.text} check` },
    { icon: LinkIcon, title: 'Website links', detail: 'Inspect a URL for common signs of phishing and misleading websites.', cost: `${CREDIT_COSTS.url} check` },
    { icon: ImageIcon, title: 'Screenshots', detail: 'Review text in a screenshot without retyping the whole message.', cost: `${CREDIT_COSTS.image} checks` },
    { icon: Send, title: 'Telegram', detail: 'Forward a message or paste a link in the SatyamAI Telegram bot.', cost: `${CREDIT_COSTS.text} check` },
  ];

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#20251f]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-800">
          <Image src="/satyam.jpeg" alt="SatyamAI shield" width={48} height={48} className="h-11 w-11 rounded-full object-cover" priority />
          <span>
            <span className="block text-lg font-bold tracking-tight">SatyamAI</span>
            <span className="block text-[11px] text-[#667066]">A clearer second look</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[#596158] md:flex" aria-label="Main navigation">
          <a href="#how-it-works" className="transition hover:text-[#203c30]">How it works</a>
          <a href="#what-to-check" className="transition hover:text-[#203c30]">What to check</a>
          <a href="#plans" className="transition hover:text-[#203c30]">Check packs</a>
        </nav>
        <Link href="/analyze" className="inline-flex items-center gap-2 rounded-full bg-[#244a38] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#193b2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#244a38]">
          Open checker <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="border-y border-[#e5e6de] bg-[#eeefe8]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#52715d]">Take a moment. Check before you act.</p>
            <h1 className="mt-5 font-serif text-5xl leading-[1.08] tracking-tight text-[#202a22] sm:text-6xl">
              Not sure about that message?
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#596158] sm:text-lg">
              Get a straightforward review of suspicious messages, links, screenshots, and viral claims—with signals to look for and sensible next steps.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/analyze" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#244a38] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#193b2b]">
                Check a message or link <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how-it-works" className="inline-flex items-center justify-center rounded-full border border-[#cfd4ca] bg-[#f7f6f2] px-6 py-3.5 text-sm font-semibold text-[#354139] transition hover:bg-white">
                How it works
              </a>
            </div>
            <p className="mt-5 text-xs leading-5 text-[#6b746c]">
              {FREE_INITIAL_CREDITS} free checks for new accounts. Advice is not a guarantee of safety.
            </p>
          </div>

          <div className="relative mx-auto flex min-h-[310px] w-full max-w-[500px] items-center justify-center overflow-hidden rounded-[2rem] border border-[#dde1d7] bg-[#f8f8f4] p-8 sm:min-h-[390px]">
            <div className="absolute left-8 top-8 h-24 w-24 rounded-full bg-[#e8ede5]" />
            <div className="absolute bottom-8 right-7 h-36 w-36 rounded-full bg-[#e8ede5]" />
            <Image
              src="/satyam.jpeg"
              alt="SatyamAI shield emblem"
              width={360}
              height={360}
              className="relative h-56 w-56 rounded-full object-cover sm:h-72 sm:w-72"
              priority
            />
            <div className="absolute bottom-5 left-5 flex items-center gap-3 rounded-2xl border border-[#e5e6de] bg-white px-4 py-3 shadow-sm sm:bottom-7 sm:left-7">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#edf3ec] text-[#365a43]">
                <PhoneCall className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-[10px] font-medium uppercase tracking-wide text-[#727a70]">India cyber helpline</span>
                <span className="block text-sm font-bold text-[#28352b]">1930</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-8 border-b border-[#e2e4dc] pb-10 sm:grid-cols-[0.8fr_1.2fr] sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#52715d]">A useful first step</p>
            <h2 className="mt-3 max-w-md font-serif text-3xl leading-tight tracking-tight sm:text-4xl">Look closer, then decide for yourself.</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#636b62] sm:justify-self-end">
            SatyamAI helps you review potential warning signs. It explains what stands out, points to available evidence, and suggests what you can do next.
          </p>
        </div>
        <div className="grid gap-0 sm:grid-cols-3">
          {[
            ['01', 'Share what you received', 'Paste a message or link, or upload a screenshot.'],
            ['02', 'Review the signals', 'See the risk assessment, evidence, and key details.'],
            ['03', 'Choose a safe next step', 'Verify with official sources. Never share an OTP or UPI PIN.'],
          ].map(([number, title, detail]) => (
            <article key={number} className="border-b border-[#e2e4dc] py-6 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0">
              <span className="text-xs font-semibold tracking-widest text-[#7c897b]">{number}</span>
              <h3 className="mt-3 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#687067]">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="what-to-check" className="border-y border-[#e5e6de] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#52715d]">What you can check</p>
            <h2 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">Everyday messages deserve a second look.</h2>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, detail, cost }) => (
              <article key={title} className="rounded-2xl border border-[#e6e8e1] bg-[#fbfbf8] p-5 transition hover:border-[#cbd6ca]">
                <Icon className="h-5 w-5 text-[#42684e]" strokeWidth={1.7} />
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 min-h-[72px] text-sm leading-6 text-[#687067]">{detail}</p>
                <p className="mt-4 text-xs font-medium text-[#55705a]">{cost}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-col justify-between gap-5 rounded-2xl bg-[#eff1eb] p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#52715d]">Prefer Telegram?</p>
              <h3 className="mt-2 text-lg font-semibold">Forward a message to SatyamAI.</h3>
              <p className="mt-1 text-sm text-[#687067]">Paste a link or forward text to get a quick review.</p>
            </div>
            <a href="https://t.me/satvii_bot" target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#cbd4c8] bg-white px-5 py-3 text-sm font-semibold text-[#294a36] transition hover:bg-[#f8faf6]">
              Open Telegram <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section id="plans" className="bg-[#26382d] text-white">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#bdcbbd]">Simple check packs</p>
              <h2 className="mt-3 max-w-xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">More checks, whenever you need them.</h2>
            </div>
            <Link href="/analyze" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d3dfd1] transition hover:text-white">
              Buy in the checker <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {CREDIT_PACKAGES.map((pkg) => (
              <article key={pkg.id} className="rounded-2xl border border-white/15 bg-white/[0.06] p-6">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-semibold">{pkg.name}</h3>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#b8cdb8]" />
                </div>
                <p className="mt-5 text-3xl font-semibold">${pkg.price}<span className="text-sm font-normal text-[#c2ccc3]"> USD</span></p>
                <p className="mt-1 text-sm text-[#c2ccc3]">or ₹{pkg.prices.INR} INR</p>
                <p className="mt-4 text-sm text-[#e2e8e0]">{pkg.credits} checks · never expire</p>
                <p className="mt-4 border-t border-white/15 pt-4 text-xs text-[#c2ccc3]">Pay securely with PayPal</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-7 text-xs leading-5 text-[#70786f] sm:flex-row sm:justify-between sm:px-8">
        <span>SatyamAI provides advisory safety checks and does not store personal content.</span>
        <span>National Cyber Crime Helpline: 1930 · cybercrime.gov.in</span>
      </footer>
    </main>
  );
}
