'use client';

import React, { useState, useEffect } from 'react';
import { useRealtimeMultiSync } from '@/hooks/useRealtimeSync';
import AddStudentModal from '@/components/AddStudentModal';
import BulkStudentImportModal from '@/components/BulkStudentImportModal';
import ConfirmModal from '@/components/ConfirmModal';
import SearchableBatchSelect from '@/components/SearchableBatchSelect';
import PasswordInput from '@/components/PasswordInput';
import { Batch } from '@/types/database.types';
import { getBatches } from '@/services/batchService';
import {
  getStudents,
  StudentWithDetails,
  updateStudent,
  resetStudentPassword,
  archiveStudent,
  restoreStudent,
} from '@/services/studentService';

export default function AllStudentsPage() {
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBatchId, setFilterBatchId] = useState('all');
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Student Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Archive Confirmation Modal State
  const [archiveTargetStudent, setArchiveTargetStudent] = useState<StudentWithDetails | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Edit Modal State
  const [editingStudent, setEditingStudent] = useState<StudentWithDetails | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBatchId, setEditBatchId] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Reset Password Modal State
  const [passwordStudent, setPasswordStudent] = useState<StudentWithDetails | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const fetchStudentList = async () => {
    setLoading(true);
    const list = await getStudents({ status: statusFilter, search: searchTerm });
    setStudents(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchStudentList();
  }, [statusFilter, searchTerm]);

  useRealtimeMultiSync({
    channelName: 'admin-students-sync',
    tables: ['students', 'journal_entries', 'journal_entry_lines', 'batches'],
    onDataChange: () => {
      fetchStudentList();
    },
  });

  useEffect(() => {
    async function loadBatches() {
      const bList = await getBatches();
      setBatches(bList);
    }
    loadBatches();
  }, []);

  // Open Edit Modal
  const handleOpenEdit = (student: StudentWithDetails) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditPhone(student.phone);
    setEditBatchId(student.batch_id);
    setEditError(null);
  };

  // Submit Edit Form
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setEditSaving(true);
    setEditError(null);

    const res = await updateStudent(editingStudent.id, {
      name: editName,
      phone: editPhone,
      batch_id: editBatchId,
    });

    if (res.success) {
      setEditingStudent(null);
      fetchStudentList();
    } else {
      setEditError(res.error || 'Failed to update student.');
    }
    setEditSaving(false);
  };

  // Open Reset Password Modal
  const handleOpenPasswordReset = (student: StudentWithDetails) => {
    setPasswordStudent(student);
    setNewPassword('');
    setPasswordError(null);
    setPasswordSuccess(false);
  };

  // Submit Password Reset
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordStudent) return;

    setPasswordSaving(true);
    setPasswordError(null);

    const res = await resetStudentPassword(passwordStudent.id, newPassword);

    if (res.success) {
      setPasswordSuccess(true);
      setTimeout(() => {
        setPasswordStudent(null);
      }, 1200);
    } else {
      setPasswordError(res.error || 'Failed to reset password.');
    }
    setPasswordSaving(false);
  };

  // Handle Soft Delete (Archive)
  const handleArchive = (student: StudentWithDetails) => {
    setArchiveTargetStudent(student);
  };

  // Handle Restore
  const handleRestore = async (student: StudentWithDetails) => {
    await restoreStudent(student.id);
    fetchStudentList();
  };

  const sortedStudents = [...students]
    .filter((s) => filterBatchId === 'all' || s.batch_id === filterBatchId)
    .sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

  return (
    <>
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 space-y-6 flex-1">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Student Ledger Directory</h1>
              {!loading && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                  {sortedStudents.length} Total
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage student profiles, view live signed balances, edit details, reset passwords, or soft-archive records.
            </p>
          </div>

          {/* Action Buttons: Bulk Import (CSV) & Add Student */}
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Bulk Register (CSV)
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Student
            </button>
          </div>
        </div>

        {/* Filter Controls: Search & Active/Archived Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Live Search Bar, Filter Dropdown */}
          <div className="flex flex-1 max-w-3xl gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <select
              value={filterBatchId}
              onChange={(e) => setFilterBatchId(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 font-semibold shrink-0 cursor-pointer max-w-[160px] truncate"
            >
              <option value="all">Filter: All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Active vs Archived Filter Toggle */}
          <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'active'
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Students
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('archived')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'archived'
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Archived Students
            </button>
          </div>
        </div>

        {/* STUDENT DIRECTORY TABLE */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
              Loading student ledger records...
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <div className="text-sm font-semibold text-slate-700">No students found</div>
              <p className="text-xs text-slate-500">
                {searchTerm
                  ? `No students matching "${searchTerm}".`
                  : `There are currently no ${statusFilter} students in the directory.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Batch</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4 text-right">Current Balance</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {sortedStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-sans font-semibold text-slate-900 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-emerald-700 font-bold">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{student.name}</div>
                          {student.status === 'archived' && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-red-50 text-red-700 border border-red-200 rounded font-mono font-bold">
                              ARCHIVED
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-slate-700">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-xs whitespace-nowrap inline-flex font-semibold">
                          {student.batch_name}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">{student.phone}</td>
                      <td className="p-4 text-right font-bold">
                        {student.balance > 0 ? (
                          <span className="text-emerald-700 font-extrabold">
                            ₹{student.balance.toFixed(2)} Dr
                          </span>
                        ) : student.balance < 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="text-amber-700 font-extrabold">
                              ₹{Math.abs(student.balance).toFixed(2)} Cr
                            </span>
                            <span className="text-[10px] text-amber-800 font-sans font-semibold">
                              Refund Due
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">₹0.00</span>
                        )}
                      </td>
                      <td className="p-4 min-w-[240px]">
                        <div className="flex items-center justify-center gap-1.5 font-sans flex-wrap sm:flex-nowrap">
                          {student.status === 'active' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(student)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0"
                                title="Edit Student Name, Phone, or Batch"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenPasswordReset(student)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0"
                                title="Reset Student Password"
                              >
                                Reset Password
                              </button>
                              <button
                                type="button"
                                onClick={() => handleArchive(student)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0"
                                title="Soft Delete Student (Archive record)"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRestore(student)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* REUSED ADD STUDENT MODAL (PHASE 2 SINGLE REGISTRATION) */}
      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onStudentAdded={fetchStudentList}
      />

      {/* BULK CSV IMPORT MODAL (ADMIN ONLY) */}
      <BulkStudentImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onStudentsImported={fetchStudentList}
      />

      {/* EDIT STUDENT MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xl overflow-visible relative">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">
              Edit Student Details
            </h3>

            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Batch
                </label>
                <SearchableBatchSelect
                  batches={batches}
                  selectedBatchId={editBatchId}
                  onChange={(bId) => setEditBatchId(bId)}
                  onBatchCreated={(newB) => {
                    setBatches((prev) => [...prev, newB]);
                    setEditBatchId(newB.id);
                  }}
                  onBatchDeleted={(deletedId) => {
                    setBatches((prev) => prev.filter((b) => b.id !== deletedId));
                    if (editBatchId === deletedId) setEditBatchId('');
                  }}
                  onBatchesUpdated={async () => {
                    const list = await getBatches();
                    setBatches(list);
                  }}
                  allowManagement={true}
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 rounded-xl text-xs shadow-xs disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {passwordStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">
              Reset Password for {passwordStudent.name}
            </h3>

            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold">
                Password reset successfully!
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <PasswordInput
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  focusColor="blue"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPasswordStudent(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 rounded-xl text-xs shadow-xs disabled:opacity-50"
                >
                  {passwordSaving ? 'Updating...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Responsive Confirmation Modal for Soft Archive */}
      <ConfirmModal
        isOpen={!!archiveTargetStudent}
        title="Soft Archive Student"
        message={`Are you sure you want to soft-archive "${archiveTargetStudent?.name}"? Their double-entry ledger history and balance will remain permanently preserved.`}
        confirmLabel="Archive Student"
        cancelLabel="Keep Active"
        variant="danger"
        loading={archiveLoading}
        onCancel={() => setArchiveTargetStudent(null)}
        onConfirm={async () => {
          if (!archiveTargetStudent) return;
          setArchiveLoading(true);
          await archiveStudent(archiveTargetStudent.id);
          setArchiveLoading(false);
          setArchiveTargetStudent(null);
          fetchStudentList();
        }}
      />
    </>
  );
}
