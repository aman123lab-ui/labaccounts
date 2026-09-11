import { createClient } from '@/lib/supabase/client';
import { validateJournalEntryLines } from '@/lib/accounting/ledger';
import { Account, AccountType } from '@/types/database.types';
import { formatDate } from '@/utils/formatDate';
import { getCurrentFinancialYear } from '@/services/financialYearService';
import {
  isGuestMode,
  getDemoJournalEntries,
  voidDemoJournalEntry,
  deleteDemoJournalEntry,
  updateDemoJournalEntry,
  getDemoAccounts,
  getDemoLedgerAccountsGrouped,
} from '@/lib/demo/demoStore';


export interface DetailedJournalLine {
  id: string;
  account_id: string;
  account_name: string;
  account_type: AccountType;
  is_student_account: boolean;
  student_name?: string | null;
  debit_amount: number;
  credit_amount: number;
}

export interface DetailedJournalEntry {
  id: string;
  date: string;
  description: string;
  financial_year_id?: string | null;
  created_by?: string | null;
  created_at: string;
  voided_at?: string | null;
  voided_by?: string | null;
  lines: DetailedJournalLine[];
}

export interface JournalFilters {
  startDate?: string;
  endDate?: string;
  studentId?: string;
  accountId?: string;
  financialYearId?: string | null;
}

/**
 * Fetches all journal entries ordered newest first, with line details and optional AND filters.
 * Scoped to current financial year by default to enforce historical data separation.
 */
export async function getJournalEntries(filters?: JournalFilters): Promise<DetailedJournalEntry[]> {
  if (isGuestMode()) {
    const demoEntries = getDemoJournalEntries({
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      financialYearId: filters?.financialYearId,
    });
    return demoEntries as unknown as DetailedJournalEntry[];
  }

  const supabase = createClient();

  let query = supabase
    .from('journal_entries')
    .select(
      'id, date, description, financial_year_id, created_by, created_at, voided_at, voided_by, journal_entry_lines(id, account_id, debit_amount, credit_amount, accounts(id, name, type, is_student_account, students(name)))'
    )
    .order('date', { ascending: false });

  // FY Scoping: filter by specific FY or current FY by default unless 'ALL' specified
  let fyIdToFilter = filters?.financialYearId;
  let targetFY: any = null;

  if (fyIdToFilter === undefined) {
    targetFY = await getCurrentFinancialYear();
    if (targetFY?.id) {
      fyIdToFilter = targetFY.id;
    }
  } else if (fyIdToFilter && fyIdToFilter !== 'ALL') {
    const { data: fy } = await supabase
      .from('financial_years')
      .select('*')
      .eq('id', fyIdToFilter)
      .maybeSingle();
    targetFY = fy;
  }

  if (fyIdToFilter && fyIdToFilter !== 'ALL') {
    if (targetFY?.start_date && targetFY?.end_date) {
      const startIso = `${targetFY.start_date}T00:00:00.000Z`;
      const endIso = `${targetFY.end_date}T23:59:59.999Z`;
      query = query.or(`financial_year_id.eq.${fyIdToFilter},and(financial_year_id.is.null,date.gte.${startIso},date.lte.${endIso})`);
    } else {
      query = query.eq('financial_year_id', fyIdToFilter);
    }
  }

  if (filters?.startDate) {
    query = query.gte('date', `${filters.startDate}T00:00:00.000Z`);
  }
  if (filters?.endDate) {
    query = query.lte('date', `${filters.endDate}T23:59:59.999Z`);
  }

  let { data, error } = await query;

  // Fallback if voided_at column doesn't exist in Postgres database schema
  if (error && (error as { code?: string }).code === '42703') {
    let fallbackQuery = supabase
      .from('journal_entries')
      .select(
        'id, date, description, financial_year_id, created_by, created_at, journal_entry_lines(id, account_id, debit_amount, credit_amount, accounts(id, name, type, is_student_account, students(name)))'
      )
      .order('date', { ascending: false });

    if (filters?.startDate) {
      fallbackQuery = fallbackQuery.gte('date', `${filters.startDate}T00:00:00.000Z`);
    }
    if (filters?.endDate) {
      fallbackQuery = fallbackQuery.lte('date', `${filters.endDate}T23:59:59.999Z`);
    }

    const fallbackRes = await fallbackQuery;
    data = fallbackRes.data as typeof data;
    error = fallbackRes.error;
  }

  if (error) {
    console.error('Error loading journal entries:', error);
    return [];
  }

  let result: DetailedJournalEntry[] = (data || []).map((e: any) => {
    const rawLines = (e.journal_entry_lines as unknown as {
      id: string;
      account_id: string;
      debit_amount: number;
      credit_amount: number;
      accounts: {
        id: string;
        name: string;
        type: AccountType;
        is_student_account: boolean;
        students: { name: string } | null;
      } | null;
    }[]) || [];

    const parsedLines: DetailedJournalLine[] = rawLines.map((l) => ({
      id: l.id,
      account_id: l.account_id,
      account_name: l.accounts?.name || 'Account',
      account_type: l.accounts?.type || 'asset',
      is_student_account: !!l.accounts?.is_student_account,
      student_name: l.accounts?.students?.name || null,
      debit_amount: Number(l.debit_amount || 0),
      credit_amount: Number(l.credit_amount || 0),
    }));

    return {
      id: e.id,
      date: e.date,
      description: e.description,
      financial_year_id: e.financial_year_id,
      created_by: e.created_by,
      created_at: e.created_at,
      voided_at: e.voided_at,
      voided_by: e.voided_by,
      lines: parsedLines,
    };
  });

  // Apply Account or Student filter with AND logic
  if (filters?.accountId) {
    let filteredResult = result.filter((entry) =>
      entry.lines.some((l) => l.account_id === filters.accountId)
    );
    if (filters?.studentId) {
      const { data: studentAcc } = await (supabase.from('accounts') as any)
        .select('id')
        .eq('student_id', filters.studentId)
        .maybeSingle();

      if (studentAcc?.id) {
        filteredResult = filteredResult.filter((entry) =>
          entry.lines.some((l) => l.account_id === studentAcc.id)
        );
      } else {
        filteredResult = [];
      }
    }
    return filteredResult;
  }

  if (filters?.studentId) {
    // Find the student's AR account_id
    const { data: studentAcc } = await (supabase.from('accounts') as any)
      .select('id')
      .eq('student_id', filters.studentId)
      .maybeSingle();

    if (studentAcc?.id) {
      return result.filter((entry) =>
        entry.lines.some((l) => l.account_id === studentAcc.id)
      );
    } else {
      return [];
    }
  }

  return result;
}

