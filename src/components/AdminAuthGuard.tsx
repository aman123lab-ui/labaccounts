'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getValidSessionUser } from '@/services/authService';

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdminAuth() {
      const sessionUser = await getValidSessionUser();

      if (!sessionUser.authenticated) {
        router.replace('/');
        return;
      }

      if (sessionUser.role !== 'admin') {
        if (sessionUser.role === 'student') {
          router.replace('/student');
        } else {
          router.replace('/');
        }
        return;
      }

      setAuthorized(true);
      setLoading(false);
    }

    checkAdminAuth();
  }, [router]);

  if (loading || !authorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-400 font-mono">
          <span className="inline-block w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span>Verifying admin session...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
