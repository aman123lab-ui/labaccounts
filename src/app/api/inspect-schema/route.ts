import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabase = createAdminClient();

  try {
    const { data: entries } = await supabase
      .from('journal_entries')
      .select('id, date, description, reference_type, voided_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('id, journal_entry_id, account_id, debit_amount, credit_amount, accounts(name, type)')
      .limit(50);

    return NextResponse.json({
      entries,
      lines,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
