import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = createAdminClient();

    // 1. Fetch most recently closed FY
    const { data: closedYears, error: fetchErr } = await supabase
      .from('financial_years')
      .select('*')
      .eq('is_current', false)
      .not('closed_at', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(1);

    if (fetchErr || !closedYears || (closedYears as any[]).length === 0) {
      return NextResponse.json({ success: false, error: 'No closed financial year available to undo.' }, { status: 400 });
    }

    const lastClosedFY = (closedYears as any[])[0];

    // 2. Fetch current active FY (safely query latest active)
    const { data: currentFYs } = await supabase
      .from('financial_years')
      .select('*')
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1);

    const currentFY = currentFYs && currentFYs.length > 0 ? (currentFYs as any[])[0] : null;

    // 3. Safety check: verify no new entries posted into active FY
    if (currentFY && currentFY.id !== lastClosedFY.id) {
      const { data: newEntries } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('financial_year_id', currentFY.id)
        .is('voided_at', null)
        .limit(1);

      if (newEntries && newEntries.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Undo disabled: Active journal entries have already been posted into the new financial year (${currentFY.name}).`,
          },
          { status: 400 }
        );
      }
    }

    // 4. Revert student batch promotions & statuses
    let snapshots: Array<{ student_id: string; batch_id: string; status: string }> = [];

    if (lastClosedFY.rollover_snapshot) {
      if (Array.isArray(lastClosedFY.rollover_snapshot)) {
        snapshots = lastClosedFY.rollover_snapshot as any;
      } else if (typeof lastClosedFY.rollover_snapshot === 'string') {
        try {
          snapshots = JSON.parse(lastClosedFY.rollover_snapshot);
        } catch (e) {}
      }
    }

    // Fallback: Retrieve snapshot payload from closing entry description in journal_entries if column was missing
    if (snapshots.length === 0) {
      const { data: closingEntries } = await supabase
        .from('journal_entries')
        .select('id, description')
        .eq('financial_year_id', lastClosedFY.id)
        .ilike('description', '%[ROLLOVER_SNAPSHOT]:%')
        .is('voided_at', null)
        .order('created_at', { ascending: false });

      if (closingEntries && closingEntries.length > 0) {
        for (const entry of (closingEntries as any[])) {
          if (entry.description && entry.description.includes('[ROLLOVER_SNAPSHOT]:')) {
            const rawJson = entry.description.split('[ROLLOVER_SNAPSHOT]:')[1]?.trim();
            if (rawJson) {
              try {
                const parsed = JSON.parse(rawJson);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  snapshots = parsed;
                  break;
                }
              } catch (e) {}
            }
          }
        }
      }
    }

    let restoredStudentsCount = 0;
    if (snapshots.length > 0) {
      for (const snap of snapshots) {
        const { error: updateErr } = await ((supabase
          .from('students') as any)
          .update({ batch_id: snap.batch_id, status: snap.status as any })
          .eq('id', snap.student_id) as Promise<{ error: any }>);

        if (updateErr) {
          console.error(`[UNDO ROLLOVER] Failed to revert student ${snap.student_id}:`, updateErr.message);
        } else {
          restoredStudentsCount++;
        }
      }
    }

    // 5. Void closing journal entry (by closing_entry_id or by financial_year_id)
    if (lastClosedFY.closing_entry_id) {
      await ((supabase
        .from('journal_entries') as any)
        .update({ voided_at: new Date().toISOString(), voided_by: 'Admin' })
        .eq('id', lastClosedFY.closing_entry_id));
    }

    // Void any closing entry matching financial_year_id or description
    const { data: closingEntriesToVoid } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('financial_year_id', lastClosedFY.id)
      .is('voided_at', null);

    if (closingEntriesToVoid && closingEntriesToVoid.length > 0) {
      const idsToVoid = (closingEntriesToVoid as any[]).map((e) => e.id);
      await ((supabase
        .from('journal_entries') as any)
        .update({ voided_at: new Date().toISOString(), voided_by: 'Admin' })
        .in('id', idsToVoid));
    }

    // 6. Delete the unpopulated new financial year created during rollover
    if (lastClosedFY.created_new_fy_id) {
      await supabase
        .from('financial_years')
        .delete()
        .eq('id', lastClosedFY.created_new_fy_id);
    } else if (currentFY && currentFY.id !== lastClosedFY.id) {
      await supabase
        .from('financial_years')
        .delete()
        .eq('id', currentFY.id);
    }

    // 7. Re-open closed financial year (WITH SCHEMA-CACHE FALLBACK)
    let { error: reopenErr } = await ((supabase
      .from('financial_years') as any)
      .update({
        is_current: true,
        closed_at: null,
        closing_entry_id: null,
        created_new_fy_id: null,
        rollover_snapshot: null,
      })
      .eq('id', lastClosedFY.id) as Promise<{ error: any }>);

    if (reopenErr && (reopenErr.message?.includes('closing_entry_id') || reopenErr.message?.includes('created_new_fy_id') || reopenErr.message?.includes('schema cache') || reopenErr.code === '42703' || reopenErr.code === 'PGRST204')) {
      const fallbackRes = await ((supabase
        .from('financial_years') as any)
        .update({
          is_current: true,
          closed_at: null,
        })
        .eq('id', lastClosedFY.id) as Promise<{ error: any }>);
      reopenErr = fallbackRes.error;
    }

    if (reopenErr) {
      return NextResponse.json({ success: false, error: `Failed to re-open financial year: ${reopenErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      reopenedYearName: lastClosedFY.name,
      restoredStudentsCount,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