/**
 * Soft deletes / Voids a journal entry.
 * Excludes it from running balances and reports, while keeping it in DB for audit transparency.
 * Writes snapshot to `journal_entry_audit_log` noting origin source (Debit Book vs Manual).
 */
export async function voidJournalEntry(
  journalEntryId: string,
  voidedBy: string = 'Admin'
): Promise<{ success: boolean; error?: string }> {
  if (isGuestMode()) {
    return voidDemoJournalEntry(journalEntryId);
  }

  const supabase = createClient();

  // 1. Fetch current before_snapshot & detect origin source
  const { data: entry, error: fetchErr } = await (supabase
    .from('journal_entries' as any) as any)
    .select('*, journal_entry_lines(*)')
    .eq('id', journalEntryId)
    .single();

  if (fetchErr || !entry) {
    return { success: false, error: 'Journal entry not found.' };
  }

  // Check if entry originated from Debit Book (linked print_jobs row)
  const { data: printJob } = await (supabase
    .from('print_jobs' as any) as any)
    .select('id, print_type, num_pages, student_id')
    .eq('journal_entry_id', journalEntryId)
    .maybeSingle();

  const source = printJob
    ? 'Debit Book (Print Job)'
    : (entry.description || '').toLowerCase().includes('payment') || (entry.description || '').toLowerCase().includes('credit')
    ? 'Debit Book (Payment Credit)'
    : 'Manual Journal Entry';

  const beforeSnapshot = {
    ...(entry as any),
    source,
    linked_print_job: printJob || null,
  };

  // 2. Insert Audit Log (Graceful if table not yet created on remote DB)
  try {
    const { error: auditErr } = await (supabase.from('journal_entry_audit_log' as any) as any).insert({
      journal_entry_id: journalEntryId,
      action: 'deleted',
      changed_by: voidedBy,
      before_snapshot: beforeSnapshot,
      after_snapshot: null,
    });
    if (auditErr) console.warn('Audit log table notice:', auditErr.message);
  } catch (e) {
    console.warn('Audit log insert catch notice:', e);
  }

  // 3. Mark journal entry as voided with row verification
  const { data: updatedRows, error: updateErr } = await (supabase
    .from('journal_entries' as any) as any)
    .update({
      voided_at: new Date().toISOString(),
      voided_by: voidedBy,
    })
    .eq('id', journalEntryId)
    .select();

  if (updateErr) {
    if ((updateErr as { code?: string }).code === '42703') {
      return {
        success: false,
        error:
          'Database schema update required: Please run SQL migration in Supabase editor to add `voided_at` column (see supabase/schema.sql).',
      };
    }
    return { success: false, error: updateErr.message };
  }

  if (!updatedRows || updatedRows.length === 0) {
    try {
      const apiRes = await fetch('/api/journal/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journalEntryId, voidedBy }),
      });
      const data = await apiRes.json();
      if (data.success) {
        return { success: true };
      }
    } catch (apiErr) {
      console.warn('API route void fallback error:', apiErr);
    }

    return {
      success: false,
      error:
        'Void failed: 0 rows updated in database. Supabase Row Level Security (RLS) policies on `journal_entries` table may be restricting UPDATE operations. Please apply RLS update policies in Supabase SQL editor (see supabase/schema.sql).',
    };
  }

  return { success: true };
}

