import { createClient } from '@/lib/supabase/client';
import { FinancialYear } from '@/types/database.types';
import { formatDate } from '@/utils/formatDate';
import { calculatePeriodFinancialSummary } from './accountingService';
import {
  isGuestMode,
  getDemoFinancialYears,
  updateDemoFinancialYearDates,
  rolloverDemoFinancialYear,
  undoDemoLastRollover,
  getDemoJournalEntries,
  getDemoStudents,
  getDemoAccounts,
  getDemoBatches,
} from '@/lib/demo/demoStore';

export interface RollOverResult {
  success: boolean;
  closedYearName?: string;
  newYearName?: string;
  surplusClosed?: number;
  promotedStudentsCount?: number;
  alumniStudentsCount?: number;
  archivedStudentsCount?: number;
  alumniBatchName?: string;
  error?: string;
}

export interface RollOverPreview {
  currentFYName: string;
  currentStartDate: string;
  currentEndDate: string;
  totalRevenue: number;
  totalExpense: number;
  netSurplus: number;
  fundBalanceAccountName: string;
  proposedNextFYName: string;
  proposedNextStartDate: string;
  proposedNextEndDate: string;
  proposedAlumniBatchName: string;
  promotedStudentsCount: number;
  alumniStudentsCount: number;
  archivedStudentsCount: number;
  totalReceivable: number;
  totalPayable: number;
  studentBalancesCarryForward: boolean;
  isReadOnlyPreview: boolean;
}

