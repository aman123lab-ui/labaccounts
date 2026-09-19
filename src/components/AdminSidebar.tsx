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
        { label: 'Students', href: '/admin/students', icon: StudentsIcon },
        { label: 'Debit Book', href: '/admin/ledger', icon: DebitBookIcon },
        { label: 'Journals', href: '/admin/journal', icon: JournalIcon },
        { label: 'Ledgers', href: '/admin/ledger-accounts', icon: LedgerAccountsIcon },
        { label: 'Income & Expense', href: '/admin/income-expense', icon: IncomeExpenseIcon },
        { label: 'Workforce', href: '/admin/cash-handovers', icon: InChargeIcon, badge: pendingHandoversCount },
        { label: 'Claims', href: '/admin/payment-claims', icon: PaymentClaimsIcon, badge: pendingClaimsCount },
        { label: 'Reports', href: '/admin/reports', icon: ReportsIcon },
        { label: 'Financial Year', href: '/admin/financial-year', icon: FinancialYearIcon },
        { label: 'Settings', href: '/admin/settings', icon: SettingsIcon },
      ];

  // Active item title for the topbar
  const activeItem = navItems.find((item) => pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(`${item.href}/`))) || navItems[0];

  return (
    <>
      {/* ========================================================================= */}
      {/* SLIM TOP NAVBAR (~56px)                                                  */}
      {/* ========================================================================= */}
      <header className="h-14 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between sticky top-0 z-40 w-full shrink-0 shadow-sm print:hidden">
        {/* LEFT: Logo & Active Section */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            className="md:hidden p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {isMobileOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>

          <Link href={homeHref} className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-white text-xs shadow-sm">
              LA
            </div>
            <span className="hidden xl:inline font-bold text-slate-900 text-sm tracking-tight">{portalSubtitle}</span>
          </Link>
          <div className="hidden md:block w-px h-4 bg-slate-200 mx-2 shrink-0" />
          
          {/* Desktop Horizontal Nav Links */}
          <nav className="hidden md:flex flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth min-w-0 pr-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(`${item.href}/`));
              
              if (item.label === 'Settings') {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-center p-1.5 rounded-md transition-colors ml-auto ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Settings"
                  >
                    <item.icon className="w-4 h-4" />
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors group ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>{item.label}</span>
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className={`font-mono text-[9px] px-1 py-0.5 rounded-md ml-0.5 ${
                      isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700 group-hover:bg-slate-300'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          
          <span className="md:hidden font-bold text-slate-800 text-sm ml-1 truncate">{activeItem.label}</span>
        </div>

        {/* RIGHT: Role, Avatar, Logout */}
        <div className="flex items-center gap-3 md:gap-4">
          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/50 hidden sm:inline-block">
            {roleBadgeLabel}
          </span>
          <div className="w-px h-4 bg-slate-200 hidden sm:block" />
          <button
            type="button"
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-600 transition-colors p-1"
            title="Log out"
          >
            <LogOutIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MOBILE OFF-CANVAS DRAWER                                                  */}
      {/* ========================================================================= */}
      <div
        className={`md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 transition-opacity duration-200 print:hidden ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileOpen(false)}
      />

      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl transition-transform duration-300 flex flex-col print:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-100">
          <span className="font-bold text-slate-900 text-sm">Navigation</span>
          <button onClick={() => setIsMobileOpen(false)} className="p-1 text-slate-400 hover:text-slate-800">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="flex-1">{item.label}</span>
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="bg-emerald-100 text-emerald-800 font-mono text-[10px] px-1.5 py-0.5 rounded-md">{item.badge}</span>
                )}
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}
