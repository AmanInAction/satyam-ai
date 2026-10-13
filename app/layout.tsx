import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Satyam AI - Scam & Misinformation Checker',
  description:
    'Decision-support web application to evaluate suspicious messages, claims, and URLs with transparent evidence and risk breakdown.',
  openGraph: {
    title: 'Satyam AI - Scam & Misinformation Checker',
    description:
      'Decision-support web application to evaluate suspicious messages, claims, and URLs with transparent evidence and risk breakdown.',
    type: 'website',
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
