// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useRealtimeMultiSync } from '@/hooks/useRealtimeSync';
import { motion, AnimatePresence } from 'framer-motion';
import SearchableBatchSelect from '@/components/SearchableBatchSelect';
import AddStudentModal from '@/components/AddStudentModal';
import BulkDebitTransactionModal from '@/components/BulkDebitTransactionModal';
import ConfirmModal from '@/components/ConfirmModal';
import { Batch } from '@/types/database.types';
import { getBatches } from '@/services/batchService';
import { getChartOfAccounts } from '@/services/accountingService';
import {
  getStudents,
  StudentWithDetails,
  updateStudent,
  archiveStudent,
  restoreStudent,
} from '@/services/studentService';
import {
  postDebitEntries,
  postCreditEntries,
  generateWhatsAppLink,
} from '@/services/ledgerService';
import { PRINTING_RATES, calculatePrintAmount, PrintTypeOption, PrintSideOption } from '@/config/printingRates';
import { Account } from '@/types/database.types';
import { createClient } from '@/lib/supabase/client';
import { isGuestMode, getDemoStudentStatement } from '@/lib/demo/demoStore';
import { getValidSessionUser, SessionUserInfo } from '@/services/authService';

export default function DebitBookPage() {
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<SessionUserInfo | null>(null);

  useEffect(() => {
    async function loadUser() {
      const user = await getValidSessionUser();
      setSessionUser(user);
    }
    loadUser();
  }, []);

  // Filters & Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');

  // Modals
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isBulkDebitModalOpen, setIsBulkDebitModalOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [statementStudent, setStatementStudent] = useState<StudentWithDetails | null>(null);

  // Edit Modal State
  const [editingStudent, setEditingStudent] = useState<StudentWithDetails | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBatchId, setEditBatchId] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Archive Confirmation Modal State
  const [archiveTargetStudent, setArchiveTargetStudent] = useState<StudentWithDetails | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Entry Form State
  const [entryMode, setEntryMode] = useState<'debit' | 'credit'>('debit');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  // Debit Form Fields
  const [printType, setPrintType] = useState<PrintTypeOption>('bw');
  const [side, setSide] = useState<PrintSideOption>('single');
  const [numPages, setNumPages] = useState<number>(1);
  const [description, setDescription] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [paidImmediately, setPaidImmediately] = useState<boolean>(false);
  const [revenueAccounts, setRevenueAccounts] = useState<Account[]>([]);
  const [selectedRevenueAccountId, setSelectedRevenueAccountId] = useState<string>('');

  // Credit Form Fields
  const [creditAmount, setCreditAmount] = useState<number>(10);
  const [creditDescription, setCreditDescription] = useState<string>('Cash payment received');

  const [submitting, setSubmitting] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [entrySuccess, setEntrySuccess] = useState<string | null>(null);

  // Group Action State
  const [groupBatchFilter, setGroupBatchFilter] = useState<string>('all');

  const fetchDirectory = async () => {
    setLoading(true);
    const list = await getStudents({ status: statusFilter, search: searchTerm });
    setStudents(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchDirectory();
  }, [statusFilter, searchTerm]);

  useRealtimeMultiSync({
    channelName: 'admin-debit-book-sync',
    tables: ['students', 'journal_entries', 'journal_entry_lines', 'batches', 'accounts'],
    onDataChange: () => {
      fetchDirectory();
    },
  });

  useEffect(() => {
    async function loadBatchesAndAccounts() {
      const bList = await getBatches();
      setBatches(bList);

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
    loadBatchesAndAccounts();
  }, []);

  // Compute Total Receivable across all student account balances
  const totalReceivable = students.reduce((acc, s) => acc + (s.balance > 0 ? s.balance : 0), 0);

  // Auto-calculated amount for DEBIT mode
  const calcDebit = calculatePrintAmount(printType, side, numPages, discount);

  // Group Action: Select all active students or filter by batch
  const handleGroupSelect = (batchId: string) => {
    setGroupBatchFilter(batchId);
    if (batchId === 'all') {
      const allActive = students.filter((s) => s.status === 'active').map((s) => s.id);
      setSelectedStudentIds(allActive);
    } else {
      const matched = students.filter((s) => s.status === 'active' && s.batch_id === batchId).map((s) => s.id);
      setSelectedStudentIds(matched);
    }
    setIsEntryModalOpen(true);
  };

  // Toggle student selection in entry modal
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // Submit Debit / Credit Entry
  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      setEntryError('Please select at least one student.');
      return;
    }

    setSubmitting(true);
    setEntryError(null);
    setEntrySuccess(null);

    try {
      const isIncharge = sessionUser?.role === 'incharge';
      const staffName = sessionUser?.inchargeName || 'Workforce Member';

      if (entryMode === 'debit') {
        const baseDesc = description || `Print (${printType.toUpperCase()} ${side}, ${numPages} pages)`;
        const finalDesc = paidImmediately && isIncharge && !baseDesc.includes('collected by')
          ? `${baseDesc} — collected by ${staffName}`
          : baseDesc;

        const res = await postDebitEntries({
          studentIds: selectedStudentIds,
          printType,
          side,
          numPages,
          description: finalDesc,
          discount,
          paidImmediately,
          useInchargeCashAccount: isIncharge,
          revenueAccountId: selectedRevenueAccountId,
        });

        if (res.success) {
          setEntrySuccess(`Successfully posted debit entries for ${res.totalPosted} student(s)!`);
          setTimeout(() => {
            setIsEntryModalOpen(false);
            fetchDirectory();
          }, 1200);
        } else {
          setEntryError(res.error || 'Failed to post debit entries.');
        }
      } else {
        // Credit mode
        const baseDesc = creditDescription || 'Cash Payment';
        const finalDesc = isIncharge && !baseDesc.includes('collected by')
          ? `${baseDesc} — collected by ${staffName}`
          : baseDesc;

        const res = await postCreditEntries({
          studentIds: selectedStudentIds,
          amount: creditAmount,
          description: finalDesc,
          useInchargeCashAccount: isIncharge,
        });

        if (res.success) {
          setEntrySuccess(`Successfully posted credit payments for ${res.totalPosted} student(s)!`);
          setTimeout(() => {
            setIsEntryModalOpen(false);
            fetchDirectory();
          }, 1200);
        } else {
          setEntryError(res.error || 'Failed to post credit payments.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Entry submission failed.';
      setEntryError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Student Ledger Statement Modal Data
  const [statementLines, setStatementLines] = useState<
    { id: string; date: string; description: string; debit: number; credit: number }[]
  >([]);

  const handleOpenStatement = async (student: StudentWithDetails) => {
    setStatementStudent(student);
    if (isGuestMode()) {
      const demoStatement = getDemoStudentStatement(student.id);
      setStatementLines(
        demoStatement.transactions.map((t) => ({
          id: t.id,
          date: t.date,
          description: t.description,
          debit: t.debit,
          credit: t.credit,
        }))
      );
      return;
    }

    if (student.account_id) {
      const supabase = createClient();
      let { data: lines, error } = await supabase
        .from('journal_entry_lines')
        .select('id, debit_amount, credit_amount, journal_entries!inner(date, description, voided_at)')
        .eq('account_id', student.account_id)
        .is('journal_entries.voided_at', null);

      if (error && (error as { code?: string }).code === '42703') {
        const fallback = await supabase
          .from('journal_entry_lines')
          .select('id, debit_amount, credit_amount, journal_entries(date, description)')
          .eq('account_id', student.account_id);
        lines = fallback.data as typeof lines;
      }

      const formatted = (lines || []).map((l) => {
        const entryHeader = l.journal_entries as unknown as { date: string; description: string } | null;
        return {
          id: l.id,
          date: entryHeader?.date ? new Date(entryHeader.date).toLocaleDateString() : 'N/A',
          description: entryHeader?.description || 'Transaction',
          debit: Number(l.debit_amount) || 0,
          credit: Number(l.credit_amount) || 0,
        };
      });
      setStatementLines(formatted);
    }
  };

  // Handle Edit Save
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setEditSaving(true);
    await updateStudent(editingStudent.id, { name: editName, phone: editPhone, batch_id: editBatchId });
    setEditSaving(false);
    setEditingStudent(null);
    fetchDirectory();
  };

  const filteredStudentsForModal = students.filter(
    (s) =>
      s.status === 'active' &&
      (s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
        s.phone.includes(studentSearchTerm))
  );

  return (
    <>
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-5 sm:py-8 space-y-4 sm:space-y-6 flex-1 pb-24">
        {/* TOP SUMMARY BOX: TOTAL RECEIVABLE */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Total Outstanding Receivable
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 sm:mt-1">
              Sum of all active student account debit balances across the double-entry ledger.
            </p>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl sm:rounded-2xl px-3.5 py-2.5 sm:px-6 sm:py-3.5 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shadow-2xs self-stretch sm:self-auto shrink-0">
            <span className="text-[11px] font-mono text-slate-600 uppercase font-semibold">
              Total Receivable
            </span>
            <span className="text-xl sm:text-3xl lg:text-4xl font-black text-emerald-700 font-mono tracking-tight">
              <span className="font-sans font-black mr-0.5">₹</span>
              <span className="font-mono">{totalReceivable.toFixed(2)}</span>
            </span>
          </div>
        </div>

        {/* CONTROLS BAR: SEARCH, ACTIVE/ARCHIVED TOGGLE, GROUP ACTION */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search student name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Active vs Archived Toggle */}
            <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'active' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('archived')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'archived' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                Archived
              </button>
            </div>
          </div>

          {/* GROUP ACTION & ADD STUDENT BUTTONS */}
          <div className="flex flex-1 md:flex-initial items-center gap-3 min-w-0">
            {/* Group Action Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-xl shrink-0">
              <span className="text-[11px] font-semibold text-slate-600 px-1.5 whitespace-nowrap">Group Action:</span>
              <button
                type="button"
                onClick={() => handleGroupSelect('all')}
                className="bg-white hover:bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border border-slate-200 whitespace-nowrap shadow-xs"
              >
                All Students
              </button>

              <div className="w-32 sm:w-36">
                <SearchableBatchSelect
                  batches={batches}
                  selectedBatchId={groupBatchFilter === 'all' ? '' : groupBatchFilter}
                  onChange={(bId) => {
                    if (bId) {
                      handleGroupSelect(bId);
                    }
                  }}
                  placeholder="Select Batch..."
                  allowManagement={false}
                  size="sm"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsBulkDebitModalOpen(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Bulk CSV Entry
            </button>

            <button
              type="button"
              onClick={() => setIsAddStudentOpen(true)}
              className="flex-1 max-w-[180px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              + Student
            </button>
          </div>
        </div>

        {/* STUDENT LEDGER LIST TABLE */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
              Loading ledger data...
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No students found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-mono uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Student Name</th>
                    <th className="p-4">Batch</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4 text-right">Balance</th>
                    <th className="p-4 text-center min-w-[220px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      {/* Clickable Name for Statement View */}
                      <td className="p-4 font-sans font-semibold">
                        <button
                          type="button"
                          onClick={() => handleOpenStatement(student)}
                          className="text-emerald-700 hover:text-emerald-900 hover:underline text-left flex items-center gap-2"
                        >
                          <span className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[10px] text-emerald-700 font-bold">
                            {student.name.charAt(0)}
                          </span>
                          <span>{student.name}</span>
                        </button>
                      </td>

                      <td className="p-4 text-slate-700 whitespace-nowrap">{student.batch_name}</td>
                      <td className="p-4 text-slate-500 whitespace-nowrap">{student.phone}</td>

                      <td className="p-4 text-right font-bold whitespace-nowrap">
                        <span className="font-sans text-emerald-700 font-bold mr-0.5">₹</span>
                        <span className="font-mono text-slate-900">{student.balance.toFixed(2)}</span>
                      </td>

                      <td className="p-4 min-w-[220px]">
                        <div className="flex items-center justify-center gap-1.5 font-sans flex-wrap sm:flex-nowrap">
                          {student.status === 'active' ? (
                            <>
                              {/* Remind via WhatsApp Button */}
                              {(() => {
                                const isOverdue = student.balance > 0;
                                return (
                                  <a
                                    href={isOverdue && student.phone ? `https://wa.me/91${student.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`നമസ്കാരം ${student.name}, ലാബിൽ നിന്നുള്ള ഓർമ്മപ്പെടുത്തൽ സന്ദേശമാണിത്. നിങ്ങളുടെ ലാബ് പ്രിന്റ് ഇനത്തിൽ ₹${student.balance.toFixed(2)} രൂപ കുടിശ്ശികയുണ്ട്. ദയവായി ഈ തുക എത്രയും വേഗം അടച്ചു തീർക്കുക. നന്ദി.`)}` : '#'}
                                    target={isOverdue && student.phone ? "_blank" : undefined}
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                      if (!isOverdue || !student.phone) e.preventDefault();
                                    }}
                                    aria-disabled={!isOverdue || !student.phone}
                                    className={`font-semibold px-2.5 py-1.5 rounded-lg text-[11px] transition-all shadow-sm flex items-center gap-1.5 shrink-0 ${
                                      isOverdue && student.phone
                                        ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300'
                                        : 'text-gray-400 bg-gray-100 border border-gray-200 opacity-60 cursor-not-allowed'
                                    }`}
                                    title={!student.phone ? 'No phone number' : !isOverdue ? 'No pending balance' : 'Send WhatsApp Reminder'}
                                  >
                                    <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12.031 2c-5.514 0-9.998 4.486-9.998 10.001 0 1.764.462 3.486 1.341 5.008l-1.424 5.201 5.321-1.396c1.472.804 3.136 1.228 4.76 1.228h.004c5.513 0 9.998-4.486 9.998-10.001 0-2.67-1.039-5.181-2.928-7.071-1.888-1.888-4.401-2.928-7.072-2.928zm0 1.636c4.612 0 8.362 3.75 8.362 8.365 0 2.234-.868 4.335-2.448 5.914-1.579 1.579-3.68 2.448-5.913 2.448h-.003c-1.393 0-2.812-.37-4.053-1.07l-.29-.163-3.007.789.803-2.932-.178-.284c-.767-1.228-1.173-2.651-1.173-4.103 0-4.615 3.75-8.364 8.362-8.364z" />
                                    </svg>
                                    WhatsApp
                                  </a>
                                );
                              })()}

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStudent(student);
                                  setEditName(student.name);
                                  setEditPhone(student.phone);
                                  setEditBatchId(student.batch_id);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold border border-slate-200 transition-colors whitespace-nowrap shrink-0"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => setArchiveTargetStudent(student)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                await restoreStudent(student.id);
                                fetchDirectory();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* STICKY, CENTERED "Debit / Credit" BUTTON FIXED TO BOTTOM OF VIEWPORT */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            setEntryError(null);
            setEntrySuccess(null);
            setIsEntryModalOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm px-8 py-3.5 rounded-full shadow-xl flex items-center gap-3 border border-emerald-500 transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>Debit / Credit</span>
        </button>
      </div>

      {/* ENTRY FORM MODAL (DEBIT OR CREDIT) */}
      <AnimatePresence>
        {isEntryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* 1. FIXED HEADER */}
              <div className="p-5 sm:p-6 border-b border-slate-200 flex justify-between items-center shrink-0 bg-white">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Post Journal Entry</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generate double-entry ledger entries for selected students.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* 2. SCROLLABLE BODY FORM */}
              <form onSubmit={handleEntrySubmit} className="flex flex-col min-h-0 flex-1">
                <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar space-y-5 flex-1">
                  {entryError && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                      {entryError}
                    </div>
                  )}

                  {entrySuccess && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold">
                      {entrySuccess}
                    </div>
                  )}

                  {/* 1. Student Selector with Search-First & Compact Selected List */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-semibold text-slate-700">
                        Select Student(s) ({selectedStudentIds.length} selected)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const allActive = students.filter((s) => s.status === 'active').map((s) => s.id);
                          if (selectedStudentIds.length === allActive.length) setSelectedStudentIds([]);
                          else setSelectedStudentIds(allActive);
                        }}
                        className="text-xs text-emerald-700 hover:underline font-semibold"
                      >
                        {selectedStudentIds.length > 0 ? 'Deselect All' : 'Select All Active'}
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Type student name or phone to search..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />

                    {/* SEARCH RESULTS LIST (When typing search term) */}
                    {studentSearchTerm.trim() !== '' ? (
                      <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1 divide-y divide-slate-200 no-scrollbar">
                        {filteredStudentsForModal.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-500">No matching students found</div>
                        ) : (
                          filteredStudentsForModal.map((s) => {
                            const isSelected = selectedStudentIds.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => toggleStudentSelection(s.id)}
                                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors flex justify-between items-center ${
                                  isSelected
                                    ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200'
                                    : 'text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <span>{s.name} ({s.batch_name})</span>
                                <span className="text-[11px] font-mono">₹{s.balance.toFixed(2)}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : selectedStudentIds.length > 0 ? (
                      /* COMPACT SELECTED STUDENTS LIST (When no search term active) */
                      <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1 no-scrollbar">
                        <div className="text-[11px] font-semibold text-slate-500 px-2 pb-1 border-b border-slate-200 flex justify-between items-center">
                          <span>Selected ({selectedStudentIds.length})</span>
                          <span className="text-[10px] text-slate-400">Search above to add more</span>
                        </div>
                        {students
                          .filter((s) => selectedStudentIds.includes(s.id))
                          .map((s) => (
                            <div
                              key={s.id}
                              className="px-3 py-1.5 text-xs rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex justify-between items-center"
                            >
                              <span className="font-semibold">{s.name} ({s.batch_name})</span>
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-mono opacity-80">₹{s.balance.toFixed(2)}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleStudentSelection(s.id)}
                                  className="text-slate-400 hover:text-red-600 text-xs px-1 font-bold"
                                  title="Remove student"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      /* EMPTY INITIAL STATE */
                      <div className="p-3.5 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center text-xs text-slate-500 font-medium">
                        Type a student name or phone above to search...
                      </div>
                    )}
                  </div>

                  {/* 2. Toggle: DEBIT or CREDIT */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">Entry Type</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setEntryMode('debit')}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                          entryMode === 'debit'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        DEBIT
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntryMode('credit')}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                          entryMode === 'credit'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        CREDIT
                      </button>
                    </div>
                  </div>

                  {/* MODE A: DEBIT (SERVICE GIVEN) */}
                  {entryMode === 'debit' && (
                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Print Type
                          </label>
                          <select
                            value={printType}
                            onChange={(e) => setPrintType(e.target.value as PrintTypeOption)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                          >
                            <option value="bw">B/W (₹{PRINTING_RATES.bw_single} - ₹{PRINTING_RATES.bw_double}/pg)</option>
                            <option value="color">Color (₹{PRINTING_RATES.color_single} - ₹{PRINTING_RATES.color_double}/pg)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Side
                          </label>
                          <select
                            value={side}
                            onChange={(e) => setSide(e.target.value as PrintSideOption)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                          >
                            <option value="single">Single Side</option>
                            <option value="double">Double Side</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Number of Pages
                          </label>
                          <input
                            type="number"
                            min="1"
                            required
                            placeholder="Enter pages..."
                            value={numPages === 0 ? '' : numPages}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setNumPages(0);
                              } else {
                                const parsed = parseInt(val, 10);
                                setNumPages(isNaN(parsed) ? 0 : parsed);
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Discount (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="0"
                            value={discount === 0 ? '' : discount}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setDiscount(0);
                              } else {
                                const parsed = parseFloat(val);
                                setDiscount(isNaN(parsed) ? 0 : parsed);
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Thesis printing or Assignment pages"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Revenue Account
                        </label>
                        <select
                          value={selectedRevenueAccountId}
                          onChange={(e) => setSelectedRevenueAccountId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                        >
                          {revenueAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Paid in Cash Immediately Toggle Card */}
                      <div
                        onClick={() => setPaidImmediately(!paidImmediately)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                          paidImmediately
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                              paidImmediately
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-white border-slate-300 text-transparent'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <span className={`text-xs font-bold transition-colors ${paidImmediately ? 'text-emerald-900' : 'text-slate-800'}`}>
                              Paid in Cash Immediately
                            </span>
                            <span className="text-[11px] text-slate-500 block font-mono">
                              {paidImmediately
                                ? 'Lab Cash Dr / Revenue Cr (No student debt)'
                                : 'Student AR Dr / Revenue Cr (Owed by student)'}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg font-mono uppercase tracking-wider shrink-0 transition-colors ${
                            paidImmediately
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {paidImmediately ? 'Cash Sale' : 'On Credit'}
                        </span>
                      </div>

                      {/* Auto-Calculated Amount Box */}
                      <div className="bg-white border border-emerald-200 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <span className="text-xs font-mono text-slate-600">
                          Rate: <span className="font-sans">₹</span><span className="font-mono">{calcDebit.ratePerPage.toFixed(2)}</span>/pg × {numPages} pgs − <span className="font-sans">₹</span><span className="font-mono">{discount}</span> disc
                        </span>
                        <span className="text-lg font-black text-emerald-700 font-mono">
                          Total: <span className="font-sans">₹</span><span className="font-mono">{calcDebit.totalAmount.toFixed(2)}</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* MODE B: CREDIT (PAYMENT RECEIVED) */}
                  {entryMode === 'credit' && (
                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Payment Amount (₹)
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          placeholder="Enter amount..."
                          value={creditAmount === 0 ? '' : creditAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setCreditAmount(0);
                            } else {
                              const parsed = parseFloat(val);
                              setCreditAmount(isNaN(parsed) ? 0 : parsed);
                            }
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Payment Description
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Cash payment received"
                          value={creditDescription}
                          onChange={(e) => setCreditDescription(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. PINNED FIXED FOOTER */}
                <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 shrink-0 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEntryModalOpen(false)}
                    className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold py-3 rounded-xl text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl text-xs shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  >
                    {submitting ? 'Posting Entries...' : `Post ${entryMode.toUpperCase()} Entry`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* STUDENT STATEMENT MODAL */}
      {statementStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{statementStudent.name}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  Batch: {statementStudent.batch_name} • Phone: {statementStudent.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatementStudent(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-mono">Current Ledger Balance</span>
              <span className="text-xl font-bold text-emerald-700 font-mono flex items-center gap-0.5">
                <span className="font-sans font-bold">₹</span>
                <span className="font-mono font-bold">{statementStudent.balance.toFixed(2)}</span>
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-right">Debit</th>
                    <th className="p-2.5 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {statementLines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">No transactions recorded.</td>
                    </tr>
                  ) : (
                    statementLines.map((l) => (
                      <tr key={l.id}>
                        <td className="p-2.5 text-slate-500">{l.date}</td>
                        <td className="p-2.5 text-slate-800 font-sans">{l.description}</td>
                        <td className="p-2.5 text-right text-emerald-700">
                          {l.debit > 0 ? (
                            <span className="inline-flex items-center justify-end gap-0.5 font-mono">
                              <span className="font-sans font-semibold">₹</span>
                              <span className="font-mono">{l.debit.toFixed(2)}</span>
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-2.5 text-right text-blue-700">
                          {l.credit > 0 ? (
                            <span className="inline-flex items-center justify-end gap-0.5 font-mono">
                              <span className="font-sans font-semibold">₹</span>
                              <span className="font-mono">{l.credit.toFixed(2)}</span>
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setStatementStudent(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold px-4 py-2 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">Edit Student</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              />
              <input
                type="tel"
                required
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              />
              <SearchableBatchSelect
                batches={batches}
                selectedBatchId={editBatchId}
                onChange={(bId) => setEditBatchId(bId)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-xl text-xs font-semibold shadow-xs"
                >
                  {editSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AddStudentModal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        onStudentAdded={fetchDirectory}
      />

      <BulkDebitTransactionModal
        isOpen={isBulkDebitModalOpen}
        onClose={() => setIsBulkDebitModalOpen(false)}
        onTransactionsPosted={fetchDirectory}
      />

      {/* Responsive Confirmation Modal for Soft Archive */}
      <ConfirmModal
        isOpen={!!archiveTargetStudent}
        title="Soft Archive Student"
        message={`Are you sure you want to soft-archive "${archiveTargetStudent?.name}"? Their double-entry ledger history and balance will remain permanently preserved.`}
        confirmLabel="Archive Student"
        cancelLabel="Keep Active"
        variant="danger"
        loading={archiveLoading}
        onCancel={() => setArchiveTargetStudent(null)}
        onConfirm={async () => {
          if (!archiveTargetStudent) return;
          setArchiveLoading(true);
          await archiveStudent(archiveTargetStudent.id);
          setArchiveLoading(false);
          setArchiveTargetStudent(null);
          fetchDirectory();
        }}
      />
    </>
  );
}
