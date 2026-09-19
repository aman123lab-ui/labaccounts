import { createClient } from '@/lib/supabase/client';
import { validateJournalEntryLines, calculateAccountBalanceFromLines } from '@/lib/accounting/ledger';
import { Account, AccountType, PostJournalLineInput } from '@/types/database.types';
import {
  isGuestMode,
  postDemoJournalEntry,
  getDemoAccounts,
  getDemoAdminDashboardMetrics,
  updateDemoAccountName,
  createDemoAccount,
  getDemoLedgerAccountsGrouped,
} from '@/lib/demo/demoStore';

/**
 * Posts a journal entry to the Supabase database.
 * Rejects the entry if debits != credits.
 * Inserts one journal_entries row + N journal_entry_lines rows atomically via RPC function.
 */
export async function postJournalEntry(
  lines: PostJournalLineInput[],
  description: string,
  options?: { date?: string; financialYearId?: string; createdBy?: string }
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  if (isGuestMode()) {
    return postDemoJournalEntry(lines, description, options?.date);
  }

  // 1. App-level balance check pre-validation
  const validation = validateJournalEntryLines(lines);
  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }

  const supabase = createClient();

  try {
    // Auto-detect active financial year if not supplied
    let fyId = options?.financialYearId;
    if (!fyId) {
      const { data: activeFy } = await (supabase
        .from('financial_years')
        .select('id')
        .eq('is_current', true)
        .limit(1)
        .maybeSingle() as unknown as Promise<{ data: { id: string } | null; error: any }>);
      if (activeFy?.id) {
        fyId = activeFy.id;
      }
    }

    // Auto-detect creator user ID if not explicitly supplied
    let createdBy = options?.createdBy;
    if (!createdBy) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        createdBy = userData.user.id;
      }
    }

    // 2. Execute atomic Postgres function `post_journal_entry`
    // Using untyped RPC call signature to avoid generic RPC inference mismatches
    const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: { message: string } | null }>)(
      'post_journal_entry',
      {
        p_description: description,
        p_lines: lines.map((l) => ({
          account_id: l.accountId,
          debit_amount: l.debit,
          credit_amount: l.credit,
        })),
        p_date: options?.date || new Date().toISOString(),
        p_financial_year_id: fyId || null,
        p_created_by: createdBy || null,
      }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, entryId: data as string };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown database error during journal post.';
    return { success: false, error: message };
  }
}

/**
 * Computes account balance dynamically from journal_entry_lines in Supabase.
 * Never stores a duplicated running total anywhere — the books are derivable from the ledger.
 */
export async function getAccountBalance(accountId: string): Promise<number> {
  if (isGuestMode()) {
    const grouped = getDemoLedgerAccountsGrouped();
    for (const g of grouped) {
      const found = g.accounts.find((a: any) => a.id === accountId);
      if (found) return found.finalBalance;
    }
    return 0;
  }

  const supabase = createClient();

  // 1. Fetch account type
  const { data, error: accountError } = await supabase
    .from('accounts')
    .select('id, type')
    .eq('id', accountId)
    .single();

  if (accountError || !data) {
    throw new Error(`Account '${accountId}' not found: ${accountError?.message || 'Invalid ID'}`);
  }

  const account = data as unknown as { id: string; type: AccountType };

  // 2. Fetch all non-voided journal entry lines for this account
  let { data: linesData, error: linesError } = await supabase
    .from('journal_entry_lines')
    .select('account_id, debit_amount, credit_amount, journal_entries!inner(voided_at)')
    .eq('account_id', accountId)
    .is('journal_entries.voided_at', null);

  if (linesError && (linesError as { code?: string }).code === '42703') {
    const fallback = await supabase
      .from('journal_entry_lines')
      .select('account_id, debit_amount, credit_amount')
      .eq('account_id', accountId);
    linesData = fallback.data as typeof linesData;
    linesError = fallback.error;
  }

  if (linesError) {
    throw new Error(`Failed to query lines for account '${accountId}': ${linesError.message}`);
  }

  const lines = (linesData || []) as unknown as { account_id: string; debit_amount: number; credit_amount: number }[];

  return calculateAccountBalanceFromLines(
    account.type,
    lines,
    accountId
  );
}

/**
 * Fetches all active accounts in the Chart of Accounts.
 */
export async function getChartOfAccounts(): Promise<Account[]> {
  if (isGuestMode()) {
    return getDemoAccounts();
  }

  const supabase = createClient();
  const { data, error } = await supabase.from('accounts').select('*').order('name');

  if (error) {
    throw new Error(`Failed to load accounts: ${error.message}`);
  }

  return (data || []) as unknown as Account[];
}

