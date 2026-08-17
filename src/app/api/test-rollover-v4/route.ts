import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculatePeriodFinancialSummary } from '@/services/accountingService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Current FY
    const { data: fys } = await supabase
      .from('financial_years')
      .select('*')
      .eq('is_current', true)
      .limit(1);

    if (!fys || fys.length === 0) return NextResponse.json({ error: 'No active FY' });
    const currentFY = (fys as any[])[0];

    // 2. Accounts
    const { data: accounts } = await supabase.from('accounts').select('id, name, type');
    const revenueAcc = (accounts as any[])?.find((a) => a.type === 'revenue');
    const equityAcc = (accounts as any[])?.find((a) => a.type === 'equity');
    const expenseAcc = (accounts as any[])?.find((a) => a.type === 'expense');

    if (!revenueAcc || !equityAcc || !expenseAcc) {
      return NextResponse.json({ error: 'Required accounts not found' });
    }

    const summary = await calculatePeriodFinancialSummary(currentFY.start_date, currentFY.end_date, supabase);
    const netSurplus = Number(summary.netSurplus.toFixed(2));

    const lineRowsToInsert: Array<{ account_id: string; debit_amount: number; credit_amount: number }> = [];
    if (netSurplus > 0) {
      lineRowsToInsert.push({ account_id: revenueAcc.id, debit_amount: netSurplus, credit_amount: 0 });
      lineRowsToInsert.push({ account_id: equityAcc.id, debit_amount: 0, credit_amount: netSurplus });
    } else {
      const deficit = Number(Math.abs(netSurplus).toFixed(2));
      lineRowsToInsert.push({ account_id: equityAcc.id, debit_amount: deficit, credit_amount: 0 });
      lineRowsToInsert.push({ account_id: expenseAcc.id, debit_amount: 0, credit_amount: deficit });
    }

    const closingDesc = `Closing Entry for ${currentFY.name} — Transfer Net ${netSurplus >= 0 ? 'Surplus' : 'Deficit'} to Fund Balance`;
    const closingDate = `${currentFY.end_date}T23:59:59.000Z`;

    // 3. Insert Header
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

    // 4. Insert Lines
    const linesWithEntryId = lineRowsToInsert.map((l) => ({
      journal_entry_id: closingEntryId,
      account_id: l.account_id,
      debit_amount: l.debit_amount,
      credit_amount: l.credit_amount,
    }));

    const { error: postLinesErr } = await ((supabase
      .from('journal_entry_lines') as any)
      .insert(linesWithEntryId) as Promise<{ error: any }>);

    if (postLinesErr) {
      await (supabase.from('journal_entries') as any).delete().eq('id', closingEntryId);
      return NextResponse.json({ success: false, error: postLinesErr.message });
    }

    // Clean up test entry
    await (supabase.from('journal_entry_lines') as any).delete().eq('journal_entry_id', closingEntryId);
    await (supabase.from('journal_entries') as any).delete().eq('id', closingEntryId);

    return NextResponse.json({
      success: true,
      message: 'Full Rollover Closing Entry workflow succeeded with 0 errors!',
      testedFY: currentFY.name,
      netSurplus,
      postedEntryId: closingEntryId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
