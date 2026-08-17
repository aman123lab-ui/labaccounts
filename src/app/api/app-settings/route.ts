import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/app-settings?key=show_demo_button
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      // Table may not exist yet — return default ON
      console.warn('app_settings fetch error (table may not exist):', error.message);
      return NextResponse.json({ key, value: 'true' });
    }

    // If no row yet, default is "true" (ON)
    return NextResponse.json({ key, value: data?.value ?? 'true' });
  } catch (err) {
    console.error('app-settings GET error:', err);
    return NextResponse.json({ key, value: 'true' });
  }
}

// PUT /api/app-settings  { key: string, value: string }
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body as { key: string; value: string };

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from('app_settings')
      .upsert({ key, value: String(value) }, { onConflict: 'key' });

    if (error) {
      console.error('app_settings upsert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, key, value });
  } catch (err) {
    console.error('app-settings PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
