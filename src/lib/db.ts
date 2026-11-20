import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Item } from '@/types/pos';

type SqlValue = string | number | boolean | null;

const context = new AsyncLocalStorage<PoolConnection>();
const globals = globalThis as unknown as { posMysqlPool?: Pool; grnColsEnsured?: boolean; invoiceVehicleColEnsured?: boolean };
function pool(): Pool {
  if (!globals.posMysqlPool) {
    if (!process.env.DB_NAME || !process.env.DB_USER) throw new Error('Configure DB_NAME and DB_USER in .env.local before starting the POS.');
    globals.posMysqlPool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER, password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME,
      charset: 'utf8mb4', waitForConnections: true, connectionLimit: 10,
      decimalNumbers: true, dateStrings: true, multipleStatements: false,
    });
  }
  return globals.posMysqlPool;
}

// Every request uses one connection. A database row lock serializes writes across
// Node processes, preventing lost stock/payment updates and duplicate document codes.
export async function withDatabase(write: boolean, fn: () => Promise<Response>): Promise<Response> {
  let conn: PoolConnection | undefined;
  try {
    conn = await pool().getConnection();
    await conn.query("SET time_zone = '+05:30'");
    await conn.beginTransaction();
    if (write) {
      const [lock] = await conn.query<RowDataPacket[]>("SELECT id FROM pos_write_lock WHERE id = 1 FOR UPDATE");
      if (lock.length !== 1) throw new Error('Missing pos_write_lock row. Repair the database before writing.');
    }
    const response = await context.run(conn, fn);
    if (response.status >= 400) await conn.rollback();
    else await conn.commit();
    return response;
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    console.error('POS database request failed:', error);
    return Response.json({ error: 'Database request failed. Check the server log and MySQL configuration.' }, { status: 500 });
  } finally { conn?.release(); }
}

