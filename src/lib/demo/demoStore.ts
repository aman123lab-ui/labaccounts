import { Student, Account, Batch, AccountType } from '@/types/database.types';
import {
  createInitialDemoDataset,
  DemoDataSet,
  DemoJournalEntry,
  DemoJournalEntryLine,
  DemoPaymentClaim,
  DemoFinancialYear,
} from './demoData';
import { sortBatches, compareBatchNames } from '@/services/batchService';
import { normalizePhone, formatStudentName } from '@/services/authService';

let activeGuestMode = false;
let demoState: DemoDataSet | null = null;

export function isGuestMode(): boolean {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const isUrlGuest = urlParams.get('demo') === 'true' || urlParams.get('guest') === 'true';
    const isSessionGuest = sessionStorage.getItem('guest_mode') === 'true';

    if (isUrlGuest || isSessionGuest) {
      if (!activeGuestMode || !demoState) {
        enableGuestMode();
      }
      return true;
    }
  }
  return activeGuestMode;
}

export function enableGuestMode(): void {
  activeGuestMode = true;
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('guest_mode', 'true');
  }
  if (!demoState) {
    // Generate fresh dataset with today's dates each time demo starts
    demoState = createInitialDemoDataset();
  }
}

export function setGuestRole(role: 'admin' | 'student' | 'incharge'): void {
  enableGuestMode();
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('guest_role', role);
    localStorage.setItem('lab_user_role', role);

    if (role === 'student') {
      localStorage.setItem('lab_student_id', 'student-aarav-01');
      localStorage.setItem('lab_student_name', 'Aarav Sharma');
      localStorage.setItem('lab_student_phone', '9876543210');
    } else if (role === 'incharge') {
      localStorage.setItem('lab_incharge_email', 'incharge@lab.com');
      localStorage.setItem('lab_incharge_name', 'Yaseen');
      localStorage.setItem('lab_incharge_staff_id', '4821');
    } else if (role === 'admin') {
      localStorage.setItem('lab_admin_email', 'admin@lab.com');
    }
  }
}

export function disableGuestMode(): void {
  activeGuestMode = false;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('guest_mode');
    sessionStorage.removeItem('guest_role');
    localStorage.removeItem('lab_user_role');
    localStorage.removeItem('lab_student_id');
    localStorage.removeItem('lab_student_name');
    localStorage.removeItem('lab_student_phone');
    localStorage.removeItem('lab_incharge_email');
    localStorage.removeItem('lab_incharge_name');
    localStorage.removeItem('lab_incharge_staff_id');
    localStorage.removeItem('lab_admin_email');
  }
  demoState = null;
}

function getStore(): DemoDataSet {
  if (!demoState) {
    enableGuestMode();
  }
  return demoState!;
}

function saveStore(store: DemoDataSet): void {
  demoState = store;
}

// ----------------------------------------------------
// BATCHES
// ----------------------------------------------------
export function getDemoBatches(): Batch[] {
  const store = getStore();
  return sortBatches([...store.batches]);
}

export function createDemoBatch(name: string, category = 'General'): Batch {
  const store = getStore();
  const id = `batch-demo-${Date.now()}`;
  const newBatch: Batch = {
    id,
    name: name.trim(),
    category,
    sort_order: store.batches.length + 1,
    created_at: new Date().toISOString(),
  };
  store.batches.push(newBatch);
  return newBatch;
}

export function updateDemoBatch(id: string, data: { name: string; category?: string }): { success: boolean; error?: string } {
  const store = getStore();
  const b = store.batches.find((item) => item.id === id);
  if (!b) return { success: false, error: 'Batch not found' };
  b.name = data.name.trim();
  if (data.category) b.category = data.category;
  return { success: true };
}

export function deleteDemoBatch(id: string): { success: boolean; error?: string } {
  const store = getStore();
  const students = store.students.filter((s) => s.batch_id === id);
  const activeCount = students.filter((s) => s.status === 'active').length;
  if (activeCount > 0) {
    return {
      success: false,
      error: `Cannot delete batch — ${activeCount} active student${activeCount > 1 ? 's are' : ' is'} currently assigned to it.`,
    };
  }
  const totalCount = students.length;
  if (totalCount > 0) {
    return {
      success: false,
      error: `Cannot delete batch — ${totalCount} student record${totalCount > 1 ? 's (including archived) are' : ' is'} linked to this batch.`,
    };
  }
  store.batches = store.batches.filter((b) => b.id !== id);
  saveStore(store);
  return { success: true };
}

// ----------------------------------------------------
// STUDENTS
// ----------------------------------------------------
export function getDemoStudents(options?: { status?: 'active' | 'archived'; search?: string }) {
  const store = getStore();
  const targetStatus = options?.status || 'active';

  let list = store.students.filter((s) => s.status === targetStatus);

  // Compute balance per student
  const studentAccountMap = new Map<string, string>(); // studentId -> accountId
  store.accounts.forEach((acc) => {
    if (acc.student_id) studentAccountMap.set(acc.student_id, acc.id);
  });

  const accountBalanceMap = new Map<string, number>();
  store.journalEntries.forEach((je) => {
    if (je.voided_at) return;
    je.lines.forEach((l) => {
      const cur = accountBalanceMap.get(l.account_id) || 0;
      const net = l.debit_amount - l.credit_amount;
      accountBalanceMap.set(l.account_id, cur + net);
    });
  });

  const result = list.map((s) => {
    const batchObj = store.batches.find((b) => b.id === s.batch_id);
    const accountId = studentAccountMap.get(s.id);
    const balance = accountId ? accountBalanceMap.get(accountId) || 0 : 0;
    return {
      ...s,
      batch_name: batchObj?.name || 'Unassigned',
      account_id: accountId,
      balance,
    };
  });

  // Sort by Batch category order: General -> JD -> HS -> BS, then numerically within batch, then student name
  result.sort((a, b) => {
    const batchA = store.batches.find((bObj) => bObj.id === a.batch_id);
    const batchB = store.batches.find((bObj) => bObj.id === b.batch_id);
    const batchCmp = compareBatchNames(a.batch_name, b.batch_name, batchA?.category, batchB?.category);
    if (batchCmp !== 0) return batchCmp;
    return (a.name || '').localeCompare(b.name || '');
  });

  if (options?.search && options.search.trim()) {
    const term = options.search.trim().toLowerCase();
    const cleanTermPhone = normalizePhone(term);
    return result.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(term);
      const batchMatch = s.batch_name.toLowerCase().includes(term);
      const phoneMatch = cleanTermPhone ? s.phone.includes(cleanTermPhone) : s.phone.includes(term);
      return nameMatch || batchMatch || phoneMatch;
    });
  }

  return result;
}

