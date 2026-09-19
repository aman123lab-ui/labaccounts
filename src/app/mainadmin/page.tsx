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
      <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center font-black text-white text-xl shadow-xs">
            LA
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 font-mono">
            <span className="inline-block w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            <span>Verifying session...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4 sm:p-8 relative overflow-hidden">
      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center font-black text-white text-xl shadow-xs mb-3">
            LA
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Lab Accounting</h1>
            <p className="text-xs text-slate-500 mt-0.5">Administration Portal</p>
          </div>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="bg-white border border-slate-200 p-8 rounded-2xl shadow-xs space-y-6"
        >
          <div>
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full mb-2 font-mono">
              Admin Portal
            </span>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Login</h2>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                focusColor="emerald"
                variant="light"
                className="py-3"
              />
            </div>

            <button
              type="submit"
              id="admin-login-btn"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Admin Log In'
              )}
            </button>
          </form>
        </motion.div>

        <p className="text-[11px] text-center text-slate-500 mt-6">
          Lab Accounting System • Administration
        </p>
      </div>
    </main>
  );
}
