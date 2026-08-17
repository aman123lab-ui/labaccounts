'use client';

import React, { useState, useEffect } from 'react';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import {
  getAllPaymentClaims,
  verifyPaymentClaim,
  rejectPaymentClaim,
  PaymentClaim,
} from '@/services/paymentClaimsService';
import { formatDate } from '@/utils/formatDate';

export default function PaymentClaimsPage() {
  const [claims, setClaims] = useState<PaymentClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'verified' | 'rejected' | 'all'>('pending');

  // Action modals / processing states
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingClaim, setRejectingClaim] = useState<PaymentClaim | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchClaims = async () => {
    setLoading(true);
    const data = await getAllPaymentClaims();
    setClaims(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  useRealtimeSync({
    channelName: 'admin-payment-claims-sync',
    table: 'payment_claims',
    onDataChange: () => {
      fetchClaims();
    },
  });

  const handleVerify = async (claim: PaymentClaim) => {
    setProcessingId(claim.id);
    setStatusMessage(null);

    const studentName = claim.students?.name || 'Student';
    const res = await verifyPaymentClaim(claim.id, 'Admin');

    setProcessingId(null);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Payment claim of ₹${Number(claim.claimed_amount).toFixed(2)} for ${studentName} successfully verified! Credit journal entry (Cash Dr / Student AR Cr) has been posted.`,
      });
      fetchClaims();
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Failed to verify payment claim.',
      });
      if (res.alreadyHandled) {
        fetchClaims();
      }
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingClaim) return;

    setProcessingId(rejectingClaim.id);
    setStatusMessage(null);

    const res = await rejectPaymentClaim(rejectingClaim.id, rejectNote.trim(), 'Admin');

    setProcessingId(null);
    setRejectingClaim(null);
    setRejectNote('');

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: 'Payment claim marked as rejected.',
      });
      fetchClaims();
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Failed to reject payment claim.',
      });
      if (res.alreadyHandled) {
        fetchClaims();
      }
    }
  };

  const pendingClaims = claims.filter((c) => c.status === 'pending');
  const verifiedClaims = claims.filter((c) => c.status === 'verified');
  const rejectedClaims = claims.filter((c) => c.status === 'rejected');

  const filteredClaims =
    activeTab === 'pending'
      ? pendingClaims
      : activeTab === 'verified'
      ? verifiedClaims
      : activeTab === 'rejected'
      ? rejectedClaims
      : claims;

  return (
    <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 space-y-6 flex-1 font-sans">
        {/* Header & Description */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 font-mono">
                Student UPI Payment Verification
              </span>
              {pendingClaims.length > 0 && (
                <span className="bg-amber-500 text-slate-950 font-black text-[11px] font-mono px-2 py-0.5 rounded-full animate-pulse">
                  {pendingClaims.length} Pending
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-white mt-1">Student Payment Claims</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Review direct UPI payment submissions reported by students. Verifying a claim automatically posts a Credit journal entry (Cash Account Dr / Student AR Cr) to clear their balance.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchClaims}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 self-start sm:self-auto"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Claims
          </button>
        </div>

        {/* Global Notification Banner */}
        {statusMessage && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-lg ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-red-950/60 border-red-800 text-red-200'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white font-bold text-sm ml-4"
            >
              &times;
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex bg-slate-900/90 border border-slate-800/80 p-1.5 rounded-2xl w-full sm:w-fit gap-1 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pending Claims
            <span className="bg-amber-500/20 text-amber-400 font-mono text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30">
              {pendingClaims.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('verified')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'verified'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Verified History
            <span className="bg-emerald-500/20 text-emerald-400 font-mono text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30">
              {verifiedClaims.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rejected')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'rejected'
                ? 'bg-slate-800 text-red-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rejected History
            <span className="bg-red-500/20 text-red-400 font-mono text-[10px] px-2 py-0.5 rounded-full border border-red-500/30">
              {rejectedClaims.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Claims ({claims.length})
          </button>
        </div>

        {/* Claims Table / List */}
        {loading ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-400 animate-pulse font-mono text-xs">
            Fetching payment claims from ledger database...
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center space-y-2">
            <span className="text-slate-400 text-sm font-semibold block">
              No {activeTab !== 'all' ? activeTab : ''} payment claims found.
            </span>
            <p className="text-xs text-slate-500">
              Student payment claims submitted via UPI will appear here for manual admin verification.
            </p>
          </div>
        ) : (
          <div className="border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl bg-slate-900/40 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-300 border-b border-slate-800 font-mono uppercase">
                <tr>
                  <th className="p-4">Student Details</th>
                  <th className="p-4">Batch</th>
                  <th className="p-4 text-right">Claimed Amount (₹)</th>
                  <th className="p-4">Submitted At</th>
                  <th className="p-4">Reference Note</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredClaims.map((claim) => {
                  const studentName = claim.students?.name || 'Unknown Student';
                  const studentPhone = claim.students?.phone || '';
                  const batchName = claim.students?.batches?.name || 'Unassigned';

                  return (
                    <tr key={claim.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Student Details */}
                      <td className="p-4 font-sans">
                        <div className="font-bold text-white text-sm">{studentName}</div>
                        {studentPhone && <div className="text-emerald-400 text-xs font-mono">{studentPhone}</div>}
                      </td>

                      {/* Batch */}
                      <td className="p-4 font-sans font-bold text-slate-300">
                        <span className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono">
                          {batchName}
                        </span>
                      </td>

                      {/* Claimed Amount */}
                      <td className="p-4 text-right font-black text-sm text-emerald-400">
                        ₹{Number(claim.claimed_amount).toFixed(2)}
                      </td>

                      {/* Submitted At */}
                      <td className="p-4 text-slate-400 text-[11px]">
                        {formatDate(claim.claimed_at)}
                      </td>

                      {/* Reference Note */}
                      <td className="p-4 text-slate-300 font-sans text-xs max-w-xs truncate">
                        {claim.upi_tn || '-'}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold font-mono uppercase tracking-wider ${
                            claim.status === 'pending'
                              ? 'bg-amber-950 border border-amber-800 text-amber-300 animate-pulse'
                              : claim.status === 'verified'
                              ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                              : 'bg-red-950 border border-red-800 text-red-300'
                          }`}
                        >
                          {claim.status}
                        </span>
                      </td>

                      {/* Actions / Details */}
                      <td className="p-4 text-right font-sans">
                        {claim.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleVerify(claim)}
                              disabled={processingId === claim.id}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow transition-all flex items-center gap-1"
                            >
                              {processingId === claim.id ? (
                                'Verifying...'
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Verify & Credit
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRejectingClaim(claim);
                                setRejectNote('');
                              }}
                              disabled={processingId === claim.id}
                              className="bg-slate-800 hover:bg-red-950/80 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-800 font-semibold text-xs px-3 py-1.5 rounded-lg transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 font-mono text-right">
                            {claim.status === 'verified' && (
                              <span className="text-emerald-400 font-semibold block">
                                Verified by {claim.verified_by || 'Admin'}
                              </span>
                            )}
                            {claim.status === 'rejected' && (
                              <div>
                                <span className="text-red-400 font-semibold block">Rejected</span>
                                {claim.admin_note && (
                                  <span className="text-slate-400 italic block text-[10px]">
                                    &quot;{claim.admin_note}&quot;
                                  </span>
                                )}
                              </div>
                            )}
                            {claim.verified_at && (
                              <span className="text-slate-500 text-[10px] block">
                                {formatDate(claim.verified_at)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* REJECT CLAIM MODAL */}
        {rejectingClaim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-md font-bold text-white">Reject Payment Claim</h3>
                <button
                  type="button"
                  onClick={() => setRejectingClaim(null)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  &times;
                </button>
              </div>

              <p className="text-xs text-slate-300">
                Rejecting claim of <span className="font-bold text-emerald-400 font-mono">₹{Number(rejectingClaim.claimed_amount).toFixed(2)}</span> for{' '}
                <span className="font-bold text-white">{rejectingClaim.students?.name}</span>. No journal entry will be posted.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Optional Reason / Admin Note (visible to student):
                </label>
                <textarea
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="e.g. Payment not received in bank account / Amount mismatch"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingClaim(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg transition-all"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
  );
}
