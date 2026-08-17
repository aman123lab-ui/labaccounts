import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const url = 'https://rpbgtykecsoigvxjjbsm.supabase.co/rest/v1/journal_entries?select=id,date,description,voided_at,journal_entry_lines(id,account_id,debit_amount,credit_amount)';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwYmd0eWtlY3NvaWd2eGpqYnNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAzMDg5MywiZXhwIjoyMTAxNjA2ODkzfQ.IsGAEwJUQEkmIP0GU2KqZD_M8gTw_4yM4p9V1vb-xGs';

  try {
    const res = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      cache: 'no-store',
    });
    const entries = await res.json();
    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: entries }, { status: 500 });
    }

    const corrupted = entries
      .filter((e: any) => (e.journal_entry_lines || []).length > 2)
      .map((e: any) => ({
        id: e.id,
        date: e.date,
        description: e.description,
        voided_at: e.voided_at,
        lineCount: (e.journal_entry_lines || []).length,
        lines: e.journal_entry_lines,
      }));

    const clean = entries.map((e: any) => ({
      id: e.id,
      description: e.description,
      lineCount: (e.journal_entry_lines || []).length,
    }));

    return NextResponse.json({
      totalEntries: entries.length,
      corruptedCount: corrupted.length,
      corruptedEntries: corrupted,
      allEntriesSummary: clean,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
