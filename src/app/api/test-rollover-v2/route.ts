import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculatePeriodFinancialSummary } from '@/services/accountingService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Fetch current FY
    const { data: fys } = await supabase
      .from('financial_years')
      .select('*')
      .eq('is_current', true)
      .limit(1);

    if (!fys || fys.length === 0) {
      return NextResponse.json({ error: 'No active financial year found' });
    }

    const currentFY = (fys as any[])[0];

    // 2. Fetch accounts
    const { data: accountsData } = await supabase.from('accounts').select('id, name, type');
    let serviceIncomeAccId = '40000000-0000-0000-0000-000000000001';
    let expenseAccId = '50000000-0000-0000-0000-000000000001';
    let equityAccId = '30000000-0000-0000-0000-000000000001';

    ((accountsData as any[]) || []).forEach((acc) => {
      if (acc.type === 'revenue') serviceIncomeAccId = acc.id;
      if (acc.type === 'expense') expenseAccId = acc.id;
      if (acc.type === 'equity') equityAccId = acc.id;
    });

    const summary = await calculatePeriodFinancialSummary(currentFY.start_date, currentFY.end_date, supabase);
    const netSurplus = Number(summary.netSurplus.toFixed(2));

    const linesToInsert: Array<{ account_id: string; debit_amount: number; credit_amount: number }> = [];
    if (netSurplus > 0) {
      linesToInsert.push({ account_id: serviceIncomeAccId, debit_amount: netSurplus, credit_amount: 0 });
      linesToInsert.push({ account_id: equityAccId, debit_amount: 0, credit_amount: netSurplus });
    } else {
      const deficit = Number(Math.abs(netSurplus).toFixed(2));
      linesToInsert.push({ account_id: equityAccId, debit_amount: deficit, credit_amount: 0 });
      linesToInsert.push({ account_id: expenseAccId, debit_amount: 0, credit_amount: deficit });
    }

    const closingDesc = `TEST ROLLOVER CLOSING ENTRY FOR ${currentFY.name}`;
    const closingDate = `${currentFY.end_date}T23:59:59.000Z`;

    const { data: newEntry, error: postHeaderErr } = await ((supabase
      .from('journal_entries') as any)
      .insert({
        date: closingDate,
        description: closingDesc,
        financial_year_id: currentFY.id,
        created_by: null,
        is_closing_entry: true,
      })
      .select('id')
      .single() as Promise<{ data: any; error: any }>);

    if (postHeaderErr || !newEntry) {
      return NextResponse.json({ success: false, error: postHeaderErr?.message });
    }

    const closingEntryId = newEntry.id;

    const lineRows = linesToInsert.map((l) => ({
      journal_entry_id: closingEntryId,
      account_id: l.account_id,
      debit_amount: l.debit_amount,
      credit_amount: l.credit_amount,
    }));

    const { error: postLinesErr } = await ((supabase
      .from('journal_entry_lines') as any)
      .insert(lineRows) as Promise<{ error: any }>);

    if (postLinesErr) {
      await (supabase.from('journal_entries') as any).delete().eq('id', closingEntryId);
      return NextResponse.json({ success: false, error: postLinesErr.message });
    }

    // Clean up test entry
    await (supabase.from('journal_entry_lines') as any).delete().eq('journal_entry_id', closingEntryId);
    await (supabase.from('journal_entries') as any).delete().eq('id', closingEntryId);

    return NextResponse.json({
      success: true,
      message: 'Rollover closing entry posted and cleaned up successfully with ZERO errors!',
      testedFY: currentFY.name,
      netSurplus,
      postedEntryId: closingEntryId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
