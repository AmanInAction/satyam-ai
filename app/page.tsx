import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Image as ImageIcon,
  Link as LinkIcon,
  MessageSquareText,
  Shield,
} from 'lucide-react';
import { CREDIT_COSTS, CREDIT_PACKAGES, FREE_INITIAL_CREDITS } from '@/src/lib/payments/config';

export default function Home() {
  const features = [
    { icon: MessageSquareText, title: 'Message checks', detail: 'Spot scam tactics and assess suspicious claims.', cost: `${CREDIT_COSTS.text} check` },
    { icon: LinkIcon, title: 'Link inspection', detail: 'Review suspicious URLs for phishing signals.', cost: `${CREDIT_COSTS.url} check` },
    { icon: ImageIcon, title: 'Screenshot analysis', detail: 'Extract and review text from suspicious screenshots.', cost: `${CREDIT_COSTS.image} checks` },
    { icon: Bot, title: 'Telegram bot', detail: 'Send a message or link to the bot for a quick safety check.', cost: `${CREDIT_COSTS.text} check` },
  ];

  return (
    <main className="min-h-screen">
      <header className="max-w-6xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-600 outline-none">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
            <Shield className="w-6 h-6" />
          </div>
          <div className="text-left">
            <h1 className="font-bold text-xl text-slate-900 tracking-tight">SatyamAI</h1>
            <p className="text-xs text-slate-600">Scam & misinformation checks</p>
          </div>
        </Link>
        <Link href="/analyze" className="text-sm font-semibold text-blue-700 hover:text-blue-800 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600 outline-none">
          Open checker
        </Link>
      </header>

      <section className="bg-linear-to-br from-blue-50 via-slate-50 to-white border-y border-blue-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24 grid lg:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-800">
              <Shield className="w-3.5 h-3.5" /> Built for everyday online safety
            </p>
            <h2 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight text-slate-950 max-w-xl">
              Pause before you trust that message.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600 max-w-2xl">
              Check suspicious messages, links, screenshots, and viral claims for scam signals and evidence before you act.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/analyze" className="inline-flex justify-center items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none">
                Check something now <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#plans" className="inline-flex justify-center items-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none">
                View check packs
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-500">New accounts receive {FREE_INITIAL_CREDITS} free checks. SatyamAI is advisory guidance, not a guarantee of safety.</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-lg shadow-blue-950/5">
            <p className="text-sm font-semibold text-slate-900">A safer next step, in seconds</p>
            <div className="mt-5 space-y-4">
              {['Paste the message or link, or upload a screenshot.', 'Review clear risk signals, evidence, and practical next steps.', 'If money was sent, call India’s Cyber Crime Helpline: 1930.'].map((step, index) => (
                <div className="flex gap-3" key={step}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{index + 1}</span>
                  <p className="text-sm leading-6 text-slate-600">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16" aria-labelledby="features-title">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-blue-700">What you can check</p>
          <h2 id="features-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-950">One place for the suspicious things people forward.</h2>
        </div>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, title, detail, cost }) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="w-fit rounded-xl bg-blue-50 border border-blue-100 p-2.5 text-blue-700"><Icon className="w-5 h-5" /></div>
              <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
              <p className="mt-4 text-xs font-semibold text-blue-700">{cost}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-blue-50 border-y border-blue-100" aria-labelledby="telegram-title">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 grid lg:grid-cols-[1fr_1fr] gap-10 items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-800">
              <Bot className="w-3.5 h-3.5" /> Check messages right in Telegram
            </p>
            <h2 id="telegram-title" className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
              A suspicious message? Send it to SatyamAI.
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Forward a message or paste a link in the bot chat to get a scam-risk and claim assessment with practical next steps.
            </p>
            <a
              href="https://t.me/satvii_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none"
            >
              Open SatyamAI on Telegram <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-6 sm:p-8">
            <h3 className="font-bold text-slate-900">How to use the bot</h3>
            <ol className="mt-5 space-y-4">
              {[
                <>Open the bot and tap <strong>Start</strong>, or send <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/start</code>.</>,
                <>Forward or paste a suspicious message, or send a website link.</>,
                <>Review the assessment and suggested next steps. Verify important decisions with official sources.</>,
              ].map((step, index) => (
                <li className="flex gap-3" key={index}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{index + 1}</span>
                  <p className="text-sm leading-6 text-slate-600">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Use <code>/help</code> for instructions and <code>/credits</code> to check your balance. Checks use credits. The bot can’t analyze images yet—paste the text or link shown in a screenshot instead. Results are advisory, not a guarantee of safety.
            </p>
          </div>
        </div>
      </section>

      <section id="plans" className="bg-slate-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <p className="text-sm font-semibold text-blue-300">Simple check packs</p>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h2 className="text-3xl font-bold tracking-tight">Keep checking when your free checks run out.</h2>
            <Link href="/analyze" className="text-sm font-semibold text-blue-300 hover:text-white">Buy in the checker <ArrowRight className="inline w-4 h-4" /></Link>
          </div>
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {CREDIT_PACKAGES.map((pkg) => (
              <div key={pkg.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
                <h3 className="font-bold">{pkg.name}</h3>
                <p className="mt-5 text-3xl font-bold">${pkg.price}<span className="text-sm font-medium text-slate-400"> {pkg.currency}</span></p>
                <p className="mt-2 text-sm text-slate-300">{pkg.credits} checks; checks never expire.</p>
                <div className="mt-5 flex items-center gap-2 text-xs text-slate-300"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Pay securely with PayPal</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row gap-2 justify-between text-xs text-slate-500">
        <span>SatyamAI provides advisory safety checks and does not store personal content.</span>
        <span>National Cyber Crime Helpline: 1930 | cybercrime.gov.in</span>
      </footer>
    </main>
  );
}
