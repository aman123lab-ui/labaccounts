'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PaymentClaim, markStudentClaimsAsSeen } from '@/services/paymentClaimsService';
import { formatDate } from '@/utils/formatDate';

interface StudentNotificationBellProps {
  studentId: string;
  claims: PaymentClaim[];
  onClaimsSeen?: () => void;
}

export default function StudentNotificationBell({ studentId, claims, onClaimsSeen }: StudentNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastSeenTime, setLastSeenTime] = useState<string | null>(null);
  const [activeNotifications, setActiveNotifications] = useState<PaymentClaim[]>(claims);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && studentId) {
      const saved = localStorage.getItem(`lab_claims_seen_${studentId}`);
      setLastSeenTime(saved);
    }
    setActiveNotifications(claims);
  }, [claims, studentId]);

  // Unread badge logic: any claim updated after lastSeenTime
  const hasUnread = Boolean(
    studentId &&
      claims.some((claim) => {
        if (!lastSeenTime) return true;
        const claimTime = claim.verified_at || claim.claimed_at;
        return new Date(claimTime).getTime() > new Date(lastSeenTime).getTime();
      })
  );

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const nextState = !isOpen;

    if (nextState) {
      const nowIso = new Date().toISOString();
      if (typeof window !== 'undefined' && studentId) {
        localStorage.setItem(`lab_claims_seen_${studentId}`, nowIso);
        setLastSeenTime(nowIso);
      }
      setActiveNotifications(claims);
      setIsOpen(true);
      if (onClaimsSeen) onClaimsSeen();
    } else {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 p-2.5 rounded-xl transition-colors focus:outline-none"
        title="Payment Claim Notifications"
        aria-label="Payment Claim Notifications"
      >
        <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Status Badge Indicator */}
        {hasUnread && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-950"></span>
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 z-50 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-4 space-y-3 animate-scale-up">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Payment Notifications
              </span>
              {activeNotifications.length > 0 && (
                <span className="bg-slate-800 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                  {activeNotifications.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-lg text-xs"
            >
              ✕
            </button>
          </div>

          {/* Claims List */}
          {activeNotifications.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs space-y-1 font-mono">
              <p className="text-slate-400 font-semibold">No new notifications</p>
              <p className="text-[10px] text-slate-600">All payment claim notifications have been read.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 no-scrollbar">
              {activeNotifications.map((claim) => {
                const isPending = claim.status === 'pending';
                const isVerified = claim.status === 'verified';
                const isRejected = claim.status === 'rejected';

                return (
                  <div
                    key={claim.id}
                    className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all text-xs ${
                      isPending
                        ? 'bg-amber-950/30 border-amber-800/40 text-amber-200'
                        : isVerified
                        ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                        : 'bg-red-950/30 border-red-800/40 text-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border ${
                          isPending
                            ? 'bg-amber-900/60 border-amber-700 text-amber-300'
                            : isVerified
                            ? 'bg-emerald-900/60 border-emerald-700 text-emerald-300'
                            : 'bg-red-900/60 border-red-700 text-red-300'
                        }`}
                      >
                        {claim.status}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDate(claim.claimed_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between font-mono font-bold">
                      <span className="text-white">Amount Claimed:</span>
                      <span className="text-emerald-400">₹{Number(claim.claimed_amount).toFixed(2)}</span>
                    </div>

                    <p className="text-[11px] leading-snug font-sans text-slate-300">
                      {isPending && 'Awaiting admin verification.'}
                      {isVerified && 'Verified and credited to your account!'}
                      {isRejected && (
                        <span>
                          Claim rejected by admin.
                          {claim.admin_note && (
                            <span className="block text-red-300 font-medium mt-0.5">
                              Reason: &quot;{claim.admin_note}&quot;
                            </span>
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
