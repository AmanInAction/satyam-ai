'use client';

import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  ArrowRight,
  LogOut,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Loader2,
  Link2,
} from 'lucide-react';

export interface UserProfile {
  id: string;
  email?: string;
  displayName?: string;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  user: UserProfile | null;
  balance: number;
  available: number;
  onAuthSuccess: (user: UserProfile, balance: number, available: number) => void;
  onLogoutSuccess: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  isAuthenticated,
  user,
  balance,
  available,
  onAuthSuccess,
  onLogoutSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [telegramCodeLoading, setTelegramCodeLoading] = useState(false);
  const [telegramCodeError, setTelegramCodeError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = mode === 'signup' ? '/api/v1/auth/register' : '/api/v1/auth/login';
    const payload: any = { email, password };
    if (mode === 'signup' && displayName.trim()) {
      payload.displayName = displayName.trim();
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || 'Authentication failed');
      }

      onAuthSuccess(data.user, data.balance, data.available);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      onLogoutSuccess();
      onClose();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTelegramCode = async () => {
    setTelegramCodeLoading(true);
    setTelegramCodeError(null);
    setTelegramCode(null);
    try {
      const res = await fetch('/api/v1/telegram/link-code', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Unable to create a Telegram link code.');
      }
      setTelegramCode(data.code);
    } catch (err: unknown) {
      setTelegramCodeError((err as Error).message);
    } finally {
      setTelegramCodeLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {isAuthenticated && user ? (
          /* Profile & Logout View */
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                {(user.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {user.displayName || 'Account Profile'}
                </h3>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Account ID</span>
                <span className="font-mono text-slate-700 text-[11px]">{user.id}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Available Checks</span>
                <span className="font-bold text-slate-900">{available} remaining</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Account Status</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Active & Synced
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Your checks, scans, and transaction records are persistently saved to your SQLite database account.
            </p>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Link2 className="h-4 w-4 text-blue-700" />
                Sync Telegram checks
              </div>
              <p className="text-xs text-slate-600">
                Generate a one-time code, then send <code>/link CODE</code> to the SatyamAI bot in a private chat.
                Codes expire after 10 minutes.
              </p>
              {telegramCode && (
                <div className="rounded-lg border border-blue-200 bg-white p-2 text-center">
                  <code className="break-all text-xs font-semibold text-blue-800">{telegramCode}</code>
                </div>
              )}
              {telegramCodeError && (
                <p className="text-xs text-rose-700">{telegramCodeError}</p>
              )}
              <button
                type="button"
                onClick={handleGenerateTelegramCode}
                disabled={telegramCodeLoading}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {telegramCodeLoading ? 'Generating code...' : 'Generate Telegram link code'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
              className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold text-xs flex items-center justify-center gap-2 transition"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              <span>Sign out</span>
            </button>
          </div>
        ) : (
          /* Sign In / Sign Up Form */
          <div>
            <div className="mb-5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>SQLite Persistent Account</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {mode === 'signin' ? 'Sign in to SatyamAI' : 'Create an Account'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {mode === 'signin'
                  ? 'Access your saved scan history, checks balance, and receipt records.'
                  : 'Your current guest checks and past scans will automatically merge into your new account.'}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Display Name (Optional)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-xs"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                }}
                className="text-blue-600 font-semibold hover:underline"
              >
                {mode === 'signin' ? 'Create an account' : 'Sign In'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
