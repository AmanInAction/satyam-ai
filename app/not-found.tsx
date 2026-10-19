import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center bg-slate-50">
      <div className="max-w-md p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Page Not Found</h2>
        <p className="text-slate-600 text-sm mb-6">
          The requested page could not be found.
        </p>
        <Link
          href="/"
          className="inline-flex px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition shadow-sm"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
