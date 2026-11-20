import { withDatabase } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withDatabase(false, async () => {
    try {
      const db = getDb();

      const settingsRows = await db.prepare('SELECT `key`, value FROM settings').all() as Array<{ key: string; value: string }>;
      const settings: Record<string, string> = {};
      for (const r of settingsRows) settings[r.key] = r.value;

      const items = await db.prepare('SELECT * FROM items ORDER BY name ASC').all();
      const availableSerials = await db
        .prepare("SELECT * FROM item_serials WHERE status = 'IN_STOCK' ORDER BY id DESC")
        .all();
      const customers = await db.prepare('SELECT * FROM customers ORDER BY id DESC').all();
      const suppliers = await db.prepare('SELECT * FROM suppliers ORDER BY id DESC').all();

      const quotations = await db.prepare('SELECT * FROM quotations ORDER BY id DESC LIMIT 100').all() as Array<Record<string, unknown>>;
      const getQuoteItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?');
      for (const q of quotations) {
        const qItems = await getQuoteItems.all(Number(q.id)) as Array<Record<string, unknown>>;
        q.items = qItems.map((it) => ({
          ...it,
          serial_numbers: JSON.parse(String(it.serial_numbers || '[]')),
        }));
      }

      const invoices = await db.prepare('SELECT * FROM invoices ORDER BY id DESC LIMIT 100').all() as Array<Record<string, unknown>>;
      const getInvoiceItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');
      for (const inv of invoices) {
        const invItems = await getInvoiceItems.all(Number(inv.id)) as Array<Record<string, unknown>>;
        inv.items = invItems.map((it) => ({
          ...it,
          serial_numbers: JSON.parse(String(it.serial_numbers || '[]')),
        }));
      }

      const grns = await db.prepare('SELECT * FROM grns ORDER BY id DESC LIMIT 100').all() as Array<Record<string, unknown>>;
      const getGrnItems = db.prepare('SELECT * FROM grn_items WHERE grn_id = ?');
      for (const g of grns) {
        const gItems = await getGrnItems.all(Number(g.id)) as Array<Record<string, unknown>>;
        g.items = gItems.map((it) => ({
          ...it,
          serial_numbers: JSON.parse(String(it.serial_numbers || '[]')),
        }));
      }

      const todaySales = await db
        .prepare(`
          SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count
          FROM invoices
          WHERE date(created_at) = CURRENT_DATE()
        `)
        .get() as { total: number; count: number };

      const totalSales = await db
        .prepare(`
          SELECT COALESCE(SUM(grand_total), 0) as total, COALESCE(SUM(balance_due), 0) as total_due
          FROM invoices
        `)
        .get() as { total: number; total_due: number };

      const pendingQuotesCount = (
        await db.prepare("SELECT COUNT(*) as count FROM quotations WHERE status = 'PENDING'").get() as { count: number }
      ).count;

      const lowStockCount = (
        await db.prepare('SELECT COUNT(*) as count FROM items WHERE stock_qty <= 3').get() as { count: number }
      ).count;

      return NextResponse.json({
        settings,
        items,
        availableSerials,
        customers,
        suppliers,
        quotations,
        invoices,
        grns,
        stats: {
          todaySalesTotal: todaySales.total,
          todaySalesCount: todaySales.count,
          totalRevenue: totalSales.total,
          totalBalanceDue: totalSales.total_due,
          pendingQuotesCount,
          lowStockCount,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
