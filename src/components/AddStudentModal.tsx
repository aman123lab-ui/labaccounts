'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Batch } from '@/types/database.types';
import { getBatches } from '@/services/batchService';
import { registerStudentSingle } from '@/services/authService';
import SearchableBatchSelect from '@/components/SearchableBatchSelect';
import PasswordInput from '@/components/PasswordInput';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded: () => void;
}

export default function AddStudentModal({ isOpen, onClose, onStudentAdded }: AddStudentModalProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      async function load() {
        setLoadingBatches(true);
        const list = await getBatches();
        setBatches(list);
        if (list.length > 0 && !selectedBatchId) {
          setSelectedBatchId(list[0].id);
        }
        setLoadingBatches(false);
      }
      load();
    }
  }, [isOpen]);

  const handleBatchCreated = (newBatch: Batch) => {
    setBatches((prev) => [...prev, newBatch]);
    setSelectedBatchId(newBatch.id);
  };

  const handleBatchDeleted = (deletedId: string) => {
    setBatches((prev) => prev.filter((b) => b.id !== deletedId));
    if (selectedBatchId === deletedId) {
      setSelectedBatchId('');
    }
  };

  const handleBatchesUpdated = async () => {
    const list = await getBatches();
    setBatches(list);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await registerStudentSingle({
        name: fullName,
        phone,
        password,
        batchId: selectedBatchId,
      });

      if (res.success) {
        setFullName('');
        setPhone('');
        setPassword('');
        onStudentAdded();
        onClose();
      } else {
        setError(res.error || 'Failed to add student.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-visible p-6 space-y-6 relative"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Add New Student</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Single student registration and ledger account creation.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="p-3.5 bg-red-950/60 border border-red-800/60 rounded-xl text-xs text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <PasswordInput
                  required
                  placeholder="Create your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  focusColor="emerald"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Batch
                </label>
                {loadingBatches ? (
                  <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-400 animate-pulse">
                    Loading batches...
                  </div>
                ) : (
                  <SearchableBatchSelect
                    batches={batches}
                    selectedBatchId={selectedBatchId}
                    onChange={(bId) => setSelectedBatchId(bId)}
                    onBatchCreated={handleBatchCreated}
                    onBatchDeleted={handleBatchDeleted}
                    onBatchesUpdated={handleBatchesUpdated}
                    allowManagement={true}
                  />
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || loadingBatches}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {submitting ? 'Adding...' : 'Add Student'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