export function getDemoStudentDetailsAndBalance(identifier: { studentId?: string; phone?: string }) {
  const store = getStore();
  let studentData = store.students.find((s) => s.id === identifier.studentId);
  if (!studentData && identifier.phone) {
    const clean = normalizePhone(identifier.phone);
    studentData = store.students.find((s) => s.phone === clean);
  }

  if (!studentData) return null;

  const batchObj = store.batches.find((b) => b.id === studentData!.batch_id);
  const student = {
    ...studentData,
    batch_name: batchObj?.name || 'Unassigned',
  };

  const account = store.accounts.find((a) => a.student_id === student.id);
  if (!account) {
    return { student, accountId: null, balance: 0, transactions: [] };
  }

  // Calculate transactions & running balance
  let balance = 0;
  const transactions: { id: string; date: string; description: string; debit: number; credit: number; runningBalance: number }[] = [];

  const relevantEntries = store.journalEntries.filter((je) => !je.voided_at);
  relevantEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  relevantEntries.forEach((je) => {
    je.lines.forEach((l) => {
      if (l.account_id === account.id) {
        balance += (l.debit_amount - l.credit_amount);
        let desc = je.description;

        const isCashInchargeLine = je.lines.some((other) => other.account_id === '10000000-0000-0000-0000-000000000003');
        if (l.credit_amount > 0 && isCashInchargeLine && !desc.toLowerCase().includes('collected by')) {
          desc = `${desc} — collected by Staff In-Charge`;
        }

        transactions.push({
          id: l.id,
          date: new Date(je.date).toLocaleDateString('en-GB'),
          description: desc,
          debit: l.debit_amount,
          credit: l.credit_amount,
          runningBalance: balance,
        });
      }
    });
  });

  return {
    student,
    accountId: account.id,
    balance,
    transactions,
  };
}

export function getDemoStudentStatement(studentId: string) {
  const res = getDemoStudentDetailsAndBalance({ studentId });
  return {
    student: res?.student || null,
    accountId: res?.accountId || null,
    balance: res?.balance || 0,
    transactions: res?.transactions || [],
  };
}

export function registerDemoStudentSingle(input: { name: string; phone: string; password: string; batchId: string }) {
  const store = getStore();
  const cleanPhone = normalizePhone(input.phone);
  const cleanName = formatStudentName(input.name);

  const existing = store.students.find((s) => s.phone === cleanPhone);
  if (existing) {
    return { success: false, error: `Phone number '${input.phone}' is already registered.` };
  }

  const studentId = `student-demo-${Date.now()}`;
  const newStudent: Student = {
    id: studentId,
    name: cleanName,
    phone: cleanPhone,
    password_hash: input.password,
    batch_id: input.batchId,
    status: 'active',
    created_at: new Date().toISOString(),
  };
  store.students.push(newStudent);

  // Dedicated AR Account
  const accountId = `acc-ar-demo-${Date.now()}`;
  store.accounts.push({
    id: accountId,
    name: `${cleanName} - Accounts Receivable`,
    type: 'asset',
    is_student_account: true,
    student_id: studentId,
    created_at: new Date().toISOString(),
  });

  return { success: true, student: newStudent };
}

export function registerDemoStudentsBulk(rows: { name: string; batch: string; phone: string; balance: number; password: string }[]) {
  const store = getStore();
  let successCount = 0;
  let failureCount = 0;
  let openingBalancesPosted = 0;
  const rowResults: any[] = [];

  rows.forEach((row, i) => {
    const cleanPhone = normalizePhone(row.phone || '');
    const cleanName = formatStudentName(row.name || '');
    if (!cleanPhone || !cleanName) {
      failureCount++;
      rowResults.push({ rowNumber: i + 1, name: cleanName || 'N/A', status: 'failed', error: 'Missing name or phone' });
      return;
    }

    let batch = store.batches.find((b) => b.name.toLowerCase() === (row.batch || '').trim().toLowerCase());
    if (!batch && row.batch) {
      batch = createDemoBatch(row.batch.trim());
    }

    const res = registerDemoStudentSingle({
      name: cleanName,
      phone: cleanPhone,
      password: row.password || '1234',
      batchId: batch?.id || store.batches[0]?.id || 'batch-msc-2025',
    });

    if (res.success && res.student) {
      successCount++;
      if (row.balance > 0) {
        const acc = store.accounts.find((a) => a.student_id === res.student!.id);
        if (acc) {
          postDemoJournalEntry(
            [
              { accountId: acc.id, debit: Number(row.balance), credit: 0 },
              { accountId: '30000000-0000-0000-0000-000000000001', debit: 0, credit: Number(row.balance) },
            ],
            `Opening balance for ${cleanName}`
          );
          openingBalancesPosted++;
        }
      }
      rowResults.push({ rowNumber: i + 1, name: cleanName, status: 'success' });
    } else {
      failureCount++;
      rowResults.push({ rowNumber: i + 1, name: cleanName, status: 'failed', error: res.error });
    }
  });

  return { totalRows: rows.length, successCount, failureCount, openingBalancesPosted, rowResults };
}

export function updateDemoStudent(id: string, data: { name: string; phone: string; batch_id: string }) {
  const store = getStore();
  const student = store.students.find((s) => s.id === id);
  if (!student) return { success: false, error: 'Student not found' };
  const cleanName = formatStudentName(data.name);
  student.name = cleanName;
  student.phone = normalizePhone(data.phone);
  student.batch_id = data.batch_id;

  const acc = store.accounts.find((a) => a.student_id === id);
  if (acc) {
    acc.name = `${cleanName} - Accounts Receivable`;
  }

  return { success: true };
}

export function archiveDemoStudent(id: string) {
  const store = getStore();
  const s = store.students.find((item) => item.id === id);
  if (s) s.status = 'archived';
  return { success: true };
}

