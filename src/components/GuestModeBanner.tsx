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
    <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2 text-xs font-semibold shadow-md flex items-center justify-between z-50 relative print:hidden">
      <div className="flex items-center space-x-2">
        <span className="bg-white/20 text-white px-2 py-0.5 rounded font-black tracking-wider uppercase text-[10px]">
          Demo Mode
        </span>
        <span>
          You are viewing mock in-memory data. Changes are temporary and will reset on page refresh. Zero database writes.
        </span>
      </div>
      <button
        onClick={handleExit}
        className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-xs font-bold transition-all border border-white/30 hover:shadow-sm"
      >
        Exit Demo
      </button>
    </div>
  );
}
