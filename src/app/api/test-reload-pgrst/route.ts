// @ts-nocheck
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createAdminClient();

  // Try calling reload_pgrst schema or RPC if available
  const res1 = await supabase.rpc('reload_pgrst_schema' as any);
  const res2 = await supabase.rpc('exec_sql' as any, { query: "NOTIFY pgrst, 'reload schema';" });

  return NextResponse.json({
    res1,
    res2,
  });
}
