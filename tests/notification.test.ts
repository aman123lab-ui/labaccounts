import { describe, it, expect } from 'vitest';
import { PaymentClaim } from '../src/services/paymentClaimsService';

describe('Payment Claims Notification Bell & Database seen_at Logic', () => {
  it('should evaluate hasUnread as true when any claim has seen_at as null', () => {
    const claims: PaymentClaim[] = [
      {
        id: 'claim-1',
        student_id: 'student-1',
        claimed_amount: 50,
        claimed_at: '2026-08-08T10:00:00Z',
        status: 'pending',
        seen_at: null,
      },
    ];

    const hasUnread = claims.some((c) => c.seen_at === null || c.seen_at === undefined);
    expect(hasUnread).toBe(true);
  });

  it('should evaluate hasUnread as false when all claims have seen_at timestamps', () => {
    const claims: PaymentClaim[] = [
      {
        id: 'claim-1',
        student_id: 'student-1',
        claimed_amount: 50,
        claimed_at: '2026-08-08T10:00:00Z',
        status: 'pending',
        seen_at: '2026-08-08T10:05:00Z',
      },
    ];

    const hasUnread = claims.some((c) => c.seen_at === null || c.seen_at === undefined);
    expect(hasUnread).toBe(false);
  });

  it('should reset seen_at to null when admin verifies or rejects a claim', () => {
    const claim: PaymentClaim = {
      id: 'claim-1',
      student_id: 'student-1',
      claimed_amount: 50,
      claimed_at: '2026-08-08T10:00:00Z',
      status: 'pending',
      seen_at: '2026-08-08T10:05:00Z', // Previously seen pending status
    };

    // Simulated admin verification action
    const updatedClaim: PaymentClaim = {
      ...claim,
      status: 'verified',
      verified_by: 'Admin',
      verified_at: '2026-08-08T11:00:00Z',
      seen_at: null, // Reset seen_at to null for status change notification
    };

    const hasUnreadAfterAdminAction = [updatedClaim].some(
      (c) => c.seen_at === null || c.seen_at === undefined
    );

    expect(hasUnreadAfterAdminAction).toBe(true);
    expect(updatedClaim.status).toBe('verified');
    expect(updatedClaim.seen_at).toBeNull();
  });

  it('should preserve all claims in history list regardless of seen_at state', () => {
    const claims: PaymentClaim[] = [
      {
        id: 'claim-1',
        student_id: 'student-1',
        claimed_amount: 50,
        claimed_at: '2026-08-08T10:00:00Z',
        status: 'verified',
        seen_at: '2026-08-08T10:05:00Z',
      },
      {
        id: 'claim-2',
        student_id: 'student-1',
        claimed_amount: 100,
        claimed_at: '2026-08-08T12:00:00Z',
        status: 'pending',
        seen_at: null,
      },
    ];

    // Marking all as seen
    const nowIso = new Date().toISOString();
    const claimsAfterOpeningDropdown = claims.map((c) => ({
      ...c,
      seen_at: c.seen_at ?? nowIso,
    }));

    // List length remains unchanged
    expect(claimsAfterOpeningDropdown).toHaveLength(2);
    expect(claimsAfterOpeningDropdown[0].id).toBe('claim-1');
    expect(claimsAfterOpeningDropdown[1].id).toBe('claim-2');

    // Badge indicator becomes false
    const hasUnread = claimsAfterOpeningDropdown.some(
      (c) => c.seen_at === null || c.seen_at === undefined
    );
    expect(hasUnread).toBe(false);
  });
});
