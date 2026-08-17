import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createAdminClient();

  const { data: fyRow } = await supabase.from('financial_years').select('*').limit(1);
  const { data: jeRow } = await supabase.from('journal_entries').select('*').limit(1);
  const { data: auditRow } = await supabase.from('journal_entry_audit_log').select('*').limit(1);
  const { data: studentRow } = await supabase.from('students').select('*').limit(1);

  return NextResponse.json({
    financial_years_cols: fyRow && fyRow[0] ? Object.keys(fyRow[0]) : [],
    journal_entries_cols: jeRow && jeRow[0] ? Object.keys(jeRow[0]) : [],
    audit_log_cols: auditRow && auditRow[0] ? Object.keys(auditRow[0]) : [],
    students_cols: studentRow && studentRow[0] ? Object.keys(studentRow[0]) : []
  });
}
