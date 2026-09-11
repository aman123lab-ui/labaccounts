'use client';

import React, { useRef } from 'react';
import { formatDate } from '@/utils/formatDate';

interface CustomDateInputProps {
  value: string; // Expects YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export default function CustomDateInput({
  value,
  onChange,
  className = '',
  placeholder = 'dd/mm/yyyy',
}: CustomDateInputProps) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const displayValue = value ? formatDate(value) : '';

  const handleClick = () => {
    const input = hiddenInputRef.current;
    if (input) {
      if ('showPicker' in input && typeof (input as unknown as { showPicker: () => void }).showPicker === 'function') {
        try {
          (input as unknown as { showPicker: () => void }).showPicker();
        } catch {
          input.focus();
        }
      } else {
        input.focus();
      }
    }
  };

  const isWFull = className.includes('w-full');

  return (
    <div className={`relative inline-flex items-center group cursor-pointer ${isWFull ? 'w-full' : ''}`} onClick={handleClick}>
      {/* Formatted Text Box displaying DD/MM/YYYY */}
      <input
        type="text"
        readOnly
        value={displayValue}
        placeholder={placeholder}
        className={`bg-white border border-slate-300 rounded-xl pl-3 pr-8 py-1.5 text-xs text-slate-900 font-mono focus:outline-none group-hover:border-emerald-600 transition-colors cursor-pointer ${className}`}
      />
      {/* Calendar Icon */}
      <svg
        className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 absolute right-2.5 pointer-events-none transition-colors"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      {/* Hidden Native Date Input for popup triggering */}
      <input
        ref={hiddenInputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer pointer-events-auto"
        tabIndex={-1}
      />
    </div>
  );
}
