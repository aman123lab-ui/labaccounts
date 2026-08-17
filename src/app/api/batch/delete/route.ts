import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function checkAdminAuth(req: Request): Promise<boolean> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && (user.user_metadata?.role === 'admin' || user.email?.includes('admin'))) {
      return true;
    }

    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('lab_user_role')?.value;
    const roleHeader = req.headers.get('x-user-role');
    if (roleCookie === 'admin' || roleHeader === 'admin') {
      return true;
    }
  } catch (e) {
    console.warn('Auth verification check exception:', e);
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const isAdmin = await checkAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin authorization required to delete batches.' },
        { status: 403 }
      );
    }

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'Batch id is required.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rpbgtykecsoigvxjjbsm.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createAdminClient(url, key);

    // Check assigned active students count before deletion
    const { data: students, error: countErr } = await supabase
      .from('students')
      .select('id, status')
      .eq('batch_id', id);

    if (countErr) {
      return NextResponse.json({ success: false, error: countErr.message }, { status: 500 });
    }

    const totalCount = (students || []).length;
    if (totalCount > 0) {
      const activeCount = (students || []).filter((s) => s.status === 'active').length;
      const archivedCount = totalCount - activeCount;
      let msg = 'Cannot delete batch — ';
      if (activeCount > 0 && archivedCount > 0) {
        msg += `${activeCount} active and ${archivedCount} archived student(s) are assigned to it.`;
      } else if (activeCount > 0) {
        msg += `${activeCount} active student(s) are assigned to it.`;
      } else {
        msg += `${archivedCount} archived student(s) are linked to it.`;
      }
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const { error: deleteErr } = await supabase.from('batches').delete().eq('id', id);

    if (deleteErr) {
      return NextResponse.json({ success: false, error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
