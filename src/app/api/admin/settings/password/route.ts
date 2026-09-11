// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { role, newPassword, targetId, email, phone } = body;

    if (!role || !['admin', 'worker', 'student'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Valid target role (admin, worker, student) is required.' }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ success: false, error: 'New password must be at least 6 characters long.' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // 1. ADMIN PASSWORD CHANGE
    if (role === 'admin') {
      const { data: userListData } = await adminSupabase.auth.admin.listUsers();
      const adminUser = userListData?.users?.find(
        (u) => u.user_metadata?.role === 'admin' || u.email?.toLowerCase().includes('admin')
      ) || userListData?.users?.[0];

      if (!adminUser) {
        return NextResponse.json({ success: false, error: 'Admin account not found in auth system.' }, { status: 404 });
      }

      const { error: updateErr } = await adminSupabase.auth.admin.updateUserById(adminUser.id, {
        password: newPassword,
      });

      if (updateErr) {
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Admin password updated successfully.' });
    }

    // 2. WORKER / WORKFORCE PASSWORD CHANGE
    if (role === 'worker') {
      if (!targetId && !email) {
        return NextResponse.json({ success: false, error: 'Worker target ID or email is required.' }, { status: 400 });
      }

      let authUserId = targetId;
      if (!authUserId && email) {
        const { data: userListData } = await adminSupabase.auth.admin.listUsers();
        const found = userListData?.users?.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
        if (found) authUserId = found.id;
      }

      if (authUserId) {
        const { error: updateErr } = await adminSupabase.auth.admin.updateUserById(authUserId, {
          password: newPassword,
        });
        if (updateErr) {
          return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, message: 'Worker password updated successfully.' });
    }

    // 3. STUDENT PASSWORD CHANGE
    if (role === 'student') {
      if (!targetId && !phone && !email) {
        return NextResponse.json({ success: false, error: 'Student ID, phone, or email is required.' }, { status: 400 });
      }

      // Update password in `students` database table
      const studentQuery = adminSupabase.from('students' as any);
      if (targetId) {
        await studentQuery.update({ password_hash: newPassword }).eq('id', targetId);
      } else if (phone) {
        const cleanPhone = phone.replace(/\D/g, '');
        await studentQuery.update({ password_hash: newPassword }).eq('phone', cleanPhone);
      }

      // Also update Auth user password if exists
      const { data: userListData } = await adminSupabase.auth.admin.listUsers();
      const studentAuthUser = userListData?.users?.find(
        (u) =>
          (targetId && u.user_metadata?.studentId === targetId) ||
          (phone && u.email?.includes(phone.replace(/\D/g, ''))) ||
          (email && u.email?.toLowerCase() === email.toLowerCase())
      );

      if (studentAuthUser) {
        try {
          await adminSupabase.auth.admin.updateUserById(studentAuthUser.id, {
            password: newPassword,
          });
        } catch (authErr) {
          console.warn('Student auth password update warning:', authErr);
        }
      }

      return NextResponse.json({ success: true, message: 'Student password updated successfully.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update password.';
    console.error('API POST /api/admin/settings/password error:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
