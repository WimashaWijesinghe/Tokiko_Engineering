import { withDatabase, getDb, ensureGrnPaymentColumns } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  await ensureGrnPaymentColumns();
  return withDatabase(true, async () => {
    try {
      const db = getDb();
      const { grn_id, amount } = await req.json();

      if (
        !Number.isSafeInteger(Number(grn_id)) ||
        Number(grn_id) <= 0 ||
        !Number.isFinite(Number(amount)) ||
        Number(amount) <= 0
      ) {
        return NextResponse.json(
          { error: 'Valid GRN and positive payment amount required' },
          { status: 400 }
        );
      }

      const grn = (await db.prepare('SELECT id, total_amount, paid_amount FROM grns WHERE id = ?').get(Number(grn_id))) as
        | { id: number; total_amount: number; paid_amount: number }
        | undefined;

      if (!grn) {
        return NextResponse.json({ error: 'GRN not found' }, { status: 404 });
      }

      const remaining = Math.max(0, Number(grn.total_amount || 0) - Number(grn.paid_amount || 0));
      if (Number(amount) > remaining + 0.000001) {
        return NextResponse.json({ error: 'Payment exceeds outstanding supplier balance' }, { status: 400 });
      }

      const newPaid = Math.min(Number(grn.total_amount || 0), Number(grn.paid_amount || 0) + Number(amount));

      await db.prepare('UPDATE grns SET paid_amount = ? WHERE id = ?').run(newPaid, Number(grn_id));

      return NextResponse.json({ ok: true, paid_amount: newPaid });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
