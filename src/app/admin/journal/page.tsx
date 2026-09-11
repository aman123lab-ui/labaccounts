// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useRealtimeMultiSync } from '@/hooks/useRealtimeSync';
import ConfirmModal from '@/components/ConfirmModal';
import EditJournalEntryModal from '@/components/EditJournalEntryModal';
import NewJournalEntryModal from '@/components/NewJournalEntryModal';
import {
  getJournalEntries,
  voidJournalEntry,
  deleteJournalEntry,
  DetailedJournalEntry,
} from '@/services/journalService';

import { getFinancialYears } from '@/services/financialYearService';
import { FinancialYear } from '@/types/database.types';
import { formatDate } from '@/utils/formatDate';
import CustomDateInput from '@/components/CustomDateInput';

export default function JournalEntryPage() {
  const [entries, setEntries] = useState<DetailedJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVoided, setShowVoided] = useState(false);

  // Financial Years State
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<string>('');

  // New Journal Voucher Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Expand Row State
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Edit, Void & Delete State
  const [editingEntry, setEditingEntry] = useState<DetailedJournalEntry | null>(null);
  const [voidingEntry, setVoidingEntry] = useState<DetailedJournalEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<DetailedJournalEntry | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);


  const voidedCount = entries.filter((e) => !!e.voided_at).length;
  const displayedEntries = entries.filter((e) => {
    const matchesVoided = showVoided || !e.voided_at;
    const term = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !term ||
      e.description.toLowerCase().includes(term) ||
      e.lines.some(
        (l) =>
          l.account_name.toLowerCase().includes(term) ||
          (l.student_name && l.student_name.toLowerCase().includes(term))
      );
    return matchesVoided && matchesSearch;
  });

  const loadFYs = async () => {
    const list = await getFinancialYears();
    setFinancialYears(list);
    const active = list.find((f) => f.is_current);
    if (active && !selectedFyId) {
      setSelectedFyId(active.id);
    }
  };

  const loadJournal = async () => {
    setLoading(true);
    const list = await getJournalEntries({
      financialYearId: selectedFyId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    setEntries(list);
    setLoading(false);
  };

  useEffect(() => {
    loadFYs();
  }, []);

  useEffect(() => {
    loadJournal();
  }, [selectedFyId, startDate, endDate]);

  useRealtimeMultiSync({
    channelName: 'admin-journal-sync',
    tables: ['journal_entries', 'journal_entry_lines', 'students', 'accounts'],
    onDataChange: () => {
      loadJournal();
    },
  });

  const handleClearFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    const active = financialYears.find((f) => f.is_current);
    if (active) setSelectedFyId(active.id);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const handleExecuteVoid = async () => {
    if (!voidingEntry) return;
    setVoidLoading(true);

    const res = await voidJournalEntry(voidingEntry.id, 'Admin');

    if (res.success) {
      showToast('Journal entry voided successfully. Audit log written.', 'success');
      setVoidingEntry(null);
      loadJournal();
    } else {
      showToast(res.error || 'Failed to void journal entry.', 'error');
    }
    setVoidLoading(false);
  };

  const handleExecuteDelete = async () => {
    if (!deletingEntry) return;
    setDeleteLoading(true);

    const res = await deleteJournalEntry(deletingEntry.id, 'Admin');

    if (res.success) {
      showToast('Journal entry permanently deleted from database.', 'success');
      setDeletingEntry(null);
      loadJournal();
    } else {
      showToast(res.error || 'Failed to permanently delete journal entry.', 'error');
    }
    setDeleteLoading(false);
  };


  const toggleExpand = (entryId: string) => {
    setExpandedEntryId((prev) => (prev === entryId ? null : entryId));
  };

  return (
    <>
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 space-y-6 flex-1">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Journal Entries Log</h1>
            <p className="text-xs text-slate-500 mt-1">
              Chronological double-entry posting ledger with full line inspection, date/student filters, and auditable edits/voids.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* + New Journal Entry Button (Primary action on top for mobile, middle on desktop) */}
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="w-full sm:w-auto order-1 sm:order-2 h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span className="text-base font-normal leading-none">+</span>
              <span>New Journal Entry</span>
            </button>

            {/* Show / Hide Voided Entries Toggle Button */}
            <button
              type="button"
              onClick={() => setShowVoided((prev) => !prev)}
              className={`flex-1 sm:flex-initial order-2 sm:order-1 h-9 sm:h-10 font-bold text-xs px-3 sm:px-4 rounded-xl border transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                showVoided
                  ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span>{showVoided ? 'Hide Voided' : `Show Voided (${voidedCount})`}</span>
            </button>

            {/* Total Entries Badge */}
            <div className="order-3 h-9 sm:h-10 text-xs font-mono bg-white border border-slate-200 px-3 sm:px-4 rounded-xl text-slate-600 flex items-center justify-center whitespace-nowrap shrink-0 shadow-xs">
              <span>
                Total: <strong className="text-slate-900">{displayedEntries.length}</strong>
              </span>
              {voidedCount > 0 && !showVoided && (
                <span className="text-slate-400 text-[10px] ml-1 font-normal">({voidedCount} v)</span>
              )}
            </div>
          </div>
        </div>

        {toast && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold shadow-xs flex items-center justify-between border ${
              toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} className="text-xs opacity-70 hover:opacity-100 ml-4">
              ✕
            </button>
          </div>
        )}

        {/* COMBINED FILTERS BAR WITH AND LOGIC */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Search & Filter Controls
            </span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-slate-500 hover:text-slate-900 font-semibold transition-colors"
            >
              Clear Filters
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Filter 1: Financial Year */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Financial Year</label>
              <select
                value={selectedFyId}
                onChange={(e) => setSelectedFyId(e.target.value)}
                className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono transition-all"
              >
                {financialYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.name || fy.year_label} {fy.is_current ? '(Active)' : '(Closed)'}
                  </option>
                ))}
                <option value="ALL">All Financial Years (Historical)</option>
              </select>
            </div>

            {/* Filter 2: Search Description / Narration */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Search Narration / Key</label>
              <input
                type="text"
                placeholder="Search description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Filter 3: From Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</label>
              <CustomDateInput
                value={startDate}
                onChange={(val) => setStartDate(val)}
                className="w-full h-10 py-2"
              />
            </div>

            {/* Filter 4: To Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</label>
              <CustomDateInput
                value={endDate}
                onChange={(val) => setEndDate(val)}
                className="w-full h-10 py-2"
              />
            </div>
          </div>
        </div>

        {/* JOURNAL ENTRIES TABLE */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
              Loading journal entry postings...
            </div>
          ) : displayedEntries.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <div className="text-sm font-semibold text-slate-700">No journal entries found</div>
              <p className="text-xs text-slate-500">
                {voidedCount > 0 && !showVoided
                  ? `There are ${voidedCount} voided entry/entries hidden. Click "Show Voided Entries" above to view.`
                  : 'Try adjusting or clearing your date, student, or account filters.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-mono uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Accounts Touched</th>
                    <th className="p-4 text-right">Debit (₹)</th>
                    <th className="p-4 text-right">Credit (₹)</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {displayedEntries.map((entry) => {
                    const isVoided = !!entry.voided_at;
                    const isExpanded = expandedEntryId === entry.id;

                    const totalDr = entry.lines.reduce((sum, l) => sum + l.debit_amount, 0);
                    const totalCr = entry.lines.reduce((sum, l) => sum + l.credit_amount, 0);

                    return (
                      <React.Fragment key={entry.id}>
                        <tr
                          className={`transition-colors cursor-pointer ${
                            isVoided
                              ? 'bg-red-50/40 text-slate-400 hover:bg-red-50/60'
                              : 'hover:bg-slate-50 text-slate-900'
                          }`}
                          onClick={() => toggleExpand(entry.id)}
                        >
                          {/* Column 1: Date */}
                          <td className="p-4 whitespace-nowrap text-slate-500">
                            {formatDate(entry.date)}
                          </td>

                          {/* Column 2: Description */}
                          <td className="p-4 font-sans font-semibold">
                            <div className="flex items-center gap-2">
                              <span>{entry.description}</span>
                              {isVoided && (
                                <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 text-[9px] font-bold font-mono uppercase">
                                  VOIDED
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Column 3: Accounts Touched Summary */}
                          <td className="p-4 font-sans text-slate-700">
                            <div className="space-y-0.5">
                              {entry.lines.slice(0, 2).map((l) => (
                                <div key={l.id} className="text-[11px] truncate max-w-xs">
                                  • {l.account_name} {l.student_name ? `(${l.student_name})` : ''}
                                </div>
                              ))}
                              {entry.lines.length > 2 && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  + {entry.lines.length - 2} more lines
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Column 4: Total Debit */}
                          <td className="p-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                            ₹{totalDr.toFixed(2)}
                          </td>

                          {/* Column 5: Total Credit */}
                          <td className="p-4 text-right font-bold text-blue-700 whitespace-nowrap">
                            ₹{totalCr.toFixed(2)}
                          </td>

                          {/* Column 6: Action Buttons */}
                          <td className="p-4 text-center min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5 font-sans">
                              {!isVoided && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEntry(entry)}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-semibold transition-colors"
                                    title="Edit Journal Entry"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setVoidingEntry(entry)}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold transition-colors"
                                    title="Void Entry (Soft Delete)"
                                  >
                                    Void
                                  </button>
                                </>
                              )}
                              {isVoided && (
                                <span className="text-[10px] font-mono text-slate-400 italic mr-1">
                                  Voided
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeletingEntry(entry)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold shadow-xs transition-colors"
                                title="Permanently Delete Entry"
                              >
                                Delete
                              </button>
                            </div>
                          </td>

                        </tr>

                        {/* EXPANDED LINE DETAIL ROW */}
                        {isExpanded && (
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <td colSpan={6} className="p-4 pl-8">
                              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                                <div className="flex justify-between items-center border-b border-slate-200 pb-2 text-xs font-mono text-slate-500">
                                  <span>Entry Reference ID: {entry.id}</span>
                                  <span>Dr / Cr Double-Entry Posting Breakdown</span>
                                </div>

                                <table className="w-full text-left text-xs font-mono">
                                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase">
                                    <tr>
                                      <th className="p-2">Account Title</th>
                                      <th className="p-2">Account Category</th>
                                      <th className="p-2 text-right">Debit Amount (₹)</th>
                                      <th className="p-2 text-right">Credit Amount (₹)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {entry.lines.map((line) => (
                                      <tr key={line.id}>
                                        <td className="p-2 font-sans font-bold text-slate-900">
                                          {line.account_name} {line.student_name ? `(${line.student_name})` : ''}
                                        </td>
                                        <td className="p-2 text-slate-500 font-bold uppercase text-[10px]">
                                          {line.account_type}
                                        </td>
                                        <td className="p-2 text-right font-bold text-emerald-700">
                                          {line.debit_amount > 0 ? `₹${line.debit_amount.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="p-2 text-right font-bold text-blue-700">
                                          {line.credit_amount > 0 ? `₹${line.credit_amount.toFixed(2)}` : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* NEW MANUAL JOURNAL ENTRY VOUCHER MODAL */}
      <NewJournalEntryModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={() => {
          showToast('New journal entry posted successfully! Live balances updated.');
          loadJournal();
        }}
      />

      {/* EDIT MODAL */}
      <EditJournalEntryModal
        isOpen={!!editingEntry}
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSuccess={() => {
          showToast('Journal entry updated successfully. Audit log written.');
          loadJournal();
        }}
      />

      {/* VOID CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={!!voidingEntry}
        title="Void Journal Entry (Soft Delete)"
        message={`Are you sure you want to void this entry ("${voidingEntry?.description}")? It will be soft-deleted and excluded from all balance reports, but will remain visible in the audit log.`}
        confirmLabel="Void Journal Entry"
        cancelLabel="Keep Entry"
        variant="warning"
        loading={voidLoading}
        onCancel={() => setVoidingEntry(null)}
        onConfirm={handleExecuteVoid}
      />

      {/* PERMANENT DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={!!deletingEntry}
        title="Permanently Delete Journal Entry"
        message={`Are you sure you want to PERMANENTLY delete this journal entry ("${deletingEntry?.description}")? This action CANNOT be undone and will permanently remove this record from the database.`}
        confirmLabel="Permanently Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteLoading}
        onCancel={() => setDeletingEntry(null)}
        onConfirm={handleExecuteDelete}
      />
    </>
  );
}

