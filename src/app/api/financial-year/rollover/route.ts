import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculatePeriodFinancialSummary } from '@/services/accountingService';

export const dynamic = 'force-dynamic';

export const PROMOTION_MAPPING: Record<string, string> = {
  JD1: 'JD 2',
  JD2: 'JD 3',
  JD3: 'HS 1',
  HS1: 'HS 2',
  HS2: 'BS 1',
  BS1: 'BS 2',
  BS2: 'BS 3',
  BS3: 'BS 4',
  BS4: 'BS 5',
};

export function normalizeBatchName(name: string): string {
  return (name || '').replace(/[\s-]/g, '').toUpperCase();
}

function getBatchCategory(name: string): string {
  const upper = name.toUpperCase();
  if (upper.startsWith('JD')) return 'JD';
  if (upper.startsWith('HS')) return 'HS';
  if (upper.startsWith('BS')) return 'BS';
  return 'General';
}

function computeNextFinancialYearDates(currentEndDateStr: string) {
  const currentEnd = new Date(`${currentEndDateStr}T00:00:00.000Z`);
  const nextStart = new Date(currentEnd);
  nextStart.setUTCDate(nextStart.getUTCDate() + 1);

  const nextEnd = new Date(nextStart);
  nextEnd.setUTCFullYear(nextEnd.getUTCFullYear() + 1);
  nextEnd.setUTCDate(nextEnd.getUTCDate() - 1);

  const startStr = nextStart.toISOString().slice(0, 10);
  const endStr = nextEnd.toISOString().slice(0, 10);

  const startYear = nextStart.getUTCFullYear();
  const endYear = nextEnd.getUTCFullYear();
  const name = startYear === endYear ? `FY ${startYear}` : `FY ${startYear}-${endYear}`;

  return { name, startDate: startStr, endDate: endStr };
}

