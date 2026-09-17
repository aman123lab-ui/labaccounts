'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Batch } from '@/types/database.types';
import { getBatches } from '@/services/batchService';
import { updateStudent } from '@/services/studentService';
import SearchableBatchSelect from '@/components/SearchableBatchSelect';

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentEdited: () => void;
  student: any;
}

export default function EditStudentModal({ isOpen, onClose, onStudentEdited, student }: EditStudentModalProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBatches();
      if (student) {
        setFullName(student.name || '');
        setPhone(student.phone || '');
        setSelectedBatchId(student.batch_id || '');
      }
    } else {
      setError(null);
    }
  }, [isOpen, student]);

  const loadBatches = async () => {
    setLoadingBatches(true);
    try {
      const data = await getBatches();
      setBatches(data);
    } catch (err) {
      console.error('Error loading batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !phone.trim() || !selectedBatchId) {
      setError('Please fill in all fields (Name, Phone, Batch).');
      return;
    }
    
    if (!student || !student.id) {
       setError('Invalid student record.');
       return;
    }

    setSubmitting(true);

    try {
      const result = await updateStudent(student.id, {
        name: fullName,
        phone,
        batch_id: selectedBatchId,
      });

      if (!result.success) {
        setError(result.error || 'Failed to update student.');
      } else {
        onStudentEdited();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={!submitting ? onClose : undefined}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Edit Student Details</h2>
              <button
                onClick={onClose}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl flex gap-2 items-start">
                    <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900"
                    placeholder="e.g. John Doe"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900"
                    placeholder="e.g. 9876543210"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Batch Allocation
                  </label>
                  <SearchableBatchSelect
                    batches={batches}
                    selectedBatchId={selectedBatchId}
                    onChange={setSelectedBatchId}
                    
                    placeholder={loadingBatches ? "Loading batches..." : "Search and select a batch"}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-[2] px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
