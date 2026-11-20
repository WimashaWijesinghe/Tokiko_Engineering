import { validateInput } from '@/lib/validation';
import { withDatabase, processSequential, getDb, ensureSupplierInDb, ensureItemInDb, nextDocumentCode, ensureGrnPaymentColumns, generateUniqueDbSerial } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import type { GRNLineItemInput } from '@/types/pos';

export async function POST(req: NextRequest) {
  await ensureGrnPaymentColumns();
  return withDatabase(true, async () => {
    try {
      const db = getDb();
      const body = await req.json();
      const inputError = validateInput(body);
      if (inputError) return NextResponse.json({error: inputError}, {status: 400});
      const {
        supplier_name,
        supplier_phone,
        ref_no = '',
        paid_amount,
        payment_method = 'Cash',
        cheque_no = '',
        cheque_bank = '',
        cheque_date = '',
        cheque_reminder_date = '',
        payment_ref = '',
        notes = '',
        items = [],
      }: {
        supplier_name?: string;
        supplier_phone?: string;
        ref_no?: string;
        paid_amount?: number | string;
        payment_method?: string;
        cheque_no?: string;
        cheque_bank?: string;
        cheque_date?: string;
        cheque_reminder_date?: string;
        payment_ref?: string;
        notes?: string;
        items?: GRNLineItemInput[];
      } = body;

      if (!items.length) {
        return NextResponse.json(
          { error: 'GRN එකට අවම වශයෙන් එක් Item එකක්වත් ඇතුළත් කරන්න.' },
          { status: 400 }
        );
      }

      const supplierId = await ensureSupplierInDb(supplier_name, supplier_phone);
      const grnNo = await nextDocumentCode('GRN', 'grns');

      let totalAmount = 0;
      const usedSerialsInBatch = new Set<string>();
      const processedItems = await processSequential(items, async (it) => {
        const qty = Math.max(1, Number(it.qty || 1));
        const buyingPrice = Number(it.buying_price || 0);
        const sellingPrice = Number(it.selling_price || 0);
        const lineTotal = qty * buyingPrice;
        totalAmount += lineTotal;

        const dbItem = await ensureItemInDb({
          name: it.item_name,
          buying_price: buyingPrice,
          selling_price: sellingPrice,
          warranty_months: it.warranty_months,
          warranty_label: it.warranty_label,
          stockDelta: qty,
        });

        const serials = Array.isArray(it.serial_numbers)
          ? it.serial_numbers.map((s) => String(s || '').trim()).filter(Boolean)
          : [];
        serials.forEach((s) => usedSerialsInBatch.add(s));
        while (serials.length < qty) {
          serials.push(await generateUniqueDbSerial(it.item_name, usedSerialsInBatch));
        }

        return {
          item_id: dbItem ? dbItem.id : null,
          item_name: dbItem ? dbItem.name : String(it.item_name).trim(),
          serial_numbers_arr: serials,
          serial_numbers: JSON.stringify(serials),
          warranty_months: Number(it.warranty_months ?? 12),
          warranty_label: it.warranty_label || '1 Year',
          qty,
          buying_price: buyingPrice,
          selling_price: sellingPrice,
          line_total: lineTotal,
        };
      });

      const actualPaid =
        paid_amount !== undefined && paid_amount !== '' ? Number(paid_amount) : totalAmount;

      const info = await db
        .prepare(`
          INSERT INTO grns (
            grn_no, supplier_id, supplier_name, supplier_phone, ref_no,
            total_amount, paid_amount, payment_method, cheque_no, cheque_bank,
            cheque_date, cheque_reminder_date, payment_ref, notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          grnNo,
          supplierId,
          supplier_name || 'General Supplier',
          supplier_phone || '',
          ref_no,
          totalAmount,
          actualPaid,
          payment_method || 'Cash',
          cheque_no || '',
          cheque_bank || '',
          cheque_date || '',
          cheque_reminder_date || '',
          payment_ref || '',
          notes
        );

      const grnId = Number(info.insertId);

      const insertGrnItem = await db.prepare(`
        INSERT INTO grn_items (
          grn_id, item_id, item_name, serial_numbers, warranty_months, warranty_label,
          qty, buying_price, selling_price, line_total
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const pit of processedItems) {
        await insertGrnItem.run(
          grnId,
          pit.item_id,
          pit.item_name,
          pit.serial_numbers,
          pit.warranty_months,
          pit.warranty_label,
          pit.qty,
          pit.buying_price,
          pit.selling_price,
          pit.line_total
        );

        for (const sn of pit.serial_numbers_arr) {
          const existingSn = await db
            .prepare('SELECT id FROM item_serials WHERE serial_number = ?')
            .get(sn);
          if (existingSn) throw new Error('Serial already exists: ' + sn);
          if (!existingSn) {
            await db.prepare(`
              INSERT INTO item_serials (
                item_id, item_name, serial_number, status, grn_id, grn_no, warranty_months, warranty_label
              )
              VALUES (?, ?, ?, 'IN_STOCK', ?, ?, ?, ?)
            `).run(
              pit.item_id,
              pit.item_name,
              sn,
              grnId,
              grnNo,
              pit.warranty_months,
              pit.warranty_label
            );
          }
        }
      }

      return NextResponse.json({ ok: true, id: grnId, grn_no: grnNo });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
