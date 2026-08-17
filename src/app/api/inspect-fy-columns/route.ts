import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createAdminClient();

  const { data: row } = await supabase.from('financial_years').select('*').limit(1);

  return NextResponse.json({
    row: row ? row[0] : null,
    columnKeys: row && row[0] ? Object.keys(row[0]) : []
  });
}
