import { createClient } from '@/lib/supabase/client';
import { Student } from '@/types/database.types';
import { normalizePhone, formatStudentName } from './authService';
import { compareBatchNames } from './batchService';
import {
  isGuestMode,
  getDemoStudents,
  updateDemoStudent,
  archiveDemoStudent,
  restoreDemoStudent,
  getDemoStudentDetailsAndBalance,
} from '@/lib/demo/demoStore';

export interface StudentWithDetails extends Student {
  batch_name: string;
  account_id?: string;
  balance: number;
}

/**
 * Fetches students filtered by status ('active' | 'archived') and search term.
 * Computes live ledger balance per student directly from journal_entry_lines.
 * Automatically sorted by Batch Order: General -> JD -> HS -> BS (numerically within batch), then by student name.
 */
export async function getStudents(options?: {
  status?: 'active' | 'archived';
  search?: string;
}): Promise<StudentWithDetails[]> {
  if (isGuestMode()) {
    return getDemoStudents(options);
  }

  const supabase = createClient();
  const targetStatus = options?.status || 'active';

  // 1. Fetch students — no FK join to avoid schema-cache issues
  const { data: studentsData, error } = await (supabase
    .from('students' as any)
    .select('*')
    .eq('status', targetStatus) as unknown as Promise<{ data: any[] | null; error: any }>);

  if (error) {
    console.error('Error fetching students:', error?.message || error?.code || JSON.stringify(error));
    return [];
  }

  if (!studentsData || studentsData.length === 0) {
    return [];
  }

  // 2. Fetch all batches for name and category lookup
  const { data: batchesData } = await (supabase
    .from('batches' as any)
    .select('id, name, category') as unknown as Promise<{ data: any[] | null; error: any }>);

  const batchNameMap = new Map<string, string>();
  const batchCategoryMap = new Map<string, string>();
  (batchesData || []).forEach((b: any) => {
    if (b.id) {
      batchNameMap.set(b.id, b.name);
      if (b.category) batchCategoryMap.set(b.id, b.category);
    }
  });

  // 3. Fetch student Accounts Receivable account IDs
  const studentIds = studentsData.map((s) => s.id);
  const { data: accountsData } = await (supabase
    .from('accounts' as any)
    .select('id, student_id')
    .in('student_id', studentIds) as unknown as Promise<{ data: any[] | null; error: any }>);

  const studentAccountMap = new Map<string, string>(); // studentId -> accountId
  const accountIds: string[] = [];

  (accountsData || []).forEach((acc) => {
    if (acc.student_id) {
      studentAccountMap.set(acc.student_id, acc.id);
      accountIds.push(acc.id);
    }
  });

  // 4. Fetch journal lines for these student accounts to compute live signed balance (Debit - Credit)
  const balanceMap = new Map<string, number>(); // accountId -> balance

  if (accountIds.length > 0) {
    let { data: linesData, error: linesError } = await (supabase
      .from('journal_entry_lines' as any)
      .select('account_id, debit_amount, credit_amount, journal_entries!inner(voided_at)')
      .in('account_id', accountIds)
      .is('journal_entries.voided_at', null) as unknown as Promise<{ data: any[] | null; error: any }>);

    if (linesError && (linesError as { code?: string }).code === '42703') {
      const fallback = await (supabase
        .from('journal_entry_lines' as any)
        .select('account_id, debit_amount, credit_amount')
        .in('account_id', accountIds) as unknown as Promise<{ data: any[] | null; error: any }>);
      linesData = fallback.data as typeof linesData;
    }

    (linesData || []).forEach((line) => {
      const current = balanceMap.get(line.account_id) || 0;
      const net = Number(line.debit_amount || 0) - Number(line.credit_amount || 0);
      balanceMap.set(line.account_id, current + net);
    });
  }

  // 5. Map into response structure
  let result: StudentWithDetails[] = studentsData.map((s) => {
    const accountId = studentAccountMap.get(s.id);
    const balance = accountId ? balanceMap.get(accountId) || 0 : 0;

    return {
      ...(s as Student),
      batch_name: batchNameMap.get(s.batch_id) || 'Unassigned',
      account_id: accountId,
      balance,
    };
  });

  // 6. Apply search filter (Name, Phone, or Batch)
  if (options?.search && options.search.trim()) {
    const term = options.search.trim().toLowerCase();
    const cleanTermPhone = normalizePhone(term);

    result = result.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(term);
      const batchMatch = s.batch_name.toLowerCase().includes(term);
      const phoneMatch = cleanTermPhone ? s.phone.includes(cleanTermPhone) : s.phone.toLowerCase().includes(term);
      return nameMatch || batchMatch || phoneMatch;
    });
  }

  // 7. Sort by Batch category order: General -> JD -> HS -> BS, then numerically within category, then student name
  result.sort((a, b) => {
    const batchA = a.batch_name || '';
    const batchB = b.batch_name || '';
    const catA = batchCategoryMap.get(a.batch_id);
    const catB = batchCategoryMap.get(b.batch_id);
    const batchCmp = compareBatchNames(batchA, batchB, catA, catB);
    if (batchCmp !== 0) return batchCmp;
    return (a.name || '').localeCompare(b.name || '');
  });

  return result;
}

