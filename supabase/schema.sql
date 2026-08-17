-- Lab Accounting System - Postgres Database Schema & RLS Policies
-- Non-Profit Student Organization Credit Service Ledger

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Account Types Enum
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'revenue', 'expense', 'equity');

-- 2. Batches Table
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- e.g., 'JD', 'HS', 'BS'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Students Table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Accounts Table (Chart of Accounts)
-- Note: Equity represents "Fund Balance / Net Assets" in Non-Profit Accounting
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type account_type NOT NULL,
  is_student_account BOOLEAN NOT NULL DEFAULT false,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Financial Years Table
CREATE TABLE IF NOT EXISTS financial_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  closed_at TIMESTAMPTZ DEFAULT NULL,
  closing_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_new_fy_id UUID REFERENCES financial_years(id) ON DELETE SET NULL,
  rollover_snapshot JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS closing_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;
ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS created_new_fy_id UUID REFERENCES financial_years(id) ON DELETE SET NULL;
ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS rollover_snapshot JSONB DEFAULT NULL;

-- 6. Journal Entries Table (Transaction Headers)
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT NOT NULL,
  financial_year_id UUID REFERENCES financial_years(id) ON DELETE RESTRICT,
  is_closing_entry BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ DEFAULT NULL,
  voided_by TEXT DEFAULT NULL
);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS is_closing_entry BOOLEAN NOT NULL DEFAULT false;

-- 6b. Journal Entry Audit Log Table
CREATE TABLE IF NOT EXISTS journal_entry_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('edited', 'deleted')),
  changed_by TEXT NOT NULL DEFAULT 'Admin',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  before_snapshot JSONB NOT NULL,
  after_snapshot JSONB DEFAULT NULL
);

-- 7. Journal Entry Lines Table (Transaction Details / Ledger)
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  debit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (debit_amount >= 0),
  credit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (credit_amount >= 0),
  CONSTRAINT chk_debit_credit_exclusive CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR
    (debit_amount = 0 AND credit_amount > 0)
  )
);

-- 8. Print Jobs Table
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  print_type TEXT NOT NULL CHECK (print_type IN ('bw', 'color')),
  side TEXT NOT NULL CHECK (side IN ('single', 'double')),
  num_pages INTEGER NOT NULL CHECK (num_pages > 0),
  description TEXT,
  discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_student ON accounts(student_id);
