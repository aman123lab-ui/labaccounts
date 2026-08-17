import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Database inspection endpoint is disabled for safety.' }, { status: 403 });
}
