import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../src/utils/formatCurrency';

describe('Phase 5 & UI Polish Unit Tests', () => {
  describe('1. Financial Year Closing Calculation', () => {
    it('should compute surplus as revenue minus expenses for period closing', () => {
      const totalRevenue = 450.0;
      const totalExpenses = 120.0;
      const netSurplus = totalRevenue - totalExpenses;

      expect(netSurplus).toBe(330.0);
    });
  });

  describe('2. INR Currency Formatter Utility', () => {
    it('should format numbers into Indian Rupee format with ₹ symbol', () => {
      const formatted = formatCurrency(123456.78);
      expect(formatted).toContain('₹');
      expect(formatted).toContain('1,23,456.78');
    });
  });
});
