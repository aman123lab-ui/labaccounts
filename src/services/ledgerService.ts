import { createClient } from '@/lib/supabase/client';
import { postJournalEntry } from './accountingService';
import { calculatePrintAmount, PrintTypeOption, PrintSideOption } from '@/config/printingRates';
import { isGuestMode, getDemoAccounts, postDemoJournalEntry } from '@/lib/demo/demoStore';
import { getValidSessionUser } from './authService';

export interface PrintJobItem {
  printType: PrintTypeOption;
  side: PrintSideOption;
  numPages: number;
  discount?: number;
}

export interface PostDebitInput {
  studentIds: string[];
  printType?: PrintTypeOption; // Optional for backward compatibility if items are used
  side?: PrintSideOption;
  numPages?: number;
  description: string;
  discount?: number;
  paidImmediately?: boolean;
  useInchargeCashAccount?: boolean;
  items?: PrintJobItem[];
  revenueAccountId?: string;
}

export interface PostCreditInput {
  studentIds: string[];
  amount: number;
  description: string;
  useInchargeCashAccount?: boolean;
}

export interface LedgerEntryResult {
  studentId: string;
  studentName?: string;
  success: boolean;
  entryId?: string;
  amount: number;
  error?: string;
}

/**
 * Helper to determine whether to debit Cash in Hand (Workforce) vs Lab Cash Account.
 * If explicitly provided, uses the boolean. Otherwise, checks active user role.
 */
async function resolveUseInchargeCash(explicit?: boolean): Promise<boolean> {
  if (typeof explicit === 'boolean') {
    return explicit;
  }
  try {
    const session = await getValidSessionUser();
    return session.role === 'incharge';
  } catch {
    return false;
  }
}

/**
 * Helper to fetch Service Income Account ID (Revenue).
 * Prioritizes 'Printing Revenue', falling back to any revenue account.
 */
async function getServiceIncomeAccountId(): Promise<string> {
  const supabase = createClient();
  const { data } = await (supabase.from('accounts') as any)
    .select('id, name')
    .eq('type', 'revenue');

  if (data && data.length > 0) {
    const defaultAcc = data.find((a: any) => a.name.toLowerCase() === 'printing revenue');
    if (defaultAcc) return defaultAcc.id;
    return data[0].id;
  }
  return '40000000-0000-0000-0000-000000000001';
}

/**
 * Helper to fetch Main Cash Account ID (Asset)
 */
async function getCashAccountId(): Promise<string> {
  const supabase = createClient();
  const { data } = await (supabase.from('accounts') as any)
    .select('id')
    .eq('type', 'asset')
    .eq('is_student_account', false)
    .not('name', 'ilike', '%In-Charge%')
    .not('name', 'ilike', '%Workforce%')
    .limit(1)
    .maybeSingle();

  if (data?.id) return data.id;
  return '10000000-0000-0000-0000-000000000001';
}

/**
 * Helper to fetch Cash in Hand (Workforce / In-Charge) Account ID (Asset)
 */
export async function getCashInHandInchargeAccountId(): Promise<string> {
  const supabase = createClient();
  const { data } = await (supabase.from('accounts') as any)
    .select('id, name')
    .eq('type', 'asset')
    .or('name.ilike.%Cash in Hand (In-Charge)%,name.ilike.%Cash in Hand (Workforce)%,name.ilike.%Cash in Hand%');

  if (data && data.length > 0) {
    const nonMain = data.find((a: any) => a.id !== '10000000-0000-0000-0000-000000000001');
    if (nonMain) return nonMain.id;
  }

  return '10000000-0000-0000-0000-000000000003';
}

/**
 * Posts DEBIT journal entries for service given (Printing).
 * Default (paidImmediately=false): Student Account (Dr) / Service Income Account (Cr)
 * Paid Immediately (paidImmediately=true): Lab Cash or Workforce Cash (Dr) / Service Income Account (Cr)
 * Also creates linked `print_jobs` table row.
 * Generates separate balanced entries for each selected student.
 */
