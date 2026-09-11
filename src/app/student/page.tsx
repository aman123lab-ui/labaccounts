'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logoutUser, getValidSessionUser } from '@/services/authService';
import { useRealtimeMultiSync } from '@/hooks/useRealtimeSync';

import { getStudentClaimsHistory, PaymentClaim } from '@/services/paymentClaimsService';
import { getStudentDetailsAndBalance } from '@/services/studentService';
import StudentPayNowModal from '@/components/StudentPayNowModal';
import StudentNotificationBell from '@/components/StudentNotificationBell';
import StudentPortalFooter from '@/components/StudentPortalFooter';
import GuestModeBanner from '@/components/GuestModeBanner';

export default function StudentDashboard() {
  const router = useRouter();
  const [studentInfo, setStudentInfo] = useState<{
    id: string;
    name: string;
    phone: string;
    batchName?: string;
  } | null>(null);

  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<
    { id: string; date: string; description: string; debit: number; credit: number; runningBalance: number }[]
  >([]);
  const [claimsHistory, setClaimsHistory] = useState<PaymentClaim[]>([]);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchClaimsHistory = useCallback(async (sId: string) => {
    const claims = await getStudentClaimsHistory(sId, 5);
    setClaimsHistory(claims);
  }, []);

  useEffect(() => {
    async function loadStudentData() {
      setLoading(true);

      const sessionUser = await getValidSessionUser();

      if (!sessionUser.authenticated) {
        router.replace('/');
        return;
      }

      if (sessionUser.role !== 'student') {
        if (sessionUser.role === 'admin') {
          router.replace('/admin');
        } else {
          router.replace('/');
        }
        return;
      }

      const res = await getStudentDetailsAndBalance({
        studentId: sessionUser.studentId,
        phone: sessionUser.studentPhone,
      });

      if (res) {
        setStudentInfo({
          id: res.student.id,
          name: res.student.name,
          phone: res.student.phone,
          batchName: res.student.batch_name,
        });
        setAccountBalance(res.balance);
        setTransactions(res.transactions);
        fetchClaimsHistory(res.student.id);

        if (typeof window !== 'undefined') {
          localStorage.setItem('lab_student_id', res.student.id);
          localStorage.setItem('lab_student_name', res.student.name);
          localStorage.setItem('lab_student_phone', res.student.phone);
        }
      } else {
        setAccountBalance(0.0);
      }

      setLoading(false);
    }

    loadStudentData();
  }, [fetchClaimsHistory, router]);

  const reloadData = useCallback(async () => {
    if (!studentInfo?.id) return;
    const res = await getStudentDetailsAndBalance({ studentId: studentInfo.id });
    if (res) {
      setAccountBalance(res.balance);
      setTransactions(res.transactions);
      fetchClaimsHistory(res.student.id);
    }
  }, [studentInfo?.id, fetchClaimsHistory]);

  useRealtimeMultiSync({
    channelName: 'student-portal-sync',
    tables: ['payment_claims', 'journal_entries', 'journal_entry_lines', 'students'],
    onDataChange: () => {
      reloadData();
    },
  });

  const handleLogout = async () => {
    await logoutUser();
    router.push('/');
  };

  const latestClaim = claimsHistory[0] || null;

  return (
    <>
      <GuestModeBanner />
      <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-12 flex flex-col justify-between">
      <div className="max-w-4xl mx-auto space-y-8 w-full flex-1">
        {/* Top Navigation Bar with Notification Bell */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 font-mono">
              Student Statement View
            </span>
            <h1 className="text-2xl font-black text-slate-900 mt-1">Student Account Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell Icon + Dropdown */}
            {studentInfo && (
              <StudentNotificationBell
                studentId={studentInfo.id}
                claims={claimsHistory}
                onClaimsSeen={() => fetchClaimsHistory(studentInfo.id)}
              />
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:block bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap flex-shrink-0 shadow-xs"
            >
              Log Out
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 animate-pulse">
            Loading student account details...
          </div>
        ) : (
          <>
            {/* Student Profile & Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Profile Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs sm:col-span-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">
                  Student Profile Details
                </div>
                <h2 className="text-lg font-black text-slate-900">{studentInfo?.name}</h2>
                <div className="mt-2.5 grid grid-cols-3 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block uppercase">Phone</span>
                    <span className="text-emerald-700 font-semibold">{studentInfo?.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase">Batch</span>
                    <span className="text-slate-800 font-semibold">{studentInfo?.batchName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase">Account Type</span>
                    <span className="text-slate-700 font-semibold">Accounts Receivable</span>
                  </div>
                </div>
              </div>

              {/* Outstanding Balance Card */}
              <div className={`border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between ${
                accountBalance !== null && accountBalance < 0
                  ? 'bg-amber-50/80 border-amber-200'
                  : 'bg-white border-slate-200'
              }`}>
                <div>
                  <div className="flex justify-between items-start">
                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 font-mono ${
                      accountBalance !== null && accountBalance < 0 ? 'text-amber-800' : 'text-emerald-800'
                    }`}>
                      {accountBalance !== null && accountBalance < 0 ? 'Credit Balance' : 'Outstanding Balance'}
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {accountBalance !== null && accountBalance < 0
                      ? `₹${Math.abs(accountBalance).toFixed(2)} Cr`
                      : `₹${(accountBalance ?? 0).toFixed(2)}`}
                  </div>
                </div>

                <div className="mt-3 space-y-2.5">
                  <span className="text-[11px] text-slate-600 block">
                    {accountBalance && accountBalance > 0
                      ? 'Current balance due to lab printing ledger.'
                      : accountBalance && accountBalance < 0
                      ? 'Credit balance on account — amount owed to you (refund due).'
                      : 'Account balance in good standing (₹0.00).'}
                  </span>

                  {/* Pay Now Button (Only shown when outstanding balance > 0) */}
                  {accountBalance !== null && accountBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsPayModalOpen(true)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 group"
                    >
                      <svg className="w-4 h-4 text-emerald-100 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Pay Now (UPI)
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Pay Now Modal */}
            {studentInfo && (
              <StudentPayNowModal
                isOpen={isPayModalOpen}
                onClose={() => setIsPayModalOpen(false)}
                studentId={studentInfo.id}
                studentName={studentInfo.name}
                outstandingBalance={accountBalance || 0}
                hasPendingClaim={latestClaim?.status === 'pending'}
                onClaimSubmitted={() => {
                  if (studentInfo.id) fetchClaimsHistory(studentInfo.id);
                }}
              />
            )}

            {/* Statement of Account Ledger Table */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-md font-bold text-slate-900">
                  Your Account Statement
                </h3>
              </div>

              {transactions.length === 0 ? (
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                  No ledger transactions posted yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-mono uppercase font-bold">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Description</th>
                        <th className="p-3 text-right">Debit</th>
                        <th className="p-3 text-right">Credit</th>
                        <th className="p-3 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 text-slate-500">{tx.date}</td>
                          <td className="p-3 text-slate-900 font-sans font-medium">{tx.description}</td>
                          <td className="p-3 text-right text-emerald-700 font-bold">
                            {tx.debit > 0 ? `₹${tx.debit.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-3 text-right text-slate-800 font-bold">
                            {tx.credit > 0 ? `₹${tx.credit.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-3 text-right text-slate-900 font-bold">
                            ₹{tx.runningBalance.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex justify-center sm:hidden">
        <button
          type="button"
          onClick={handleLogout}
          className="bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-200 text-xs font-semibold px-6 py-3 rounded-xl transition-all shadow-xs w-full max-w-xs"
        >
          Log Out
        </button>
      </div>
      <StudentPortalFooter />
    </main>
    </>
  );
}
