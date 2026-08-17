import { describe, it, expect, beforeEach } from 'vitest';
import { AccountingEngine, validateJournalEntryLines, calculateAccountBalanceFromLines } from '../src/lib/accounting/ledger';
import { Account } from '../src/types/database.types';

describe('Lab Accounting System - Double-Entry Ledger Core Tests', () => {
  // Test Account IDs matching seed data
  const CASH_ACCOUNT_ID = '10000000-0000-0000-0000-000000000001'; // Asset
  const STUDENT_RECEIVABLE_ID = '10000000-0000-0000-0000-000000000002'; // Asset
  const FUND_BALANCE_ID = '30000000-0000-0000-0000-000000000001'; // Equity (Fund Balance / Net Assets)
  const SERVICE_INCOME_ID = '40000000-0000-0000-0000-000000000001'; // Revenue
  const SUPPLIES_EXPENSE_ID = '50000000-0000-0000-0000-000000000001'; // Expense

  const defaultAccounts: Account[] = [
    {
      id: CASH_ACCOUNT_ID,
      name: 'Cash Account',
      type: 'asset',
      is_student_account: false,
      created_at: new Date().toISOString(),
    },
    {
      id: STUDENT_RECEIVABLE_ID,
      name: 'Student Accounts Receivable',
      type: 'asset',
      is_student_account: false,
      created_at: new Date().toISOString(),
    },
    {
      id: FUND_BALANCE_ID,
      name: 'Fund Balance / Net Assets Account',
      type: 'equity',
      is_student_account: false,
      created_at: new Date().toISOString(),
    },
    {
      id: SERVICE_INCOME_ID,
      name: 'Service Income Account',
      type: 'revenue',
      is_student_account: false,
      created_at: new Date().toISOString(),
    },
    {
      id: SUPPLIES_EXPENSE_ID,
      name: 'Paper & Ink Supplies Expense',
      type: 'expense',
      is_student_account: false,
      created_at: new Date().toISOString(),
    },
  ];

  let engine: AccountingEngine;

  beforeEach(() => {
    engine = new AccountingEngine(defaultAccounts);
  });

  // -------------------------------------------------------------
  // Test Requirement 7.1: Debit-Credit pair balances
  // -------------------------------------------------------------
  describe('1. Double-Entry Balance Validation', () => {
    it('should accept a balanced Debit-Credit entry pair', () => {
      const lines = [
        { accountId: STUDENT_RECEIVABLE_ID, debit: 50, credit: 0 },
        { accountId: SERVICE_INCOME_ID, debit: 0, credit: 50 },
      ];

      const validation = validateJournalEntryLines(lines);
      expect(validation.isValid).toBe(true);
      expect(validation.totalDebit).toBe(50);
      expect(validation.totalCredit).toBe(50);

      // Successfully post to ledger engine
      const result = engine.postJournalEntry(lines, 'Student print job on credit');
      expect(result.journalEntry.id).toBeDefined();
      expect(result.lines).toHaveLength(2);
    });

    it('should accept complex balanced multi-line journal entries', () => {
      const lines = [
        { accountId: CASH_ACCOUNT_ID, debit: 30, credit: 0 },
        { accountId: STUDENT_RECEIVABLE_ID, debit: 20, credit: 0 },
        { accountId: SERVICE_INCOME_ID, debit: 0, credit: 50 },
      ];

      const validation = validateJournalEntryLines(lines);
      expect(validation.isValid).toBe(true);
      expect(validation.totalDebit).toBe(50);
      expect(validation.totalCredit).toBe(50);
    });
  });

  // -------------------------------------------------------------
  // Test Requirement 7.2: Unbalanced entry is rejected
  // -------------------------------------------------------------
  describe('2. Unbalanced Entry Rejection', () => {
    it('should reject an entry where debits do not equal credits', () => {
      const unbalancedLines = [
        { accountId: CASH_ACCOUNT_ID, debit: 100, credit: 0 },
        { accountId: SERVICE_INCOME_ID, debit: 0, credit: 80 }, // Short by 20
      ];

      const validation = validateJournalEntryLines(unbalancedLines);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Unbalanced journal entry rejected');

      // Posting unbalanced entry should throw error
      expect(() => {
        engine.postJournalEntry(unbalancedLines, 'Invalid transaction');
      }).toThrowError(/Unbalanced journal entry rejected/);
    });

    it('should reject entries with fewer than 2 lines', () => {
      const singleLine = [{ accountId: CASH_ACCOUNT_ID, debit: 100, credit: 0 }];

      const validation = validateJournalEntryLines(singleLine);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('at least two entry lines');
    });

    it('should reject lines where both debit and credit are set', () => {
      const invalidLines = [
        { accountId: CASH_ACCOUNT_ID, debit: 100, credit: 50 },
        { accountId: SERVICE_INCOME_ID, debit: 0, credit: 50 },
      ];

      const validation = validateJournalEntryLines(invalidLines);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('exactly one positive amount');
    });
  });

  // -------------------------------------------------------------
  // Test Requirement 7.3: Account balance calculations
  // -------------------------------------------------------------
  describe('3. getAccountBalance Signed Balances (Asset vs Revenue)', () => {
    it('should compute correct signed balance for Asset account (Debit normal balance)', () => {
      // Entry 1: Debit Student Accounts Receivable $100, Credit Fund Balance $100
      engine.postJournalEntry(
        [
          { accountId: STUDENT_RECEIVABLE_ID, debit: 100, credit: 0 },
          { accountId: FUND_BALANCE_ID, debit: 0, credit: 100 },
        ],
        'Initial credit allocation'
      );

      // Entry 2: Payment received - Debit Cash $30, Credit Student Accounts Receivable $30
      engine.postJournalEntry(
        [
          { accountId: CASH_ACCOUNT_ID, debit: 30, credit: 0 },
          { accountId: STUDENT_RECEIVABLE_ID, debit: 0, credit: 30 },
        ],
        'Student cash payment'
      );

      // Asset calculation: Total Debits (100) - Total Credits (30) = 70
      const receivableBalance = engine.getAccountBalance(STUDENT_RECEIVABLE_ID);
      expect(receivableBalance).toBe(70);

      // Cash Asset balance: Total Debits (30) - Total Credits (0) = 30
      const cashBalance = engine.getAccountBalance(CASH_ACCOUNT_ID);
      expect(cashBalance).toBe(30);
    });

    it('should compute correct signed balance for Revenue account (Credit normal balance)', () => {
      // Entry 1: Print job - Debit Cash $150, Credit Service Income $150
      engine.postJournalEntry(
        [
          { accountId: CASH_ACCOUNT_ID, debit: 150, credit: 0 },
          { accountId: SERVICE_INCOME_ID, debit: 0, credit: 150 },
        ],
        'Printing service revenue'
      );

      // Revenue calculation: Total Credits (150) - Total Debits (0) = 150
      const revenueBalance = engine.getAccountBalance(SERVICE_INCOME_ID);
      expect(revenueBalance).toBe(150);
    });

    it('should compute correct Fund Balance / Net Assets (Equity)', () => {
      engine.postJournalEntry(
        [
          { accountId: CASH_ACCOUNT_ID, debit: 500, credit: 0 },
          { accountId: FUND_BALANCE_ID, debit: 0, credit: 500 },
        ],
        'Initial grant contribution'
      );

      // Equity calculation: Total Credits (500) - Total Debits (0) = 500
      const fundBalance = engine.getAccountBalance(FUND_BALANCE_ID);
      expect(fundBalance).toBe(500);
    });

    it('should correctly calculate non-profit Surplus/Deficit', () => {
      // Revenue: $200
      engine.postJournalEntry(
        [
          { accountId: CASH_ACCOUNT_ID, debit: 200, credit: 0 },
          { accountId: SERVICE_INCOME_ID, debit: 0, credit: 200 },
        ],
        'Service revenue'
      );

      // Expense: $80
      engine.postJournalEntry(
        [
          { accountId: SUPPLIES_EXPENSE_ID, debit: 80, credit: 0 },
          { accountId: CASH_ACCOUNT_ID, debit: 0, credit: 80 },
        ],
        'Paper and toner purchase'
      );

      // Net Surplus = Revenue ($200) - Expense ($80) = $120
      const surplus = engine.getSurplusDeficit();
      expect(surplus).toBe(120);
    });
  });
});
