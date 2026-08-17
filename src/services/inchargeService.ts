import { createClient } from '@/lib/supabase/client';
import { isGuestMode, getDemoJournalEntries, getDemoAccounts } from '@/lib/demo/demoStore';

export interface InchargeCashCollectionItem {
  id: string;
  date: string;
  description: string;
  studentName?: string;
  amount: number; // Cash received (debit to cash account)
}

export interface InchargeCashSummary {
  totalCashOnHand: number;
  totalTransactionsCount: number;
  collections: InchargeCashCollectionItem[];
}

/**
 * Calculates and aggregates cash collected exclusively by the given In-charge user.
 * Sums cash debit amounts from non-voided journal entries created by this specific user.
 */
export async function getInchargeCashSummary(userId?: string): Promise<InchargeCashSummary> {
  if (isGuestMode()) {
    const entries = getDemoJournalEntries();
    const demoAccounts = getDemoAccounts();
    const inchargeCashAccountId = '10000000-0000-0000-0000-000000000003';

    let totalCashOnHand = 0;
    const collections: InchargeCashCollectionItem[] = [];

    entries.forEach((e) => {
      if (e.voided_at) return;

      // 1. Calculate net Cash in Hand (In-Charge) balance: Sum(Debits) - Sum(Credits)
      e.lines.forEach((l) => {
        if (l.account_id === inchargeCashAccountId) {
          totalCashOnHand += (Number(l.debit_amount) || 0) - (Number(l.credit_amount) || 0);
        }
      });

      // 2. Identify genuine student cash collections:
      // Cash in Hand (In-Charge) must be DEBITED, and a student account credited
      const inchargeDebitLine = e.lines.find(
        (l) => l.account_id === inchargeCashAccountId && l.debit_amount > 0
      );

      if (inchargeDebitLine) {
        const studentLine = e.lines.find(
          (l) => l.account_id !== inchargeCashAccountId && l.credit_amount > 0
        );
        let studentName = 'Student';
        if (studentLine) {
          const acc = demoAccounts.find((a) => a.id === studentLine.account_id);
          if (acc) studentName = acc.name.replace(' - Accounts Receivable', '');
        }

        collections.push({
          id: e.id,
          date: e.date,
          description: e.description,
          studentName,
          amount: inchargeDebitLine.debit_amount,
        });
      }
    });

    return {
      totalCashOnHand: Math.max(0, totalCashOnHand),
      totalTransactionsCount: collections.length,
      collections: collections.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    };
  }

  const supabase = createClient();

  // If userId is not provided, get the logged in user's ID
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: authUser } = await supabase.auth.getUser();
    activeUserId = authUser.user?.id;
  }

  if (!activeUserId) {
    return { totalCashOnHand: 0, totalTransactionsCount: 0, collections: [] };
  }

  try {
    // 1. Fetch Cash in Hand (In-Charge) account ID
    const { data: inchargeAccount } = await (supabase.from('accounts') as any)
      .select('id')
      .eq('type', 'asset')
      .ilike('name', '%Cash in Hand (In-Charge)%')
      .limit(1)
      .maybeSingle();

    const inchargeCashAccountId = inchargeAccount?.id || '10000000-0000-0000-0000-000000000003';

    // 2. Fetch all journal entries that touch Cash in Hand (In-Charge) account
    const { data: entries, error } = await (supabase.from('journal_entries') as any)
      .select(`
        id,
        date,
        description,
        created_by,
        voided_at,
        journal_entry_lines (
          id,
          account_id,
          debit_amount,
          credit_amount,
          accounts (
            id,
            name,
            is_student_account,
            student_id
          )
        )
      `)
      .is('voided_at', null)
      .order('date', { ascending: false });

    if (error || !entries) {
      console.error('Error fetching In-charge cash summary entries:', error);
      return { totalCashOnHand: 0, totalTransactionsCount: 0, collections: [] };
    }

    let totalCashOnHand = 0;
    const collections: InchargeCashCollectionItem[] = [];

    entries.forEach((entry: any) => {
      const lines = entry.journal_entry_lines || [];

      // 1. Accumulate Net Balance for Cash in Hand (In-Charge): Debits - Credits
      lines.forEach((l: any) => {
        if (l.account_id === inchargeCashAccountId) {
          totalCashOnHand += (Number(l.debit_amount) || 0) - (Number(l.credit_amount) || 0);
        }
      });

      // 2. Identify Student Collections: Entries where In-Charge Cash is DEBITED
      const cashDebitLine = lines.find(
        (l: any) => l.account_id === inchargeCashAccountId && Number(l.debit_amount) > 0
      );

      if (cashDebitLine && (entry.created_by === activeUserId || !entry.created_by)) {
        const cashAmount = Number(cashDebitLine.debit_amount) || 0;

        // Find matching student AR account line
        const studentLine = lines.find(
          (l: any) => l.account_id !== inchargeCashAccountId && Number(l.credit_amount) > 0
        );
        let studentName = 'Student Payment';
        if (studentLine?.accounts?.name) {
          studentName = studentLine.accounts.name.replace(' - Accounts Receivable', '');
        }

        collections.push({
          id: entry.id,
          date: entry.date,
          description: entry.description,
          studentName,
          amount: cashAmount,
        });
      }
    });

    return {
      totalCashOnHand: Math.max(0, totalCashOnHand),
      totalTransactionsCount: collections.length,
      collections,
    };
  } catch (err) {
    console.error('Failed to get incharge cash summary:', err);
    return { totalCashOnHand: 0, totalTransactionsCount: 0, collections: [] };
  }
}
