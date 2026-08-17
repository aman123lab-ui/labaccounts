'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setGuestRole } from '@/lib/demo/demoStore';


export default function GuestModeRoleSelectionPage() {
  const router = useRouter();

  const handleSelectRole = (role: 'student' | 'incharge' | 'admin') => {
    setGuestRole(role);
    if (role === 'student') {
      router.push('/student?demo=true');
    } else if (role === 'incharge') {
      router.push('/incharge?demo=true');
    } else {
      router.push('/admin?demo=true');
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-8 relative overflow-hidden selection:bg-emerald-500 selection:text-slate-950">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-1/3 w-[450px] h-[450px] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-10 right-10 w-[350px] h-[350px] bg-amber-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-5xl z-10 space-y-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-amber-950/80 border border-amber-500/40 text-amber-300 px-3.5 py-1.5 rounded-full text-xs font-bold font-mono shadow-lg shadow-amber-950/50">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>INTERACTIVE DEMO EXPERIENCE</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Choose a Demo Role
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Explore the Lab Accounting System from any perspective. All data is isolated client-side with zero real database writes.
          </p>
        </div>

        {/* 2 Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── STUDENT ── */}
          <div
            onClick={() => handleSelectRole('student')}
            className="group relative bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 sm:p-7 shadow-xl hover:shadow-2xl hover:shadow-emerald-950/40 transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-900/60 transition-all shadow-md">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2.5 py-1 rounded-full">
                  Student
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Student Portal
                </h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  See what students see — balance, statement, and UPI payment flow.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span> Real-time outstanding balance
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span> Account statement of print debits
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span> UPI Pay Now &amp; claim tracking
                </div>
              </div>


            </div>

            <div className="mt-6">
              <button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs py-3 px-4 rounded-xl shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 group-hover:gap-3"
              >
                <span>Enter Student Demo</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* ── ADMIN ── */}
          <div
            onClick={() => handleSelectRole('admin')}
            className="group relative bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 sm:p-7 shadow-xl hover:shadow-2xl hover:shadow-amber-950/40 transition-all duration-300 cursor-pointer flex flex-col justify-between md:col-span-1"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 rounded-xl bg-amber-950 border border-amber-800/60 flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:bg-amber-900/60 transition-all shadow-md">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-800/80 px-2.5 py-1 rounded-full">
                  Full Access
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                  Admin Portal
                </h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  The full admin experience — dashboard, ledger, reports, and more.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-amber-400">✓</span> Double-Entry Ledger &amp; Financial Reports
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-amber-400">✓</span> Financial Year Rollover &amp; Undo
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-amber-400">✓</span> Workforce Management &amp; Cash Handovers
                </div>
              </div>


            </div>

            <div className="mt-6">
              <button
                type="button"
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-3 px-4 rounded-xl shadow-lg shadow-amber-950/50 transition-all flex items-center justify-center gap-2 group-hover:gap-3"
              >
                <span>Enter Admin Demo</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Zero DB note */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <svg className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>All demo data is in-memory only — no real database writes, no real accounts affected.</span>
        </div>

        {/* Back Link */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-2 px-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900"
          >
            <span>← Return to Main Login Page</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