/**
 * Updates student details (Name, Phone, Batch).
 * Validates phone uniqueness and automatically capitalizes student name.
 */
export async function updateStudent(
  studentId: string,
  data: { name: string; phone: string; batch_id: string }
): Promise<{ success: boolean; error?: string }> {
  if (isGuestMode()) {
    return updateDemoStudent(studentId, {
      ...data,
      name: formatStudentName(data.name),
    });
  }

  const supabase = createClient();
  const cleanName = formatStudentName(data.name);

  if (!cleanName) {
    return { success: false, error: 'Student name is required.' };
  }
  if (!data.phone || !data.phone.trim()) {
    return { success: false, error: 'Phone number is required.' };
  }

  const cleanPhone = normalizePhone(data.phone);

  // Check phone uniqueness
  const { data: existing } = await (supabase
    .from('students' as any)
    .select('id')
    .eq('phone', cleanPhone)
    .neq('id', studentId)
    .maybeSingle() as unknown as Promise<{ data: any; error: any }>);

  if (existing) {
    return { success: false, error: `Phone number '${data.phone}' is used by another student.` };
  }

  const { error } = await ((supabase
    .from('students' as any) as any)
    .update({
      name: cleanName,
      phone: cleanPhone,
      batch_id: data.batch_id,
    })
    .eq('id', studentId) as unknown as Promise<{ error: any }>);

  if (error) {
    return { success: false, error: error.message };
  }

  // Update associated student AR account name for consistency
  await (supabase
    .from('accounts' as any) as any)
    .update({
      name: `${cleanName} - Accounts Receivable`,
    })
    .eq('student_id', studentId);

  return { success: true };
}

/**
 * Resets student password.
 */
export async function resetStudentPassword(
  studentId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (isGuestMode()) {
    return { success: true };
  }

  const supabase = createClient();

  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters long.' };
  }

  const { error } = await ((supabase
    .from('students' as any) as any)
    .update({ password_hash: newPassword })
    .eq('id', studentId) as unknown as Promise<{ error: any }>);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Soft deletes a student by setting status = 'archived'.
 * Never deletes student record or ledger transactions!
 */
