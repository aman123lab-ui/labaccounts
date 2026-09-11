'use client';

import React, { useState, useEffect } from 'react';
import { Account } from '@/types/database.types';
import { DetailedJournalEntry, updateJournalEntry } from '@/services/journalService';
import { createClient } from '@/lib/supabase/client';
import SearchableAccountSelect, { AccountOption } from '@/components/SearchableAccountSelect';
import CustomDateInput from '@/components/CustomDateInput';

interface EditJournalEntryModalProps {
  isOpen: boolean;
  entry: DetailedJournalEntry | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditJournalEntryModal({
  isOpen,
  entry,
  onClose,
  onSuccess,
}: EditJournalEntryModalProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [lines, setLines] = useState<{ id?: string; accountId: string; debit: string; credit: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      const supabase = createClient();
      const { data } = await supabase
        .from('accounts')
        .select('*, students(name)')
        .order('name');

      if (data) {
        const rawAccounts = data as unknown as Array<Account & { students?: { name: string } | null }>;
        const formatted: AccountOption[] = rawAccounts.map((a) => {
          return {
            id: a.id,
            name: a.name,
            type: a.type,
            student_name: a.students?.name || null,
          };
        });
        setAccounts(formatted);
      }
    }
    loadAccounts();
  }, []);

  useEffect(() => {
    if (entry) {
      setDescription(entry.description || '');
      setDate(entry.date ? new Date(entry.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      setLines(
        entry.lines.map((l) => ({
          id: l.id,
          accountId: l.account_id,
          debit: l.debit_amount > 0 ? String(l.debit_amount) : '',
          credit: l.credit_amount > 0 ? String(l.credit_amount) : '',
        }))
      );
      setError(null);
    }
  }, [entry]);

  if (!isOpen || !entry) return null;

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && lines.length >= 2;

  const handleAddLine = () => {
    const defaultAccId = accounts.length > 0 ? accounts[0].id : '';
    setLines([...lines, { accountId: defaultAccId, debit: '', credit: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      setError('A journal entry must have at least 2 lines.');
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: 'accountId' | 'debit' | 'credit', value: string) => {
    const next = [...lines];
    if (field === 'accountId') {
      next[index].accountId = value;
    } else if (field === 'debit') {
      next[index].debit = value;
      if (Number(value) > 0) next[index].credit = '';

      // Auto-fill Credit on opposing line if standard 2-line voucher
      if (lines.length === 2) {
        const otherIndex = index === 0 ? 1 : 0;
        next[otherIndex].credit = value;
        if (Number(value) > 0) next[otherIndex].debit = '';
      }
    } else if (field === 'credit') {
      next[index].credit = value;
      if (Number(value) > 0) next[index].debit = '';

      // Auto-fill Debit on opposing line if standard 2-line voucher
      if (lines.length === 2) {
        const otherIndex = index === 0 ? 1 : 0;
        next[otherIndex].debit = value;
        if (Number(value) > 0) next[otherIndex].credit = '';
      }
    }
    setLines(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      setError(`Debits (₹${totalDebit.toFixed(2)}) must equal Credits (₹${totalCredit.toFixed(2)}).`);
      return;
    }

    setSaving(true);
    setError(null);

    const parsedLines = lines.map((l) => ({
      id: l.id,
      accountId: l.accountId,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
    }));

    const res = await updateJournalEntry(entry.id, description, date, parsedLines);

    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setError(res.error || 'Failed to update journal entry.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4 shadow-2xl overflow-visible text-slate-900">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Edit Journal Entry (With Audit Log)</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Changes will be validated for balanced debits/credits and audited before saving.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Date</label>
              <CustomDateInput
                value={date}
                onChange={(val) => setDate(val)}
                className="w-full py-2"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Journal Lines ({lines.length})
              </label>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                + Add Line
              </button>
            </div>

            <div className="space-y-2 border border-slate-200 rounded-xl p-2.5 sm:p-3 bg-slate-50 max-h-48 sm:max-h-56 overflow-y-auto">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center pb-2 border-b border-slate-200 last:border-0 last:pb-0">
                  <div className="sm:col-span-6 min-w-0">
                    <SearchableAccountSelect
                      accounts={accounts}
                      value={line.accountId}
                      onChange={(accId) => handleLineChange(idx, 'accountId', accId)}
                      placeholder="Search account..."
                    />
                  </div>

                  <div className="sm:col-span-3 min-w-0">
                    <input
                      type="number"
                      step="any"
                      placeholder="Debit (₹)"
                      value={line.debit}
                      onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-emerald-700 font-mono font-semibold focus:outline-none focus:border-emerald-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div className="sm:col-span-3 min-w-0 flex items-center gap-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="Credit (₹)"
                      value={line.credit}
                      onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono font-semibold min-w-0 focus:outline-none focus:border-emerald-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="text-slate-400 hover:text-red-600 p-1 text-xs shrink-0"
                      title="Remove Line"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Debits vs Credits Totals Guard */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-wrap justify-between items-center gap-2 text-xs font-mono">
              <span className="text-emerald-700 font-bold">Total Debits: ₹{totalDebit.toFixed(2)}</span>
              <span className="text-slate-800 font-bold">Total Credits: ₹{totalCredit.toFixed(2)}</span>
              <span className={isBalanced ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                {isBalanced ? '✓ Balanced' : `✕ Imbalance: ₹${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !isBalanced}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs shadow-xs disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving & Auditing...' : 'Save & Update Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
