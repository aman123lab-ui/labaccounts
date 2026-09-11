'use client';

import React, { useState, useEffect } from 'react';
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

function formatCurrency(val: number): React.ReactNode {
  const abs = Math.abs(val).toFixed(2);
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="font-sans">₹</span>
      <span className="font-mono">{abs}</span>
    </span>
  );
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
      accentBorder: 'border-slate-200 hover:border-slate-300 hover:shadow-md',
      accentBg: 'bg-white',
      iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs',
      badgeText: 'Primary Daily Activity',
      badgeStyle: 'text-emerald-800 bg-emerald-50 border-emerald-200 font-mono',
      features: ['Instant Student Lookup', 'Log Print Debits & Cash', 'Auto Double-Entry Posting'],
    },
    {
      title: 'UPI Payment Claims',
      description: 'Review and verify student UPI payment submissions to instantly credit student accounts.',
      href: '/admin/payment-claims',
      buttonText: 'Review Claims',
      icon: PaymentClaimsIcon,
      size: 'wide', // 2x1 Wide Banner
      accentBorder: 'border-slate-200 hover:border-slate-300 hover:shadow-md',
      accentBg: 'bg-white',
      iconBg: 'bg-amber-50 border-amber-200 text-amber-700',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs',
      badgeText: 'Student UPI Approval',
      badgeStyle: 'text-amber-800 bg-amber-50 border-amber-200 font-mono',
    },
    {
      title: 'Journal Entry',
      description: 'View, create, and audit every double-entry posting. Complete immutable transaction history with debit & credit lines balance validation.',
      href: '/admin/journal',
      buttonText: 'Open Journal Log',
      icon: JournalIcon,
      size: 'tall', // 1x2 Tall Card
      accentBorder: 'border-slate-200 hover:border-slate-300 hover:shadow-md',
      accentBg: 'bg-white',
      iconBg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs',
      badgeText: 'Full Audit Trail',
      badgeStyle: 'text-indigo-800 bg-indigo-50 border-indigo-200 font-mono',
    },
    {
      title: 'Ledger Accounts',
      description: 'Browse T-format ledger statements for every chart account.',
      href: '/admin/ledger-accounts',
      buttonText: 'View Accounts',
      icon: LedgerAccountsIcon,
      size: 'standard', // 1x1 Standard Card
      accentBorder: 'border-slate-200 hover:border-slate-300 hover:shadow-md',
      accentBg: 'bg-white',
      iconBg: 'bg-slate-100 border-slate-200 text-slate-700',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs',
      badgeText: 'T-Accounts',
      badgeStyle: 'text-slate-800 bg-slate-100 border-slate-200 font-mono',
    },
    {
      title: 'Workforce & Collections',
      description: 'Audit shift cash collections, review workforce submission claims, and authorize handovers.',
      href: '/admin/cash-handovers',
      buttonText: 'Review Collections',
      icon: InChargeIcon,
      size: 'wide', // 2x1 Wide Card
      accentBorder: 'border-slate-200 hover:border-slate-300 hover:shadow-md',
      accentBg: 'bg-white',
      iconBg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs',
      badgeText: 'Shift Handover',
      badgeStyle: 'text-indigo-800 bg-indigo-50 border-indigo-200 font-mono',
    },
    {
      title: 'All Students',
      description: 'Manage student profiles, batches, and account balances.',
      href: '/admin/students',
      buttonText: 'Manage Students',
      icon: StudentsIcon,
      size: 'standard', // 1x1 Standard Card
      accentBorder: 'border-slate-200 hover:border-slate-300 hover:shadow-md',
      accentBg: 'bg-white',
      iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs',
      badgeText: 'Roster',
      badgeStyle: 'text-emerald-800 bg-emerald-50 border-emerald-200 font-mono',
    },
    {
      title: 'Financial Reports',
      description: 'Generate Trial Balance, Income Statement & Balance Sheet with instant exportable print options.',
      href: '/admin/reports',
      buttonText: 'Generate Reports',
      icon: ReportsIcon,
      size: 'compact', // 2x1 Compact Card
      accentBorder: 'border-slate-200 hover:border-slate-300 hover:shadow-md',
      accentBg: 'bg-white',
      iconBg: 'bg-slate-100 border-slate-200 text-slate-700',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs',
      badgeText: 'Financial Statements',
      badgeStyle: 'text-slate-800 bg-slate-100 border-slate-200 font-mono',
    },
    {
      title: 'Financial Year',
      description: 'Configure fiscal years and manage accounting period closures.',
      href: '/admin/financial-year',
      buttonText: 'Configure Year',
      icon: FinancialYearIcon,
      size: 'compact', // 2x1 Compact Card
      accentBorder: 'border-slate-200 hover:border-slate-300 hover:shadow-md',
      accentBg: 'bg-white',
      iconBg: 'bg-slate-100 border-slate-200 text-slate-700',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs',
      badgeText: 'Period Setup',
      badgeStyle: 'text-slate-800 bg-slate-100 border-slate-200 font-mono',
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Executive Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Live double-entry ledger analytics • Derived dynamically from database journal lines
          </p>
        </div>

        {/* Period Toggle & Date Picker Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto self-stretch sm:self-auto">
          <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setPeriodMode('today')}
              className={`flex-1 sm:flex-initial px-4 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                periodMode === 'today'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('month')}
              className={`flex-1 sm:flex-initial px-4 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                periodMode === 'month'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
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
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Credit Given
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold font-mono text-xs">
              <span className="font-sans">₹</span>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {loading ? (
              <span className="text-slate-400 animate-pulse"><span className="font-sans">₹</span>0.00</span>
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
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Cash Flow
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className={`text-2xl font-black font-mono ${metrics.cashFlow < 0 ? 'text-red-600' : metrics.cashFlow > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
            {loading ? (
              <span className="text-slate-400 animate-pulse"><span className="font-sans">₹</span>0.00</span>
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
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Expenses
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono flex items-center gap-1.5 flex-wrap">
            {loading ? (
              <span className="text-slate-400 animate-pulse"><span className="font-sans">₹</span>0.00</span>
            ) : (
              <>
                <span>{formatCurrency(metrics.totalExpenses)}</span>
                {metrics.totalExpenses < 0 && (
                  <span className="text-xs font-semibold text-amber-800 font-sans bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
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
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Net Surplus
            </span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className={`text-2xl font-black font-mono ${metrics.surplus < 0 ? 'text-red-600' : metrics.surplus > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
            {loading ? (
              <span className="text-slate-400 animate-pulse"><span className="font-sans">₹</span>0.00</span>
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
                  className={`border rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col justify-between transition-all duration-300 group ${card.accentBg} ${card.accentBorder} ${spanClasses}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 ${card.iconBg}`}>
                        <IconComponent className="w-7 h-7" />
                      </div>
                      <span className={`text-[11px] uppercase font-bold tracking-wider px-3 py-1 rounded-full border ${card.badgeStyle}`}>
                        {card.badgeText}
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2.5 leading-relaxed font-normal">
                      {card.description}
                    </p>

                    {/* Feature Highlight Pills */}
                    {card.features && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {card.features.map((feat, i) => (
                          <span
                            key={i}
                            className="text-[10px] sm:text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {feat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <Link
                    href={card.href}
                    className={`mt-6 w-full font-extrabold text-sm px-5 py-3.5 rounded-xl shadow-xs transition-all flex items-center justify-between gap-2 ${card.btnBg}`}
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
                  className={`border rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 group ${card.accentBg} ${card.accentBorder} ${spanClasses}`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-xs flex-shrink-0 transition-transform group-hover:scale-105 ${card.iconBg}`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                          {card.title}
                        </h3>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${card.badgeStyle}`}>
                          {card.badgeText}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={card.href}
                    className={`font-extrabold text-xs px-4 py-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 flex-shrink-0 w-full sm:w-auto ${card.btnBg}`}
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
                  className={`border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all duration-300 group ${card.accentBg} ${card.accentBorder} ${spanClasses}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 ${card.iconBg}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${card.badgeStyle}`}>
                        {card.badgeText}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      {card.description}
                    </p>

                    <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span>Double-Entry Validation</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Strict debit = credit assertion on every saved line.
                      </p>
                    </div>
                  </div>

                  <Link
                    href={card.href}
                    className={`mt-5 w-full font-bold text-xs px-3.5 py-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 ${card.btnBg}`}
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
                  className={`border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-300 group ${card.accentBg} ${card.accentBorder} ${spanClasses}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-xs flex-shrink-0 transition-transform group-hover:scale-105 ${card.iconBg}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate group-hover:text-emerald-700 transition-colors">
                          {card.title}
                        </h3>
                        <span className={`hidden sm:inline-block text-[9px] uppercase font-bold tracking-wider px-2 py-0.2 rounded-full border ${card.badgeStyle}`}>
                          {card.badgeText}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {card.description}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={card.href}
                    className={`font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 flex-shrink-0 ${card.btnBg}`}
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
                className={`border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all duration-300 group ${card.accentBg} ${card.accentBorder} ${spanClasses}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 ${card.iconBg}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.2 rounded-full border ${card.badgeStyle}`}>
                      {card.badgeText}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <Link
                  href={card.href}
                  className={`mt-3.5 w-full font-bold text-xs px-3 py-2 rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 ${card.btnBg}`}
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


    </main>
  );
}
