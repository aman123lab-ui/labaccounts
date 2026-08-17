import { createClient } from '@/lib/supabase/client';
import { postJournalEntry } from './accountingService';
import { getCashInHandInchargeAccountId } from './ledgerService';
import {
  isGuestMode,
  getDemoPendingHandoverClaims,
  getDemoPendingHandoverClaimsCount,
  getDemoInchargeHandoverClaims,
  submitDemoCashHandoverClaim,
  verifyDemoCashHandoverClaim,
  rejectDemoCashHandoverClaim,
} from '@/lib/demo/demoStore';

export interface CashHandoverClaim {
  id: string;
  incharge_id: string;
  incharge_name?: string;
  claimed_amount: number;
  claimed_at: string;
  status: 'pending' | 'verified' | 'rejected';
  verified_by?: string | null;
  verified_at?: string | null;
  admin_note?: string | null;
}

/**
  * Submits a cash handover claim for an In-charge staff member.
  * Checks for existing pending claims to prevent duplicate submissions.
  */
export async function submitCashHandoverClaim(
  claimedAmount: number,
  inchargeId?: string,
  inchargeName?: string
): Promise<{ success: boolean; claimId?: string; error?: string }> {
  const supabase = createClient();

  let activeInchargeId = inchargeId;
  let activeInchargeName = inchargeName || 'Staff In-Charge';

  if (!activeInchargeId) {
    const { data: authUser } = await supabase.auth.getUser();
    if (authUser?.user) {
      activeInchargeId = authUser.user.id;
      activeInchargeName = authUser.user.email || authUser.user.user_metadata?.full_name || 'Staff In-Charge';
    }
  }

  if (!activeInchargeId) {
    activeInchargeId = 'incharge-demo-user';
  }

  if (isGuestMode()) {
    const res = submitDemoCashHandoverClaim({
      inchargeId: activeInchargeId,
      inchargeName: activeInchargeName,
      amount: claimedAmount,
    });
    if (!res.success) return { success: false, error: res.error };
    return { success: true, claimId: res.claim?.id };
  }

  if (claimedAmount <= 0) {
    return { success: false, error: 'Claimed handover amount must be greater than ₹0.00.' };
  }

  try {
    // 1. Check for existing pending claim
    const { data: existingPending } = await (supabase
      .from('cash_handover_claims' as any)
      .select('id, claimed_amount, claimed_at')
      .eq('incharge_id', activeInchargeId)
      .eq('status', 'pending')
      .maybeSingle() as unknown as Promise<{ data: { id: string } | null; error: any }>);

    if (existingPending) {
      return {
        success: false,
        error: 'You already have a pending cash handover claim awaiting admin verification.',
      };
    }

    // 2. Insert new cash handover claim
    const { data, error } = await ((supabase
      .from('cash_handover_claims' as any) as any)
      .insert({
        incharge_id: activeInchargeId,
        incharge_name: activeInchargeName,
        claimed_amount: claimedAmount,
        status: 'pending',
      })
      .select()
      .single() as unknown as Promise<{ data: { id: string } | null; error: any }>);

    if (error) {
      console.error('Error submitting cash handover claim:', error);
      if (error.message?.includes('schema cache') || error.code === '42P01') {
        return {
          success: false,
          error: 'The cash_handover_claims table is not created in your Supabase database yet. Please run the SQL commands in supabase/schema.sql in your Supabase SQL Editor.',
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, claimId: data?.id };
  } catch (err: any) {
    console.error('Failed to submit cash handover claim:', err);
    return { success: false, error: err?.message || 'Server error submitting handover claim.' };
  }
}

/**
  * Fetches the most recent cash handover claim for an In-charge user.
  */
export async function getLatestInchargeHandoverClaim(inchargeId?: string): Promise<CashHandoverClaim | null> {
  const supabase = createClient();
  let activeInchargeId = inchargeId;

  if (!activeInchargeId) {
    const { data: authUser } = await supabase.auth.getUser();
    activeInchargeId = authUser.user?.id || 'incharge-demo-user';
  }

  if (isGuestMode()) {
    const claims = getDemoInchargeHandoverClaims(activeInchargeId);
    return (claims[0] as unknown as CashHandoverClaim) || null;
  }

  try {
    const { data, error } = await (supabase
      .from('cash_handover_claims' as any)
      .select('*')
      .eq('incharge_id', activeInchargeId)
      .order('claimed_at', { ascending: false })
      .limit(1)
      .maybeSingle() as unknown as Promise<{ data: any | null; error: any }>);

    if (error) {
      console.warn('Error fetching latest handover claim:', error);
      return null;
    }

    return data as CashHandoverClaim | null;
  } catch (err) {
    console.error('Error in getLatestInchargeHandoverClaim:', err);
    return null;
  }
}

/**
  * Fetches all handover claims history for an In-charge user.
  */
export async function getInchargeHandoverHistory(inchargeId?: string): Promise<CashHandoverClaim[]> {
  const supabase = createClient();
  let activeInchargeId = inchargeId;

  if (!activeInchargeId) {
    const { data: authUser } = await supabase.auth.getUser();
    activeInchargeId = authUser.user?.id || 'incharge-demo-user';
  }

  if (isGuestMode()) {
    return getDemoInchargeHandoverClaims(activeInchargeId) as unknown as CashHandoverClaim[];
  }

  try {
    const { data, error } = await (supabase
      .from('cash_handover_claims' as any)
      .select('*')
      .eq('incharge_id', activeInchargeId)
      .order('claimed_at', { ascending: false }) as unknown as Promise<{ data: any[] | null; error: any }>);

    if (error) {
      console.error('Error fetching handover history:', error);
      return [];
    }

    return (data || []) as CashHandoverClaim[];
  } catch (err) {
    console.error('Error in getInchargeHandoverHistory:', err);
    return [];
  }
}

/**
  * Fetches all pending cash handover claims for Admin inspection.
  */
export async function getAllPendingHandoverClaims(): Promise<CashHandoverClaim[]> {
  if (isGuestMode()) {
    return getDemoPendingHandoverClaims() as unknown as CashHandoverClaim[];
  }

  const supabase = createClient();

  try {
    const { data, error } = await (supabase
      .from('cash_handover_claims' as any)
      .select('*')
      .eq('status', 'pending')
      .order('claimed_at', { ascending: false }) as unknown as Promise<{ data: any[] | null; error: any }>);

    if (error) {
      console.error('Error fetching pending handover claims:', error);
      return [];
    }

    return (data || []) as CashHandoverClaim[];
  } catch (err) {
    console.error('Error in getAllPendingHandoverClaims:', err);
    return [];
  }
}

/**
  * Returns total count of PENDING handover claims for Admin badges.
  */
export async function getPendingHandoverClaimsCount(): Promise<number> {
  if (isGuestMode()) {
    return getDemoPendingHandoverClaimsCount();
  }

  const supabase = createClient();

  try {
    const { count, error } = await (supabase
      .from('cash_handover_claims' as any)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending') as unknown as Promise<{ count: number | null; error: any }>);

    if (error) return 0;
    return count || 0;
  } catch (err) {
    return 0;
  }
}

/**
  * Verifies a pending cash handover claim:
  * 1. Posts transfer journal entry: Lab Cash Account (Dr) / Cash in Hand (In-Charge) (Cr)
  * 2. Marks claim status = 'verified', records verified_at and verified_by.
  */
export async function verifyCashHandoverClaim(
  claimId: string,
  adminId: string = 'Admin'
): Promise<{ success: boolean; error?: string }> {
  if (isGuestMode()) {
    return verifyDemoCashHandoverClaim(claimId, adminId);
  }

  const supabase = createClient();

  try {
    // 1. Fetch claim
    const { data: claim, error: fetchErr } = await (supabase
      .from('cash_handover_claims' as any)
      .select('*')
      .eq('id', claimId)
      .single() as unknown as Promise<{ data: any | null; error: any }>);

    if (fetchErr || !claim) {
      return { success: false, error: 'Cash handover claim not found.' };
    }

    if (claim.status !== 'pending') {
      return { success: false, error: `Claim has already been ${claim.status}.` };
    }

    const mainCashAccountId = '10000000-0000-0000-0000-000000000001';
    const inchargeCashAccountId = await getCashInHandInchargeAccountId();

    const desc = `Cash Handover Transfer Verified - ${claim.incharge_name || 'Staff In-Charge'} (Ref Claim #${claim.id.slice(0, 8)})`;

    // 2. Post Journal Entry: Lab Cash Account (Dr) / Cash in Hand (In-Charge) (Cr)
    const journalRes = await postJournalEntry(
      [
        { accountId: mainCashAccountId, debit: Number(claim.claimed_amount), credit: 0 },
        { accountId: inchargeCashAccountId, debit: 0, credit: Number(claim.claimed_amount) },
      ],
      desc
    );

    if (!journalRes.success || !journalRes.entryId) {
      return { success: false, error: journalRes.error || 'Failed to post transfer journal entry.' };
    }

    // 3. Mark claim as verified
    const { error: updateErr } = await ((supabase
      .from('cash_handover_claims' as any) as any)
      .update({
        status: 'verified',
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      })
      .eq('id', claimId) as unknown as Promise<{ error: any }>);

    if (updateErr) {
      console.error('Error updating handover claim status:', updateErr);
      return { success: false, error: 'Transfer entry posted, but failed to update claim status.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to verify cash handover claim:', err);
    return { success: false, error: err?.message || 'Server error verifying handover claim.' };
  }
}

/**
  * Rejects a pending cash handover claim with an optional admin note.
  */
export async function rejectCashHandoverClaim(
  claimId: string,
  adminNote?: string,
  adminId: string = 'Admin'
): Promise<{ success: boolean; error?: string }> {
  if (isGuestMode()) {
    return rejectDemoCashHandoverClaim(claimId, adminNote, adminId);
  }

  const supabase = createClient();

  try {
    const { error } = await ((supabase
      .from('cash_handover_claims' as any) as any)
      .update({
        status: 'rejected',
        admin_note: adminNote || null,
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      })
      .eq('id', claimId) as Promise<{ error: any }>);

    if (error) {
      console.error('Error rejecting cash handover claim:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to reject cash handover claim:', err);
    return { success: false, error: err?.message || 'Server error rejecting handover claim.' };
  }
}
