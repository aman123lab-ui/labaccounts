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
        { success: false, error: 'Unauthorized. Admin authorization required to create batches.' },
        { status: 403 }
      );
    }

    const { name, category } = await req.json();

    if (!name) {
      return NextResponse.json({ success: false, error: 'Batch name is required.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rpbgtykecsoigvxjjbsm.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createAdminClient(url, key);

    const cleanName = name.trim();
    const cleanCategory = (category || '').trim();

    const { data: insertedRows, error: insertErr } = await supabase
      .from('batches')
      .insert({
        name: cleanName,
        category: cleanCategory,
        sort_order: 0,
      })
      .select();

    if (insertErr) {
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    if (!insertedRows || insertedRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Insert returned 0 rows.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: insertedRows[0] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
