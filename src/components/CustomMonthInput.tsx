'use client';

import React from 'react';

interface CustomMonthInputProps {
  value: string; // YYYY-MM format, e.g. "2026-08"
  onChange: (value: string) => void;
  className?: string;
}

export default function CustomMonthInput({
  value,
  onChange,
  className = '',
}: CustomMonthInputProps) {
  // Format YYYY-MM to human readable "August 2026"
  const getDisplayLabel = (val: string) => {
    if (!val) return 'Select Month';
    const [yearStr, monthStr] = val.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (isNaN(year) || isNaN(month)) return val;
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="relative inline-flex items-center group cursor-pointer w-full sm:w-auto">
      {/* Visual Input Display Box */}
      <div
        className={`w-full sm:w-auto bg-white border border-slate-300 rounded-xl pl-3.5 pr-9 py-2 sm:py-1.5 text-xs text-slate-900 font-mono flex items-center justify-between gap-3 group-hover:border-emerald-600 transition-colors shadow-xs ${className}`}
      >
        <span>{getDisplayLabel(value)}</span>
      </div>

      {/* Calendar SVG Icon */}
      <div className="absolute right-2.5 pointer-events-none flex items-center justify-center text-emerald-600 group-hover:text-emerald-700 transition-colors">
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* Transparent Native Month Input covering the entire component */}
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer pointer-events-auto [color-scheme:light]"
      />
    </div>
  );
}
