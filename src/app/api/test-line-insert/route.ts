// @ts-nocheck
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Create header
    const { data: entry, error: eErr } = await supabase
      .from('journal_entries')
      .insert({
        description: 'TEST LINE INSERT',
        is_closing_entry: true,
      })
      .select('id')
      .single();

    if (eErr || !entry) {
      return NextResponse.json({ error: eErr?.message });
    }

    const accountId = '40000000-0000-0000-0000-000000000001';

    // Test insert line
    const { data: lineRes, error: lineErr } = await supabase
      .from('journal_entry_lines')
      .insert({
        journal_entry_id: entry.id,
        account_id: accountId,
        debit_amount: 626.00,
        credit_amount: 0.00,
      })
      .select();

    // Cleanup
    await supabase.from('journal_entries').delete().eq('id', entry.id);

    if (lineErr) {
      return NextResponse.json({ success: false, error: lineErr.message, details: lineErr.details });
    }

    return NextResponse.json({ success: true, lineRes });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
