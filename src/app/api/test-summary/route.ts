import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const startDate = '2026-01-01T00:00:00.000Z';
    const endDate = '2026-12-31T23:59:59.999Z';

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

    const operationalEntries = (entries || []).filter((e: any) => {
      if (e.is_closing_entry === true) return false;
      const desc = (e.description || '').toLowerCase();
      return !desc.includes('closing entry');
    });

    const entryIds = operationalEntries.map((e: any) => e.id);

    const { data: lines, error: linesError } = await supabase
      .from('journal_entry_lines')
      .select('debit_amount, credit_amount, accounts(id, name, type, is_student_account)')
      .in('journal_entry_id', entryIds);

    let totalExpenses = 0;
    let totalRevenue = 0;
    const revenueDetails: Record<string, number> = {};
    const expenseDetails: Record<string, number> = {};

    (lines || []).forEach((l: any) => {
      const debit = Number(l.debit_amount || 0);
      const credit = Number(l.credit_amount || 0);
      const acc = l.accounts;
      if (!acc) return;

      if (acc.type === 'expense') {
        const net = debit - credit;
        totalExpenses += net;
        expenseDetails[acc.name] = (expenseDetails[acc.name] || 0) + net;
      }

      if (acc.type === 'revenue') {
        const net = credit - debit;
        totalRevenue += net;
        revenueDetails[acc.name] = (revenueDetails[acc.name] || 0) + net;
      }
    });

    const netSurplus = totalRevenue - totalExpenses;

    return NextResponse.json({
      startDate,
      endDate,
      totalEntries: entries?.length || 0,
      operationalEntriesCount: operationalEntries.length,
      totalRevenue,
      totalExpenses,
      netSurplus,
      revenueDetails,
      expenseDetails,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