CREATE INDEX IF NOT EXISTS idx_students_batch ON students(batch_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_student ON print_jobs(student_id);

-- -------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------

ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_audit_log ENABLE ROW LEVEL SECURITY;

-- Read policies (accessible by authenticated users / public service query)
CREATE POLICY "Public read access for batches" ON batches FOR SELECT USING (true);
CREATE POLICY "Admin write access for batches" ON batches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update access for batches" ON batches FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete access for batches" ON batches FOR DELETE TO authenticated USING (true);
CREATE POLICY "Public read access for accounts" ON accounts FOR SELECT USING (true);
CREATE POLICY "Public read access for financial_years" ON financial_years FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public write access for financial_years" ON financial_years;
CREATE POLICY "Public write access for financial_years" ON financial_years FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read access for students" ON students FOR SELECT USING (true);
CREATE POLICY "Authenticated read access for journal_entries" ON journal_entries FOR SELECT USING (true);
CREATE POLICY "Authenticated read access for journal_entry_lines" ON journal_entry_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated read access for print_jobs" ON print_jobs FOR SELECT USING (true);
CREATE POLICY "Public read access for journal_entry_audit_log" ON journal_entry_audit_log FOR SELECT USING (true);

-- Insert / Update / Delete policies for operations (FOR ALL allows SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Authenticated insert access for journal_entries" ON journal_entries;
CREATE POLICY "Authenticated write access for journal_entries" ON journal_entries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated insert access for journal_entry_lines" ON journal_entry_lines;
CREATE POLICY "Authenticated write access for journal_entry_lines" ON journal_entry_lines FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated write access for students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated write access for accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated write access for print_jobs" ON print_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public write access for journal_entry_audit_log" ON journal_entry_audit_log FOR ALL USING (true) WITH CHECK (true);

-- 9. Payment Claims Table
CREATE TABLE IF NOT EXISTS payment_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  claimed_amount NUMERIC(10, 2) NOT NULL CHECK (claimed_amount > 0),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_by TEXT DEFAULT NULL,
  verified_at TIMESTAMPTZ DEFAULT NULL,
  admin_note TEXT DEFAULT NULL,
  upi_tn TEXT DEFAULT NULL,
  seen_at TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE payment_claims ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_claims_student ON payment_claims(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_claims_status ON payment_claims(status);

ALTER TABLE payment_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public write access for payment_claims" ON payment_claims;
DROP POLICY IF EXISTS "Public select access for payment_claims" ON payment_claims;
DROP POLICY IF EXISTS "Public insert access for payment_claims" ON payment_claims;
DROP POLICY IF EXISTS "Public update access for payment_claims" ON payment_claims;

CREATE POLICY "Public select access for payment_claims" ON payment_claims FOR SELECT USING (true);
CREATE POLICY "Public insert access for payment_claims" ON payment_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for payment_claims" ON payment_claims FOR UPDATE USING (true);

-- 10. Cash Handover Claims Table
CREATE TABLE IF NOT EXISTS cash_handover_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incharge_id TEXT NOT NULL,
  incharge_name TEXT DEFAULT 'Staff In-Charge',
  claimed_amount NUMERIC(12, 2) NOT NULL CHECK (claimed_amount > 0),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_by TEXT DEFAULT NULL,
  verified_at TIMESTAMPTZ DEFAULT NULL,
  admin_note TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_cash_handover_claims_incharge ON cash_handover_claims(incharge_id);
CREATE INDEX IF NOT EXISTS idx_cash_handover_claims_status ON cash_handover_claims(status);

ALTER TABLE cash_handover_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select access for cash_handover_claims" ON cash_handover_claims FOR SELECT USING (true);
CREATE POLICY "Public insert access for cash_handover_claims" ON cash_handover_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for cash_handover_claims" ON cash_handover_claims FOR UPDATE USING (true);

-- 11. In-Charge Staff Profiles Table
CREATE TABLE IF NOT EXISTS incharge_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  staff_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE incharge_profiles ADD COLUMN IF NOT EXISTS staff_id TEXT;

ALTER TABLE incharge_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select access for incharge_profiles" ON incharge_profiles FOR SELECT USING (true);
CREATE POLICY "Public insert access for incharge_profiles" ON incharge_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for incharge_profiles" ON incharge_profiles FOR UPDATE USING (true);

-- -------------------------------------------------------------
-- ATOMIC JOURNAL POSTING DATABASE FUNCTION
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION post_journal_entry(
  p_description TEXT,
  p_lines JSONB,
  p_date TIMESTAMPTZ DEFAULT now(),
  p_financial_year_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_is_closing_entry BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry_id UUID;
  v_total_debit NUMERIC(12, 2) := 0;
  v_total_credit NUMERIC(12, 2) := 0;
  v_line JSONB;
  v_account_id UUID;
  v_debit NUMERIC(12, 2);
  v_credit NUMERIC(12, 2);
BEGIN
  -- Validate lines array existence
  IF p_lines IS NULL OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal entry must contain at least two entry lines.';
  END IF;

  -- Validate balance across lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_debit := COALESCE((v_line->>'debit_amount')::NUMERIC, (v_line->>'debit')::NUMERIC, 0);
    v_credit := COALESCE((v_line->>'credit_amount')::NUMERIC, (v_line->>'credit')::NUMERIC, 0);

    IF (v_debit > 0 AND v_credit > 0) OR (v_debit = 0 AND v_credit = 0) THEN
      RAISE EXCEPTION 'Each entry line must have exactly one of debit or credit > 0.';
    END IF;

    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  END LOOP;

  -- Reject if Debits != Credits
  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'Unbalanced journal entry rejected: Total Debits (%) must equal Total Credits (%).', v_total_debit, v_total_credit;
  END IF;

  -- Insert Journal Entry Header
  INSERT INTO journal_entries (date, description, financial_year_id, created_by, is_closing_entry)
  VALUES (COALESCE(p_date, now()), p_description, p_financial_year_id, p_created_by, COALESCE(p_is_closing_entry, false))
  RETURNING id INTO v_entry_id;

  -- Insert Journal Entry Lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_account_id := (v_line->>'account_id')::UUID;
    v_debit := COALESCE((v_line->>'debit_amount')::NUMERIC, (v_line->>'debit')::NUMERIC, 0);
    v_credit := COALESCE((v_line->>'credit_amount')::NUMERIC, (v_line->>'credit')::NUMERIC, 0);

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount)
    VALUES (v_entry_id, v_account_id, v_debit, v_credit);
  END LOOP;

  RETURN v_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION post_journal_entry_with_lines(
  p_description TEXT DEFAULT NULL,
  p_lines JSONB DEFAULT NULL,
  p_date TIMESTAMPTZ DEFAULT now(),
  p_financial_year_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_is_closing_entry BOOLEAN DEFAULT false,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN post_journal_entry(
    p_description => p_description,
    p_lines => p_lines,
    p_date => p_date,
    p_financial_year_id => COALESCE(p_financial_year_id, p_reference_id),
    p_created_by => p_created_by,
    p_is_closing_entry => p_is_closing_entry
  );
END;
$$;

-- -------------------------------------------------------------
-- ENABLE REALTIME PUBLICATION FOR LIVE SYNC ACROSS CLIENTS
-- -------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE payment_claims;
  ALTER PUBLICATION supabase_realtime ADD TABLE journal_entries;
  ALTER PUBLICATION supabase_realtime ADD TABLE journal_entry_lines;
  ALTER PUBLICATION supabase_realtime ADD TABLE incharge_profiles;
  ALTER PUBLICATION supabase_realtime ADD TABLE cash_handover_claims;
  ALTER PUBLICATION supabase_realtime ADD TABLE students;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 12. App Settings Table (runtime key-value store for admin-controlled toggles)
-- Run this migration in the Supabase SQL editor if the table doesn't already exist:
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT 'true',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Public read (landing page reads show_demo_button without auth)
DROP POLICY IF EXISTS "Public read access for app_settings" ON app_settings;
CREATE POLICY "Public read access for app_settings" ON app_settings FOR SELECT USING (true);

-- Authenticated write (admin sessions can update settings)
DROP POLICY IF EXISTS "Authenticated write access for app_settings" ON app_settings;
CREATE POLICY "Authenticated write access for app_settings" ON app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed: show_demo_button defaults to ON
INSERT INTO app_settings (key, value) VALUES ('show_demo_button', 'true') ON CONFLICT (key) DO NOTHING;
