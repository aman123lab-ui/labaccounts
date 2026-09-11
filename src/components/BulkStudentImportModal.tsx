'use client';

import React, { useState } from 'react';
import {
  registerStudentsBulk,
  BulkRegistrationResult,
  BulkRegistrationRowInput,
} from '@/services/authService';

interface BulkStudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentsImported: () => void;
}

export default function BulkStudentImportModal({
  isOpen,
  onClose,
  onStudentsImported,
}: BulkStudentImportModalProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkRegistrationResult | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Download Template Handler — includes standard registration columns + batch_category
  const handleDownloadTemplate = () => {
    const csvHeader = 'name,batch,phone,password,balance,batch_category\n';
    const sampleRow1 = 'John Doe,General Batch,9876543210,Password123,50.00,General\n';
    const sampleRow2 = 'Jane Smith,JD 1,9876543211,Password456,0.00,JD\n';
    const sampleRow3 = 'Ali Khan,HS 2,9876543212,Password789,30.00,HS\n';
    const blob = new Blob(
      [csvHeader + sampleRow1 + sampleRow2 + sampleRow3],
      { type: 'text/csv;charset=utf-8;' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'student_bulk_registration_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV File text — handles name, batch, phone, password, balance, and optional batch_category
  const parseCSVText = (text: string): BulkRegistrationRowInput[] => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length <= 1) return [];

    const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
    const nameIdx = header.indexOf('name');
    const batchIdx = header.indexOf('batch');
    const batchCategoryIdx = header.indexOf('batch_category');
    const phoneIdx = header.indexOf('phone');
    const balanceIdx = header.indexOf('balance');
    const passwordIdx = header.indexOf('password');

    const rows: BulkRegistrationRowInput[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

      const row: BulkRegistrationRowInput = {
        name: cols[nameIdx >= 0 ? nameIdx : 0] || '',
        batch: cols[batchIdx >= 0 ? batchIdx : 1] || '',
        phone: cols[phoneIdx >= 0 ? phoneIdx : 2] || '',
        balance: parseFloat(cols[balanceIdx >= 0 ? balanceIdx : 4] || '0') || 0,
        password: cols[passwordIdx >= 0 ? passwordIdx : 3] || '',
      };

      // Batch category (optional)
      if (batchCategoryIdx >= 0 && cols[batchCategoryIdx]) {
        row.batch_category = cols[batchCategoryIdx];
      }

      rows.push(row);
    }

    return rows;
  };

  // Bulk Submit Handler
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      setBulkError('Please select a CSV file to upload.');
      return;
    }

    setBulkSubmitting(true);
    setBulkError(null);
    setBulkResult(null);

    try {
      const text = await csvFile.text();
      const rows = parseCSVText(text);

      if (rows.length === 0) {
        setBulkError('The uploaded CSV contains no valid data rows.');
        setBulkSubmitting(false);
        return;
      }

      const result = await registerStudentsBulk(rows);
      setBulkResult(result);
      if (result.successCount > 0) {
        onStudentsImported();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error processing CSV file.';
      setBulkError(msg);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleClose = () => {
    setCsvFile(null);
    setBulkResult(null);
    setBulkError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 text-slate-900">
        {/* Header & Close Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                Admin Exclusive
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Bulk Student CSV Import</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload a CSV file to register students in batch with optional opening balances and batch categories.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="bg-slate-100 hover:bg-slate-200 text-emerald-800 border border-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Template
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              title="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* CSV Format Helper Box */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-2 font-mono">
          <div className="text-slate-600 font-semibold font-sans">CSV Column Reference</div>

          {/* Required columns */}
          <div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1 font-sans">Required</div>
            <div className="text-emerald-800 font-bold">name, batch, phone, password, balance</div>
          </div>

          {/* Optional batch category */}
          <div className="pt-1 border-t border-slate-200">
            <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1 font-sans">Optional — Batch Category</div>
            <div className="text-amber-700 font-bold">batch_category</div>
            <div className="text-slate-500 text-[11px] mt-1 font-sans">
              Category for the batch if it will be auto-created:{' '}
              <span className="font-bold text-amber-700">General</span>,{' '}
              <span className="font-bold text-amber-700">JD</span>,{' '}
              <span className="font-bold text-amber-700">HS</span>, or{' '}
              <span className="font-bold text-amber-700">BS</span>.
              Leave blank to auto-detect from batch name prefix.
            </div>
          </div>

          <div className="pt-1 border-t border-slate-200 text-[11px] text-slate-500 space-y-0.5 font-sans">
            <div>• Non-zero <span className="font-semibold">balance</span> auto-creates an opening journal entry (Student AR Dr / Fund Balance Cr).</div>
            <div>• All registered student names will be automatically properly capitalized.</div>
          </div>
        </div>

        {/* Error Alert */}
        {bulkError && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {bulkError}
          </div>
        )}

        {/* Upload Form */}
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 file:cursor-pointer border border-slate-300 rounded-xl bg-white p-2"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bulkSubmitting || !csvFile}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {bulkSubmitting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing CSV...
                </>
              ) : (
                'Upload & Process Bulk CSV'
              )}
            </button>
          </div>
        </form>

        {/* Bulk Processing Summary Results Table */}
        {bulkResult && (
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">TOTAL ROWS</span>
                <span className="text-slate-900 font-bold text-sm">{bulkResult.totalRows}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                <span className="text-emerald-800 block">SUCCESS</span>
                <span className="text-emerald-900 font-bold text-sm">{bulkResult.successCount}</span>
              </div>
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <span className="text-red-800 block">FAILED</span>
                <span className="text-red-900 font-bold text-sm">{bulkResult.failureCount}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-600 block">BALANCES POSTED</span>
                <span className="text-slate-900 font-bold text-sm">{bulkResult.openingBalancesPosted}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 sticky top-0 font-mono uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5">Row</th>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Phone</th>
                    <th className="p-2.5">Batch</th>
                    <th className="p-2.5">Balance</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {bulkResult.rowResults.map((r) => (
                    <tr key={r.rowNumber} className={r.status === 'success' ? 'bg-white' : 'bg-red-50/50'}>
                      <td className="p-2.5 text-slate-500">#{r.rowNumber}</td>
                      <td className="p-2.5 text-slate-900 font-semibold">{r.name}</td>
                      <td className="p-2.5 text-slate-500">{r.phone}</td>
                      <td className="p-2.5 text-slate-700">{r.batch}</td>
                      <td className="p-2.5 text-slate-700 font-mono">
                        <span className="font-sans font-bold mr-0.5">₹</span>
                        <span className="font-mono">{r.balance.toFixed(2)}</span>
                      </td>
                      <td className="p-2.5">
                        {r.status === 'success' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                            SUCCESS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-red-50 text-red-800 border border-red-200 font-bold text-[10px]">
                            FAILED
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-500 text-[11px]">{r.error || 'Registered OK'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
