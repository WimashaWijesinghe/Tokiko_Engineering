import { validateInput } from '@/lib/validation';
import { withDatabase } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureItemInDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  return withDatabase(true, async () => {
    try {
      const db = getDb();
      const body = await req.json();
      const inputError = validateInput(body);
      if (inputError) return NextResponse.json({error: inputError}, {status: 400});
      const {
        id,
        name,
        description = '',
        buying_price,
        selling_price,
        warranty_months,
        warranty_label,
        vat_rate,
        stock_qty,
      } = body;

      if (!name || !String(name).trim()) {
        return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
      }

      if (id) {
        await db.prepare(`
          UPDATE items
          SET name = ?, description = ?, buying_price = ?, selling_price = ?, warranty_months = ?, warranty_label = ?, vat_rate = ?, stock_qty = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          String(name).trim(),
          String(description || '').trim(),
          Number(buying_price || 0),
          Number(selling_price || 0),
          Number(warranty_months ?? 12),
          warranty_label || '1 Year',
          Number(vat_rate || 0),
          Number(stock_qty || 0),
          Number(id)
        );
      } else {
        await ensureItemInDb({
          name,
          description: String(description || '').trim(),
          buying_price: Number(buying_price || 0),
          selling_price: Number(selling_price || 0),
          warranty_months: Number(warranty_months ?? 12),
          warranty_label: warranty_label || '1 Year',
          vat_rate: Number(vat_rate || 0),
          stockDelta: Number(stock_qty || 0),
        });
      }

      return NextResponse.json({ ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
