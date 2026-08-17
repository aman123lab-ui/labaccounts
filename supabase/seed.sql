-- Lab Accounting System - Seed Script
-- Default Chart of Accounts and Initial Setup

-- 1. Initial Financial Year
INSERT INTO financial_years (id, name, start_date, end_date, is_current)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'FY 2026-2027',
  '2026-01-01',
  '2026-12-31',
  true
) ON CONFLICT (id) DO NOTHING;

-- 2. Default Batches
INSERT INTO batches (id, name, category, sort_order)
VALUES 
  ('22222222-2222-2222-2222-222222222221', 'JD 2026', 'JD', 1),
  ('22222222-2222-2222-2222-222222222222', 'HS 2026', 'HS', 2),
  ('22222222-2222-2222-2222-222222222223', 'BS 2026', 'BS', 3)
ON CONFLICT (id) DO NOTHING;

-- 3. Default Chart of Accounts (Fund Accounting Terminology)
INSERT INTO accounts (id, name, type, is_student_account)
VALUES
  -- Assets
  ('10000000-0000-0000-0000-000000000001', 'Cash Account', 'asset', false),
  ('10000000-0000-0000-0000-000000000003', 'Cash in Hand (In-Charge)', 'asset', false),
  ('10000000-0000-0000-0000-000000000002', 'Student Accounts Receivable', 'asset', false),
  
  -- Equity (Fund Balance / Net Assets in non-profit terms)
  ('30000000-0000-0000-0000-000000000001', 'Fund Balance / Net Assets Account', 'equity', false),
  
  -- Revenue
  ('40000000-0000-0000-0000-000000000001', 'Service Income Account', 'revenue', false),
  
  -- Expense
  ('50000000-0000-0000-0000-000000000001', 'Paper & Ink Supplies Expense', 'expense', false),
  ('50000000-0000-0000-0000-000000000002', 'Equipment Maintenance Expense', 'expense', false)
ON CONFLICT (id) DO NOTHING;
