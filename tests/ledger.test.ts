import { describe, it, expect } from 'vitest';
import { PRINTING_RATES, calculatePrintAmount } from '../src/config/printingRates';
import { generateWhatsAppLink } from '../src/services/ledgerService';
import { validateJournalEntryLines } from '../src/lib/accounting/ledger';

describe('Phase 4 Debit Book & Financial Ledger Logic', () => {
  describe('1. Centralized Printing Rates Engine', () => {
    it('should correctly calculate B/W single-sided print jobs with new rates (3 rupees/page)', () => {
      // 10 pages B/W Single @ 3 rupees/pg = 30 rupees
      const result = calculatePrintAmount('bw', 'single', 10, 0);
      expect(result.ratePerPage).toBe(3.0);
      expect(result.subtotal).toBe(30.0);
      expect(result.totalAmount).toBe(30.0);
    });

    it('should correctly calculate Color double-sided print jobs with new rates (20 rupees/page)', () => {
      // 5 pages Color Double @ 20 rupees/pg = 100 rupees - 5 rupees discount = 95 rupees
      const result = calculatePrintAmount('color', 'double', 5, 5.0);
      expect(result.ratePerPage).toBe(20.0);
      expect(result.subtotal).toBe(100.0);
      expect(result.totalAmount).toBe(95.0);
    });
  });

  describe('2. Multi-Student Balanced Entry Generation', () => {
    it('should generate separate balanced journal entries for each student', () => {
      const student1Account = '10000000-0000-0000-0000-000000000001';
      const student2Account = '10000000-0000-0000-0000-000000000002';
      const serviceIncomeAccount = '40000000-0000-0000-0000-000000000001';
      const entryAmount = 15.0;

      // Student 1 Entry
      const entry1Lines = [
        { accountId: student1Account, debit: entryAmount, credit: 0 },
        { accountId: serviceIncomeAccount, debit: 0, credit: entryAmount },
      ];
      expect(validateJournalEntryLines(entry1Lines).isValid).toBe(true);

      // Student 2 Entry
      const entry2Lines = [
        { accountId: student2Account, debit: entryAmount, credit: 0 },
        { accountId: serviceIncomeAccount, debit: 0, credit: entryAmount },
      ];
      expect(validateJournalEntryLines(entry2Lines).isValid).toBe(true);
    });
  });

  describe('3. WhatsApp Pre-filled Reminder Link Generator', () => {
    it('should format a valid wa.me link with encoded balance reminder', () => {
      const link = generateWhatsAppLink('+1 (987) 654-3210', 'Bob Smith', 42.50);
      expect(link).toContain('https://wa.me/19876543210?text=');
      expect(link).toContain('Bob%20Smith');
      expect(link).toContain('42.50');
    });
  });
});
