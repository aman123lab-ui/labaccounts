'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import AdminAuthGuard from '@/components/AdminAuthGuard';
import { Account, AccountType, Batch } from '@/types/database.types';
import { getChartOfAccounts, createAccount, postJournalEntry } from '@/services/accountingService';
import { getStudents, StudentWithDetails } from '@/services/studentService';
import { getBatches } from '@/services/batchService';
import SearchableAccountSelect from '@/components/SearchableAccountSelect';
import CustomDateInput from '@/components/CustomDateInput';
import AddStudentModal from '@/components/AddStudentModal';
import { getValidSessionUser, SessionUserInfo } from '@/services/authService';

export default function IncomeExpensePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [entryType, setEntryType] = useState<'income' | 'expense'>('expense');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [creditType, setCreditType] = useState<'single_student' | 'multi_student' | 'general'>('single_student');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [distributionMode, setDistributionMode] = useState<'equal_split' | 'each' | 'custom'>('equal_split');
  const [studentCustomAmounts, setStudentCustomAmounts] = useState<Record<string, string>>({});
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>('');
  const [sessionUser, setSessionUser] = useState<SessionUserInfo | null>(null);

  useEffect(() => {
    async function loadUser() {
      const user = await getValidSessionUser();
      setSessionUser(user);
    }
    loadUser();
  }, []);

  // Students & Batches for Credit transactions
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState<boolean>(false);

  // Status & Feedback State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Quick Modals State
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);
  const [newAccountName, setNewAccountName] = useState<string>('');
  const [creatingAccount, setCreatingAccount] = useState<boolean>(false);
  const [addAccountError, setAddAccountError] = useState<string | null>(null);
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);

  // Load Chart of Accounts
  const loadAccounts = async () => {
    try {
      setLoading(true);
      const list = await getChartOfAccounts();
      setAccounts(list);
    } catch (err: unknown) {
      console.error('Failed to load accounts:', err);
      setError('Failed to load chart of accounts.');
    } finally {
      setLoading(false);
    }
  };

  // Load Active Students for Credit counterparty selection
  // Load Active Students for Credit counterparty selection
  const loadStudents = async () => {
    try {
      setLoadingStudents(true);
      const list = await getStudents({ status: 'active' });
      setStudents(list);
    } catch (err: unknown) {
      console.error('Failed to load students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  // Load Batches for grouping and filtering students
  const loadBatches = async () => {
    try {
      setLoadingBatches(true);
      const list = await getBatches();
      setBatches(list);
    } catch (err: unknown) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    loadStudents();
    loadBatches();
  }, []);

  // Filter accounts based on entry type (revenue vs expense)
  const filteredCategoryAccounts = useMemo(() => {
    if (entryType === 'income') {
      return accounts.filter((a) => a.type === 'revenue');
    } else {
      return accounts.filter((a) => a.type === 'expense');
    }
  }, [accounts, entryType]);

  // Set default account when entry type changes if current selection is invalid
  useEffect(() => {
    if (filteredCategoryAccounts.length > 0) {
      const isSelectedValid = filteredCategoryAccounts.some((a) => a.id === selectedAccountId);
      if (!isSelectedValid) {
        setSelectedAccountId(filteredCategoryAccounts[0].id);
      }
    } else {
      setSelectedAccountId('');
    }
  }, [entryType, filteredCategoryAccounts, selectedAccountId]);

  // Dynamic system account resolvers
  const cashAccount = useMemo(() => {
    const isIncharge = sessionUser?.role === 'incharge';
    if (isIncharge) {
      const inchargeAcc = accounts.find(
        (a) =>
          a.type === 'asset' &&
          (a.name.toLowerCase().includes('cash in hand (in-charge)') ||
            a.name.toLowerCase().includes('cash in hand (workforce)') ||
            (sessionUser?.inchargeName && a.name.toLowerCase().includes(sessionUser.inchargeName.toLowerCase())))
      ) || accounts.find((a) => a.id === '10000000-0000-0000-0000-000000000003');
      if (inchargeAcc) return inchargeAcc;
    }

    return (
      accounts.find((a) => a.id === '10000000-0000-0000-0000-000000000001') ||
      accounts.find(
        (a) =>
          a.type === 'asset' &&
          !a.is_student_account &&
          a.name.toLowerCase().includes('cash') &&
          !a.name.toLowerCase().includes('in-charge') &&
          !a.name.toLowerCase().includes('workforce')
      ) ||
      accounts.find((a) => a.type === 'asset' && !a.is_student_account)
    );
  }, [accounts, sessionUser]);

  const payableAccount = useMemo(() => {
    return (
      accounts.find((a) => a.id === '20000000-0000-0000-0000-000000000001') ||
      accounts.find((a) => a.type === 'liability' && a.name.toLowerCase().includes('payable')) ||
      accounts.find((a) => a.type === 'liability')
    );
  }, [accounts]);

  const receivableOtherAccount = useMemo(() => {
    return (
      accounts.find((a) => a.name.toLowerCase().includes('accounts receivable (other)')) ||
      accounts.find((a) => a.type === 'asset' && !a.is_student_account && a.name.toLowerCase().includes('receivable')) ||
      accounts.find((a) => a.id === '10000000-0000-0000-0000-000000000002') ||
      accounts.find((a) => a.type === 'asset' && !a.is_student_account)
    );
  }, [accounts]);

  // Helper to reliably find a student's AR/Account ID
  const getStudentAccountId = (studentId: string): string => {
    const st = students.find((s) => s.id === studentId);
    if (st?.account_id) return st.account_id;
    const match = accounts.find((a) => a.student_id === studentId);
    if (match) return match.id;
    const fallbackAR = accounts.find(
      (a) => a.type === 'asset' && a.name.toLowerCase().includes('student accounts receivable')
    );
    return fallbackAR?.id || '';
  };

  // Filtered students for credit counterparty search & batch selection
  const filteredStudents = useMemo(() => {
    let list = students;
    if (selectedBatchFilter !== 'all') {
      list = list.filter((s) => s.batch_id === selectedBatchFilter);
    }
    if (!studentSearch.trim()) return list;
    const term = studentSearch.toLowerCase();
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.phone.toLowerCase().includes(term) ||
        (s.batch_name && s.batch_name.toLowerCase().includes(term))
    );
  }, [students, studentSearch, selectedBatchFilter]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  const selectedStudentAccountId = useMemo(() => {
    if (!selectedStudent) return '';
    return getStudentAccountId(selectedStudent.id);
  }, [selectedStudent, accounts, students]);

  // Multi-student helpers
  const toggleStudentSelection = (stId: string) => {
    setSelectedStudentIds((prev) => {
      const exists = prev.includes(stId);
      if (exists) {
        return prev.filter((id) => id !== stId);
      } else {
        return [...prev, stId];
      }
    });
    // If selecting student while in custom mode and amount is not set, initialize it
    if (distributionMode === 'custom' && !studentCustomAmounts[stId]) {
      const defaultVal = amount ? amount : '';
      setStudentCustomAmounts((prev) => ({
        ...prev,
        [stId]: prev[stId] ?? defaultVal,
      }));
    }
  };

  const handleCustomAmountChange = (stId: string, val: string) => {
    setStudentCustomAmounts((prev) => ({
      ...prev,
      [stId]: val,
    }));
  };

  const handleDistributionModeChange = (mode: 'equal_split' | 'each' | 'custom') => {
    setDistributionMode(mode);
    if (mode === 'custom') {
      // Pre-fill each selected student with equal split or current amount if not already set
      const parsed = parseFloat(amount) || 0;
      const count = selectedStudentIds.length;
      const fallbackVal =
        distributionMode === 'equal_split' && count > 0
          ? (parsed / count).toFixed(2)
          : parsed > 0
          ? parsed.toString()
          : '';

      setStudentCustomAmounts((prev) => {
        const updated = { ...prev };
        selectedStudentIds.forEach((id) => {
          if (!updated[id]) {
            updated[id] = fallbackVal;
          }
        });
        return updated;
      });
    } else {
      // If switching from custom to equal_split or each, sync main amount if empty
      if (distributionMode === 'custom') {
        const customTotal = selectedStudentIds.reduce(
          (sum, id) => sum + (parseFloat(studentCustomAmounts[id]) || 0),
          0
        );
        if (customTotal > 0 && (!amount || parseFloat(amount) === 0)) {
          if (mode === 'equal_split') {
            setAmount(customTotal.toFixed(2));
          } else if (mode === 'each' && selectedStudentIds.length > 0) {
            setAmount((customTotal / selectedStudentIds.length).toFixed(2));
          }
        }
      }
    }
  };

  const selectAllFiltered = () => {
    const allFilteredIds = filteredStudents.map((s) => s.id);
    setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    if (distributionMode === 'custom') {
      const defaultVal = amount ? amount : '';
      setStudentCustomAmounts((prev) => {
        const updated = { ...prev };
        allFilteredIds.forEach((id) => {
          if (!updated[id]) updated[id] = defaultVal;
        });
        return updated;
      });
    }
  };

  const deselectAllFiltered = () => {
    const filteredSet = new Set(filteredStudents.map((s) => s.id));
    setSelectedStudentIds((prev) => prev.filter((id) => !filteredSet.has(id)));
  };

  // Compute live journal entry debit & credit lines for preview and submission
  const journalPreview = useMemo(() => {
    const parsedAmount = parseFloat(amount) || 0;
    const categoryAcc = accounts.find((a) => a.id === selectedAccountId);
    const categoryAccName = categoryAcc ? categoryAcc.name : '(Select Account)';

    let totalAmount = parsedAmount;
    let perStudentAmount = parsedAmount;

    if (paymentMethod === 'credit' && creditType === 'multi_student') {
      const count = selectedStudentIds.length;
      if (distributionMode === 'equal_split') {
        totalAmount = parsedAmount;
        perStudentAmount = count > 0 ? parsedAmount / count : 0;
      } else if (distributionMode === 'each') {
        totalAmount = parsedAmount * count;
        perStudentAmount = parsedAmount;
      } else {
        // 'custom': separate amount for each student
        totalAmount = selectedStudentIds.reduce((sum, id) => {
          const val = parseFloat(studentCustomAmounts[id]) || 0;
          return sum + val;
        }, 0);
        perStudentAmount = 0;
      }
    }

    let debitAccountName = '';
    let debitAccountId = '';
    let creditAccountName = '';
    let creditAccountId = '';

    if (entryType === 'income') {
      // Income Entry: Revenue is Credited
      creditAccountId = selectedAccountId;
      creditAccountName = categoryAccName;

      if (paymentMethod === 'cash') {
        debitAccountId = cashAccount?.id || '';
        debitAccountName = cashAccount?.name || 'Cash and Bank Account';
      } else if (creditType === 'single_student') {
        debitAccountId = selectedStudentAccountId;
        debitAccountName = selectedStudent
          ? `${selectedStudent.name} (${selectedStudent.batch_name || 'Student'}) - Student AR`
          : '(Choose Student)';
      } else if (creditType === 'multi_student') {
        debitAccountId = 'multi_student';
        if (distributionMode === 'custom') {
          debitAccountName = `${selectedStudentIds.length} Student AR Account(s) (Custom amounts totaling ₹${totalAmount.toFixed(2)})`;
        } else {
          debitAccountName = `${selectedStudentIds.length} Student AR Account(s) (${distributionMode === 'equal_split' ? '₹' + perStudentAmount.toFixed(2) + ' each' : '₹' + parsedAmount.toFixed(2) + ' each'})`;
        }
      } else {
        debitAccountId = receivableOtherAccount?.id || '';
        debitAccountName = receivableOtherAccount?.name || 'Accounts Receivable (Other)';
      }
    } else {
      // Expense Entry: Expense is Debited
      debitAccountId = selectedAccountId;
      debitAccountName = categoryAccName;

      if (paymentMethod === 'cash') {
        creditAccountId = cashAccount?.id || '';
        creditAccountName = cashAccount?.name || 'Cash and Bank Account';
      } else if (creditType === 'single_student') {
        creditAccountId = selectedStudentAccountId;
        creditAccountName = selectedStudent
          ? `${selectedStudent.name} (${selectedStudent.batch_name || 'Student'}) - Student Account`
          : '(Choose Student)';
      } else if (creditType === 'multi_student') {
        creditAccountId = 'multi_student';
        if (distributionMode === 'custom') {
          creditAccountName = `${selectedStudentIds.length} Student Account(s) (Custom amounts totaling ₹${totalAmount.toFixed(2)})`;
        } else {
          creditAccountName = `${selectedStudentIds.length} Student Account(s) (${distributionMode === 'equal_split' ? '₹' + perStudentAmount.toFixed(2) + ' each' : '₹' + parsedAmount.toFixed(2) + ' each'})`;
        }
      } else {
        creditAccountId = payableAccount?.id || '';
        creditAccountName = payableAccount?.name || 'Accounts Payable';
      }
    }

    const isSingleStudentInvalid =
      paymentMethod === 'credit' && creditType === 'single_student' && !selectedStudentAccountId;
    const isMultiStudentInvalid =
      paymentMethod === 'credit' &&
      creditType === 'multi_student' &&
      (selectedStudentIds.length === 0 ||
        selectedStudentIds.some((id) => !getStudentAccountId(id)) ||
        (distributionMode === 'custom' &&
          selectedStudentIds.some((id) => (parseFloat(studentCustomAmounts[id]) || 0) <= 0)));

    const isAmountValid =
      paymentMethod === 'credit' && creditType === 'multi_student' && distributionMode === 'custom'
        ? totalAmount > 0
        : parsedAmount > 0;

    return {
      debitAccountId,
      debitAccountName,
      creditAccountId,
      creditAccountName,
      baseAmount: parsedAmount,
      amount: totalAmount,
      perStudentAmount,
      isValid:
        isAmountValid &&
        Boolean(debitAccountId) &&
        Boolean(creditAccountId) &&
        !isSingleStudentInvalid &&
        !isMultiStudentInvalid,
    };
  }, [
    entryType,
    paymentMethod,
    creditType,
    selectedAccountId,
    amount,
    distributionMode,
    studentCustomAmounts,
    selectedStudentIds,
    accounts,
    cashAccount,
    payableAccount,
    receivableOtherAccount,
    selectedStudent,
    selectedStudentAccountId,
  ]);

  // Quick Create Account Handler
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;

    setCreatingAccount(true);
    setAddAccountError(null);

    const targetType: AccountType = entryType === 'income' ? 'revenue' : 'expense';

    try {
      const res = await createAccount(newAccountName.trim(), targetType);
      if (res.success && res.data) {
        await loadAccounts();
        setSelectedAccountId(res.data.id);
        setNewAccountName('');
        setShowAddAccountModal(false);
      } else {
        setAddAccountError(res.error || 'Failed to create account.');
      }
    } catch (err: unknown) {
      setAddAccountError(err instanceof Error ? err.message : 'Error creating account.');
    } finally {
      setCreatingAccount(false);
    }
  };

  // Submit Handler: Posts balanced journal entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (paymentMethod === 'credit' && creditType === 'single_student' && !selectedStudentId) {
      setError('Please choose a registered student for this credit entry.');
      return;
    }

    if (paymentMethod === 'credit' && creditType === 'multi_student' && selectedStudentIds.length === 0) {
      setError('Please select at least one student for this multi-student credit entry.');
      return;
    }

    if (!journalPreview.isValid) {
      setError('Please enter a valid amount, select a category account, and complete all required credit details.');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a description / note for this transaction.');
      return;
    }

    setSubmitting(true);

    let lines: { accountId: string; debit: number; credit: number }[] = [];

    if (paymentMethod === 'cash' || creditType === 'general' || creditType === 'single_student') {
      lines = [
        { accountId: journalPreview.debitAccountId, debit: journalPreview.amount, credit: 0 },
        { accountId: journalPreview.creditAccountId, debit: 0, credit: journalPreview.amount },
      ];
    } else if (creditType === 'multi_student') {
      const count = selectedStudentIds.length;
      if (distributionMode === 'custom') {
        const hasInvalidAmount = selectedStudentIds.some(
          (sId) => (parseFloat(studentCustomAmounts[sId]) || 0) <= 0
        );
        if (hasInvalidAmount) {
          setError('Please enter a valid amount (> 0) for each selected student.');
          setSubmitting(false);
          return;
        }

        if (entryType === 'income') {
          lines = selectedStudentIds.map((sId) => {
            const studentAmt = parseFloat(studentCustomAmounts[sId]) || 0;
            return {
              accountId: getStudentAccountId(sId),
              debit: Number(studentAmt.toFixed(2)),
              credit: 0,
            };
          });
          const totalDebitSum = lines.reduce((sum, l) => sum + l.debit, 0);
          lines.push({
            accountId: selectedAccountId,
            debit: 0,
            credit: Number(totalDebitSum.toFixed(2)),
          });
        } else {
          const studentLines = selectedStudentIds.map((sId) => {
            const studentAmt = parseFloat(studentCustomAmounts[sId]) || 0;
            return {
              accountId: getStudentAccountId(sId),
              debit: 0,
              credit: Number(studentAmt.toFixed(2)),
            };
          });
          const totalCreditSum = studentLines.reduce((sum, l) => sum + l.credit, 0);
          lines = [
            {
              accountId: selectedAccountId,
              debit: Number(totalCreditSum.toFixed(2)),
              credit: 0,
            },
            ...studentLines,
          ];
        }
      } else {
        const perStudentAmount =
          distributionMode === 'equal_split'
            ? Math.round((journalPreview.baseAmount / count) * 100) / 100
            : journalPreview.baseAmount;

        if (entryType === 'income') {
          lines = selectedStudentIds.map((sId) => ({
            accountId: getStudentAccountId(sId),
            debit: perStudentAmount,
            credit: 0,
          }));
          const totalDebitSum = lines.reduce((sum, l) => sum + l.debit, 0);
          lines.push({
            accountId: selectedAccountId,
            debit: 0,
            credit: Number(totalDebitSum.toFixed(2)),
          });
        } else {
          const studentLines = selectedStudentIds.map((sId) => ({
            accountId: getStudentAccountId(sId),
            debit: 0,
            credit: perStudentAmount,
          }));
          const totalCreditSum = studentLines.reduce((sum, l) => sum + l.credit, 0);
          lines = [
            {
              accountId: selectedAccountId,
              debit: Number(totalCreditSum.toFixed(2)),
              credit: 0,
            },
            ...studentLines,
          ];
        }
      }
    }

    try {
      const isIncharge = sessionUser?.role === 'incharge';
      const staffName = sessionUser?.inchargeName || 'Workforce Member';
      const baseDesc = description.trim();
      const finalDesc =
        isIncharge && entryType === 'income' && paymentMethod === 'cash' && !baseDesc.includes('collected by')
          ? `${baseDesc} — collected by ${staffName}`
          : baseDesc;

      const res = await postJournalEntry(lines, finalDesc, { date });
      if (res.success) {
        const studentSummary =
          creditType === 'multi_student'
            ? ` across ${selectedStudentIds.length} students`
            : creditType === 'single_student' && selectedStudent
            ? ` for ${selectedStudent.name}`
            : '';
        setSuccessMsg(
          `Successfully posted ${entryType.toUpperCase()} entry of ₹${journalPreview.amount.toFixed(2)}${studentSummary} to ledger!`
        );
        setAmount('');
        setDescription('');
        setSelectedStudentId('');
        setSelectedStudentIds([]);
        setStudentCustomAmounts({});
        setStudentSearch('');
        loadStudents();
      } else {
        setError(res.error || 'Failed to post entry.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while posting entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-4">
        <div className="max-w-2xl mx-auto space-y-4 pb-12">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Income & Expense Entry
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/admin/journal"
                className="bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <span>Journal Vouchers</span>
                <span className="text-slate-400 font-mono">→</span>
              </Link>
            </div>
          </div>

          {/* Global Feedback Banners */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                ✕
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center justify-between shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{successMsg}</span>
              </div>
              <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
                ✕
              </button>
            </div>
          )}

          {/* Main Entry Card (Compact & Balanced Container) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. TRANSACTION TYPE TOGGLE (Income vs Expense) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Transaction Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-slate-100/90 border border-slate-200 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEntryType('expense')}
                    className={`py-2.5 px-4 rounded-lg text-xs font-black tracking-wide uppercase transition-all flex items-center justify-center gap-2 ${
                      entryType === 'expense'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Expense Entry</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEntryType('income')}
                    className={`py-2.5 px-4 rounded-lg text-xs font-black tracking-wide uppercase transition-all flex items-center justify-center gap-2 ${
                      entryType === 'income'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Income Entry</span>
                  </button>
                </div>
              </div>

              {/* 2. ACCOUNT SELECTOR & "+ ADD ACCOUNT" QUICK CREATE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    2. Select {entryType === 'income' ? 'Revenue / Income' : 'Expense'} Account <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddAccountModal(true)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors shadow-2xs"
                  >
                    <span className="text-xs font-black leading-none">+</span> Add Account
                  </button>
                </div>

                {loading ? (
                  <div className="h-10 bg-slate-50 border border-slate-200 rounded-xl animate-pulse flex items-center px-3 text-xs text-slate-400">
                    Loading accounts...
                  </div>
                ) : (
                  <SearchableAccountSelect
                    accounts={filteredCategoryAccounts}
                    value={selectedAccountId}
                    onChange={(accId) => setSelectedAccountId(accId)}
                    placeholder={`Select ${entryType === 'income' ? 'Income' : 'Expense'} Account...`}
                  />
                )}
              </div>

              {/* 3. PAYMENT METHOD TOGGLE (Cash vs Credit) */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. Payment / Settlement Method <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                      paymentMethod === 'cash'
                        ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-50/80 border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base ${
                        paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      💵
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${paymentMethod === 'cash' ? 'text-slate-900' : 'text-slate-700'}`}>
                        Cash / Bank (Immediate)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit')}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                      paymentMethod === 'credit'
                        ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-slate-50/80 border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base ${
                        paymentMethod === 'credit' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      💳
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${paymentMethod === 'credit' ? 'text-slate-900' : 'text-slate-700'}`}>
                        Credit (On Account)
                      </div>
                    </div>
                  </button>
                </div>

                {/* Credit Counterparty Selector (Single Student vs Multi-Student / Batch vs General) */}
                {paymentMethod === 'credit' && (
                  <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 sm:space-y-3.5 animate-fadeIn">
                    <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-2.5">
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Credit Counterparty <span className="text-red-500">*</span>
                      </label>
                      {/* Segmented control for credit options */}
                      <div className="grid grid-cols-3 w-full rounded-xl bg-slate-200/80 p-1 text-[11px] font-bold gap-1">
                        <button
                          type="button"
                          onClick={() => setCreditType('single_student')}
                          className={`py-2 px-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                            creditType === 'single_student'
                              ? 'bg-white text-slate-900 shadow-xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span className="text-xs">🎓</span>
                          <span className="truncate">Single</span>
                          <span className="hidden md:inline"> Student</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCreditType('multi_student');
                            if (selectedStudentId && !selectedStudentIds.includes(selectedStudentId)) {
                              setSelectedStudentIds([selectedStudentId]);
                            }
                          }}
                          className={`py-2 px-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                            creditType === 'multi_student'
                              ? 'bg-white text-indigo-900 shadow-xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span className="text-xs">👥</span>
                          <span className="truncate">Multi / Batch</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreditType('general')}
                          className={`py-2 px-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                            creditType === 'general'
                              ? 'bg-white text-slate-900 shadow-xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span className="text-xs">🏢</span>
                          <span className="truncate">General</span>
                          <span className="hidden md:inline"> / Other</span>
                        </button>
                      </div>
                    </div>

                    {/* OPTION 1: SINGLE STUDENT SELECTION */}
                    {creditType === 'single_student' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-700">Choose Registered Student</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setShowAddStudentModal(true)}
                              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors shadow-2xs"
                            >
                              <span className="text-xs font-black leading-none">+</span> Add Student
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCreditType('multi_student');
                                if (selectedStudentId && !selectedStudentIds.includes(selectedStudentId)) {
                                  setSelectedStudentIds([selectedStudentId]);
                                }
                              }}
                              className="text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors shadow-2xs"
                            >
                              <span>👥 Multi-Student</span>
                            </button>
                          </div>
                        </div>

                        {loadingStudents ? (
                          <div className="h-10 bg-white border border-slate-200 rounded-xl animate-pulse flex items-center px-3 text-xs text-slate-400 font-mono">
                            Loading registered students...
                          </div>
                        ) : students.length === 0 ? (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
                            <span>No active registered students found in database.</span>
                            <button
                              type="button"
                              onClick={() => setShowAddStudentModal(true)}
                              className="font-bold underline text-amber-900 shrink-0"
                            >
                              + Register Student Now
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Filter controls: Batch Filter & Text Search */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* Batch Filter Dropdown */}
                              <div>
                                <select
                                  value={selectedBatchFilter}
                                  onChange={(e) => setSelectedBatchFilter(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                                >
                                  <option value="all">🎓 All Batches ({students.length} students)</option>
                                  {batches.map((b) => {
                                    const count = students.filter((s) => s.batch_id === b.id).length;
                                    return (
                                      <option key={b.id} value={b.id}>
                                        {b.name} ({b.category}) — {count} student(s)
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>

                              {/* Search input */}
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Search by name, phone..."
                                  value={studentSearch}
                                  onChange={(e) => setStudentSearch(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-7 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                                />
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                                  🔍
                                </span>
                                {studentSearch && (
                                  <button
                                    type="button"
                                    onClick={() => setStudentSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Student Dropdown */}
                            <select
                              value={selectedStudentId}
                              onChange={(e) => setSelectedStudentId(e.target.value)}
                              required={paymentMethod === 'credit' && creditType === 'single_student'}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                            >
                              <option value="">-- Select Student ({filteredStudents.length} available) --</option>
                              {filteredStudents.map((st) => (
                                <option key={st.id} value={st.id}>
                                  {st.name} ({st.batch_name || 'No Batch'}) — Ph: {st.phone} | Bal: ₹{st.balance.toFixed(2)}
                                </option>
                              ))}
                            </select>

                            {/* Selected Student Card */}
                            {selectedStudent && (
                              <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                                  <div className="truncate">
                                    <span className="text-xs font-bold text-slate-900 block truncate">
                                      {selectedStudent.name}
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      Batch: {selectedStudent.batch_name || 'Unassigned'} • Phone: {selectedStudent.phone}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                  <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                                    Live Bal: ₹{selectedStudent.balance.toFixed(2)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCreditType('multi_student');
                                      if (!selectedStudentIds.includes(selectedStudent.id)) {
                                        setSelectedStudentIds([selectedStudent.id]);
                                      }
                                    }}
                                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors"
                                  >
                                    + Add Another Student
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* OPTION 2: MULTI-STUDENT / BATCH SELECTION */}
                    {creditType === 'multi_student' && (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              Multi-Student / Batch Selection
                            </span>
                            <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                              {selectedStudentIds.length} Selected
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setShowAddStudentModal(true)}
                              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors shadow-2xs whitespace-nowrap"
                            >
                              <span className="text-xs font-black leading-none">+</span> Add Student
                            </button>
                            <button
                              type="button"
                              onClick={() => setCreditType('single_student')}
                              className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                            >
                              Single Student
                            </button>
                          </div>
                        </div>

                        {/* Batch Filter & Selection Actions */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <select
                              value={selectedBatchFilter}
                              onChange={(e) => setSelectedBatchFilter(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                            >
                              <option value="all">🎓 All Batches ({students.length} students)</option>
                              {batches.map((b) => {
                                const count = students.filter((s) => s.batch_id === b.id).length;
                                return (
                                  <option key={b.id} value={b.id}>
                                    {b.name} ({b.category}) — {count} student(s)
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={selectAllFiltered}
                              className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl py-2 px-2.5 text-xs font-bold transition-colors shadow-2xs text-center truncate"
                            >
                              Select All ({filteredStudents.length})
                            </button>
                            <button
                              type="button"
                              onClick={deselectAllFiltered}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold transition-colors"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {/* Search box */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search by student name or phone..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-7 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                          />
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                            🔍
                          </span>
                          {studentSearch && (
                            <button
                              type="button"
                              onClick={() => setStudentSearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Amount Distribution Mode */}
                        <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl flex flex-col gap-1.5 text-xs">
                          <span className="font-bold text-indigo-900">Distribution Mode:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 w-full bg-white p-1 border border-indigo-200 rounded-xl text-[11px] font-semibold">
                            <button
                              type="button"
                              onClick={() => handleDistributionModeChange('equal_split')}
                              className={`w-full py-1.5 px-2 rounded-lg text-center transition-all ${
                                distributionMode === 'equal_split'
                                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                                  : 'text-indigo-900 hover:bg-indigo-50'
                              }`}
                            >
                              Split Total ₹{amount || '0'} Equally
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDistributionModeChange('each')}
                              className={`w-full py-1.5 px-2 rounded-lg text-center transition-all ${
                                distributionMode === 'each'
                                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                                  : 'text-indigo-900 hover:bg-indigo-50'
                              }`}
                            >
                              Apply ₹{amount || '0'} to Each
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDistributionModeChange('custom')}
                              className={`w-full py-1.5 px-2 rounded-lg text-center transition-all ${
                                distributionMode === 'custom'
                                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                                  : 'text-indigo-900 hover:bg-indigo-50'
                              }`}
                            >
                              ✏️ Separate Amount for Each
                            </button>
                          </div>
                        </div>

                        {/* CONSOLIDATED STUDENT LEDGER SELECTION TABLE */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                          {/* Table Sub-header */}
                          <div className="bg-slate-50 border-b border-slate-200 px-2.5 sm:px-3 py-2 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700 truncate">
                              Student Roster ({filteredStudents.length} available)
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 shrink-0 ml-2">
                              {selectedStudentIds.length} of {filteredStudents.length} selected
                            </span>
                          </div>

                          {/* Scrollable Table */}
                          <div className="max-h-60 overflow-y-auto overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-50/90 text-slate-500 border-b border-slate-200 text-[10px] font-mono uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                                <tr>
                                  <th className="w-9 py-2 pl-2.5 sm:pl-3.5 pr-1 text-center shrink-0">
                                    <input
                                      type="checkbox"
                                      checked={
                                        filteredStudents.length > 0 &&
                                        filteredStudents.every((s) => selectedStudentIds.includes(s.id))
                                      }
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          selectAllFiltered();
                                        } else {
                                          deselectAllFiltered();
                                        }
                                      }}
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      title="Select / deselect all in view"
                                    />
                                  </th>
                                  <th className="py-2 px-2 text-left font-semibold">Student Name & Batch</th>
                                  <th className="hidden sm:table-cell py-2 px-2.5 text-right font-semibold">Balance</th>
                                  <th className="py-2 pr-2.5 sm:pr-3.5 pl-1.5 text-right font-semibold w-24 sm:w-32">
                                    Amount (<span className="font-sans">₹</span>)
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {filteredStudents.length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="p-6 text-center text-xs text-slate-400">
                                      No matching active students found.
                                    </td>
                                  </tr>
                                ) : (
                                  filteredStudents.map((st) => {
                                    const isChecked = selectedStudentIds.includes(st.id);
                                    const count = selectedStudentIds.length;
                                    const parsedAmount = parseFloat(amount) || 0;

                                    let rowAmountDisplay = '';
                                    if (isChecked) {
                                      if (distributionMode === 'custom') {
                                        rowAmountDisplay = studentCustomAmounts[st.id] ?? '';
                                      } else if (distributionMode === 'equal_split') {
                                        rowAmountDisplay =
                                          count > 0 ? (parsedAmount / count).toFixed(2) : '0.00';
                                      } else {
                                        rowAmountDisplay =
                                          parsedAmount > 0 ? parsedAmount.toFixed(2) : '0.00';
                                      }
                                    }

                                    return (
                                      <tr
                                        key={st.id}
                                        onClick={(e) => {
                                          if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                            toggleStudentSelection(st.id);
                                          }
                                        }}
                                        className={`transition-colors cursor-pointer ${
                                          isChecked
                                            ? 'bg-indigo-50/50 hover:bg-indigo-50/70'
                                            : 'hover:bg-slate-50 text-slate-600'
                                        }`}
                                      >
                                        {/* 1. Checkbox */}
                                        <td
                                          className="w-9 py-2 pl-2.5 sm:pl-3.5 pr-1 text-center shrink-0"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleStudentSelection(st.id)}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                          />
                                        </td>

                                        {/* 2. Student Info */}
                                        <td className="py-2 px-2 min-w-0">
                                          <div
                                            className={`truncate font-semibold ${
                                              isChecked ? 'text-indigo-950 font-bold' : 'text-slate-800'
                                            }`}
                                          >
                                            {st.name}
                                          </div>
                                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 flex-wrap">
                                            <span>{st.batch_name || 'No Batch'}</span>
                                            <span className="text-slate-400">•</span>
                                            <span className="font-semibold text-slate-700 sm:hidden">
                                              Bal: ₹{st.balance.toFixed(2)}
                                            </span>
                                            <span className="hidden sm:inline">Ph: {st.phone}</span>
                                          </div>
                                        </td>

                                        {/* 3. Balance (Hidden on mobile, visible on sm+) */}
                                        <td className="hidden sm:table-cell py-2.5 px-2.5 text-right whitespace-nowrap">
                                          <span className="text-[11px] font-mono font-semibold text-slate-600">
                                            Bal: ₹{st.balance.toFixed(2)}
                                          </span>
                                        </td>

                                        {/* 4. Amount Input */}
                                        <td
                                          className="py-2 pr-2.5 sm:pr-3.5 pl-1.5 text-right w-24 sm:w-32"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {isChecked ? (
                                            distributionMode === 'custom' ? (
                                              <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold font-sans">
                                                  ₹
                                                </span>
                                                <input
                                                  key={`custom-input-${st.id}`}
                                                  type="number"
                                                  step="any"
                                                  min="0.01"
                                                  placeholder="0.00"
                                                  value={studentCustomAmounts[st.id] ?? ''}
                                                  onChange={(e) =>
                                                    handleCustomAmountChange(st.id, e.target.value)
                                                  }
                                                  className="w-20 sm:w-full pl-4 sm:pl-5 pr-1.5 sm:pr-2 py-1 text-xs font-mono font-bold text-slate-900 border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-2xs text-right"
                                                />
                                              </div>
                                            ) : (
                                              <div
                                                className="relative"
                                                title={
                                                  distributionMode === 'equal_split'
                                                    ? 'Auto-calculated: equal share of total'
                                                    : 'Auto-calculated: applied amount to each'
                                                }
                                              >
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-bold font-sans">
                                                  ₹
                                                </span>
                                                <input
                                                  key={`fixed-input-${st.id}`}
                                                  type="text"
                                                  readOnly
                                                  value={rowAmountDisplay}
                                                  className="w-20 sm:w-full pl-4 sm:pl-5 pr-1.5 sm:pr-2 py-1 text-xs font-mono font-bold text-indigo-900 border border-indigo-200 rounded-lg bg-indigo-50/70 cursor-default text-right"
                                                />
                                              </div>
                                            )
                                          ) : (
                                            <div className="relative opacity-35">
                                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 text-xs font-bold font-sans">
                                                ₹
                                              </span>
                                              <input
                                                key={`disabled-input-${st.id}`}
                                                type="text"
                                                disabled
                                                readOnly
                                                value=""
                                                placeholder="—"
                                                className="w-20 sm:w-full pl-4 sm:pl-5 pr-1.5 sm:pr-2 py-1 text-xs font-mono text-slate-400 border border-slate-200 rounded-lg bg-slate-50 cursor-not-allowed text-right"
                                              />
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Consolidated Footer Summary */}
                          <div className="bg-slate-50 border-t border-slate-200 px-2.5 sm:px-3.5 py-2.5 flex items-center justify-between text-xs gap-2">
                            <div className="flex items-center gap-1.5 text-slate-700 font-semibold min-w-0">
                              <span className="truncate">Total Combined:</span>
                              <span className="font-mono text-indigo-800 bg-indigo-100/70 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold border border-indigo-200 shrink-0">
                                {selectedStudentIds.length} student{selectedStudentIds.length === 1 ? '' : 's'}
                              </span>
                            </div>
                            <div className="font-mono text-xs font-bold text-slate-900 flex items-center gap-1 shrink-0">
                              <span className="text-slate-500 font-normal hidden sm:inline">Combined Total:</span>
                              <span className="text-emerald-700 font-extrabold text-sm flex items-center">
                                <span className="font-sans text-xs mr-0.5">₹</span>
                                <span>{journalPreview.amount.toFixed(2)}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* OPTION 3: GENERAL / OTHER CREDIT */}
                    {creditType === 'general' && (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 font-sans leading-relaxed">
                        {entryType === 'income'
                          ? 'Posts to general "Accounts Receivable (Other)" account.'
                          : 'Posts to general "Accounts Payable" liability account.'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4. AMOUNT, DATE & DESCRIPTION */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Amount */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Amount (<span className="font-sans">₹</span>) <span className="text-red-500">*</span>
                      </label>
                      {paymentMethod === 'credit' &&
                        creditType === 'multi_student' &&
                        distributionMode === 'custom' && (
                          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            Auto-summed from students
                          </span>
                        )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-sans text-sm font-bold">₹</span>
                      {paymentMethod === 'credit' &&
                      creditType === 'multi_student' &&
                      distributionMode === 'custom' ? (
                        <input
                          key="main-amount-readonly"
                          type="text"
                          readOnly
                          value={journalPreview.amount > 0 ? journalPreview.amount.toFixed(2) : ''}
                          placeholder="0.00 (Sum of student amounts)"
                          className="w-full bg-slate-50 border border-indigo-200 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-indigo-700 font-mono font-bold cursor-not-allowed shadow-xs"
                        />
                      ) : (
                        <input
                          key="main-amount-editable"
                          type="number"
                          step="any"
                          min="0.01"
                          required
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-emerald-700 font-mono font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-xs transition-all"
                        />
                      )}
                    </div>
                  </div>

                  {/* Transaction Date */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Transaction Date <span className="text-red-500">*</span>
                    </label>
                    <CustomDateInput
                      value={date}
                      onChange={(val) => setDate(val)}
                      className="w-full py-2"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Description / Note <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-xs transition-all"
                  />
                </div>
              </div>

              {/* 5. LIVE DOUBLE-ENTRY JOURNAL LINE PREVIEW */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚡ Live Journal Voucher Preview</span>
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      journalPreview.isValid
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {journalPreview.isValid ? '✓ Balanced 2-Line Voucher' : 'Incomplete Entry'}
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  {/* DEBIT LINE PREVIEW */}
                  <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold shrink-0">
                        DR
                      </span>
                      <span className="text-slate-900 font-semibold truncate font-sans text-xs">
                        {journalPreview.debitAccountName}
                      </span>
                    </div>
                    <span className="text-emerald-700 font-extrabold text-xs shrink-0 flex items-center gap-0.5">
                      <span className="font-sans">₹</span>
                      <span className="font-mono">{journalPreview.amount.toFixed(2)}</span>
                    </span>
                  </div>

                  {/* CREDIT LINE PREVIEW */}
                  <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold shrink-0">
                        CR
                      </span>
                      <span className="text-slate-900 font-semibold truncate font-sans text-xs">
                        {journalPreview.creditAccountName}
                      </span>
                    </div>
                    <span className="text-blue-700 font-extrabold text-xs shrink-0 flex items-center gap-0.5">
                      <span className="font-sans">₹</span>
                      <span className="font-mono">{journalPreview.amount.toFixed(2)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={submitting || !journalPreview.isValid || !description.trim()}
                  className="w-full py-3 px-5 rounded-xl text-xs font-black tracking-wide uppercase transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {submitting ? (
                    'Posting Entry to Ledger...'
                  ) : (
                    <span className="inline-flex items-center justify-center gap-1">
                      <span>Post {entryType.toUpperCase()} Voucher (</span>
                      <span className="font-sans">₹</span>
                      <span className="font-mono">{journalPreview.amount.toFixed(2)}</span>
                      <span>)</span>
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* QUICK ADD ACCOUNT MODAL */}
        {showAddAccountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Add New {entryType === 'income' ? 'Revenue' : 'Expense'} Category Account
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              </div>

              {addAccountError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
                  {addAccountError}
                </div>
              )}

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      entryType === 'income'
                        ? 'e.g. Workshop Registration Income'
                        : 'e.g. Office Cleaning Expense'
                    }
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Account Type (Auto-assigned)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={entryType === 'income' ? 'Revenue (Income)' : 'Expense'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 capitalize"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAccountModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingAccount || !newAccountName.trim()}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs disabled:opacity-50 transition-colors"
                  >
                    {creatingAccount ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QUICK ADD STUDENT MODAL */}
        <AddStudentModal
          isOpen={showAddStudentModal}
          onClose={() => setShowAddStudentModal(false)}
          onStudentAdded={async () => {
            await Promise.all([loadStudents(), loadAccounts(), loadBatches()]);
            setShowAddStudentModal(false);
          }}
        />
      </div>
    </AdminAuthGuard>
  );
}