/**
 * Permanently deletes a journal entry from the database.
 */
export async function deleteJournalEntry(
  journalEntryId: string,
  deletedBy: string = 'Admin'
): Promise<{ success: boolean; error?: string }> {
  if (isGuestMode()) {
    return deleteDemoJournalEntry(journalEntryId);
  }

  try {
    const apiRes = await fetch('/api/journal/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journalEntryId, deletedBy }),
    });
    const data = await apiRes.json();
    if (data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to permanently delete journal entry.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error deleting journal entry.' };
  }
}


/**
 * Updates a journal entry's description, date, and lines.
 * Re-validates that Debits === Credits before saving.
 * Writes before and after snapshots to `journal_entry_audit_log`.
 * Updates linked `print_jobs` table if applicable.
 */
export async function updateJournalEntry(
  journalEntryId: string,
  description: string,
  date: string,
  lines: { id?: string; accountId: string; debit: number; credit: number }[],
  changedBy: string = 'Admin'
): Promise<{ success: boolean; error?: string }> {
  if (isGuestMode()) {
    return updateDemoJournalEntry(journalEntryId, lines, description, date);
  }

  // 1. Re-validate debits == credits
  const validation = validateJournalEntryLines(lines);
  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }

  const supabase = createClient();

  // 2. Fetch current before_snapshot & detect origin source
  const { data: beforeEntry, error: fetchErr } = await supabase
    .from('journal_entries')
    .select('*, journal_entry_lines(*)')
    .eq('id', journalEntryId)
    .single();

  if (fetchErr || !beforeEntry) {
    return { success: false, error: 'Journal entry not found for editing.' };
  }

  const { data: printJob } = await (supabase
    .from('print_jobs' as any) as any)
    .select('id, print_type, num_pages, student_id')
    .eq('journal_entry_id', journalEntryId)
    .maybeSingle();

  const source = printJob
    ? 'Debit Book (Print Job)'
    : ((beforeEntry as any)?.description || '').toLowerCase().includes('payment') || ((beforeEntry as any)?.description || '').toLowerCase().includes('credit')
    ? 'Debit Book (Payment Credit)'
    : 'Manual Journal Entry';

  const beforeSnapshot = {
    ...(beforeEntry as any),
    source,
    linked_print_job: printJob || null,
  };

  const afterSnapshot = {
    journal_entry_id: journalEntryId,
    date,
    description,
    lines,
    source,
  };

  // 3. Insert Audit Log (Graceful handling if table or RLS policy restricts insert)
  try {
    const { error: auditErr } = await (supabase.from('journal_entry_audit_log' as any) as any).insert({
      journal_entry_id: journalEntryId,
      action: 'edited',
      changed_by: changedBy,
      before_snapshot: beforeSnapshot,
      after_snapshot: afterSnapshot,
    });

    if (auditErr) {
      console.warn('Audit log insertion notice:', auditErr.message);
    }
  } catch (err) {
    console.warn('Audit log insert catch notice:', err);
  }

  // 4. Update Header
  const { data: updatedHeaderRows, error: headerErr } = await (supabase
    .from('journal_entries' as any) as any)
    .update({
      description,
      date: new Date(date).toISOString(),
    })
    .eq('id', journalEntryId)
    .select();

  if (headerErr) {
    return { success: false, error: headerErr.message };
  }

  if (!updatedHeaderRows || updatedHeaderRows.length === 0) {
    try {
      const apiRes = await fetch('/api/journal/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journalEntryId, description, date, lines, changedBy }),
      });
      const data = await apiRes.json();
      if (data.success) {
        return { success: true };
      }
    } catch (apiErr) {
      console.warn('API route update fallback error:', apiErr);
    }

    return {
      success: false,
      error:
        'Update failed: 0 rows updated in database. Supabase Row Level Security (RLS) policies on `journal_entries` table may be restricting UPDATE operations. Please apply RLS update policies in Supabase SQL editor (see supabase/schema.sql).',
    };
  }

  // 5. Update / Insert / Delete Lines individually by ID (No blind duplicate insert)
  const { data: existingLines, error: fetchLinesErr } = await supabase
    .from('journal_entry_lines')
    .select('id')
    .eq('journal_entry_id', journalEntryId);

  if (fetchLinesErr) {
    return { success: false, error: `Failed to fetch existing lines: ${fetchLinesErr.message}` };
  }

  const existingIds = new Set((existingLines || []).map((l: any) => l.id));
  const submittedIds = new Set(lines.map((l) => l.id).filter(Boolean) as string[]);

  // 5a. Delete lines removed by admin
  const idsToDelete = Array.from(existingIds).filter((id) => !submittedIds.has(id));
  if (idsToDelete.length > 0) {
    const { error: deleteErr } = await supabase
      .from('journal_entry_lines')
      .delete()
      .in('id', idsToDelete);

    if (deleteErr) {
      return { success: false, error: `Failed to delete removed lines: ${deleteErr.message}` };
    }
  }

  // 5b. Update existing matched lines & Insert newly added lines
  for (const line of lines) {
    if (line.id && existingIds.has(line.id)) {
      const { error: updateLineErr } = await (supabase
        .from('journal_entry_lines' as any) as any)
        .update({
          account_id: line.accountId,
          debit_amount: line.debit,
          credit_amount: line.credit,
        })
        .eq('id', line.id);

      if (updateLineErr) {
        return { success: false, error: `Failed to update line ${line.id}: ${updateLineErr.message}` };
      }
    } else {
      const { error: insertLineErr } = await (supabase
        .from('journal_entry_lines' as any) as any)
        .insert({
          journal_entry_id: journalEntryId,
          account_id: line.accountId,
          debit_amount: line.debit,
          credit_amount: line.credit,
        });

      if (insertLineErr) {
        return { success: false, error: `Failed to insert new line: ${insertLineErr.message}` };
      }
    }
  }

  // 6. SANITY SAFEGUARD CHECK (Step 4 Requirement)
  const { data: finalLines, error: countErr } = await supabase
    .from('journal_entry_lines')
    .select('id')
    .eq('journal_entry_id', journalEntryId);

  if (countErr) {
    return { success: false, error: `Sanity check query failed: ${countErr.message}` };
  }

  if (!finalLines || finalLines.length !== lines.length) {
    return {
      success: false,
      error: `Sanity safeguard error: Submitted ${lines.length} lines, but database now has ${finalLines?.length || 0} lines.`,
    };
  }

  // 7. Update linked print_jobs if applicable
  if (printJob) {
    const debitLine = lines.find((l) => l.debit > 0);
    const updatedAmount = debitLine ? debitLine.debit : 0;
    await (supabase
      .from('print_jobs' as any) as any)
      .update({
        description,
        amount: updatedAmount,
      })
      .eq('id', (printJob as any).id);
  }

  return { success: true };
}