export function restoreDemoStudent(id: string) {
  const store = getStore();
  const s = store.students.find((item) => item.id === id);
  if (s) s.status = 'active';
  return { success: true };
}

// ----------------------------------------------------
// ACCOUNTS & JOURNAL ENTRIES
// ----------------------------------------------------
export function getDemoAccounts() {
  const store = getStore();
  return [...store.accounts];
}

export function createDemoAccount(
  name: string,
  type: AccountType,
  isStudentAccount: boolean = false,
  studentId?: string | null
) {
  const store = getStore();
  const cleanName = name.trim();
  if (store.accounts.some((a) => a.name.toLowerCase() === cleanName.toLowerCase())) {
    return { success: false, error: `Another account named "${cleanName}" already exists.` };
  }
  const newAccount: Account = {
    id: `acc-demo-${Date.now()}`,
    name: cleanName,
    type,
    is_student_account: isStudentAccount,
    student_id: studentId || null,
    created_at: new Date().toISOString(),
  };
  store.accounts.push(newAccount);
  return { success: true, data: newAccount };
}

export function updateDemoAccountName(accountId: string, newName: string) {
  const store = getStore();
  const cleanName = newName.trim();
  const acc = store.accounts.find((a) => a.id === accountId);
  if (!acc) return { success: false, error: 'Account not found' };
  if (store.accounts.some((a) => a.id !== accountId && a.name.toLowerCase() === cleanName.toLowerCase())) {
    return { success: false, error: `Another account named "${cleanName}" already exists.` };
  }
  acc.name = cleanName;
  return { success: true };
}

export function getDemoLedgerAccountsGrouped(financialYearId?: string) {
  const store = getStore();
  const studentMap = new Map<string, string>();
  store.students.forEach((s) => studentMap.set(s.id, s.name));

  const activeFY = store.financialYears.find((fy) => fy.is_current) || store.financialYears[0];
  let targetFY = activeFY;
  let fyIdToFilter = financialYearId;
  if (fyIdToFilter === undefined && activeFY) {
    fyIdToFilter = activeFY.id;
  }
  if (fyIdToFilter && fyIdToFilter !== 'ALL') {
    const found = store.financialYears.find((f) => f.id === fyIdToFilter);
    if (found) targetFY = found;
  }

  const accountLinesMap = new Map<
    string,
    { lineId: string; entryId: string; date: string; description: string; debit: number; credit: number; rawEntry: any }[]
  >();

  let sortedEntries = store.journalEntries.filter((je) => !je.voided_at);
  if (fyIdToFilter && fyIdToFilter !== 'ALL' && targetFY) {
    const endStr = `${targetFY.end_date}T23:59:59.999Z`;
    sortedEntries = sortedEntries.filter((e) => e.date <= endStr);
  }
  sortedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(a.date).getTime());

  sortedEntries.forEach((e) => {
    const rawEntry = {
      id: e.id,
      date: e.date,
      description: e.description,
      lines: e.lines.map((l) => {
        const acc = store.accounts.find((a) => a.id === l.account_id);
        return {
          id: l.id,
          account_id: l.account_id,
          account_name: acc?.name || '',
          account_type: acc?.type || 'asset',
          is_student_account: acc?.is_student_account || false,
          debit_amount: l.debit_amount,
          credit_amount: l.credit_amount,
        };
      }),
      created_at: e.date,
    };

    e.lines.forEach((l) => {
      const arr = accountLinesMap.get(l.account_id) || [];
      arr.push({
        lineId: l.id,
        entryId: e.id,
        date: new Date(e.date).toLocaleDateString('en-GB'),
        description: e.description,
        debit: l.debit_amount,
        credit: l.credit_amount,
        rawEntry,
      });
      accountLinesMap.set(l.account_id, arr);
    });
  });

  const arAccounts: any[] = [];
  const assetAccounts: any[] = [];
  const liabilityAccounts: any[] = [];
  const revenueAccounts: any[] = [];
  const expenseAccounts: any[] = [];
  const equityAccounts: any[] = [];

  store.accounts.forEach((acc) => {
    const rawLines = accountLinesMap.get(acc.id) || [];
    let running = 0;

    const computedLines = rawLines.map((l) => {
      if (acc.type === 'asset' || acc.type === 'expense') {
        running += l.debit - l.credit;
      } else {
        running += l.credit - l.debit;
      }
      return { ...l, runningBalance: running };
    });

    const item = {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      is_student_account: acc.is_student_account,
      student_name: acc.student_id ? studentMap.get(acc.student_id) || null : null,
      lines: computedLines,
      finalBalance: running,
    };

    if (acc.is_student_account) {
      arAccounts.push(item);
    } else {
      switch (acc.type) {
        case 'asset':
          assetAccounts.push(item);
          break;
        case 'liability':
          liabilityAccounts.push(item);
          break;
        case 'revenue':
          revenueAccounts.push(item);
          break;
        case 'expense':
          expenseAccounts.push(item);
          break;
        case 'equity':
          equityAccounts.push(item);
          break;
      }
    }
  });

  return [
    { type: 'asset', title: 'Asset Accounts', accounts: assetAccounts },
    { type: 'accounts_receivable', title: 'Accounts Receivable (Student Accounts)', accounts: arAccounts },
    { type: 'liability', title: 'Liability Accounts', accounts: liabilityAccounts },
    { type: 'revenue', title: 'Revenue / Service Income Accounts', accounts: revenueAccounts },
    { type: 'expense', title: 'Expense Accounts', accounts: expenseAccounts },
    { type: 'equity', title: 'Equity & Fund Balance Accounts', accounts: equityAccounts },
  ];
}

