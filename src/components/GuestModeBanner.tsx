'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isGuestMode, disableGuestMode } from '@/lib/demo/demoStore';

export default function GuestModeBanner() {
  const router = useRouter();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isGuestMode());
  }, []);

  if (!active) return null;

  const handleExit = () => {
    disableGuestMode();
    router.push('/demo');
  };

  return (
    <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-950 px-4 py-2 text-xs font-semibold shadow-sm flex items-center justify-between z-50 relative print:hidden">
      <div className="flex items-center space-x-2">
        <span className="bg-emerald-600 text-white px-2 py-0.5 rounded font-black tracking-wider uppercase text-[10px]">
          Demo Mode
        </span>
        <span className="text-emerald-900 font-medium">
          You are viewing mock in-memory data. Changes are temporary and will reset on page refresh.
        </span>
      </div>
      <button
        onClick={handleExit}
        className="bg-white hover:bg-emerald-100 text-emerald-800 px-3 py-1 rounded text-xs font-bold transition-all border border-emerald-300 shadow-sm"
      >
        Exit Demo
      </button>
    </div>
  );
}
