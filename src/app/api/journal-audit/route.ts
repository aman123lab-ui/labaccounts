import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabase = createAdminClient();

  try {
    const { data: entries } = await supabase
      .from('journal_entries')
      .select('id, date, description, voided_at, created_at')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      entriesCount: entries?.length || 0,
      entries,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
