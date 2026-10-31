'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  History,
  Search,
  Trash2,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  Calendar,
} from 'lucide-react';

export interface HistoryItem {
  id: string;
  inputType: 'text' | 'url' | 'image';
  inputPreview: string;
  verdict: string;
  scamRisk: string;
  claimVerdict: string;
  confidenceScore: number;
  reasonsSummary: string;
  recommendedAction: string;
  createdAt: string;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAnalysis?: (analysisId: string) => void;
}

export function HistoryModal({ isOpen, onClose, onSelectAnalysis }: HistoryModalProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchHistory = useCallback(async (querySearch?: string) => {
    setLoading(true);
    try {
      const url = querySearch
        ? `/api/v1/history?search=${encodeURIComponent(querySearch)}`
        : '/api/v1/history';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data.analyses || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchHistory(search);
    }
  }, [isOpen, fetchHistory, search]);

  const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/history?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete all saved analyses? This cannot be undone.')) {
      return;
    }
    setClearing(true);
    try {
      const res = await fetch('/api/v1/history', { method: 'DELETE' });
      if (res.ok) {
        setItems([]);
      }
    } catch {
      // ignore
    } finally {
      setClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Your Verification History</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={clearing}
                className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium flex items-center gap-1 transition"
              >
                {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Clear All</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search past scans by text, URL, or verdict..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && items.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs">Loading verification history...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <History className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-sm font-semibold text-slate-600">No verification scans found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Any text, URL, or screenshot you analyze will be automatically saved here for quick reference.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isScam = item.scamRisk === 'high' || item.verdict === 'likely_scam';
              const isSuspicious = item.scamRisk === 'suspicious' || item.verdict === 'suspicious';
              const isSafe = item.scamRisk === 'none_detected' || item.verdict === 'no_obvious_risk_found';

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectAnalysis?.(item.id)}
                  className="group relative p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-md bg-slate-100 text-slate-600">
                        {item.inputType === 'url' ? (
                          <Globe className="w-3.5 h-3.5" />
                        ) : item.inputType === 'image' ? (
                          <ImageIcon className="w-3.5 h-3.5" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 capitalize">
                        {item.inputType} Scan
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 ${
                          isScam
                            ? 'bg-rose-100 text-rose-800'
                            : isSuspicious
                            ? 'bg-amber-100 text-amber-800'
                            : isSafe
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isScam ? (
                          <ShieldAlert className="w-3 h-3" />
                        ) : isSuspicious ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <ShieldCheck className="w-3 h-3" />
                        )}
                        <span>{item.verdict.replace(/_/g, ' ')}</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteItem(e, item.id)}
                        disabled={deletingId === item.id}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete scan"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="mt-2 text-xs font-medium text-slate-900 line-clamp-2">
                    &ldquo;{item.inputPreview}&rdquo;
                  </p>

                  {item.reasonsSummary && (
                    <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">
                      {item.reasonsSummary}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info adhering to Product Principle 5 */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Privacy by default: You can inspect or permanently delete your scan history at any time.</span>
        </div>
      </div>
    </div>
  );
}
