import { Student, Account, Batch } from '@/types/database.types';

export interface DemoJournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
}

export interface DemoJournalEntry {
  id: string;
  date: string;
  description: string;
  created_at: string;
  voided_at: string | null;
  financial_year_id?: string | null;
  lines: DemoJournalEntryLine[];
}

export interface DemoPaymentClaim {
  id: string;
  student_id: string;
  student_name: string;
  amount: number;
  transaction_id: string;
  payment_date: string;
  status: 'pending' | 'verified' | 'rejected';
  rejection_reason?: string;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at: string;
}

export interface DemoFinancialYear {
  id: string;
  year_label: string;
  name?: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  closed_at?: string | null;
  closing_entry_id?: string | null;
  created_new_fy_id?: string | null;
  rollover_snapshot?: Array<{ student_id: string; batch_id: string; status: string }> | null;
}

export interface DemoCashHandoverClaim {
  id: string;
  incharge_id: string;
  incharge_name: string;
  claimed_amount: number;
  claimed_at: string;
  status: 'pending' | 'verified' | 'rejected';
  verified_by?: string | null;
  verified_at?: string | null;
  admin_note?: string | null;
}

export interface DemoInchargeStaff {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  staff_id?: string;
  status: 'active' | 'archived';
  created_at: string;
}

export interface DemoDataSet {
  batches: Batch[];
  students: Student[];
  accounts: Account[];
  journalEntries: DemoJournalEntry[];
  paymentClaims: DemoPaymentClaim[];
  cashHandoverClaims: DemoCashHandoverClaim[];
  financialYears: DemoFinancialYear[];
  inchargeStaff?: DemoInchargeStaff[];
}

// ─── Fixed account IDs ────────────────────────────────────────────────────────
const A_CASH     = '10000000-0000-0000-0000-000000000001';
const A_INCHARGE = '10000000-0000-0000-0000-000000000003';
const A_AR_SUM   = '10000000-0000-0000-0000-000000000002';
const A_AP       = '20000000-0000-0000-0000-000000000001';
const A_FUND     = '30000000-0000-0000-0000-000000000001';
const A_INCOME   = '40000000-0000-0000-0000-000000000001';
const A_PAPER    = '50000000-0000-0000-0000-000000000001';
const A_EQUIP    = '50000000-0000-0000-0000-000000000002';

const A_AR_AARAV  = 'acc-ar-aarav-01';
const A_AR_PRIYA  = 'acc-ar-priya-02';
const A_AR_RAHUL  = 'acc-ar-rahul-03';
const A_AR_FATIMA = 'acc-ar-fatima-04';
const A_AR_ARJUN  = 'acc-ar-arjun-05';

