import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Fetch accounts
    const { data: accounts } = await supabase.from('accounts').select('id, name, type');
    const incomeAcc = (accounts as any[])?.find((a) => a.type === 'revenue');
    const equityAcc = (accounts as any[])?.find((a) => a.type === 'equity');

    if (!incomeAcc || !equityAcc) {
      return NextResponse.json({ error: 'Accounts missing' });
    }

    const testLines = [
      { account_id: incomeAcc.id, debit_amount: 10, credit_amount: 0 },
      { account_id: equityAcc.id, debit_amount: 0, credit_amount: 10 },
    ];

    // Direct JS insert with fallback handling
    let insertPayload: any = {
      date: new Date().toISOString(),
      description: 'TEST CLOSING ENTRY DIRECT',
      created_by: 'Test Process',
      is_closing_entry: true,
    };

    let { data: newEntry, error: entryErr } = await ((supabase
      .from('journal_entries') as any)
      .insert(insertPayload)
      .select('id')
      .single() as Promise<{ data: any; error: any }>);

    if (entryErr && entryErr.code === '42703') {
      // If column is_closing_entry is missing, fallback without it
      delete insertPayload.is_closing_entry;
      const res = await ((supabase.from('journal_entries') as any).insert(insertPayload).select('id').single() as Promise<{ data: any; error: any }>);
      newEntry = res.data;
      entryErr = res.error;
    }

    if (entryErr || !newEntry) {
      return NextResponse.json({ directSuccess: false, error: entryErr?.message });
    }

    const linesToInsert = testLines.map((l: any) => ({
      journal_entry_id: newEntry.id,
      account_id: l.account_id,
      debit_amount: l.debit_amount,
      credit_amount: l.credit_amount,
    }));

    const { error: linesErr } = await ((supabase.from('journal_entry_lines') as any).insert(linesToInsert) as Promise<{ error: any }>);

    if (linesErr) {
      // Rollback header if lines fail
      await (supabase.from('journal_entries') as any).delete().eq('id', newEntry.id);
      return NextResponse.json({ directSuccess: false, error: linesErr.message });
    }

    // Clean up test entry
    await (supabase.from('journal_entry_lines') as any).delete().eq('journal_entry_id', newEntry.id);
    await (supabase.from('journal_entries') as any).delete().eq('id', newEntry.id);

    return NextResponse.json({ directSuccess: true, entryId: newEntry.id });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
