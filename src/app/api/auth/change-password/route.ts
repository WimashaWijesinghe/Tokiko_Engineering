import { NextRequest, NextResponse } from 'next/server';
import { withDatabase, getDb } from '@/lib/db';
import { ensureUsersTable, hashPassword, verifyPassword } from '@/lib/auth';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureUsersTable();

  return withDatabase(true, async () => {
    try {
      const body = await req.json();
      const currentPassword = String(body?.current_password || '');
      const newPassword = String(body?.new_password || '');
      const newUsername = String(body?.username || '').trim();

      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { error: 'Current password සහ New password ඇතුළත් කරන්න.' },
          { status: 400 }
        );
      }

      if (newPassword.length < 4) {
        return NextResponse.json(
          { error: 'New password අවම වශයෙන් අකුරු 4ක් විය යුතුය.' },
          { status: 400 }
        );
      }

      const db = getDb();
      const user = (await db
        .prepare('SELECT id, username, password_hash FROM users WHERE id = ?')
        .get(session.id)) as
        | { id: number; username: string; password_hash: string }
        | undefined;

      if (!user || !verifyPassword(currentPassword, user.password_hash)) {
        return NextResponse.json(
          { error: 'දැනට පවතින Password එක වැරදියි.' },
          { status: 400 }
        );
      }

      const nextHash = hashPassword(newPassword);
      if (newUsername && newUsername !== user.username) {
        await db
          .prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?')
          .run(newUsername, nextHash, user.id);
      } else {
        await db
          .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
          .run(nextHash, user.id);
      }

      return NextResponse.json({ ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update password';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
