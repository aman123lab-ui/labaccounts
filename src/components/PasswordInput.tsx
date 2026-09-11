'use client';

import React, { useState } from 'react';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  focusColor?: 'emerald' | 'blue' | 'indigo';
  variant?: 'light' | 'dark';
}

export default function PasswordInput({
  className = '',
  focusColor = 'emerald',
  variant,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const isDark =
    variant === 'dark' ||
    className.includes('bg-slate-950') ||
    className.includes('bg-slate-900');

  const focusBorderClass =
    focusColor === 'blue'
      ? 'focus:border-blue-500 focus:ring-blue-500'
      : focusColor === 'indigo'
      ? 'focus:border-indigo-500 focus:ring-indigo-500'
      : 'focus:border-emerald-600 focus:ring-emerald-500';

  const baseInputClass = isDark
    ? 'w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-11 py-2.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 transition-all'
    : 'w-full bg-white border border-slate-300 rounded-xl pl-4 pr-11 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 transition-all';

  const toggleBtnClass = isDark
    ? 'absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none focus:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition-colors'
    : 'absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 focus:outline-none focus:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition-colors';

  const cleanedClassName = className
    .replace(/bg-white/g, '')
    .replace(/bg-slate-950/g, '')
    .replace(/bg-slate-900/g, '')
    .replace(/text-slate-900/g, '')
    .replace(/text-slate-100/g, '')
    .replace(/border-slate-300/g, '')
    .replace(/border-slate-800/g, '')
    .trim();

  return (
    <div className="relative w-full">
      <input
        type={showPassword ? 'text' : 'password'}
        className={`${baseInputClass} ${focusBorderClass} ${cleanedClassName}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        title={showPassword ? 'Hide password' : 'Show password'}
        className={toggleBtnClass}
      >
        {showPassword ? (
          /* Eye Slash Icon (Hide Password) */
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.05 10.05 0 014.122-.963c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
          </svg>
        ) : (
          /* Eye Icon (Show Password) */
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
