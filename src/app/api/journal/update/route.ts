import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { journalEntryId, description, date, lines, changedBy } = await req.json();

    if (!journalEntryId || !lines || !Array.isArray(lines)) {
      return NextResponse.json({ success: false, error: 'journalEntryId and lines array are required.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rpbgtykecsoigvxjjbsm.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(url, key);

    // 1. Fetch current entry
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

    // 2. Audit Log
    try {
      await supabase.from('journal_entry_audit_log').insert({
        journal_entry_id: journalEntryId,
        action: 'edited',
        changed_by: changedBy || 'Admin',
        before_snapshot: { ...beforeEntry, source, linked_print_job: printJob || null },
        after_snapshot: { journal_entry_id: journalEntryId, date, description, lines, source },
      });
    } catch (auditErr) {
      console.warn('Audit log write notice:', auditErr);
    }

    // 3. Update Header
    const { data: updatedHeaderRows, error: headerErr } = await supabase
      .from('journal_entries')
      .update({
        description,
        date: new Date(date).toISOString(),
      })
      .eq('id', journalEntryId)
      .select();

    if (headerErr) {
      return NextResponse.json({ success: false, error: headerErr.message }, { status: 500 });
    }

    // 4. Update Lines in-place / insert / delete
    const { data: existingLines } = await supabase
      .from('journal_entry_lines')
      .select('id')
      .eq('journal_entry_id', journalEntryId);

    const existingIds = new Set((existingLines || []).map((l) => l.id));
    const submittedIds = new Set(lines.map((l: any) => l.id).filter(Boolean) as string[]);

    const idsToDelete = Array.from(existingIds).filter((id) => !submittedIds.has(id));
    if (idsToDelete.length > 0) {
      await supabase.from('journal_entry_lines').delete().in('id', idsToDelete);
    }

    for (const l of lines) {
      if (l.id && existingIds.has(l.id)) {
        await supabase
          .from('journal_entry_lines')
          .update({
            account_id: l.accountId,
            debit_amount: l.debit,
            credit_amount: l.credit,
          })
          .eq('id', l.id);
      } else {
        await supabase.from('journal_entry_lines').insert({
          journal_entry_id: journalEntryId,
          account_id: l.accountId,
          debit_amount: l.debit,
          credit_amount: l.credit,
        });
      }
    }

    // 5. Sanity check
    const { data: finalLines } = await supabase
      .from('journal_entry_lines')
      .select('id')
      .eq('journal_entry_id', journalEntryId);

    if (!finalLines || finalLines.length !== lines.length) {
      return NextResponse.json(
        { success: false, error: `Sanity safeguard error: Submitted ${lines.length} lines, but DB now has ${finalLines?.length || 0} lines.` },
        { status: 500 }
      );
    }

    // 6. Update linked print_job
    if (printJob) {
      const debitLine = lines.find((l: any) => l.debit > 0);
      const updatedAmount = debitLine ? debitLine.debit : 0;
      await supabase
        .from('print_jobs')
        .update({ description, amount: updatedAmount })
        .eq('id', printJob.id);
    }

    return NextResponse.json({ success: true, updatedHeaderCount: updatedHeaderRows?.length || 0 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