export function getDemoJournalEntries(options?: { search?: string; startDate?: string; endDate?: string; financialYearId?: string | null }) {
  const store = getStore();
  const accountMap = new Map<string, Account>();
  store.accounts.forEach((a) => accountMap.set(a.id, a));

  const activeFY = store.financialYears.find((fy) => fy.is_current) || store.financialYears[0];
  let targetFY = activeFY;

  let fyIdToFilter = options?.financialYearId;
  if (fyIdToFilter === undefined && activeFY) {
    fyIdToFilter = activeFY.id;
  }

  if (fyIdToFilter && fyIdToFilter !== 'ALL') {
    const found = store.financialYears.find((f) => f.id === fyIdToFilter);
    if (found) targetFY = found;
  }

  let list = store.journalEntries.map((je) => {
    const formattedLines = je.lines.map((l) => ({
      ...l,
      accounts: accountMap.get(l.account_id) || { name: 'Unknown Account', type: 'asset' },
    }));
    return {
      ...je,
      journal_entry_lines: formattedLines,
    };
  });

  if (fyIdToFilter && fyIdToFilter !== 'ALL' && targetFY) {
    const startStr = targetFY.start_date;
    const endStr = `${targetFY.end_date}T23:59:59.999Z`;
    list = list.filter((je) => {
      if (je.financial_year_id) {
        return je.financial_year_id === targetFY.id;
      }
      return je.date >= startStr && je.date <= endStr;
    });
  }

  // Filter options
  if (options?.startDate) {
    list = list.filter((je) => je.date >= options.startDate!);
  }
  if (options?.endDate) {
    list = list.filter((je) => je.date <= options.endDate!);
  }
  if (options?.search && options.search.trim()) {
    const term = options.search.trim().toLowerCase();
    list = list.filter((je) =>
      je.description.toLowerCase().includes(term) ||
      je.journal_entry_lines.some((l) => l.accounts.name.toLowerCase().includes(term))
    );
  }

  // Sort descending by date
  list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return list;
}

export function postDemoJournalEntry(
  lines: { accountId: string; debit: number; credit: number }[],
  description: string,
  dateStr?: string
) {
  const store = getStore();
  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return { success: false, error: `Unbalanced journal entry: Total Debit (₹${totalDebit.toFixed(2)}) != Total Credit (₹${totalCredit.toFixed(2)})` };
  }

  const jeId = `je-demo-${Date.now()}`;
  const entryDate = dateStr || new Date().toISOString().slice(0, 10);
  const activeFY = store.financialYears.find((fy) => fy.is_current) || store.financialYears[0];

  const entryLines: DemoJournalEntryLine[] = lines.map((l, idx) => ({
    id: `jel-demo-${Date.now()}-${idx}`,
    journal_entry_id: jeId,
    account_id: l.accountId,
    debit_amount: Number(l.debit || 0),
    credit_amount: Number(l.credit || 0),
  }));

  const newEntry: DemoJournalEntry = {
    id: jeId,
    date: entryDate,
    description: description.trim(),
    financial_year_id: activeFY?.id || null,
    created_at: new Date().toISOString(),
    voided_at: null,
    lines: entryLines,
  };

  store.journalEntries.push(newEntry);
  return { success: true, entryId: jeId };
}

export function updateDemoJournalEntry(
  entryId: string,
  lines: { accountId: string; debit: number; credit: number }[],
  description: string,
  dateStr?: string
) {
  const store = getStore();
  const je = store.journalEntries.find((e) => e.id === entryId);
  if (!je) return { success: false, error: 'Journal entry not found' };

  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return { success: false, error: 'Unbalanced journal entry' };
  }

  je.description = description.trim();
  if (dateStr) je.date = dateStr;

  je.lines = lines.map((l, idx) => ({
    id: `jel-demo-upd-${Date.now()}-${idx}`,
    journal_entry_id: entryId,
    account_id: l.accountId,
    debit_amount: Number(l.debit || 0),
    credit_amount: Number(l.credit || 0),
  }));

  return { success: true };
}

export function voidDemoJournalEntry(entryId: string) {
  const store = getStore();
  const je = store.journalEntries.find((e) => e.id === entryId);
  if (!je) return { success: false, error: 'Journal entry not found' };
  je.voided_at = new Date().toISOString();
  return { success: true };
}

export function deleteDemoJournalEntry(entryId: string) {
  const store = getStore();
  store.journalEntries = store.journalEntries.filter((e) => e.id !== entryId);
  return { success: true };
}


// ----------------------------------------------------
// METRICS & FINANCIAL REPORTS
// ----------------------------------------------------
export function getDemoAdminDashboardMetrics(startDate?: string, endDate?: string) {
  const store = getStore();
  let entries = store.journalEntries.filter((je) => !je.voided_at);

  const startISO = startDate ? startDate.slice(0, 10) : undefined;
  const endISO = endDate ? endDate.slice(0, 10) : undefined;

  if (startISO) entries = entries.filter((e) => e.date.slice(0, 10) >= startISO);
  if (endISO) entries = entries.filter((e) => e.date.slice(0, 10) <= endISO);

  // Exclude financial year closing entries
  entries = entries.filter((e) => {
    const desc = (e.description || '').toLowerCase();
    return !desc.includes('closing entry');
  });

  const studentAccountIds = new Set(store.accounts.filter((a) => a.is_student_account).map((a) => a.id));
  const cashAccountId = '10000000-0000-0000-0000-000000000001';
  const expenseAccountIds = new Set(store.accounts.filter((a) => a.type === 'expense').map((a) => a.id));
  const revenueAccountIds = new Set(store.accounts.filter((a) => a.type === 'revenue').map((a) => a.id));

  let totalCreditGiven = 0;
  let cashInflows = 0;
  let cashOutflows = 0;
  let totalExpenses = 0;
  let totalRevenue = 0;

  entries.forEach((je) => {
    je.lines.forEach((l) => {
      // Credit Given (Debits to Student Accounts)
      if (studentAccountIds.has(l.account_id)) {
        totalCreditGiven += l.debit_amount;
      }
      // Cash Flow
      if (l.account_id === cashAccountId) {
        cashInflows += l.debit_amount;
        cashOutflows += l.credit_amount;
      }
      // Expenses
      if (expenseAccountIds.has(l.account_id)) {
        totalExpenses += (l.debit_amount - l.credit_amount);
      }
      // Revenue
      if (revenueAccountIds.has(l.account_id)) {
        totalRevenue += (l.credit_amount - l.debit_amount);
      }
    });
  });

  const cashFlow = cashInflows - cashOutflows;
  const surplus = totalRevenue - totalExpenses;

  return {
    totalCreditGiven,
    cashFlow,
    totalExpenses,
    surplus,
  };
}

