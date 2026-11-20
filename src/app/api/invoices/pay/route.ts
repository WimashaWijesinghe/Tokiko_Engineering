import { withDatabase } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  return withDatabase(true, async () => {
    try {
      const db = getDb();
      const { invoice_id, amount } = await req.json();

      if (!Number.isSafeInteger(Number(invoice_id)) || Number(invoice_id) <= 0 || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return NextResponse.json({error: 'Valid invoice and positive payment amount required'}, {status: 400});

      const inv = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(Number(invoice_id)) as
        | { paid_amount: number; grand_total: number }
        | undefined;

      if (!inv) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      if (Number(amount) > Math.max(0, Number(inv.grand_total) - Number(inv.paid_amount)) + 0.000001) return NextResponse.json({error: 'Payment exceeds outstanding balance'}, {status: 400});
      const newPaid = Number(inv.paid_amount || 0) + Number(amount || 0);
      const newBalance = Math.max(0, Number(inv.grand_total) - newPaid);
      const newStatus = newBalance <= 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID';

      await db.prepare('UPDATE invoices SET paid_amount = ?, balance_due = ?, payment_status = ? WHERE id = ?').run(
        newPaid,
        newBalance,
        newStatus,
        Number(invoice_id)
      );

      return NextResponse.json({ ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