export function getDb() {
  const conn = context.getStore();
  if (!conn) throw new Error('Database access requires withDatabase');
  return {
    prepare(sql: string) {
      const statement = sql;
      return {
        async all(...values: SqlValue[]): Promise<RowDataPacket[]> {
          const [rows] = await conn.execute<RowDataPacket[]>(statement, values); return rows;
        },
        async get(...values: SqlValue[]): Promise<RowDataPacket | undefined> {
          const [rows] = await conn.execute<RowDataPacket[]>(statement, values); return rows[0];
        },
        async run(...values: SqlValue[]) {
          const [result] = await conn.execute<ResultSetHeader>(statement, values);
          return { insertId: result.insertId, changes: result.affectedRows };
        },
      };
    },
  };
}
export async function ensureItemInDb(params: {
  name: string;
  description?: string;
  buying_price?: number;
  selling_price?: number;
  warranty_months?: number;
  warranty_label?: string;
  vat_rate?: number;
  stockDelta?: number;
}): Promise<Item | null> {
  const db = getDb();
  const cleanName = String(params.name || '').trim();
  if (!cleanName) return null;

  const cleanDesc = params.description !== undefined ? String(params.description).trim() : '';

  const existing = await db
    .prepare('SELECT * FROM items WHERE name = ?')
    .get(cleanName) as unknown as Item | undefined;

  if (existing) {
    const newDesc = cleanDesc || existing.description || '';
    const newBuying =
      params.buying_price !== undefined && Number(params.buying_price) > 0
        ? Number(params.buying_price)
        : existing.buying_price;
    const newSelling =
      params.selling_price !== undefined && Number(params.selling_price) > 0
        ? Number(params.selling_price)
        : existing.selling_price;
    const newWarrantyMonths =
      params.warranty_months !== undefined ? Number(params.warranty_months) : existing.warranty_months;
    const newWarrantyLabel = params.warranty_label || existing.warranty_label;
    const newVatRate =
      params.vat_rate !== undefined ? Number(params.vat_rate) : (existing.vat_rate || 0);
    const newStock = Number(existing.stock_qty || 0) + Number(params.stockDelta || 0);

    await db.prepare(`
      UPDATE items
      SET description = ?, buying_price = ?, selling_price = ?, warranty_months = ?, warranty_label = ?, vat_rate = ?, stock_qty = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newDesc, newBuying, newSelling, newWarrantyMonths, newWarrantyLabel, newVatRate, newStock, existing.id);

    return await db.prepare('SELECT * FROM items WHERE id = ?').get(existing.id) as unknown as Item;
  } else {
    const bPrice = Number(params.buying_price || 0);
    const sPrice = Number(params.selling_price || 0);
    const wMonths = params.warranty_months !== undefined ? Number(params.warranty_months) : 12;
    const wLabel = params.warranty_label || '1 Year';
    const vRate = params.vat_rate !== undefined ? Number(params.vat_rate) : 0;
    const initialStock = Number(params.stockDelta || 0);

    const info = await db
      .prepare(`
        INSERT INTO items (name, description, buying_price, selling_price, warranty_months, warranty_label, vat_rate, stock_qty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(cleanName, cleanDesc, bPrice, sPrice, wMonths, wLabel, vRate, initialStock);

    return await db.prepare('SELECT * FROM items WHERE id = ?').get(info.insertId) as unknown as Item;
  }
}

export async function ensureCustomerInDb(name?: string, phone?: string, address = ''): Promise<number | null> {
  const db = getDb();
  const cleanName = String(name || 'Walk-in Customer').trim() || 'Walk-in Customer';
  const cleanPhone = String(phone || '').trim();
  const cleanAddress = String(address || '').trim();

  if (cleanName.toLowerCase() === 'walk-in customer' && !cleanPhone) {
    return null;
  }

  let existing: { id: number; phone: string; address: string } | undefined;
  if (cleanPhone) {
    existing = await db.prepare('SELECT * FROM customers WHERE phone = ?').get(cleanPhone) as
      | { id: number; phone: string; address: string }
      | undefined;
  }
  if (!existing) {
    existing = await db.prepare('SELECT * FROM customers WHERE name = ?').get(cleanName) as
      | { id: number; phone: string; address: string }
      | undefined;
  }

  if (existing) {
    await db.prepare('UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ?').run(
      cleanName,
      cleanPhone || existing.phone,
      cleanAddress || existing.address,
      existing.id
    );
    return existing.id;
  } else {
    const res = await db
      .prepare('INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)')
      .run(cleanName, cleanPhone, cleanAddress);
    return Number(res.insertId);
  }
}

export async function ensureSupplierInDb(name?: string, phone?: string, company = ''): Promise<number> {
  const db = getDb();
  const cleanName = String(name || 'General Supplier').trim() || 'General Supplier';
  const cleanPhone = String(phone || '').trim();
  const cleanCompany = String(company || '').trim();

  const existing = await db.prepare('SELECT * FROM suppliers WHERE name = ?').get(cleanName) as
    | { id: number; phone: string; company: string }
    | undefined;

  if (existing) {
    await db.prepare('UPDATE suppliers SET phone = ?, company = ? WHERE id = ?').run(
      cleanPhone || existing.phone,
      cleanCompany || existing.company,
      existing.id
    );
    return existing.id;
  } else {
    const res = await db
      .prepare('INSERT INTO suppliers (name, phone, company) VALUES (?, ?, ?)')
      .run(cleanName, cleanPhone, cleanCompany);
    return Number(res.insertId);
  }
}

export async function nextDocumentCode(prefix: string, table: 'quotations' | 'invoices' | 'grns'): Promise<string> {
  // Called only within the serialized write transaction; retain existing numbering.
  const row = await getDb().prepare(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 1`).get();
  return `${prefix}-${String(Number(row?.id || 0) + 1).padStart(4, '0')}`;
}
export function computeWarrantyExpiry(months: number): string | null {
  const m = Number(months || 0);
  if (m <= 0) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + m);
  return d.toISOString().split('T')[0];
}

export async function processSequential<T, U>(items: T[], fn: (item: T) => Promise<U>): Promise<U[]> {
  const result: U[] = []; for (const item of items) result.push(await fn(item)); return result;
}

export async function generateUniqueDbSerial(itemName?: string, extraUsed?: Set<string>): Promise<string> {
  const db = getDb();
  const cleanPrefix = String(itemName || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 3);
  const prefix = cleanPrefix.length >= 2 ? cleanPrefix : 'SN';
  const now = new Date();
  const yymmdd =
    String(now.getFullYear()).slice(-2) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  for (let attempt = 0; attempt < 40; attempt++) {
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
    const candidate = `${prefix}-${yymmdd}-${rand}`;
    if (extraUsed?.has(candidate)) continue;
    const exists = await db.prepare('SELECT id FROM item_serials WHERE serial_number = ?').get(candidate);
    if (!exists) {
      extraUsed?.add(candidate);
      return candidate;
    }
  }
  const fallback = `${prefix}-${yymmdd}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  extraUsed?.add(fallback);
  return fallback;
}

export async function ensureGrnPaymentColumns(): Promise<void> {
  if (globals.grnColsEnsured) return;
  try {
    const p = pool();
    const [cols] = await p.query<RowDataPacket[]>('SHOW COLUMNS FROM grns');
    const existing = new Set(cols.map((c) => String(c.Field)));
    const needed: Array<[string, string]> = [
      ['payment_method', "VARCHAR(64) DEFAULT 'Cash'"],
      ['cheque_no', "VARCHAR(191) DEFAULT ''"],
      ['cheque_bank', "VARCHAR(191) DEFAULT ''"],
      ['cheque_date', "VARCHAR(64) DEFAULT ''"],
      ['cheque_reminder_date', "VARCHAR(64) DEFAULT ''"],
      ['payment_ref', "VARCHAR(191) DEFAULT ''"],
    ];
    for (const [colName, colDef] of needed) {
      if (!existing.has(colName)) {
        await p.query(`ALTER TABLE grns ADD COLUMN \`${colName}\` ${colDef}`);
      }
    }
    globals.grnColsEnsured = true;
  } catch (err) {
    console.error('Failed to ensure GRN payment columns:', err);
  }
}

export async function ensureInvoiceVehicleColumn(): Promise<void> {
  if (globals.invoiceVehicleColEnsured) return;
  try {
    const p = pool();
    const [cols] = await p.query<RowDataPacket[]>('SHOW COLUMNS FROM invoices');
    const existing = new Set(cols.map((c) => String(c.Field)));
    if (!existing.has('vehicle_no')) {
      await p.query("ALTER TABLE invoices ADD COLUMN `vehicle_no` VARCHAR(191) DEFAULT ''");
    }
    globals.invoiceVehicleColEnsured = true;
  } catch (err) {
    console.error('Failed to ensure invoice vehicle_no column:', err);
  }
}