export interface LedgerAccountGroup {
  type: AccountType | 'accounts_receivable';
  title: string;
  accounts: {
    id: string;
    name: string;
    type: AccountType;
    is_student_account: boolean;
    student_name?: string | null;
    lines: {
      lineId: string;
      entryId: string;
      date: string;
      description: string;
      debit: number;
      credit: number;
      runningBalance: number;
      rawEntry: DetailedJournalEntry;
    }[];
    finalBalance: number;
  }[];
}

/**
 * Fetches all accounts grouped by account type, with T-format ledger lines and live running balances.
 * Excludes voided entries from balance calculations.
 */
export async function getLedgerAccountsGrouped(financialYearId?: string): Promise<LedgerAccountGroup[]> {
  if (isGuestMode()) {
    return getDemoLedgerAccountsGrouped(financialYearId) as unknown as LedgerAccountGroup[];
  }

  const supabase = createClient();

  // 1. Fetch Chart of Accounts with student metadata
  const { data: accountsData, error: accErr } = await supabase
    .from('accounts')
    .select('*, students(name)')
    .order('name');

  if (accErr || !accountsData) {
    console.error('Error fetching accounts for ledger view:', accErr);
    return [];
  }

  let fyIdToFilter = financialYearId;
  let targetFY: any = null;

  if (fyIdToFilter === undefined) {
    targetFY = await getCurrentFinancialYear();
    if (targetFY?.id) fyIdToFilter = targetFY.id;
  } else if (fyIdToFilter && fyIdToFilter !== 'ALL') {
    const { data: fy } = await supabase.from('financial_years').select('*').eq('id', fyIdToFilter).maybeSingle();
    targetFY = fy;
  }

  // 2. Fetch NON-VOIDED journal entries up to target FY end date
  let entriesQuery = supabase
    .from('journal_entries')
    .select('id, date, description, voided_at, journal_entry_lines(id, account_id, debit_amount, credit_amount)')
    .is('voided_at', null)
    .order('date', { ascending: true }); // Chronological for running balance calculation

  if (fyIdToFilter && fyIdToFilter !== 'ALL' && targetFY?.end_date) {
    const endIso = `${targetFY.end_date}T23:59:59.999Z`;
    entriesQuery = entriesQuery.lte('date', endIso);
  }

  let { data: entriesData, error: entErr } = await entriesQuery;

  if (entErr && (entErr as { code?: string }).code === '42703') {
    const fallback = await supabase
      .from('journal_entries')
      .select('id, date, description, journal_entry_lines(id, account_id, debit_amount, credit_amount)')
      .order('date', { ascending: true });
    entriesData = fallback.data as typeof entriesData;
    entErr = fallback.error;
  }

  if (entErr) {
    console.error('Error fetching entries for ledger view:', entErr);
    return [];
  }

  // Build a lookup map of account_id -> array of chronological ledger lines
  const accountLinesMap = new Map<
    string,
    { lineId: string; entryId: string; date: string; description: string; debit: number; credit: number; rawEntry: DetailedJournalEntry }[]
  >();

  (entriesData || []).forEach((e: any) => {
    const lines = (e.journal_entry_lines as unknown as { id: string; account_id: string; debit_amount: number; credit_amount: number }[]) || [];
    
    // Construct a minimal rawEntry object for edit modal compatibility
    const rawEntry: DetailedJournalEntry = {
      id: e.id,
      date: e.date,
      description: e.description,
      lines: lines.map((l) => ({
        id: l.id,
        account_id: l.account_id,
        account_name: '',
        account_type: 'asset',
        is_student_account: false,
        debit_amount: Number(l.debit_amount || 0),
        credit_amount: Number(l.credit_amount || 0),
      })),
      created_at: e.date,
    };

    lines.forEach((l) => {
      const arr = accountLinesMap.get(l.account_id) || [];
      arr.push({
        lineId: l.id,
        entryId: e.id,
        date: formatDate(e.date),
        description: e.description,
        debit: Number(l.debit_amount || 0),
        credit: Number(l.credit_amount || 0),
        rawEntry,
      });
      accountLinesMap.set(l.account_id, arr);
    });
  });

  // Group Accounts into Categories
  const arAccounts: LedgerAccountGroup['accounts'] = [];
  const assetAccounts: LedgerAccountGroup['accounts'] = [];
  const liabilityAccounts: LedgerAccountGroup['accounts'] = [];
  const revenueAccounts: LedgerAccountGroup['accounts'] = [];
  const expenseAccounts: LedgerAccountGroup['accounts'] = [];
  const equityAccounts: LedgerAccountGroup['accounts'] = [];

  (accountsData || []).forEach((acc: any) => {
    const rawLines = accountLinesMap.get(acc.id) || [];
    let running = 0;

    const computedLines = rawLines.map((l) => {
      if (acc.type === 'asset' || acc.type === 'expense') {
        running += l.debit - l.credit;
      } else {
        running += l.credit - l.debit;
      }

      return {
        ...l,
        runningBalance: running,
      };
    });

    const studentObj = acc.students as unknown as { name: string } | null;
    const item = {
      id: acc.id,
      name: acc.name,
      type: acc.type as AccountType,
      is_student_account: acc.is_student_account,
      student_name: studentObj?.name || null,
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