export interface AdminDashboardMetrics {
  totalCreditGiven: number; // Sum of new debit entries against student accounts in period
  cashFlow: number;         // Net cash in/out in period (Cash Debits - Credits)
  totalExpenses: number;    // Sum of expense debits in period
  surplus: number;          // Net Balance / Surplus (Revenue - Expense) in period
}

export interface FinancialPeriodSummary {
  totalRevenue: number;
  totalExpenses: number;
  netSurplus: number;
  totalCreditGiven: number;
  cashFlow: number;
}

/**
 * Shared calculation function for period financial summary (Revenue, Expenses, Surplus, Credit Given, Cash Flow).
 * Used consistently across Admin Dashboard, Income & Expenditure Account, and Preview / Financial Year Rollover.
 */
export async function calculatePeriodFinancialSummary(
  startDateStr: string,
  endDateStr: string,
  customSupabase?: any
): Promise<FinancialPeriodSummary> {
  if (isGuestMode()) {
    const metrics = getDemoAdminDashboardMetrics(startDateStr, endDateStr);
    return {
      totalRevenue: metrics.surplus + metrics.totalExpenses,
      totalExpenses: metrics.totalExpenses,
      netSurplus: metrics.surplus,
      totalCreditGiven: metrics.totalCreditGiven,
      cashFlow: metrics.cashFlow,
    };
  }

  const supabase = customSupabase || createClient();

  const startDate = startDateStr.includes('T') ? startDateStr : `${startDateStr}T00:00:00.000Z`;
  const endDate = endDateStr.includes('T') ? endDateStr : `${endDateStr}T23:59:59.999Z`;

  // 1. Fetch non-voided journal entries within range
  let { data: entries, error: entriesError } = await supabase
    .from('journal_entries')
    .select('id, description, is_closing_entry')
    .is('voided_at', null)
    .gte('date', startDate)
    .lte('date', endDate);

  if (entriesError && (entriesError as { code?: string }).code === '42703') {
    const fallback = await supabase
      .from('journal_entries')
      .select('id, description')
      .gte('date', startDate)
      .lte('date', endDate);
    entries = fallback.data as typeof entries;
    entriesError = fallback.error;
  }

  // Filter out automated Financial Year closing entries using is_closing_entry flag (with description text match fallback)
  const operationalEntries = (entries || []).filter((e: any) => {
    if (e.is_closing_entry === true) return false;
    const desc = (e.description || '').toLowerCase();
    return !desc.includes('closing entry');
  });

  if (entriesError || operationalEntries.length === 0) {
    return {
      totalRevenue: 0,
      totalExpenses: 0,
      netSurplus: 0,
      totalCreditGiven: 0,
      cashFlow: 0,
    };
  }

  const entryIds = operationalEntries.map((e: any) => e.id);

  // 2. Fetch all journal entry lines for these entries joined with account metadata
  const { data: lines, error: linesError } = await supabase
    .from('journal_entry_lines')
    .select('debit_amount, credit_amount, accounts(id, name, type, is_student_account)')
    .in('journal_entry_id', entryIds);

  if (linesError || !lines) {
    return {
      totalRevenue: 0,
      totalExpenses: 0,
      netSurplus: 0,
      totalCreditGiven: 0,
      cashFlow: 0,
    };
  }

  let totalCreditGiven = 0;
  let cashFlow = 0;
  let totalExpenses = 0;
  let totalRevenue = 0;

  lines.forEach((l: any) => {
    const debit = Number(l.debit_amount || 0);
    const credit = Number(l.credit_amount || 0);
    const acc = l.accounts as unknown as { id: string; name: string; type: AccountType; is_student_account: boolean } | null;

    if (!acc) return;

    // a. Total Credit Given: New debits posted against student accounts
    if (acc.is_student_account && debit > 0) {
      totalCreditGiven += debit;
    }

    // b. Cash Flow: Net change in main Cash / Bank Account (excluding Cash in Hand (In-Charge))
    const accNameLower = (acc.name || '').toLowerCase();
    if (accNameLower.includes('cash') && !accNameLower.includes('in-charge')) {
      cashFlow += (debit - credit);
    }

    // c. Total Expenses: Net debits on expense accounts
    if (acc.type === 'expense') {
      totalExpenses += (debit - credit);
    }

    // d. Revenue for Surplus calculation: Net credits on revenue accounts
    if (acc.type === 'revenue') {
      totalRevenue += (credit - debit);
    }
  });

  // Net Surplus = Total Revenue - Total Expenses
  const netSurplus = totalRevenue - totalExpenses;

  return {
    totalRevenue,
    totalExpenses,
    netSurplus,
    totalCreditGiven,
    cashFlow,
  };
}

