'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  loginStudent,
  loginIncharge,
  getValidSessionUser,
} from '@/services/authService';
import PasswordInput from '@/components/PasswordInput';

type LoginMode = 'student' | 'workforce';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>('student');
  const [checkingSession, setCheckingSession] = useState(true);

  // Student Form State
  const [studentPhone, setStudentPhone] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  // Workforce Form State
  const [workforceEmail, setWorkforceEmail] = useState('');
  const [workforcePassword, setWorkforcePassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // show_demo_button setting
  const [showDemoButton, setShowDemoButton] = useState(true);
  
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    async function initAuthCheck() {
      let isRedirecting = false;
      console.log('[AuthCheck] Starting session check on mount...');
      try {
        console.log('[AuthCheck] Fetching valid session user...');
        const sessionUser = await getValidSessionUser();
        
        if (!mounted) {
          console.log('[AuthCheck] Component unmounted, aborting redirect logic.');
          return;
        }
        
        if (sessionUser.authenticated) {
          console.log(`[AuthCheck] Valid session found! Redirecting to /${sessionUser.role}...`);
          isRedirecting = true;
          if (sessionUser.role === 'admin') {
            router.replace('/admin');
            return;
          } else if (sessionUser.role === 'student') {
            router.replace('/student');
            return;
          } else if (sessionUser.role === 'incharge') {
            router.replace('/incharge');
            return;
          }
        } else {
          console.log('[AuthCheck] No valid session found. Showing login tabs.');
        }

        // Fetch the show_demo_button setting
        console.log('[AuthCheck] Fetching demo settings...');
        try {
          const res = await fetch('/api/app-settings?key=show_demo_button');
          if (res.ok) {
            const json = await res.json();
            if (mounted) setShowDemoButton(json.value !== 'false');
          }
        } catch (fetchErr) {
          console.warn('[AuthCheck] Failed to fetch demo settings:', fetchErr);
          if (mounted) setShowDemoButton(true);
        }

      } catch (error) {
        console.error('[AuthCheck] Unexpected error during session check:', error);
      } finally {
        clearTimeout(timeoutId);
        if (mounted && !isRedirecting) {
          console.log('[AuthCheck] Check complete. Clearing loading state.');
          setCheckingSession(false);
        }
      }
    }

    // Safety timeout: If check hasn't resolved in 5 seconds, bail out of loading state.
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('[AuthCheck] Safety timeout triggered! Session check took > 5s. Bailing out.');
        setCheckingSession(false);
      }
    }, 5000);

    initAuthCheck();
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [router]);

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 p-0.5 shadow-xl shadow-emerald-950/50 animate-pulse">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center border border-emerald-500/30">
              <span className="text-2xl font-black tracking-wider bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                LAB
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 font-mono">
            <span className="inline-block w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <span>Restoring session...</span>
          </div>
        </div>
      </main>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await loginStudent(studentPhone, studentPassword);
      if (res.success) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('saved_student_phone', studentPhone);
          localStorage.setItem('saved_student_password', studentPassword);
          localStorage.setItem('lab_saved_token_student', btoa(`${studentPhone}:${Date.now()}`));
        }
        router.push('/student');
      } else {
        setError(res.error || 'Login failed. Please check your phone and password.');
        setLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed.');
      setLoading(false);
    }
  };

  const handleWorkforceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await loginIncharge(workforceEmail, workforcePassword);
      if (res.success) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('saved_incharge_email', workforceEmail);
          localStorage.setItem('saved_incharge_password', workforcePassword);
        }
        router.push('/incharge');
      } else {
        setError(res.error || 'Workforce login failed. Please check credentials.');
        setLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Workforce login failed.');
      setLoading(false);
    }
  };

  // Logo click: toggle between student and workforce
  const handleLogoClick = () => {
    setMode((prev) => (prev === 'student' ? 'workforce' : 'student'));
    setError(null);
  };

  const isWorkforce = mode === 'workforce';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-8 relative overflow-hidden selection:bg-emerald-500 selection:text-slate-950">
      {/* Background glow graphics */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* LOGO — click to toggle Student ↔ Workforce */}
        <div className="flex flex-col items-center mb-8">
          <button
            type="button"
            onClick={handleLogoClick}
            className="group focus:outline-none flex flex-col items-center cursor-pointer transition-transform active:scale-95"
            title={isWorkforce ? 'Switch to Student Login' : 'Switch to Workforce Login'}
          >
            <div
              className={`w-16 h-16 rounded-2xl p-0.5 shadow-xl transition-all duration-300 ${
                isWorkforce
                  ? 'bg-gradient-to-tr from-indigo-600 to-cyan-400 shadow-indigo-950/50 group-hover:shadow-indigo-500/20'
                  : 'bg-gradient-to-tr from-emerald-600 to-emerald-400 shadow-emerald-950/50 group-hover:shadow-emerald-500/20'
              }`}
            >
              <div
                className={`w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center border transition-all duration-300 ${
                  isWorkforce
                    ? 'border-indigo-500/30 group-hover:border-indigo-400'
                    : 'border-emerald-500/30 group-hover:border-emerald-400'
                }`}
              >
                <span
                  className={`text-2xl font-black tracking-wider bg-clip-text text-transparent transition-all duration-300 ${
                    isWorkforce
                      ? 'bg-gradient-to-r from-indigo-400 to-cyan-200'
                      : 'bg-gradient-to-r from-emerald-400 to-teal-200'
                  }`}
                >
                  LAB
                </span>
              </div>
            </div>

            <div className="mt-3 text-center">
              <h1 className="text-xl font-bold text-white tracking-tight">Lab Accounting</h1>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isWorkforce ? 'Tap logo for Student login' : 'Tap logo for Workforce login'}
              </p>
            </div>
          </button>
        </div>

        {/* FORM CONTAINER */}
        <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl shadow-slate-950 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {/* ── STUDENT LOGIN ── */}
            {!isWorkforce && (
              <motion.div
                key="student-form"
                initial={{ opacity: 0, x: -22, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 22, scale: 0.98 }}
                transition={{ duration: 0.24, ease: 'easeInOut' }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Student Login</h2>
                </div>

                {error && (
                  <div className="p-3.5 bg-red-950/60 border border-red-800/60 rounded-xl text-xs text-red-300 font-medium">
                    {error}
                  </div>
                )}

                <form onSubmit={handleStudentSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      id="student-phone"
                      name="username"
                      type="tel"
                      required
                      placeholder="Enter your phone number"
                      autoComplete="username"
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Password
                    </label>
                    <PasswordInput
                      id="student-password"
                      name="password"
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={studentPassword}
                      onChange={(e) => setStudentPassword(e.target.value)}
                      focusColor="emerald"
                      className="py-3"
                    />
                  </div>

                  <button
                    type="submit"
                    id="student-login-btn"
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-950 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Log In'
                    )}
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-800 text-center">
                  <span className="text-xs text-slate-400">New here? </span>
                  <Link
                    href="/register"
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
                  >
                    Register
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ── WORKFORCE LOGIN ── */}
            {isWorkforce && (
              <motion.div
                key="workforce-form"
                initial={{ opacity: 0, x: 22, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -22, scale: 0.98 }}
                transition={{ duration: 0.24, ease: 'easeInOut' }}
                className="space-y-6"
              >
                <div>
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 border border-indigo-800/60 px-2.5 py-1 rounded-full mb-2">
                    Workforce Portal
                  </span>
                  <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Workforce Log In</h2>
                </div>

                {error && (
                  <div className="p-3.5 bg-red-950/60 border border-red-800/60 rounded-xl text-xs text-red-300 font-medium">
                    {error}
                  </div>
                )}

                <form onSubmit={handleWorkforceSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Workforce Email Address
                    </label>
                    <input
                      id="workforce-email"
                      name="username"
                      type="email"
                      required
                      autoComplete="username"
                      placeholder="incharge@lab.com"
                      value={workforceEmail}
                      onChange={(e) => setWorkforceEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Password
                    </label>
                    <PasswordInput
                      id="workforce-password"
                      name="password"
                      required
                      autoComplete="current-password"
                      placeholder="Enter password"
                      value={workforcePassword}
                      onChange={(e) => setWorkforcePassword(e.target.value)}
                      focusColor="indigo"
                      className="py-3"
                    />
                  </div>

                  <button
                    type="submit"
                    id="workforce-login-btn"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-950 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Log In to Workforce Portal'
                    )}
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('student'); setError(null); }}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Back to <span className="font-semibold text-emerald-400">Student Login</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* GUEST MODE BUTTON — controlled by admin setting */}
        {showDemoButton && (
          <div className="mt-6 flex flex-col items-center space-y-2">
            <button
              type="button"
              id="guest-mode-btn"
              onClick={() => router.push('/demo')}
              className="w-full bg-slate-900/80 hover:bg-slate-800/90 active:bg-slate-950 text-amber-300 font-semibold py-3 px-4 rounded-xl border border-amber-500/30 hover:border-amber-400/60 transition-all flex items-center justify-center gap-2.5 text-xs shadow-lg shadow-amber-950/20 group"
            >
              <svg className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>Try Guest Mode (Select Demo View)</span>
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Explore Student or Admin views with mock data. Zero DB writes.
            </p>
          </div>
        )}

        <p className="text-[11px] text-center text-slate-500 mt-6">
          Lab Accounting System • Non-Profit Student Printing Service
        </p>
      </div>
    </main>
  );
}
