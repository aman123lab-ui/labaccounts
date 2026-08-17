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

  // Download Template Handler
  const handleDownloadTemplate = () => {
    const csvHeader = 'name,batch,phone,balance,password\n';
    const sampleRow1 = 'John Doe,JD1,9876543210,50.00,Password123\n';
    const sampleRow2 = 'Jane Smith,HS2,9876543211,0.00,Password456\n';
    const blob = new Blob([csvHeader + sampleRow1 + sampleRow2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'student_bulk_registration_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV File text helper
  const parseCSVText = (text: string): BulkRegistrationRowInput[] => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length <= 1) return [];

    const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
    const nameIdx = header.indexOf('name');
    const batchIdx = header.indexOf('batch');
    const phoneIdx = header.indexOf('phone');
    const balanceIdx = header.indexOf('balance');
    const passwordIdx = header.indexOf('password');

    const rows: BulkRegistrationRowInput[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

      rows.push({
        name: cols[nameIdx >= 0 ? nameIdx : 0] || '',
        batch: cols[batchIdx >= 0 ? batchIdx : 1] || '',
        phone: cols[phoneIdx >= 0 ? phoneIdx : 2] || '',
        balance: parseFloat(cols[balanceIdx >= 0 ? balanceIdx : 3] || '0') || 0,
        password: cols[passwordIdx >= 0 ? passwordIdx : 4] || '',
      });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative my-8">
        {/* Header & Close Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/40">
                Admin Exclusive
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-1">Bulk Student CSV Import</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload a CSV file containing multiple student records to register in batch with optional opening balances.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-800/40 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Template
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* CSV Format Helper Box */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs space-y-1 font-mono">
          <div className="text-slate-400">CSV Header Requirement:</div>
          <div className="text-emerald-400 font-bold">name,batch,phone,balance,password</div>
          <div className="text-slate-500 text-[11px] mt-2">
            • Non-zero balances automatically create double-entry opening journal entries (Student AR Dr / Fund Balance Cr).
          </div>
        </div>

        {/* Error Alert */}
        {bulkError && (
          <div className="p-3.5 bg-red-950/60 border border-red-800/60 rounded-xl text-xs text-red-300">
            {bulkError}
          </div>
        )}

        {/* Upload Form */}
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-950 file:text-emerald-300 hover:file:bg-emerald-900 file:cursor-pointer border border-slate-800 rounded-xl bg-slate-950 p-2"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bulkSubmitting || !csvFile}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-950 disabled:opacity-50 flex items-center justify-center gap-2"
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
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">TOTAL ROWS</span>
                <span className="text-white font-bold text-sm">{bulkResult.totalRows}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-emerald-900/50">
                <span className="text-emerald-500 block">SUCCESS</span>
                <span className="text-emerald-400 font-bold text-sm">{bulkResult.successCount}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-red-900/50">
                <span className="text-red-500 block">FAILED</span>
                <span className="text-red-400 font-bold text-sm">{bulkResult.failureCount}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-blue-900/50">
                <span className="text-blue-400 block">BALANCES POSTED</span>
                <span className="text-blue-300 font-bold text-sm">{bulkResult.openingBalancesPosted}</span>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0 font-mono uppercase tracking-wider">
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
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {bulkResult.rowResults.map((r) => (
                    <tr key={r.rowNumber} className={r.status === 'success' ? 'bg-slate-900/40' : 'bg-red-950/20'}>
                      <td className="p-2.5 text-slate-400">#{r.rowNumber}</td>
                      <td className="p-2.5 text-slate-200">{r.name}</td>
                      <td className="p-2.5 text-slate-400">{r.phone}</td>
                      <td className="p-2.5 text-slate-300">{r.batch}</td>
                      <td className="p-2.5 text-slate-300">₹{r.balance.toFixed(2)}</td>
                      <td className="p-2.5">
                        {r.status === 'success' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold text-[10px]">
                            SUCCESS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 font-bold text-[10px]">
                            FAILED
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-400 text-[11px]">{r.error || 'Registered OK'}</td>
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
