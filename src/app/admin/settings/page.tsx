'use client';

import React, { useState, useEffect } from 'react';
import {
  getPrintingRates,
  setPrintingRates,
  DEFAULT_PRINTING_RATES,
  PrintingRatesConfig,
  calculatePrintAmount,
} from '@/config/printingRates';
import { isGuestMode, getDemoInchargeStaff, getDemoStudents } from '@/lib/demo/demoStore';
import { getStudents, StudentWithDetails } from '@/services/studentService';
import PasswordInput from '@/components/PasswordInput';

export interface WorkerItem {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  staff_id?: string;
}

export default function AdminSettingsPage() {


  // Alerts
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ----------------------------------------------------
  // 3. DEMO PAGE ACCESS SETTING
  // ----------------------------------------------------
  const [showDemoButton, setShowDemoButton] = useState<boolean | null>(null);
  const [savingDemoSetting, setSavingDemoSetting] = useState(false);

  useEffect(() => {
    async function fetchDemoSetting() {
      try {
        const res = await fetch('/api/app-settings?key=show_demo_button');
        if (res.ok) {
          const json = await res.json();
          setShowDemoButton(json.value !== 'false');
        } else {
          setShowDemoButton(true);
        }
      } catch {
        setShowDemoButton(true);
      }
    }
    fetchDemoSetting();
  }, []);

  const handleToggleDemoButton = async (newValue: boolean) => {
    setSavingDemoSetting(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    const prev = showDemoButton;
    setShowDemoButton(newValue); // Optimistic update
    try {
      const res = await fetch('/api/app-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'show_demo_button', value: String(newValue) }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMsg(
          newValue
            ? 'Demo page access option turned ON! "Try Guest Mode" button is now visible on the login screen.'
            : 'Demo page access option turned OFF! "Try Guest Mode" button is now hidden from the login screen.'
        );
      } else {
        setShowDemoButton(prev);
        setErrorMsg(json.error || 'Failed to update demo setting.');
      }
    } catch (err: any) {
      setShowDemoButton(prev);
      setErrorMsg(err?.message || 'Failed to update demo setting.');
    } finally {
      setSavingDemoSetting(false);
    }
  };


  // ----------------------------------------------------
  // 1. PRINTING RATES STATE
  // ----------------------------------------------------
  const [rates, setRatesState] = useState<PrintingRatesConfig>({
    bw_single: 3.0,
    bw_double: 4.0,
    color_single: 10.0,
    color_double: 20.0,
  });
  const [savingRates, setSavingRates] = useState(false);

  // Rate calculator preview state
  const [calcPages, setCalcPages] = useState<number>(10);
  const [calcType, setCalcType] = useState<'bw' | 'color'>('bw');
  const [calcSide, setCalcSide] = useState<'single' | 'double'>('double');

  // Load printing rates on mount
  useEffect(() => {
    const current = getPrintingRates();
    setRatesState(current);
  }, []);

  const handleRateChange = (field: keyof PrintingRatesConfig, value: string) => {
    const numVal = Math.max(0, parseFloat(value) || 0);
    setRatesState((prev) => ({
      ...prev,
      [field]: numVal,
    }));
  };

  const handleSaveRates = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRates(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      setPrintingRates(rates);
      setSuccessMsg('Default printing rates updated successfully! All print calculations will now use these new rates.');
    } catch (err: any) {
      setErrorMsg('Failed to save printing rates.');
    } finally {
      setSavingRates(false);
    }
  };

  const handleResetRates = () => {
    setRatesState(DEFAULT_PRINTING_RATES);
    setPrintingRates(DEFAULT_PRINTING_RATES);
    setSuccessMsg('Printing rates reset to factory defaults (₹3.00, ₹4.00, ₹10.00, ₹20.00).');
  };

  // ----------------------------------------------------
  // 2. PASSWORD MANAGEMENT STATE
  // ----------------------------------------------------
  const [passwordRole, setPasswordRole] = useState<'admin' | 'worker' | 'student'>('admin');

  // Admin Password
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirm, setAdminConfirm] = useState('');
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

  // Worker Password
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [workerPassword, setWorkerPassword] = useState('');
  const [workerConfirm, setWorkerConfirm] = useState('');
  const [submittingWorker, setSubmittingWorker] = useState(false);

  // Student Password
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentConfirm, setStudentConfirm] = useState('');
  const [submittingStudent, setSubmittingStudent] = useState(false);

  // Load workers & students for selectors
  useEffect(() => {
    async function loadData() {
      if (isGuestMode()) {
        const demoStaff = getDemoInchargeStaff();
        setWorkers(
          demoStaff.map((s) => ({
            id: s.id,
            user_id: s.user_id,
            name: s.name,
            email: s.email,
            staff_id: (s as any).staff_id,
          }))
        );
        const demoSt = getDemoStudents({ status: 'active' });
        setStudents(demoSt as any);
      } else {
        try {
          const [resIncharge, stRes] = await Promise.all([
            fetch('/api/admin/incharge').then((r) => r.json()),
            getStudents({ status: 'active' }),
          ]);
          if (resIncharge.success) {
            setWorkers(resIncharge.staffList || []);
          }
          setStudents(stRes || []);
        } catch (err) {
          console.error('Failed to load password selector data:', err);
        }
      }
    }
    loadData();
  }, []);

  // Filter students based on search
  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.phone.includes(studentSearch) ||
      (s.batch_name && s.batch_name.toLowerCase().includes(studentSearch.toLowerCase()))
  );

  // Handle Admin Password Change
  const handleAdminPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!adminPassword || adminPassword.length < 6) {
      setErrorMsg('Admin password must be at least 6 characters long.');
      return;
    }
    if (adminPassword !== adminConfirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmittingAdmin(true);

    try {
      if (isGuestMode()) {
        setSuccessMsg('Admin password updated successfully (Demo Mode)!');
        setAdminPassword('');
        setAdminConfirm('');
      } else {
        const res = await fetch('/api/admin/settings/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'admin',
            newPassword: adminPassword,
          }),
        }).then((r) => r.json());

        if (res.success) {
          setSuccessMsg('Admin password updated successfully!');
          setAdminPassword('');
          setAdminConfirm('');
        } else {
          setErrorMsg(res.error || 'Failed to update admin password.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error changing admin password.');
    } finally {
      setSubmittingAdmin(false);
    }
  };

  // Handle Worker Password Change
  const handleWorkerPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!selectedWorkerId) {
      setErrorMsg('Please select a workforce member.');
      return;
    }
    if (!workerPassword || workerPassword.length < 6) {
      setErrorMsg('Worker password must be at least 6 characters long.');
      return;
    }
    if (workerPassword !== workerConfirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    const targetWorker = workers.find((w) => w.id === selectedWorkerId || w.user_id === selectedWorkerId);
    if (!targetWorker) {
      setErrorMsg('Selected workforce member not found.');
      return;
    }

    setSubmittingWorker(true);

    try {
      if (isGuestMode()) {
        setSuccessMsg(`Password for workforce member '${targetWorker.name}' updated successfully (Demo Mode)!`);
        setWorkerPassword('');
        setWorkerConfirm('');
      } else {
        const res = await fetch('/api/admin/settings/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'worker',
            targetId: targetWorker.user_id || targetWorker.id,
            email: targetWorker.email,
            newPassword: workerPassword,
          }),
        }).then((r) => r.json());

        if (res.success) {
          setSuccessMsg(`Password for workforce member '${targetWorker.name}' updated successfully!`);
          setWorkerPassword('');
          setWorkerConfirm('');
        } else {
          setErrorMsg(res.error || 'Failed to update worker password.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error changing worker password.');
    } finally {
      setSubmittingWorker(false);
    }
  };

  // Handle Student Password Change
  const handleStudentPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!selectedStudentId) {
      setErrorMsg('Please select a student.');
      return;
    }
    if (!studentPassword || studentPassword.length < 6) {
      setErrorMsg('Student password must be at least 6 characters long.');
      return;
    }
    if (studentPassword !== studentConfirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    const targetStudent = students.find((s) => s.id === selectedStudentId);
    if (!targetStudent) {
      setErrorMsg('Selected student not found.');
      return;
    }

    setSubmittingStudent(true);

    try {
      if (isGuestMode()) {
        setSuccessMsg(`Password for student '${targetStudent.name}' updated successfully (Demo Mode)!`);
        setStudentPassword('');
        setStudentConfirm('');
      } else {
        const res = await fetch('/api/admin/settings/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'student',
            targetId: targetStudent.id,
            phone: targetStudent.phone,
            newPassword: studentPassword,
          }),
        }).then((r) => r.json());

        if (res.success) {
          setSuccessMsg(`Password for student '${targetStudent.name}' updated successfully!`);
          setStudentPassword('');
          setStudentConfirm('');
        } else {
          setErrorMsg(res.error || 'Failed to update student password.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error changing student password.');
    } finally {
      setSubmittingStudent(false);
    }
  };

  // Live preview calculation for printing rates
  const previewRateKey = `${calcType}_${calcSide}` as keyof PrintingRatesConfig;
  const currentPreviewRate = rates[previewRateKey] || 0;
  const currentPreviewTotal = calcPages * currentPreviewRate;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header & Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-slate-900 text-white rounded-xl shadow-2xs shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">System Settings</h1>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 text-xs font-semibold rounded-xl flex items-center gap-2">
          <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SECTION 1: PRINTING RATES MANAGEMENT */}
      {(
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Printing Rates Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Default Printing Rates (per page)</span>
              </h2>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Set per-page pricing for printing service calculations across Debit Book and Workforce Counter entries.
              </p>
            </div>

            <form onSubmit={handleSaveRates} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* B/W Single Sided */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    B/W Single Sided Rate (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={rates.bw_single}
                      onChange={(e) => handleRateChange('bw_single', e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-sans block">Black & White, 1 Sided</span>
                </div>

                {/* B/W Double Sided */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    B/W Double Sided Rate (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={rates.bw_double}
                      onChange={(e) => handleRateChange('bw_double', e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-sans block">Black & White, 2 Sided (Front/Back)</span>
                </div>

                {/* Color Single Sided */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Color Single Sided Rate (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={rates.color_single}
                      onChange={(e) => handleRateChange('color_single', e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-sans block">Full Color, 1 Sided</span>
                </div>

                {/* Color Double Sided */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Color Double Sided Rate (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={rates.color_double}
                      onChange={(e) => handleRateChange('color_double', e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-sans block">Full Color, 2 Sided (Front/Back)</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleResetRates}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Reset Defaults
                </button>

                <button
                  type="submit"
                  disabled={savingRates}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {savingRates ? 'Saving...' : 'Save Printing Rates'}
                </button>
              </div>
            </form>
          </div>

          {/* Calculator Preview Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 md:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Live Rate Calculator Preview</h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">
                  Test how configured pricing rates calculate print totals.
                </p>
              </div>

              <div className="space-y-3 font-sans text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Number of Pages</label>
                  <input
                    type="number"
                    min="1"
                    value={calcPages}
                    onChange={(e) => setCalcPages(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Print Color</label>
                    <select
                      value={calcType}
                      onChange={(e) => setCalcType(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-sans text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="bw">B/W</option>
                      <option value="color">Color</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Sides</label>
                    <select
                      value={calcSide}
                      onChange={(e) => setCalcSide(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-sans text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="single">Single</option>
                      <option value="double">Double</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Box */}
            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span>Calculated Rate:</span>
                <span className="font-mono font-bold text-white">₹{currentPreviewRate.toFixed(2)} / page</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Total Charge</span>
                <span className="text-xl font-black font-mono text-emerald-400">₹{currentPreviewTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: PASSWORD MANAGEMENT */}
      {(
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Change Authentication Passwords</h2>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Select target role to update system access credentials for Admin, Workforce Personnel, or Registered Students.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Role Selector & Password Form (lg:col-span-7) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Role selector sub-tabs */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Select Target Role
                </label>
                <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100/90 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordRole('admin');
                      setSuccessMsg(null);
                      setErrorMsg(null);
                    }}
                    className={`py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      passwordRole === 'admin'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPasswordRole('worker');
                      setSuccessMsg(null);
                      setErrorMsg(null);
                    }}
                    className={`py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      passwordRole === 'worker'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Worker</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPasswordRole('student');
                      setSuccessMsg(null);
                      setErrorMsg(null);
                    }}
                    className={`py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      passwordRole === 'student'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                    <span>Student</span>
                  </button>
                </div>
              </div>

              {/* Form Section */}
              <div className="pt-1">
                {/* 1. ADMIN PASSWORD FORM */}
                {passwordRole === 'admin' && (
                  <form onSubmit={handleAdminPasswordSubmit} className="space-y-4">
                    <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 font-medium flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>You are updating the password for the primary Administrator account.</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">New Admin Password</label>
                      <PasswordInput
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirm Admin Password</label>
                      <PasswordInput
                        value={adminConfirm}
                        onChange={(e) => setAdminConfirm(e.target.value)}
                        placeholder="Re-enter password"
                        required
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submittingAdmin}
                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submittingAdmin ? 'Updating Password...' : 'Update Admin Password'}
                      </button>
                    </div>
                  </form>
                )}

                {/* 2. WORKER PASSWORD FORM */}
                {passwordRole === 'worker' && (
                  <form onSubmit={handleWorkerPasswordSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Workforce Member (Worker)</label>
                      <select
                        value={selectedWorkerId}
                        onChange={(e) => setSelectedWorkerId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition-all"
                        required
                      >
                        <option value="">-- Choose Workforce Member --</option>
                        {workers.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">New Worker Password</label>
                      <PasswordInput
                        value={workerPassword}
                        onChange={(e) => setWorkerPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirm Worker Password</label>
                      <PasswordInput
                        value={workerConfirm}
                        onChange={(e) => setWorkerConfirm(e.target.value)}
                        placeholder="Re-enter password"
                        required
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submittingWorker}
                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submittingWorker ? 'Updating Password...' : 'Update Worker Password'}
                      </button>
                    </div>
                  </form>
                )}

                {/* 3. STUDENT PASSWORD FORM */}
                {passwordRole === 'student' && (
                  <form onSubmit={handleStudentPasswordSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Search & Select Student</label>
                      <input
                        type="text"
                        placeholder="Filter by name, phone, or batch..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs mb-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                      />

                      <select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition-all"
                        required
                      >
                        <option value="">-- Choose Registered Student ({filteredStudents.length}) --</option>
                        {filteredStudents.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name} (Phone: {st.phone} | {st.batch_name || 'No Batch'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">New Student Password</label>
                      <PasswordInput
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirm Student Password</label>
                      <PasswordInput
                        value={studentConfirm}
                        onChange={(e) => setStudentConfirm(e.target.value)}
                        placeholder="Re-enter password"
                        required
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submittingStudent}
                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submittingStudent ? 'Updating Password...' : 'Update Student Password'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Right Column: Security Guidelines & Privilege Details (hidden on mobile, visible on desktop lg:col-span-5) */}
            <div className="hidden lg:block lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">Security & Privileges</h3>
                  <p className="text-[11px] text-slate-500 font-sans">Role policies and authorization boundaries</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {passwordRole === 'admin' && '🛡️ Administrator Access'}
                      {passwordRole === 'worker' && '⚙️ Workforce Staff Member'}
                      {passwordRole === 'student' && '🎓 Student Account'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200 uppercase">
                      {passwordRole}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                    {passwordRole === 'admin' &&
                      'Superuser authorization across financial years, journal posting, rate configurations, batch management, and data resets.'}
                    {passwordRole === 'worker' &&
                      'Incharge credentials authorized to record Debit Book print jobs, batch transaction entries, and verify student ledger balances.'}
                    {passwordRole === 'student' &&
                      'Personal portal access allowing students to view live debit book ledger balance, recent print jobs, and submit payment claims.'}
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">Password Requirements</span>
                  <ul className="space-y-1.5 text-[11px] text-slate-600 font-sans">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>Minimum of 6 characters in length</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>Stored securely in Supabase Authentication & app reference</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>Changes take effect immediately on next sign-in</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <div className="text-[10px] text-slate-500 font-sans leading-relaxed">
                    💡 <strong>Tip:</strong> If a student or staff member forgets their credentials, administrators can overwrite their password directly from this control panel without requiring email confirmation tokens.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: DEMO PAGE ACCESS CONTROL */}
      {(
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Demo Page & Guest Mode Settings</span>
              </h2>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Enable or disable the Demo Page option button on the main login screen.
              </p>
            </div>

            {/* Direct Link to Demo */}
            <a
              href="/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all self-start sm:self-auto"
            >
              <span>Preview Demo Page</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* Toggle Control Card */}
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900">
                  Login Page &quot;Try Guest Mode&quot; Button
                </span>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    showDemoButton === null
                      ? 'bg-slate-200 text-slate-600 border-slate-300'
                      : showDemoButton
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-red-100 text-red-800 border-red-300'
                  }`}
                >
                  {showDemoButton === null ? 'LOADING...' : showDemoButton ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                When turned <strong className="text-slate-900">ON</strong>, visitors will see a &quot;Try Guest Mode (Select Demo View)&quot; button on the main login screen to explore the system with mock client-side data. When turned <strong className="text-slate-900">OFF</strong>, the button is hidden.
              </p>
            </div>

            {/* Toggle Switch */}
            <div className="flex flex-col items-center sm:items-end justify-center shrink-0">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-extrabold ${!showDemoButton ? 'text-slate-900' : 'text-slate-400'}`}>
                  OFF
                </span>
                <button
                  type="button"
                  id="demo-page-toggle-btn"
                  disabled={savingDemoSetting || showDemoButton === null}
                  onClick={() => showDemoButton !== null && handleToggleDemoButton(!showDemoButton)}
                  className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-50 ${
                    showDemoButton ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                  role="switch"
                  aria-checked={Boolean(showDemoButton)}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      showDemoButton ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className={`text-xs font-extrabold ${showDemoButton ? 'text-emerald-700' : 'text-slate-400'}`}>
                  ON
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-sans mt-1.5">
                {savingDemoSetting ? 'Saving changes...' : 'Click toggle switch to change'}
              </span>
            </div>
          </div>

          {/* Quick Preview Box */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Visual Status Preview</h3>
            {showDemoButton ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>The Demo Button is active and visible on the main login screen (<code>/</code>).</span>
                </div>
                <a href="/" target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline font-bold text-[11px]">
                  View Login Screen ↗
                </a>
              </div>
            ) : (
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-700 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>The Demo Button is hidden on the login screen. Users must log in with credentials.</span>
                </div>
                <a href="/" target="_blank" rel="noopener noreferrer" className="text-slate-700 underline font-bold text-[11px]">
                  View Login Screen ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


