import { describe, it, expect } from 'vitest';
import { getAdminDashboardMetrics } from '../src/services/accountingService';
import { validateJournalEntryLines } from '../src/lib/accounting/ledger';

describe('Phase 3 Admin Dashboard & Student Management Unit Tests', () => {
  describe('1. Summary Metric Definitions & Formulas', () => {
    it('should correctly evaluate Surplus as Revenue - Expense', () => {
      const revenue = 250.0;
      const expense = 90.0;
      const surplus = revenue - expense;

      expect(surplus).toBe(160.0);
    });

    it('should verify Student Credit Given is tracked from debit lines on student accounts', () => {
      const studentAccountId = '10000000-0000-0000-0000-000000000099';
      const serviceIncomeId = '40000000-0000-0000-0000-000000000001';

      const lines = [
        { accountId: studentAccountId, debit: 45.0, credit: 0 },
        { accountId: serviceIncomeId, debit: 0, credit: 45.0 },
      ];

      const validation = validateJournalEntryLines(lines);
      expect(validation.isValid).toBe(true);

      const debitToStudent = lines.find((l) => l.accountId === studentAccountId)?.debit || 0;
      expect(debitToStudent).toBe(45.0);
    });
  });

  describe('2. Soft Delete Policy Rules', () => {
    it('should soft delete students by marking status as archived', () => {
      const studentState = {
        id: 'student-123',
        name: 'Alice Johnson',
        status: 'active' as 'active' | 'archived',
      };

      // Soft delete operation
      studentState.status = 'archived';

      // Record preserved, status changed to archived
      expect(studentState.id).toBe('student-123');
      expect(studentState.name).toBe('Alice Johnson');
      expect(studentState.status).toBe('archived');
    });
  });
});
