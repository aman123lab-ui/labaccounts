import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { studentId } = await request.json();

    if (!studentId) {
      return NextResponse.json({ success: false, error: 'Student ID is required.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    return NextResponse.json({ success: true, seenAt: nowIso });
  } catch (err: any) {
    console.error('API error in /api/payment-claims/mark-seen:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
