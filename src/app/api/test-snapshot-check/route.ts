import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createAdminClient();

  const { data: fyList } = await supabase.from('financial_years').select('*').limit(1);
  if (!fyList || fyList.length === 0) return NextResponse.json({ error: 'no fy' });

  const fy = (fyList as any[])[0];
  const testSnapshot = [{ student_id: '123', batch_id: '456', status: 'active' }];

  // Test updating rollover_snapshot alone
  const resSnapshot = await (supabase
    .from('financial_years') as any)
    .update({
      rollover_snapshot: testSnapshot as any,
    })
    .eq('id', fy.id);

  // Test updating closing_entry_id alone
  const resClosing = await (supabase
    .from('financial_years') as any)
    .update({
      closing_entry_id: null,
    })
    .eq('id', fy.id);

  // Test updating created_new_fy_id alone
  const resNewFY = await (supabase
    .from('financial_years') as any)
    .update({
      created_new_fy_id: null,
    })
    .eq('id', fy.id);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    resSnapshot: { error: resSnapshot.error?.message, status: resSnapshot.status },
    resClosing: { error: resClosing.error?.message, status: resClosing.status },
    resNewFY: { error: resNewFY.error?.message, status: resNewFY.status },
  });
}
