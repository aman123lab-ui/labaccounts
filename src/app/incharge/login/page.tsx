'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { loginIncharge, getValidSessionUser } from '@/services/authService';
import PasswordInput from '@/components/PasswordInput';
import { enableGuestMode } from '@/lib/demo/demoStore';

export default function InchargeLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function initCheck() {
      if (typeof window !== 'undefined') {
        const savedEmail = localStorage.getItem('saved_incharge_email');
        const savedPass = localStorage.getItem('saved_incharge_password');
        const savedRem = localStorage.getItem('remember_incharge');

        if (savedEmail) setEmail(savedEmail);
        if (savedPass) setPassword(savedPass);
        if (savedRem !== null) setRemember(savedRem === 'true');
      }

      const sessionUser = await getValidSessionUser();
      if (sessionUser.authenticated) {
        if (sessionUser.role === 'incharge' || sessionUser.role === 'admin') {
          router.replace('/incharge');
          return;
        } else if (sessionUser.role === 'student') {
          router.replace('/student');
          return;
        }
      }

      setCheckingSession(false);
    }

    initCheck();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await loginIncharge(email, password);
      if (res.success) {
        if (typeof window !== 'undefined') {
          if (remember) {
            localStorage.setItem('saved_incharge_email', email);
            localStorage.setItem('saved_incharge_password', password);
            localStorage.setItem('remember_incharge', 'true');
          } else {
            localStorage.removeItem('saved_incharge_email');
            localStorage.removeItem('saved_incharge_password');
            localStorage.setItem('remember_incharge', 'false');
          }
        }
        router.push('/incharge');
      } else {
        setError(res.error || 'Workforce login failed. Please check credentials.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStartGuestMode = () => {
    router.push('/demo');
  };

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 p-0.5 shadow-xl shadow-indigo-950/50 animate-pulse">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center border border-indigo-500/30">
              <span className="text-xl font-black tracking-wider bg-gradient-to-r from-indigo-400 to-cyan-200 bg-clip-text text-transparent">
                LAB
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 font-mono">
            <span className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span>Restoring session...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-8 relative overflow-hidden selection:bg-indigo-500 selection:text-slate-950">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-cyan-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Header Header & Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-400 p-0.5 shadow-xl shadow-indigo-950/50">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center border border-indigo-500/30">
              <span className="text-xl font-black tracking-wider bg-gradient-to-r from-indigo-400 to-cyan-200 bg-clip-text text-transparent">
                LAB
              </span>
            </div>
          </div>
          <div className="mt-3 text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">Workforce Personnel Portal</h1>
            <p className="text-xs text-slate-400 mt-1">Workforce & Counter Cash Management</p>
          </div>
        </div>

        {/* Card Form */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl shadow-slate-950 relative overflow-hidden space-y-6"
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Workforce Email Address
              </label>
              <input
                type="email"
                required
                placeholder="incharge@lab.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <PasswordInput
                required
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                focusColor="indigo"
                className="py-3"
              />
            </div>



            <button
              type="submit"
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

          <div className="pt-4 border-t border-slate-800 text-center space-y-2">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors block"
            >
              Return to <span className="font-semibold text-emerald-400">Student / Admin Login</span>
            </Link>
          </div>
        </motion.div>

        {/* Guest Mode Demo Shortcut */}
        <div className="mt-6 flex flex-col items-center">
          <button
            type="button"
            onClick={handleStartGuestMode}
            className="w-full bg-slate-900/80 hover:bg-slate-800/90 active:bg-slate-950 text-amber-300 font-semibold py-3 px-4 rounded-xl border border-amber-500/30 hover:border-amber-400/60 transition-all flex items-center justify-center gap-2.5 text-xs shadow-lg shadow-amber-950/20 group"
          >
            <svg className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Try Demo Mode (Explore Workforce Portal)</span>
          </button>
        </div>

        <p className="text-[11px] text-center text-slate-500 mt-6">
          Lab Accounting System • Workforce Interface
        </p>
      </div>
    </main>
  );
}
