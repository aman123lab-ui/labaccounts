'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getAdminDashboardMetrics, AdminDashboardMetrics } from '@/services/accountingService';
import CustomMonthInput from '@/components/CustomMonthInput';
import { useRealtimeMultiSync } from '@/hooks/useRealtimeSync';
import {
  DebitBookIcon,
  PaymentClaimsIcon,
  JournalIcon,
  LedgerAccountsIcon,
  StudentsIcon,
  InChargeIcon,
  ReportsIcon,
  FinancialYearIcon,
} from '@/components/NavIcons';

function formatCurrency(val: number): string {
  return `₹${Math.abs(val).toFixed(2)}`;
}

type CardSize = 'hero' | 'wide' | 'tall' | 'standard' | 'compact';

interface NavCard {
  title: string;
  description: string;
  href: string;
  buttonText: string;
  icon: React.ComponentType<{ className?: string }>;
  size: CardSize;
  accentBorder: string;
  accentBg: string;
  iconBg: string;
  btnBg: string;
  badgeText: string;
  badgeStyle: string;
  features?: string[];
}

export default function AdminDashboardPage() {
  const [periodMode, setPeriodMode] = useState<'today' | 'month'>('today');
  const todayISO = new Date().toISOString().slice(0, 10);
  const currentMonthISO = new Date().toISOString().slice(0, 7);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthISO);

  const [metrics, setMetrics] = useState<AdminDashboardMetrics>({
    totalCreditGiven: 0,
    cashFlow: 0,
    totalExpenses: 0,
    surplus: 0,
  });
  const [loading, setLoading] = useState(true);

  // ─── Site Settings: show_demo_button ────────────────────────────────────
  const [showDemoButton, setShowDemoButton] = useState<boolean | null>(null); // null = loading
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDemoSetting = useCallback(async () => {
    try {
      const res = await fetch('/api/app-settings?key=show_demo_button');
      if (res.ok) {
        const json = await res.json();
        setShowDemoButton(json.value !== 'false');
      }
    } catch {
      setShowDemoButton(true); // Default ON on error
    }
  }, []);

  useEffect(() => {
    fetchDemoSetting();
  }, [fetchDemoSetting]);

  const handleDemoButtonToggle = async (newValue: boolean) => {
    setSettingsSaving(true);
    setSettingsMsg(null);
    const prev = showDemoButton;
    setShowDemoButton(newValue); // Optimistic update
    try {
      const res = await fetch('/api/app-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'show_demo_button', value: String(newValue) }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSettingsMsg({ type: 'success', text: newValue ? 'Demo button shown on login page.' : 'Demo button hidden from login page.' });
    } catch {
      setShowDemoButton(prev); // Revert on failure
      setSettingsMsg({ type: 'error', text: 'Failed to save setting. Please try again.' });
    } finally {
      setSettingsSaving(false);
      setTimeout(() => setSettingsMsg(null), 3500);
    }
  };

  const getPeriodRange = () => {
    if (periodMode === 'today') {
      const start = `${todayISO}T00:00:00.000Z`;
      const end = `${todayISO}T23:59:59.999Z`;
      return { start, end };
    } else {
      const [yearStr, monthStr] = selectedMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
      return { start, end };
    }
  };

  const loadMetrics = async () => {
    setLoading(true);
    const { start, end } = getPeriodRange();
    const data = await getAdminDashboardMetrics(start, end);
    setMetrics(data);
    setLoading(false);
  };

  useEffect(() => {
    loadMetrics();
  }, [periodMode, selectedMonth]);

  useRealtimeMultiSync({
    channelName: 'admin-dashboard-sync',
    tables: ['journal_entries', 'journal_entry_lines', 'payment_claims', 'cash_handover_claims', 'students'],
    onDataChange: () => {
      loadMetrics();
    },
  });

  const navCards: NavCard[] = [
    {
      title: 'Debit Book',
      description: 'Primary daily activity hub. Log student print jobs, collect cash, and manage running accounts with real-time balance calculations.',
      href: '/admin/ledger',
      buttonText: 'Open Debit Book',
      icon: DebitBookIcon,
      size: 'hero', // 2x2 Bento Hero
      accentBorder: 'border-emerald-800/50 hover:border-emerald-500/80',
      accentBg: 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40',
      iconBg: 'bg-emerald-950 border-emerald-700/60 text-emerald-400',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50',
      badgeText: 'Primary Daily Activity',
      badgeStyle: 'text-emerald-400 border-emerald-800/60 font-mono',
      features: ['Instant Student Lookup', 'Log Print Debits & Cash', 'Auto Double-Entry Posting'],
    },
    {
      title: 'UPI Payment Claims',
      description: 'Review and verify student UPI payment submissions to instantly credit student accounts.',
      href: '/admin/payment-claims',
      buttonText: 'Review Claims',
      icon: PaymentClaimsIcon,
      size: 'wide', // 2x1 Wide Banner
      accentBorder: 'border-amber-800/50 hover:border-amber-500/80',
      accentBg: 'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40',
      iconBg: 'bg-amber-950 border-amber-700/60 text-amber-400',
      btnBg: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-amber-950/50',
      badgeText: 'Student UPI Approval',
      badgeStyle: 'text-amber-400 border-amber-800/60 font-mono',
    },
    {
      title: 'Journal Entry',
      description: 'View, create, and audit every double-entry posting. Complete immutable transaction history with debit & credit lines balance validation.',
      href: '/admin/journal',
      buttonText: 'Open Journal Log',
      icon: JournalIcon,
      size: 'tall', // 1x2 Tall Card
      accentBorder: 'border-indigo-800/50 hover:border-indigo-500/80',
      accentBg: 'bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40',
      iconBg: 'bg-indigo-950 border-indigo-700/60 text-indigo-400',
      btnBg: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/50',
      badgeText: 'Full Audit Trail',
      badgeStyle: 'text-indigo-400 border-indigo-800/60 font-mono',
    },
    {
      title: 'Ledger Accounts',
      description: 'Browse T-format ledger statements for every chart account.',
      href: '/admin/ledger-accounts',
      buttonText: 'View Accounts',
      icon: LedgerAccountsIcon,
      size: 'standard', // 1x1 Standard Card
      accentBorder: 'border-cyan-800/50 hover:border-cyan-500/80',
      accentBg: 'bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30',
      iconBg: 'bg-cyan-950 border-cyan-700/60 text-cyan-400',
      btnBg: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/50',
      badgeText: 'T-Accounts',
      badgeStyle: 'text-cyan-400 border-cyan-800/60 font-mono',
    },
    {
      title: 'Workforce & Collections',
      description: 'Audit shift cash collections, review workforce submission claims, and authorize handovers.',
      href: '/admin/cash-handovers',
      buttonText: 'Review Collections',
      icon: InChargeIcon,
      size: 'wide', // 2x1 Wide Card
      accentBorder: 'border-rose-800/50 hover:border-rose-500/80',
      accentBg: 'bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30',
      iconBg: 'bg-rose-950 border-rose-700/60 text-rose-400',
      btnBg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50',
      badgeText: 'Shift Handover',
      badgeStyle: 'text-rose-400 border-rose-800/60 font-mono',
    },
    {
      title: 'All Students',
      description: 'Manage student profiles, batches, and account balances.',
      href: '/admin/students',
      buttonText: 'Manage Students',
      icon: StudentsIcon,
      size: 'standard', // 1x1 Standard Card
      accentBorder: 'border-purple-800/50 hover:border-purple-500/80',
      accentBg: 'bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/30',
      iconBg: 'bg-purple-950 border-purple-700/60 text-purple-400',
      btnBg: 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/50',
      badgeText: 'Roster',
      badgeStyle: 'text-purple-400 border-purple-800/60 font-mono',
    },
    {
      title: 'Financial Reports',
      description: 'Generate Trial Balance, Income Statement & Balance Sheet with instant exportable print options.',
      href: '/admin/reports',
      buttonText: 'Generate Reports',
      icon: ReportsIcon,
      size: 'compact', // 2x1 Compact Card
      accentBorder: 'border-blue-800/50 hover:border-blue-500/80',
      accentBg: 'bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/30',
      iconBg: 'bg-blue-950 border-blue-700/60 text-blue-400',
      btnBg: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/50',
      badgeText: 'Financial Statements',
      badgeStyle: 'text-blue-400 border-blue-800/60 font-mono',
    },
    {
      title: 'Financial Year',
      description: 'Configure fiscal years and manage accounting period closures.',
      href: '/admin/financial-year',
      buttonText: 'Configure Year',
      icon: FinancialYearIcon,
      size: 'compact', // 2x1 Compact Card
      accentBorder: 'border-teal-800/50 hover:border-teal-500/80',
      accentBg: 'bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/30',
      iconBg: 'bg-teal-950 border-teal-700/60 text-teal-400',
      btnBg: 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-950/50',
      badgeText: 'Period Setup',
      badgeStyle: 'text-teal-400 border-teal-800/60 font-mono',
    },
  ];

  const getGridSpanClasses = (size: CardSize) => {
    switch (size) {
      case 'hero':
        return 'col-span-1 md:col-span-2 lg:col-span-2 lg:row-span-2';
      case 'wide':
        return 'col-span-1 md:col-span-2 lg:col-span-2 lg:row-span-1';
      case 'tall':
        return 'col-span-1 md:col-span-1 lg:col-span-1 lg:row-span-2';
      case 'standard':
        return 'col-span-1 md:col-span-1 lg:col-span-1 lg:row-span-1';
      case 'compact':
        return 'col-span-1 md:col-span-2 lg:col-span-2 lg:row-span-1';
      default:
        return 'col-span-1';
    }
  };

  return (
    <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 space-y-8 flex-1">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Admin Executive Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Live double-entry ledger analytics • Derived dynamically from database journal lines
          </p>
        </div>

        {/* Period Toggle & Date Picker Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto self-stretch sm:self-auto">
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setPeriodMode('today')}
              className={`flex-1 sm:flex-initial px-4 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                periodMode === 'today'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('month')}
              className={`flex-1 sm:flex-initial px-4 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                periodMode === 'month'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Month View
            </button>
          </div>

          {/* Date Picker for Month View */}
          {periodMode === 'month' && (
            <CustomMonthInput
              value={selectedMonth}
              onChange={(val) => setSelectedMonth(val)}
            />
          )}
        </div>
      </div>

      {/* 4 SUMMARY CARDS COMPUTED LIVE FROM LEDGER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Credit Given */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Credit Given
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400 font-bold font-mono text-xs">
              ₹
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {loading ? (
              <span className="text-slate-600 animate-pulse">₹0.00</span>
            ) : (
              formatCurrency(metrics.totalCreditGiven)
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Sum of AR debit entries in {periodMode === 'today' ? 'today' : selectedMonth}.
          </p>
        </motion.div>

        {/* Card 2: Cash Flow */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Cash Flow
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-950 border border-blue-800/60 flex items-center justify-center text-blue-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className={`text-2xl font-black font-mono ${metrics.cashFlow < 0 ? 'text-red-400' : metrics.cashFlow > 0 ? 'text-emerald-400' : 'text-white'}`}>
            {loading ? (
              <span className="text-slate-600 animate-pulse">₹0.00</span>
            ) : (
              formatCurrency(metrics.cashFlow)
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Net cash inflows − outflows in {periodMode === 'today' ? 'today' : selectedMonth}.
          </p>
        </motion.div>

        {/* Card 3: Total Expenses */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Expenses
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-950 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono flex items-center gap-1.5 flex-wrap">
            {loading ? (
              <span className="text-slate-600 animate-pulse">₹0.00</span>
            ) : (
              <>
                <span>{formatCurrency(metrics.totalExpenses)}</span>
                {metrics.totalExpenses < 0 && (
                  <span className="text-xs font-semibold text-amber-400 font-sans bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded-full">
                    Net Refund
                  </span>
                )}
              </>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Paper, ink, maintenance debits in {periodMode === 'today' ? 'today' : selectedMonth}.
          </p>
        </motion.div>

        {/* Card 4: Net Balance / Surplus */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Net Surplus
            </span>
            <div className="w-7 h-7 rounded-lg bg-teal-950 border border-teal-800/60 flex items-center justify-center text-teal-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className={`text-2xl font-black font-mono ${metrics.surplus < 0 ? 'text-red-400' : metrics.surplus > 0 ? 'text-emerald-400' : 'text-white'}`}>
            {loading ? (
              <span className="text-slate-600 animate-pulse">₹0.00</span>
            ) : (
              formatCurrency(metrics.surplus)
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Revenue − Expense (Surplus) in {periodMode === 'today' ? 'today' : selectedMonth}.
          </p>
        </motion.div>
      </div>


      {/* STAGGERED MASONRY / BENTO GRID CONTAINER */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 grid-flow-dense gap-4 auto-rows-[minmax(140px,auto)]">
          {navCards.map((card, idx) => {
            const IconComponent = card.icon;
            const spanClasses = getGridSpanClasses(card.size);

            // =======================================================================
            // HERO / LARGE CARD VARIANT (2x2 Grid Tile)
            // =======================================================================
            if (card.size === 'hero') {
              return (
                <motion.div
                  key={card.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 * idx }}
                  className={`border rounded-2xl p-6 sm:p-7 shadow-2xl flex flex-col justify-between transition-all duration-300 group ${card.accentBg} ${card.accentBorder} ${spanClasses}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${card.iconBg}`}>
                        <IconComponent className="w-7 h-7" />
                      </div>
                      <span className={`text-[11px] uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-slate-950/80 border ${card.badgeStyle}`}>
                        {card.badgeText}
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 mt-2.5 leading-relaxed font-normal">
                      {card.description}
                    </p>

                    {/* Feature Highlight Pills */}
                    {card.features && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {card.features.map((feat, i) => (
                          <span
                            key={i}
                            className="text-[10px] sm:text-[11px] font-medium text-slate-300 bg-slate-950/60 border border-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {feat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <Link
                    href={card.href}
                    className={`mt-6 w-full font-extrabold text-sm px-5 py-3.5 rounded-xl shadow-xl transition-all flex items-center justify-between gap-2 ${card.btnBg}`}
                  >
                    <span>{card.buttonText}</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </motion.div>
              );
            }

            // =======================================================================
            // WIDE CARD VARIANT (2x1 Horizontal Banner Tile)
            // =======================================================================
            if (card.size === 'wide') {
              return (
                <motion.div
                  key={card.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 * idx }}
                  className={`border rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 group ${card.accentBg} ${card.accentBorder} ${spanClasses}`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-md flex-shrink-0 transition-transform group-hover:scale-105 ${card.iconBg}`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-base font-bold text-white tracking-tight group-hover:text-amber-300 transition-colors">
                          {card.title}
                        </h3>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-950/80 border ${card.badgeStyle}`}>
                          {card.badgeText}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={card.href}
                    className={`font-extrabold text-xs px-4 py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 flex-shrink-0 w-full sm:w-auto ${card.btnBg}`}
                  >
                    <span>{card.buttonText}</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </motion.div>
              );
            }

            // =======================================================================
            // TALL CARD VARIANT (1x2 Vertical Column Tile)
            // =======================================================================
            if (card.size === 'tall') {
              return (
                <motion.div
                  key={card.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 * idx }}
                  className={`border rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all duration-300 group ${card.accentBg} ${card.accentBorder} ${spanClasses}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-md transition-transform group-hover:scale-105 ${card.iconBg}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-950/80 border ${card.badgeStyle}`}>
                        {card.badgeText}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {card.description}
                    </p>

                    <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-medium text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        <span>Double-Entry Validation</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Strict debit = credit assertion on every saved line.
                      </p>
                    </div>
                  </div>

                  <Link
                    href={card.href}
                    className={`mt-5 w-full font-bold text-xs px-3.5 py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${card.btnBg}`}
                  >
                    <span>{card.buttonText}</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </motion.div>
              );
            }

            // =======================================================================
            // COMPACT CARD VARIANT (Horizontal Compact Tile)
            // =======================================================================
            if (card.size === 'compact') {
              return (
                <motion.div
                  key={card.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 * idx }}
                  className={`border rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-300 group ${card.accentBg} ${card.accentBorder} ${spanClasses}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-md flex-shrink-0 transition-transform group-hover:scale-105 ${card.iconBg}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white tracking-tight truncate group-hover:text-blue-300 transition-colors">
                          {card.title}
                        </h3>
                        <span className={`hidden sm:inline-block text-[9px] uppercase font-bold tracking-wider px-2 py-0.2 rounded-full bg-slate-950/80 border ${card.badgeStyle}`}>
                          {card.badgeText}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {card.description}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={card.href}
                    className={`font-bold text-xs px-3.5 py-2 rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 flex-shrink-0 ${card.btnBg}`}
                  >
                    <span>{card.buttonText}</span>
                    <svg className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </motion.div>
              );
            }

            // =======================================================================
            // STANDARD CARD VARIANT (1x1 Standard Grid Tile)
            // =======================================================================
            return (
              <motion.div
                key={card.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * idx }}
                className={`border rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between transition-all duration-300 group ${card.accentBg} ${card.accentBorder} ${spanClasses}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-md transition-transform group-hover:scale-105 ${card.iconBg}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.2 rounded-full bg-slate-950/80 border ${card.badgeStyle}`}>
                      {card.badgeText}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <Link
                  href={card.href}
                  className={`mt-3.5 w-full font-bold text-xs px-3 py-2 rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 ${card.btnBg}`}
                >
                  <span>{card.buttonText}</span>
                  <svg className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </motion.div>
            );
          })}
        </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SITE SETTINGS SECTION                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-slate-800 pt-8 pb-8">
        <div className="mb-5">
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            Site Settings
          </h2>
          <p className="text-xs text-slate-400 mt-1 ml-9">Runtime toggles — take effect immediately, no deploy needed.</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100">
                Show "Try Guest Mode" on login page
              </p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Controls whether the amber <strong className="text-amber-300">"Try Guest Mode"</strong> button
                is visible on the main login screen. Turning this OFF hides the button but never blocks
                direct links to <code className="text-slate-300 bg-slate-800 px-1 rounded">/demo</code> — external portfolio links always work.
              </p>
            </div>

            {/* Toggle switch */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <button
                id="toggle-demo-button-setting"
                type="button"
                disabled={settingsSaving || showDemoButton === null}
                onClick={() => showDemoButton !== null && handleDemoButtonToggle(!showDemoButton)}
                className={`relative w-12 h-6 rounded-full border-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed ${
                  showDemoButton
                    ? 'bg-emerald-600 border-emerald-500 focus:ring-emerald-500'
                    : 'bg-slate-700 border-slate-600 focus:ring-slate-500'
                }`}
                aria-label="Toggle demo button visibility on login page"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${
                    showDemoButton ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                showDemoButton === null ? 'text-slate-500' : showDemoButton ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                {showDemoButton === null ? '...' : showDemoButton ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>

          {/* Status message */}
          {settingsMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-4 p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                settingsMsg.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                  : 'bg-red-950/60 border border-red-800/60 text-red-300'
              }`}
            >
              {settingsMsg.type === 'success' ? (
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {settingsMsg.text}
            </motion.div>
          )}
        </div>
      </div>
    </main>
  );
}
