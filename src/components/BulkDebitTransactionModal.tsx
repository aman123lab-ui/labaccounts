'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { postJournalEntry, getChartOfAccounts } from '@/services/accountingService';
import { normalizePhone } from '@/services/authService';
import { calculatePrintAmount, PrintTypeOption, PrintSideOption } from '@/config/printingRates';
import { isGuestMode, getDemoAccounts, postDemoJournalEntry, getDemoStudents } from '@/lib/demo/demoStore';
import { Account } from '@/types/database.types';

interface BulkDebitTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionsPosted: () => void;
}

interface BulkDebitRowInput {
  phone: string;
  printPages: number;
  printType: PrintTypeOption;
  printSide: PrintSideOption;
  description: string;
}

interface BulkDebitRowResult {
  rowNumber: number;
  phone: string;
  resolvedName?: string;
  printPages: number;
  printType: PrintTypeOption;
  printSide: PrintSideOption;
  amount: number;
  status: 'success' | 'failed';
  entryId?: string;
  error?: string;
}

interface BulkDebitResult {
  totalRows: number;
  successCount: number;
  failureCount: number;
  totalRevenue: number;
  rowResults: BulkDebitRowResult[];
}

export default function BulkDebitTransactionModal({
  isOpen,
  onClose,
  onTransactionsPosted,
}: BulkDebitTransactionModalProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkDebitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [revenueAccounts, setRevenueAccounts] = useState<Account[]>([]);
  const [selectedRevenueAccountId, setSelectedRevenueAccountId] = useState<string>('');

  useEffect(() => {
    async function loadAccounts() {
      const allAccs = await getChartOfAccounts();
      const revAccs = allAccs.filter((a) => a.type === 'revenue');
      setRevenueAccounts(revAccs);
      
      const defaultAcc = revAccs.find((a) => a.name.toLowerCase() === 'printing revenue');
      if (defaultAcc) {
        setSelectedRevenueAccountId(defaultAcc.id);
      } else if (revAccs.length > 0) {
        setSelectedRevenueAccountId(revAccs[0].id);
      }
    }
    loadAccounts();
  }, []);

  if (!isOpen) return null;

  // Download Template Handler
  const handleDownloadTemplate = () => {
    const header = 'phone,print_pages,print_type,print_side,description\n';
    const row1 = '9876543210,10,bw,single,Lab Manual Print\n';
    const row2 = '9876543211,4,color,single,Project Proposal Cover\n';
    const row3 = '9876543212,24,bw,double,Thesis Draft Chapters\n';
    const blob = new Blob([header + row1 + row2 + row3], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'bulk_debit_print_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV
  const parseCSV = (text: string): { rows: BulkDebitRowInput[]; parseError?: string } => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length <= 1) return { rows: [], parseError: 'CSV contains no data rows.' };

    const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
    const phoneIdx = header.indexOf('phone');
    const pagesIdx = header.indexOf('print_pages') >= 0 ? header.indexOf('print_pages') : header.indexOf('pages');
    const typeIdx = header.indexOf('print_type') >= 0 ? header.indexOf('print_type') : header.indexOf('type');
    const sideIdx = header.indexOf('print_side') >= 0 ? header.indexOf('print_side') : header.indexOf('side');
    const descIdx = header.indexOf('description');

    if (phoneIdx < 0 || pagesIdx < 0) {
      return { rows: [], parseError: 'CSV must have at least "phone" and "print_pages" columns.' };
    }

    const rows: BulkDebitRowInput[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

      const rawType = (typeIdx >= 0 ? cols[typeIdx] : 'bw').toLowerCase();
      const rawSide = (sideIdx >= 0 ? cols[sideIdx] : 'single').toLowerCase();

      rows.push({
        phone: cols[phoneIdx] || '',
        printPages: parseInt(cols[pagesIdx] || '0', 10),
        printType: rawType === 'color' ? 'color' : 'bw',
        printSide: rawSide === 'double' ? 'double' : 'single',
        description: descIdx >= 0 ? cols[descIdx] || '' : '',
      });
    }

    return { rows };
  };

  // Process Rows
  const processRows = async (rows: BulkDebitRowInput[]): Promise<BulkDebitResult> => {
    const rowResults: BulkDebitRowResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    let totalRevenue = 0;

    if (isGuestMode()) {
      const demoStudents = getDemoStudents({ status: 'active' });
      const demoAccounts = getDemoAccounts();
      const serviceIncomeAccountId = selectedRevenueAccountId || '40000000-0000-0000-0000-000000000001';

      const studentByPhone = new Map<string, any>();
      demoStudents.forEach((s) => {
        studentByPhone.set(normalizePhone(s.phone), s);
      });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        const cleanPhone = normalizePhone(row.phone || '');

        if (!cleanPhone) {
          failureCount++;
          rowResults.push({
            rowNumber: rowNum,
            phone: row.phone || 'N/A',
            printPages: row.printPages,
            printType: row.printType,
            printSide: row.printSide,
            amount: 0,
            status: 'failed',
            error: 'Missing or invalid phone number.',
          });
          continue;
        }

        if (isNaN(row.printPages) || row.printPages <= 0) {
          failureCount++;
          rowResults.push({
            rowNumber: rowNum,
            phone: cleanPhone,
            printPages: row.printPages,
            printType: row.printType,
            printSide: row.printSide,
            amount: 0,
            status: 'failed',
            error: 'print_pages must be a positive integer.',
          });
          continue;
        }

        // MATCH BY PHONE NUMBER ONLY
        const student = studentByPhone.get(cleanPhone);
        if (!student) {
          failureCount++;
          rowResults.push({
            rowNumber: rowNum,
            phone: cleanPhone,
            printPages: row.printPages,
            printType: row.printType,
            printSide: row.printSide,
            amount: 0,
            status: 'failed',
            error: `No registered student matches phone ${cleanPhone}.`,
          });
          continue;
        }

        const studentAcc = demoAccounts.find((a) => a.student_id === student.id);
        if (!studentAcc) {
          failureCount++;
          rowResults.push({
            rowNumber: rowNum,
            phone: cleanPhone,
            resolvedName: student.name,
            printPages: row.printPages,
            printType: row.printType,
            printSide: row.printSide,
            amount: 0,
            status: 'failed',
            error: 'Student Accounts Receivable account not found.',
          });
          continue;
        }

        const calc = calculatePrintAmount(row.printType, row.printSide, row.printPages, 0);
        const amount = calc.totalAmount;
        const desc = row.description.trim() || `Print (${row.printType.toUpperCase()} ${row.printSide}, ${row.printPages} pages)`;

        const postRes = postDemoJournalEntry(
          [
            { accountId: studentAcc.id, debit: amount, credit: 0 },
            { accountId: serviceIncomeAccountId, debit: 0, credit: amount },
          ],
          desc
        );

        if (postRes.success) {
          successCount++;
          totalRevenue += amount;
          rowResults.push({
            rowNumber: rowNum,
            phone: cleanPhone,
            resolvedName: student.name,
            printPages: row.printPages,
            printType: row.printType,
            printSide: row.printSide,
            amount,
            status: 'success',
            entryId: postRes.entryId,
          });
        } else {
          failureCount++;
          rowResults.push({
            rowNumber: rowNum,
            phone: cleanPhone,
            resolvedName: student.name,
            printPages: row.printPages,
            printType: row.printType,
            printSide: row.printSide,
            amount,
            status: 'failed',
            error: postRes.error || 'Failed to post demo entry.',
          });
        }
      }

      return { totalRows: rows.length, successCount, failureCount, totalRevenue, rowResults };
    }

    // Live Database Flow
    const supabase = createClient();

    // 1. Fetch all active students
    const { data: studentsData } = await (supabase
      .from('students' as any)
      .select('id, name, phone, status') as any);

    // 2. Fetch all student AR accounts
    const { data: accountsData } = await (supabase
      .from('accounts' as any)
      .select('id, student_id')
      .or('is_student_account.eq.true,student_id.not.is.null') as any);

    // 3. Fetch Service Income Account (Revenue)
    const { data: revAcc } = await (supabase
      .from('accounts' as any)
      .select('id')
      .eq('type', 'revenue')
      .limit(1)
      .maybeSingle() as any);
    const serviceIncomeAccountId = selectedRevenueAccountId || revAcc?.id || '40000000-0000-0000-0000-000000000001';

    // Map students strictly by normalized PHONE NUMBER
    const studentByPhone = new Map<string, { id: string; name: string }>();
    (studentsData || []).forEach((s: any) => {
      studentByPhone.set(normalizePhone(s.phone), { id: s.id, name: s.name });
    });

    const accountByStudentId = new Map<string, string>();
    (accountsData || []).forEach((a: any) => {
      if (a.student_id) accountByStudentId.set(a.student_id, a.id);
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      const cleanPhone = normalizePhone(row.phone || '');

      if (!cleanPhone) {
        failureCount++;
        rowResults.push({
          rowNumber: rowNum,
          phone: row.phone || 'N/A',
          printPages: row.printPages,
          printType: row.printType,
          printSide: row.printSide,
          amount: 0,
          status: 'failed',
          error: 'Missing or invalid phone number.',
        });
        continue;
      }

      if (isNaN(row.printPages) || row.printPages <= 0) {
        failureCount++;
        rowResults.push({
          rowNumber: rowNum,
          phone: cleanPhone,
          printPages: row.printPages,
          printType: row.printType,
          printSide: row.printSide,
          amount: 0,
          status: 'failed',
          error: 'print_pages must be a positive integer.',
        });
        continue;
      }

      // MATCH BY PHONE NUMBER ONLY — Never by name to avoid ambiguity with duplicates
      const student = studentByPhone.get(cleanPhone);
      if (!student) {
        failureCount++;
        rowResults.push({
          rowNumber: rowNum,
          phone: cleanPhone,
          printPages: row.printPages,
          printType: row.printType,
          printSide: row.printSide,
          amount: 0,
          status: 'failed',
          error: `No registered student matches phone ${cleanPhone}.`,
        });
        continue;
      }

      const studentARAccountId = accountByStudentId.get(student.id);
      if (!studentARAccountId) {
        failureCount++;
        rowResults.push({
          rowNumber: rowNum,
          phone: cleanPhone,
          resolvedName: student.name,
          printPages: row.printPages,
          printType: row.printType,
          printSide: row.printSide,
          amount: 0,
          status: 'failed',
          error: 'Dedicated Accounts Receivable account not found.',
        });
        continue;
      }

      const calc = calculatePrintAmount(row.printType, row.printSide, row.printPages, 0);
      const amount = calc.totalAmount;
      const desc = row.description.trim() || `Print (${row.printType.toUpperCase()} ${row.printSide}, ${row.printPages} pages)`;

      // Post Print-based Revenue Journal Entry: Student AR (Dr) / Service Income (Cr)
      const postRes = await postJournalEntry(
        [
          { accountId: studentARAccountId, debit: amount, credit: 0 },
          { accountId: serviceIncomeAccountId, debit: 0, credit: amount },
        ],
        desc
      );

      if (!postRes.success || !postRes.entryId) {
        failureCount++;
        rowResults.push({
          rowNumber: rowNum,
          phone: cleanPhone,
          resolvedName: student.name,
          printPages: row.printPages,
          printType: row.printType,
          printSide: row.printSide,
          amount,
          status: 'failed',
          error: postRes.error || 'Failed to post journal entry.',
        });
        continue;
      }

      // Record linked print_jobs entry
      await (supabase.from('print_jobs' as any) as any).insert({
        journal_entry_id: postRes.entryId,
        student_id: student.id,
        print_type: row.printType,
        side: row.printSide,
        num_pages: row.printPages,
        description: desc,
        discount: 0,
        amount,
      });

      successCount++;
      totalRevenue += amount;
      rowResults.push({
        rowNumber: rowNum,
        phone: cleanPhone,
        resolvedName: student.name,
        printPages: row.printPages,
        printType: row.printType,
        printSide: row.printSide,
        amount,
        status: 'success',
        entryId: postRes.entryId,
      });
    }

    return { totalRows: rows.length, successCount, failureCount, totalRevenue, rowResults };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      setError('Please select a CSV file.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const text = await csvFile.text();
      const { rows, parseError } = parseCSV(text);

      if (parseError) {
        setError(parseError);
        setSubmitting(false);
        return;
      }

      if (rows.length === 0) {
        setError('The uploaded CSV file contains no data rows.');
        setSubmitting(false);
        return;
      }

      const res = await processRows(rows);
      setResult(res);

      if (res.successCount > 0) {
        onTransactionsPosted();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing the CSV file.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setCsvFile(null);
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 text-slate-900">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                Debit Book
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Bulk CSV Print Transaction Entry</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Post print revenue debit transactions against multiple existing students via CSV. Students are matched by phone number only.
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

        {/* CSV Format Reference */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-2 font-mono">
          <div className="text-slate-700 font-semibold font-sans flex items-center gap-2">
            <span>CSV Column Format</span>
            <span className="font-normal text-slate-500 text-[11px]">(Matches Debit Book Print calculation)</span>
          </div>
          <div className="text-emerald-800 font-bold">
            phone, print_pages, print_type, print_side, description
          </div>
          <div className="text-slate-500 text-[11px] font-sans space-y-0.5 pt-1 border-t border-slate-200">
            <div>• <span className="font-semibold text-slate-700">phone</span> — exact registered phone number (matching is done by phone only, never name).</div>
            <div>• <span className="font-semibold text-slate-700">print_pages</span> — number of pages printed (positive integer).</div>
            <div>• <span className="font-semibold text-slate-700">print_type</span> — <span className="font-bold text-slate-700">bw</span> or <span className="font-bold text-slate-700">color</span>.</div>
            <div>• <span className="font-semibold text-slate-700">print_side</span> — <span className="font-bold text-slate-700">single</span> or <span className="font-bold text-slate-700">double</span>.</div>
            <div>• <span className="font-semibold text-slate-700">description</span> — optional note (e.g. Lab Manual, Assignment).</div>
            <div>• Posts as <span className="font-semibold text-emerald-800">Student AR Dr / Service Income Cr</span>, calculated with live print rates.</div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Upload Form */}
        {!result && (
          <form onSubmit={handleSubmit} className="space-y-4">
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
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Revenue Account
              </label>
              <select
                value={selectedRevenueAccountId}
                onChange={(e) => setSelectedRevenueAccountId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
              >
                {revenueAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !csvFile}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? 'Posting Transactions...' : 'Upload & Post Transactions'}
              </button>
            </div>
          </form>
        )}

        {/* Results Summary */}
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Total Rows</div>
                <div className="text-lg font-black text-slate-900 font-mono mt-0.5">{result.totalRows}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <div className="text-[10px] text-emerald-700 font-bold uppercase">Successful</div>
                <div className="text-lg font-black text-emerald-800 font-mono mt-0.5">{result.successCount}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <div className="text-[10px] text-red-700 font-bold uppercase">Failed</div>
                <div className="text-lg font-black text-red-800 font-mono mt-0.5">{result.failureCount}</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="text-[10px] text-blue-700 font-bold uppercase">Total Revenue</div>
                <div className="text-lg font-black text-blue-900 font-mono mt-0.5">₹{result.totalRevenue.toFixed(2)}</div>
              </div>
            </div>

            {/* Results Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Student (Name & Phone)</th>
                    <th className="p-2.5">Print Details</th>
                    <th className="p-2.5 text-right">Amount</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.rowResults.map((row) => (
                    <tr key={row.rowNumber} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2.5 text-slate-500 font-mono">{row.rowNumber}</td>
                      <td className="p-2.5 font-sans">
                        <div className="font-bold text-slate-900">
                          {row.resolvedName ? row.resolvedName : <span className="text-slate-400 italic font-normal">Unmatched</span>}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">{row.phone}</div>
                      </td>
                      <td className="p-2.5 font-sans text-slate-600">
                        {row.printPages} pgs · {row.printType.toUpperCase()} {row.printSide}
                      </td>
                      <td className="p-2.5 text-right font-bold font-mono">
                        ₹{row.amount.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-center">
                        {row.status === 'success' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Success
                          </span>
                        ) : (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200"
                            title={row.error}
                          >
                            {row.error || 'Failed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