/**
 * Computes live admin dashboard period metrics directly from ledger tables journal_entry_lines
 * joined with journal_entries within the specified date range [startDate, endDate].
 */
export async function getAdminDashboardMetrics(
  startDate: string,
  endDate: string
): Promise<AdminDashboardMetrics> {
  const summary = await calculatePeriodFinancialSummary(startDate, endDate);
  return {
    totalCreditGiven: summary.totalCreditGiven,
    cashFlow: summary.cashFlow,
    totalExpenses: summary.totalExpenses,
    surplus: summary.netSurplus,
  };
}

export interface AdvancedDashboardMetrics {
  currentCash: number;
  openingCash: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  studentOutstanding: number;
  expenseCategories: { category: string; amount: number; percentage: number }[];
  revenueCategories: { category: string; amount: number; percentage: number }[];
}

/**
 * Computes advanced metrics for the redesigned Minimalist Admin Dashboard.
 */
export async function getAdvancedDashboardMetrics(
  startDateStr: string,
  endDateStr: string
): Promise<AdvancedDashboardMetrics> {
  if (isGuestMode()) {
    const fallback = getDemoAdminDashboardMetrics(startDateStr, endDateStr);
    const totalRev = fallback.surplus + fallback.totalExpenses;
    const totalExp = fallback.totalExpenses;

    return {
      currentCash: 54000,
      openingCash: 50000,
      totalRevenue: totalRev,
      totalExpenses: totalExp,
      netProfit: fallback.surplus,
      studentOutstanding: 12500,
      expenseCategories: totalExp > 0 ? [
        { category: 'Paper Purchase', amount: totalExp * 0.5, percentage: 50 },
        { category: 'Printer Ink', amount: totalExp * 0.375, percentage: 37.5 },
        { category: 'Utilities', amount: totalExp * 0.125, percentage: 12.5 },
      ] : [],
      revenueCategories: totalRev > 0 ? [
        { category: 'Color Printing', amount: totalRev * 0.4, percentage: 40 },
        { category: 'Double-Sided Printing', amount: totalRev * 0.35, percentage: 35 },
        { category: 'Single-Sided Printing', amount: totalRev * 0.25, percentage: 25 },
      ] : []
    };
  }

  const supabase = createClient();
  const startDate = startDateStr.includes('T') ? startDateStr : `${startDateStr}T00:00:00.000Z`;
  const endDate = endDateStr.includes('T') ? endDateStr : `${endDateStr}T23:59:59.999Z`;

  // 1. Fetch ALL non-voided journal entries up to endDate (for cumulative balances)
  let { data: entriesData, error: entriesError } = await supabase
    .from('journal_entries')
    .select('id, date, description, is_closing_entry')
    .is('voided_at', null)
    .lte('date', endDate);

  if (entriesError && (entriesError as any).code === '42703') {
    const fallback = await supabase
      .from('journal_entries')
      .select('id, date, description')
      .lte('date', endDate);
    entriesData = fallback.data as any;
  }

  const entries = entriesData || [];

  // Filter out automated Financial Year closing entries (but keep Opening Balances)
  const operationalEntries = entries.filter((e: any) => {
    if (e.is_closing_entry === true) return false;
    const desc = (e.description || '').toLowerCase();
    return !desc.includes('closing entry');
  });

  const entryIds = operationalEntries.map((e: any) => e.id);

  // If no entries, return 0s
  if (entryIds.length === 0) {
    return {
      currentCash: 0, openingCash: 0, totalRevenue: 0, totalExpenses: 0, netProfit: 0, studentOutstanding: 0, expenseCategories: [], revenueCategories: []
    };
  }

  // 2. Fetch all lines for these entries joined with account metadata
  // We chunk the entryIds if there are too many (Supabase limit is usually fine up to a few thousand in an IN clause, but let's just do it directly)
  const { data: lines, error: linesError } = await supabase
    .from('journal_entry_lines')
    .select('journal_entry_id, debit_amount, credit_amount, accounts(id, name, type, is_student_account)')
    .in('journal_entry_id', entryIds);

  if (linesError || !lines) {
    return { currentCash: 0, openingCash: 0, totalRevenue: 0, totalExpenses: 0, netProfit: 0, studentOutstanding: 0, expenseCategories: [], revenueCategories: [] };
  }

  // Create a map of entry date and description for quick lookup
  const entryMap = new Map(operationalEntries.map((e: any) => [e.id, { date: new Date(e.date).getTime(), desc: (e.description || '').toLowerCase() }]));
  const startMs = new Date(startDate).getTime();

  let currentCash = 0;
  let openingCash = 0;
  let studentOutstanding = 0;
  let totalRevenue = 0;
  let totalExpenses = 0;
  const expenseMap: Record<string, number> = {};
  const revenueMap: Record<string, number> = {};

  lines.forEach((l: any) => {
    const debit = Number(l.debit_amount || 0);
    const credit = Number(l.credit_amount || 0);
    const acc = l.accounts as any;
    if (!acc) return;

    const entryInfo = entryMap.get(l.journal_entry_id);
    if (!entryInfo) return;

    const isWithinPeriod = entryInfo.date >= startMs;
    const isOpening = entryInfo.desc.includes('opening');

    // Cumulative Cash
    const isCashAccount = acc.type === 'asset' && !acc.is_student_account && (acc.name || '').toLowerCase().includes('cash');
    if (isCashAccount) {
      currentCash += (debit - credit);
      if (entryInfo.date < startMs || isOpening) {
        openingCash += (debit - credit);
      }
    }

    // Cumulative Student Outstanding
    if (acc.is_student_account) {
      studentOutstanding += (debit - credit);
    }

    // Period Revenue & Expenses
    if (isWithinPeriod) {
      if (acc.type === 'revenue') {
        const revAmount = (credit - debit);
        totalRevenue += revAmount;
        if (revAmount > 0) {
          revenueMap[acc.name] = (revenueMap[acc.name] || 0) + revAmount;
        }
      }
      if (acc.type === 'expense') {
        const expAmount = (debit - credit);
        totalExpenses += expAmount;
        if (expAmount > 0) {
          expenseMap[acc.name] = (expenseMap[acc.name] || 0) + expAmount;
        }
      }
    }
  });

  const netProfit = totalRevenue - totalExpenses;

  // Format expense categories for chart
  const expenseCategories = Object.keys(expenseMap).map(name => {
    const amt = expenseMap[name];
    return {
      category: name,
      amount: amt,
      percentage: totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0
    };
  }).sort((a, b) => b.amount - a.amount);

  const revenueCategories = Object.keys(revenueMap).map(name => {
    const amt = revenueMap[name];
    return {
      category: name,
      amount: amt,
      percentage: totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0
    };
  }).sort((a, b) => b.amount - a.amount);

  return {
    currentCash,
    openingCash,
    totalRevenue,
    totalExpenses,
    netProfit,
    studentOutstanding,
    expenseCategories,
    revenueCategories,
  };
}

