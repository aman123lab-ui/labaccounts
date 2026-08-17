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

    const summary = await calculatePeriodFinancialSummary(currentFY.start_date, currentFY.end_date, supabase);
    const netSurplus = Number(summary.netSurplus.toFixed(2));

    const { data: accounts } = await supabase.from('accounts').select('id, name, type');
    const revenueAcc = (accounts as any[])?.find((a) => a.type === 'revenue');
    const equityAcc = (accounts as any[])?.find((a) => a.type === 'equity');

    // Header
    const { data: newEntry, error: eErr } = await ((supabase
      .from('journal_entries') as any)
      .insert({
        description: `CLOSING ENTRY TEST V5`,
        financial_year_id: currentFY.id,
        is_closing_entry: true,
      })
      .select('id')
      .single() as Promise<{ data: any; error: any }>);

    if (eErr || !newEntry) return NextResponse.json({ error: eErr?.message });

    const l1 = {
      journal_entry_id: newEntry.id,
      account_id: revenueAcc!.id,
      debit_amount: netSurplus,
      credit_amount: 0,
    };

    const l2 = {
      journal_entry_id: newEntry.id,
      account_id: equityAcc!.id,
      debit_amount: 0,
      credit_amount: netSurplus,
    };

    const res1 = await ((supabase.from('journal_entry_lines') as any).insert(l1) as Promise<{ error: any }>);
    const res2 = await ((supabase.from('journal_entry_lines') as any).insert(l2) as Promise<{ error: any }>);

    // Clean up
    await supabase.from('journal_entries').delete().eq('id', newEntry.id);

    return NextResponse.json({
      res1Error: res1.error?.message,
      res2Error: res2.error?.message,
      l1,
      l2,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
