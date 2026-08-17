import { describe, it, expect } from 'vitest';
import { sortBatches } from '../src/services/batchService';
import { Batch } from '../src/types/database.types';
import { normalizePhone, studentPhoneToEmail, clearLocalSession } from '../src/services/authService';
import { validateJournalEntryLines } from '../src/lib/accounting/ledger';

describe('Phase 2 Authentication & Student Registration Logic', () => {
  // Test 1: Batch Sorting Requirement
  describe('1. Batch Sorting Order', () => {
    it('should sort batches: JD... first, then HS..., then BS..., then others', () => {
      const sampleBatches: Batch[] = [
        { id: '1', name: 'BS 2026', category: 'BS', sort_order: 0, created_at: '' },
        { id: '2', name: 'JD2', category: 'JD', sort_order: 0, created_at: '' },
        { id: '3', name: 'HS1', category: 'HS', sort_order: 0, created_at: '' },
        { id: '4', name: 'JD1', category: 'JD', sort_order: 0, created_at: '' },
        { id: '5', name: 'MSc 2026', category: 'General', sort_order: 0, created_at: '' },
        { id: '6', name: 'BS1', category: 'BS', sort_order: 0, created_at: '' },
      ];

      const sorted = sortBatches(sampleBatches);
      const names = sorted.map((b) => b.name);

      expect(names).toEqual(['JD1', 'JD2', 'HS1', 'BS1', 'BS 2026', 'MSc 2026']);
    });
  });

  // Test 2: Phone normalization & Auth email mapping
  describe('2. Phone Auth Formatting', () => {
    it('should normalize phone numbers cleanly', () => {
      expect(normalizePhone('+1 (987) 654-3210')).toBe('19876543210');
      expect(normalizePhone(' 9876543210 ')).toBe('9876543210');
    });

    it('should format student phone into student auth email', () => {
      expect(studentPhoneToEmail('9876543210')).toBe('9876543210@student.lab');
    });
  });

  // Test 3: Opening Balance Double-Entry Verification
  describe('3. Opening Balance Double-Entry Journal Rules', () => {
    it('should create a balanced journal entry for non-zero student opening balances', () => {
      const studentAccountId = '10000000-0000-0000-0000-000000000099';
      const fundBalanceAccountId = '30000000-0000-0000-0000-000000000001';
      const openingBalance = 75.50;

      // Student Account (Dr) / Fund Balance Account (Cr)
      const lines = [
        { accountId: studentAccountId, debit: openingBalance, credit: 0 },
        { accountId: fundBalanceAccountId, debit: 0, credit: openingBalance },
      ];

      const validation = validateJournalEntryLines(lines);
      expect(validation.isValid).toBe(true);
      expect(validation.totalDebit).toBe(75.50);
      expect(validation.totalCredit).toBe(75.50);
    });

    it('should reject unbalanced opening balance journal entries', () => {
      const studentAccountId = '10000000-0000-0000-0000-000000000099';
      const fundBalanceAccountId = '30000000-0000-0000-0000-000000000001';

      const unbalancedLines = [
        { accountId: studentAccountId, debit: 100, credit: 0 },
        { accountId: fundBalanceAccountId, debit: 0, credit: 50 },
      ];

      const validation = validateJournalEntryLines(unbalancedLines);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Unbalanced journal entry rejected');
    });
  });

  // Test 4: Session Persistence & Role Resolution Utilities
  describe('4. Session Persistence & Role Resolution', () => {
    it('should clear all local session storage keys on clearLocalSession', () => {
      // Mock window.localStorage in Node test env if needed
      const storage: Record<string, string> = {
        'lab_user_role': 'admin',
        'lab_admin_email': 'admin@lab.com',
        'lab_student_id': 'stu-123',
        'sb-project-auth-token': 'token-xyz',
        'other_key': 'keep_me',
      };

      const mockLocalStorage = {
        getItem: (k: string) => storage[k] || null,
        setItem: (k: string, v: string) => { storage[k] = v; },
        removeItem: (k: string) => { delete storage[k]; },
        key: (i: number) => Object.keys(storage)[i] || null,
        get length() { return Object.keys(storage).length; },
      };

      const originalWindow = globalThis.window;
      // @ts-expect-error Mocking window.localStorage for test
      globalThis.window = { localStorage: mockLocalStorage };

      clearLocalSession();

      expect(storage['lab_user_role']).toBeUndefined();
      expect(storage['lab_admin_email']).toBeUndefined();
      expect(storage['lab_student_id']).toBeUndefined();
      expect(storage['sb-project-auth-token']).toBeUndefined();
      expect(storage['other_key']).toBe('keep_me');

      globalThis.window = originalWindow;
    });
  });
});
