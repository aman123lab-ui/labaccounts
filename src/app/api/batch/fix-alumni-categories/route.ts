import { NextResponse } from 'next';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  return fixAlumniCategories();
}

export async function POST() {
  return fixAlumniCategories();
}

async function fixAlumniCategories() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rpbgtykecsoigvxjjbsm.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createAdminClient(url, key);

    // 1. Fetch all batches from Supabase
    const { data: batches, error } = await supabase.from('batches').select('*');
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const mislabeledBatches: Array<{ id: string; name: string; oldCategory: string; newCategory: string }> = [];

    if (batches) {
      for (const b of batches) {
        const isAlumni = b.name.toUpperCase().includes('ALUMNI');
        if (isAlumni && b.category !== 'General') {
          mislabeledBatches.push({
            id: b.id,
            name: b.name,
            oldCategory: b.category,
            newCategory: 'General',
          });

          // Update batch in Supabase
          await supabase
            .from('batches')
            .update({ category: 'General' })
            .eq('id', b.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      foundAndFixedCount: mislabeledBatches.length,
      fixedBatches: mislabeledBatches,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
