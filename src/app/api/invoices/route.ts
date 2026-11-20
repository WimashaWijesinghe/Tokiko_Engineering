import { validateInput } from '@/lib/validation';
import { withDatabase, processSequential } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  ensureCustomerInDb,
  ensureItemInDb,
  nextDocumentCode,
  computeWarrantyExpiry,
  generateUniqueDbSerial,
  ensureInvoiceVehicleColumn,
} from '@/lib/db';
import type { BillingLineItemInput } from '@/types/pos';

export async function POST(req: NextRequest) {
  await ensureInvoiceVehicleColumn();
  return withDatabase(true, async () => {
    try {
      const db = getDb();
      const body = await req.json();
      const inputError = validateInput(body);
      if (inputError) return NextResponse.json({error: inputError}, {status: 400});
      const {
        quotation_id = null,
        quotation_ids = [],
        subject = '',
        description = '',
        customer_name,
        customer_phone,
        customer_address,
        discount = 0,
        paid_amount,
        payment_method = 'Cash',
        cheque_no = '',
        cheque_bank = '',
        cheque_date = '',
        credit_days = '',
        payment_ref = '',
        vehicle_no = '',
        notes = '',
        items = [],
      }: {
        quotation_id?: number | null;
        quotation_ids?: number[];
        subject?: string;
        description?: string;
        customer_name?: string;
        customer_phone?: string;
        customer_address?: string;
        discount?: number;
        paid_amount?: number | string;
        payment_method?: string;
        cheque_no?: string;
        cheque_bank?: string;
        cheque_date?: string;
        credit_days?: number | string;
        payment_ref?: string;
        vehicle_no?: string;
        notes?: string;
        items?: BillingLineItemInput[];
      } = body;

      if (!items.length) {
        return NextResponse.json(
          { error: 'Invoice එකට අවම වශයෙන් එක් Item එකක්වත් ඇතුළත් කරන්න.' },
          { status: 400 }
        );
      }

      const selectedQuoteIds = Array.isArray(quotation_ids) && quotation_ids.length ? quotation_ids.map(Number) : (quotation_id ? [Number(quotation_id)] : []);
      for (const id of selectedQuoteIds) {
        const quote = await db.prepare('SELECT status FROM quotations WHERE id = ?').get(id);
        if (!quote || quote.status !== 'PENDING') return NextResponse.json({error: 'Quotation is missing or already invoiced'}, {status: 409});
      }

      const customerId = await ensureCustomerInDb(customer_name, customer_phone, customer_address);

      let quoteNo = String(body.quote_no || '').trim();
      if (!quoteNo) {
        if (quotation_ids && Array.isArray(quotation_ids) && quotation_ids.length > 0) {
          const placeholders = quotation_ids.map(() => '?').join(',');
          const qRows = await db
            .prepare(`SELECT quote_no FROM quotations WHERE id IN (${placeholders})`)
            .all(...quotation_ids.map(Number)) as Array<{ quote_no: string }>;
          quoteNo = qRows.map((r) => r.quote_no).join(', ');
        } else if (quotation_id) {
          const q = await db.prepare('SELECT quote_no FROM quotations WHERE id = ?').get(Number(quotation_id)) as
            | { quote_no: string }
            | undefined;
          if (q) quoteNo = q.quote_no;
        }
      }

      const invoiceNo = await nextDocumentCode('INV', 'invoices');
      let subtotal = 0;
      let totalTax = 0;
      const usedSerialsInBatch = new Set<string>();

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
        const existingItem = await db
          .prepare('SELECT id, stock_qty FROM items WHERE name = ?')
          .get(String(it.item_name || '').trim()) as { id: number; stock_qty: number } | undefined;
        const isNewOrOutOfStock = !existingItem || Number(existingItem.stock_qty || 0) <= 0;

        // Auto-save item to DB and deduct sold qty from stock
        const dbItem = await ensureItemInDb({
          name: it.item_name,
          description: itemDesc,
          selling_price: unitPrice,
          warranty_months: it.warranty_months,
          warranty_label: it.warranty_label,
          vat_rate: vatRate,
          stockDelta: -qty,
        });

        const serials = Array.isArray(it.serial_numbers)
          ? it.serial_numbers.map((s) => String(s || '').trim()).filter(Boolean)
          : [];
        serials.forEach((s) => usedSerialsInBatch.add(s));
        if (isNewOrOutOfStock) {
          while (serials.length < qty) {
            serials.push(await generateUniqueDbSerial(it.item_name, usedSerialsInBatch));
          }
        }

        return {
          item_id: dbItem ? dbItem.id : null,
          item_name: dbItem ? dbItem.name : String(it.item_name).trim(),
          item_description: itemDesc,
          buying_price: dbItem ? dbItem.buying_price : 0,
          serial_numbers_arr: serials,
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
      const actualPaid =
        paid_amount !== undefined && paid_amount !== '' ? Number(paid_amount) : grandTotal;
      const balanceDue = Math.max(0, grandTotal - actualPaid);
      const paymentStatus =
        balanceDue <= 0 ? 'PAID' : actualPaid > 0 ? 'PARTIAL' : 'UNPAID';

      const chequeDetails = [cheque_no ? `CHQ #${cheque_no}` : '', cheque_bank, cheque_date]
        .filter(Boolean)
        .join(' | ');
      const creditDaysNum = String(credit_days ?? '').trim();
      const creditRefParts = [
        creditDaysNum ? `${creditDaysNum} Days` : '',
        cheque_date ? `Due: ${cheque_date}` : '',
      ].filter(Boolean);
      const computedPayRef =
        String(payment_ref || '').trim() ||
        (payment_method === 'Cheque'
          ? `CHEQUE- ${grandTotal.toFixed(2)}${chequeDetails ? ` (${chequeDetails})` : ''}`
          : payment_method === 'Credit' && creditRefParts.length > 0
          ? `Credit: ${creditRefParts.join(' | ')}`
          : '');

      const info = await db
        .prepare(`
          INSERT INTO invoices (
            invoice_no, quotation_id, quote_no, subject, description, customer_id, customer_name, customer_phone, customer_address,
            subtotal, tax_amount, discount, grand_total, paid_amount, balance_due, payment_method, cheque_no, cheque_bank, cheque_date, payment_ref, vehicle_no, payment_status, notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          invoiceNo,
          quotation_id ? Number(quotation_id) : null,
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
          actualPaid,
          balanceDue,
          payment_method,
          String(cheque_no || '').trim(),
          String(cheque_bank || '').trim(),
          String(cheque_date || '').trim(),
          computedPayRef,
          String(vehicle_no || '').trim(),
          paymentStatus,
          notes
        );

      const invoiceId = Number(info.insertId);

      const insertInvItem = await db.prepare(`
        INSERT INTO invoice_items (
          invoice_id, item_id, item_name, item_description, serial_numbers, warranty_months, warranty_label,
          qty, buying_price, unit_price, item_discount, vat_rate, vat_amount, line_total
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const soldDate = new Date().toISOString().split('T')[0];

      for (const pit of processedItems) {
        await insertInvItem.run(
          invoiceId,
          pit.item_id,
          pit.item_name,
          pit.item_description,
          pit.serial_numbers,
          pit.warranty_months,
          pit.warranty_label,
          pit.qty,
          pit.buying_price,
          pit.unit_price,
          pit.item_discount,
          pit.vat_rate,
          pit.vat_amount,
          pit.line_total
        );

        const expiryDate = computeWarrantyExpiry(pit.warranty_months);
        for (const sn of pit.serial_numbers_arr) {
          const existingSn = await db
            .prepare('SELECT id, item_id, status FROM item_serials WHERE serial_number = ?')
            .get(sn) as { id: number; item_id: number; status: string } | undefined;

          if (existingSn && (existingSn.status !== 'IN_STOCK' || Number(existingSn.item_id) !== Number(pit.item_id))) throw new Error('Serial is already sold or belongs to a different item: ' + sn);
          if (existingSn) {
            await db.prepare(`
              UPDATE item_serials
              SET status = 'SOLD', invoice_id = ?, invoice_no = ?, warranty_months = ?, warranty_label = ?,
                  sold_date = ?, warranty_expiry = ?, customer_name = ?, customer_phone = ?
              WHERE id = ?
            `).run(
              invoiceId,
              invoiceNo,
              pit.warranty_months,
              pit.warranty_label,
              soldDate,
              expiryDate,
              customer_name || 'Walk-in Customer',
              customer_phone || '',
              existingSn.id
            );
          } else {
            await db.prepare(`
              INSERT INTO item_serials (
                item_id, item_name, serial_number, status, invoice_id, invoice_no,
                warranty_months, warranty_label, sold_date, warranty_expiry, customer_name, customer_phone
              )
              VALUES (?, ?, ?, 'SOLD', ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              pit.item_id,
              pit.item_name,
              sn,
              invoiceId,
              invoiceNo,
              pit.warranty_months,
              pit.warranty_label,
              soldDate,
              expiryDate,
              customer_name || 'Walk-in Customer',
              customer_phone || ''
            );
          }
        }
      }

      const allQuoteIds: number[] = Array.isArray(quotation_ids) && quotation_ids.length > 0
        ? quotation_ids.map(Number)
        : (quotation_id ? [Number(quotation_id)] : []);

      if (allQuoteIds.length > 0) {
        const updateQuoteStmt = db.prepare(`
          UPDATE quotations
          SET status = 'INVOICED', converted_invoice_id = ?, converted_invoice_no = ?
          WHERE id = ?
        `);
        for (const qId of allQuoteIds) {
          if (qId) {
            await updateQuoteStmt.run(invoiceId, invoiceNo, qId);
          }
        }
      }

      return NextResponse.json({ ok: true, id: invoiceId, invoice_no: invoiceNo });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
