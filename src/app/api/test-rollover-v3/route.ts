import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: accountsData } = await supabase.from('accounts').select('id, name, type');
    const revenueAcc = (accountsData as any[])?.find((a) => a.type === 'revenue');
    const equityAcc = (accountsData as any[])?.find((a) => a.type === 'equity');

    return NextResponse.json({
      revenueAcc,
      equityAcc,
      allAccounts: accountsData,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
