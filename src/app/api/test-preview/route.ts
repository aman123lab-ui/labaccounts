import { NextResponse } from 'next/server';
import { previewRolloverFinancialYear } from '@/services/financialYearService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await previewRolloverFinancialYear();
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
