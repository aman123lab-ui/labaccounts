import { describe, it, expect, beforeEach } from 'vitest';
import { postCreditEntries, postDebitEntries } from '../src/services/ledgerService';
import {
  verifyCashHandoverClaim,
  submitCashHandoverClaim,
  getInchargeHandoverHistory,
} from '../src/services/cashHandoverService';
import {
  enableGuestMode,
  disableGuestMode,
  getDemoJournalEntries,
  getDemoAccounts,
} from '../src/lib/demo/demoStore';

const LAB_CASH_ACCOUNT = '10000000-0000-0000-0000-000000000001';
const WORKFORCE_CASH_ACCOUNT = '10000000-0000-0000-0000-000000000003';
const SERVICE_INCOME_ACCOUNT = '40000000-0000-0000-0000-000000000001';

describe('Workforce Cash Accounting Rule & Boundary Enforcement', () => {
  beforeEach(() => {
    disableGuestMode();
    enableGuestMode();
  });

  describe('1. Debit Book & Collection Flows: Workforce Role Cash Routing', () => {
    it('should ALWAYS post to Cash in Hand (Workforce) when useInchargeCashAccount is true', async () => {
      const studentId = 'student-aarav-01';
      const creditAmount = 75.0;

      const res = await postCreditEntries({
        studentIds: [studentId],
        amount: creditAmount,
        description: 'Student Cash Payment — collected by Yaseen',
        useInchargeCashAccount: true,
      });

      expect(res.success).toBe(true);
      expect(res.totalPosted).toBe(1);

      const entries = getDemoJournalEntries({ financialYearId: 'ALL' });
      const entryId = res.results[0].entryId;
      const latestEntry = entries.find((e) => e.id === entryId);
      expect(latestEntry).toBeDefined();

      // Find debit line
      const debitLine = latestEntry?.journal_entry_lines.find((l: any) => l.debit_amount > 0);
      const creditLine = latestEntry?.journal_entry_lines.find((l: any) => l.credit_amount > 0);

      expect(debitLine?.account_id).toBe(WORKFORCE_CASH_ACCOUNT);
      expect(debitLine?.account_id).not.toBe(LAB_CASH_ACCOUNT);
      expect(debitLine?.debit_amount).toBe(creditAmount);

      // Credit line must be Student AR
      const demoAccounts = getDemoAccounts();
      const studentAR = demoAccounts.find((a) => a.student_id === studentId);
      expect(creditLine?.account_id).toBe(studentAR?.id);
      expect(creditLine?.credit_amount).toBe(creditAmount);
    });

    it('should post directly to Lab Cash Account when acting as Admin (useInchargeCashAccount is false)', async () => {
      const studentId = 'student-aarav-01';
      const creditAmount = 120.0;

      const res = await postCreditEntries({
        studentIds: [studentId],
        amount: creditAmount,
        description: 'Admin Cash Collection',
        useInchargeCashAccount: false,
      });

      expect(res.success).toBe(true);
      expect(res.totalPosted).toBe(1);

      const entries = getDemoJournalEntries({ financialYearId: 'ALL' });
      const entryId = res.results[0].entryId;
      const latestEntry = entries.find((e) => e.id === entryId);
      expect(latestEntry).toBeDefined();

      const debitLine = latestEntry?.journal_entry_lines.find((l: any) => l.debit_amount > 0);
      expect(debitLine?.account_id).toBe(LAB_CASH_ACCOUNT);
      expect(debitLine?.account_id).not.toBe(WORKFORCE_CASH_ACCOUNT);
      expect(debitLine?.debit_amount).toBe(creditAmount);
    });
  });

  describe('2. Paid-Immediately Print Jobs (Cash Debited at Point of Sale)', () => {
    it('should debit Workforce Cash Account when Workforce records immediate cash print job', async () => {
      const studentId = 'student-aarav-01';

      const res = await postDebitEntries({
        studentIds: [studentId],
        printType: 'bw',
        side: 'single',
        numPages: 10,
        description: 'B/W Print Cash Collected — collected by Staff',
        discount: 0,
        paidImmediately: true,
        useInchargeCashAccount: true,
      });

      expect(res.success).toBe(true);

      const entries = getDemoJournalEntries({ financialYearId: 'ALL' });
      const entryId = res.results[0].entryId;
      const latestEntry = entries.find((e) => e.id === entryId);
      expect(latestEntry).toBeDefined();

      // Debit must be Workforce Cash, Credit must be Service Income
      const debitLine = latestEntry?.journal_entry_lines.find((l: any) => l.debit_amount > 0);
      const creditLine = latestEntry?.journal_entry_lines.find((l: any) => l.credit_amount > 0);

      expect(debitLine?.account_id).toBe(WORKFORCE_CASH_ACCOUNT);
      expect(debitLine?.account_id).not.toBe(LAB_CASH_ACCOUNT);
      expect(creditLine?.account_id).toBe(SERVICE_INCOME_ACCOUNT);
    });

    it('should debit Lab Cash Account when Admin records immediate cash print job', async () => {
      const studentId = 'student-aarav-01';

      const res = await postDebitEntries({
        studentIds: [studentId],
        printType: 'bw',
        side: 'single',
        numPages: 10,
        description: 'Admin Counter B/W Print',
        discount: 0,
        paidImmediately: true,
        useInchargeCashAccount: false,
      });

      expect(res.success).toBe(true);

      const entries = getDemoJournalEntries({ financialYearId: 'ALL' });
      const entryId = res.results[0].entryId;
      const latestEntry = entries.find((e) => e.id === entryId);
      expect(latestEntry).toBeDefined();

      const debitLine = latestEntry?.journal_entry_lines.find((l: any) => l.debit_amount > 0);
      expect(debitLine?.account_id).toBe(LAB_CASH_ACCOUNT);
    });
  });

  describe('3. Handover Verification Transfer Rule', () => {
    it('should ONLY transfer funds from Workforce Cash to Lab Cash when Admin verifies handover claim', async () => {
      // 1. Workforce collects 200 cash
      await postCreditEntries({
        studentIds: ['student-aarav-01'],
        amount: 200.0,
        description: 'Cash collection',
        useInchargeCashAccount: true,
      });

      // 2. Submit handover claim
      const submitRes = await submitCashHandoverClaim(200.0, 'Yaseen', 'Cash handover for session');
      expect(submitRes.success).toBe(true);
      expect(submitRes.claimId).toBeDefined();

      // Before verification, verify claim is pending
      const history = await getInchargeHandoverHistory('Yaseen');
      const claim = history.find((c) => c.id === submitRes.claimId);
      expect(claim?.status).toBe('pending');

      // 3. Admin verifies handover claim
      const verifyRes = await verifyCashHandoverClaim(submitRes.claimId!, 'System Admin');
      expect(verifyRes.success).toBe(true);

      // Check the generated handover journal entry
      const entries = getDemoJournalEntries({ financialYearId: 'ALL' });
      const handoverEntry = entries.find((e) => e.description.includes('Cash Handover Transfer Verified'));
      expect(handoverEntry).toBeDefined();

      // Must be Lab Cash Dr (received by org) / Workforce Cash Cr (transferred out from workforce)
      const debitLine = handoverEntry?.journal_entry_lines.find((l: any) => l.debit_amount > 0);
      const creditLine = handoverEntry?.journal_entry_lines.find((l: any) => l.credit_amount > 0);

      expect(debitLine?.account_id).toBe(LAB_CASH_ACCOUNT);
      expect(debitLine?.debit_amount).toBe(200.0);
      expect(creditLine?.account_id).toBe(WORKFORCE_CASH_ACCOUNT);
      expect(creditLine?.credit_amount).toBe(200.0);
    });
  });

  describe('4. Access Control Boundary Rule Verification', () => {
    function evaluateRouteAccess(role: 'admin' | 'incharge' | 'student' | null, pathname: string): { allowed: boolean; redirect?: string } {
      const isDebitBook = pathname === '/admin/ledger' || pathname.startsWith('/admin/ledger/');

      if (!role) {
        return { allowed: false, redirect: '/' };
      }

      if (role === 'incharge') {
        if (isDebitBook) {
          return { allowed: true };
        }
        return { allowed: false, redirect: '/incharge' };
      }

      if (role === 'admin') {
        return { allowed: true };
      }

      if (role === 'student') {
        return { allowed: false, redirect: '/student' };
      }

      return { allowed: false, redirect: '/' };
    }

    it('Workforce account MUST be permitted to access Debit Book (/admin/ledger)', () => {
      const access = evaluateRouteAccess('incharge', '/admin/ledger');
      expect(access.allowed).toBe(true);
      expect(access.redirect).toBeUndefined();
    });

    it('Workforce account MUST be RESTRICTED from all other admin pages and redirected to /incharge', () => {
      const restrictedRoutes = [
        '/admin',
        '/admin/students',
        '/admin/income-expense',
        '/admin/journal',
        '/admin/ledger-accounts',
        '/admin/cash-handovers',
        '/admin/payment-claims',
        '/admin/reports',
        '/admin/financial-year',
        '/admin/settings',
      ];

      for (const route of restrictedRoutes) {
        const access = evaluateRouteAccess('incharge', route);
        expect(access.allowed).toBe(false);
        expect(access.redirect).toBe('/incharge');
      }
    });

    it('Admin account MUST have full access to all admin pages including Debit Book', () => {
      const allRoutes = [
        '/admin',
        '/admin/ledger',
        '/admin/income-expense',
        '/admin/journal',
        '/admin/cash-handovers',
        '/admin/settings',
      ];

      for (const route of allRoutes) {
        const access = evaluateRouteAccess('admin', route);
        expect(access.allowed).toBe(true);
      }
    });

    it('Student accounts are rejected from all admin routes and sent to /student', () => {
      const access = evaluateRouteAccess('student', '/admin/ledger');
      expect(access.allowed).toBe(false);
      expect(access.redirect).toBe('/student');
    });
  });
});
