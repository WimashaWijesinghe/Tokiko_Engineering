import { withDatabase } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  return withDatabase(true, async () => {
    try {
      const db = getDb();
      const body = await req.json();
      const upsert = db.prepare('INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)');
      for (const [k, v] of Object.entries(body)) {
        await upsert.run(k, String(v ?? ''));
      }
      return NextResponse.json({ ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
