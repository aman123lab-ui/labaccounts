'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Batch } from '@/types/database.types';
import { getBatches } from '@/services/batchService';
import { registerStudentSingle } from '@/services/authService';
import SearchableBatchSelect from '@/components/SearchableBatchSelect';
import PasswordInput from '@/components/PasswordInput';
import StudentPortalFooter from '@/components/StudentPortalFooter';

export default function RegisterPage() {
  const router = useRouter();

  // Batches state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  // Registration State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingBatches(true);
      const bList = await getBatches();
      setBatches(bList);
      if (bList.length > 0) {
        setSelectedBatchId(bList[0].id);
      }
      setLoadingBatches(false);
    }
    load();
  }, []);

  const handleBatchCreated = (newBatch: Batch) => {
    setBatches((prev) => [...prev, newBatch]);
    setSelectedBatchId(newBatch.id);
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setRegError(null);
    setRegSuccess(false);

    try {
      const res = await registerStudentSingle({
        name: fullName,
        phone,
        password,
        batchId: selectedBatchId,
      });

      if (res.success) {
        setRegSuccess(true);
        setTimeout(() => {
          router.push('/student');
        }, 1500);
      } else {
        setRegError(res.error || 'Registration failed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setRegError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 py-12 px-4 sm:px-8 flex flex-col items-center justify-between">
      <div className="w-full max-w-xl flex-1">
        {/* Header Navigation */}
        <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 font-mono">
              Student Portal
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Student Self-Registration</h1>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Login
          </Link>
        </div>

        {/* SINGLE REGISTRATION FORM */}
        <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Create Student Account</h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your details to register as a student and provision your dedicated ledger account.
            </p>
          </div>

          {regError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
              {regError}
            </div>
          )}

          {regSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Student registered successfully! Redirecting to student dashboard...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Field 1: Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Enter your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition-all"
              />
            </div>

            {/* Field 2: Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                required
                placeholder="Enter your phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition-all"
              />
            </div>

            {/* Field 3: Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <PasswordInput
                required
                placeholder="Create your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                focusColor="emerald"
                variant="light"
                className="py-3"
              />
            </div>

            {/* Field 4: Batch */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Batch
              </label>
              {loadingBatches ? (
                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 animate-pulse">
                  Loading available batches...
                </div>
              ) : (
                <SearchableBatchSelect
                  batches={batches}
                  selectedBatchId={selectedBatchId}
                  onChange={(bId) => setSelectedBatchId(bId)}
                  onBatchCreated={handleBatchCreated}
                  onBatchDeleted={(deletedId) => {
                    setBatches((prev) => prev.filter((b) => b.id !== deletedId));
                    if (selectedBatchId === deletedId) setSelectedBatchId('');
                  }}
                  onBatchesUpdated={async () => {
                    const list = await getBatches();
                    setBatches(list);
                  }}
                  variant="light"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || loadingBatches}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 mt-4 text-sm"
            >
              {submitting ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Register Student'
              )}
            </button>
          </form>
        </div>
      </div>

      <StudentPortalFooter />
    </main>
  );
}
