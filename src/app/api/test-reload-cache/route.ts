import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rpbgtykecsoigvxjjbsm.supabase.co';

  // Attempt PostgREST schema reload endpoints
  const resReload = await fetch(`${url}/rest/v1/`, {
    method: 'GET',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'schema-cache-reload'
    }
  });

  const supabase = createAdminClient();
  const testSnapshot = [{ student_id: 'test-123', batch_id: 'test-456', status: 'active' }];

  const updateRes = await supabase
    .from('financial_years')
    .update({
      rollover_snapshot: testSnapshot as any
    })
    .eq('id', '11111111-1111-1111-1111-111111111111');

  return NextResponse.json({
    reloadStatus: resReload.status,
    updateRes: {
      error: updateRes.error?.message,
      code: updateRes.error?.code,
      status: updateRes.status
    }
  });
}
