'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Batch } from '@/types/database.types';
import {
  sortBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  inferCategory,
} from '@/services/batchService';
import { createClient } from '@/lib/supabase/client';
import { isGuestMode, getDemoStudents } from '@/lib/demo/demoStore';

interface SearchableBatchSelectProps {
  batches: Batch[];
  selectedBatchId: string;
  onChange: (batchId: string) => void;
  onBatchCreated?: (newBatch: Batch) => void;
  onBatchDeleted?: (deletedBatchId: string) => void;
  onBatchesUpdated?: () => void;
  placeholder?: string;
  allowManagement?: boolean; // Default: false. Set to true ONLY for admin forms
  allowManage?: boolean; // Alias for allowManagement
  size?: 'sm' | 'md'; // Default: 'md'
}

export default function SearchableBatchSelect({
  batches,
  selectedBatchId,
  onChange,
  onBatchCreated,
  onBatchDeleted,
  onBatchesUpdated,
  placeholder = 'Select a Batch...',
  allowManagement = false,
  allowManage,
  size = 'md',
}: SearchableBatchSelectProps) {
  const canManage = allowManage ?? allowManagement;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  // Student counts map: batch_id -> { active: number, total: number }
  const [studentCounts, setStudentCounts] = useState<Record<string, { active: number; total: number }>>({});

  // Inline Add State
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchCategory, setNewBatchCategory] = useState('JD');
  const [isCreating, setIsCreating] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Inline Edit State
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Inline Delete State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Layout Portal Positioning
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    bottom: number;
    left: number;
    width: number;
    openUpward: boolean;
    maxHeight: number;
  }>({
    top: 0,
    bottom: 0,
    left: 0,
    width: 0,
    openUpward: false,
    maxHeight: 280,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Recalculate dropdown portal coordinates relative to trigger button
  const updateCoords = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Available vertical space in viewport
      const spaceBelow = viewportHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;

      // Decide whether to open upward or downward based on available viewport space
      const shouldFlipUp = spaceBelow < 250 && spaceAbove > spaceBelow;

      // Calculate dynamic max height to guarantee no clipping off-screen
      const availableSpace = shouldFlipUp ? spaceAbove : spaceBelow;
      const maxHeight = Math.min(300, Math.max(140, availableSpace));

      setCoords({
        top: rect.bottom + 4,
        bottom: viewportHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
        openUpward: shouldFlipUp,
        maxHeight,
      });
    }
  }, []);

  // Load student counts (active & total) when dropdown opens
  const fetchStudentCounts = async () => {
    try {
      const counts: Record<string, { active: number; total: number }> = {};
      if (isGuestMode()) {
        const active = getDemoStudents({ status: 'active' });
        const archived = getDemoStudents({ status: 'archived' });
        const allStudents = [...active, ...archived];
        allStudents.forEach((s) => {
          if (s.batch_id) {
            const cur = counts[s.batch_id] || { active: 0, total: 0 };
            cur.total += 1;
            if (s.status === 'active') cur.active += 1;
            counts[s.batch_id] = cur;
          }
        });
        setStudentCounts(counts);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase.from('students').select('batch_id, status');
      if (data) {
        data.forEach((s: any) => {
          if (s.batch_id) {
            const cur = counts[s.batch_id] || { active: 0, total: 0 };
            cur.total += 1;
            if (s.status === 'active') cur.active += 1;
            counts[s.batch_id] = cur;
          }
        });
        setStudentCounts(counts);
      }
    } catch (err) {
      console.warn('Error loading student counts:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      if (canManage) {
        fetchStudentCounts();
      }
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen, updateCoords, canManage]);

  // Handle click outside trigger & portal dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setIsAddingInline(false);
        setEditingBatchId(null);
        setConfirmDeleteId(null);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const sorted = sortBatches(batches);
  const filtered = sorted.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.category.toLowerCase().includes(search.toLowerCase())
  );

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  // INLINE ADD BATCH HANDLER
  const handleCreateNewBatch = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!newBatchName.trim()) return;

    setIsCreating(true);
    setAddError(null);

    try {
      const res = await createBatch(newBatchName.trim(), newBatchCategory);
      if (res.success && res.data) {
        if (onBatchCreated) onBatchCreated(res.data);
        if (onBatchesUpdated) onBatchesUpdated();
        onChange(res.data.id);
        setNewBatchName('');
        setIsAddingInline(false);
        setIsOpen(false);
      } else {
        setAddError(res.error || 'Failed to create batch.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create batch.';
      setAddError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  // INLINE EDIT BATCH HANDLER
  const startEditing = (batch: Batch, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingBatchId(batch.id);
    setEditName(batch.name);
    setEditCategory(batch.category || inferCategory(batch.name));
    setEditError(null);
  };

  const handleSaveEdit = async (batchId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editName.trim()) return;

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const res = await updateBatch(batchId, editName.trim(), editCategory);
      if (res.success && res.data) {
        if (onBatchesUpdated) onBatchesUpdated();
        setEditingBatchId(null);
      } else {
        setEditError(res.error || 'Failed to update batch.');
      }
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error updating batch.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // INLINE DELETE BATCH HANDLER
  const handleConfirmDelete = async (batchId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await deleteBatch(batchId);
      if (res.success) {
        if (onBatchDeleted) onBatchDeleted(batchId);
        if (onBatchesUpdated) onBatchesUpdated();
        if (selectedBatchId === batchId) onChange('');
        setConfirmDeleteId(null);
      } else {
        setDeleteError(res.error || 'Cannot delete batch.');
      }
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Error deleting batch.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative w-full">
      {/* Selected Batch Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg text-left font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all flex items-center justify-between shadow-sm hover:border-slate-600 ${
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2.5 text-xs sm:text-sm'
        }`}
      >
        <span className={`truncate ${selectedBatch ? 'text-slate-100 font-semibold' : 'text-slate-400'}`}>
          {selectedBatch ? selectedBatch.name : placeholder}
        </span>
        <svg
          className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''} ${
            size === 'sm' ? 'w-4 h-4 ml-1' : 'w-5 h-5 ml-2'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* PORTAL DROPDOWN MENU */}
      {isOpen &&
        isMounted &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: coords.openUpward ? 'auto' : `${coords.top}px`,
              bottom: coords.openUpward ? `${coords.bottom}px` : 'auto',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: `${coords.maxHeight}px`,
              zIndex: 99999,
            }}
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden backdrop-blur-2xl flex flex-col"
          >
            {/* 1. TOP PINNED SEARCH BAR */}
            <div className="p-2 border-b border-slate-800 bg-slate-900 shrink-0">
              <input
                type="text"
                placeholder="Search batch..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>

            {/* 2. MIDDLE SCROLLABLE OPTIONS LIST */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar divide-y divide-slate-800/50">
              {filtered.length === 0 ? (
                <div className="p-4 text-xs text-slate-400 text-center">No batches found</div>
              ) : (
                filtered.map((b) => {
                  const isSelected = b.id === selectedBatchId;
                  const isEditingThis = editingBatchId === b.id;
                  const isDeletingThis = confirmDeleteId === b.id;
                  const counts = studentCounts[b.id] || { active: 0, total: 0 };
                  const hasStudents = counts.total > 0;
                  const activeCount = counts.active;
                  const archivedCount = counts.total - counts.active;
                  let disabledTitle = 'Cannot delete: students are assigned to this batch';
                  if (activeCount > 0 && archivedCount > 0) {
                    disabledTitle = `${activeCount} active and ${archivedCount} archived student(s) assigned — cannot delete`;
                  } else if (activeCount > 0) {
                    disabledTitle = `${activeCount} active student${activeCount > 1 ? 's' : ''} assigned — cannot delete`;
                  } else if (archivedCount > 0) {
                    disabledTitle = `${archivedCount} archived student${archivedCount > 1 ? 's' : ''} assigned — cannot delete`;
                  }

                  return (
                    <div
                      key={b.id}
                      className={`w-full transition-colors flex flex-col ${
                        isSelected
                          ? 'bg-emerald-950/60 text-emerald-300'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      {/* INLINE EDIT FORM ROW */}
                      {isEditingThis ? (
                        <div className="p-2 bg-slate-950 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(b.id, e);
                              }}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                              autoFocus
                            />
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                            >
                              <option value="JD">JD</option>
                              <option value="HS">HS</option>
                              <option value="BS">BS</option>
                              <option value="General">General</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleSaveEdit(b.id, e)}
                              disabled={isSavingEdit || !editName.trim()}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2.5 py-1 text-[11px] rounded disabled:opacity-50"
                            >
                              {isSavingEdit ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingBatchId(null);
                                setEditError(null);
                              }}
                              className="bg-slate-800 text-slate-300 hover:bg-slate-700 px-2 py-1 text-[11px] rounded"
                            >
                              Cancel
                            </button>
                          </div>
                          {editError && <p className="text-[10px] text-red-400">{editError}</p>}
                        </div>
                      ) : isDeletingThis ? (
                        /* INLINE DELETE CONFIRMATION ROW */
                        <div className="p-2.5 bg-red-950/80 border border-red-800/80 rounded-lg flex flex-col gap-2 m-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-red-200 font-semibold">Delete "{b.name}"?</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => handleConfirmDelete(b.id, e)}
                                disabled={isDeleting}
                                className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded text-xs font-bold transition-colors disabled:opacity-50"
                              >
                                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                  setDeleteError(null);
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          {deleteError && (
                            <div className="text-[11px] text-red-300 bg-red-900/50 p-2 rounded border border-red-800/60 leading-tight">
                              {deleteError}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* STANDARD OPTION ROW WITH INLINE ACTIONS */
                        <div className="px-4 py-2.5 flex justify-between items-center group">
                          {/* Left Clickable Select Target */}
                          <button
                            type="button"
                            onClick={() => {
                              onChange(b.id);
                              setIsOpen(false);
                            }}
                            className="flex-1 text-left font-medium text-sm flex items-center justify-between pr-2"
                          >
                            <span>{b.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                              {b.category}
                            </span>
                          </button>

                          {/* Right Action Icons (Edit / Delete) - Only if canManage is true */}
                          {canManage && (
                            <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                              {/* Edit Pencil Icon */}
                              <button
                                type="button"
                                title="Edit / Rename batch"
                                onClick={(e) => startEditing(b, e)}
                                className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                  />
                                </svg>
                              </button>

                              {/* Delete Trash Icon */}
                              {hasStudents ? (
                                <button
                                  type="button"
                                  disabled
                                  title={disabledTitle}
                                  className="p-1 text-slate-600 cursor-not-allowed"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Delete batch"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setConfirmDeleteId(b.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 3. PINNED "+ ADD BATCH" FOOTER (Only when canManage is true) */}
            {canManage && (
              <div className="border-t border-slate-800 p-2 bg-slate-950 shrink-0">
                {!isAddingInline ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAddingInline(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/50 rounded-md transition-all shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Batch
                  </button>
                ) : (
                  <div className="space-y-2 bg-slate-950 p-1 rounded">
                    <div className="text-xs font-semibold text-slate-300">Create New Batch:</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. JD3 or HS 2027"
                        value={newBatchName}
                        onChange={(e) => {
                          setNewBatchName(e.target.value);
                          setNewBatchCategory(inferCategory(e.target.value));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateNewBatch(e);
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                      <select
                        value={newBatchCategory}
                        onChange={(e) => setNewBatchCategory(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="JD">JD</option>
                        <option value="HS">HS</option>
                        <option value="BS">BS</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => handleCreateNewBatch(e)}
                        disabled={isCreating || !newBatchName.trim()}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1 text-xs rounded disabled:opacity-50 transition-colors"
                      >
                        {isCreating ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsAddingInline(false);
                          setNewBatchName('');
                          setAddError(null);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 text-xs rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {addError && <p className="text-[11px] text-red-400">{addError}</p>}
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
