'use client';

import React, { useState, useEffect } from 'react';
import { useRealtimeMultiSync } from '@/hooks/useRealtimeSync';
import {
  CashHandoverClaim,
  getAllPendingHandoverClaims,
  getInchargeHandoverHistory,
  verifyCashHandoverClaim,
  rejectCashHandoverClaim,
} from '@/services/cashHandoverService';
import { formatDate } from '@/utils/formatDate';
import PasswordInput from '@/components/PasswordInput';
import {
  isGuestMode,
  getDemoInchargeStaff,
  addDemoInchargeStaff,
  updateDemoInchargeStaff,
  deleteDemoInchargeStaff,
  getDemoJournalEntries,
} from '@/lib/demo/demoStore';

export interface StaffItem {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  staff_id?: string;
  status: 'active' | 'archived';
  created_at: string;
  cash_in_hand: number;
}

export default function AdminInchargeManagementPage() {
  const [activeTab, setActiveTab] = useState<'staff' | 'pending' | 'history'>('staff');
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [claims, setClaims] = useState<CashHandoverClaim[]>([]);
  const [historyClaims, setHistoryClaims] = useState<CashHandoverClaim[]>([]);
  const [totalCashInHand, setTotalCashInHand] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Alert Notifications
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal 1: Add In-Charge Staff Modal
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [submittingAddStaff, setSubmittingAddStaff] = useState(false);
  const [addStaffError, setAddStaffError] = useState<string | null>(null);

  // Modal 2: Reset Password Modal
  const [resetStaff, setResetStaff] = useState<StaffItem | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [submittingReset, setSubmittingReset] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Modal 3: Edit Staff Name Modal
  const [editStaff, setEditStaff] = useState<StaffItem | null>(null);
  const [editName, setEditName] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Modal 4: Delete Staff Modal
  const [deletingStaff, setDeletingStaff] = useState<StaffItem | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Handover Verification & Rejection Modals
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [verifyingClaim, setVerifyingClaim] = useState<CashHandoverClaim | null>(null);
  const [rejectingClaim, setRejectingClaim] = useState<CashHandoverClaim | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      if (isGuestMode()) {
        const demoStaff = getDemoInchargeStaff();
        const pending = await getAllPendingHandoverClaims();
        const allHistory = await getInchargeHandoverHistory('ALL');

        // Calculate guest mode cash in hand
        const demoEntries = getDemoJournalEntries();
        const inchargeCashAccountId = '10000000-0000-0000-0000-000000000003';

        let globalNet = 0;
        demoEntries.forEach((e) => {
          if (e.voided_at) return;
          e.lines.forEach((l) => {
            if (l.account_id === inchargeCashAccountId) {
              globalNet += (l.debit_amount || 0) - (l.credit_amount || 0);
            }
          });
        });

        const formattedStaff: StaffItem[] = demoStaff.map((s, idx) => ({
          id: s.id,
          user_id: s.user_id,
          name: s.name,
          email: s.email,
          staff_id: (s as any).staff_id || '4821',
          status: s.status,
          created_at: s.created_at,
          cash_in_hand: idx === 0 ? Math.max(0, globalNet) : 0,
        }));

        setStaffList(formattedStaff);
        setClaims(pending);
        setHistoryClaims(allHistory.filter((c) => c.status !== 'pending'));
        setTotalCashInHand(Math.max(0, globalNet));
      } else {
        // Production mode: fetch from API
        const [resIncharge, pending, allHistory] = await Promise.all([
          fetch('/api/admin/incharge').then((r) => r.json()),
          getAllPendingHandoverClaims(),
          getInchargeHandoverHistory('ALL'),
        ]);

        if (resIncharge.success) {
          setStaffList(resIncharge.staffList || []);
          setTotalCashInHand(resIncharge.totalCashInHandAcrossAllStaff || 0);
        }

        setClaims(pending || []);
        setHistoryClaims((allHistory || []).filter((c) => c.status !== 'pending'));
      }
    } catch (err) {
      console.error('Failed to load In-Charge management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeMultiSync({
    channelName: 'admin-cash-handovers-sync',
    tables: ['incharge_profiles', 'cash_handover_claims', 'journal_entries', 'journal_entry_lines'],
    onDataChange: () => {
      loadData();
    },
  });

  // Handle Add Staff Submit
  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStaffError(null);

    if (!addName.trim()) {
      setAddStaffError('Full Name is required.');
      return;
    }
    if (!addEmail.trim()) {
      setAddStaffError('Email address is required.');
      return;
    }
    if (!addPassword || addPassword.length < 6) {
      setAddStaffError('Password must be at least 6 characters long.');
      return;
    }

    setSubmittingAddStaff(true);

    try {
      if (isGuestMode()) {
        const res = addDemoInchargeStaff({ name: addName, email: addEmail, password: addPassword });
        if (res.success) {
          setActionSuccess(`Workforce member account '${addName}' created successfully! Credentials: ${addEmail}`);
          setIsAddStaffModalOpen(false);
          setAddName('');
          setAddEmail('');
          setAddPassword('');
          await loadData();
        } else {
          setAddStaffError(res.error || 'Failed to create staff account.');
        }
      } else {
        const res = await fetch('/api/admin/incharge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: addName, email: addEmail, password: addPassword }),
        }).then((r) => r.json());

        if (res.success) {
          setActionSuccess(`Workforce member account '${addName}' created successfully! Workforce members can now log in at the main login portal.`);
          setIsAddStaffModalOpen(false);
          setAddName('');
          setAddEmail('');
          setAddPassword('');
          await loadData();
        } else {
          setAddStaffError(res.error || 'Failed to create staff account.');
        }
      }
    } catch (err: any) {
      setAddStaffError(err?.message || 'Error creating staff account.');
    } finally {
      setSubmittingAddStaff(false);
    }
  };

  // Handle Password Reset Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStaff) return;
    setResetError(null);

    if (!resetPassword || resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      return;
    }

    setSubmittingReset(true);

    try {
      if (isGuestMode()) {
        setActionSuccess(`Password for ${resetStaff.name} reset successfully (Demo Mode).`);
        setResetStaff(null);
        setResetPassword('');
      } else {
        const res = await fetch('/api/admin/incharge', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: resetStaff.user_id || resetStaff.id,
            email: resetStaff.email,
            action: 'reset_password',
            newPassword: resetPassword,
          }),
        }).then((r) => r.json());

        if (res.success) {
          setActionSuccess(`Password for ${resetStaff.name} updated successfully!`);
          setResetStaff(null);
          setResetPassword('');
        } else {
          setResetError(res.error || 'Failed to reset password.');
        }
      }
    } catch (err: any) {
      setResetError(err?.message || 'Error updating password.');
    } finally {
      setSubmittingReset(false);
    }
  };

  // Handle Edit Staff Name Submit
  const handleEditNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaff || !editName.trim()) return;

    setSubmittingEdit(true);
    try {
      if (isGuestMode()) {
        updateDemoInchargeStaff(editStaff.id, { name: editName });
        setActionSuccess(`Workforce member updated to '${editName}'.`);
        setEditStaff(null);
        await loadData();
      } else {
        const res = await fetch('/api/admin/incharge', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: editStaff.user_id || editStaff.id,
            email: editStaff.email,
            action: 'update_profile',
            name: editName,
          }),
        }).then((r) => r.json());

        if (res.success) {
          setActionSuccess(`Workforce member name updated to '${editName}'.`);
          setEditStaff(null);
          await loadData();
        } else {
          setActionError(res.error || 'Failed to update staff name.');
        }
      }
    } catch (err: any) {
      setActionError(err?.message || 'Update error.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Handle Delete Staff Submit
  const handleDeleteStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingStaff) return;

    setSubmittingDelete(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      if (isGuestMode()) {
        const res = deleteDemoInchargeStaff(deletingStaff.id);
        if (res.success) {
          setActionSuccess(`Workforce member '${deletingStaff.name}' deleted successfully.`);
          setDeletingStaff(null);
          await loadData();
        } else {
          setActionError(res.error || 'Failed to delete workforce member.');
        }
      } else {
        const res = await fetch(
          `/api/admin/incharge?userId=${deletingStaff.user_id || deletingStaff.id}&email=${encodeURIComponent(deletingStaff.email)}`,
          { method: 'DELETE' }
        ).then((r) => r.json());

        if (res.success) {
          setActionSuccess(`Workforce member '${deletingStaff.name}' deleted successfully.`);
          setDeletingStaff(null);
          await loadData();
        } else {
          setActionError(res.error || 'Failed to delete workforce member.');
        }
      }
    } catch (err: any) {
      setActionError(err?.message || 'Error deleting workforce member.');
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Handle Verify Confirmation Submit
  const handleConfirmVerify = async () => {
    if (!verifyingClaim) return;
    setProcessingId(verifyingClaim.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await verifyCashHandoverClaim(verifyingClaim.id, 'Admin');
      if (res.success) {
        setActionSuccess(
          `Cash handover claim of ₹${Number(verifyingClaim.claimed_amount).toFixed(
            2
          )} from ${verifyingClaim.incharge_name || 'Workforce Member'} verified! Journal entry posted.`
        );
        setVerifyingClaim(null);
        await loadData();
      } else {
        setActionError(res.error || 'Failed to verify cash handover claim.');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Verification error.');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Reject Submit
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingClaim) return;

    setProcessingId(rejectingClaim.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await rejectCashHandoverClaim(rejectingClaim.id, rejectNote, 'Admin');
      if (res.success) {
        setActionSuccess(
          `Cash handover claim of ₹${Number(rejectingClaim.claimed_amount).toFixed(
            2
          )} rejected.`
        );
        setRejectingClaim(null);
        setRejectNote('');
        await loadData();
      } else {
        setActionError(res.error || 'Failed to reject cash handover claim.');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Rejection error.');
    } finally {
      setProcessingId(null);
    }
  };

  const totalPendingAmount = claims.reduce((sum, c) => sum + Number(c.claimed_amount || 0), 0);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-1 w-full min-w-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight break-words">
            Workforce & Collections
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed text-wrap">
            Manage workforce member accounts, monitor individual cash-in-hand balances, and verify physical cash handovers.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setAddName('');
              setAddEmail('');
              setAddPassword('');
              setAddStaffError(null);
              setIsAddStaffModalOpen(true);
            }}
            className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Workforce Member</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 shrink-0"
          >
            <svg
              className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium p-4 rounded-xl flex items-center justify-between shadow-xs min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="break-words min-w-0">{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800 text-sm shrink-0 ml-2">×</button>
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium p-4 rounded-xl flex items-center justify-between shadow-xs min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="break-words min-w-0">{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="text-red-600 hover:text-red-800 text-sm shrink-0 ml-2">×</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0">
        {/* KPI 1: Total Cash in Hand Across All Staff */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between min-w-0">
          <div className="min-w-0 pr-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">Total Outstanding Cash in Hand</span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 flex items-center gap-0.5 truncate">
              <span className="font-sans">₹</span>
              <span className="font-mono">{totalCashInHand.toFixed(2)}</span>
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block leading-tight text-wrap">Combined physical cash held across all workforce members</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xl font-mono shrink-0">
            <span className="font-sans">₹</span>
          </div>
        </div>

        {/* KPI 2: Active In-Charge Staff Count */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between min-w-0">
          <div className="min-w-0 pr-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">Workforce Counter Members</span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block truncate">{staffList.length}</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block leading-tight text-wrap">Registered counter personnel with portal access</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </div>

        {/* KPI 3: Pending Handover Claims */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between min-w-0">
          <div className="min-w-0 pr-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">Pending Handover Claims</span>
            <span className="text-2xl font-black text-amber-700 font-mono mt-1 flex items-center gap-1 truncate">
              <span>{claims.length}</span>
              <span className="text-xs font-normal text-slate-500 inline-flex items-center gap-0.5">
                (
                <span className="font-sans">₹</span>
                <span className="font-mono">{totalPendingAmount.toFixed(2)}</span>
                )
              </span>
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block leading-tight text-wrap">Awaiting admin physical count verification</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold text-xl font-mono shrink-0">
            {claims.length}
          </div>
        </div>
      </div>

      {/* Main Tab Controls */}
      <div className="flex bg-slate-100 border border-slate-200 p-1.5 rounded-2xl w-full sm:w-fit gap-1 overflow-x-auto max-w-full min-w-0">
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`py-2 px-5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'staff'
              ? 'bg-slate-900 text-white shadow-xs border border-slate-900'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Workforce Roster ({staffList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`py-2 px-5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'pending'
              ? 'bg-slate-900 text-white shadow-xs border border-slate-900'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Pending Handovers</span>
          {claims.length > 0 && (
            <span className="bg-amber-100 text-amber-800 border border-amber-200 font-bold text-[10px] px-1.5 py-0.2 rounded-full">
              {claims.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`py-2 px-5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-slate-900 text-white shadow-xs border border-slate-900'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Verification History ({historyClaims.length})
        </button>
      </div>

      {/* Tab 1: Staff Roster Table */}
      {activeTab === 'staff' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-4 p-4 sm:p-5 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Workforce Roster</h2>
              <p className="text-xs text-slate-500">List of counter workforce members and their personal cash-in-hand balances.</p>
            </div>
          </div>

          {staffList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono bg-slate-50 rounded-xl border border-slate-200">
              No workforce members created yet. Click "Add Workforce Member" to create one.
            </div>
          ) : (
            <>
              {/* MOBILE CARDS VIEW (md:hidden) */}
              <div className="space-y-3 md:hidden">
                {staffList.map((staff) => (
                  <div
                    key={staff.id}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs"
                  >
                    {/* Header: Name, Staff ID & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0 mt-0.5">
                          {staff.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-extrabold text-slate-900 text-sm block leading-snug break-words">
                            {staff.name}
                          </span>
                          {staff.staff_id && (
                            <span className="text-[11px] font-mono text-indigo-700 font-medium block mt-0.5">
                              ID: #{staff.staff_id}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase font-mono px-2.5 py-0.5 rounded-full shrink-0">
                        {staff.status}
                      </span>
                    </div>

                    {/* Email / Login ID */}
                    <div className="text-xs font-mono text-slate-600 break-all bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Login Email</span>
                      <span className="text-slate-900">{staff.email}</span>
                    </div>

                    {/* Cash-in-Hand Balance Box */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Cash in Hand</span>
                      <span className="text-lg font-black text-emerald-700 font-mono flex items-center gap-0.5">
                        <span className="font-sans">₹</span>
                        <span className="font-mono">{staff.cash_in_hand.toFixed(2)}</span>
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-200 flex items-stretch justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditStaff(staff);
                          setEditName(staff.name);
                        }}
                        className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center text-center"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setResetStaff(staff);
                          setResetPassword('');
                          setResetError(null);
                        }}
                        className="flex-[1.2] bg-white hover:bg-slate-50 text-indigo-700 border border-slate-200 text-xs font-semibold py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center text-center leading-tight"
                      >
                        Reset<br />Password
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingStaff(staff)}
                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold py-1.5 px-2.5 rounded-lg transition-colors flex items-center justify-center text-center shrink-0"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE VIEW (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5 font-bold">Workforce Member</th>
                      <th className="px-5 py-3.5 font-bold">Email / Login ID</th>
                      <th className="px-5 py-3.5 font-bold">Status</th>
                      <th className="px-5 py-3.5 font-bold text-right">Cash in Hand</th>
                      <th className="px-5 py-3.5 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {staffList.map((staff) => (
                      <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                              {staff.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-extrabold text-slate-900 text-xs block break-words">
                                {staff.name}
                              </span>
                              {staff.staff_id && (
                                <span className="text-[10px] font-mono text-indigo-700 block mt-0.5 font-semibold">
                                  ID: #{staff.staff_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 font-mono text-slate-700 break-all">
                          {staff.email}
                        </td>

                        <td className="px-5 py-3.5">
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10px] font-bold uppercase font-mono px-2.5 py-0.5 rounded-full">
                            {staff.status}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900 text-sm">
                          <span className="font-sans font-bold">₹</span>
                          <span className="font-mono font-extrabold">{staff.cash_in_hand.toFixed(2)}</span>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditStaff(staff);
                                setEditName(staff.name);
                              }}
                              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setResetStaff(staff);
                                setResetPassword('');
                                setResetError(null);
                              }}
                              className="bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                            >
                              Reset Password
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingStaff(staff)}
                              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Pending Handovers */}
      {activeTab === 'pending' && (
        loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-500 font-mono">Fetching cash handover claims...</p>
          </div>
        ) : claims.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-700 font-bold">
              ✓
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Pending Cash Handovers</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              All workforce cash collections have been verified and transferred to the main organization Cash account.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-slate-300 transition-colors min-w-0"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-emerald-700 uppercase font-bold tracking-wider block">
                        Workforce Member
                      </span>
                      <h3 className="text-lg font-extrabold text-slate-900 truncate">
                        {claim.incharge_name || 'Workforce Member'}
                      </h3>
                      <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                        Submitted: {formatDate(claim.claimed_at)}
                      </span>
                    </div>
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase font-mono px-2.5 py-1 rounded-full animate-pulse shrink-0">
                      Pending Verification
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between min-w-0">
                    <span className="text-xs font-bold text-slate-600">Physical Cash Claimed</span>
                    <span className="text-xl font-black text-emerald-700 font-mono flex items-center gap-0.5">
                      <span className="font-sans">₹</span>
                      <span className="font-mono">{Number(claim.claimed_amount).toFixed(2)}</span>
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setVerifyingClaim(claim)}
                    disabled={processingId === claim.id}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
                  >
                    {processingId === claim.id ? (
                      <span>Processing...</span>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Verify & Transfer Cash</span>
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
                    className="bg-slate-100 hover:bg-red-50 hover:text-red-700 border border-slate-200 text-slate-700 font-semibold text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Tab 3: History */}
      {activeTab === 'history' && (
        historyClaims.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2">
            <p className="text-xs text-slate-500">No handover verification history recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs bg-white">
            <table className="w-full text-left text-xs font-mono min-w-[640px]">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase">
                <tr>
                  <th className="p-3.5">Workforce Member</th>
                  <th className="p-3.5">Claimed Amount</th>
                  <th className="p-3.5">Submitted Date</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Verified / Action Date</th>
                  <th className="p-3.5">Admin Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {historyClaims.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-sans font-bold text-slate-900">
                      {item.incharge_name || item.incharge_id}
                    </td>
                    <td className="p-3.5 font-bold text-emerald-700 flex items-center gap-0.5">
                      <span className="font-sans">₹</span>
                      <span className="font-mono">{Number(item.claimed_amount).toFixed(2)}</span>
                    </td>
                    <td className="p-3.5 text-slate-600">{formatDate(item.claimed_at)}</td>
                    <td className="p-3.5">
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          item.status === 'verified'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {item.verified_at ? formatDate(item.verified_at) : '-'}
                    </td>
                    <td className="p-3.5 text-slate-600 font-sans italic">
                      {item.admin_note || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* MODAL 1: ADD IN-CHARGE STAFF MODAL */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddStaffSubmit}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Add New Workforce Member</h3>
                <p className="text-xs text-slate-500">Create login credentials for workforce personnel</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStaffModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            {addStaffError && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-semibold">
                {addStaffError}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Sarah Connor"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Workforce Email Address (Login ID)
              </label>
              <input
                type="email"
                required
                placeholder="e.g. sarah@lab.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Initial Password
              </label>
              <PasswordInput
                required
                placeholder="Set password (min 6 chars)"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                focusColor="emerald"
                className="py-2.5"
              />
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsAddStaffModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 px-4 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAddStaff}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
              >
                {submittingAddStaff ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: RESET PASSWORD MODAL */}
      {resetStaff && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleResetPasswordSubmit}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Reset Workforce Password</h3>
                <p className="text-xs text-slate-500">Update password for {resetStaff.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setResetStaff(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            {resetError && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-semibold">
                {resetError}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                New Password
              </label>
              <PasswordInput
                required
                placeholder="Enter new password (min 6 chars)"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                focusColor="emerald"
                className="py-2.5"
              />
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setResetStaff(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 px-4 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReset}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs"
              >
                {submittingReset ? 'Resetting...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: EDIT STAFF NAME MODAL */}
      {editStaff && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleEditNameSubmit}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Edit Workforce Member Details</h3>
                <p className="text-xs text-slate-500">Update full name for {editStaff.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditStaff(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditStaff(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 px-4 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingEdit}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs"
              >
                {submittingEdit ? 'Saving...' : 'Save Name'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: DELETE IN-CHARGE STAFF CONFIRMATION MODAL */}
      {deletingStaff && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleDeleteStaffSubmit}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-slate-900"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center font-black shrink-0">
                  ✕
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Delete Workforce Member</h3>
                  <p className="text-xs text-slate-500">Confirm removal of workforce account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingStaff(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <p><span className="text-slate-500 font-medium">Name:</span> <strong className="text-slate-900">{deletingStaff.name}</strong></p>
              <p><span className="text-slate-500 font-medium">Email:</span> <span className="font-mono text-slate-700">{deletingStaff.email}</span></p>
              {deletingStaff.staff_id && (
                <p><span className="text-slate-500 font-medium">Staff ID:</span> <span className="font-mono text-indigo-700 font-bold">#{deletingStaff.staff_id}</span></p>
              )}
            </div>

            <p className="text-xs text-red-700 leading-relaxed bg-red-50 border border-red-200 p-3 rounded-xl">
              Are you sure you want to delete this workforce member? Their login account and profile will be removed.
            </p>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeletingStaff(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 px-4 rounded-xl transition-all"
                disabled={submittingDelete}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs"
              >
                {submittingDelete ? 'Deleting...' : 'Delete Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VERIFICATION CONFIRMATION MODAL */}
      {verifyingClaim && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5 text-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-xl font-black">
                ✓
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Confirm Cash Transfer</h3>
                <p className="text-xs text-slate-500">Physical Cash Handover Verification</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Workforce Member:</span>
                <span className="text-slate-900 font-bold font-sans">{verifyingClaim.incharge_name}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Amount:</span>
                <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                  <span className="font-sans">₹</span>
                  <span className="font-mono">{Number(verifyingClaim.claimed_amount).toFixed(2)}</span>
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 font-sans">
                Posting transfer journal entry:
                <div className="text-emerald-700 font-mono mt-1 font-semibold flex items-center gap-0.5">
                  <span>Lab Cash Account (Dr)</span>
                  <span className="font-sans">₹</span>
                  <span>{Number(verifyingClaim.claimed_amount).toFixed(2)}</span>
                </div>
                <div className="text-blue-700 font-mono font-semibold flex items-center gap-0.5">
                  <span>Cash in Hand (In-Charge: {verifyingClaim.incharge_name || 'Staff'}) (Cr)</span>
                  <span className="font-sans">₹</span>
                  <span>{Number(verifyingClaim.claimed_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVerifyingClaim(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 px-4 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVerify}
                disabled={processingId === verifyingClaim.id}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs"
              >
                {processingId === verifyingClaim.id ? 'Posting Transfer...' : 'Confirm Verification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectingClaim && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmReject}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5 text-slate-900 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center text-xl font-black">
                ✕
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Reject Cash Handover</h3>
                <p className="text-xs text-slate-500">Provide an optional reason for the workforce member</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono flex justify-between text-slate-700">
                <span>Claimed Amount:</span>
                <span className="font-bold text-red-700 flex items-center gap-0.5">
                  <span className="font-sans">₹</span>
                  <span className="font-mono">{Number(rejectingClaim.claimed_amount).toFixed(2)}</span>
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Rejection Reason / Admin Note (Optional)
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="e.g. Physical cash count mismatch: received ₹450 instead of ₹500"
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingClaim(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 px-4 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingId === rejectingClaim.id}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs"
              >
                {processingId === rejectingClaim.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
