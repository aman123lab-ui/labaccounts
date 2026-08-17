import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data: entries } = await supabase.from('journal_entries').select('id, date, description, voided_at');
    const { data: fys } = await supabase.from('financial_years').select('*');
    return NextResponse.json({ entries, fys });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