/**
 * Updates/renames a ledger account's name in the database.
 */
export async function updateAccountName(
  accountId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  if (isGuestMode()) {
    return updateDemoAccountName(accountId, newName);
  }

  const cleanName = newName.trim();
  if (!cleanName) {
    return { success: false, error: 'Account name cannot be empty.' };
  }

  const supabase = createClient();

  // Check for duplicate account name (excluding current account ID)
  const { data: existing } = await supabase
    .from('accounts')
    .select('id, name')
    .ilike('name', cleanName)
    .neq('id', accountId);

  if (existing && existing.length > 0) {
    return { success: false, error: `Another account named "${cleanName}" already exists.` };
  }

  const { error } = await ((supabase
    .from('accounts') as any)
    .update({ name: cleanName })
    .eq('id', accountId) as Promise<{ error: any }>);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Creates a new General Ledger account in the database.
 */
export async function createAccount(
  name: string,
  type: AccountType,
  isStudentAccount: boolean = false,
  studentId?: string | null
): Promise<{ success: boolean; data?: Account; error?: string }> {
  if (isGuestMode()) {
    return createDemoAccount(name, type, isStudentAccount, studentId) as unknown as { success: boolean; data?: Account; error?: string };
  }

  const cleanName = name.trim();
  if (!cleanName) {
    return { success: false, error: 'Account name is required.' };
  }

  const supabase = createClient();

  // Check for existing account with same name
  const { data: existing } = await supabase
    .from('accounts')
    .select('id, name')
    .ilike('name', cleanName);

  if (existing && existing.length > 0) {
    return { success: false, error: `An account named "${cleanName}" already exists.` };
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      name: cleanName,
      type,
      is_student_account: isStudentAccount,
      student_id: studentId || null,
    } as any)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data as unknown as Account };
}

