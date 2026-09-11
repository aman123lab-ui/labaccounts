'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface AccountOption {
  id: string;
  name: string;
  type: string;
  student_name?: string | null;
}

interface SearchableAccountSelectProps {
  accounts: AccountOption[];
  value: string;
  onChange: (accountId: string) => void;
  placeholder?: string;
}

export default function SearchableAccountSelect({
  accounts,
  value,
  onChange,
  placeholder = 'Search & select account...',
}: SearchableAccountSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 280,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 300),
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      updateCoords();
    }
    setIsOpen(!isOpen);
  };

  // Update position on scroll or resize
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const selectedAccount = accounts.find((a) => a.id === value);

  const filteredAccounts = accounts.filter((a) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const nameMatch = a.name.toLowerCase().includes(term);
    const typeMatch = a.type.toLowerCase().includes(term);
    const studentMatch = a.student_name ? a.student_name.toLowerCase().includes(term) : false;
    return nameMatch || typeMatch || studentMatch;
  });

  const handleSelect = (accountId: string) => {
    onChange(accountId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'all':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'asset':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'revenue':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'expense':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      case 'liability':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="w-full text-xs font-sans">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 py-2 text-left text-slate-900 flex items-center justify-between gap-2 hover:border-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 transition-colors shadow-xs"
      >
        <span className="truncate">
          {selectedAccount ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-slate-900 truncate">{selectedAccount.name}</span>
              {selectedAccount.student_name && (
                <span className="text-slate-500 text-[11px] truncate">({selectedAccount.student_name})</span>
              )}
              {selectedAccount.type && selectedAccount.type !== 'ALL' && (
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase border ${getTypeBadgeClass(selectedAccount.type)} shrink-0`}>
                  {selectedAccount.type}
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <span className="text-slate-400 text-[10px] shrink-0">▼</span>
      </button>

      {/* Dropdown Menu Rendered via Portal on document.body */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: `${menuCoords.top}px`,
              left: `${menuCoords.left}px`,
              width: `${menuCoords.width}px`,
              zIndex: 999999,
            }}
            className="bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-64 flex flex-col font-sans text-xs"
          >
            {/* Search Bar Input */}
            <div className="p-2 border-b border-slate-200 bg-slate-50">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type to search accounts or students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 placeholder-slate-400"
              />
            </div>

            {/* Account Options List */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {filteredAccounts.length === 0 ? (
                <div className="p-3 text-center text-slate-400 text-[11px]">
                  No matching accounts found.
                </div>
              ) : (
                filteredAccounts.map((acc) => {
                  const isSelected = acc.id === value;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleSelect(acc.id)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-950 font-bold'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="truncate min-w-0">
                        <span className="block truncate text-xs font-semibold">{acc.name}</span>
                        {acc.student_name && (
                          <span className="block truncate text-[10px] text-slate-500">Student: {acc.student_name}</span>
                        )}
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${getTypeBadgeClass(acc.type)} shrink-0`}>
                        {acc.type}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
