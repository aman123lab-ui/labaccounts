import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { journalEntryId, voidedBy } = await req.json();

    if (!journalEntryId) {
      return NextResponse.json({ success: false, error: 'journalEntryId is required.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rpbgtykecsoigvxjjbsm.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(url, key);

    // 1. Fetch before snapshot
    const { data: beforeEntry, error: fetchErr } = await supabase
      .from('journal_entries')
      .select('*, journal_entry_lines(*)')
      .eq('id', journalEntryId)
      .single();

    if (fetchErr || !beforeEntry) {
      return NextResponse.json({ success: false, error: 'Journal entry not found.' }, { status: 404 });
    }

    const { data: printJob } = await supabase
      .from('print_jobs')
      .select('id, print_type, num_pages, student_id')
      .eq('journal_entry_id', journalEntryId)
      .maybeSingle();

    const source = printJob
      ? 'Debit Book (Print Job)'
      : (beforeEntry.description || '').toLowerCase().includes('payment') || (beforeEntry.description || '').toLowerCase().includes('credit')
      ? 'Debit Book (Payment Credit)'
      : 'Manual Journal Entry';

    const now = new Date().toISOString();

    // 2. Audit Log
    try {
      await supabase.from('journal_entry_audit_log').insert({
        journal_entry_id: journalEntryId,
        action: 'voided',
        changed_by: voidedBy || 'Admin',
        before_snapshot: { ...beforeEntry, source, linked_print_job: printJob || null },
        after_snapshot: { journal_entry_id: journalEntryId, voided_at: now, status: 'voided', source },
      });
    } catch (auditErr) {
      console.warn('Audit log write notice:', auditErr);
    }

    // 3. Mark Voided
    const { data: updatedRows, error: voidErr } = await supabase
      .from('journal_entries')
      .update({ voided_at: now })
      .eq('id', journalEntryId)
      .select();

    if (voidErr) {
      return NextResponse.json({ success: false, error: voidErr.message }, { status: 500 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Void update returned 0 updated rows.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, voidedAt: now, updatedRowsCount: updatedRows.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