export async function archiveStudent(studentId: string): Promise<{ success: boolean; error?: string }> {
  if (isGuestMode()) {
    return archiveDemoStudent(studentId);
  }

  const supabase = createClient();

  const { error } = await ((supabase
    .from('students' as any) as any)
    .update({ status: 'archived' })
    .eq('id', studentId) as unknown as Promise<{ error: any }>);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Restores an archived student by setting status = 'active'.
 */
export async function restoreStudent(studentId: string): Promise<{ success: boolean; error?: string }> {
  if (isGuestMode()) {
    return restoreDemoStudent(studentId);
  }

  const supabase = createClient();

  const { error } = await ((supabase
    .from('students' as any) as any)
    .update({ status: 'active' })
    .eq('id', studentId) as unknown as Promise<{ error: any }>);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Single source of truth for fetching a student's full profile and live double-entry balance.
 * Used identically across Student Portal, Debit Book, Ledger Accounts, and Reports.
 */
export async function getStudentDetailsAndBalance(identifier: { studentId?: string; phone?: string }): Promise<{
  student: Student & { batch_name: string };
  accountId: string | null;
  balance: number;
  transactions: { id: string; date: string; description: string; debit: number; credit: number; runningBalance: number }[];
} | null> {
  if (isGuestMode()) {
    return getDemoStudentDetailsAndBalance(identifier);
  }

  const supabase = createClient();

  let studentData: any = null;

  if (identifier.studentId) {
    const { data } = await (supabase
      .from('students' as any)
      .select('*, batches(name)')
      .eq('id', identifier.studentId)
      .maybeSingle() as unknown as Promise<{ data: any; error: any }>);
    studentData = data;
  }

  if (!studentData && identifier.phone) {
    const cleanPhone = normalizePhone(identifier.phone);
    const { data } = await (supabase
      .from('students' as any)
      .select('*, batches(name)')
      .eq('phone', cleanPhone)
      .maybeSingle() as unknown as Promise<{ data: any; error: any }>);
    studentData = data;
  }

  if (!studentData) return null;

  const batchObj = studentData.batches as unknown as { name: string } | null;
  const student = {
    ...studentData,
    batch_name: batchObj?.name || 'Unassigned',
  };

  // Fetch Accounts Receivable account for this student
  const { data: account } = await (supabase
    .from('accounts' as any)
    .select('id')
    .eq('student_id', student.id)
    .maybeSingle() as unknown as Promise<{ data: any; error: any }>);

  if (!account?.id) {
    return {
      student,
      accountId: null,
      balance: 0,
      transactions: [],
    };
  }

  // Query non-voided journal entry lines for this account
  const { data: lines, error: linesErr } = await (supabase
    .from('journal_entry_lines' as any)
    .select('id, debit_amount, credit_amount, journal_entries!inner(date, description, voided_at)')
    .eq('account_id', account.id)
    .is('journal_entries.voided_at', null) as unknown as Promise<{ data: any[] | null; error: any }>);

  if (linesErr) {
    console.error('[getStudentDetailsAndBalance Error fetching lines]:', linesErr);
  }

  let balance = 0;
  const transactions: { id: string; date: string; description: string; debit: number; credit: number; runningBalance: number }[] = [];

  if (lines && lines.length > 0) {
    // Sort lines in chronological order based on journal entry date or fallback
    const sortedLines = [...lines].sort((a, b) => {
      const dateA = (a.journal_entries as any)?.date ? new Date((a.journal_entries as any).date).getTime() : 0;
      const dateB = (b.journal_entries as any)?.date ? new Date((b.journal_entries as any).date).getTime() : 0;
      return dateA - dateB;
    });

    sortedLines.forEach((l) => {
      const debit = Number(l.debit_amount || 0);
      const credit = Number(l.credit_amount || 0);
      balance += (debit - credit);

      const entryHeader = l.journal_entries as unknown as { date: string; description: string; created_by?: string } | null;
      const dateVal = entryHeader?.date ? new Date(entryHeader.date).toLocaleDateString('en-GB') : 'N/A';
      let desc = entryHeader?.description || 'Transaction';

      // Surface staff attribution for cash collections if not already present
      if (credit > 0 && !desc.toLowerCase().includes('collected by')) {
        if (desc.toLowerCase().includes('cash payment') || desc.toLowerCase().includes('incharge') || desc.toLowerCase().includes('in-charge')) {
          desc = `${desc} — collected by Staff In-Charge`;
        }
      }

      transactions.push({
        id: l.id,
        date: dateVal,
        description: desc,
        debit,
        credit,
        runningBalance: balance,
      });
    });
  }

  return {
    student,
    accountId: account.id,
    balance,
    transactions,
  };
}
