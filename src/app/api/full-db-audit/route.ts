import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 1. Inspect table columns via sample selects
    const tableChecks: Record<string, any> = {};

    const tablesToInspect = [
      'batches',
      'students',
      'accounts',
      'financial_years',
      'journal_entries',
      'journal_entry_lines',
      'print_jobs',
      'journal_entry_audit_log',
      'payment_claims',
    ];

    for (const tbl of tablesToInspect) {
      const { data, error } = await adminSupabase.from(tbl).select('*').limit(1);
      if (error) {
        tableChecks[tbl] = { status: 'error', message: error.message, code: error.code };
      } else {
        const sampleRow = data && data.length > 0 ? data[0] : null;
        tableChecks[tbl] = {
          status: 'ok',
          columnsPresent: sampleRow ? Object.keys(sampleRow) : 'empty table (column list unknown from row)',
        };
      }
    }

    // 2. Test common RPC functions
    const rpcTests: Record<string, any> = {};
    const funcsToTest = [
      { name: 'post_journal_entry', params: { p_description: 'test', p_lines: [] } },
      { name: 'post_journal_entry_with_lines', params: {} },
    ];

    for (const f of funcsToTest) {
      const { data, error } = await adminSupabase.rpc(f.name as any, f.params);
      if (error) {
        rpcTests[f.name] = { error: error.message, code: error.code };
      } else {
        rpcTests[f.name] = { status: 'ok', data };
      }
    }

    return NextResponse.json({
      tableChecks,
      rpcTests,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
