// @ts-nocheck
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import EditJournalEntryModal from '@/components/EditJournalEntryModal';
import {
  getLedgerAccountsGrouped,
  LedgerAccountGroup,
  voidJournalEntry,
  DetailedJournalEntry,
} from '@/services/journalService';
import { getFinancialYears } from '@/services/financialYearService';
import { updateAccountName, createAccount } from '@/services/accountingService';
import { AccountType, FinancialYear } from '@/types/database.types';

type FlatAccountItem = LedgerAccountGroup['accounts'][number] & {
  groupTitle: string;
};

export default function LedgerAccountsPage() {
  const [accountGroups, setAccountGroups] = useState<LedgerAccountGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Financial Years State
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<string>('');

  // Selection & Search State
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Edit & Void Modal State
  const [editingEntry, setEditingEntry] = useState<DetailedJournalEntry | null>(null);
  const [voidingEntry, setVoidingEntry] = useState<DetailedJournalEntry | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Rename Account Modal State
  const [renamingAccount, setRenamingAccount] = useState<FlatAccountItem | null>(null);
  const [renameAccountName, setRenameAccountName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Add New Account Modal State
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newAccountNameInput, setNewAccountNameInput] = useState('');
  const [newAccountTypeInput, setNewAccountTypeInput] = useState<AccountType>('expense');
  const [addAccountLoading, setAddAccountLoading] = useState(false);
  const [addAccountError, setAddAccountError] = useState<string | null>(null);

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountNameInput.trim()) return;
    setAddAccountLoading(true);
    setAddAccountError(null);

    const res = await createAccount(newAccountNameInput.trim(), newAccountTypeInput);

    if (res.success) {
      showToast(`Account "${newAccountNameInput.trim()}" created successfully.`);
      setIsAddAccountOpen(false);
      setNewAccountNameInput('');
      setNewAccountTypeInput('expense');
      loadLedgerAccounts();
    } else {
      setAddAccountError(res.error || 'Failed to create account.');
    }
    setAddAccountLoading(false);
  };

  const handleStartRename = (acc: FlatAccountItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRenamingAccount(acc);
    setRenameAccountName(acc.name);
    setRenameError(null);
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingAccount || !renameAccountName.trim()) return;
    setRenameLoading(true);
    setRenameError(null);

    const res = await updateAccountName(renamingAccount.id, renameAccountName.trim());

    if (res.success) {
      showToast(`Account renamed to "${renameAccountName.trim()}" successfully.`);
      setRenamingAccount(null);
      loadLedgerAccounts();
    } else {
      setRenameError(res.error || 'Failed to rename account.');
    }
    setRenameLoading(false);
  };

  const loadFYs = async () => {
    const list = await getFinancialYears();
    setFinancialYears(list);
    const active = list.find((f) => f.is_current);
    if (active && !selectedFyId) {
      setSelectedFyId(active.id);
    }
  };

  const loadLedgerAccounts = async () => {
    setLoading(true);
    const data = await getLedgerAccountsGrouped(selectedFyId || undefined);
    setAccountGroups(data);
    setLoading(false);
  };

  useEffect(() => {
    loadFYs();
  }, []);

  useEffect(() => {
    loadLedgerAccounts();
  }, [selectedFyId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExecuteVoid = async () => {
    if (!voidingEntry) return;
    setVoidLoading(true);

    const res = await voidJournalEntry(voidingEntry.id, 'Admin');

    if (res.success) {
      showToast('Journal entry voided successfully. Account ledgers recalculated.');
      setVoidingEntry(null);
      loadLedgerAccounts();
    } else {
      showToast(res.error || 'Failed to void entry.');
    }
    setVoidLoading(false);
  };

  // Flatten all accounts from groups into a single array for search/grid
  const allAccounts = useMemo(() => {
    const list: FlatAccountItem[] = [];
    accountGroups.forEach((group) => {
      group.accounts.forEach((acc) => {
        list.push({
          ...acc,
          groupTitle: group.title,
        });
      });
    });
    return list;
  }, [accountGroups]);

  // Filtered accounts based on search query and category pill
  const filteredAccounts = useMemo(() => {
    return allAccounts.filter((acc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        acc.name.toLowerCase().includes(q) ||
        (acc.student_name && acc.student_name.toLowerCase().includes(q)) ||
        acc.type.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'student_ar') return acc.is_student_account;
      return acc.type.toLowerCase() === categoryFilter.toLowerCase();
    });
  }, [allAccounts, searchQuery, categoryFilter]);

  // Currently selected account for detail view
  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) return null;
    return allAccounts.find((a) => a.id === selectedAccountId) || null;
  }, [allAccounts, selectedAccountId]);

  // Export Full Ledger (All Accounts) as CSV
  const handleExportAllCSV = () => {
    let csv = 'Account Group,Account Name,Student Name,Date,Description,Debit (INR),Credit (INR),Running Balance (INR)\n';

    accountGroups.forEach((group) => {
      group.accounts.forEach((acc) => {
        if (acc.lines.length === 0) {
          csv += `"${group.title}","${acc.name}","${acc.student_name || 'N/A'}","","No transactions","0.00","0.00","0.00"\n`;
        } else {
          acc.lines.forEach((l) => {
            csv += `"${group.title}","${acc.name}","${acc.student_name || 'N/A'}","${l.date}","${l.description.replace(
              /"/g,
              '""'
            )}","${l.debit.toFixed(2)}","${l.credit.toFixed(2)}","${l.runningBalance.toFixed(2)}"\n`;
          });
        }
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Full_General_Ledger_All_Accounts.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Single Account Statement as CSV
  const handleExportSingleAccountCSV = (acc: FlatAccountItem) => {
    let csv = `Account Statement: ${acc.name}${acc.student_name ? ` (${acc.student_name})` : ''}\n`;
    csv += `Type: ${acc.type.toUpperCase()}, Category: ${acc.is_student_account ? 'Student AR' : 'General Ledger'}\n`;
    csv += `Ending Balance: ${acc.finalBalance.toFixed(2)}\n\n`;
    csv += 'Date,Description,Debit (INR),Credit (INR),Running Balance (INR)\n';

    if (acc.lines.length === 0) {
      csv += ',"No transactions posted for this account",0.00,0.00,0.00\n';
    } else {
      acc.lines.forEach((l) => {
        csv += `"${l.date}","${l.description.replace(/"/g, '""')}","${l.debit.toFixed(2)}","${l.credit.toFixed(2)}","${l.runningBalance.toFixed(2)}"\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Ledger_${acc.name.replace(/[^a-z0-9]/gi, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for Type Badge Colors
  const getTypeBadgeClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'asset':
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60';
      case 'revenue':
        return 'bg-blue-950/80 text-blue-400 border-blue-800/60';
      case 'expense':
        return 'bg-amber-950/80 text-amber-400 border-amber-800/60';
      case 'liability':
        return 'bg-rose-950/80 text-rose-400 border-rose-800/60';
      default:
        return 'bg-purple-950/80 text-purple-400 border-purple-800/60';
    }
  };

  // Helper for Dr/Cr formatting
  const formatBalanceWithDrCr = (acc: FlatAccountItem) => {
    const bal = acc.finalBalance;
    const absVal = Math.abs(bal).toFixed(2);

    if (acc.type === 'asset' || acc.type === 'expense') {
      return bal >= 0 ? `₹${absVal} Dr` : `₹${absVal} Cr`;
    } else {
      return bal >= 0 ? `₹${absVal} Cr` : `₹${absVal} Dr`;
    }
  };

  return (
    <>
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 space-y-6 flex-1">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-4 bg-emerald-950/80 border border-emerald-800/80 rounded-2xl text-xs text-emerald-300 font-bold shadow-lg animate-fade-in">
            {toastMessage}
          </div>
        )}

        {/* LOADING STATE */}
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-400 animate-pulse">
            Loading Chart of Accounts & computing live running balances...
          </div>
        ) : selectedAccount ? (
          /* ========================================================================= */
          /* ACCOUNT DETAIL VIEW (Selected Card T-Ledger)                                */
          /* ========================================================================= */
          <div className="space-y-6 animate-fade-in">
            {/* Top Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <button
                type="button"
                onClick={() => setSelectedAccountId(null)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-2 self-start"
              >
                ← Back to All Accounts
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleExportSingleAccountCSV(selectedAccount)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Statement (CSV)
                </button>
              </div>
            </div>

            {/* Account Info Summary Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getTypeBadgeClass(selectedAccount.type)}`}>
                    {selectedAccount.type}
                  </span>
                  {selectedAccount.is_student_account && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 text-slate-300 border border-slate-800">
                      STUDENT AR
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white font-mono">
                    {selectedAccount.name}
                  </h2>
                  <button
                    type="button"
                    title="Rename Account"
                    onClick={() => handleStartRename(selectedAccount)}
                    className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                </div>
                {selectedAccount.student_name && (
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                    Student Account: {selectedAccount.student_name}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Debits</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    ₹{selectedAccount.lines.reduce((s, l) => s + l.debit, 0).toFixed(2)}
                  </span>
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Credits</span>
                  <span className="text-sm font-bold text-blue-400 font-mono">
                    ₹{selectedAccount.lines.reduce((s, l) => s + l.credit, 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 border border-emerald-800/60 p-4 rounded-xl text-right">
                <span className="text-[10px] font-mono text-slate-400 block uppercase">Current Ending Balance</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {formatBalanceWithDrCr(selectedAccount)}
                </span>
              </div>
            </div>

            {/* T-Format Ledger Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  General Ledger Lines ({selectedAccount.lines.length})
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  Chronological Entry Audit View
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-slate-950">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Description / Narration</th>
                      <th className="p-3 text-right">Debit (₹)</th>
                      <th className="p-3 text-right">Credit (₹)</th>
                      <th className="p-3 text-right">Running Balance</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {selectedAccount.lines.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-500 font-sans">
                          No transactions posted to this account yet.
                        </td>
                      </tr>
                    ) : (
                      selectedAccount.lines.map((l) => (
                        <tr key={l.lineId} className="hover:bg-slate-900/60 transition-colors">
                          <td className="p-3 text-slate-400 whitespace-nowrap">{l.date}</td>
                          <td className="p-3 text-slate-100 font-sans font-medium">{l.description}</td>
                          <td className="p-3 text-right text-emerald-400 font-bold">
                            {l.debit > 0 ? `₹${l.debit.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-3 text-right text-blue-400 font-bold">
                            {l.credit > 0 ? `₹${l.credit.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-3 text-right text-white font-bold bg-slate-900/50">
                            ₹{l.runningBalance.toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 font-sans">
                              <button
                                type="button"
                                onClick={() => setEditingEntry(l.rawEntry)}
                                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold transition-colors"
                                title="Edit Entry"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setVoidingEntry(l.rawEntry)}
                                className="px-2.5 py-1 rounded-md bg-red-950 hover:bg-red-900 text-red-300 border border-red-900/40 text-[10px] font-semibold transition-colors"
                                title="Void Entry"
                              >
                                Void
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* CARD GRID SELECTION SCREEN (Default View)                                  */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Ledger Accounts Directory</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Browse and select accounts to view detailed T-format ledgers, balances, and line audits.
                </p>
              </div>

              {/* Top Action Buttons: Add Account + Export CSV */}
              <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddAccountOpen(true);
                    setNewAccountNameInput('');
                    setNewAccountTypeInput('expense');
                    setAddAccountError(null);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Account
                </button>

                <button
                  type="button"
                  onClick={handleExportAllCSV}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export All Accounts (CSV)
                </button>
              </div>
            </div>

            {/* Search & FY Filter Controls */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-xl">
                  {/* FY Select */}
                  <select
                    value={selectedFyId}
                    onChange={(e) => setSelectedFyId(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono transition-colors"
                  >
                    {financialYears.map((fy) => (
                      <option key={fy.id} value={fy.id}>
                        {fy.name || fy.year_label} {fy.is_current ? '(Active)' : '(Closed)'}
                      </option>
                    ))}
                    <option value="ALL">All Financial Years (Cumulative)</option>
                  </select>

                  {/* Search Input */}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search accounts or students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Account Count Pill */}
                <span className="text-xs font-mono text-slate-400 self-center">
                  Showing {filteredAccounts.length} of {allAccounts.length} Account(s)
                </span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Accounts' },
                  { id: 'asset', label: 'Assets' },
                  { id: 'liability', label: 'Liabilities' },
                  { id: 'revenue', label: 'Revenue' },
                  { id: 'expense', label: 'Expenses' },
                  { id: 'equity', label: 'Equity / Net Assets' },
                  { id: 'student_ar', label: 'Student AR' },
                ].map((tab) => {
                  const isActive = categoryFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCategoryFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-emerald-600 text-white font-bold shadow-md'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RESPONSIVE CARD GRID */}
            {filteredAccounts.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                No accounts match your search filter "{searchQuery}".
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAccounts.map((acc) => {
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedAccountId(acc.id)}
                      className="bg-slate-900 border border-slate-800 hover:border-emerald-500/80 rounded-2xl p-4 cursor-pointer shadow-lg hover:shadow-emerald-950/30 transition-all flex flex-col justify-between space-y-4 group"
                    >
                      {/* Card Header: Type Badge + Name */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${getTypeBadgeClass(acc.type)}`}>
                              {acc.type}
                            </span>
                            {acc.is_student_account && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-950 text-slate-400 border border-slate-800">
                                AR
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            title="Rename Account"
                            onClick={(e) => handleStartRename(acc, e)}
                            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors opacity-80 group-hover:opacity-100"
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
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1 font-mono">
                            {acc.name}
                          </h3>
                          {acc.student_name && (
                            <p className="text-[11px] text-slate-400 font-sans truncate mt-0.5">
                              Student: <span className="text-slate-200 font-semibold">{acc.student_name}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Balance + Entries count */}
                      <div className="pt-3 border-t border-slate-800/80 flex items-end justify-between">
                        <div>
                          <span className="text-[9px] font-mono text-slate-400 uppercase block">Current Balance</span>
                          <span className="text-sm font-extrabold text-emerald-400 font-mono">
                            {formatBalanceWithDrCr(acc)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {acc.lines.length} {acc.lines.length === 1 ? 'Line' : 'Lines'}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-400 group-hover:underline">
                            View T-Ledger →
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* EDIT MODAL */}
      <EditJournalEntryModal
        isOpen={!!editingEntry}
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSuccess={() => {
          showToast('Journal entry updated successfully. Ledger recalculated.');
          loadLedgerAccounts();
        }}
      />

      {/* VOID CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={!!voidingEntry}
        title="Void Journal Entry"
        message={`Are you sure you want to void this entry ("${voidingEntry?.description}")? It will be excluded from all account running balances.`}
        confirmLabel="Void Journal Entry"
        cancelLabel="Keep Entry"
        variant="danger"
        loading={voidLoading}
        onCancel={() => setVoidingEntry(null)}
        onConfirm={handleExecuteVoid}
      />

      {/* RENAME ACCOUNT MODAL */}
      {renamingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Rename Ledger Account</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Account Type: <span className="text-slate-200 uppercase font-bold">{renamingAccount.type}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRenamingAccount(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {renameError && (
              <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-xl text-xs text-red-300 font-medium">
                {renameError}
              </div>
            )}

            <form onSubmit={handleSaveRename} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  value={renameAccountName}
                  onChange={(e) => setRenameAccountName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                  placeholder="Enter account name..."
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRenamingAccount(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameLoading || !renameAccountName.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs shadow-lg disabled:opacity-50 transition-colors"
                >
                  {renameLoading ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW ACCOUNT MODAL */}
      {isAddAccountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Add New Ledger Account</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Create a new General Ledger account for fund accounting
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAccountOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {addAccountError && (
              <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-xl text-xs text-red-300 font-medium">
                {addAccountError}
              </div>
            )}

            <form onSubmit={handleCreateAccountSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  value={newAccountNameInput}
                  onChange={(e) => setNewAccountNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                  placeholder="e.g. Lab Equipment Maintenance, Sponsorship Income..."
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Account Type
                </label>
                <select
                  value={newAccountTypeInput}
                  onChange={(e) => setNewAccountTypeInput(e.target.value as AccountType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                >
                  <option value="expense">Expense (Debit Balance)</option>
                  <option value="asset">Asset (Debit Balance)</option>
                  <option value="revenue">Revenue (Credit Balance)</option>
                  <option value="liability">Liability (Credit Balance)</option>
                  <option value="equity">Equity / Net Assets (Credit Balance)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addAccountLoading || !newAccountNameInput.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs shadow-lg disabled:opacity-50 transition-colors"
                >
                  {addAccountLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
