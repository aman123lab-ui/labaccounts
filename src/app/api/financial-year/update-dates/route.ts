import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { fyId, startDate, endDate, name } = await req.json();

    if (!fyId || !startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'fyId, startDate, and endDate are required.' }, { status: 400 });
    }

    if (new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json({ success: false, error: 'End Date must be strictly after Start Date.' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const updatePayload: Record<string, any> = {
      start_date: startDate,
      end_date: endDate,
    };
    if (name && name.trim()) {
      updatePayload.name = name.trim();
    }

    const { error } = await ((supabase
      .from('financial_years') as any)
      .update(updatePayload)
      .eq('id', fyId) as Promise<{ error: any }>);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
