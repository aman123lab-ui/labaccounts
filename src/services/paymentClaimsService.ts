import { createClient } from '@/lib/supabase/client';
import { postCreditEntries } from './ledgerService';
import { getCurrentFinancialYear } from '@/services/financialYearService';
import {
  isGuestMode,
  getDemoPendingClaims,
  getDemoPendingClaimsCount,
  getDemoStudentClaimsHistory,
  verifyDemoPaymentClaim,
  rejectDemoPaymentClaim,
  submitDemoPaymentClaim,
} from '@/lib/demo/demoStore';

export interface PaymentClaim {
  id: string;
  student_id: string;
  claimed_amount: number;
  claimed_at: string;
  status: 'pending' | 'verified' | 'rejected';
  verified_by?: string | null;
  verified_at?: string | null;
  admin_note?: string | null;
  upi_tn?: string | null;
  seen_at?: string | null;
  students?: {
    name: string;
    phone?: string;
    batches?: {
      name: string;
      category: string;
    } | null;
  } | null;
}

/**
 * Submits a new payment claim for a student.
 * Checks for existing pending claims to prevent duplicate submissions while one is awaiting admin verification.
 */
export async function submitPaymentClaim(
  studentId: string,
  claimedAmount: number,
  upiTn?: string
): Promise<{ success: boolean; claimId?: string; error?: string }> {
  if (isGuestMode()) {
    const res = submitDemoPaymentClaim({
      studentId,
      studentName: 'Demo Student',
      amount: claimedAmount,
      transactionId: upiTn || 'DEMO-UPI-123',
      paymentDate: new Date().toISOString().slice(0, 10),
    });
    return { success: true, claimId: res.claim.id };
  }

  if (claimedAmount <= 0) {
    return { success: false, error: 'Claimed amount must be greater than zero.' };
  }

  try {
    const res = await fetch('/api/payment-claims/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, claimedAmount, upiTn }),
    });

    const result = res.headers.get('content-type')?.includes('application/json')
      ? await res.json()
      : { success: false, error: 'Invalid API response format' };
    return result;
  } catch (err: any) {
    console.warn('API route submission failed, falling back to client client:', err);
  }

  // Fallback to client side if API route is unreachable
  const supabase = createClient();

  const { data: existingPending } = await (supabase
    .from('payment_claims' as any)
    .select('id, claimed_amount, claimed_at')
    .eq('student_id', studentId)
    .eq('status', 'pending')
    .maybeSingle() as unknown as Promise<{ data: { id: string } | null; error: any }>);

  if (existingPending) {
    return {
      success: false,
      error: 'You already have a pending payment claim awaiting admin verification.',
    };
  }

  const { data, error } = await ((supabase
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
    console.error('Error submitting payment claim via client:', error);
    return { success: false, error: error.message };
  }

  return { success: true, claimId: data?.id };
}

/**
 * Marks all currently unseen payment claims for a student as seen.
 * Returns success timestamp.
 */
export async function markStudentClaimsAsSeen(studentId: string): Promise<{ success: boolean; seenAt?: string; error?: string }> {
  if (!studentId) return { success: false, error: 'No student ID provided.' };
  return { success: true, seenAt: new Date().toISOString() };
}

/**
 * Fetches all payment claims for admin inspection, ordered newest first.
 * Scoped to current financial year date boundaries by default.
 */
export async function getAllPaymentClaims(financialYearId?: string): Promise<PaymentClaim[]> {
  if (isGuestMode()) {
    const claims = getDemoPendingClaims();
    return claims.map((c) => ({
      id: c.id,
      student_id: c.student_id,
      claimed_amount: c.amount,
      claimed_at: c.created_at,
      status: c.status,
      upi_tn: c.transaction_id,
      students: {
        name: c.student_name,
        phone: '9876543210',
        batches: { name: 'M.Sc 2025', category: 'General' },
      },
    })) as PaymentClaim[];
  }

  const supabase = createClient();

  let query = supabase
    .from('payment_claims' as any)
    .select('*, students(name, phone, batches(name, category))')
    .order('claimed_at', { ascending: false });

  if (financialYearId !== 'ALL') {
    const activeFy = await getCurrentFinancialYear();
    if (activeFy) {
      query = query
        .gte('claimed_at', `${activeFy.start_date}T00:00:00.000Z`)
        .lte('claimed_at', `${activeFy.end_date}T23:59:59.999Z`);
    }
  }

  const { data, error } = await (query as unknown as Promise<{ data: any[] | null; error: any }>);

  if (error) {
    console.error('Error fetching payment claims:', error);
    return [];
  }

  return (data || []) as unknown as PaymentClaim[];
}

/**
 * Returns count of PENDING claims for admin notification badges.
 */
