import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Database cleanup endpoint is disabled for safety.' }, { status: 403 });
}

export async function POST() {
  return NextResponse.json({ error: 'Database cleanup endpoint is disabled for safety.' }, { status: 403 });
}
