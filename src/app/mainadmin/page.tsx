'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { loginAdmin, getValidSessionUser } from '@/services/authService';
import PasswordInput from '@/components/PasswordInput';

export default function AdminLoginPage() {
  const router = useRouter();
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function initCheck() {
      if (typeof window !== 'undefined') {
        const savedEmail = localStorage.getItem('saved_admin_email');
        const savedPass = localStorage.getItem('saved_admin_password');
        if (savedEmail) setAdminEmail(savedEmail);
        if (savedPass) setAdminPassword(savedPass);
      }

      const sessionUser = await getValidSessionUser();

      if (sessionUser.authenticated && sessionUser.role === 'admin') {
        router.replace('/admin');
        return;
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
      const res = await loginAdmin(adminEmail, adminPassword);
      if (res.success) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('saved_admin_email', adminEmail);
          localStorage.setItem('saved_admin_password', adminPassword);
          localStorage.setItem('lab_saved_token_admin', btoa(`${adminEmail}:${Date.now()}`));
        }
        router.push('/admin');
      } else {
        setError(res.error || 'Admin login failed. Please check credentials.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Admin login failed.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-400 p-0.5 shadow-xl shadow-blue-950/50 animate-pulse">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center border border-blue-500/30">
              <span className="text-2xl font-black tracking-wider bg-gradient-to-r from-blue-400 to-cyan-200 bg-clip-text text-transparent">
                LAB
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 font-mono">
            <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span>Verifying session...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-8 relative overflow-hidden selection:bg-blue-500 selection:text-slate-950">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-slate-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-400 p-0.5 shadow-xl shadow-blue-950/50">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center border border-blue-500/30">
              <span className="text-2xl font-black tracking-wider bg-gradient-to-r from-blue-400 to-cyan-200 bg-clip-text text-transparent">
                LAB
              </span>
            </div>
          </div>
          <div className="mt-3 text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">Lab Accounting</h1>
            <p className="text-xs text-slate-500 mt-0.5">Administration Portal</p>
          </div>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl shadow-slate-950 space-y-6"
        >
          <div>
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/80 border border-blue-800/60 px-2.5 py-1 rounded-full mb-2">
              Admin Portal
            </span>
            <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Admin Login</h2>
            <p className="text-xs text-slate-400 mt-1">Restricted to authorized administrators only.</p>
          </div>

          {error && (
            <div className="p-3.5 bg-red-950/60 border border-red-800/60 rounded-xl text-xs text-red-300 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                id="admin-email"
                name="username"
                type="email"
                required
                autoComplete="username"
                placeholder="Enter your email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <PasswordInput
                id="admin-password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                focusColor="blue"
                className="py-3"
              />
            </div>

            <button
              type="submit"
              id="admin-login-btn"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-950 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Admin Log In'
              )}
            </button>
          </form>
        </motion.div>

        <p className="text-[11px] text-center text-slate-600 mt-6">
          Lab Accounting System • Administration
        </p>
      </div>
    </main>
  );
}