export async function POST() {
  const supabase = createAdminClient();

  try {
    // 1. FETCH CURRENT ACTIVE FINANCIAL YEAR (Primary current FY sorted by start_date)
    const { data: currentFYs, error: fetchErr } = await supabase
      .from('financial_years')
      .select('*')
      .eq('is_current', true)
      .order('start_date', { ascending: true })
      .limit(1);

    if (fetchErr || !currentFYs || currentFYs.length === 0) {
      return NextResponse.json({ success: false, error: 'No active financial year found to roll over.' }, { status: 400 });
    }

    const currentFY = currentFYs[0];

    // 2. FINANCIAL CLOSING ENTRY POSTING: ZERO OUT ALL NOMINAL (REVENUE & EXPENSE) ACCOUNTS
    const { data: accountsData, error: accErr } = await supabase
      .from('accounts')
      .select('id, name, type');

    if (accErr) {
      return NextResponse.json({ success: false, error: `Failed to fetch accounts: ${accErr.message}` }, { status: 500 });
    }

    let equityAccId = '30000000-0000-0000-0000-000000000001';
    (accountsData || []).forEach((acc) => {
      if (acc.type === 'equity') equityAccId = acc.id;
    });

    let { data: lineItems, error: lineErr } = await supabase
      .from('journal_entry_lines')
      .select('account_id, debit_amount, credit_amount, journal_entries!inner(date, voided_at)')
      .lte('journal_entries.date', `${currentFY.end_date}T23:59:59.999Z`)
      .is('journal_entries.voided_at', null);

    if (lineErr && (lineErr as { code?: string }).code === '42703') {
      const fallback = await supabase
        .from('journal_entry_lines')
        .select('account_id, debit_amount, credit_amount');
      lineItems = fallback.data as typeof lineItems;
    }

    const accountDebitTotals = new Map<string, number>();
    const accountCreditTotals = new Map<string, number>();

    (lineItems || []).forEach((l: any) => {
      const d = Number(l.debit_amount || 0);
      const c = Number(l.credit_amount || 0);
      accountDebitTotals.set(l.account_id, (accountDebitTotals.get(l.account_id) || 0) + d);
      accountCreditTotals.set(l.account_id, (accountCreditTotals.get(l.account_id) || 0) + c);
    });

    const linesToInsert: { account_id: string; debit_amount: number; credit_amount: number }[] = [];
    let totalRevenueClosed = 0;
    let totalExpensesClosed = 0;

    (accountsData || []).forEach((acc) => {
      const totDebit = accountDebitTotals.get(acc.id) || 0;
      const totCredit = accountCreditTotals.get(acc.id) || 0;

      if (acc.type === 'revenue') {
        const netCredit = totCredit - totDebit;
        if (Math.abs(netCredit) > 0.001) {
          if (netCredit > 0) {
            linesToInsert.push({ account_id: acc.id, debit_amount: netCredit, credit_amount: 0 });
            totalRevenueClosed += netCredit;
          } else {
            const debitBal = Math.abs(netCredit);
            linesToInsert.push({ account_id: acc.id, debit_amount: 0, credit_amount: debitBal });
            totalRevenueClosed -= debitBal;
          }
        }
      } else if (acc.type === 'expense') {
        const netDebit = totDebit - totCredit;
        if (Math.abs(netDebit) > 0.001) {
          if (netDebit > 0) {
            linesToInsert.push({ account_id: acc.id, debit_amount: 0, credit_amount: netDebit });
            totalExpensesClosed += netDebit;
          } else {
            const creditBal = Math.abs(netDebit);
            linesToInsert.push({ account_id: acc.id, debit_amount: creditBal, credit_amount: 0 });
            totalExpensesClosed -= creditBal;
          }
        }
      }
    });

    const netSurplus = totalRevenueClosed - totalExpensesClosed;

    if (netSurplus > 0.001) {
      linesToInsert.push({ account_id: equityAccId, debit_amount: 0, credit_amount: netSurplus });
    } else if (netSurplus < -0.001) {
      const deficit = Math.abs(netSurplus);
      linesToInsert.push({ account_id: equityAccId, debit_amount: deficit, credit_amount: 0 });
    }

    let closingEntryId: string | null = null;

    if (linesToInsert.length > 0) {
      const closingDesc = `Closing Entry for ${currentFY.name} — Zero Nominal Accounts & Transfer Net ${netSurplus >= 0 ? 'Surplus' : 'Deficit'} to Fund Balance`;
      const closingDate = `${currentFY.end_date}T23:59:59.000Z`;

      const { data: newEntry, error: postHeaderErr } = await supabase
        .from('journal_entries')
        .insert({
          date: closingDate,
          description: closingDesc,
          financial_year_id: currentFY.id,
          created_by: null,
          is_closing_entry: true,
        })
        .select('id')
        .single();

      if (postHeaderErr || !newEntry) {
        return NextResponse.json({ success: false, error: `Closing entry post failed: ${postHeaderErr?.message || 'Failed to insert entry header'}` }, { status: 500 });
      }

      closingEntryId = newEntry.id;

      const lineRows = linesToInsert.map((l) => ({
        journal_entry_id: closingEntryId,
        account_id: l.account_id,
        debit_amount: l.debit_amount,
        credit_amount: l.credit_amount,
      }));

      const { error: postLinesErr } = await supabase
        .from('journal_entry_lines')
        .insert(lineRows);

      if (postLinesErr) {
        await supabase.from('journal_entries').delete().eq('id', closingEntryId);
        return NextResponse.json({ success: false, error: `Closing entry lines post failed: ${postLinesErr.message}` }, { status: 500 });
      }
    }

    // 3. ACADEMIC BATCH PROMOTION & YEAR-SPECIFIC ALUMNI BATCH ROLLOVER
    const { data: batchesData, error: bErr } = await supabase.from('batches').select('*');
    if (bErr) {
      return NextResponse.json({ success: false, error: `Failed to fetch batches: ${bErr.message}` }, { status: 500 });
    }

    const batchMap = new Map<string, string>(); // normalized batch name -> batch id
    const batchObjMap = new Map<string, { id: string; name: string; category: string }>();
    (batchesData || []).forEach((b) => {
      batchMap.set(normalizeBatchName(b.name), b.id);
      batchObjMap.set(b.id, b);
    });

    // Derive Graduating Year from current FY's end_date (e.g. 2026-12-31 -> 2026)
    const gradYear = new Date(`${currentFY.end_date}T00:00:00.000Z`).getUTCFullYear();
    const alumniBatchName = `Alumni ${gradYear}`;
    const normAlumniName = normalizeBatchName(alumniBatchName);

    let alumniBatchId = batchMap.get(normAlumniName);
    if (!alumniBatchId) {
      const { data: newAlumni, error: alumniCreateErr } = await supabase
        .from('batches')
        .insert({
          name: alumniBatchName,
          category: 'General',
          sort_order: 99,
        })
        .select()
        .single();

      if (alumniCreateErr || !newAlumni) {
        return NextResponse.json({ success: false, error: `Failed to create ${alumniBatchName} batch: ${alumniCreateErr?.message}` }, { status: 500 });
      }

      alumniBatchId = newAlumni.id;
      batchMap.set(normAlumniName, alumniBatchId);
      batchObjMap.set(alumniBatchId, newAlumni);
    }

    const { data: activeStudents, error: stErr } = await supabase
      .from('students')
      .select('id, name, batch_id, status');

    if (stErr) {
      return NextResponse.json({ success: false, error: `Failed to fetch students for rollover: ${stErr.message}` }, { status: 500 });
    }

    let promotedStudentsCount = 0;
    let alumniStudentsCount = 0;
    let archivedStudentsCount = 0;

    // Build BEFORE snapshot of all students prior to promotion execution
    const studentSnapshot: Array<{ student_id: string; batch_id: string; status: string }> = (activeStudents || []).map((s) => ({
      student_id: s.id,
      batch_id: s.batch_id,
      status: s.status,
    }));

    if (activeStudents && activeStudents.length > 0) {
      const studentIds = activeStudents.map((s) => s.id);
      const { data: studentAccounts } = await supabase
        .from('accounts')
        .select('id, student_id')
        .in('student_id', studentIds);

      const studentAccountMap = new Map<string, string>();
      const accountIds: string[] = [];

      (studentAccounts || []).forEach((acc) => {
        if (acc.student_id) {
          studentAccountMap.set(acc.student_id, acc.id);
          accountIds.push(acc.id);
        }
      });

      const balanceMap = new Map<string, number>();
      if (accountIds.length > 0) {
        let { data: linesData, error: linesError } = await supabase
          .from('journal_entry_lines')
          .select('account_id, debit_amount, credit_amount, journal_entries!inner(voided_at)')
          .in('account_id', accountIds)
          .is('journal_entries.voided_at', null);

        if (linesError && (linesError as { code?: string }).code === '42703') {
          const fallback = await supabase
            .from('journal_entry_lines')
            .select('account_id, debit_amount, credit_amount')
            .in('account_id', accountIds);
          linesData = fallback.data as typeof linesData;
        }

        (linesData || []).forEach((line) => {
          const current = balanceMap.get(line.account_id) || 0;
          const net = Number(line.debit_amount || 0) - Number(line.credit_amount || 0);
          balanceMap.set(line.account_id, current + net);
        });
      }

      for (const student of activeStudents) {
        if (student.status !== 'active') continue;

        const batch = batchObjMap.get(student.batch_id);
        const rawBatchName = batch ? batch.name : '';
        const normBatchName = normalizeBatchName(rawBatchName);

        const accountId = studentAccountMap.get(student.id);
        const pendingBalance = accountId ? balanceMap.get(accountId) || 0 : 0;

        const nextBatchTargetName = PROMOTION_MAPPING[normBatchName];

        if (nextBatchTargetName) {
          const targetNorm = normalizeBatchName(nextBatchTargetName);
          let nextBatchId = batchMap.get(targetNorm);

          if (!nextBatchId) {
            const cat = getBatchCategory(nextBatchTargetName);
            const { data: createdBatch, error: batchCreateError } = await supabase
              .from('batches')
              .insert({
                name: nextBatchTargetName,
                category: cat,
                sort_order: 0,
              })
              .select()
              .single();

            if (batchCreateError || !createdBatch) {
              return NextResponse.json(
                { success: false, error: `Failed to create target batch ${nextBatchTargetName}: ${batchCreateError?.message}` },
                { status: 500 }
              );
            }

            nextBatchId = createdBatch.id;
            batchMap.set(targetNorm, nextBatchId);
            batchObjMap.set(nextBatchId, createdBatch);
          }

          const { error: updateErr } = await supabase
            .from('students')
            .update({ batch_id: nextBatchId, status: 'active' })
            .eq('id', student.id);

          if (updateErr) {
            return NextResponse.json(
              { success: false, error: `Failed to promote student ${student.name} to ${nextBatchTargetName}: ${updateErr.message}` },
              { status: 500 }
            );
          }

          promotedStudentsCount++;
        } else if (normBatchName === 'BS5') {
          if (pendingBalance > 0) {
            const targetBatchId = alumniBatchId || student.batch_id;
            const { error: updateErr } = await supabase
              .from('students')
              .update({ batch_id: targetBatchId, status: 'active' })
              .eq('id', student.id);

            if (updateErr) {
              return NextResponse.json(
                { success: false, error: `Failed to move BS5 student ${student.name} with balance to ${alumniBatchName}: ${updateErr.message}` },
                { status: 500 }
              );
            }

            alumniStudentsCount++;
          } else {
            const { error: updateErr } = await supabase
              .from('students')
              .update({ status: 'archived' })
              .eq('id', student.id);

            if (updateErr) {
              return NextResponse.json(
                { success: false, error: `Failed to archive BS5 student ${student.name}: ${updateErr.message}` },
                { status: 500 }
              );
            }

            archivedStudentsCount++;
          }
        }
      }
    }

    // Attach snapshot JSON to closing journal entry description as persistent fallback storage
    const snapshotTag = `| [ROLLOVER_SNAPSHOT]: ${JSON.stringify(studentSnapshot)}`;
    const closingDate = `${currentFY.end_date}T23:59:59.000Z`;

    if (closingEntryId) {
      // Update existing closing entry description with snapshot tag
      const { data: closingEntryRow } = await supabase.from('journal_entries').select('description').eq('id', closingEntryId).single();
      const baseDesc = closingEntryRow?.description || `Closing Entry for ${currentFY.name}`;
      await supabase.from('journal_entries').update({ description: `${baseDesc} ${snapshotTag}` }).eq('id', closingEntryId);
    } else {
      // Post a closing header entry containing the snapshot payload even if net surplus is 0
      const headerDesc = `Closing Entry for ${currentFY.name} ${snapshotTag}`;
      const { data: newClosingHeader } = await supabase
        .from('journal_entries')
        .insert({
          date: closingDate,
          description: headerDesc,
          financial_year_id: currentFY.id,
          created_by: null,
          is_closing_entry: true,
        })
        .select('id')
        .single();

      if (newClosingHeader) {
        closingEntryId = newClosingHeader.id;
      }
    }

    // 4. CREATE NEW FINANCIAL YEAR
    const nextFYDates = computeNextFinancialYearDates(currentFY.end_date);

    const { data: newFY, error: newFYErr } = await supabase
      .from('financial_years')
      .insert({
        name: nextFYDates.name,
        start_date: nextFYDates.startDate,
        end_date: nextFYDates.endDate,
        is_current: true,
      })
      .select()
      .single() as any;

    if (newFYErr || !newFY) {
      return NextResponse.json({ success: false, error: `Failed to create next financial year: ${newFYErr?.message}` }, { status: 500 });
    }

    // 5. CLOSE CURRENT FINANCIAL YEAR AND ATTACH ROLLOVER SNAPSHOT
    let { error: closeErr } = await supabase
      .from('financial_years')
      .update({
        is_current: false,
        closed_at: new Date().toISOString(),
        closing_entry_id: closingEntryId,
        created_new_fy_id: newFY.id,
        rollover_snapshot: studentSnapshot as any,
      })
      .eq('id', currentFY.id);

    if (closeErr && (closeErr.message?.includes('closing_entry_id') || closeErr.message?.includes('created_new_fy_id') || closeErr.message?.includes('schema cache') || closeErr.code === '42703' || closeErr.code === 'PGRST204')) {
      const fallbackClose = await supabase
        .from('financial_years')
        .update({
          is_current: false,
          closed_at: new Date().toISOString(),
        })
        .eq('id', currentFY.id);
      closeErr = fallbackClose.error;
    }

    if (closeErr) {
      return NextResponse.json({ success: false, error: `Failed to close current financial year: ${closeErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      closedYearName: currentFY.name,
      newYearName: newFY.name,
      surplusClosed: netSurplus,
      promotedStudentsCount,
      alumniStudentsCount,
      archivedStudentsCount,
      alumniBatchName,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