export const PROMOTION_MAPPING: Record<string, string> = {
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

export function normalizeBatchName(name: string): string {
  return (name || '').replace(/[\s-]/g, '').toUpperCase();
}

function computeNextFinancialYearDates(currentEndDateStr: string) {
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

/**
 * Fetches the currently active financial year.
 * Orders by start_date asc to reliably return the current primary active financial year.
 */
export async function getCurrentFinancialYear(): Promise<FinancialYear | null> {
  if (isGuestMode()) {
    const list = getDemoFinancialYears();
    return (list.find((fy) => fy.is_current) || list[0]) as unknown as FinancialYear;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('financial_years')
    .select('*')
    .eq('is_current', true)
    .order('start_date', { ascending: true })
    .limit(1);

  if (error) {
    console.error('Error fetching current FY:', error);
    return null;
  }

  if (data && data.length > 0) {
    return data[0] as unknown as FinancialYear;
  }

  // Auto-initialize current FY if none exists
  const now = new Date();
  const currentYear = now.getFullYear();
  const name = `FY ${currentYear}-${currentYear + 1}`;
  const startDate = `${currentYear}-01-01`;
  const endDate = `${currentYear}-12-31`;

  const { data: created, error: createError } = await (supabase
    .from('financial_years' as any) as any)
    .insert({
      name,
      start_date: startDate,
      end_date: endDate,
      is_current: true,
    })
    .select()
    .single();

  if (createError) {
    console.error('Failed to create initial FY:', createError);
    return null;
  }

  return created as unknown as FinancialYear;
}

/**
 * Fetches list of all financial years.
 */
export async function getFinancialYears(): Promise<FinancialYear[]> {
  if (isGuestMode()) {
    return getDemoFinancialYears() as unknown as FinancialYear[];
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('financial_years')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) {
    console.error('Error fetching financial years:', error);
    return [];
  }

  return (data || []) as unknown as FinancialYear[];
}

/**
 * Checks for transactions existing outside the given date range.
 */
export async function checkOutofRangeTransactions(startDate: string, endDate: string): Promise<{
  outOfRangeCount: number;
  warning?: string;
}> {
  if (isGuestMode()) {
    return { outOfRangeCount: 0 };
  }

  const supabase = createClient();
  const startISO = `${startDate}T00:00:00.000Z`;
  const endISO = `${endDate}T23:59:59.999Z`;

  const { data: beforeEntries } = await supabase
    .from('journal_entries')
    .select('id')
    .lt('date', startISO)
    .is('voided_at', null);

  const { data: afterEntries } = await supabase
    .from('journal_entries')
    .select('id')
    .gt('date', endISO)
    .is('voided_at', null);

  const totalBefore = beforeEntries?.length || 0;
  const totalAfter = afterEntries?.length || 0;
  const totalOut = totalBefore + totalAfter;

  if (totalOut > 0) {
    let msg = `Warning: ${totalOut} active transaction(s) exist outside this period range.`;
    if (totalAfter > 0) {
      msg += ` ${totalAfter} transaction(s) are dated after your new end date (${formatDate(endDate)}) and will fall into next year once you roll over.`;
    }
    if (totalBefore > 0) {
      msg += ` ${totalBefore} transaction(s) are dated before your new start date (${formatDate(startDate)}).`;
    }
    return { outOfRangeCount: totalOut, warning: msg };
  }

  return { outOfRangeCount: 0 };
}

/**
 * Updates start date, end date, and optional name of an active financial year.
 * Routes through server API to bypass client RLS policies.
 */
export async function updateFinancialYearDates(
  fyId: string,
  startDate: string,
  endDate: string,
  name?: string
): Promise<{ success: boolean; error?: string; warning?: string }> {
  if (isGuestMode()) {
    return updateDemoFinancialYearDates(fyId, startDate, endDate);
  }

  if (new Date(endDate) <= new Date(startDate)) {
    return { success: false, error: 'End Date must be strictly after Start Date.' };
  }

  const { warning } = await checkOutofRangeTransactions(startDate, endDate);

  try {
    const res = await fetch('/api/financial-year/update-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fyId, startDate, endDate, name }),
    });

    const data = await res.json();
    if (!data.success) {
      return { success: false, error: data.error || 'Failed to update financial year dates.' };
    }

    return { success: true, warning };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Request failed.' };
  }
}

/**
 * Generates a SAFE, READ-ONLY Preview (Dry-Run) of the Financial & Academic Rollover.
 * ZERO database writes occur during this execution.
 */
export async function previewRolloverFinancialYear(): Promise<{
  success: boolean;
  preview?: RollOverPreview;
  error?: string;
}> {
  if (isGuestMode()) {
    const currentFY = await getCurrentFinancialYear();
    if (!currentFY) {
      return { success: false, error: 'No active financial year found.' };
    }

    const demoAccounts = getDemoAccounts();
    let fundBalanceAccName = 'Fund Balance / Net Assets';
    demoAccounts.forEach((acc) => {
      if (acc.type === 'equity') fundBalanceAccName = acc.name;
    });

    const summary = await calculatePeriodFinancialSummary(currentFY.start_date, currentFY.end_date);
    const totalRevenue = summary.totalRevenue;
    const totalExpense = summary.totalExpenses;
    const netSurplus = summary.netSurplus;

    const demoBatches = getDemoBatches();
    const batchObjMap = new Map<string, { id: string; name: string; category: string }>();
    demoBatches.forEach((b) => {
      batchObjMap.set(b.id, b);
    });

    const activeStudents = getDemoStudents({ status: 'active' });
    let promotedStudentsCount = 0;
    let alumniStudentsCount = 0;
    let archivedStudentsCount = 0;
    let totalReceivable = 0;
    let totalPayable = 0;

    activeStudents.forEach((student) => {
      const batch = batchObjMap.get(student.batch_id);
      const rawBatchName = batch ? batch.name : '';
      const normBatchName = normalizeBatchName(rawBatchName);

      const pendingBalance = student.balance || 0;

      if (pendingBalance > 0) {
        totalReceivable += pendingBalance;
      } else if (pendingBalance < 0) {
        totalPayable += Math.abs(pendingBalance);
      }

      const nextBatchName = PROMOTION_MAPPING[normBatchName];

      if (nextBatchName) {
        promotedStudentsCount++;
      } else if (normBatchName === 'BS5') {
        if (pendingBalance > 0) {
          alumniStudentsCount++;
        } else {
          archivedStudentsCount++;
        }
      }
    });

    const nextFYDates = computeNextFinancialYearDates(currentFY.end_date);
    const gradYear = new Date(`${currentFY.end_date}T00:00:00.000Z`).getUTCFullYear();

    return {
      success: true,
      preview: {
        currentFYName: currentFY.name,
        currentStartDate: currentFY.start_date,
        currentEndDate: currentFY.end_date,
        totalRevenue,
        totalExpense,
        netSurplus,
        fundBalanceAccountName: fundBalanceAccName,
        proposedNextFYName: nextFYDates.name,
        proposedNextStartDate: nextFYDates.startDate,
        proposedNextEndDate: nextFYDates.endDate,
        proposedAlumniBatchName: `Alumni ${gradYear}`,
        promotedStudentsCount,
        alumniStudentsCount,
        archivedStudentsCount,
        totalReceivable,
        totalPayable,
        studentBalancesCarryForward: true,
        isReadOnlyPreview: true,
      },
    };
  }

  const supabase = createClient();
  try {
    const currentFY = await getCurrentFinancialYear();
    if (!currentFY) {
      return { success: false, error: 'No active financial year found.' };
    }

    const { data: accountsData } = await supabase.from('accounts').select('id, name, type');
    let fundBalanceAccName = 'Fund Balance / Net Assets';

    (accountsData || []).forEach((acc: any) => {
      if (acc.type === 'equity') fundBalanceAccName = acc.name;
    });

    const summary = await calculatePeriodFinancialSummary(currentFY.start_date, currentFY.end_date);
    const totalRevenue = summary.totalRevenue;
    const totalExpense = summary.totalExpenses;
    const netSurplus = summary.netSurplus;

    const { data: batchesData } = await supabase.from('batches').select('*');
    const batchObjMap = new Map<string, { id: string; name: string; category: string }>();
    (batchesData || []).forEach((b: any) => {
      batchObjMap.set(b.id, b);
    });

    const { data: activeStudents } = await supabase
      .from('students')
      .select('id, name, batch_id, status')
      .eq('status', 'active');

    let promotedStudentsCount = 0;
    let alumniStudentsCount = 0;
    let archivedStudentsCount = 0;
    let totalReceivable = 0;
    let totalPayable = 0;

    if (activeStudents && activeStudents.length > 0) {
      const studentIds = (activeStudents as any[]).map((s) => s.id);
      const { data: studentAccounts } = await supabase
        .from('accounts')
        .select('id, student_id')
        .in('student_id', studentIds);

      const studentAccountMap = new Map<string, string>();
      const accountIds: string[] = [];

      (studentAccounts || []).forEach((acc: any) => {
        if (acc.student_id) {
          studentAccountMap.set(acc.student_id, acc.id);
          accountIds.push(acc.id);
        }
      });

      const balanceMap = new Map<string, number>();
      if (accountIds.length > 0) {
        let { data: linesData } = await supabase
          .from('journal_entry_lines')
          .select('account_id, debit_amount, credit_amount, journal_entries!inner(voided_at)')
          .in('account_id', accountIds)
          .is('journal_entries.voided_at', null);

        (linesData || []).forEach((line: any) => {
          const current = balanceMap.get(line.account_id) || 0;
          const net = Number(line.debit_amount || 0) - Number(line.credit_amount || 0);
          balanceMap.set(line.account_id, current + net);
        });
      }

      for (const student of (activeStudents as any[])) {
        const batch = batchObjMap.get(student.batch_id);
        const rawBatchName = batch ? batch.name : '';
        const normBatchName = normalizeBatchName(rawBatchName);

        const accountId = studentAccountMap.get(student.id);
        const pendingBalance = accountId ? balanceMap.get(accountId) || 0 : 0;

        if (pendingBalance > 0) {
          totalReceivable += pendingBalance;
        } else if (pendingBalance < 0) {
          totalPayable += Math.abs(pendingBalance);
        }

        const nextBatchName = PROMOTION_MAPPING[normBatchName];

        if (nextBatchName) {
          promotedStudentsCount++;
        } else if (normBatchName === 'BS5') {
          if (pendingBalance > 0) {
            alumniStudentsCount++;
          } else {
            archivedStudentsCount++;
          }
        }
      }
    }

    const nextFYDates = computeNextFinancialYearDates(currentFY.end_date);
    const gradYear = new Date(`${currentFY.end_date}T00:00:00.000Z`).getUTCFullYear();

    return {
      success: true,
      preview: {
        currentFYName: currentFY.name,
        currentStartDate: currentFY.start_date,
        currentEndDate: currentFY.end_date,
        totalRevenue,
        totalExpense,
        netSurplus,
        fundBalanceAccountName: fundBalanceAccName,
        proposedNextFYName: nextFYDates.name,
        proposedNextStartDate: nextFYDates.startDate,
        proposedNextEndDate: nextFYDates.endDate,
        proposedAlumniBatchName: `Alumni ${gradYear}`,
        promotedStudentsCount,
        alumniStudentsCount,
        archivedStudentsCount,
        totalReceivable,
        totalPayable,
        studentBalancesCarryForward: true,
        isReadOnlyPreview: true,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Preview calculation failed.';
    return { success: false, error: msg };
  }
}

/**
 * Executes Financial & Academic Year Rollover.
 * Routes through server API to bypass client RLS policies.
 */
export async function rollOverFinancialYear(): Promise<RollOverResult> {
  if (isGuestMode()) {
    return rolloverDemoFinancialYear();
  }

  try {
    const res = await fetch('/api/financial-year/rollover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Financial rollover request failed.' };
  }
}

/**
 * Checks if the last closed rollover can be safely undone.
 */
export async function checkCanUndoRollover(): Promise<{
  canUndo: boolean;
  lastClosedFY?: FinancialYear | null;
  reason?: string;
}> {
  if (isGuestMode()) {
    const list = getDemoFinancialYears();
    const lastClosed = list.find((f) => !f.is_current && f.closed_at);
    if (!lastClosed) {
      return { canUndo: false, reason: 'No closed financial year available to undo.' };
    }
    const currentFY = list.find((f) => f.is_current);
    if (currentFY && currentFY.id !== lastClosed.id) {
      const entries = getDemoJournalEntries();
      const newEntries = entries.filter(
        (e) => !e.voided_at && e.date >= currentFY.start_date && e.date <= currentFY.end_date && e.id !== lastClosed.closing_entry_id
      );
      if (newEntries.length > 0) {
        return {
          canUndo: false,
          lastClosedFY: lastClosed as unknown as FinancialYear,
          reason: `Undo is disabled because active journal entries have already been posted into the new financial year (${currentFY.name || currentFY.year_label}).`,
        };
      }
    }
    return {
      canUndo: true,
      lastClosedFY: lastClosed as unknown as FinancialYear,
    };
  }

  const supabase = createClient();
  const { data: closedYears } = await supabase
    .from('financial_years')
    .select('*')
    .eq('is_current', false)
    .not('closed_at', 'is', null)
    .order('closed_at', { ascending: false })
    .limit(1);

  if (!closedYears || (closedYears as any[]).length === 0) {
    return { canUndo: false, reason: 'No closed financial year available to undo.' };
  }

  const lastClosedFY = closedYears[0] as unknown as FinancialYear;

  const { data: currentFYs } = await supabase
    .from('financial_years')
    .select('*')
    .eq('is_current', true)
    .order('start_date', { ascending: true })
    .limit(1);

  const currentFY = currentFYs && currentFYs.length > 0 ? currentFYs[0] as unknown as FinancialYear : null;

  if (currentFY && currentFY.id !== lastClosedFY.id) {
    const { data: newEntries } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('financial_year_id', currentFY.id)
      .is('voided_at', null)
      .limit(1);

    if (newEntries && newEntries.length > 0) {
      return {
        canUndo: false,
        lastClosedFY,
        reason: `Undo is disabled because active journal entries have already been posted into the new financial year (${currentFY.name}).`,
      };
    }
  }

  return { canUndo: true, lastClosedFY };
}

/**
 * Executes REVERSAL / UNDO of the last completed financial year rollover.
 * Routes through server API to bypass client RLS policies.
 */
export async function undoLastRollover(): Promise<{
  success: boolean;
  reopenedYearName?: string;
  error?: string;
}> {
  if (isGuestMode()) {
    return undoDemoLastRollover();
  }

  try {
    const res = await fetch('/api/financial-year/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Undo rollover request failed.' };
  }
}

/**
 * Generates downloadable CSV content for an individual account's ledger history.
 */
export async function exportAccountLedgerCSV(accountId: string, accountName: string): Promise<string> {
  if (isGuestMode()) {
    const entries = getDemoJournalEntries();
    const rows = [
      ['Account Name', accountName],
      ['Export Date', formatDate(new Date())],
      [],
      ['Date', 'Description', 'Debit (₹)', 'Credit (₹)', 'Running Balance (₹)'],
    ];

    let runningBalance = 0;

    entries.forEach((e) => {
      e.journal_entry_lines.forEach((l: any) => {
        if (l.account_id === accountId) {
          const date = formatDate(e.date);
          const description = (e.description || 'Transaction').replace(/"/g, '""');
          const debit = Number(l.debit_amount || 0);
          const credit = Number(l.credit_amount || 0);

          runningBalance += (debit - credit);

          rows.push([
            `"${date}"`,
            `"${description}"`,
            debit > 0 ? debit.toFixed(2) : '0.00',
            credit > 0 ? credit.toFixed(2) : '0.00',
            runningBalance.toFixed(2),
          ]);
        }
      });
    });

    return rows.map((r) => r.join(',')).join('\n');
  }

  const supabase = createClient();
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('debit_amount, credit_amount, journal_entries(date, description)')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });

  const rows = [
    ['Account Name', accountName],
    ['Export Date', formatDate(new Date())],
    [],
    ['Date', 'Description', 'Debit (₹)', 'Credit (₹)', 'Running Balance (₹)'],
  ];

  let runningBalance = 0;

  (lines || []).forEach((l: any) => {
    const entryHeader = l.journal_entries as unknown as { date: string; description: string } | null;
    const date = formatDate(entryHeader?.date);
    const description = (entryHeader?.description || 'Transaction').replace(/"/g, '""');
    const debit = Number(l.debit_amount || 0);
    const credit = Number(l.credit_amount || 0);

    runningBalance += (debit - credit);

    rows.push([
      `"${date}"`,
      `"${description}"`,
      debit > 0 ? debit.toFixed(2) : '0.00',
      credit > 0 ? credit.toFixed(2) : '0.00',
      runningBalance.toFixed(2),
    ]);
  });

  return rows.map((r) => r.join(',')).join('\n');
}
