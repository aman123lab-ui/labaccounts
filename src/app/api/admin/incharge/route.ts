import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface InchargeStaffItem {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  staff_id?: string;
  status: 'active' | 'archived';
  created_at: string;
  cash_in_hand: number;
}

function generateUniqueStaffId(existingIds: Set<string>): string {
  let attempts = 0;
  while (attempts < 10000) {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    if (!existingIds.has(code)) {
      return code;
    }
    attempts++;
  }
  return '1001';
}

export async function GET(req: NextRequest) {
  try {
    const adminSupabase = createAdminClient();

    // 1. Fetch In-Charge Cash account ID
    const { data: inchargeAcc } = await (adminSupabase.from('accounts') as any)
      .select('id')
      .eq('type', 'asset')
      .ilike('name', '%Cash in Hand (In-Charge)%')
      .limit(1)
      .maybeSingle();

    const inchargeCashAccountId = inchargeAcc?.id || '10000000-0000-0000-0000-000000000003';

    // 2. Fetch all journal entries on Cash in Hand (In-Charge)
    const { data: entries } = await (adminSupabase.from('journal_entries') as any)
      .select(`
        id,
        created_by,
        description,
        voided_at,
        journal_entry_lines (
          account_id,
          debit_amount,
          credit_amount
        )
      `)
      .is('voided_at', null);

    // Fetch verified handover claims
    const { data: handoverClaims } = await (adminSupabase.from('cash_handover_claims') as any)
      .select('*')
      .eq('status', 'verified');

    // 3. Fetch in-charge staff profiles
    const { data: profiles } = await (adminSupabase.from('incharge_profiles') as any)
      .select('*')
      .order('created_at', { ascending: false });

    // Also fetch auth users list for fallback
    const { data: userListData } = await adminSupabase.auth.admin.listUsers();
    const authUsers = userListData?.users || [];

    const existingStaffIds = new Set<string>();
    (profiles || []).forEach((p: any) => {
      if (p.staff_id) existingStaffIds.add(p.staff_id);
    });

    const staffMap = new Map<string, InchargeStaffItem>();

    // Seed from profiles table & ensure 4-digit staff_id
    if (profiles && profiles.length > 0) {
      for (const p of profiles as any[]) {
        let staffId = p.staff_id;
        if (!staffId) {
          staffId = generateUniqueStaffId(existingStaffIds);
          existingStaffIds.add(staffId);
          // Persist generated staff_id to DB
          await (adminSupabase.from('incharge_profiles') as any)
            .update({ staff_id: staffId })
            .eq('id', p.id);
        }

        const key = p.user_id || p.email.toLowerCase();
        staffMap.set(key, {
          id: p.id,
          user_id: p.user_id || p.id,
          name: p.name || 'Staff In-Charge',
          email: p.email,
          staff_id: staffId,
          status: p.status || 'active',
          created_at: p.created_at,
          cash_in_hand: 0,
        });
      }
    }

    // Seed from auth users list if role is incharge
    authUsers.forEach((u) => {
      const isInc = u.user_metadata?.role === 'incharge' || u.email?.toLowerCase().includes('incharge');
      if (isInc && u.email) {
        const key = u.id;
        if (!staffMap.has(key) && !staffMap.has(u.email.toLowerCase())) {
          let staffId = u.user_metadata?.staff_id;
          if (!staffId) {
            staffId = generateUniqueStaffId(existingStaffIds);
            existingStaffIds.add(staffId);
          }
          staffMap.set(key, {
            id: u.id,
            user_id: u.id,
            name: u.user_metadata?.full_name || u.user_metadata?.name || 'Staff In-Charge',
            email: u.email,
            staff_id: staffId,
            status: 'active',
            created_at: u.created_at,
            cash_in_hand: 0,
          });
        }
      }
    });

    // If no staff found at all, create a default entry for display
    if (staffMap.size === 0) {
      staffMap.set('default-incharge', {
        id: 'default-incharge',
        user_id: undefined,
        name: 'Staff In-Charge',
        email: 'incharge@lab.com',
        staff_id: '4821',
        status: 'active',
        created_at: new Date().toISOString(),
        cash_in_hand: 0,
      });
    }

    // 4. Calculate cash-in-hand per staff member
    const staffList = Array.from(staffMap.values());

    // Calculate debits created by staff & credits for handovers
    staffList.forEach((staff) => {
      let debits = 0;
      let credits = 0;

      // Match debits created by staff
      if (entries) {
        entries.forEach((e: any) => {
          const lines = e.journal_entry_lines || [];
          const inchargeLine = lines.find((l: any) => l.account_id === inchargeCashAccountId);
          if (!inchargeLine) return;

          const isCreatedByStaff =
            (staff.user_id && e.created_by === staff.user_id) ||
            e.description.toLowerCase().includes(staff.name.toLowerCase()) ||
            (staffList.length === 1); // If single staff, attribute all counter collections to them

          if (isCreatedByStaff) {
            debits += Number(inchargeLine.debit_amount || 0);
          }
        });
      }

      // Match credits from verified handovers by staff
      if (handoverClaims) {
        handoverClaims.forEach((claim: any) => {
          const isStaffClaim =
            (staff.user_id && claim.incharge_id === staff.user_id) ||
            claim.incharge_name?.toLowerCase() === staff.name.toLowerCase() ||
            (staffList.length === 1);

          if (isStaffClaim) {
            credits += Number(claim.claimed_amount || 0);
          }
        });
      }

      staff.cash_in_hand = Math.max(0, debits - credits);
    });

    const totalCashInHandAcrossAllStaff = staffList.reduce((sum, s) => sum + s.cash_in_hand, 0);

    return NextResponse.json({
      success: true,
      staffList,
      totalCashInHandAcrossAllStaff,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch in-charge staff list.';
    console.error('API GET /api/admin/incharge error:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanName) {
      return NextResponse.json({ success: false, error: 'Full name is required.' }, { status: 400 });
    }
    if (!cleanEmail) {
      return NextResponse.json({ success: false, error: 'Email address is required.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // Fetch existing staff_ids to avoid collisions
    const { data: existingProfiles } = await (adminSupabase.from('incharge_profiles') as any).select('staff_id');
    const existingStaffIds = new Set<string>();
    (existingProfiles || []).forEach((p: any) => {
      if (p.staff_id) existingStaffIds.add(p.staff_id);
    });

    const staffId = generateUniqueStaffId(existingStaffIds);

    let authUserId: string;

    if (existingUser) {
      const { error: updateErr } = await adminSupabase.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: { role: 'incharge', full_name: cleanName, staff_id: staffId },
      });
      if (updateErr) {
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
      }
      authUserId = existingUser.id;
    } else {
      const { data: createData, error: createErr } = await adminSupabase.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { role: 'incharge', full_name: cleanName, staff_id: staffId },
      });
      if (createErr || !createData.user) {
        return NextResponse.json({ success: false, error: createErr?.message || 'Failed to create auth user.' }, { status: 500 });
      }
      authUserId = createData.user.id;
    }

    // Insert or update profile row in incharge_profiles table
    try {
      await (adminSupabase.from('incharge_profiles') as any).upsert(
        {
          user_id: authUserId,
          name: cleanName,
          email: cleanEmail,
          staff_id: staffId,
          status: 'active',
        },
        { onConflict: 'email' }
      );
    } catch (pErr) {
      console.warn('incharge_profiles upsert warning:', pErr);
    }

    return NextResponse.json({
      success: true,
      staff: {
        id: authUserId,
        user_id: authUserId,
        name: cleanName,
        email: cleanEmail,
        staff_id: staffId,
        status: 'active',
        created_at: new Date().toISOString(),
        cash_in_hand: 0,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create in-charge staff account.';
    console.error('API POST /api/admin/incharge error:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email, action, newPassword, name, status } = body;

    if (!userId && !email) {
      return NextResponse.json({ success: false, error: 'User ID or email is required.' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    if (action === 'reset_password') {
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ success: false, error: 'Password must be at least 6 characters long.' }, { status: 400 });
      }

      if (userId) {
        const { error } = await adminSupabase.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      } else if (email) {
        const { data: userListData } = await adminSupabase.auth.admin.listUsers();
        const user = userListData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (user) {
          const { error } = await adminSupabase.auth.admin.updateUserById(user.id, { password: newPassword });
          if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
      }
      return NextResponse.json({ success: true, message: 'Password updated successfully.' });
    }

    if (action === 'update_profile') {
      const cleanName = name ? name.trim() : undefined;

      if (userId) {
        await (adminSupabase.from('incharge_profiles') as any)
          .update({
            ...(cleanName ? { name: cleanName } : {}),
            ...(status ? { status } : {}),
          })
          .or(`user_id.eq.${userId},id.eq.${userId}`);
      }

      if (email) {
        await (adminSupabase.from('incharge_profiles') as any)
          .update({
            ...(cleanName ? { name: cleanName } : {}),
            ...(status ? { status } : {}),
          })
          .eq('email', email.trim().toLowerCase());
      }

      let targetAuthUserId = userId;
      if (!targetAuthUserId && email) {
        const { data: userListData } = await adminSupabase.auth.admin.listUsers();
        const foundUser = userListData?.users?.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
        if (foundUser) targetAuthUserId = foundUser.id;
      }

      if (targetAuthUserId && cleanName) {
        try {
          await adminSupabase.auth.admin.updateUserById(targetAuthUserId, {
            user_metadata: { full_name: cleanName },
          });
        } catch (authErr) {
          console.warn('Auth user metadata update warning:', authErr);
        }
      }

      return NextResponse.json({ success: true, message: 'Staff profile updated.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update in-charge staff account.';
    console.error('API PATCH /api/admin/incharge error:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || searchParams.get('id');
    const email = searchParams.get('email');

    if (!userId && !email) {
      return NextResponse.json({ success: false, error: 'User ID or email is required for deletion.' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // 1. Delete from incharge_profiles table
    if (userId) {
      await (adminSupabase.from('incharge_profiles') as any)
        .delete()
        .or(`user_id.eq.${userId},id.eq.${userId}`);
    }
    if (email) {
      await (adminSupabase.from('incharge_profiles') as any)
        .delete()
        .eq('email', email.trim().toLowerCase());
    }

    // 2. Delete Auth user if exists
    let targetAuthUserId = userId;
    if (!targetAuthUserId && email) {
      const { data: userListData } = await adminSupabase.auth.admin.listUsers();
      const foundUser = userListData?.users?.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
      if (foundUser) targetAuthUserId = foundUser.id;
    }

    if (targetAuthUserId) {
      try {
        await adminSupabase.auth.admin.deleteUser(targetAuthUserId);
      } catch (authErr) {
        console.warn('Auth user deletion warning:', authErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Workforce member deleted successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete workforce member.';
    console.error('API DELETE /api/admin/incharge error:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