export async function postDebitEntries(input: PostDebitInput): Promise<{
  success: boolean;
  totalPosted: number;
  results: LedgerEntryResult[];
  error?: string;
}> {
  // Determine effective print items
  const printItems: PrintJobItem[] = input.items && input.items.length > 0
    ? input.items
    : [{
        printType: input.printType || 'bw',
        side: input.side || 'single',
        numPages: input.numPages || 1,
        discount: input.discount || 0
      }];

  // Calculate grand total amount
  const finalAmount = printItems.reduce((acc, item) => {
    return acc + calculatePrintAmount(item.printType, item.side, item.numPages, item.discount || 0).totalAmount;
  }, 0);

  if (isGuestMode()) {
    const demoAccounts = getDemoAccounts();
    const serviceIncomeAccountId = input.revenueAccountId || '40000000-0000-0000-0000-000000000001';
    
    // Construct dynamic description if not explicitly provided
    let defaultDesc = `Print Job`;
    if (printItems.length === 1) {
      defaultDesc = `Print Job (${printItems[0].printType.toUpperCase()}, ${printItems[0].side}, ${printItems[0].numPages} pages)`;
    } else {
      defaultDesc = `Multi-Item Print Job (${printItems.length} items)`;
    }
    const desc = input.description.trim() || defaultDesc;
    
    const results: LedgerEntryResult[] = [];
    let totalPosted = 0;

    let guestCashAccountId = '';
    if (input.paidImmediately) {
      const useIncharge = await resolveUseInchargeCash(input.useInchargeCashAccount);
      guestCashAccountId = useIncharge
        ? '10000000-0000-0000-0000-000000000003'
        : '10000000-0000-0000-0000-000000000001';
    }

    for (const studentId of input.studentIds) {
      const studentARAcc = demoAccounts.find((a) => a.student_id === studentId);
      const targetDebitAccId = input.paidImmediately ? guestCashAccountId : studentARAcc?.id;

      if (targetDebitAccId) {
        const res = postDemoJournalEntry(
          [
            { accountId: targetDebitAccId, debit: finalAmount, credit: 0 },
            { accountId: serviceIncomeAccountId, debit: 0, credit: finalAmount },
          ],
          desc
        );
        if (res.success) {
          totalPosted++;
          results.push({ studentId, success: true, entryId: res.entryId, amount: finalAmount });
        }
      }
    }
    return { success: totalPosted > 0, totalPosted, results };
  }

  const supabase = createClient();
  const results: LedgerEntryResult[] = [];
  let totalPosted = 0;

  if (!input.studentIds || input.studentIds.length === 0) {
    return { success: false, totalPosted: 0, results: [], error: 'No students selected.' };
  }

  if (finalAmount <= 0) {
    return { success: false, totalPosted: 0, results: [], error: 'Calculated transaction amount must be greater than zero.' };
  }

  const serviceIncomeAccountId = input.revenueAccountId || await getServiceIncomeAccountId();

  let cashDebitAccountId = '';
  if (input.paidImmediately) {
    const useIncharge = await resolveUseInchargeCash(input.useInchargeCashAccount);
    cashDebitAccountId = useIncharge
      ? await getCashInHandInchargeAccountId()
      : await getCashAccountId();
  }

  // Fetch accounts for selected students
  const { data: accountsData } = await supabase
    .from('accounts')
    .select('id, student_id, name')
    .in('student_id', input.studentIds);

  const accountMap = new Map<string, string>(); // studentId -> accountId
  (accountsData || []).forEach((acc: any) => {
    if (acc.student_id) accountMap.set(acc.student_id, acc.id);
  });
  
  // Construct dynamic description if not explicitly provided
  let defaultDesc = `Print Job`;
  if (printItems.length === 1) {
    defaultDesc = `Print Job (${printItems[0].printType.toUpperCase()}, ${printItems[0].side}, ${printItems[0].numPages} pages)`;
  } else {
    defaultDesc = `Multi-Item Print Job (${printItems.length} items)`;
  }
  const desc = input.description.trim() || defaultDesc;

  for (const studentId of input.studentIds) {
    const studentARAccountId = accountMap.get(studentId);

    if (!input.paidImmediately && !studentARAccountId) {
      results.push({
        studentId,
        success: false,
        amount: finalAmount,
        error: 'Dedicated Accounts Receivable account not found.',
      });
      continue;
    }

    const debitAccountId = input.paidImmediately ? cashDebitAccountId : studentARAccountId!;

    // 1. Post Journal Entry: Student AR or Cash (Dr) / Service Income (Cr)
    const journalRes = await postJournalEntry(
      [
        { accountId: debitAccountId, debit: finalAmount, credit: 0 },
        { accountId: serviceIncomeAccountId, debit: 0, credit: finalAmount },
      ],
      desc
    );

    if (!journalRes.success || !journalRes.entryId) {
      results.push({
        studentId,
        success: false,
        amount: finalAmount,
        error: journalRes.error || 'Failed to post journal entry.',
      });
      continue;
    }

    // 2. Insert linked Print Job records (one per item)
    for (const item of printItems) {
      const itemAmount = calculatePrintAmount(item.printType, item.side, item.numPages, item.discount || 0).totalAmount;
      const { error: printJobError } = await (supabase.from('print_jobs' as any) as any).insert({
        journal_entry_id: journalRes.entryId,
        student_id: studentId,
        print_type: item.printType,
        side: item.side,
        num_pages: item.numPages,
        description: desc, // Shared description for all items of this job
        discount: item.discount || 0,
        amount: itemAmount,
      });

      if (printJobError) {
        console.warn('Print job record warning:', printJobError.message);
      }
    }

    totalPosted++;
    results.push({
      studentId,
      success: true,
      entryId: journalRes.entryId,
      amount: finalAmount,
    });
  }

  return {
    success: totalPosted > 0,
    totalPosted,
    results,
  };
}