export function getDemoTrialBalance(asOfDate?: string) {
  const store = getStore();
  let entries = store.journalEntries.filter((je) => !je.voided_at);
  if (asOfDate) entries = entries.filter((e) => e.date <= asOfDate);

  const accountBalances = new Map<string, { debit: number; credit: number }>();
  store.accounts.forEach((a) => accountBalances.set(a.id, { debit: 0, credit: 0 }));

  entries.forEach((je) => {
    je.lines.forEach((l) => {
      const cur = accountBalances.get(l.account_id) || { debit: 0, credit: 0 };
      cur.debit += l.debit_amount;
      cur.credit += l.credit_amount;
      accountBalances.set(l.account_id, cur);
    });
  });

  const rows: any[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  store.accounts.forEach((acc) => {
    const b = accountBalances.get(acc.id) || { debit: 0, credit: 0 };
    const net = b.debit - b.credit;
    if (Math.abs(net) > 0.001) {
      let finalDebit = 0;
      let finalCredit = 0;
      if (acc.type === 'asset' || acc.type === 'expense') {
        if (net >= 0) finalDebit = net;
        else finalCredit = Math.abs(net);
      } else {
        if (net <= 0) finalCredit = Math.abs(net);
        else finalDebit = net;
      }
      totalDebit += finalDebit;
      totalCredit += finalCredit;
      rows.push({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        debit: finalDebit,
        credit: finalCredit,
      });
    }
  });

  return { rows, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

export function getDemoIncomeExpenseStatement(startDate?: string, endDate?: string) {
  const store = getStore();
  let entries = store.journalEntries.filter((je) => !je.voided_at);
  if (startDate) entries = entries.filter((e) => e.date >= startDate);
  if (endDate) entries = entries.filter((e) => e.date <= endDate);

  const revenueRows: any[] = [];
  const expenseRows: any[] = [];
  let totalRevenue = 0;
  let totalExpense = 0;

  const revAccounts = store.accounts.filter((a) => a.type === 'revenue');
  const expAccounts = store.accounts.filter((a) => a.type === 'expense');

  revAccounts.forEach((acc) => {
    let amt = 0;
    entries.forEach((je) => {
      je.lines.forEach((l) => {
        if (l.account_id === acc.id) amt += (l.credit_amount - l.debit_amount);
      });
    });
    totalRevenue += amt;
    revenueRows.push({ id: acc.id, name: acc.name, amount: amt });
  });

  expAccounts.forEach((acc) => {
    let amt = 0;
    entries.forEach((je) => {
      je.lines.forEach((l) => {
        if (l.account_id === acc.id) amt += (l.debit_amount - l.credit_amount);
      });
    });
    totalExpense += amt;
    expenseRows.push({ id: acc.id, name: acc.name, amount: amt });
  });

  return {
    revenue: revenueRows,
    expenses: expenseRows,
    totalRevenue,
    totalExpense,
    netSurplus: totalRevenue - totalExpense,
  };
}

export function getDemoBalanceSheet(asOfDate?: string) {
  const store = getStore();
  const tb = getDemoTrialBalance(asOfDate);
  const incExp = getDemoIncomeExpenseStatement(undefined, asOfDate);

  const assets: any[] = [];
  const liabilities: any[] = [];
  const equity: any[] = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  tb.rows.forEach((r) => {
    if (r.type === 'asset') {
      const net = r.debit - r.credit;
      assets.push({ id: r.id, name: r.name, amount: net });
      totalAssets += net;
    } else if (r.type === 'liability') {
      const net = r.credit - r.debit;
      liabilities.push({ id: r.id, name: r.name, amount: net });
      totalLiabilities += net;
    } else if (r.type === 'equity') {
      const net = r.credit - r.debit;
      equity.push({ id: r.id, name: r.name, amount: net });
      totalEquity += net;
    }
  });

  // Add Net Surplus to Equity
  equity.push({ id: 'net-surplus-current', name: 'Current Period Surplus', amount: incExp.netSurplus });
  totalEquity += incExp.netSurplus;

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

// ----------------------------------------------------
// PAYMENT CLAIMS
// ----------------------------------------------------
export function getDemoPendingClaims(): DemoPaymentClaim[] {
  const store = getStore();
  return store.paymentClaims.filter((c) => c.status === 'pending');
}

export function getDemoPendingClaimsCount(): number {
  return getDemoPendingClaims().length;
}

export function getDemoStudentClaimsHistory(studentId: string, limit = 5): DemoPaymentClaim[] {
  const store = getStore();
  return store.paymentClaims
    .filter((c) => c.student_id === studentId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export function verifyDemoPaymentClaim(
  claimId: string,
  depositAccountId: string = '10000000-0000-0000-0000-000000000001',
  verifierName: string = 'Admin'
) {
  const store = getStore();
  const claim = store.paymentClaims.find((c) => c.id === claimId);
  if (!claim) return { success: false, error: 'Payment claim not found.' };

  if (claim.status !== 'pending') {
    return {
      success: false,
      alreadyHandled: true,
      error: `This payment claim has already been ${claim.status}${claim.verified_by ? ` by ${claim.verified_by}` : ''}.`,
    };
  }

  claim.status = 'verified';
  claim.verified_by = verifierName;
  claim.verified_at = new Date().toISOString();

  // Find student's AR account
  const studentAcc = store.accounts.find((a) => a.student_id === claim.student_id);
  if (studentAcc) {
    postDemoJournalEntry(
      [
        { accountId: depositAccountId, debit: claim.amount, credit: 0 },
        { accountId: studentAcc.id, debit: 0, credit: claim.amount },
      ],
      `UPI Payment Verified (${verifierName}) - ${claim.student_name} (Ref: ${claim.transaction_id})`
    );
  }

  return { success: true };
}

export function rejectDemoPaymentClaim(claimId: string, reason: string, verifierName: string = 'Admin') {
  const store = getStore();
  const claim = store.paymentClaims.find((c) => c.id === claimId);
  if (!claim) return { success: false, error: 'Payment claim not found.' };

  if (claim.status !== 'pending') {
    return {
      success: false,
      alreadyHandled: true,
      error: `This payment claim has already been ${claim.status}${claim.verified_by ? ` by ${claim.verified_by}` : ''}.`,
    };
  }

  claim.status = 'rejected';
  claim.rejection_reason = reason.trim();
  claim.verified_by = verifierName;
  claim.verified_at = new Date().toISOString();
  return { success: true };
}

// ----------------------------------------------------
// CASH HANDOVER CLAIMS (IN-CHARGE)
// ----------------------------------------------------
export function getDemoPendingHandoverClaims() {
  const store = getStore();
  if (!store.cashHandoverClaims) store.cashHandoverClaims = [];
  return store.cashHandoverClaims.filter((c) => c.status === 'pending');
}

export function getDemoPendingHandoverClaimsCount(): number {
  return getDemoPendingHandoverClaims().length;
}

export function getDemoInchargeHandoverClaims(inchargeId: string) {
  const store = getStore();
  if (!store.cashHandoverClaims) store.cashHandoverClaims = [];
  return store.cashHandoverClaims
    .filter((c) => c.incharge_id === inchargeId)
    .sort((a, b) => new Date(b.claimed_at).getTime() - new Date(a.claimed_at).getTime());
}

export function submitDemoCashHandoverClaim(input: {
  inchargeId: string;
  inchargeName: string;
  amount: number;
}) {
  const store = getStore();
  if (!store.cashHandoverClaims) store.cashHandoverClaims = [];

  const existingPending = store.cashHandoverClaims.find(
    (c) => c.incharge_id === input.inchargeId && c.status === 'pending'
  );
  if (existingPending) {
    return {
      success: false,
      error: 'You already have a pending cash handover claim awaiting admin verification.',
    };
  }

  const newClaim = {
    id: `claim-handover-demo-${Date.now()}`,
    incharge_id: input.inchargeId,
    incharge_name: input.inchargeName || 'Staff In-Charge',
    claimed_amount: input.amount,
    claimed_at: new Date().toISOString(),
    status: 'pending' as const,
    verified_by: null,
    verified_at: null,
    admin_note: null,
  };

  store.cashHandoverClaims.push(newClaim);
  return { success: true, claim: newClaim };
}

export function verifyDemoCashHandoverClaim(claimId: string, adminId: string = 'Admin') {
  const store = getStore();
  if (!store.cashHandoverClaims) store.cashHandoverClaims = [];
  const claim = store.cashHandoverClaims.find((c) => c.id === claimId);
  if (!claim) return { success: false, error: 'Handover claim not found' };
  if (claim.status !== 'pending') {
    return { success: false, error: `Claim has already been ${claim.status}` };
  }

  const mainCashAccountId = '10000000-0000-0000-0000-000000000001';
  const inchargeCashAccountId = '10000000-0000-0000-0000-000000000003';

  // Post Journal Entry: Lab Cash Account (Dr) / Cash in Hand (In-Charge) (Cr)
  const res = postDemoJournalEntry(
    [
      { accountId: mainCashAccountId, debit: claim.claimed_amount, credit: 0 },
      { accountId: inchargeCashAccountId, debit: 0, credit: claim.claimed_amount },
    ],
    `Cash Handover Transfer Verified - ${claim.incharge_name} (Claim #${claim.id.slice(0, 8)})`
  );

  if (!res.success) {
    return { success: false, error: res.error || 'Failed to post transfer journal entry.' };
  }

  claim.status = 'verified';
  claim.verified_by = adminId;
  claim.verified_at = new Date().toISOString();

  return { success: true };
}

export function rejectDemoCashHandoverClaim(claimId: string, adminNote?: string, adminId: string = 'Admin') {
  const store = getStore();
  if (!store.cashHandoverClaims) store.cashHandoverClaims = [];
  const claim = store.cashHandoverClaims.find((c) => c.id === claimId);
  if (!claim) return { success: false, error: 'Handover claim not found' };
  if (claim.status !== 'pending') {
    return { success: false, error: `Claim has already been ${claim.status}` };
  }

  claim.status = 'rejected';
  claim.admin_note = adminNote || null;
  claim.verified_by = adminId;
  claim.verified_at = new Date().toISOString();

  return { success: true };
}

export function submitDemoPaymentClaim(input: { studentId: string; studentName: string; amount: number; transactionId: string; paymentDate: string }) {
  const store = getStore();
  const newClaim: DemoPaymentClaim = {
    id: `claim-demo-${Date.now()}`,
    student_id: input.studentId,
    student_name: input.studentName,
    amount: input.amount,
    transaction_id: input.transactionId,
    payment_date: input.paymentDate,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  store.paymentClaims.push(newClaim);
  return { success: true, claim: newClaim };
}

// ----------------------------------------------------
// FINANCIAL YEAR
// ----------------------------------------------------
const PROMOTION_MAPPING_DEMO: Record<string, string> = {
  JD1: 'JD 2',
  JD2: 'JD 3',
  JD3: 'HS 1',
  HS1: 'HS 2',
  HS2: 'BS 1',
  BS1: 'BS 2',
  BS2: 'BS 3',
  BS3: 'BS 4',
  BS4: 'BS 5',
};

function normalizeBatchNameDemo(name: string): string {
  return (name || '').replace(/[\s-]/g, '').toUpperCase();
}

function computeNextFinancialYearDatesDemo(currentEndDateStr: string) {
  const currentEnd = new Date(`${currentEndDateStr}T00:00:00.000Z`);
  const nextStart = new Date(currentEnd);
  nextStart.setUTCDate(nextStart.getUTCDate() + 1);

  const nextEnd = new Date(nextStart);
  nextEnd.setUTCFullYear(nextEnd.getUTCFullYear() + 1);
  nextEnd.setUTCDate(nextEnd.getUTCDate() - 1);

  const startStr = nextStart.toISOString().slice(0, 10);
  const endStr = nextEnd.toISOString().slice(0, 10);

  const startYear = nextStart.getUTCFullYear();
  const endYear = nextEnd.getUTCFullYear();
  const name = startYear === endYear ? `FY ${startYear}` : `FY ${startYear}-${endYear}`;

  return { name, startDate: startStr, endDate: endStr };
}

export function getDemoFinancialYears(): (DemoFinancialYear & { name: string })[] {
  const store = getStore();
  return store.financialYears.map((fy) => ({
    ...fy,
    name: fy.name || fy.year_label,
  }));
}

export function updateDemoFinancialYearDates(id: string, start: string, end: string, name?: string) {
  const store = getStore();
  const fy = store.financialYears.find((item) => item.id === id);
  if (!fy) return { success: false, error: 'Financial year not found' };
  fy.start_date = start;
  fy.end_date = end;
  if (name) {
    fy.name = name;
    fy.year_label = name;
  }
  return { success: true };
}

export function rolloverDemoFinancialYear(): {
  success: boolean;
  closedYearName?: string;
  newYearName?: string;
  surplusClosed?: number;
  promotedStudentsCount?: number;
  alumniStudentsCount?: number;
  archivedStudentsCount?: number;
  alumniBatchName?: string;
  error?: string;
} {
  const store = getStore();
  const currentFY = store.financialYears.find((fy) => fy.is_current) || store.financialYears[0];
  if (!currentFY) {
    return { success: false, error: 'No active financial year found to roll over.' };
  }

  const currentFYName = currentFY.name || currentFY.year_label;

  // 2. Post closing entry: zero out all nominal (revenue & expense) accounts
  let closingEntryId: string | null = null;
  const equityAccId = '30000000-0000-0000-0000-000000000001';

  const nonVoidedEntries = store.journalEntries.filter((je) => !je.voided_at && je.date <= currentFY.end_date);
  const accountDebitTotals = new Map<string, number>();
  const accountCreditTotals = new Map<string, number>();

  nonVoidedEntries.forEach((je) => {
    je.lines.forEach((l) => {
      accountDebitTotals.set(l.account_id, (accountDebitTotals.get(l.account_id) || 0) + Number(l.debit_amount || 0));
      accountCreditTotals.set(l.account_id, (accountCreditTotals.get(l.account_id) || 0) + Number(l.credit_amount || 0));
    });
  });

  const lines: { accountId: string; debit: number; credit: number }[] = [];
  let totalRevenueClosed = 0;
  let totalExpensesClosed = 0;

  store.accounts.forEach((acc) => {
    const totDebit = accountDebitTotals.get(acc.id) || 0;
    const totCredit = accountCreditTotals.get(acc.id) || 0;

    if (acc.type === 'revenue') {
      const netCredit = totCredit - totDebit;
      if (Math.abs(netCredit) > 0.001) {
        if (netCredit > 0) {
          lines.push({ accountId: acc.id, debit: netCredit, credit: 0 });
          totalRevenueClosed += netCredit;
        } else {
          const debitBal = Math.abs(netCredit);
          lines.push({ accountId: acc.id, debit: 0, credit: debitBal });
          totalRevenueClosed -= debitBal;
        }
      }
    } else if (acc.type === 'expense') {
      const netDebit = totDebit - totCredit;
      if (Math.abs(netDebit) > 0.001) {
        if (netDebit > 0) {
          lines.push({ accountId: acc.id, debit: 0, credit: netDebit });
          totalExpensesClosed += netDebit;
        } else {
          const creditBal = Math.abs(netDebit);
          lines.push({ accountId: acc.id, debit: creditBal, credit: 0 });
          totalExpensesClosed -= creditBal;
        }
      }
    }
  });

  const netSurplus = totalRevenueClosed - totalExpensesClosed;

  if (netSurplus > 0.001) {
    lines.push({ accountId: equityAccId, debit: 0, credit: netSurplus });
  } else if (netSurplus < -0.001) {
    const deficit = Math.abs(netSurplus);
    lines.push({ accountId: equityAccId, debit: deficit, credit: 0 });
  }

  if (lines.length > 0) {
    const closingDesc = `Closing Entry for ${currentFYName} — Zero Nominal Accounts & Transfer Net ${netSurplus >= 0 ? 'Surplus' : 'Deficit'} to Fund Balance`;
    const closingDate = `${currentFY.end_date}T23:59:59.000Z`;

    const postRes = postDemoJournalEntry(lines, closingDesc, closingDate.slice(0, 10));
    if (postRes.success && postRes.entryId) {
      closingEntryId = postRes.entryId;
    }
  }

  // 3. Batch promotions & Alumni batch creation
  const gradYear = new Date(`${currentFY.end_date}T00:00:00.000Z`).getUTCFullYear();
  const alumniBatchName = `Alumni ${gradYear}`;
  const normAlumniName = normalizeBatchNameDemo(alumniBatchName);

  let alumniBatch = store.batches.find((b) => normalizeBatchNameDemo(b.name) === normAlumniName);
  if (!alumniBatch) {
    alumniBatch = {
      id: `batch-alumni-demo-${gradYear}`,
      name: alumniBatchName,
      category: 'General',
      sort_order: 99,
      created_at: new Date().toISOString(),
    };
    store.batches.push(alumniBatch);
  }

  // Snapshot before promotions
  const studentSnapshot = store.students.map((s) => ({
    student_id: s.id,
    batch_id: s.batch_id,
    status: s.status,
  }));

  let promotedStudentsCount = 0;
  let alumniStudentsCount = 0;
  let archivedStudentsCount = 0;

  const activeStudents = store.students.filter((s) => s.status === 'active');
  const demoStudentsWithBalance = getDemoStudents({ status: 'active' });
  const studentBalanceMap = new Map<string, number>();
  demoStudentsWithBalance.forEach((s) => studentBalanceMap.set(s.id, s.balance));

  for (const student of activeStudents) {
    const batch = store.batches.find((b) => b.id === student.batch_id);
    const rawBatchName = batch ? batch.name : '';
    const normBatchName = normalizeBatchNameDemo(rawBatchName);

    const pendingBalance = studentBalanceMap.get(student.id) || 0;
    const nextBatchTargetName = PROMOTION_MAPPING_DEMO[normBatchName];

    if (nextBatchTargetName) {
      const targetNorm = normalizeBatchNameDemo(nextBatchTargetName);
      let nextBatch = store.batches.find((b) => normalizeBatchNameDemo(b.name) === targetNorm);
      if (!nextBatch) {
        nextBatch = {
          id: `batch-demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: nextBatchTargetName,
          category: rawBatchName.startsWith('JD') ? 'JD' : rawBatchName.startsWith('HS') ? 'HS' : 'BS',
          sort_order: store.batches.length + 1,
          created_at: new Date().toISOString(),
        };
        store.batches.push(nextBatch);
      }
      student.batch_id = nextBatch.id;
      promotedStudentsCount++;
    } else if (normBatchName === 'BS5') {
      if (pendingBalance > 0) {
        student.batch_id = alumniBatch.id;
        alumniStudentsCount++;
      } else {
        student.status = 'archived';
        archivedStudentsCount++;
      }
    }
  }

  // 4. Create Next Financial Year
  const nextFYDates = computeNextFinancialYearDatesDemo(currentFY.end_date);
  const newFY: DemoFinancialYear = {
    id: `fy-demo-${Date.now()}`,
    year_label: nextFYDates.name,
    name: nextFYDates.name,
    start_date: nextFYDates.startDate,
    end_date: nextFYDates.endDate,
    is_current: true,
    closed_at: null,
  };

  // 5. Close Current Financial Year
  currentFY.is_current = false;
  currentFY.closed_at = new Date().toISOString();
  currentFY.closing_entry_id = closingEntryId;
  currentFY.created_new_fy_id = newFY.id;
  currentFY.rollover_snapshot = studentSnapshot;

  store.financialYears.unshift(newFY);

  return {
    success: true,
    closedYearName: currentFYName,
    newYearName: newFY.name,
    surplusClosed: netSurplus,
    promotedStudentsCount,
    alumniStudentsCount,
    archivedStudentsCount,
    alumniBatchName,
  };
}

export function undoDemoLastRollover(): { success: boolean; reopenedYearName?: string; error?: string } {
  const store = getStore();

  const lastClosedFY = store.financialYears.find((fy) => !fy.is_current && fy.closed_at);
  if (!lastClosedFY) {
    return { success: false, error: 'No closed financial year available to undo.' };
  }

  const currentFY = store.financialYears.find((fy) => fy.is_current);

  if (currentFY && currentFY.id !== lastClosedFY.id) {
    const newEntries = store.journalEntries.filter(
      (je) => !je.voided_at && je.date >= currentFY.start_date && je.date <= currentFY.end_date && je.id !== lastClosedFY.closing_entry_id
    );
    if (newEntries.length > 0) {
      return {
        success: false,
        error: `Undo disabled: Active journal entries have already been posted into the new financial year (${currentFY.name || currentFY.year_label}).`,
      };
    }
  }

  // Restore students
  if (lastClosedFY.rollover_snapshot && Array.isArray(lastClosedFY.rollover_snapshot)) {
    for (const snap of lastClosedFY.rollover_snapshot) {
      const student = store.students.find((s) => s.id === snap.student_id);
      if (student) {
        student.batch_id = snap.batch_id;
        student.status = snap.status as 'active' | 'archived';
      }
    }
  }

  // Void closing entry
  if (lastClosedFY.closing_entry_id) {
    const entry = store.journalEntries.find((e) => e.id === lastClosedFY.closing_entry_id);
    if (entry) {
      entry.voided_at = new Date().toISOString();
    }
  }

  // Remove created new FY
  if (lastClosedFY.created_new_fy_id) {
    store.financialYears = store.financialYears.filter((fy) => fy.id !== lastClosedFY.created_new_fy_id);
  } else if (currentFY && currentFY.id !== lastClosedFY.id) {
    store.financialYears = store.financialYears.filter((fy) => fy.id !== currentFY.id);
  }

  // Re-open last closed FY
  lastClosedFY.is_current = true;
  lastClosedFY.closed_at = null;
  lastClosedFY.closing_entry_id = null;
  lastClosedFY.created_new_fy_id = null;
  lastClosedFY.rollover_snapshot = null;

  return {
    success: true,
    reopenedYearName: lastClosedFY.name || lastClosedFY.year_label,
  };
}

// ----------------------------------------------------
// IN-CHARGE STAFF MANAGEMENT (DEMO)
// ----------------------------------------------------
export function getDemoInchargeStaff() {
  const store = getStore();
  if (!store.inchargeStaff) store.inchargeStaff = [];
  return store.inchargeStaff;
}

export function addDemoInchargeStaff(input: { name: string; email: string; password?: string }) {
  const store = getStore();
  if (!store.inchargeStaff) store.inchargeStaff = [];

  const existing = store.inchargeStaff.find(
    (s) => s.email.toLowerCase() === input.email.trim().toLowerCase()
  );
  if (existing) {
    return { success: false, error: `In-charge user with email '${input.email}' already exists.` };
  }

  const existingStaffIds = new Set<string>(
    store.inchargeStaff.map((s: any) => s.staff_id).filter(Boolean)
  );

  let newStaffId = '';
  let attempts = 0;
  do {
    newStaffId = Math.floor(1000 + Math.random() * 9000).toString();
    attempts++;
  } while (existingStaffIds.has(newStaffId) && attempts < 10000);

  const newStaff = {
    id: `incharge-demo-${Date.now()}`,
    user_id: `user-demo-incharge-${Date.now()}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    staff_id: newStaffId,
    status: 'active' as const,
    created_at: new Date().toISOString(),
  };

  store.inchargeStaff.push(newStaff);
  return { success: true, staff: newStaff };
}

export function updateDemoInchargeStaff(id: string, updates: { name?: string; status?: 'active' | 'archived' }) {
  const store = getStore();
  if (!store.inchargeStaff) store.inchargeStaff = [];

  const staff = store.inchargeStaff.find((s) => s.id === id || s.user_id === id);
  if (!staff) return { success: false, error: 'Staff member not found.' };

  if (updates.name) staff.name = updates.name.trim();
  if (updates.status) staff.status = updates.status;

  saveStore(store);

  return { success: true, staff };
}

export function deleteDemoInchargeStaff(id: string) {
  const store = getStore();
  if (!store.inchargeStaff) store.inchargeStaff = [];

  const initialCount = store.inchargeStaff.length;
  store.inchargeStaff = store.inchargeStaff.filter(
    (s) => s.id !== id && s.user_id !== id
  );

  if (store.inchargeStaff.length === initialCount) {
    return { success: false, error: 'Staff member not found.' };
  }

  saveStore(store);

  return { success: true };
}
