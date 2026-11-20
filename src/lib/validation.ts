export function validateInput(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Expected a JSON object';
  const value = body as Record<string, unknown>;
  const numericFields = ['qty', 'buying_price', 'selling_price', 'unit_price', 'item_discount', 'vat_rate', 'discount', 'paid_amount', 'warranty_months', 'stock_qty'];
  function check(row: Record<string, unknown>): string | null {
    for (const key of numericFields) {
      if (row[key] === undefined || row[key] === '') continue;
      const n = Number(row[key]);
      if (!Number.isFinite(n) || (key !== 'stock_qty' && n < 0)) return `Invalid ${key}`;
      if (['qty', 'warranty_months', 'stock_qty'].includes(key) && !Number.isSafeInteger(n)) return `${key} must be a whole number`;
      if (key === 'qty' && n <= 0) return 'Quantity must be positive';
    }
    return null;
  }
  const topError = check(value); if (topError) return topError;
  if (value.items !== undefined) {
    if (!Array.isArray(value.items) || !value.items.length) return 'At least one item is required';
    const seen = new Set<string>();
    for (const item of value.items) {
      if (!item || typeof item !== 'object' || !String(item.item_name || '').trim()) return 'Item name is required';
      const error = check(item); if (error) return error;
      if (item.serial_numbers !== undefined && !Array.isArray(item.serial_numbers)) return 'Invalid serial numbers';
      const serials = (item.serial_numbers || []).map((s: unknown) => String(s || '').trim()).filter(Boolean);
      if (serials.length > Number(item.qty || 1)) return 'Serial count exceeds quantity';
      for (const serial of serials) {
        const normalized = serial.toLowerCase();
        if (seen.has(normalized)) return 'Duplicate serial number in document';
        seen.add(normalized);
      }
    }
  }
  return null;
}
