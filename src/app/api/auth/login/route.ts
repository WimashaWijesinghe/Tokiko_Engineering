import { NextRequest, NextResponse } from 'next/server';
import { withDatabase, getDb } from '@/lib/db';
import { ensureUsersTable, verifyPassword } from '@/lib/auth';
import { SESSION_COOKIE_NAME, signSessionToken } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    await ensureUsersTable();
  } catch (err) {
    console.error('Failed to ensure users table:', err);
    return NextResponse.json(
      { error: 'Database connection failed. Please check MySQL in XAMPP.' },
      { status: 500 }
    );
  }

  return withDatabase(false, async () => {
    try {
      const body = await req.json();
      const username = String(body?.username || '').trim();
      const password = String(body?.password || '');
      const remember = Boolean(body?.remember);

      if (!username || !password) {
        return NextResponse.json(
          { error: 'Username සහ Password ඇතුළත් කරන්න.' },
          { status: 400 }
        );
      }

      const db = getDb();
      const user = (await db
        .prepare('SELECT id, username, display_name, role, password_hash, is_active FROM users WHERE username = ?')
        .get(username)) as
        | {
            id: number;
            username: string;
            display_name: string;
            role: string;
            password_hash: string;
            is_active: number;
          }
        | undefined;

      if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
        return NextResponse.json(
          { error: 'Username හෝ Password වැරදියි.' },
          { status: 401 }
        );
      }

      const ttlSeconds = remember ? 60 * 60 * 24 * 7 : 60 * 60 * 12;
      const token = await signSessionToken(
        {
          id: Number(user.id),
          username: user.username,
          display_name: user.display_name || user.username,
          role: user.role || 'ADMIN',
        },
        ttlSeconds
      );

      const res = NextResponse.json({
        ok: true,
        user: {
          id: Number(user.id),
          username: user.username,
          display_name: user.display_name || user.username,
          role: user.role || 'ADMIN',
        },
      });

      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
        path: '/',
        maxAge: ttlSeconds,
      });

      return res;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
