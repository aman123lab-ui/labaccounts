'use client';

import React, { useState, useEffect } from 'react';
import QRCodeDisplay from './QRCodeDisplay';
import { UPI_CONFIG, buildUpiIntentUrl, buildUpiQrUrl } from '@/config/upi';
import { submitPaymentClaim } from '@/services/paymentClaimsService';

interface StudentPayNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  outstandingBalance: number;
  hasPendingClaim: boolean;
  onClaimSubmitted: () => void;
}

export default function StudentPayNowModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  outstandingBalance,
  hasPendingClaim,
  onClaimSubmitted,
}: StudentPayNowModalProps) {
  const [payAmount, setPayAmount] = useState<string>(outstandingBalance.toFixed(2));
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPayAmount(outstandingBalance > 0 ? outstandingBalance.toFixed(2) : '100.00');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, outstandingBalance]);

  if (!isOpen) return null;

  const numAmount = Math.max(0, Number(payAmount) || 0);
  const transactionNote = 'Print Cash';
  const upiQrUrl = buildUpiQrUrl(numAmount, transactionNote);
  const upiIntentUrl = buildUpiIntentUrl(numAmount, transactionNote);

  const handleCopyUpiId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(UPI_CONFIG.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleIvePaid = async () => {
    if (numAmount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than ₹0.00.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const res = await submitPaymentClaim(studentId, numAmount, transactionNote);

    setSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to submit payment claim.');
    } else {
      setSuccessMessage('Payment claim submitted successfully! Awaiting admin verification.');
      onClaimSubmitted();
      setTimeout(() => {
        onClose();
      }, 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl text-slate-100 relative flex flex-col space-y-3.5 my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono block">
              Direct UPI Payment
            </span>
            <h2 className="text-base sm:text-lg font-black text-white">Pay Balance via UPI</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 p-1.5 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Amount Input Pill Bar */}
        <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Payment Amount
            </span>
            <span className="text-[10px] text-slate-500">
              Total Due: <strong className="text-slate-300 font-mono">₹{outstandingBalance.toFixed(2)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl">
            <span className="text-base font-black text-emerald-400 font-mono">₹</span>
            <input
              type="number"
              step="0.01"
              min="1"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="bg-transparent text-base font-black text-white font-mono w-24 focus:outline-none text-right"
              placeholder="0.00"
            />
            {outstandingBalance > 0 && numAmount !== outstandingBalance && (
              <button
                type="button"
                onClick={() => setPayAmount(outstandingBalance.toFixed(2))}
                className="text-[10px] text-emerald-400 hover:underline font-mono ml-1 font-bold"
              >
                Max
              </button>
            )}
          </div>
        </div>

        {/* Main Single-View UPI Content */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
          {/* QR Code */}
          <div className="flex flex-col items-center shrink-0">
            <QRCodeDisplay value={upiQrUrl} size={130} />
            <span className="text-[10px] text-slate-400 mt-1 font-mono text-center">
              Scan / Enter: <strong className="text-emerald-400">₹{numAmount.toFixed(2)}</strong>
            </span>
          </div>

          {/* UPI ID & App Button */}
          <div className="space-y-2.5 flex-1 w-full text-center sm:text-left flex flex-col justify-center">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Organization UPI ID</span>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                <code className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-lg text-xs font-mono text-emerald-400 font-bold break-all">
                  {UPI_CONFIG.upiId}
                </code>
                <button
                  type="button"
                  onClick={handleCopyUpiId}
                  className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded-lg transition-colors shrink-0"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Mobile Intent Button */}
            <a
              href={upiIntentUrl}
              className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-md transition-all w-full text-center"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Pay with UPI App
            </a>
          </div>
        </div>

        {/* Note */}
        <div className="bg-amber-950/30 border border-amber-800/40 px-3 py-2 rounded-xl text-[11px] text-amber-200 leading-snug">
          <span className="font-bold text-amber-400">Note: </span>
          Click <strong className="text-white">&quot;I&apos;ve Paid&quot;</strong> after completing payment to update your balance upon admin verification.
        </div>

        {/* Status Messages */}
        {errorMessage && (
          <div className="bg-red-950/60 border border-red-800 text-red-300 text-xs p-2 rounded-xl">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs p-2 rounded-xl font-semibold">
            {successMessage}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleIvePaid}
            disabled={submitting || hasPendingClaim}
            className={`font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5 ${
              hasPendingClaim
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {submitting ? (
              <>Submitting...</>
            ) : hasPendingClaim ? (
              <>Claim Pending Verification</>
            ) : (
              <>I&apos;ve Paid (Submit Claim)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
