'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getValidSessionUser } from '@/services/authService';

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const sessionUser = await getValidSessionUser();

      if (!sessionUser.authenticated) {
        router.replace('/');
        return;
      }

      const isDebitBook = pathname === '/admin/ledger' || pathname?.startsWith('/admin/ledger/');

      // Workforce / In-Charge Scope: Authorized ONLY on Debit Book (/admin/ledger)
      if (sessionUser.role === 'incharge') {
        if (isDebitBook) {
          setAuthorized(true);
          setLoading(false);
        } else {
          // Restricted from all other admin pages; route back to their dedicated portal
          router.replace('/incharge');
        }
        return;
      }

      // Admin Scope: Authorized on all /admin pages
      if (sessionUser.role === 'admin') {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      // Students should not access admin layout
      if (sessionUser.role === 'student') {
        router.replace('/student');
        return;
      }

      // Any other role or unauthenticated
      router.replace('/');
    }

    checkAuth();
  }, [router, pathname]);

  if (loading || !authorized) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-600 font-mono">
          <span className="inline-block w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span>Verifying portal access...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

