import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, email, phone, password, name, studentId } = body;

    const adminSupabase = createAdminClient();

    if (type === 'admin' || type === 'incharge') {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !password) {
        return NextResponse.json({ success: false, error: 'Email and password required.' }, { status: 400 });
      }

      // Check existing auth users
      const { data: userListData, error: listError } = await adminSupabase.auth.admin.listUsers();
      if (listError) {
        console.error('Error listing auth users:', listError);
      }

      const existingUser = userListData?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      );

      const targetRole = type === 'incharge' ? 'incharge' : 'admin';

      if (existingUser) {
        const { error: updateError } = await adminSupabase.auth.admin.updateUserById(existingUser.id, {
          password,
          user_metadata: { role: targetRole },
        });

        if (updateError) {
          return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }
      } else {
        const { error: createError } = await adminSupabase.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: { role: targetRole },
        });

        if (createError) {
          return NextResponse.json({ success: false, error: createError.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true });
    }

    if (type === 'student') {
      const cleanPhone = (phone || '').trim().replace(/\D/g, '');
      const studentEmail = `${cleanPhone}@student.lab`;

      if (!cleanPhone || !password) {
        return NextResponse.json({ success: false, error: 'Phone and password required.' }, { status: 400 });
      }

      const { data: userListData, error: listError } = await adminSupabase.auth.admin.listUsers();
      if (listError) {
        console.error('Error listing auth users:', listError);
      }

      const existingUser = userListData?.users?.find(
        (u) => u.email?.toLowerCase() === studentEmail
      );

      if (existingUser) {
        const { error: updateError } = await adminSupabase.auth.admin.updateUserById(existingUser.id, {
          password,
          user_metadata: {
            role: 'student',
            phone: cleanPhone,
            name: name || '',
            student_id: studentId || '',
          },
        });

        if (updateError) {
          return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }
      } else {
        const { error: createError } = await adminSupabase.auth.admin.createUser({
          email: studentEmail,
          password,
          email_confirm: true,
          user_metadata: {
            role: 'student',
            phone: cleanPhone,
            name: name || '',
            student_id: studentId || '',
          },
        });

        if (createError) {
          return NextResponse.json({ success: false, error: createError.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid sync type.' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Auth sync route failed.';
    console.error('Auth sync route error:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
