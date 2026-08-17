'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logoutUser } from '@/services/authService';
import { getPendingClaimsCount } from '@/services/paymentClaimsService';
import { getPendingHandoverClaimsCount } from '@/services/cashHandoverService';

export default function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingClaimsCount, setPendingClaimsCount] = useState<number>(0);
  const [pendingHandoversCount, setPendingHandoversCount] = useState<number>(0);

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

  const handleLogout = async () => {
    await logoutUser();
    router.push('/');
  };

  const navItems = [
    { label: 'Dashboard', href: '/admin' },
    { label: 'Debit Book', href: '/admin/ledger' },
    { label: 'Payment Claims', href: '/admin/payment-claims', badge: pendingClaimsCount },
    { label: 'Workforce & Collections', href: '/admin/cash-handovers', badge: pendingHandoversCount },
    { label: 'Journal Entry', href: '/admin/journal' },
    { label: 'Ledger Accounts', href: '/admin/ledger-accounts' },
    { label: 'All Students', href: '/admin/students' },
    { label: 'Reports', href: '/admin/reports' },
    { label: 'Financial Year', href: '/admin/financial-year' },
  ];

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md w-full flex-shrink-0 print:hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-16 flex items-center justify-between gap-2 w-full">
        {/* Logo / Brand Title */}
        <Link href="/admin" className="flex items-center gap-2 flex-shrink-0 z-20 bg-slate-900 pr-2 whitespace-nowrap group">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-white text-xs shadow-md flex-shrink-0">
            LA
          </div>
          <span className="font-extrabold text-white text-xs sm:text-sm tracking-tight group-hover:text-emerald-400 transition-colors whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1">
            <span>Lab Accounting</span>
            <span className="hidden xl:inline text-xs font-mono font-normal text-slate-400 whitespace-nowrap">| Admin</span>
          </span>
        </Link>

        {/* Navigation Items (Clean horizontal scroll on overflow, no leftwards text overlap) */}
        <nav className="flex items-center justify-start lg:justify-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-1 min-w-0 flex-1 whitespace-nowrap">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-2 sm:px-2.5 py-1.2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span>{item.label}</span>
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="bg-amber-500 text-slate-950 font-black text-[9px] sm:text-[10px] font-mono px-1.5 py-0.2 rounded-full animate-pulse shadow-sm flex-shrink-0">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Controls: Role & Logout */}
        <div className="flex items-center gap-2 flex-shrink-0 z-20 bg-slate-900 pl-2 whitespace-nowrap">
          <span className="hidden xl:inline-flex items-center whitespace-nowrap text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-950 text-slate-300 border border-slate-800 flex-shrink-0">
            Role: Admin
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
          >
            Log Out
          </button>
        </div>
      </div>
    </header>
  );
}
