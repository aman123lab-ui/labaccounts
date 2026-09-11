import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function checkAdminAuth(req: Request): Promise<boolean> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (
      user &&
      (user.user_metadata?.role === 'admin' ||
        user.user_metadata?.role === 'incharge' ||
        user.email?.includes('admin') ||
        user.email?.includes('incharge'))
    ) {
      return true;
    }

    const cookieStore = await cookies();
    const roleCookie = cookieStore.get('lab_user_role')?.value;
    const roleHeader = req.headers.get('x-user-role');
    if (
      roleCookie === 'admin' ||
      roleCookie === 'incharge' ||
      roleHeader === 'admin' ||
      roleHeader === 'incharge'
    ) {
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
        { success: false, error: 'Unauthorized. Admin authorization required to update batches.' },
        { status: 403 }
      );
    }

    const { id, name, category } = await req.json();

    if (!id || !name) {
      return NextResponse.json({ success: false, error: 'Batch id and name are required.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rpbgtykecsoigvxjjbsm.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createAdminClient(url, key);

    const cleanName = name.trim();
    const cleanCategory = (category || '').trim();

    const { data: updatedRows, error: updateErr } = await supabase
      .from('batches')
      .update({
        name: cleanName,
        category: cleanCategory,
      })
      .eq('id', id)
      .select();

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Update returned 0 rows. Batch ID may not exist.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedRows[0] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
