import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md p-8 rounded-2xl bg-slate-900 border border-slate-800">
        <h2 className="text-2xl font-bold text-slate-100 mb-2">404 - Not Found</h2>
        <p className="text-slate-400 text-sm mb-6">
          The requested page could not be found.
        </p>
        <Link
          href="/"
          className="inline-flex px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
