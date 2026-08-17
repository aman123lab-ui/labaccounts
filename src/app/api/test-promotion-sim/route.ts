import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PROMOTION_MAPPING, normalizeBatchName } from '@/app/api/financial-year/rollover/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabase = createAdminClient();

  try {
    const { data: batches } = await supabase.from('batches').select('*');
    const { data: students } = await supabase.from('students').select('id, name, batch_id, status').eq('status', 'active');

    const batchObjMap = new Map<string, { id: string; name: string }>();
    (batches || []).forEach((b) => batchObjMap.set(b.id, b));

    const simulation = (students || []).map((student) => {
      const batch = batchObjMap.get(student.batch_id);
      const rawName = batch ? batch.name : '';
      const norm = normalizeBatchName(rawName);
      const targetNext = PROMOTION_MAPPING[norm] || (norm === 'BS5' ? 'Alumni (if balance > 0)' : 'NO_MATCH');

      return {
        studentName: student.name,
        currentBatchName: rawName,
        normalizedKey: norm,
        targetNextBatch: targetNext,
      };
    });

    // Check financial year surplus & balance sheet tally
    const { data: fyData } = await supabase.from('financial_years').select('*').eq('is_current', true).limit(1);
    const activeFy = fyData && fyData.length > 0 ? fyData[0] : null;

    return NextResponse.json({
      status: 'SUCCESS',
      activeFinancialYear: activeFy?.name || 'FY 2026-2027',
      promotionSimulationCount: simulation.length,
      simulation,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