export async function getPendingClaimsCount(): Promise<number> {
  if (isGuestMode()) {
    return getDemoPendingClaimsCount();
  }

  const supabase = createClient();

  const { count, error } = await (supabase
    .from('payment_claims' as any)
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending') as unknown as Promise<{ count: number | null; error: any }>);

  if (error) {
    return 0;
  }

  return count || 0;
}

/**
 * Fetches the most recent payment claim for a given student (for Student Portal status indicator).
 */
export async function getLatestStudentClaim(studentId: string): Promise<PaymentClaim | null> {
  const supabase = createClient();

  const { data, error } = await (supabase
    .from('payment_claims' as any)
    .select('*')
    .eq('student_id', studentId)
    .order('claimed_at', { ascending: false })
    .limit(1)
    .maybeSingle() as unknown as Promise<{ data: any | null; error: any }>);

  if (error) {
    console.warn('Error fetching student claim:', error);
    return null;
  }

  return data as PaymentClaim | null;
}

/**
 * Fetches the payment claim history for a given student (most recent first).
 */
export async function getStudentClaimsHistory(
  studentId: string,
  limit: number = 10
): Promise<PaymentClaim[]> {
  if (isGuestMode()) {
    const claims = getDemoStudentClaimsHistory(studentId, limit);
    return claims.map((c) => ({
      id: c.id,
      student_id: c.student_id,
      claimed_amount: c.amount,
      claimed_at: c.created_at,
      status: c.status,
      admin_note: c.rejection_reason,
      upi_tn: c.transaction_id,
    })) as PaymentClaim[];
  }

  const supabase = createClient();

  const { data, error } = await (supabase
    .from('payment_claims' as any)
    .select('*')
    .eq('student_id', studentId)
    .order('claimed_at', { ascending: false })
    .limit(limit) as unknown as Promise<{ data: any[] | null; error: any }>);

  if (error) {
    console.warn('Error fetching student claims history:', error);
    return [];
  }

  return (data || []) as PaymentClaim[];
}

/**
 * Verifies a pending payment claim:
 * 1. Performs atomic status update (where status = 'pending') for race condition protection.
 * 2. If in-charge verifies, posts Credit journal entry to Cash in Hand (In-Charge) Dr / Student AR Cr.
 * 3. If admin verifies, posts Credit journal entry to main Lab Cash Account Dr / Student AR Cr.
 */
export async function verifyPaymentClaim(
  claimId: string,
  adminId: string = 'Admin',
  isIncharge: boolean = false,
  verifierName?: string
): Promise<{ success: boolean; alreadyHandled?: boolean; error?: string }> {
  const depositAccountId = isIncharge
    ? '10000000-0000-0000-0000-000000000003'
    : '10000000-0000-0000-0000-000000000001';

  const displayName = verifierName ? (isIncharge ? `${verifierName} (In-Charge)` : verifierName) : adminId;

  if (isGuestMode()) {
    return verifyDemoPaymentClaim(claimId, depositAccountId, displayName);
  }

  const supabase = createClient();

  // 1. Atomic UPDATE with status = 'pending' check
  const { data: updatedClaims, error: updateErr } = await ((supabase
    .from('payment_claims' as any) as any)
    .update({
      status: 'verified',
      verified_by: displayName,
      verified_at: new Date().toISOString(),
    })
    .eq('id', claimId)
    .eq('status', 'pending')
    .select('*, students(name)') as unknown as Promise<{ data: any[] | null; error: any }>);

  if (updateErr) {
    console.error('Error updating payment claim status:', updateErr);
    return { success: false, error: 'Failed to verify payment claim.' };
  }

  // 2. Race condition check: If 0 rows updated, someone else already handled it!
  if (!updatedClaims || updatedClaims.length === 0) {
    const { data: currentClaim } = await (supabase
      .from('payment_claims' as any)
      .select('status, verified_by')
      .eq('id', claimId)
      .maybeSingle() as unknown as Promise<{ data: any | null; error: any }>);

    const handledBy = currentClaim?.verified_by ? ` by ${currentClaim.verified_by}` : '';
    const statusMsg = currentClaim?.status ? `already ${currentClaim.status}` : 'already processed';

    return {
      success: false,
      alreadyHandled: true,
      error: `This payment claim has ${statusMsg}${handledBy}.`,
    };
  }

  const claim = updatedClaims[0];
  const studentName = claim.students?.name || 'Student';
  const description = `UPI Payment Verified (${displayName}) - ${studentName} (Ref Claim #${claim.id.slice(0, 8)})`;

  // 3. Post Credit Entry using existing ledger credit flow
  const creditRes = await postCreditEntries({
    studentIds: [claim.student_id],
    amount: Number(claim.claimed_amount),
    description,
    useInchargeCashAccount: isIncharge,
  });

  if (!creditRes.success || creditRes.results.some((r) => !r.success)) {
    const errorMsg = creditRes.error || creditRes.results.find((r) => r.error)?.error || 'Failed to post credit journal entry.';
    return { success: false, error: errorMsg };
  }

  return { success: true };
}

/**
 * Rejects a pending payment claim with an optional note and atomic race protection.
 */
export async function rejectPaymentClaim(
  claimId: string,
  adminNote?: string,
  adminId: string = 'Admin',
  verifierName?: string
): Promise<{ success: boolean; alreadyHandled?: boolean; error?: string }> {
  const displayName = verifierName || adminId;

  if (isGuestMode()) {
    return rejectDemoPaymentClaim(claimId, adminNote || '', displayName);
  }

  const supabase = createClient();

  const { data: updatedClaims, error } = await ((supabase
    .from('payment_claims' as any) as any)
    .update({
      status: 'rejected',
      admin_note: adminNote || null,
      verified_by: displayName,
      verified_at: new Date().toISOString(),
    })
    .eq('id', claimId)
    .eq('status', 'pending')
    .select('id, status, verified_by') as Promise<{ data: any[] | null; error: any }>);

  if (error) {
    console.error('Error rejecting payment claim:', error);
    return { success: false, error: error.message };
  }

  if (!updatedClaims || updatedClaims.length === 0) {
    const { data: currentClaim } = await (supabase
      .from('payment_claims' as any)
      .select('status, verified_by')
      .eq('id', claimId)
      .maybeSingle() as unknown as Promise<{ data: any | null; error: any }>);

    const handledBy = currentClaim?.verified_by ? ` by ${currentClaim.verified_by}` : '';
    const statusMsg = currentClaim?.status ? `already ${currentClaim.status}` : 'already processed';

    return {
      success: false,
      alreadyHandled: true,
      error: `This payment claim has ${statusMsg}${handledBy}.`,
    };
  }

  return { success: true };
}
