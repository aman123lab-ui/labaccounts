'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getPrintPageCounts } from '@/services/ledgerService';
import { getCurrentFinancialYear } from '@/services/financialYearService';
import { getStudents, StudentWithDetails } from '@/services/studentService';
import { formatDate } from '@/utils/formatDate';
import { formatCurrency, formatStudentBalance } from '@/utils/formatCurrency';
import CustomDateInput from '@/components/CustomDateInput';
import { isGuestMode, getDemoAccounts, getDemoJournalEntries } from '@/lib/demo/demoStore';
import { useRealtimeMultiSync } from '@/hooks/useRealtimeSync';

export interface TrialBalanceRow {
  accountId: string;
  accountName: string;
  studentName?: string | null;
  isStudentAccount: boolean;
  accountType: string;
  debitBalance: number;
  creditBalance: number;
}

export default function ReportsPage() {
  const [activeReportTab, setActiveReportTab] = useState<
    'overview' | 'trial' | 'income_expenditure' | 'balance_sheet' | 'student_ledger'
  >('overview');

  // Overview Summary Cards State
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [bwPages, setBwPages] = useState(0);
  const [colorPages, setColorPages] = useState(0);

  // Income & Expenditure Date Range State
  const [ieStartDate, setIeStartDate] = useState<string>('');
  const [ieEndDate, setIeEndDate] = useState<string>('');
  const [defaultFyDates, setDefaultFyDates] = useState<{ start: string; end: string } | null>(null);

  // Student Ledger Summary Report State
  const [studentRoster, setStudentRoster] = useState<StudentWithDetails[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentBatchFilter, setStudentBatchFilter] = useState<string>('all');
  const [hideZeroBalanceStudents, setHideZeroBalanceStudents] = useState<boolean>(false);
  const [studentSortBy, setStudentSortBy] = useState<
    'batch' | 'amount_desc' | 'amount_asc' | 'name_asc' | 'name_desc'
  >('amount_desc');

  // Core Data
  const [trialBalanceRows, setTrialBalanceRows] = useState<TrialBalanceRow[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [rawEntries, setRawEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReportsData() {
      setLoading(true);
      const supabase = createClient();

      // 0. Fetch Current FY for default date range
      const currentFY = await getCurrentFinancialYear();
      if (currentFY && currentFY.start_date && currentFY.end_date) {
        setIeStartDate(currentFY.start_date);
        setIeEndDate(currentFY.end_date);
        setDefaultFyDates({ start: currentFY.start_date, end: currentFY.end_date });
      } else {
        const curYr = new Date().getFullYear();
        const fallbackStart = `${curYr}-01-01`;
        const fallbackEnd = `${curYr}-12-31`;
        setIeStartDate(fallbackStart);
        setIeEndDate(fallbackEnd);
        setDefaultFyDates({ start: fallbackStart, end: fallbackEnd });
      }

      let accData: any[] = [];
      let entriesData: any[] = [];

      // 1. Fetch Chart of Accounts with student metadata
      if (isGuestMode()) {
        const demoAccounts = getDemoAccounts();
        const demoEntries = getDemoJournalEntries();
        const roster = await getStudents({ status: 'active' });

        accData = demoAccounts.map((a) => {
          const student = roster.find((s) => s.id === a.student_id);
          return {
            ...a,
            students: student ? { name: student.name } : null,
          };
        });

        entriesData = demoEntries.map((e) => ({
          id: e.id,
          date: e.date,
          description: e.description,
          is_closing_entry: false,
          journal_entry_lines: e.journal_entry_lines.map((l) => ({
            account_id: l.account_id,
            debit_amount: l.debit_amount,
            credit_amount: l.credit_amount,
            accounts: {
              name: l.accounts.name,
              type: l.accounts.type,
              is_student_account: (l.accounts as any).is_student_account || false,
            },
          })),
        }));

        setStudentRoster(roster);
        setBwPages(0);
        setColorPages(0);
      } else {
        const { data: fetchedAccData, error: accErr } = await supabase
          .from('accounts')
          .select('*, students(name)')
          .order('name');

        if (accErr) {
          console.error('Error fetching accounts for reports:', accErr);
        }
        accData = fetchedAccData || [];

        // 2. Fetch Page Counts from print_jobs
        const counts = await getPrintPageCounts();
        setBwPages(counts.bwPages);
        setColorPages(counts.colorPages);

        // 3. Fetch Non-Voided Journal Entries & Lines
        let { data: fetchedEntriesData, error: entriesErr } = await supabase
          .from('journal_entries')
          .select(
            'id, date, description, is_closing_entry, journal_entry_lines(account_id, debit_amount, credit_amount, accounts(name, type, is_student_account))'
          )
          .is('voided_at', null)
          .order('date', { ascending: false });

        if (entriesErr && (entriesErr as { code?: string }).code === '42703') {
          const fallback = await supabase
            .from('journal_entries')
            .select(
              'id, date, description, journal_entry_lines(account_id, debit_amount, credit_amount, accounts(name, type, is_student_account))'
            )
            .order('date', { ascending: false });
          fetchedEntriesData = fallback.data as typeof fetchedEntriesData;
        }

        entriesData = fetchedEntriesData || [];

        // 4. Fetch Student Roster for Debit Book / Student Ledger Summary Report
        const roster = await getStudents({ status: 'active' });
        setStudentRoster(roster);
      }

      setAccountsList(accData);
      setRawEntries(entriesData);

      const accountDebitsMap = new Map<string, number>();
      const accountCreditsMap = new Map<string, number>();

      let inc = 0;
      let exp = 0;
      let cash = 0;

      (entriesData || []).forEach((entry) => {
        const entryLines = entry.journal_entry_lines as unknown as {
          account_id: string;
          debit_amount: number;
          credit_amount: number;
          accounts: { name: string; type: string; is_student_account: boolean } | null;
        }[];

        (entryLines || []).forEach((l) => {
          const d = Number(l.debit_amount || 0);
          const c = Number(l.credit_amount || 0);

          accountDebitsMap.set(l.account_id, (accountDebitsMap.get(l.account_id) || 0) + d);
          accountCreditsMap.set(l.account_id, (accountCreditsMap.get(l.account_id) || 0) + c);

          // Overview totals
          if (l.accounts?.type === 'revenue') inc += (c - d);
          if (l.accounts?.type === 'expense') exp += (d - c);
          const accNameLower = (l.accounts?.name || '').toLowerCase();
          if (accNameLower.includes('cash') && !accNameLower.includes('in-charge')) {
            cash += (d - c);
          }
        });
      });

      setTotalIncome(inc);
      setTotalExpense(exp);
      setCashBalance(cash);

      // 5. Build Trial Balance Rows for ALL Chart of Accounts
      const tb: TrialBalanceRow[] = (accData || []).map((acc) => {
        const totDebit = accountDebitsMap.get(acc.id) || 0;
        const totCredit = accountCreditsMap.get(acc.id) || 0;

        let debitBalance = 0;
        let creditBalance = 0;

        if (acc.type === 'asset' || acc.type === 'expense') {
          const net = totDebit - totCredit;
          if (net >= 0) debitBalance = net;
          else creditBalance = Math.abs(net);
        } else {
          const net = totCredit - totDebit;
          if (net >= 0) creditBalance = net;
          else debitBalance = Math.abs(net);
        }

        const studentObj = acc.students as unknown as { name: string } | null;
        const studentName = studentObj?.name || null;

        return {
          accountId: acc.id,
          accountName: acc.name,
          studentName,
          isStudentAccount: acc.is_student_account,
          accountType: acc.type.toUpperCase(),
          debitBalance,
          creditBalance,
        };
      });

      setTrialBalanceRows(tb);
      setLoading(false);
    }

    loadReportsData();
  }, []);

  useRealtimeMultiSync({
    channelName: 'admin-reports-sync',
    tables: ['journal_entries', 'journal_entry_lines', 'accounts', 'students', 'print_jobs'],
    onDataChange: () => {
      // Reload reports data
      const supabase = createClient();
      getCurrentFinancialYear().then((currentFY) => {
        if (currentFY && currentFY.start_date && currentFY.end_date) {
          setIeStartDate(currentFY.start_date);
          setIeEndDate(currentFY.end_date);
        }
      });
    },
  });

  // Helper to reset Income & Expenditure date range to current FY default
  const resetIeDateRange = () => {
    if (defaultFyDates) {
      setIeStartDate(defaultFyDates.start);
      setIeEndDate(defaultFyDates.end);
    }
  };

  // Live Computed Income & Expenditure Account Data for selected Date Range
  const ieFilteredEntries = useMemo(() => {
    if (!rawEntries || rawEntries.length === 0) return [];
    return rawEntries.filter((entry) => {
      const entryDate = (entry.date || '').split('T')[0];
      if (ieStartDate && entryDate < ieStartDate) return false;
      if (ieEndDate && entryDate > ieEndDate) return false;

      // Exclude automated year-end closing entries from operational Income & Expenditure
      const isClosing =
        entry.is_closing_entry === true ||
        (entry.description || '').toLowerCase().includes('closing entry');
      if (isClosing) return false;

      return true;
    });
  }, [rawEntries, ieStartDate, ieEndDate]);

  const { incomeAccounts, expenditureAccounts, totalPeriodIncome, totalPeriodExpenditure, periodNetSurplus } =
    useMemo(() => {
      const incMap = new Map<string, { id: string; name: string; amount: number }>();
      const expMap = new Map<string, { id: string; name: string; amount: number }>();

      (accountsList || []).forEach((acc) => {
        if (acc.type === 'revenue') {
          incMap.set(acc.id, { id: acc.id, name: acc.name, amount: 0 });
        } else if (acc.type === 'expense') {
          expMap.set(acc.id, { id: acc.id, name: acc.name, amount: 0 });
        }
      });

      (ieFilteredEntries || []).forEach((entry) => {
        const lines = entry.journal_entry_lines || [];
        lines.forEach((l: any) => {
          const d = Number(l.debit_amount || 0);
          const c = Number(l.credit_amount || 0);
          const accId = l.account_id;
          const accType = l.accounts?.type;

          if (accType === 'revenue' && incMap.has(accId)) {
            const item = incMap.get(accId)!;
            item.amount += c - d;
          } else if (accType === 'expense' && expMap.has(accId)) {
            const item = expMap.get(accId)!;
            item.amount += d - c;
          }
        });
      });

      const incomeList = Array.from(incMap.values());
      const expenditureList = Array.from(expMap.values());

      const totInc = incomeList.reduce((sum, item) => sum + item.amount, 0);
      const totExp = expenditureList.reduce((sum, item) => sum + item.amount, 0);
      const net = totInc - totExp;

      return {
        incomeAccounts: incomeList,
        expenditureAccounts: expenditureList,
        totalPeriodIncome: totInc,
        totalPeriodExpenditure: totExp,
        periodNetSurplus: net,
      };
    }, [accountsList, ieFilteredEntries]);

  // Helper to identify Accounts Receivable accounts (both individual student accounts and generic AR accounts)
  const isARAccount = (r: TrialBalanceRow) => {
    const lower = r.accountName.toLowerCase().trim();
    return r.isStudentAccount || lower === 'accounts receivable' || lower === 'student accounts receivable';
  };

  // Separate General Accounts vs Student AR Sub-Accounts
  const generalAccounts = useMemo(() => {
    return trialBalanceRows.filter((r) => !isARAccount(r));
  }, [trialBalanceRows]);

  const studentAccounts = useMemo(() => {
    return trialBalanceRows.filter((r) => isARAccount(r));
  }, [trialBalanceRows]);

  // Dynamic sum of all Student Accounts Receivable (Debits) & Credit Payables
  const studentTotalDebit = useMemo(() => {
    return studentAccounts.reduce((sum, r) => sum + r.debitBalance, 0);
  }, [studentAccounts]);

  const studentTotalCredit = useMemo(() => {
    return studentAccounts.reduce((sum, r) => sum + r.creditBalance, 0);
  }, [studentAccounts]);

  // ==========================================
  // PART 1: FILTERING NON-ZERO ACCOUNTS FOR DISPLAY
  // ==========================================

  // Trial Balance Display Filtering (Non-zero debit or credit)
  const displayedGeneralAccounts = useMemo(() => {
    return generalAccounts.filter((r) => r.debitBalance > 0 || r.creditBalance > 0);
  }, [generalAccounts]);

  const showStudentARInTB = studentTotalDebit > 0;
  const showStudentPayableInTB = studentTotalCredit > 0;

  // Income & Expenditure Display Filtering (Non-zero amount)
  const displayedIncomeAccounts = useMemo(() => {
    return incomeAccounts.filter((inc) => Math.abs(inc.amount) > 0.001);
  }, [incomeAccounts]);

  const displayedExpenditureAccounts = useMemo(() => {
    return expenditureAccounts.filter((exp) => Math.abs(exp.amount) > 0.001);
  }, [expenditureAccounts]);

  // Balance Sheet - Asset Accounts Display Filtering
  const generalAssetAccounts = useMemo(() => {
    return generalAccounts.filter((r) => r.accountType === 'ASSET');
  }, [generalAccounts]);

  const displayedGeneralAssetAccounts = useMemo(() => {
    return generalAssetAccounts.filter((a) => a.debitBalance > 0);
  }, [generalAssetAccounts]);

  const showStudentARInBS = studentTotalDebit > 0;

  // Balance Sheet - Liability Accounts Display Filtering
  const generalLiabilityAccounts = useMemo(() => {
    return generalAccounts.filter((r) => r.accountType === 'LIABILITY');
  }, [generalAccounts]);

  const displayedGeneralLiabilityAccounts = useMemo(() => {
    return generalLiabilityAccounts.filter((l) => l.creditBalance > 0);
  }, [generalLiabilityAccounts]);

  const showStudentPayableInBS = studentTotalCredit > 0;

  // Balance Sheet - Equity Accounts Display Filtering
  const equityAccounts = useMemo(() => {
    return generalAccounts.filter((r) => r.accountType === 'EQUITY');
  }, [generalAccounts]);

  const displayedEquityAccounts = useMemo(() => {
    return equityAccounts.filter((e) => e.creditBalance > 0);
  }, [equityAccounts]);

  const showNetSurplusInBS = Math.abs(periodNetSurplus) > 0.001;

  // ==========================================
  // UNTOUCHED COMPUTED TOTALS (From FULL underlying data)
  // ==========================================
  const totalTbDebit = useMemo(() => {
    const generalSum = generalAccounts.reduce((sum, r) => sum + r.debitBalance, 0);
    return generalSum + studentTotalDebit;
  }, [generalAccounts, studentTotalDebit]);

  const totalTbCredit = useMemo(() => {
    const generalSum = generalAccounts.reduce((sum, r) => sum + r.creditBalance, 0);
    return generalSum + studentTotalCredit;
  }, [generalAccounts, studentTotalCredit]);

  const totalAssets = useMemo(() => {
    const genAssetsSum = generalAssetAccounts.reduce((sum, r) => sum + r.debitBalance, 0);
    return genAssetsSum + studentTotalDebit;
  }, [generalAssetAccounts, studentTotalDebit]);

  const totalGeneralLiabilities = useMemo(() => {
    return generalLiabilityAccounts.reduce((sum, r) => sum + r.creditBalance, 0);
  }, [generalLiabilityAccounts]);

  const baseEquity = useMemo(() => {
    return equityAccounts.reduce((sum, r) => sum + r.creditBalance, 0);
  }, [equityAccounts]);

  const netSurplus = periodNetSurplus;

  const totalLiabilitiesAndEquity = useMemo(() => {
    return totalGeneralLiabilities + studentTotalCredit + baseEquity + netSurplus;
  }, [totalGeneralLiabilities, studentTotalCredit, baseEquity, netSurplus]);

  const isBalanceSheetTallied = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  // Custom batch hierarchy ordering: JD (1..3) -> HS (1..2) -> BS (1..5) -> Others
  const compareBatchNames = (aName: string = '', bName: string = '') => {
    const getPrefixRank = (name: string) => {
      const uppercase = name.toUpperCase().trim();
      if (uppercase.startsWith('JD')) return 1;
      if (uppercase.startsWith('HS')) return 2;
      if (uppercase.startsWith('BS')) return 3;
      return 4;
    };

    const rankA = getPrefixRank(aName);
    const rankB = getPrefixRank(bName);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
  };

  // ==========================================
  // PART 2: STUDENT LEDGER SUMMARY (DEBIT BOOK REPORT) FILTERING
  // ==========================================
  const filteredStudentRoster = useMemo(() => {
    const list = studentRoster.filter((s) => {
      // Search term filter
      if (studentSearchTerm.trim()) {
        const term = studentSearchTerm.trim().toLowerCase();
        const matchName = s.name.toLowerCase().includes(term);
        const matchPhone = s.phone.toLowerCase().includes(term);
        const matchBatch = s.batch_name.toLowerCase().includes(term);
        if (!matchName && !matchPhone && !matchBatch) return false;
      }

      // Batch filter
      if (studentBatchFilter !== 'all') {
        if (s.batch_id !== studentBatchFilter && s.batch_name !== studentBatchFilter) return false;
      }

      // Zero-balance filter
      if (hideZeroBalanceStudents) {
        if (Math.abs(s.balance) < 0.01) return false;
      }

      return true;
    });

    return list.sort((a, b) => {
      if (studentSortBy === 'amount_desc') {
        if (b.balance !== a.balance) return b.balance - a.balance;
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      }
      if (studentSortBy === 'amount_asc') {
        if (a.balance !== b.balance) return a.balance - b.balance;
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      }
      if (studentSortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      }
      if (studentSortBy === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
      }
      const batchCompare = compareBatchNames(a.batch_name, b.batch_name);
      if (batchCompare !== 0) return batchCompare;
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
  }, [studentRoster, studentSearchTerm, studentBatchFilter, hideZeroBalanceStudents, studentSortBy]);

  const uniqueBatchesInRoster = useMemo(() => {
    const bMap = new Map<string, string>();
    studentRoster.forEach((s) => {
      if (s.batch_name) bMap.set(s.batch_id, s.batch_name);
    });
    return Array.from(bMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => compareBatchNames(a.name, b.name));
  }, [studentRoster]);

  const rosterSummary = useMemo(() => {
    let totalDr = 0;
    let totalCr = 0;
    filteredStudentRoster.forEach((s) => {
      if (s.balance > 0) totalDr += s.balance;
      else if (s.balance < 0) totalCr += Math.abs(s.balance);
    });
    return {
      totalDr,
      totalCr,
      netAR: totalDr - totalCr,
      count: filteredStudentRoster.length,
    };
  }, [filteredStudentRoster]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleDownloadPDF = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <>
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 space-y-8 flex-1">
        {/* Printable Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 print:border-slate-300 pb-6 print:hidden">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 print:text-emerald-800 font-mono">
              Non-Profit Credit Service Ledger • Financial Statements
            </span>
            <h1 className="text-3xl font-black text-white print:text-slate-900 tracking-tight mt-1">
              Financial Reports Suite
            </h1>
            <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
              Derived live from double-entry Postgres journal entry lines • Certified debit-credit balanced
            </p>
          </div>

          {/* PRINT / DOWNLOAD BUTTONS */}
          <div className="flex items-center gap-3 print:hidden">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Report
            </button>
          </div>
        </div>

        {/* REPORT TAB SELECTOR (Hidden in Print) */}
        <div className="flex bg-slate-900/90 border border-slate-800/80 p-1.5 rounded-2xl print:hidden overflow-x-auto gap-1.5 items-center">
          {[
            { id: 'overview', label: 'Reports Overview' },
            { id: 'trial', label: '1. Trial Balance' },
            { id: 'income_expenditure', label: '2. Income & Expenditure' },
            { id: 'balance_sheet', label: '3. Statement of Financial Position' },
            { id: 'student_ledger', label: '4. Student Ledger Summary' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveReportTab(tab.id as typeof activeReportTab)}
              className={`flex-1 shrink-0 min-w-max py-2.5 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-center ${
                activeReportTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-md border border-emerald-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. REPORTS OVERVIEW SECTION */}
        {(activeReportTab === 'overview' || typeof window !== 'undefined') && (
          <div className={`space-y-4 ${activeReportTab !== 'overview' ? 'print:block hidden' : ''}`}>
            {/* Heading (Hidden when printing) */}
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 print:hidden border-b border-slate-800 pb-2">
              Reports Overview & Print Job Metrics
            </h2>

            {/* ON-SCREEN BOXED CARDS VIEW (Hidden when printing) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 print:hidden">
              {/* Card 1: Total Service Income */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 shadow-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Service Income</span>
                <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">
                  ₹{Math.abs(totalIncome).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Printing Revenue</span>
              </div>

              {/* Card 2: Total Expense */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 shadow-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Expense</span>
                <span className="text-xl font-black text-purple-400 font-mono mt-0.5 block">
                  ₹{Math.abs(totalExpense).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Paper, Ink, Maintenance</span>
              </div>

              {/* Card 3: Cash Balance */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 shadow-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Cash Balance</span>
                <span className="text-xl font-black text-blue-400 font-mono mt-0.5 block">
                  ₹{Math.abs(cashBalance).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Cash in Vault/Bank</span>
              </div>

              {/* Card 4: Pages Printed (B/W) */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 shadow-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Pages Printed (B/W)</span>
                <span className="text-xl font-black text-slate-200 font-mono mt-0.5 block">
                  {bwPages}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Black & White Total</span>
              </div>

              {/* Card 5: Pages Printed (Color) */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 shadow-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Pages Printed (Color)</span>
                <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">
                  {colorPages}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Color Print Total</span>
              </div>
            </div>

          </div>
        )}

        {/* 2. TRIAL BALANCE REPORT */}
        {(activeReportTab === 'trial' || activeReportTab === 'overview') && (
          <div className="space-y-4 pt-6 border-t border-slate-800 print:border-t-0 print:pt-0 print:mt-0">
            <div>
              <h2 className="text-lg font-extrabold text-white print:text-2xl print:font-black print:text-slate-900">Trial Balance</h2>
              <p className="text-xs text-slate-400 print:hidden mt-0.5">Verification of total debit balances matching total credit balances across all active accounts.</p>
              <p className="hidden print:block text-xs font-mono text-slate-600 font-semibold mt-0.5 mb-2">
                {ieStartDate && ieEndDate ? `${formatDate(ieStartDate)} to ${formatDate(ieEndDate)}` : ''}
              </p>
            </div>

            <div className="border border-slate-800/80 rounded-2xl overflow-x-auto shadow-xl bg-slate-900/40 print:bg-white print:border-slate-300 print:shadow-none">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-300 border-b border-slate-800 font-bold uppercase print:bg-slate-100 print:text-slate-900 print:border-slate-300">
                  <tr>
                    <th className="p-3.5">Account Title</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5 text-right">Debit Balance (₹)</th>
                    <th className="p-3.5 text-right">Credit Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                  {/* General Ledger Accounts (Filtered to non-zero) */}
                  {displayedGeneralAccounts.map((r) => (
                    <tr key={r.accountId} className="hover:bg-slate-800/40 transition-colors print:hover:bg-transparent">
                      <td className="p-3.5 font-sans font-bold text-slate-200 print:text-slate-900">{r.accountName}</td>
                      <td className="p-3.5 text-slate-400 print:text-slate-600 font-bold text-[10px]">{r.accountType}</td>
                      <td className="p-3.5 text-right text-emerald-400 print:text-emerald-800 font-bold">
                        {r.debitBalance > 0 ? `₹${r.debitBalance.toFixed(2)}` : ''}
                      </td>
                      <td className="p-3.5 text-right text-blue-400 print:text-blue-800 font-bold">
                        {r.creditBalance > 0 ? `₹${r.creditBalance.toFixed(2)}` : ''}
                      </td>
                    </tr>
                  ))}

                  {/* Student Debit Balances (Receivables - Asset) */}
                  {showStudentARInTB && (
                    <tr className="hover:bg-slate-800/40 transition-colors print:hover:bg-transparent">
                      <td className="p-3.5 font-sans font-bold text-slate-200 print:text-slate-900">Student Accounts Receivable</td>
                      <td className="p-3.5 text-slate-400 print:text-slate-600 font-bold text-[10px]">ASSET</td>
                      <td className="p-3.5 text-right text-emerald-400 print:text-emerald-800 font-bold">
                        ₹{studentTotalDebit.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right text-slate-500 font-bold"></td>
                    </tr>
                  )}

                  {/* Student Credit Balances (Payables - Liability) */}
                  {showStudentPayableInTB && (
                    <tr className="hover:bg-slate-800/40 transition-colors print:hover:bg-transparent">
                      <td className="p-3.5 font-sans font-bold text-amber-300 print:text-amber-900">Due to Students (Overpayments / Refund Due)</td>
                      <td className="p-3.5 text-amber-400/80 print:text-amber-700 font-bold text-[10px]">LIABILITY</td>
                      <td className="p-3.5 text-right text-slate-500 font-bold"></td>
                      <td className="p-3.5 text-right text-amber-400 print:text-amber-800 font-bold">
                        ₹{studentTotalCredit.toFixed(2)}
                      </td>
                    </tr>
                  )}

                  {/* Empty State when no account activity exists in the period */}
                  {displayedGeneralAccounts.length === 0 && !showStudentARInTB && !showStudentPayableInTB && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 italic font-sans text-xs">
                        No account activity recorded for this period
                      </td>
                    </tr>
                  )}

                  {/* Grand Total Row (Calculated from full underlying data) */}
                  <tr className="bg-slate-900 font-black text-sm border-t-2 border-slate-700 text-slate-100 print:bg-slate-100 print:text-slate-900 print:border-slate-400">
                    <td colSpan={2} className="p-3.5 font-sans uppercase">
                      Total Trial Balance
                    </td>
                    <td className="p-3.5 text-right text-emerald-400 print:text-emerald-800 font-mono">
                      ₹{totalTbDebit.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right text-blue-400 print:text-blue-800 font-mono">
                      ₹{totalTbCredit.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. INCOME & EXPENDITURE ACCOUNT REPORT */}
        {(activeReportTab === 'income_expenditure' || activeReportTab === 'overview') && (
          <div className="space-y-6 pt-6 border-t border-slate-800 print:border-slate-300 print:pt-4 print:mt-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-white print:text-2xl print:font-black print:text-slate-900">Income & Expenditure Account</h2>
                <p className="text-xs text-slate-400 print:hidden mt-0.5">
                  Statement of income and expenditure for the period, resulting in a surplus or deficit
                </p>
                <p className="hidden print:block text-xs font-mono text-slate-600 font-semibold mt-0.5 mb-2">
                  Period: {ieStartDate && ieEndDate ? `${formatDate(ieStartDate)} to ${formatDate(ieEndDate)}` : ''}
                </p>
              </div>

              {/* Date Range Selector */}
              <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 p-2.5 rounded-2xl print:hidden">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-bold text-slate-400 print:text-slate-700">From:</span>
                  <CustomDateInput
                    value={ieStartDate}
                    onChange={(val) => setIeStartDate(val)}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-bold text-slate-400 print:text-slate-700">To:</span>
                  <CustomDateInput
                    value={ieEndDate}
                    onChange={(val) => setIeEndDate(val)}
                  />
                </div>
                {(ieStartDate !== defaultFyDates?.start || ieEndDate !== defaultFyDates?.end) && (
                  <button
                    type="button"
                    onClick={resetIeDateRange}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline font-mono print:hidden px-1"
                    title="Reset date range to current financial year"
                  >
                    Reset FY
                  </button>
                )}
              </div>
            </div>

            {/* TWO CARDS: INCOME & EXPENDITURE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* INCOME CARD */}
              <div className="border border-slate-800/80 rounded-2xl p-5 bg-slate-900/70 shadow-xl space-y-4 print:bg-white print:border-slate-300 print:shadow-none">
                <h3 className="text-md font-bold text-slate-200 print:text-slate-900 font-mono uppercase border-b border-slate-800 print:border-slate-300 pb-2 flex justify-between items-center">
                  <span>INCOME</span>
                  <span className="text-xs text-emerald-400 print:text-emerald-800 font-normal">Credits</span>
                </h3>

                <div className="space-y-2 text-xs font-mono">
                  {displayedIncomeAccounts.length === 0 ? (
                    <div className="text-slate-500 text-center py-4 italic font-sans text-xs">No income account activity recorded for this period</div>
                  ) : (
                    displayedIncomeAccounts.map((inc) => (
                      <div key={inc.id} className="flex justify-between py-1.5 border-b border-slate-800/60 print:border-slate-200 text-slate-300 print:text-slate-800">
                        <span className="font-sans font-semibold text-slate-200 print:text-slate-900">{inc.name}</span>
                        <span className="font-bold text-emerald-400 print:text-emerald-800">₹{inc.amount.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-4 border-t-2 border-slate-700 print:border-slate-400 flex justify-between items-center text-sm font-black font-mono">
                  <span className="font-sans text-white print:text-slate-900">TOTAL INCOME</span>
                  <span className="text-emerald-400 print:text-emerald-800">₹{totalPeriodIncome.toFixed(2)}</span>
                </div>
              </div>

              {/* EXPENDITURE CARD */}
              <div className="border border-slate-800/80 rounded-2xl p-5 bg-slate-900/70 shadow-xl space-y-4 print:bg-white print:border-slate-300 print:shadow-none">
                <h3 className="text-md font-bold text-slate-200 print:text-slate-900 font-mono uppercase border-b border-slate-800 print:border-slate-300 pb-2 flex justify-between items-center">
                  <span>EXPENDITURE</span>
                  <span className="text-xs text-purple-400 print:text-purple-800 font-normal">Debits</span>
                </h3>

                <div className="space-y-2 text-xs font-mono">
                  {displayedExpenditureAccounts.length === 0 ? (
                    <div className="text-slate-500 text-center py-4 italic font-sans text-xs">No expenditure account activity recorded for this period</div>
                  ) : (
                    displayedExpenditureAccounts.map((exp) => (
                      <div key={exp.id} className="flex justify-between py-1.5 border-b border-slate-800/60 print:border-slate-200 text-slate-300 print:text-slate-800">
                        <span className="font-sans font-semibold text-slate-200 print:text-slate-900">{exp.name}</span>
                        <span className="font-bold text-purple-400 print:text-purple-800">₹{exp.amount.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-4 border-t-2 border-slate-700 print:border-slate-400 flex justify-between items-center text-sm font-black font-mono">
                  <span className="font-sans text-white print:text-slate-900">TOTAL EXPENDITURE</span>
                  <span className="text-purple-400 print:text-purple-800">₹{totalPeriodExpenditure.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* DYNAMIC SURPLUS / (DEFICIT) SUMMARY BOX */}
            <div className={`border rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row justify-between items-center gap-3 print:bg-white print:shadow-none ${
              periodNetSurplus >= 0
                ? 'bg-emerald-950/40 border-emerald-800/60 print:border-emerald-700'
                : 'bg-red-950/40 border-red-800/60 print:border-red-700'
            }`}>
              <div className="font-sans text-center sm:text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-slate-600 block">
                  Period Financial Result ({ieStartDate ? formatDate(ieStartDate) : 'All-time'} to {ieEndDate ? formatDate(ieEndDate) : 'Present'})
                </span>
                <span className="text-base font-black text-slate-100 print:text-slate-900 mt-0.5 block">
                  {periodNetSurplus >= 0 ? 'NET SURPLUS FOR THE PERIOD' : 'NET DEFICIT FOR THE PERIOD'}
                </span>
              </div>

              <div className="font-mono text-2xl font-black">
                <span className={periodNetSurplus >= 0 ? 'text-emerald-400 print:text-emerald-800' : 'text-red-400 print:text-red-700'}>
                  {periodNetSurplus >= 0 ? `₹${periodNetSurplus.toFixed(2)}` : `(₹${Math.abs(periodNetSurplus).toFixed(2)})`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. BALANCE SHEET REPORT */}
        {(activeReportTab === 'balance_sheet' || activeReportTab === 'overview') && (
          <div className="space-y-4 pt-6 border-t border-slate-800 print:border-slate-300 print:pt-4 print:mt-0">
            <div>
              <h2 className="text-lg font-extrabold text-white print:text-2xl print:font-black print:text-slate-900">Statement of Financial Position</h2>
              <p className="text-xs text-slate-400 print:hidden mt-0.5">Non-profit Statement of Financial Position representing Net Assets and Fund Balances.</p>
              <p className="hidden print:block text-xs font-mono text-slate-600 font-semibold mt-0.5 mb-2">
                Period: {ieStartDate && ieEndDate ? `${formatDate(ieStartDate)} to ${formatDate(ieEndDate)}` : ''}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ASSETS COLUMN */}
              <div className="border border-slate-800/80 rounded-2xl p-5 bg-slate-900/70 shadow-xl space-y-4 print:bg-white print:border-slate-300 print:shadow-none">
                <h3 className="text-md font-bold text-slate-200 print:text-slate-900 font-mono uppercase border-b border-slate-800 print:border-slate-300 pb-2">
                  Assets (Debits)
                </h3>
                <div className="space-y-2 text-xs font-mono">
                  {/* General Non-Student Asset Accounts (Filtered to non-zero) */}
                  {displayedGeneralAssetAccounts.map((a) => (
                    <div key={a.accountId} className="flex justify-between py-1.5 border-b border-slate-800/60 print:border-slate-200 text-slate-300 print:text-slate-800">
                      <span className="font-sans font-semibold text-slate-200 print:text-slate-900">{a.accountName}</span>
                      <span className="font-bold text-white print:text-slate-900">₹{a.debitBalance.toFixed(2)}</span>
                    </div>
                  ))}

                  {/* Single Line for Student Accounts Receivable */}
                  {showStudentARInBS && (
                    <div className="flex justify-between py-1.5 border-b border-slate-800/60 print:border-slate-200 text-slate-300 print:text-slate-800">
                      <span className="font-sans font-bold text-slate-200 print:text-slate-900">Student Accounts Receivable</span>
                      <span className="font-bold text-emerald-400 print:text-emerald-800">₹{studentTotalDebit.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Empty state for Assets */}
                  {displayedGeneralAssetAccounts.length === 0 && !showStudentARInBS && (
                    <div className="text-slate-500 text-center py-4 italic font-sans text-xs">No asset account activity recorded for this period</div>
                  )}
                </div>

                <div className="pt-4 border-t-2 border-slate-700 print:border-slate-400 flex justify-between items-center text-sm font-black font-mono">
                  <span className="font-sans text-white print:text-slate-900">TOTAL ASSETS</span>
                  <span className="text-emerald-400 print:text-emerald-800">₹{totalAssets.toFixed(2)}</span>
                </div>
              </div>

              {/* LIABILITIES & EQUITY / FUND BALANCE COLUMN */}
              <div className="border border-slate-800/80 rounded-2xl p-5 bg-slate-900/70 shadow-xl space-y-4 print:bg-white print:border-slate-300 print:shadow-none">
                <h3 className="text-md font-bold text-slate-200 print:text-slate-900 font-mono uppercase border-b border-slate-800 print:border-slate-300 pb-2">
                  Liabilities & Fund Balance (Credits)
                </h3>
                <div className="space-y-3 text-xs font-mono">
                  {/* Section A: Liabilities & Payables */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-amber-400/90 tracking-wider block font-sans">
                      Liabilities & Student Obligations
                    </span>
                    {showStudentPayableInBS && (
                      <div className="flex justify-between py-1.5 border-b border-slate-800/60 print:border-slate-200 text-amber-300 print:text-amber-900">
                        <span className="font-sans font-bold">Due to Students (Overpayment Refund Due)</span>
                        <span className="font-bold">₹{studentTotalCredit.toFixed(2)}</span>
                      </div>
                    )}
                    {displayedGeneralLiabilityAccounts.map((l) => (
                      <div key={l.accountId} className="flex justify-between py-1.5 border-b border-slate-800/60 print:border-slate-200 text-slate-300 print:text-slate-800">
                        <span className="font-sans font-semibold text-slate-200 print:text-slate-900">{l.accountName}</span>
                        <span className="font-bold text-white print:text-slate-900">₹{l.creditBalance.toFixed(2)}</span>
                      </div>
                    ))}
                    {!showStudentPayableInBS && displayedGeneralLiabilityAccounts.length === 0 && (
                      <div className="text-slate-500 text-center py-2 italic font-sans text-[11px]">No liability account activity recorded for this period</div>
                    )}
                  </div>

                  {/* Section B: Fund Balance & Net Assets */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-blue-400/90 tracking-wider block font-sans">
                      Equity & Net Assets
                    </span>
                    {displayedEquityAccounts.map((e) => (
                      <div key={e.accountId} className="flex justify-between py-1.5 border-b border-slate-800/60 print:border-slate-200 text-slate-300 print:text-slate-800">
                        <span className="font-sans font-semibold text-slate-200 print:text-slate-900">{e.accountName}</span>
                        <span className="font-bold text-white print:text-slate-900">₹{e.creditBalance.toFixed(2)}</span>
                      </div>
                    ))}
                    {showNetSurplusInBS && (
                      <div className={`flex justify-between py-1.5 border-b border-slate-800/60 print:border-slate-200 ${
                        netSurplus >= 0 ? 'text-emerald-400 print:text-emerald-800' : 'text-red-400 print:text-red-700'
                      }`}>
                        <span className="font-sans font-bold">
                          {netSurplus >= 0 ? 'Current Period Net Surplus' : 'Current Period Net Deficit'}
                        </span>
                        <span className="font-bold">
                          {netSurplus >= 0
                            ? `₹${netSurplus.toFixed(2)}`
                            : `(₹${Math.abs(netSurplus).toFixed(2)})`}
                        </span>
                      </div>
                    )}
                    {displayedEquityAccounts.length === 0 && !showNetSurplusInBS && (
                      <div className="text-slate-500 text-center py-2 italic font-sans text-[11px]">No equity account activity recorded for this period</div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-slate-700 print:border-slate-400 flex justify-between items-center text-sm font-black font-mono">
                  <span className="font-sans text-white print:text-slate-900">TOTAL LIABILITIES & EQUITY</span>
                  <span className="text-blue-400 print:text-blue-800">₹{totalLiabilitiesAndEquity.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* BALANCE SHEET TALLY VERIFICATION STATUS */}
            <div className={`p-4 rounded-2xl border text-xs font-mono font-bold flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg print:border-slate-300 ${
              isBalanceSheetTallied
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-red-950/40 border-red-800/60 text-red-300'
            }`}>
              <div className="flex items-center gap-2 font-sans">
                <span className="text-base">{isBalanceSheetTallied ? '✓' : '⚠️'}</span>
                <span>
                  FINANCIAL POSITION STATUS:{' '}
                  <strong className={isBalanceSheetTallied ? 'text-emerald-400' : 'text-red-400'}>
                    {isBalanceSheetTallied ? 'BALANCED & TALLIED' : 'UNBALANCED DISCREPANCY DETECTED'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span>Total Assets: <strong>₹{totalAssets.toFixed(2)}</strong></span>
                <span>=</span>
                <span>Liabilities & Equity: <strong>₹{totalLiabilitiesAndEquity.toFixed(2)}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* 5. STUDENT LEDGER SUMMARY REPORT (DEBIT BOOK) */}
        {activeReportTab === 'student_ledger' && (
          <div className="space-y-4 pt-6 border-t border-slate-800 print:border-slate-300 print:pt-0 print:border-t-0">
            {/* PRINT-ONLY SIMPLE HEADING */}
            <div className="hidden print:block mb-4 border-b border-slate-300 pb-3">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">Debit Book Report</h1>
                  <p className="text-xs text-slate-600 mt-0.5">Student Ledger Roster & Balance Summary</p>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Printed on: {formatDate(new Date().toISOString())}
                </span>
              </div>
            </div>

            <div className="space-y-3 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-extrabold text-white">
                    Student Ledger Summary (Debit Book Report)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Complete student roster with live double-entry balances, receivables, and refund obligations.
                  </p>
                </div>
              </div>

              {/* Filtering & Sorting Toolbar (Hidden on Print) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80 shadow-lg">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[180px]">
                    <input
                      type="text"
                      placeholder="Search student or phone..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>

                  {/* Batch Filter Dropdown */}
                  <select
                    value={studentBatchFilter}
                    onChange={(e) => setStudentBatchFilter(e.target.value)}
                    className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-all font-medium cursor-pointer"
                  >
                    <option value="all" className="bg-slate-900 text-slate-100">All Batches</option>
                    {uniqueBatchesInRoster.map((b) => (
                      <option key={b.id} value={b.id} className="bg-slate-900 text-slate-100">
                        {b.name}
                      </option>
                    ))}
                  </select>

                  {/* SORT CONTROL DROPDOWN - Premium Slate-Emerald Accent */}
                  <select
                    value={studentSortBy}
                    onChange={(e) => setStudentSortBy(e.target.value as any)}
                    className="w-full sm:w-auto bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-300 hover:border-emerald-500/50 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer shadow-sm"
                  >
                    <option value="amount_desc" className="bg-slate-900 text-slate-100">Sort: Amount (High → Low)</option>
                    <option value="amount_asc" className="bg-slate-900 text-slate-100">Sort: Amount (Low → High)</option>
                    <option value="batch" className="bg-slate-900 text-slate-100">Sort: Batch Hierarchy</option>
                    <option value="name_asc" className="bg-slate-900 text-slate-100">Sort: Name (A → Z)</option>
                    <option value="name_desc" className="bg-slate-900 text-slate-100">Sort: Name (Z → A)</option>
                  </select>
                </div>

                {/* Hide Zero Balance Checkbox */}
                <label className="flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-300 cursor-pointer bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl hover:border-slate-700 transition-all whitespace-nowrap shrink-0">
                  <input
                    type="checkbox"
                    checked={hideZeroBalanceStudents}
                    onChange={(e) => setHideZeroBalanceStudents(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-900"
                  />
                  <span className="font-medium text-[11px]">Hide ₹0.00 Balances</span>
                </label>
              </div>
            </div>

            {/* Student Roster Report Table (On-Screen View Only) */}
            <div className="border border-slate-800/80 rounded-2xl overflow-x-auto shadow-xl bg-slate-900/40 print:hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-300 border-b border-slate-800 font-bold uppercase">
                  <tr>
                    <th className="p-3.5">#</th>
                    <th
                      onClick={() => setStudentSortBy(studentSortBy === 'name_asc' ? 'name_desc' : 'name_asc')}
                      className="p-3.5 cursor-pointer hover:text-emerald-400 transition-colors select-none"
                      title="Click to sort by Name"
                    >
                      Student Name {studentSortBy === 'name_asc' ? '▲' : studentSortBy === 'name_desc' ? '▼' : ''}
                    </th>
                    <th
                      onClick={() => setStudentSortBy('batch')}
                      className="p-3.5 cursor-pointer hover:text-emerald-400 transition-colors select-none"
                      title="Click to sort by Batch"
                    >
                      Batch {studentSortBy === 'batch' ? '✓' : ''}
                    </th>
                    <th className="p-3.5">Phone Number</th>
                    <th className="p-3.5">Account Status</th>
                    <th
                      onClick={() => setStudentSortBy(studentSortBy === 'amount_desc' ? 'amount_asc' : 'amount_desc')}
                      className="p-3.5 text-right cursor-pointer hover:text-emerald-400 transition-colors select-none"
                      title="Click to sort by Amount (High to Low / Low to High)"
                    >
                      Net Balance (₹) {studentSortBy === 'amount_desc' ? '▼ (High → Low)' : studentSortBy === 'amount_asc' ? '▲ (Low → High)' : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredStudentRoster.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 italic font-sans text-xs">
                        No student records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudentRoster.map((student, idx) => {
                      const balInfo = formatStudentBalance(student.balance, { showDrCr: true, context: 'admin' });
                      return (
                        <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 text-slate-500">{idx + 1}</td>
                          <td className="p-3.5 font-sans font-bold text-slate-200">{student.name}</td>
                          <td className="p-3.5 text-slate-400 font-bold text-[11px]">{student.batch_name}</td>
                          <td className="p-3.5 text-slate-400">{student.phone}</td>
                          <td className="p-3.5">
                            {balInfo.isZero ? (
                              <span className="px-2 py-0.5 rounded bg-slate-800/60 text-slate-400 text-[10px] font-bold font-sans">
                                Settled (₹0.00)
                              </span>
                            ) : balInfo.isCredit ? (
                              <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 text-[10px] font-bold font-sans">
                                Refund Due
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 text-[10px] font-bold font-sans">
                                Payment Pending
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right font-bold font-mono">
                            {balInfo.isZero ? (
                              <span className="text-slate-500">₹0.00</span>
                            ) : balInfo.isCredit ? (
                              <span className="text-amber-400">{balInfo.formatted}</span>
                            ) : (
                              <span className="text-emerald-400">{balInfo.formatted}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* On-Screen 6-Column Summary Row */}
                  <tr className="bg-slate-900 font-black text-xs border-t-2 border-slate-700 text-slate-100">
                    <td colSpan={4} className="p-3.5 font-sans uppercase">
                      Total Roster Summary ({rosterSummary.count} Students)
                    </td>
                    <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                      Dr: ₹{rosterSummary.totalDr.toFixed(2)} | Cr: ₹{rosterSummary.totalCr.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right text-emerald-400 font-mono text-sm">
                      Net AR: ₹{rosterSummary.netAR.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* PRINT-ONLY THREE SEPARATE SIDE-BY-SIDE TABLES VIEW */}
            <div className="hidden print:block space-y-6">
              {(() => {
                if (filteredStudentRoster.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-500 italic font-sans text-xs border border-slate-300 rounded-lg">
                      No student records match the selected filters.
                    </div>
                  );
                }

                // Chunk roster into pages of up to 18 students (6 in col 1, 6 in col 2, 6 in col 3)
                const STUDENTS_PER_PAGE = 18;
                const pages = [];
                for (let i = 0; i < filteredStudentRoster.length; i += STUDENTS_PER_PAGE) {
                  const chunk = filteredStudentRoster.slice(i, i + STUDENTS_PER_PAGE);
                  const colSize = Math.ceil(chunk.length / 3);
                  pages.push([
                    chunk.slice(0, colSize),
                    chunk.slice(colSize, colSize * 2),
                    chunk.slice(colSize * 2),
                  ]);
                }

                return pages.map((columns, pageIdx) => (
                  <div
                    key={pageIdx}
                    className={`flex gap-2.5 items-start ${
                      pageIdx < pages.length - 1 ? 'print-page-break mb-6' : 'mb-4'
                    }`}
                  >
                    {columns.map((colStudents, colIdx) => (
                      <div key={colIdx} className="w-1/3 border border-slate-300 rounded-lg overflow-hidden bg-white">
                        <table className="w-full text-left text-xs font-mono border-collapse">
                          <thead className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold uppercase text-[10px]">
                            <tr>
                              <th className="p-1.5 border-r border-slate-300 w-full">NAME</th>
                              <th className="p-1.5 text-right whitespace-nowrap w-1 shrink-0">AMOUNT</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {colStudents.length === 0 ? (
                              <tr>
                                <td colSpan={2} className="p-1.5 text-slate-400 italic text-[10px] text-center">
                                  —
                                </td>
                              </tr>
                            ) : (
                              colStudents.map((student) => {
                                const balInfo = formatStudentBalance(student.balance, { showDrCr: true, context: 'admin' });
                                return (
                                  <tr key={student.id} className="border-b border-slate-200">
                                    <td className="p-1.5 font-sans font-bold text-slate-900 text-[11px] border-r border-slate-200 truncate">
                                      {student.name}{' '}
                                      <span className="text-slate-600 font-bold text-[10px] ml-1">{student.batch_name}</span>
                                    </td>
                                    <td className="p-1.5 text-right font-bold font-mono text-[11px] whitespace-nowrap">
                                      {balInfo.isZero ? (
                                        <span className="text-slate-600">₹0.00</span>
                                      ) : balInfo.isCredit ? (
                                        <span className="text-amber-800">{balInfo.formatted}</span>
                                      ) : (
                                        <span className="text-emerald-800">{balInfo.formatted}</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ));
              })()}

              {/* Total Roster Summary Line (Spans Full Width) */}
              <div className="pt-3 border-t-2 border-slate-400 font-mono text-xs font-bold text-slate-900 flex justify-between items-center bg-slate-100 p-3 rounded-xl break-inside-avoid">
                <span className="font-sans uppercase font-bold">
                  Total Roster Summary ({rosterSummary.count} Students)
                </span>
                <div className="flex items-center gap-6 font-mono">
                  <span>Dr: ₹{rosterSummary.totalDr.toFixed(2)} | Cr: ₹{rosterSummary.totalCr.toFixed(2)}</span>
                  <span className="text-emerald-800 font-black text-sm">
                    Net AR: ₹{rosterSummary.netAR.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Print Specific CSS Styles: Comprehensive Light Mode Transformation for Printing & Offline PDF */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body, html, main, .min-h-screen {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          main {
            padding-top: 0 !important;
            margin-top: 0 !important;
          }
          header, nav, .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:flex {
            display: flex !important;
          }
          .print-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }

          /* Table styling & clean page breaks for A4 */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          thead {
            display: table-header-group !important;
          }
          tbody tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Universal Print Overrides for containers and cards */
          main div, main section, main article {
            box-shadow: none !important;
          }

          /* Background resets for any dark containers */
          main [class*="bg-slate-9"] {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }

          /* Border color fixes */
          main [class*="border-slate-"] {
            border-color: #cbd5e1 !important;
          }

          /* Text color overrides */
          main [class*="text-slate-1"],
          main [class*="text-slate-2"],
          main [class*="text-slate-3"],
          main [class*="text-slate-4"],
          main [class*="text-white"] {
            color: #0f172a !important;
          }

          /* High contrast color coding for print */
          main [class*="text-emerald-"] {
            color: #047857 !important;
          }
          main [class*="text-blue-"] {
            color: #1d4ed8 !important;
          }
          main [class*="text-purple-"] {
            color: #6b21a8 !important;
          }
          main [class*="text-amber-"] {
            color: #b45309 !important;
          }

          /* Table headers and totals background */
          main thead, main tr.bg-slate-900, main tr.bg-slate-100 {
            background-color: #f1f5f9 !important;
          }
        }
      `}</style>
    </>
  );
}
