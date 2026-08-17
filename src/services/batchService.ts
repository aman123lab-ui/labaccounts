import { createClient } from '@/lib/supabase/client';
import { Batch } from '@/types/database.types';
import {
  isGuestMode,
  getDemoBatches,
  getDemoStudents,
  createDemoBatch,
  updateDemoBatch,
  deleteDemoBatch,
} from '@/lib/demo/demoStore';

export interface BatchWithCount extends Batch {
  activeStudentCount: number;
  totalStudentCount: number;
}

/**
 * Calculates sorting rank and year for a batch.
 * Academic Categories: JD (group 1) -> HS (group 2) -> BS (group 3) -> General (group 4).
 * Alumni Categories: Group 99, sorted by graduating year descending (newest first).
 */
export function getBatchRank(name: string, category?: string): { group: number; year: number } {
  const norm = (name || '').replace(/[\s-]/g, '').toUpperCase();
  const catNorm = (category || '').toUpperCase().trim();

  if (norm.startsWith('ALUMNI') || catNorm.includes('ALUMNI')) {
    const yearMatch = norm.match(/\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : 0;
    return { group: 99, year };
  }

  if (norm.startsWith('JD') || catNorm === 'JD') return { group: 1, year: 0 };
  if (norm.startsWith('HS') || catNorm === 'HS') return { group: 2, year: 0 };
  if (norm.startsWith('BS') || catNorm === 'BS') return { group: 3, year: 0 };
  return { group: 4, year: 0 };
}

/**
 * Sorts batches according to specification:
 * 1. JD batches (JD 1, JD 2, JD 3...)
 * 2. HS batches (HS 1, HS 2...)
 * 3. BS batches (BS 1 through BS 5...)
 * 4. General / Others
 * 5. Year-specific Alumni batches (Alumni 2027, Alumni 2026...) newest year first, then generic Alumni
 */
export function sortBatches<T extends { name: string; category?: string }>(batches: T[]): T[] {
  return [...batches].sort((a, b) => {
    const rankA = getBatchRank(a.name, a.category);
    const rankB = getBatchRank(b.name, b.category);

    if (rankA.group !== rankB.group) {
      return rankA.group - rankB.group;
    }

    if (rankA.group === 99) {
      // Alumni group: sort by graduating year descending (newest year first)
      if (rankA.year !== rankB.year) {
        return rankB.year - rankA.year;
      }
      return (a.name || '').localeCompare(b.name || '');
    }

    // Natural sort inside academic group (e.g., JD 1 vs JD 2 vs JD 10)
    return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Fetches all batches from database sorted by specification.
 */
export async function getBatches(): Promise<Batch[]> {
  if (isGuestMode()) {
    const list = getDemoBatches();
    list.forEach((b) => {
      if (b.name.toUpperCase().includes('ALUMNI')) {
        b.category = 'General';
      }
    });
    return sortBatches(list);
  }

  const supabase = createClient();
  const { data, error } = await supabase.from('batches').select('*');

  if (error) {
    console.error('Error fetching batches:', error);
    return [];
  }

  const list = ((data || []) as Batch[]).map((b) => {
    if (b.name.toUpperCase().includes('ALUMNI') && b.category !== 'General') {
      b.category = 'General';
    }
    return b;
  });

  return sortBatches(list);
}

/**
 * Fetches all batches with active & total student counts per batch.
 */
export async function getBatchesWithStudentCounts(): Promise<BatchWithCount[]> {
  if (isGuestMode()) {
    const batches = getDemoBatches();
    const students = getDemoStudents({ status: 'active' });
    const allStudents = [...students];
    const countsMap = new Map<string, { active: number; total: number }>();
    allStudents.forEach((s) => {
      if (!s.batch_id) return;
      const current = countsMap.get(s.batch_id) || { active: 0, total: 0 };
      current.total += 1;
      if (s.status === 'active') {
        current.active += 1;
      }
      countsMap.set(s.batch_id, current);
    });

    const batchesWithCounts: BatchWithCount[] = batches.map((b) => {
      if (b.name.toUpperCase().includes('ALUMNI')) {
        b.category = 'General';
      }
      const c = countsMap.get(b.id) || { active: 0, total: 0 };
      return {
        ...b,
        activeStudentCount: c.active,
        totalStudentCount: c.total,
      };
    });

    return sortBatches(batchesWithCounts);
  }

  const supabase = createClient();

  const [batchesRes, studentsRes] = await Promise.all([
    supabase.from('batches').select('*'),
    supabase.from('students').select('id, batch_id, status'),
  ]);

  if (batchesRes.error) {
    console.error('Error fetching batches:', batchesRes.error);
    return [];
  }

  const batches = (batchesRes.data || []) as Batch[];
  const students = (studentsRes.data || []) as any[];

  const countsMap = new Map<string, { active: number; total: number }>();
  students.forEach((s) => {
    if (!s.batch_id) return;
    const current = countsMap.get(s.batch_id) || { active: 0, total: 0 };
    current.total += 1;
    if (s.status === 'active') {
      current.active += 1;
    }
    countsMap.set(s.batch_id, current);
  });

  const batchesWithCounts: BatchWithCount[] = batches.map((b) => {
    if (b.name.toUpperCase().includes('ALUMNI') && b.category !== 'General') {
      b.category = 'General';
    }
    const c = countsMap.get(b.id) || { active: 0, total: 0 };
    return {
      ...b,
      activeStudentCount: c.active,
      totalStudentCount: c.total,
    };
  });

  return sortBatches(batchesWithCounts);
}

/**
 * Infer category from batch name prefix if not provided.
 */
export function inferCategory(name: string): string {
  const upper = name.trim().toUpperCase();
  if (upper.includes('ALUMNI')) return 'General';
  if (upper.startsWith('JD')) return 'JD';
  if (upper.startsWith('HS')) return 'HS';
  if (upper.startsWith('BS')) return 'BS';
  return 'General';
}

/**
 * Creates a new batch. Checks for duplicate batch names.
 */
export async function createBatch(name: string, category?: string): Promise<{ success: boolean; data?: Batch; error?: string }> {
  if (isGuestMode()) {
    const b = createDemoBatch(name, category);
    return { success: true, data: b };
  }

  const supabase = createClient();
  const cleanName = name.trim();
  if (!cleanName) {
    return { success: false, error: 'Batch name is required.' };
  }

  const finalCategory = (category && category.trim()) ? category.trim() : inferCategory(cleanName);

  // Check duplicate (case-insensitive)
  const { data: existing } = await supabase
    .from('batches')
    .select('id, name')
    .ilike('name', cleanName);

  if (existing && existing.length > 0) {
    return { success: false, error: `A batch named "${cleanName}" already exists.` };
  }

  const { data, error } = await (supabase
    .from('batches' as any) as any)
    .insert({
      name: cleanName,
      category: finalCategory,
      sort_order: cleanName.toUpperCase().includes('ALUMNI') ? 99 : 0,
    })
    .select();

  if (error || !data || data.length === 0) {
    try {
      const apiRes = await fetch('/api/batch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, category: finalCategory }),
      });
      const resData = await apiRes.json();
      if (resData.success && resData.data) {
        return { success: true, data: resData.data as Batch };
      }
    } catch (apiErr) {
      console.warn('API route batch creation fallback error:', apiErr);
    }
    return { success: false, error: error?.message || 'Failed to create batch in database.' };
  }

  return { success: true, data: data[0] as Batch };
}

/**
 * Updates an existing batch's name and/or category.
 */
export async function updateBatch(
  id: string,
  name: string,
  category: string
): Promise<{ success: boolean; data?: Batch; error?: string }> {
  if (isGuestMode()) {
    const res = updateDemoBatch(id, { name, category });
    return { success: res.success, error: res.error };
  }

  const supabase = createClient();
  const cleanName = name.trim();
  const cleanCategory = category.trim() || inferCategory(cleanName);

  if (!cleanName) {
    return { success: false, error: 'Batch name is required.' };
  }

  // Check duplicate (excluding current id)
  const { data: existing } = await supabase
    .from('batches')
    .select('id, name')
    .ilike('name', cleanName)
    .neq('id', id);

  if (existing && existing.length > 0) {
    return { success: false, error: `Another batch named "${cleanName}" already exists.` };
  }

  const { data, error } = await (supabase
    .from('batches' as any) as any)
    .update({
      name: cleanName,
      category: cleanCategory,
    })
    .eq('id', id)
    .select();

  if (error || !data || data.length === 0) {
    try {
      const apiRes = await fetch('/api/batch/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: cleanName, category: cleanCategory }),
      });
      const resData = await apiRes.json();
      if (resData.success && resData.data) {
        return { success: true, data: resData.data as Batch };
      }
    } catch (apiErr) {
      console.warn('API route batch update fallback error:', apiErr);
    }
    return { success: false, error: error?.message || 'Failed to update batch in database.' };
  }

  return { success: true, data: data[0] as Batch };
}

/**
 * Deletes a batch ONLY if zero active students are assigned.
 */
export async function deleteBatch(id: string): Promise<{ success: boolean; error?: string }> {
  if (isGuestMode()) {
    return deleteDemoBatch(id);
  }

  const supabase = createClient();

  // Check student count
  const { data: students, error: countErr } = await supabase
    .from('students')
    .select('id, status')
    .eq('batch_id', id);

  if (countErr) {
    return { success: false, error: countErr.message };
  }

  const activeCount = ((students || []) as any[]).filter((s) => s.status === 'active').length;
  const totalCount = (students || []).length;

  if (activeCount > 0) {
    return {
      success: false,
      error: `Cannot delete batch — ${activeCount} active student${activeCount > 1 ? 's are' : ' is'} currently assigned to it.`,
    };
  }

  if (totalCount > 0) {
    return {
      success: false,
      error: `Cannot delete batch — ${totalCount} student record${totalCount > 1 ? 's (including archived) are' : ' is'} linked to this batch.`,
    };
  }

  const { error: deleteErr } = await supabase.from('batches').delete().eq('id', id);

  if (deleteErr) {
    try {
      const apiRes = await fetch('/api/batch/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({ id }),
      });
      const resData = await apiRes.json();
      if (resData.success) {
        return { success: true };
      }
      return { success: false, error: resData.error || deleteErr.message };
    } catch (apiErr) {
      console.warn('API route batch delete fallback error:', apiErr);
    }
    return { success: false, error: deleteErr.message };
  }

  return { success: true };
}