// ─── Factory function — generates dataset with dates relative to today ────────
export function createInitialDemoDataset(): DemoDataSet {
  const dAgo = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  const today = dAgo(0);
  const d1    = dAgo(1);
  const d2    = dAgo(2);
  const d3    = dAgo(3);
  const d5    = dAgo(5);
  const d7    = dAgo(7);
  const FY    = 'fy-2026-2027';

  // ── BATCHES ────────────────────────────────────────────────────────────────
  const batches: Batch[] = [
    { id: 'batch-jd-1', name: 'JD 1', category: 'JD', sort_order: 1, created_at: '2025-01-01T00:00:00Z' },
    { id: 'batch-hs-2', name: 'HS 2', category: 'HS', sort_order: 2, created_at: '2025-01-01T00:00:00Z' },
    { id: 'batch-bs-3', name: 'BS 3', category: 'BS', sort_order: 3, created_at: '2024-01-01T00:00:00Z' },
    { id: 'batch-bs-5', name: 'BS 5', category: 'BS', sort_order: 4, created_at: '2022-01-01T00:00:00Z' },
  ];

  // ── STUDENTS ───────────────────────────────────────────────────────────────
  const students: Student[] = [
    { id: 'student-aarav-01',  name: 'Aarav Sharma', phone: '9876543210', password_hash: 'demo1234', batch_id: 'batch-jd-1', status: 'active', created_at: d7 },
    { id: 'student-priya-02',  name: 'Priya Nair',   phone: '9123456780', password_hash: 'demo1234', batch_id: 'batch-hs-2', status: 'active', created_at: d7 },
    { id: 'student-rahul-03',  name: 'Rahul Menon',  phone: '9988776655', password_hash: 'demo1234', batch_id: 'batch-bs-3', status: 'active', created_at: d7 },
    { id: 'student-fatima-04', name: 'Fatima Khan',  phone: '9876012345', password_hash: 'demo1234', batch_id: 'batch-jd-1', status: 'active', created_at: d7 },
    { id: 'student-arjun-05',  name: 'Arjun Verma',  phone: '9765432109', password_hash: 'demo1234', batch_id: 'batch-hs-2', status: 'active', created_at: d7 },
  ];

  // ── ACCOUNTS ───────────────────────────────────────────────────────────────
  const accounts: Account[] = [
    { id: A_CASH,     name: 'Cash and Bank Account',                      type: 'asset',     is_student_account: false, created_at: '2025-01-01T00:00:00Z' },
    { id: A_INCHARGE, name: 'Cash in Hand (In-Charge)',                   type: 'asset',     is_student_account: false, created_at: '2025-01-01T00:00:00Z' },
    { id: A_AR_SUM,   name: 'Student Accounts Receivable (Summary)',      type: 'asset',     is_student_account: false, created_at: '2025-01-01T00:00:00Z' },
    { id: A_AP,       name: 'Accounts Payable',                           type: 'liability', is_student_account: false, created_at: '2025-01-01T00:00:00Z' },
    { id: A_FUND,     name: 'Fund Balance / Net Assets',                  type: 'equity',    is_student_account: false, created_at: '2025-01-01T00:00:00Z' },
    { id: A_INCOME,   name: 'Printing Service Income',                    type: 'revenue',   is_student_account: false, created_at: '2025-01-01T00:00:00Z' },
    { id: A_PAPER,    name: 'Paper & Ink Expense',                        type: 'expense',   is_student_account: false, created_at: '2025-01-01T00:00:00Z' },
    { id: A_EQUIP,    name: 'Equipment Maintenance Expense',              type: 'expense',   is_student_account: false, created_at: '2025-01-01T00:00:00Z' },
    { id: A_AR_AARAV,  name: 'Aarav Sharma - Accounts Receivable',  type: 'asset', is_student_account: true,  student_id: 'student-aarav-01',  created_at: d7 },
    { id: A_AR_PRIYA,  name: 'Priya Nair - Accounts Receivable',    type: 'asset', is_student_account: true,  student_id: 'student-priya-02',  created_at: d7 },
    { id: A_AR_RAHUL,  name: 'Rahul Menon - Accounts Receivable',   type: 'asset', is_student_account: true,  student_id: 'student-rahul-03',  created_at: d7 },
    { id: A_AR_FATIMA, name: 'Fatima Khan - Accounts Receivable',   type: 'asset', is_student_account: true,  student_id: 'student-fatima-04', created_at: d7 },
    { id: A_AR_ARJUN,  name: 'Arjun Verma - Accounts Receivable',   type: 'asset', is_student_account: true,  student_id: 'student-arjun-05',  created_at: d7 },
  ];

  // ── JOURNAL ENTRY BUILDER ──────────────────────────────────────────────────
  let seq = 0;
  const je = (
    date: string,
    desc: string,
    lines: { a: string; dr: number; cr: number }[]
  ): DemoJournalEntry => {
    seq++;
    const id = `je-demo-${String(seq).padStart(3, '0')}`;
    return {
      id,
      date: `${date}T${String(8 + seq).padStart(2, '0')}:00:00.000Z`,
      description: desc,
      financial_year_id: FY,
      created_at: new Date().toISOString(),
      voided_at: null,
      lines: lines.map((l, i) => ({
        id: `${id}-l${i + 1}`,
        journal_entry_id: id,
        account_id: l.a,
        debit_amount: l.dr,
        credit_amount: l.cr,
      })),
    };
  };

  // ── JOURNAL ENTRIES ────────────────────────────────────────────────────────
  //
  // VERIFIED BALANCED LEDGER
  // ────────────────────────────────────────────────────────────
  // Account              DR total    CR total    Net (DR-CR)
  // Cash and Bank        325         120         +205  ✓ asset
  // Cash in Hand         50          0           +50   ✓ asset
  // Aarav AR             120         50          +70   ✓ asset
  // Priya AR             50          50          0
  // Rahul AR             70          40          +30   ✓ asset
  // Fatima AR            80          0           +80   ✓ asset
  // Arjun AR             35          35          0
  // Fund Balance         0           325         +325  ✓ equity (cr)
  // Printing Income      0           230         +230  ✓ revenue (cr)
  // Paper & Ink          90          0           +90   ✓ expense
  // Equipment Maint      30          0           +30   ✓ expense
  // ────────────────────────────────────────────────────────────
  // Total Debits = 850   Total Credits = 850  ✓
  //
  // Balance Sheet:
  //   Assets   = 205 (cash) + 50 (incharge) + 180 (AR) = 435
  //   Equity   = 325 (fund) + 110 (surplus 230-120)    = 435  ✓ BALANCED
  //
  // Today view (last 2 JEs today):
  //   Credit Given = 45+20 = 65
  //   Cash inflows = 35
  //   Cash outflows = 30
  //   Cash Flow    = +5
  //   Expenses     = 30
  //   Net Surplus  = 65-30 = 35

  const journalEntries: DemoJournalEntry[] = [
    // d7 — Opening entries
    je(d7, 'Opening cash float — start of period',
      [{ a: A_CASH, dr: 200, cr: 0 }, { a: A_FUND, dr: 0, cr: 200 }]),

    je(d7, 'Opening balance — Aarav Sharma (prior period prints)',
      [{ a: A_AR_AARAV, dr: 75, cr: 0 }, { a: A_FUND, dr: 0, cr: 75 }]),

    je(d7, 'Opening balance — Priya Nair (prior period prints)',
      [{ a: A_AR_PRIYA, dr: 50, cr: 0 }, { a: A_FUND, dr: 0, cr: 50 }]),

    // d5 — Print jobs
    je(d5, 'Print job — Rahul Menon (B&W, 40 pages)',
      [{ a: A_AR_RAHUL, dr: 40, cr: 0 }, { a: A_INCOME, dr: 0, cr: 40 }]),

    je(d5, 'Print job — Fatima Khan (Color, 6 pages)',
      [{ a: A_AR_FATIMA, dr: 60, cr: 0 }, { a: A_INCOME, dr: 0, cr: 60 }]),

    // d3 — Cash received + expense
    je(d3, 'Cash payment received — Aarav Sharma',
      [{ a: A_CASH, dr: 50, cr: 0 }, { a: A_AR_AARAV, dr: 0, cr: 50 }]),

    je(d3, 'Paper & ink restock — vendor purchase',
      [{ a: A_PAPER, dr: 90, cr: 0 }, { a: A_CASH, dr: 0, cr: 90 }]),

    // d2 — Print job + workforce collection
    je(d2, 'Print job — Arjun Verma (B&W, 35 pages)',
      [{ a: A_AR_ARJUN, dr: 35, cr: 0 }, { a: A_INCOME, dr: 0, cr: 35 }]),

    je(d2, 'Cash collected by Yaseen (Staff) — Priya Nair full payment',
      [{ a: A_INCHARGE, dr: 50, cr: 0 }, { a: A_AR_PRIYA, dr: 0, cr: 50 }]),

    // d1 — Print + payment
    je(d1, 'Print job — Rahul Menon (Assignment, 30 pages)',
      [{ a: A_AR_RAHUL, dr: 30, cr: 0 }, { a: A_INCOME, dr: 0, cr: 30 }]),

    je(d1, 'Cash payment received — Rahul Menon',
      [{ a: A_CASH, dr: 40, cr: 0 }, { a: A_AR_RAHUL, dr: 0, cr: 40 }]),

    // today — Daily activity (shows in "Today" view)
    je(today, 'Print job — Aarav Sharma (Notes, 45 pages)',
      [{ a: A_AR_AARAV, dr: 45, cr: 0 }, { a: A_INCOME, dr: 0, cr: 45 }]),

    je(today, 'Print job — Fatima Khan (Lab report, 20 pages)',
      [{ a: A_AR_FATIMA, dr: 20, cr: 0 }, { a: A_INCOME, dr: 0, cr: 20 }]),

    je(today, 'Cash payment received — Arjun Verma',
      [{ a: A_CASH, dr: 35, cr: 0 }, { a: A_AR_ARJUN, dr: 0, cr: 35 }]),

    je(today, 'Equipment maintenance — Printer roller service',
      [{ a: A_EQUIP, dr: 30, cr: 0 }, { a: A_CASH, dr: 0, cr: 30 }]),
  ];

  // ── PAYMENT CLAIMS ─────────────────────────────────────────────────────────
  // Student outstanding balances after all entries:
  //   Aarav  = 75+45-50 = 70
  //   Priya  = 50-50    = 0
  //   Rahul  = 40+30-40 = 30
  //   Fatima = 60+20    = 80
  //   Arjun  = 35-35    = 0
  const paymentClaims: DemoPaymentClaim[] = [
    {
      id: 'claim-001',
      student_id: 'student-aarav-01',
      student_name: 'Aarav Sharma',
      amount: 70,
      transaction_id: 'UPI20260816092143',
      payment_date: today,
      status: 'pending',
      created_at: `${today}T09:21:00Z`,
    },
    {
      id: 'claim-002',
      student_id: 'student-fatima-04',
      student_name: 'Fatima Khan',
      amount: 80,
      transaction_id: 'UPI20260814110045',
      payment_date: d2,
      status: 'pending',
      created_at: `${d2}T11:00:00Z`,
    },
    {
      id: 'claim-003',
      student_id: 'student-arjun-05',
      student_name: 'Arjun Verma',
      amount: 35,
      transaction_id: 'UPI20260813095500',
      payment_date: d3,
      status: 'verified',
      verified_by: 'admin@lab.com',
      verified_at: `${d2}T14:00:00Z`,
      created_at: `${d3}T09:55:00Z`,
    },
    {
      id: 'claim-004',
      student_id: 'student-rahul-03',
      student_name: 'Rahul Menon',
      amount: 30,
      transaction_id: 'UPI20260812180022',
      payment_date: d5,
      status: 'rejected',
      rejection_reason: 'Transaction ID not found in bank records. Please resubmit with correct UTR.',
      created_at: `${d5}T18:00:00Z`,
    },
  ];

  // ── CASH HANDOVER CLAIMS ───────────────────────────────────────────────────
  const cashHandoverClaims: DemoCashHandoverClaim[] = [];

  // ── FINANCIAL YEARS ────────────────────────────────────────────────────────
  const financialYears: DemoFinancialYear[] = [
    {
      id: FY,
      year_label: 'FY 2026-2027',
      name: 'FY 2026-2027',
      start_date: '2026-04-01',
      end_date: '2027-03-31',
      is_current: true,
      closed_at: null,
    },
    {
      id: 'fy-2025-2026',
      year_label: 'FY 2025-2026',
      name: 'FY 2025-2026',
      start_date: '2025-04-01',
      end_date: '2026-03-31',
      is_current: false,
      closed_at: '2026-03-31T23:59:59Z',
    },
  ];

  // ── INCHARGE STAFF ─────────────────────────────────────────────────────────
  const inchargeStaff: DemoInchargeStaff[] = [];

  return { batches, students, accounts, journalEntries, paymentClaims, cashHandoverClaims, financialYears, inchargeStaff };
}

// Static export kept for backwards compatibility
export const INITIAL_DEMO_DATASET = createInitialDemoDataset();
