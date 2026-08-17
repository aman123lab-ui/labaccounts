import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const todayStr = '2026-08-09';
    const startDate = `${todayStr}T00:00:00.000Z`;
    const endDate = `${todayStr}T23:59:59.999Z`;

    // 1. Fetch ALL entries today (including voided_at null or not, so we can see everything)
    const { data: entries, error: entriesErr } = await supabase
      .from('journal_entries')
      .select('id, date, description, created_at, voided_at, journal_entry_lines(id, debit_amount, credit_amount, accounts(id, name, type, is_student_account))')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (entriesErr) {
      return NextResponse.json({ error: entriesErr.message }, { status: 500 });
    }

    return NextResponse.json({
      startDate,
      endDate,
      count: entries?.length || 0,
      entries,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
