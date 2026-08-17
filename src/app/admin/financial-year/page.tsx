'use client';

import React, { useState, useEffect } from 'react';
import {
  getCurrentFinancialYear,
  getFinancialYears,
  updateFinancialYearDates,
  checkOutofRangeTransactions,
  previewRolloverFinancialYear,
  rollOverFinancialYear,
  checkCanUndoRollover,
  undoLastRollover,
  exportAccountLedgerCSV,
  RollOverPreview,
} from '@/services/financialYearService';
import { getChartOfAccounts, getAdminDashboardMetrics, AdminDashboardMetrics } from '@/services/accountingService';
import { FinancialYear, Account } from '@/types/database.types';
import { formatDate } from '@/utils/formatDate';

export default function FinancialYearPage() {
  const [currentFY, setCurrentFY] = useState<FinancialYear | null>(null);
  const [allFYs, setAllFYs] = useState<FinancialYear[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit FY Dates State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editWarning, setEditWarning] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Preview & Rollover State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<RollOverPreview | null>(null);
  const [rollingOver, setRollingOver] = useState(false);
  const [rollOverSuccess, setRollOverSuccess] = useState<string | null>(null);
  const [rollOverError, setRollOverError] = useState<string | null>(null);

  // Undo Rollover State
  const [isUndoOpen, setIsUndoOpen] = useState(false);
  const [undoChecking, setUndoChecking] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [undoReason, setUndoReason] = useState<string | null>(null);
  const [lastClosedFY, setLastClosedFY] = useState<FinancialYear | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoSuccess, setUndoSuccess] = useState<string | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);

  // Last Year Inspection State
  const [selectedClosedFYId, setSelectedClosedFYId] = useState<string>('');
  const [closedMetrics, setClosedMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [closedLoading, setClosedLoading] = useState(false);

  // Account Export State
  const [exportAccountId, setExportAccountId] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    const curr = await getCurrentFinancialYear();
    setCurrentFY(curr);

    if (curr) {
      setEditName(curr.name);
      setEditStartDate(curr.start_date);
      setEditEndDate(curr.end_date);
    }

    const list = await getFinancialYears();
    setAllFYs(list);

    const accs = await getChartOfAccounts();
    setAccounts(accs);

    if (accs.length > 0 && !exportAccountId) {
      setExportAccountId(accs[0].id);
    }

    const closed = list.filter((f) => !f.is_current);
    if (closed.length > 0 && !selectedClosedFYId) {
      setSelectedClosedFYId(closed[0].id);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch closed FY metrics when selected closed FY changes
  useEffect(() => {
    if (!selectedClosedFYId) return;

    async function loadClosedMetrics() {
      setClosedLoading(true);
      const targetFY = allFYs.find((f) => f.id === selectedClosedFYId);
      if (targetFY) {
        const metrics = await getAdminDashboardMetrics(
          `${targetFY.start_date}T00:00:00.000Z`,
          `${targetFY.end_date}T23:59:59.999Z`
        );
        setClosedMetrics(metrics);
      }
      setClosedLoading(false);
    }

    loadClosedMetrics();
  }, [selectedClosedFYId, allFYs]);

  // Check out of range transactions when editing dates
  const handleCheckEditRange = async (start: string, end: string) => {
    if (start && end && new Date(end) > new Date(start)) {
      const res = await checkOutofRangeTransactions(start, end);
      if (res.warning) {
        setEditWarning(res.warning);
      } else {
        setEditWarning(null);
      }
    } else {
      setEditWarning(null);
    }
  };

  // Handle Edit Dates Submit
  const handleSaveDates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFY) return;
    setEditSaving(true);
    setEditError(null);

    const res = await updateFinancialYearDates(currentFY.id, editStartDate, editEndDate, editName);

    if (res.success) {
      setIsEditOpen(false);
      setRollOverSuccess(`Financial Year configuration updated successfully.`);
      if (res.warning) {
        setRollOverSuccess(`Financial Year updated. ${res.warning}`);
      }
      loadData();
    } else {
      setEditError(res.error || 'Failed to update dates.');
    }
    setEditSaving(false);
  };

  // Open Safe Preview Modal (Dry-Run)
  const handleOpenPreview = async () => {
    setPreviewLoading(true);
    setRollOverError(null);
    setRollOverSuccess(null);
    setIsPreviewOpen(true);

    const res = await previewRolloverFinancialYear();
    if (res.success && res.preview) {
      setPreviewData(res.preview);
    } else {
      setRollOverError(res.error || 'Failed to calculate rollover preview.');
    }
    setPreviewLoading(false);
  };

  // Handle Real Rollover Execution (Committing)
  const handleExecuteRollover = async () => {
    setRollingOver(true);
    setRollOverError(null);
    setRollOverSuccess(null);

    const res = await rollOverFinancialYear();

    if (res.success) {
      let msg = `Financial Year ${res.closedYearName} closed successfully! ${res.newYearName} is now active. Net surplus of ₹${(res.surplusClosed || 0).toFixed(2)} transferred to Fund Balance.`;
      if (res.promotedStudentsCount || res.alumniStudentsCount || res.archivedStudentsCount) {
        msg += ` Academic Batch Rollover: ${res.promotedStudentsCount || 0} student(s) promoted, ${res.alumniStudentsCount || 0} moved to Alumni (with dues), ${res.archivedStudentsCount || 0} archived.`;
      }
      setRollOverSuccess(msg);
      setIsPreviewOpen(false);
      loadData();
    } else {
      setRollOverError(res.error || 'Failed to roll over financial year.');
    }
    setRollingOver(false);
  };

  // Open Undo Dialog & Run Safety Check
  const handleOpenUndo = async () => {
    setUndoChecking(true);
    setUndoError(null);
    setUndoSuccess(null);
    setIsUndoOpen(true);

    const res = await checkCanUndoRollover();
    setCanUndo(res.canUndo);
    setLastClosedFY(res.lastClosedFY || null);
    setUndoReason(res.reason || null);
    setUndoChecking(false);
  };

  // Handle Execute Undo
  const handleExecuteUndo = async () => {
    setUndoing(true);
    setUndoError(null);

    const res = await undoLastRollover();

    if (res.success) {
      setRollOverSuccess(`Financial year rollover successfully undone! ${res.reopenedYearName} is now re-opened and active.`);
      setIsUndoOpen(false);
      loadData();
    } else {
      setUndoError(res.error || 'Failed to undo rollover.');
    }
    setUndoing(false);
  };

  // Handle CSV Download
  const handleDownloadCSV = async () => {
    const acc = accounts.find((a) => a.id === exportAccountId);
    if (!acc) return;

    const csvContent = await exportAccountLedgerCSV(acc.id, acc.name);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${acc.name.replace(/\s+/g, '_')}_Ledger_Export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const closedFYs = allFYs.filter((f) => !f.is_current);
  const selectedClosedFY = closedFYs.find((f) => f.id === selectedClosedFYId);
  const hasClosedFY = closedFYs.length > 0;

  return (
    <>
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 space-y-8 flex-1">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-black text-white tracking-tight">
              Financial Year Management & Ledger Export
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Configure active periods, run dry-run previews, execute year-end closing entries with undo support, or export ledger history.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-2.5 shrink-0 self-start lg:self-auto">
            {hasClosedFY && (
              <button
                type="button"
                onClick={handleOpenUndo}
                className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-800/40 font-bold text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span>Undo Last Rollover</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenPreview}
              className="bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-800/50 font-bold text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>Preview Rollover</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPreview}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-lg transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Roll Over to New Year</span>
            </button>
          </div>
        </div>

        {rollOverSuccess && (
          <div className="p-4 bg-emerald-950/80 border border-emerald-800/80 rounded-2xl text-xs text-emerald-300 font-bold flex items-center justify-between gap-3">
            <span>{rollOverSuccess}</span>
            <button
              type="button"
              onClick={() => setRollOverSuccess(null)}
              className="text-emerald-500 hover:text-emerald-300 font-extrabold text-sm px-2"
            >
              ✕
            </button>
          </div>
        )}

        {rollOverError && (
          <div className="p-4 bg-red-950/80 border border-red-800/80 rounded-2xl text-xs text-red-300 flex items-center justify-between gap-3">
            <span>{rollOverError}</span>
            <button
              type="button"
              onClick={() => setRollOverError(null)}
              className="text-red-500 hover:text-red-300 font-extrabold text-sm px-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. CURRENT FINANCIAL YEAR STATUS CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Active Period Status
              </span>
              <span className="px-3 py-0.5 bg-emerald-950 border border-emerald-800/60 rounded-full text-[10px] font-mono font-bold text-emerald-400">
                CURRENT ACTIVE YEAR
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (currentFY) {
                  setEditName(currentFY.name);
                  setEditStartDate(currentFY.start_date);
                  setEditEndDate(currentFY.end_date);
                  handleCheckEditRange(currentFY.start_date, currentFY.end_date);
                }
                setIsEditOpen(true);
              }}
              className="self-start sm:self-auto bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3.5 py-1.5 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Financial Year Dates
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <span className="text-[11px] font-mono text-slate-500 uppercase block">Period Name</span>
              <span className="text-xl font-bold text-white font-mono mt-1 block">
                {currentFY?.name || 'FY 2026-2027'}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-mono text-slate-500 uppercase block">Start Date</span>
              <span className="text-sm font-semibold text-slate-300 font-mono mt-1 block">
                {currentFY?.start_date ? formatDate(currentFY.start_date) : 'N/A'}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-mono text-slate-500 uppercase block">End Date</span>
              <span className="text-sm font-semibold text-slate-300 font-mono mt-1 block">
                {currentFY?.end_date ? formatDate(currentFY.end_date) : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. READ-ONLY "LAST YEAR" INSPECTION VIEW */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Historical Financial Year Inspection</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Read-only view of closed financial years for reporting and auditing.
              </p>
            </div>

            {closedFYs.length > 0 && (
              <select
                value={selectedClosedFYId}
                onChange={(e) => setSelectedClosedFYId(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono rounded-xl px-4 py-2"
              >
                {closedFYs.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} (Closed {formatDate(f.closed_at)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {closedFYs.length === 0 ? (
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
              No historical closed financial years yet. Click "Roll Over to New Year" above when ready to close the active period.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                <span>Inspecting: <strong className="text-emerald-400">{selectedClosedFY?.name}</strong></span>
                <span>Date Range: {formatDate(selectedClosedFY?.start_date)} to {formatDate(selectedClosedFY?.end_date)}</span>
              </div>

              {closedLoading ? (
                <div className="p-6 text-center text-xs text-slate-400 animate-pulse">Loading year metrics...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Credit Given</span>
                    <span className="text-xl font-bold text-white font-mono mt-1 block">
                      ₹{Math.abs(closedMetrics?.totalCreditGiven || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Cash Flow</span>
                    <span className="text-xl font-bold text-blue-400 font-mono mt-1 block">
                      ₹{Math.abs(closedMetrics?.cashFlow || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Expenses</span>
                    <span className="text-xl font-bold text-purple-400 font-mono mt-1 block">
                      ₹{Math.abs(closedMetrics?.totalExpenses || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Net Surplus Closed</span>
                    <span className="text-xl font-bold text-emerald-400 font-mono mt-1 block">
                      ₹{Math.abs(closedMetrics?.surplus || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. DOWNLOADABLE INDIVIDUAL ACCOUNT LEDGER EXPORT */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white">Downloadable Account Ledger Export (CSV)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any account in the Chart of Accounts (Cash, Fund Balance, Accounts Receivable, etc.) to export its complete line transaction history.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <select
              value={exportAccountId}
              onChange={(e) => setExportAccountId(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type.toUpperCase()})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleDownloadCSV}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-800/40 text-xs font-bold px-6 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Account CSV
            </button>
          </div>
        </div>
      </main>

      {/* PART 2: EDIT FINANCIAL YEAR DATES MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white">Edit Active Financial Year Dates</h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDates} className="space-y-4">
              {editError && (
                <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-300">
                  {editError}
                </div>
              )}

              {editWarning && (
                <div className="p-3.5 bg-amber-950/70 border border-amber-800/80 rounded-xl text-xs text-amber-300 space-y-1">
                  <span className="font-bold block">⚠️ Date Boundary Notice</span>
                  <p>{editWarning}</p>
                </div>
              )}

              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                  Financial Year Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => {
                      setEditStartDate(e.target.value);
                      handleCheckEditRange(e.target.value, editEndDate);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono [color-scheme:dark]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => {
                      setEditEndDate(e.target.value);
                      handleCheckEditRange(editStartDate, e.target.value);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 font-mono [color-scheme:dark]"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PART 3: SAFE PREVIEW & ROLLOVER MODAL */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl bg-slate-900 border border-emerald-800/50 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header with Read-Only Badge */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950 border border-emerald-800/80 rounded-full text-[10px] font-mono font-bold text-emerald-400 mb-1.5">
                  <span>🛡️ READ-ONLY PREVIEW</span>
                  <span>• ZERO DATABASE WRITES</span>
                </div>
                <h3 className="text-xl font-black text-white">Financial Year Rollover Preview</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {previewLoading ? (
              <div className="p-12 text-center text-xs text-slate-400 animate-pulse space-y-2">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p>Computing dry-run simulation from double-entry ledger...</p>
              </div>
            ) : previewData ? (
              <div className="space-y-5">
                {/* Proposed Period Transition */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Closing Period</span>
                    <span className="font-bold text-amber-400 mt-0.5 block">{previewData.currentFYName}</span>
                    <span className="text-[11px] text-slate-400 block">{formatDate(previewData.currentStartDate)} to {formatDate(previewData.currentEndDate)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">New Active Period</span>
                    <span className="font-bold text-emerald-400 mt-0.5 block">{previewData.proposedNextFYName}</span>
                    <span className="text-[11px] text-slate-400 block">{formatDate(previewData.proposedNextStartDate)} to {formatDate(previewData.proposedNextEndDate)}</span>
                  </div>
                </div>

                {/* Journal Scope Change Notice */}
                <div className="p-3.5 bg-blue-950/60 border border-blue-800/60 rounded-xl text-xs text-blue-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-blue-300">
                    <span>ℹ️</span> Journal Entry View Scope Reset
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    After rollover, the Journal Entry page will default to showing only <strong className="text-white font-mono">{previewData.proposedNextFYName}</strong> activity. Historical entries from <strong className="text-white font-mono">{previewData.currentFYName}</strong> remain safely stored and can be inspected via Ledger Accounts or the Historical Inspection section.
                  </p>
                </div>

                {/* Financial Closing Entry Preview */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-2">
                    Financial Closing Entry
                  </span>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Total Revenue</span>
                      <span className="font-bold text-emerald-400 font-mono">₹{Math.abs(previewData.totalRevenue).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Total Expenses</span>
                      <span className="font-bold text-purple-400 font-mono">₹{Math.abs(previewData.totalExpense).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Net Result</span>
                      <span
                        className={`font-bold font-mono ${
                          previewData.netSurplus >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        ₹{Math.abs(previewData.netSurplus).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Color-coded Surplus / Deficit transfer box */}
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                      previewData.netSurplus >= 0
                        ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300'
                        : 'bg-red-950/70 border-red-800/80 text-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{previewData.netSurplus >= 0 ? '📈' : '📉'}</span>
                      <div>
                        <span className="font-bold block">
                          {previewData.netSurplus >= 0
                            ? `Surplus of ₹${previewData.netSurplus.toFixed(2)} — will increase Fund Balance`
                            : `Deficit of ₹${Math.abs(previewData.netSurplus).toFixed(2)} — will decrease Fund Balance`}
                        </span>
                        <span className="text-[10px] opacity-80 block">
                          Target Account: {previewData.fundBalanceAccountName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Aggregate Accounts Receivable & Payable Totals */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-2">
                    📊 Student Balance Aggregate Summary
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block">Total Accounts Receivable</span>
                      <span className="text-lg font-extrabold text-emerald-400 mt-0.5 block">
                        ₹{(previewData.totalReceivable || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-sans mt-0.5 block">Aggregate student dues owed</span>
                    </div>

                    {previewData.totalPayable > 0 && (
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase block">Total Accounts Payable</span>
                        <span className="text-lg font-extrabold text-amber-400 mt-0.5 block">
                          ₹{(previewData.totalPayable || 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-sans mt-0.5 block">Aggregate overpayments owed to students</span>
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 italic">
                    Note: Summary totals only. Student balances carry forward 100% unchanged.
                  </div>
                </div>

                {/* Academic Progression Preview */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-900 pb-2">
                    🎓 Academic Batch Progression
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block">Promoted</span>
                      <span className="text-base font-bold text-emerald-400 mt-0.5 block">{previewData.promotedStudentsCount}</span>
                      <span className="text-[9px] text-slate-500 block font-sans">Next Batch Level</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block">Moved to Alumni</span>
                      <span className="text-base font-bold text-amber-400 mt-0.5 block">{previewData.alumniStudentsCount}</span>
                      <span className="text-[9px] text-slate-500 block font-sans">{previewData.proposedAlumniBatchName}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block">Archived</span>
                      <span className="text-base font-bold text-slate-400 mt-0.5 block">{previewData.archivedStudentsCount}</span>
                      <span className="text-[9px] text-slate-500 block font-sans">BS5 (0 Dues)</span>
                    </div>
                  </div>
                </div>

                {/* Summary of Automated Rollover Actions */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                  <span className="text-[10px] font-bold uppercase text-slate-400 font-mono block">Automated Rollover Actions</span>
                  <ul className="space-y-1.5 text-[11px] list-disc list-inside text-slate-400 leading-relaxed">
                    <li>Close active year <strong className="text-slate-200">{previewData.currentFYName}</strong></li>
                    <li>Create and activate <strong className="text-slate-200">{previewData.proposedNextFYName}</strong></li>
                    <li>Post closing entry transferring Net {previewData.netSurplus >= 0 ? 'Surplus' : 'Deficit'} to <strong className="text-slate-200">{previewData.fundBalanceAccountName}</strong></li>
                    <li>Promote student batches and move graduating students to <strong className="text-slate-200">{previewData.proposedAlumniBatchName}</strong></li>
                    <li>Reset default view scope on Journal Entry page to <strong className="text-slate-200">{previewData.proposedNextFYName}</strong></li>
                  </ul>
                </div>

                <div className="flex gap-3 border-t border-slate-800 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 rounded-xl text-xs"
                  >
                    Cancel / Close Preview
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteRollover}
                    disabled={rollingOver}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl text-xs shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {rollingOver ? 'Committing Rollover...' : 'Confirm & Roll Over'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* PART 4: UNDO ROLLOVER MODAL */}
      {isUndoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-amber-800/60 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400 font-bold">
                  ↩️
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Undo Financial Year Rollover</h3>
                  <p className="text-xs text-amber-400 font-semibold">Reverse recent year-end closing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUndoOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {undoChecking ? (
              <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                Checking rollover undo eligibility...
              </div>
            ) : (
              <div className="space-y-4">
                {undoError && (
                  <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-300">
                    {undoError}
                  </div>
                )}

                {canUndo ? (
                  <div className="p-4 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 space-y-2">
                    <span className="font-bold text-emerald-400 block">✓ Safe to Undo</span>
                    <p>
                      Re-opens <strong>{lastClosedFY?.name}</strong>, voids the closing journal entry, and restores student batch assignments to pre-rollover state.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-red-950/80 border border-red-800/80 rounded-xl text-xs text-red-300 space-y-2">
                    <span className="font-bold text-red-400 block">⚠️ Undo Unavailable</span>
                    <p>{undoReason || 'Undo is not permitted at this stage.'}</p>
                  </div>
                )}

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2 font-mono">
                  <p className="text-slate-400 uppercase font-bold text-[10px]">Actions that will be performed:</p>
                  <p>1. Re-open period: <strong>{lastClosedFY?.name}</strong> (`is_current = true`)</p>
                  <p>2. Void closing entry transferring surplus to Fund Balance.</p>
                  <p>3. Revert promoted student batches back to original classes.</p>
                  <p>4. Delete unpopulated new financial year created during rollover.</p>
                </div>

                <div className="flex gap-3 border-t border-slate-800 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsUndoOpen(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteUndo}
                    disabled={!canUndo || undoing}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black py-3 rounded-xl text-xs shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {undoing ? 'Undoing Rollover...' : 'Confirm Undo Rollover'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
