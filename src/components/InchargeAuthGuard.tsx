'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getValidSessionUser } from '@/services/authService';

export default function InchargeAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkInchargeAuth() {
      const sessionUser = await getValidSessionUser();

      if (!sessionUser.authenticated) {
        router.replace('/');
        return;
      }

      if (sessionUser.role !== 'incharge') {
        if (sessionUser.role === 'admin') {
          router.replace('/admin');
        } else if (sessionUser.role === 'student') {
          router.replace('/student');
        } else {
          router.replace('/');
        }
        return;
      }

      setAuthorized(true);
      setLoading(false);
    }

    checkInchargeAuth();
  }, [router]);

  if (loading || !authorized) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-600 font-mono">
          <span className="inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span>Verifying Workforce personnel session...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
