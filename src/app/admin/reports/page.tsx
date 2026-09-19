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
import { compareBatchNames } from '@/services/batchService';

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
  const [vaultCash, setVaultCash] = useState(0);
  const [inchargeCash, setInchargeCash] = useState(0);
  const [totalLiquidCash, setTotalLiquidCash] = useState(0);
  const [bwPages, setBwPages] = useState(0);
  const [colorPages, setColorPages] = useState(0);

  // Income & Expenditure Date Range State
  const [ieStartDate, setIeStartDate] = useState<string>('');
  const [ieEndDate, setIeEndDate] = useState<string>('');
  const [defaultFyDates, setDefaultFyDates] = useState<{ start: string; end: string } | null>(null);

  // Student Ledger Summary Report State
  const [studentRoster, setStudentRoster] = useState<StudentWithDetails[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedBatches, setSelectedBatches] = useState<string[]>(['all']);
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState<boolean>(false);
  const [batchSearchTerm, setBatchSearchTerm] = useState<string>('');
  const [hideZeroBalanceStudents, setHideZeroBalanceStudents] = useState<boolean>(false);
  const [studentSortBy, setStudentSortBy] = useState<
    | 'batch'
    | 'amount_desc'
    | 'amount_asc'
    | 'name_asc'
    | 'name_desc'
  >('batch');

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
      let vCash = 0;
      let iCash = 0;

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
          if (accNameLower.includes('cash')) {
            if (accNameLower.includes('in-charge')) {
              iCash += (d - c);
            } else {
              vCash += (d - c);
            }
          }
        });
      });

      setTotalIncome(inc);
      setTotalExpense(exp);
      setVaultCash(vCash);
      setInchargeCash(iCash);
      setTotalLiquidCash(vCash + iCash);

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

        let formattedAccountName = acc.name;
        if (acc.name === 'Cash in Hand (In-Charge)') {
          formattedAccountName = 'Cash in Hand (In-Charge: Anfaz)';
        }

        return {
          accountId: acc.id,
          accountName: formattedAccountName,
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

      // Multi-Batch filter
      if (!selectedBatches.includes('all') && selectedBatches.length > 0) {
        const hasMatch = selectedBatches.some(
          (bId) => s.batch_id === bId || s.batch_name === bId
        );
        if (!hasMatch) return false;
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
      // Default: 'batch' (General → JD → HS → BS), then by name
      const batchCompare = compareBatchNames(a.batch_name, b.batch_name);
      if (batchCompare !== 0) return batchCompare;
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
  }, [studentRoster, studentSearchTerm, selectedBatches, hideZeroBalanceStudents, studentSortBy]);

  const uniqueBatchesInRoster = useMemo(() => {
    const bMap = new Map<string, { id: string; name: string; count: number }>();
    studentRoster.forEach((s) => {
      if (s.batch_name) {
        const key = s.batch_id || s.batch_name;
        if (!bMap.has(key)) {
          bMap.set(key, { id: key, name: s.batch_name, count: 0 });
        }
        bMap.get(key)!.count += 1;
      }
    });
    return Array.from(bMap.values()).sort((a, b) => compareBatchNames(a.name, b.name));
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 print:border-slate-300 pb-6 print:hidden">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Financial Reports Suite
            </h1>
            <p className="text-xs text-slate-500 print:text-slate-600 mt-1">
              Derived live from double-entry Postgres journal entry lines • Certified debit-credit balanced
            </p>
          </div>

          {/* PRINT / DOWNLOAD BUTTONS */}
          <div className="flex items-center gap-2 w-full sm:w-auto self-start sm:self-auto print:hidden">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="flex-1 sm:flex-initial justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2 whitespace-nowrap"
            >
              <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-initial justify-center bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Report
            </button>
          </div>
        </div>

        {/* REPORT TAB SELECTOR (Hidden in Print) */}
        <div className="flex bg-slate-100 border border-slate-200 p-1.5 rounded-2xl print:hidden overflow-x-auto gap-1.5 items-center">
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
                  ? 'bg-slate-900 text-white shadow-xs border border-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
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
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 print:hidden border-b border-slate-200 pb-2">
              Reports Overview & Print Job Metrics
            </h2>

            {/* ON-SCREEN BOXED CARDS VIEW (Hidden when printing) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 print:hidden">
              {/* Card 1: Total Service Income */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Service Income</span>
                <span className="text-xl font-black text-emerald-700 font-mono mt-0.5 flex items-center gap-0.5">
                  <span className="font-sans">₹</span>
                  <span className="font-mono">{Math.abs(totalIncome).toFixed(2)}</span>
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Printing Revenue</span>
              </div>

              {/* Card 2: Total Expense */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Expense</span>
                <span className="text-xl font-black text-slate-900 font-mono mt-0.5 flex items-center gap-0.5">
                  <span className="font-sans">₹</span>
                  <span className="font-mono">{Math.abs(totalExpense).toFixed(2)}</span>
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Paper, Ink, Maintenance</span>
              </div>

              {/* Card 3: Vault / Bank Cash */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Vault / Bank Cash</span>
                <span className="text-xl font-black text-slate-900 font-mono mt-0.5 flex items-center gap-0.5">
                  <span className="font-sans">₹</span>
                  <span className="font-mono">{Math.abs(vaultCash).toFixed(2)}</span>
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Main Admin Vault</span>
              </div>

              {/* Card 4: Desk Cash / Incharge */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Desk Cash / Incharge</span>
                <span className="text-xl font-black text-slate-900 font-mono mt-0.5 flex items-center gap-0.5">
                  <span className="font-sans">₹</span>
                  <span className="font-mono">{Math.abs(inchargeCash).toFixed(2)}</span>
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Front Desk Till</span>
              </div>

              {/* Card 5: Total Liquid Cash */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
                <span className="text-[10px] font-bold text-indigo-500 uppercase block">Total Liquid Cash</span>
                <span className="text-xl font-black text-indigo-900 font-mono mt-0.5 flex items-center gap-0.5">
                  <span className="font-sans">₹</span>
                  <span className="font-mono">{Math.abs(totalLiquidCash).toFixed(2)}</span>
                </span>
                <span className="text-[10px] text-indigo-500 mt-0.5 block">Combined Pool</span>
              </div>

              {/* Card 4: Pages Printed (B/W) */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Pages Printed (B/W)</span>
                <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">
                  {bwPages}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Black & White Total</span>
              </div>

              {/* Card 5: Pages Printed (Color) */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Pages Printed (Color)</span>
                <span className="text-xl font-black text-emerald-700 font-mono mt-0.5 block">
                  {colorPages}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Color Print Total</span>
              </div>
            </div>

          </div>
        )}

        {/* 2. TRIAL BALANCE REPORT */}
        {(activeReportTab === 'trial' || activeReportTab === 'overview') && (
          <div className="space-y-4 pt-6 border-t border-slate-200 print:border-t-0 print:pt-0 print:mt-0">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 print:text-2xl print:font-black print:text-slate-900">Trial Balance</h2>
              <p className="text-xs text-slate-500 print:hidden mt-0.5">Verification of total debit balances matching total credit balances across all active accounts.</p>
              <p className="hidden print:block text-xs font-mono text-slate-600 font-semibold mt-0.5 mb-2">
                {ieStartDate && ieEndDate ? `${formatDate(ieStartDate)} to ${formatDate(ieEndDate)}` : ''}
              </p>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs bg-white print:border-slate-300 print:shadow-none">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase print:bg-slate-100 print:text-slate-900 print:border-slate-300">
                  <tr>
                    <th className="p-3.5">Account Title</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5 text-right">Debit Balance (₹)</th>
                    <th className="p-3.5 text-right">Credit Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* General Ledger Accounts (Filtered to non-zero) */}
                  {displayedGeneralAccounts.map((r) => (
                    <tr key={r.accountId} className="hover:bg-slate-50/80 transition-colors print:hover:bg-transparent">
                      <td className="p-3.5 font-sans font-bold text-slate-900">{r.accountName}</td>
                      <td className="p-3.5 text-slate-500 font-bold text-[10px]">{r.accountType}</td>
                      <td className="p-3.5 text-right text-emerald-700 font-bold">
                        {r.debitBalance > 0 ? `₹${r.debitBalance.toFixed(2)}` : ''}
                      </td>
                      <td className="p-3.5 text-right text-slate-800 font-bold">
                        {r.creditBalance > 0 ? `₹${r.creditBalance.toFixed(2)}` : ''}
                      </td>
                    </tr>
                  ))}

                  {/* Student Debit Balances (Receivables - Asset) */}
                  {showStudentARInTB && (
                    <tr className="hover:bg-slate-50/80 transition-colors print:hover:bg-transparent">
                      <td className="p-3.5 font-sans font-bold text-slate-900">Student Accounts Receivable</td>
                      <td className="p-3.5 text-slate-500 font-bold text-[10px]">ASSET</td>
                      <td className="p-3.5 text-right text-emerald-700 font-bold">
                        ₹{studentTotalDebit.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right text-slate-500 font-bold"></td>
                    </tr>
                  )}

                  {/* Student Credit Balances (Payables - Liability) */}
                  {showStudentPayableInTB && (
                    <tr className="hover:bg-slate-50/80 transition-colors print:hover:bg-transparent">
                      <td className="p-3.5 font-sans font-bold text-amber-800">Due to Students (Overpayments / Refund Due)</td>
                      <td className="p-3.5 text-amber-700 font-bold text-[10px]">LIABILITY</td>
                      <td className="p-3.5 text-right text-slate-500 font-bold"></td>
                      <td className="p-3.5 text-right text-amber-700 font-bold">
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
                  <tr className="bg-slate-100 font-black text-sm border-t-2 border-slate-300 text-slate-900 print:bg-slate-100 print:text-slate-900 print:border-slate-400">
                    <td colSpan={2} className="p-3.5 font-sans uppercase">
                      Total Trial Balance
                    </td>
                    <td className="p-3.5 text-right text-emerald-700 font-mono">
                      ₹{totalTbDebit.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right text-slate-900 font-mono">
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
          <div className="space-y-6 pt-6 border-t border-slate-200 print:border-slate-300 print:pt-4 print:mt-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 print:text-2xl print:font-black print:text-slate-900">Income & Expenditure Account</h2>
                <p className="text-xs text-slate-500 print:hidden mt-0.5">
                  Statement of income and expenditure for the period, resulting in a surplus or deficit
                </p>
                <p className="hidden print:block text-xs font-mono text-slate-600 font-semibold mt-0.5 mb-2">
                  Period: {ieStartDate && ieEndDate ? `${formatDate(ieStartDate)} to ${formatDate(ieEndDate)}` : ''}
                </p>
              </div>

              {/* Date Range Selector */}
              <div className="flex items-center gap-3 bg-white border border-slate-200 p-2.5 rounded-2xl print:hidden shadow-xs">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-bold text-slate-600 print:text-slate-700">From:</span>
                  <CustomDateInput
                    value={ieStartDate}
                    onChange={(val) => setIeStartDate(val)}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-bold text-slate-600 print:text-slate-700">To:</span>
                  <CustomDateInput
                    value={ieEndDate}
                    onChange={(val) => setIeEndDate(val)}
                  />
                </div>
                {(ieStartDate !== defaultFyDates?.start || ieEndDate !== defaultFyDates?.end) && (
                  <button
                    type="button"
                    onClick={resetIeDateRange}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline font-mono print:hidden px-1"
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
              <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs space-y-4 print:border-slate-300 print:shadow-none">
                <h3 className="text-md font-bold text-slate-900 font-mono uppercase border-b border-slate-200 print:border-slate-300 pb-2 flex justify-between items-center">
                  <span>INCOME</span>
                  <span className="text-xs text-emerald-700 font-normal">Credits</span>
                </h3>

                <div className="space-y-2 text-xs font-mono">
                  {displayedIncomeAccounts.length === 0 ? (
                    <div className="text-slate-500 text-center py-4 italic font-sans text-xs">No income account activity recorded for this period</div>
                  ) : (
                    displayedIncomeAccounts.map((inc) => (
                      <div key={inc.id} className="flex justify-between py-1.5 border-b border-slate-200 text-slate-800">
                        <span className="font-sans font-semibold text-slate-900">{inc.name}</span>
                        <span className="font-bold text-emerald-700">₹{inc.amount.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-4 border-t-2 border-slate-300 flex justify-between items-center text-sm font-black font-mono">
                  <span className="font-sans text-slate-900">TOTAL INCOME</span>
                  <span className="text-emerald-700">₹{totalPeriodIncome.toFixed(2)}</span>
                </div>
              </div>

              {/* EXPENDITURE CARD */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs space-y-4 print:border-slate-300 print:shadow-none">
                <h3 className="text-md font-bold text-slate-900 font-mono uppercase border-b border-slate-200 print:border-slate-300 pb-2 flex justify-between items-center">
                  <span>EXPENDITURE</span>
                  <span className="text-xs text-slate-600 font-normal">Debits</span>
                </h3>

                <div className="space-y-2 text-xs font-mono">
                  {displayedExpenditureAccounts.length === 0 ? (
                    <div className="text-slate-500 text-center py-4 italic font-sans text-xs">No expenditure account activity recorded for this period</div>
                  ) : (
                    displayedExpenditureAccounts.map((exp) => (
                      <div key={exp.id} className="flex justify-between py-1.5 border-b border-slate-200 text-slate-800">
                        <span className="font-sans font-semibold text-slate-900">{exp.name}</span>
                        <span className="font-bold text-slate-900">₹{exp.amount.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-4 border-t-2 border-slate-300 flex justify-between items-center text-sm font-black font-mono">
                  <span className="font-sans text-slate-900">TOTAL EXPENDITURE</span>
                  <span className="text-slate-900">₹{totalPeriodExpenditure.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* DYNAMIC SURPLUS / (DEFICIT) SUMMARY BOX */}
            <div className={`border rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3 print:bg-white print:shadow-none ${
              periodNetSurplus >= 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="font-sans text-center sm:text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                  Period Financial Result ({ieStartDate ? formatDate(ieStartDate) : 'All-time'} to {ieEndDate ? formatDate(ieEndDate) : 'Present'})
                </span>
                <span className="text-base font-black text-slate-900 mt-0.5 block">
                  {periodNetSurplus >= 0 ? 'NET SURPLUS FOR THE PERIOD' : 'NET DEFICIT FOR THE PERIOD'}
                </span>
              </div>

              <div className="font-mono text-2xl font-black">
                <span className={periodNetSurplus >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                  {periodNetSurplus >= 0 ? `₹${periodNetSurplus.toFixed(2)}` : `(₹${Math.abs(periodNetSurplus).toFixed(2)})`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. BALANCE SHEET REPORT */}
        {(activeReportTab === 'balance_sheet' || activeReportTab === 'overview') && (
          <div className="space-y-4 pt-6 border-t border-slate-200 print:border-slate-300 print:pt-4 print:mt-0">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 print:text-2xl print:font-black print:text-slate-900">Statement of Financial Position</h2>
              <p className="text-xs text-slate-500 print:hidden mt-0.5">Non-profit Statement of Financial Position representing Net Assets and Fund Balances.</p>
              <p className="hidden print:block text-xs font-mono text-slate-600 font-semibold mt-0.5 mb-2">
                Period: {ieStartDate && ieEndDate ? `${formatDate(ieStartDate)} to ${formatDate(ieEndDate)}` : ''}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ASSETS COLUMN */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs space-y-4 print:border-slate-300 print:shadow-none">
                <h3 className="text-md font-bold text-slate-900 font-mono uppercase border-b border-slate-200 print:border-slate-300 pb-2">
                  Assets (Debits)
                </h3>
                <div className="space-y-2 text-xs font-mono">
                  {/* General Non-Student Asset Accounts (Filtered to non-zero) */}
                  {displayedGeneralAssetAccounts.map((a) => (
                    <div key={a.accountId} className="flex justify-between py-1.5 border-b border-slate-200 text-slate-800">
                      <span className="font-sans font-semibold text-slate-900">{a.accountName}</span>
                      <span className="font-bold text-slate-900">₹{a.debitBalance.toFixed(2)}</span>
                    </div>
                  ))}

                  {/* Single Line for Student Accounts Receivable */}
                  {showStudentARInBS && (
                    <div className="flex justify-between py-1.5 border-b border-slate-200 text-slate-800">
                      <span className="font-sans font-bold text-slate-900">Student Accounts Receivable</span>
                      <span className="font-bold text-emerald-700">₹{studentTotalDebit.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Empty state for Assets */}
                  {displayedGeneralAssetAccounts.length === 0 && !showStudentARInBS && (
                    <div className="text-slate-500 text-center py-4 italic font-sans text-xs">No asset account activity recorded for this period</div>
                  )}
                </div>

                <div className="pt-4 border-t-2 border-slate-300 flex justify-between items-center text-sm font-black font-mono">
                  <span className="font-sans text-slate-900">TOTAL ASSETS</span>
                  <span className="text-emerald-700">₹{totalAssets.toFixed(2)}</span>
                </div>
              </div>

              {/* LIABILITIES & EQUITY / FUND BALANCE COLUMN */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs space-y-4 print:border-slate-300 print:shadow-none">
                <h3 className="text-md font-bold text-slate-900 font-mono uppercase border-b border-slate-200 print:border-slate-300 pb-2">
                  Liabilities & Fund Balance (Credits)
                </h3>
                <div className="space-y-3 text-xs font-mono">
                  {/* Section A: Liabilities & Payables */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block font-sans">
                      Liabilities & Student Obligations
                    </span>
                    {showStudentPayableInBS && (
                      <div className="flex justify-between py-1.5 border-b border-slate-200 text-amber-800">
                        <span className="font-sans font-bold">Due to Students (Overpayment Refund Due)</span>
                        <span className="font-bold">₹{studentTotalCredit.toFixed(2)}</span>
                      </div>
                    )}
                    {displayedGeneralLiabilityAccounts.map((l) => (
                      <div key={l.accountId} className="flex justify-between py-1.5 border-b border-slate-200 text-slate-800">
                        <span className="font-sans font-semibold text-slate-900">{l.accountName}</span>
                        <span className="font-bold text-slate-900">₹{l.creditBalance.toFixed(2)}</span>
                      </div>
                    ))}
                    {!showStudentPayableInBS && displayedGeneralLiabilityAccounts.length === 0 && (
                      <div className="text-slate-500 text-center py-2 italic font-sans text-[11px]">No liability account activity recorded for this period</div>
                    )}
                  </div>

                  {/* Section B: Fund Balance & Net Assets */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-700 tracking-wider block font-sans">
                      Equity & Net Assets
                    </span>
                    {displayedEquityAccounts.map((e) => (
                      <div key={e.accountId} className="flex justify-between py-1.5 border-b border-slate-200 text-slate-800">
                        <span className="font-sans font-semibold text-slate-900">{e.accountName}</span>
                        <span className="font-bold text-slate-900">₹{e.creditBalance.toFixed(2)}</span>
                      </div>
                    ))}
                    {showNetSurplusInBS && (
                      <div className={`flex justify-between py-1.5 border-b border-slate-200 ${
                        netSurplus >= 0 ? 'text-emerald-700' : 'text-red-700'
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

                <div className="pt-4 border-t-2 border-slate-300 flex justify-between items-center text-sm font-black font-mono">
                  <span className="font-sans text-slate-900">TOTAL LIABILITIES & EQUITY</span>
                  <span className="text-slate-900">₹{totalLiabilitiesAndEquity.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* BALANCE SHEET TALLY VERIFICATION STATUS */}
            <div className={`p-4 rounded-2xl border text-xs font-mono font-bold flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs print:border-slate-300 ${
              isBalanceSheetTallied
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}>
              <div className="flex items-center gap-2 font-sans">
                <span className="text-base">{isBalanceSheetTallied ? '✓' : '⚠️'}</span>
                <span>
                  FINANCIAL POSITION STATUS:{' '}
                  <strong className={isBalanceSheetTallied ? 'text-emerald-800' : 'text-red-700'}>
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
          <div className="space-y-4 pt-6 border-t border-slate-200 print:border-slate-300 print:pt-0 print:border-t-0">
            {/* PRINT-ONLY SIMPLE HEADING */}
            <div className="hidden print:block mb-3 border-b-2 border-gray-800 pb-2">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase">STATEMENT OF STUDENT BALANCES</h1>
                </div>
                <span className="text-[11px] font-mono text-gray-600">
                  Generated: {formatDate(new Date().toISOString())}
                </span>
              </div>
            </div>

            <div className="space-y-3 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Student Ledger Summary (Debit Book Report)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Complete student roster with live double-entry balances, receivables, and refund obligations.
                  </p>
                </div>
              </div>

              {/* Filtering & Sorting Toolbar (Hidden on Print) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[180px]">
                    <input
                      type="text"
                      placeholder="Search student or phone..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>

                  {/* Multi-Batch Filter Popover */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsBatchDropdownOpen((prev) => !prev)}
                      className="w-full sm:w-auto bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 hover:border-slate-300 focus:outline-none focus:border-emerald-500 transition-all font-semibold flex items-center justify-between gap-2 shadow-xs cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="text-slate-500">🎓</span>
                        <span>
                          {selectedBatches.includes('all') || selectedBatches.length === 0
                            ? 'All Batches'
                            : selectedBatches.length === 1
                            ? `Batch: ${uniqueBatchesInRoster.find((b) => selectedBatches.includes(b.id))?.name || 'Selected'}`
                            : `${selectedBatches.length} Batches Selected`}
                        </span>
                      </span>
                      <span className="text-slate-400 text-[10px]">▼</span>
                    </button>

                    {isBatchDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsBatchDropdownOpen(false)}
                        />
                        <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2.5 space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
                            <span className="font-bold text-slate-900">Filter Batches</span>
                            <div className="flex gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() => setSelectedBatches(['all'])}
                                className="text-emerald-700 font-bold hover:underline"
                              >
                                Select All
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => setSelectedBatches([])}
                                className="text-slate-500 hover:underline"
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          {uniqueBatchesInRoster.length > 5 && (
                            <input
                              type="text"
                              placeholder="Search batch..."
                              value={batchSearchTerm}
                              onChange={(e) => setBatchSearchTerm(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                            />
                          )}

                          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                            {/* All Batches Option */}
                            <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-slate-800 font-medium">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedBatches.includes('all') || selectedBatches.length === uniqueBatchesInRoster.length}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedBatches(['all']);
                                    else setSelectedBatches([]);
                                  }}
                                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span>All Batches</span>
                              </div>
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {studentRoster.length}
                              </span>
                            </label>

                            <hr className="border-slate-100 my-1" />

                            {uniqueBatchesInRoster
                              .filter((b) => !batchSearchTerm || b.name.toLowerCase().includes(batchSearchTerm.toLowerCase()))
                              .map((b) => {
                                const isChecked = !selectedBatches.includes('all') && selectedBatches.includes(b.id);
                                return (
                                  <label
                                    key={b.id}
                                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-slate-800"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          let next: string[];
                                          if (selectedBatches.includes('all')) {
                                            next = uniqueBatchesInRoster.map((item) => item.id);
                                          } else {
                                            next = [...selectedBatches];
                                          }
                                          if (e.target.checked) {
                                            if (!next.includes(b.id)) next.push(b.id);
                                          } else {
                                            next = next.filter((id) => id !== b.id);
                                          }
                                          if (next.length === uniqueBatchesInRoster.length) {
                                            setSelectedBatches(['all']);
                                          } else {
                                            setSelectedBatches(next);
                                          }
                                        }}
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <span className="truncate font-semibold text-[11px]">{b.name}</span>
                                    </div>
                                    <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                      {b.count}
                                    </span>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* SORT CONTROL DROPDOWN */}
                  <div className="relative">
                    <select
                      value={studentSortBy}
                      onChange={(e) => setStudentSortBy(e.target.value as any)}
                      className="appearance-none w-full sm:w-auto bg-white border border-slate-200 rounded-xl pl-8 pr-8 py-2 text-xs font-semibold text-slate-800 hover:border-slate-300 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer shadow-xs"
                    >
                      <option value="batch" className="bg-white text-slate-900">
                        Sort: By Batch (General → JD → HS → BS)
                      </option>
                      <option value="amount_desc" className="bg-white text-slate-900">
                        Sort: Balance: High to Low
                      </option>
                      <option value="amount_asc" className="bg-white text-slate-900">
                        Sort: Balance: Low to High
                      </option>
                      <option value="name_asc" className="bg-white text-slate-900">
                        Sort: Student Name (A → Z)
                      </option>
                      <option value="name_desc" className="bg-white text-slate-900">
                        Sort: Student Name (Z → A)
                      </option>
                    </select>
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                      </svg>
                    </div>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Hide Zero Balance Checkbox */}
                <label className="flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-700 cursor-pointer bg-white border border-slate-200 px-3.5 py-2 rounded-xl hover:border-slate-300 transition-all whitespace-nowrap shrink-0">
                  <input
                    type="checkbox"
                    checked={hideZeroBalanceStudents}
                    onChange={(e) => setHideZeroBalanceStudents(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 bg-white"
                  />
                  <span className="font-medium text-[11px]">Hide ₹0.00 Balances</span>
                </label>
              </div>
            </div>

            {/* Student Roster Report Table (On-Screen View Only) */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white print:hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs font-mono">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="p-3.5 whitespace-nowrap">#</th>
                      <th
                        onClick={() => setStudentSortBy(studentSortBy === 'name_asc' ? 'name_desc' : 'name_asc')}
                        className="p-3.5 cursor-pointer hover:text-emerald-700 transition-colors select-none whitespace-nowrap"
                        title="Click to sort by Name"
                      >
                        Student Name {studentSortBy === 'name_asc' ? '▲' : studentSortBy === 'name_desc' ? '▼' : ''}
                      </th>
                      <th
                        onClick={() => setStudentSortBy('batch')}
                        className="p-3.5 cursor-pointer hover:text-emerald-700 transition-colors select-none whitespace-nowrap"
                        title="Click to sort by Batch"
                      >
                        Batch {studentSortBy === 'batch' ? '✓' : ''}
                      </th>
                      <th className="p-3.5 whitespace-nowrap">Phone Number</th>
                      <th className="p-3.5 whitespace-nowrap">Account Status</th>
                      <th
                        onClick={() => setStudentSortBy(studentSortBy === 'amount_desc' ? 'amount_asc' : 'amount_desc')}
                        className="p-3.5 text-right cursor-pointer hover:text-emerald-700 transition-colors select-none whitespace-nowrap"
                        title="Click to sort by Balance (High to Low / Low to High)"
                      >
                        Net Balance (₹) {studentSortBy === 'amount_desc' ? '▼ (High → Low)' : studentSortBy === 'amount_asc' ? '▲ (Low → High)' : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
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
                          <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5 text-slate-500 whitespace-nowrap">{idx + 1}</td>
                            <td className="p-3.5 font-sans font-bold text-slate-900 whitespace-nowrap">{student.name}</td>
                            <td className="p-3.5 text-slate-600 font-bold text-[11px] whitespace-nowrap">{student.batch_name}</td>
                            <td className="p-3.5 text-slate-600 whitespace-nowrap">{student.phone}</td>
                            <td className="p-3.5 whitespace-nowrap">
                              {balInfo.isZero ? (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold font-sans border border-slate-200">
                                  Settled (₹0.00)
                                </span>
                              ) : balInfo.isCredit ? (
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold font-sans border border-amber-200">
                                  Refund Due
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold font-sans border border-emerald-200">
                                  Payment Pending
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-right font-bold font-mono whitespace-nowrap">
                              {balInfo.isZero ? (
                                <span className="text-slate-500">₹0.00</span>
                              ) : balInfo.isCredit ? (
                                <span className="text-amber-700">{balInfo.formatted}</span>
                              ) : (
                                <span className="text-emerald-700">{balInfo.formatted}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* On-Screen 6-Column Summary Row (Single overall total at the bottom) */}
                    <tr className="bg-slate-100 font-black text-xs border-t-2 border-slate-300 text-slate-900">
                      <td colSpan={4} className="p-3.5 font-sans uppercase whitespace-nowrap">
                        Total Roster Summary ({rosterSummary.count} Students)
                      </td>
                      <td className="p-3.5 text-slate-700 font-mono text-[11px] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span>Dr: ₹{rosterSummary.totalDr.toFixed(2)}</span>
                          <span className="text-slate-400">|</span>
                          <span>Cr: ₹{rosterSummary.totalCr.toFixed(2)}</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-right text-emerald-700 font-mono text-sm whitespace-nowrap">
                        Net AR: ₹{rosterSummary.netAR.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Mobile & Desktop Docked Summary Footer Bar */}
              <div className="bg-slate-50 border-t-2 border-slate-300 p-2.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="font-sans uppercase font-bold text-slate-800 text-[11px] sm:text-xs tracking-wider whitespace-nowrap">
                    Total Roster Summary ({rosterSummary.count} Students)
                  </span>
                </div>
                <div className="flex items-center text-slate-700 flex-nowrap overflow-x-auto">
                  <div className="inline-flex items-center gap-2 sm:gap-2.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs text-[11px] font-mono whitespace-nowrap">
                    <span>
                      Dr: <span className="text-slate-900 font-bold">₹{rosterSummary.totalDr.toFixed(2)}</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span>
                      Cr: <span className="text-slate-900 font-bold">₹{rosterSummary.totalCr.toFixed(2)}</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-black">
                      <span className="text-emerald-800 font-semibold text-[10px]">Net AR:</span>
                      <span>₹{rosterSummary.netAR.toFixed(2)}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* PRINT-ONLY SINGLE UNIFIED 3-COLUMN TABLE VIEW */}
            <div className="hidden print:block space-y-4 print:p-0 print:shadow-none">
              {filteredStudentRoster.length === 0 ? (
                <div className="p-4 text-center text-gray-500 italic font-sans text-xs border border-gray-300 rounded-lg">
                  No student records match the selected filters.
                </div>
              ) : (
                <table className="w-full text-left border-collapse border border-gray-300 table-fixed">
                  <tbody className="divide-y divide-gray-300">
                    {Array.from({ length: Math.ceil(filteredStudentRoster.length / 3) }).map((_, rowIndex) => {
                      const c1 = filteredStudentRoster[rowIndex * 3];
                      const c2 = filteredStudentRoster[rowIndex * 3 + 1];
                      const c3 = filteredStudentRoster[rowIndex * 3 + 2];
                      
                      const renderCell = (student: typeof filteredStudentRoster[0] | undefined, isLast: boolean) => {
                        if (!student) return <td className={`w-1/3 p-0 align-top ${!isLast ? 'border-r border-gray-300' : ''}`}></td>;
                        const balInfo = formatStudentBalance(student.balance, { showDrCr: true, context: 'admin' });
                        return (
                          <td className={`w-1/3 p-0 align-top ${!isLast ? 'border-r border-gray-300' : ''}`}>
                            <div className="flex justify-between items-center py-1 px-2 min-w-0">
                              <div className="flex items-baseline gap-1 min-w-0 leading-tight">
                                <span className="text-[10.5px] font-semibold text-gray-900 leading-tight">
                                  {student.name}
                                </span>
                                <span className="text-[9.5px] text-gray-500 font-normal shrink-0">
                                  {student.batch_name}
                                </span>
                              </div>
                              <span className="text-[10.5px] font-medium text-gray-800 shrink-0 ml-1 whitespace-nowrap text-right font-mono">
                                {balInfo.isZero ? '₹0.00' : balInfo.formatted}
                              </span>
                            </div>
                          </td>
                        );
                      };

                      return (
                        <tr key={rowIndex} className="break-inside-avoid">
                          {renderCell(c1, false)}
                          {renderCell(c2, false)}
                          {renderCell(c3, true)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Total Summary Box */}
              {filteredStudentRoster.length > 0 && (
                <div className="mt-4 border-2 border-gray-800 rounded-sm p-2 flex justify-between items-center break-inside-avoid">
                  <span className="font-bold text-sm text-gray-900 uppercase">
                    Total Outstanding ({rosterSummary.count} students)
                  </span>
                  <span className="font-bold text-sm text-gray-900 font-mono">
                    Net AR: ₹{rosterSummary.netAR.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="mt-6 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest break-inside-avoid">
                *** END OF REPORT &middot; LAB ACCOUNTING ***
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
