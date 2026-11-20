import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.id,
      username: session.username,
      display_name: session.display_name,
      role: session.role,
    },
  });
}
