import { validateInput } from '@/lib/validation';
import { withDatabase, processSequential } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureCustomerInDb, ensureItemInDb, nextDocumentCode } from '@/lib/db';
import type { BillingLineItemInput } from '@/types/pos';

export async function POST(req: NextRequest) {
  return withDatabase(true, async () => {
    try {
      const db = getDb();
      const body = await req.json();
      const inputError = validateInput(body);
      if (inputError) return NextResponse.json({error: inputError}, {status: 400});
      const {
        id,
        subject = '',
        description = '',
        customer_name,
        customer_phone,
        customer_address,
        discount = 0,
        notes = '',
        items = [],
      }: {
        id?: number | null;
        subject?: string;
        description?: string;
        customer_name?: string;
        customer_phone?: string;
        customer_address?: string;
        discount?: number;
        notes?: string;
        items?: BillingLineItemInput[];
      } = body;

      if (!items.length) {
        return NextResponse.json(
          { error: 'Quotation එකට අවම වශයෙන් එක් Item එකක්වත් ඇතුළත් කරන්න.' },
          { status: 400 }
        );
      }

      const customerId = await ensureCustomerInDb(customer_name, customer_phone, customer_address);

      let subtotal = 0;
      let totalTax = 0;
      const processedItems = await processSequential(items, async (it) => {
        const qty = Math.max(1, Number(it.qty || 1));
        const unitPrice = Number(it.unit_price || 0);
        const itemDiscount = Number(it.item_discount || 0);
        const basePrice = Math.max(0, qty * unitPrice - itemDiscount);
        const vatRate = Number(it.vat_rate || 0);
        const vatAmount = vatRate > 0 ? (basePrice * vatRate) / 100 : 0;
        const lineTotal = basePrice + vatAmount;

        subtotal += basePrice;
        totalTax += vatAmount;

        const itemDesc = String(it.item_description || '').trim();

        const dbItem = await ensureItemInDb({
          name: it.item_name,
          description: itemDesc,
          selling_price: unitPrice,
          warranty_months: it.warranty_months,
          warranty_label: it.warranty_label,
          vat_rate: vatRate,
          stockDelta: 0,
        });

        const serials = Array.isArray(it.serial_numbers)
          ? it.serial_numbers.map((s) => String(s || '').trim()).filter(Boolean)
          : [];

        return {
          item_id: dbItem ? dbItem.id : null,
          item_name: dbItem ? dbItem.name : String(it.item_name).trim(),
          item_description: itemDesc,
          serial_numbers: JSON.stringify(serials),
          warranty_months: Number(it.warranty_months ?? 12),
          warranty_label: it.warranty_label || '1 Year',
          qty,
          unit_price: unitPrice,
          item_discount: itemDiscount,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          line_total: lineTotal,
        };
      });

      const billDiscount = Number(discount || 0);
      const grandTotal = Math.max(0, subtotal + totalTax - billDiscount);

      let quoteId = id ? Number(id) : null;
      let quoteNo = '';

      if (quoteId) {
        const existingQuote = await db.prepare('SELECT * FROM quotations WHERE id = ?').get(quoteId) as
          | { quote_no: string; status: string }
          | undefined;
        if (!existingQuote) {
          return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
        }
        if (existingQuote.status !== 'PENDING') return NextResponse.json({error: 'An invoiced quotation cannot be edited'}, {status: 409});
        quoteNo = existingQuote.quote_no;

        await db.prepare(`
          UPDATE quotations
          SET subject = ?, description = ?, customer_id = ?, customer_name = ?, customer_phone = ?, customer_address = ?,
              subtotal = ?, tax_amount = ?, discount = ?, grand_total = ?, notes = ?
          WHERE id = ?
        `).run(
          String(subject || '').trim(),
          String(description || '').trim(),
          customerId,
          customer_name || 'Walk-in Customer',
          customer_phone || '',
          customer_address || '',
          subtotal,
          totalTax,
          billDiscount,
          grandTotal,
          notes,
          quoteId
        );

        await db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(quoteId);
      } else {
        quoteNo = await nextDocumentCode('QTN', 'quotations');
        const info = await db
          .prepare(`
            INSERT INTO quotations (quote_no, subject, description, customer_id, customer_name, customer_phone, customer_address, subtotal, tax_amount, discount, grand_total, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
          `)
          .run(
            quoteNo,
            String(subject || '').trim(),
            String(description || '').trim(),
            customerId,
            customer_name || 'Walk-in Customer',
            customer_phone || '',
            customer_address || '',
            subtotal,
            totalTax,
            billDiscount,
            grandTotal,
            notes
          );
        quoteId = Number(info.insertId);
      }

      const insertQItem = db.prepare(`
        INSERT INTO quotation_items (quotation_id, item_id, item_name, item_description, serial_numbers, warranty_months, warranty_label, qty, unit_price, item_discount, vat_rate, vat_amount, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const pit of processedItems) {
        await insertQItem.run(
          quoteId,
          pit.item_id,
          pit.item_name,
          pit.item_description,
          pit.serial_numbers,
          pit.warranty_months,
          pit.warranty_label,
          pit.qty,
          pit.unit_price,
          pit.item_discount,
          pit.vat_rate,
          pit.vat_amount,
          pit.line_total
        );
      }

      return NextResponse.json({ ok: true, id: quoteId, quote_no: quoteNo });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
