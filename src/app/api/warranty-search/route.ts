import { withDatabase } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withDatabase(false, async () => {
    try {
      const db = getDb();
      const q = (req.nextUrl.searchParams.get('q') || '').trim();

      let rows = [];
      if (!q) {
        rows = await db.prepare('SELECT * FROM item_serials ORDER BY id DESC LIMIT 100').all();
      } else {
        const like = `%${q}%`;
        rows = await db
          .prepare(`
            SELECT * FROM item_serials
            WHERE serial_number LIKE ? OR invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR item_name LIKE ?
            ORDER BY id DESC LIMIT 100
          `)
          .all(like, like, like, like, like);
      }

      return NextResponse.json({ results: rows });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
