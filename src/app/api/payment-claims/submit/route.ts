import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { studentId, claimedAmount, upiTn } = await request.json();

    if (!studentId || typeof claimedAmount !== 'number' || claimedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid student ID or payment amount.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Check if student already has a PENDING claim
    const { data: existingPending, error: checkErr } = await (supabaseAdmin
      .from('payment_claims' as any)
      .select('id, claimed_amount, claimed_at')
      .eq('student_id', studentId)
      .eq('status', 'pending')
      .maybeSingle() as unknown as Promise<{ data: { id: string; claimed_amount: number; claimed_at: string } | null; error: any }>);

    if (checkErr && checkErr.code !== 'PGRST116') {
      console.error('Error checking existing pending claims:', checkErr);
    }

    if (existingPending) {
      return NextResponse.json({
        success: false,
        error:
          'You already have a pending payment claim awaiting admin verification. Please wait for admin verification before submitting another claim.',
      });
    }

    // 2. Insert new payment claim using admin client (bypasses client RLS restrictions)
    const { data, error } = await ((supabaseAdmin
      .from('payment_claims' as any) as any)
      .insert({
        student_id: studentId,
        claimed_amount: claimedAmount,
        status: 'pending',
        upi_tn: upiTn || `Fee Payment for Student ID ${studentId.slice(0, 8)}`,
      })
      .select()
      .single() as unknown as Promise<{ data: { id: string } | null; error: any }>);

    if (error) {
      console.error('Error inserting payment claim via admin client:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, claimId: data?.id });
  } catch (err: any) {
    console.error('API Error in /api/payment-claims/submit:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