/**
 * Posts CREDIT journal entries for payment received from students.
 * Cash Account (Dr) / Student Account (Cr)
 * Generates separate balanced entries for each selected student.
 */
export async function postCreditEntries(input: PostCreditInput): Promise<{
  success: boolean;
  totalPosted: number;
  results: LedgerEntryResult[];
  error?: string;
}> {
  if (isGuestMode()) {
    const useIncharge = await resolveUseInchargeCash(input.useInchargeCashAccount);
    const cashAccountId = useIncharge
      ? '10000000-0000-0000-0000-000000000003'
      : '10000000-0000-0000-0000-000000000001';
    const demoAccounts = getDemoAccounts();
    const desc = input.description.trim() || 'Student Cash Credit Payment';
    const results: LedgerEntryResult[] = [];
    let totalPosted = 0;

    for (const studentId of input.studentIds) {
      const studentARAcc = demoAccounts.find((a) => a.student_id === studentId);
      if (studentARAcc) {
        const res = postDemoJournalEntry(
          [
            { accountId: cashAccountId, debit: input.amount, credit: 0 },
            { accountId: studentARAcc.id, debit: 0, credit: input.amount },
          ],
          desc
        );
        if (res.success) {
          totalPosted++;
          results.push({ studentId, success: true, entryId: res.entryId, amount: input.amount });
        }
      }
    }
    return { success: totalPosted > 0, totalPosted, results };
  }

  const supabase = createClient();
  const results: LedgerEntryResult[] = [];
  let totalPosted = 0;

  if (!input.studentIds || input.studentIds.length === 0) {
    return { success: false, totalPosted: 0, results: [], error: 'No students selected.' };
  }

  if (input.amount <= 0) {
    return { success: false, totalPosted: 0, results: [], error: 'Payment credit amount must be greater than zero.' };
  }

  const useIncharge = await resolveUseInchargeCash(input.useInchargeCashAccount);
  const cashAccountId = useIncharge
    ? await getCashInHandInchargeAccountId()
    : await getCashAccountId();

  // Fetch accounts for selected students
  const { data: accountsData } = await supabase
    .from('accounts')
    .select('id, student_id')
    .in('student_id', input.studentIds);

  const accountMap = new Map<string, string>();
  (accountsData || []).forEach((acc: any) => {
    if (acc.student_id) accountMap.set(acc.student_id, acc.id);
  });

  for (const studentId of input.studentIds) {
    const studentARAccountId = accountMap.get(studentId);

    if (!studentARAccountId) {
      results.push({
        studentId,
        success: false,
        amount: input.amount,
        error: 'Dedicated Accounts Receivable account not found.',
      });
      continue;
    }

    const desc = input.description.trim() || 'Student Cash Credit Payment';

    // Post Journal Entry: Cash Account (Dr) / Student AR (Cr)
    const journalRes = await postJournalEntry(
      [
        { accountId: cashAccountId, debit: input.amount, credit: 0 },
        { accountId: studentARAccountId, debit: 0, credit: input.amount },
      ],
      desc
    );

    if (!journalRes.success || !journalRes.entryId) {
      results.push({
        studentId,
        success: false,
        amount: input.amount,
        error: journalRes.error || 'Failed to post credit entry.',
      });
      continue;
    }

    totalPosted++;
    results.push({
      studentId,
      success: true,
      entryId: journalRes.entryId,
      amount: input.amount,
    });
  }

  return {
    success: totalPosted > 0,
    totalPosted,
    results,
  };
}

/**
 * Generates pre-filled WhatsApp reminder link for a student with balance due.
 */
export function generateWhatsAppLink(phone: string, name: string, balance: number): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const portalLink = origin ? `\n\nView your account statement: ${origin}/student` : '';
  const message = `Hello ${name},\n\nThis is a friendly reminder from the Aman Lab Printing Service. Your current outstanding account balance is ₹${balance.toFixed(2)}. Please arrange for settlement at your earliest convenience.${portalLink}\n\nThank you!`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Fetches page count totals from print_jobs table (B/W vs Color).
 * Excludes print jobs linked to voided journal entries.
 */
export async function getPrintPageCounts(): Promise<{ bwPages: number; colorPages: number }> {
  if (isGuestMode()) {
    return { bwPages: 145, colorPages: 32 };
  }

  const supabase = createClient();
  let { data, error } = await supabase
    .from('print_jobs')
    .select('print_type, num_pages, journal_entries!inner(voided_at)')
    .is('journal_entries.voided_at', null);

  if (error) {
    const fallback = await supabase.from('print_jobs').select('print_type, num_pages');
    data = fallback.data as typeof data;
  }

  let bwPages = 0;
  let colorPages = 0;

  (data || []).forEach((pj: any) => {
    const pages = Number(pj.num_pages) || 0;
    if (pj.print_type === 'bw') bwPages += pages;
    else if (pj.print_type === 'color') colorPages += pages;
  });

  return { bwPages, colorPages };
}
