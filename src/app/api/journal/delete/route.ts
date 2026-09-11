import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { journalEntryId, deletedBy } = await req.json();

    if (!journalEntryId) {
      return NextResponse.json({ success: false, error: 'journalEntryId is required.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rpbgtykecsoigvxjjbsm.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(url, key);

    // 1. Fetch before snapshot for permanent deletion record
    const { data: beforeEntry, error: fetchErr } = await supabase
      .from('journal_entries')
      .select('*, journal_entry_lines(*)')
      .eq('id', journalEntryId)
      .maybeSingle();

    if (!beforeEntry && fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    // 2. Clear FK references in print_jobs table if linked
    try {
      await supabase
        .from('print_jobs')
        .update({ journal_entry_id: null })
        .eq('journal_entry_id', journalEntryId);
    } catch (pjErr) {
      console.warn('Notice clearing print_jobs foreign key:', pjErr);
    }

    // 3. Delete journal_entry_lines
    const { error: linesDeleteErr } = await supabase
      .from('journal_entry_lines')
      .delete()
      .eq('journal_entry_id', journalEntryId);

    if (linesDeleteErr) {
      console.warn('Notice deleting lines:', linesDeleteErr.message);
    }

    // 4. Delete foreign key references in journal_entry_audit_log if any
    try {
      await supabase
        .from('journal_entry_audit_log')
        .delete()
        .eq('journal_entry_id', journalEntryId);
    } catch (auditErr) {
      console.warn('Notice deleting audit log lines:', auditErr);
    }

    // 5. Delete journal entry row permanently from database
    const { error: entryDeleteErr } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', journalEntryId);

    if (entryDeleteErr) {
      return NextResponse.json({ success: false, error: entryDeleteErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Journal entry deleted permanently.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
