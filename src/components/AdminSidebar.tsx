'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logoutUser, getValidSessionUser, SessionUserInfo } from '@/services/authService';
import { getPendingClaimsCount } from '@/services/paymentClaimsService';
import { getPendingHandoverClaimsCount } from '@/services/cashHandoverService';
import {
  DashboardIcon,
  DebitBookIcon,
  IncomeExpenseIcon,
  PaymentClaimsIcon,
  InChargeIcon,
  JournalIcon,
  LedgerAccountsIcon,
  StudentsIcon,
  ReportsIcon,
  FinancialYearIcon,
  MenuIcon,
  CloseIcon,
  LogOutIcon,
  SettingsIcon,
} from './NavIcons';

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingClaimsCount, setPendingClaimsCount] = useState<number>(0);
  const [pendingHandoversCount, setPendingHandoversCount] = useState<number>(0);
  const [sessionUser, setSessionUser] = useState<SessionUserInfo | null>(null);

  // Mobile drawer open state
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadUser() {
      const user = await getValidSessionUser();
      setSessionUser(user);
    }
    loadUser();
  }, []);

  useEffect(() => {
    async function fetchPendingCounts() {
      const claimsCount = await getPendingClaimsCount();
      const handoversCount = await getPendingHandoverClaimsCount();
      setPendingClaimsCount(claimsCount);
      setPendingHandoversCount(handoversCount);
    }
    fetchPendingCounts();
    const interval = setInterval(fetchPendingCounts, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logoutUser();
    router.push('/');
  };

  const isWorkforce = sessionUser?.role === 'incharge';
  const roleBadgeLabel = isWorkforce ? (sessionUser.inchargeName || 'Workforce') : 'Admin';
  const homeHref = isWorkforce ? '/incharge' : '/admin';
  const portalSubtitle = isWorkforce ? 'Workforce Portal' : 'System Admin Portal';

  const navItems = isWorkforce
    ? [
        { label: 'Workforce Portal', href: '/incharge', icon: InChargeIcon },
        { label: 'Debit Book', href: '/admin/ledger', icon: DebitBookIcon },
      ]
    : [
        { label: 'Dashboard', href: '/admin', icon: DashboardIcon },
        { label: 'All Students', href: '/admin/students', icon: StudentsIcon },
        { label: 'Debit Book', href: '/admin/ledger', icon: DebitBookIcon },
        { label: 'Journal Entry', href: '/admin/journal', icon: JournalIcon },
        { label: 'Ledger Accounts', href: '/admin/ledger-accounts', icon: LedgerAccountsIcon },
        { label: 'Income & Expense', href: '/admin/income-expense', icon: IncomeExpenseIcon },
        { label: 'Workforce & Collections', href: '/admin/cash-handovers', icon: InChargeIcon, badge: pendingHandoversCount },
        { label: 'Payment Claims', href: '/admin/payment-claims', icon: PaymentClaimsIcon, badge: pendingClaimsCount },
        { label: 'Reports', href: '/admin/reports', icon: ReportsIcon },
        { label: 'Financial Year', href: '/admin/financial-year', icon: FinancialYearIcon },
        { label: 'Settings', href: '/admin/settings', icon: SettingsIcon },
      ];

  return (
    <>
      {/* ========================================================================= */}
      {/* MOBILE TOP BAR (Always visible in normal document flow on mobile)         */}
      {/* ========================================================================= */}
      <header className="md:hidden h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 w-full flex-shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
          </button>
          <Link href={homeHref} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-white text-xs shadow-sm">
              LA
            </div>
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">Lab Accounting</span>
          </Link>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          {roleBadgeLabel}
        </span>
      </header>

      {/* ========================================================================= */}
      {/* MOBILE OFF-CANVAS DRAWER & BACKDROP (Fixed overlay, zero layout space)   */}
      {/* ========================================================================= */}
      {/* Backdrop Overlay */}
      <div
        className={`md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity duration-300 print:hidden ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Off-canvas Drawer Panel */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] bg-white border-r border-slate-200 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col print:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 flex-shrink-0">
          <Link href={homeHref} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-white text-xs shadow-sm">
              LA
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-slate-900 text-sm tracking-tight leading-tight">LAB</span>
              <span className="text-[10px] text-slate-500 font-medium">Lab Accounting</span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Nav Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-200">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(`${item.href}/`));
            const IconComponent = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-bold border border-slate-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <IconComponent className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`} />
                <span className="flex-1 truncate">{item.label}</span>
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Mobile Bottom Footer */}
        <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50 flex-shrink-0">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-600 font-medium">Active Session</span>
            <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
              Role: {roleBadgeLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-200 font-semibold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <LogOutIcon className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* DESKTOP LEFT SIDEBAR (Sticky full-height sidebar for md screens and up) */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex flex-col bg-white border-r border-slate-200 sticky top-0 h-screen z-40 flex-shrink-0 w-64 print:hidden">
        {/* Sidebar Header: Logo */}
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
          <Link href={homeHref} className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-white text-xs shadow-xs flex-shrink-0">
              LA
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-slate-900 text-xs sm:text-sm tracking-tight whitespace-nowrap truncate">
                LAB — Lab Accounting
              </span>
              <span className="text-[10px] text-slate-500 font-mono font-normal">
                {portalSubtitle}
              </span>
            </div>
          </Link>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3 scrollbar-thin scrollbar-thumb-slate-200">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(`${item.href}/`));
            const IconComponent = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-bold border border-slate-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                {/* Active left indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-600 rounded-r-full" />
                )}

                <IconComponent
                  className={`w-5 h-5 flex-shrink-0 transition-colors ${
                    isActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-slate-700'
                  }`}
                />

                <span className="flex-1 truncate">{item.label}</span>

                {/* Badges */}
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[10px] font-mono px-2 py-0.5 rounded-full shadow-2xs flex-shrink-0">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer: Role & Logout */}
        <div className="p-3 border-t border-slate-200 space-y-2 bg-slate-50 flex-shrink-0">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-slate-500 font-medium">Portal Access</span>
            <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
              Role: {roleBadgeLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-200 font-semibold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors group"
          >
            <LogOutIcon className="w-4 h-4 text-slate-500 group-hover:text-red-600 transition-colors" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
