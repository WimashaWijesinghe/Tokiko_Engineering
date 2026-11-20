export interface ShopSettings {
  shop_name: string;
  shop_tagline: string;
  shop_address: string;
  shop_phone: string;
  shop_email: string;
  shop_website?: string;
  shop_logo?: string;
  currency: string;
  invoice_terms: string;
  vat_reg_no?: string;
  branch_location?: string;
  rep_name?: string;
  cashier_name?: string;
  invoice_title?: string;
  stamp_text?: string;
  verification_stamp_title?: string;
  verification_stamp_dept?: string;
  footer_copy_label?: string;
  declaration_text?: string;
  show_dispatch_vehicle?: string;
  vat_rate_percent?: string;
  printer_name?: string;
  invoice_layout_style?: 'POS80' | 'STC_OFFICIAL' | 'MODERN';
  watermark_mode?: 'OFF' | 'LOGO' | 'TEXT' | 'CUSTOM_IMAGE';
  watermark_text?: string;
  watermark_image?: string;
  watermark_opacity?: string;
  watermark_size?: string;
  [key: string]: string | undefined;
}

export interface Item {
  id: number;
  name: string;
  description: string;
  buying_price: number;
  selling_price: number;
  warranty_months: number;
  warranty_label: string;
  vat_rate?: number;
  stock_qty: number;
  created_at: string;
  updated_at: string;
}

export interface ItemSerial {
  id: number;
  item_id: number | null;
  item_name: string;
  serial_number: string;
  status: 'IN_STOCK' | 'SOLD';
  grn_id?: number | null;
  grn_no?: string;
  invoice_id?: number | null;
  invoice_no?: string;
  warranty_months: number;
  warranty_label: string;
  sold_date?: string | null;
  warranty_expiry?: string | null;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  company: string;
  created_at: string;
}

export interface BillingLineItemInput {
  rowId?: string;
  item_id?: number | null;
  item_name: string;
  item_description: string;
  serial_numbers: string[];
  warranty_months: number;
  warranty_label: string;
  qty: number;
  unit_price: number | string;
  item_discount: number | string;
  vat_rate?: number | string;
  vat_amount?: number;
  line_total?: number;
}

export interface Quotation {
  id: number;
  quote_no: string;
  subject: string;
  description?: string;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  subtotal: number;
  tax_amount?: number;
  discount: number;
  grand_total: number;
  notes: string;
  status: 'PENDING' | 'INVOICED' | 'CANCELLED';
  converted_invoice_id: number | null;
  converted_invoice_no: string;
  created_at: string;
  items: BillingLineItemInput[];
}

export interface Invoice {
  id: number;
  invoice_no: string;
  quotation_id: number | null;
  quote_no: string;
  subject: string;
  description?: string;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  subtotal: number;
  tax_amount?: number;
  discount: number;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  payment_method: string;
  cheque_no?: string;
  cheque_bank?: string;
  cheque_date?: string;
  payment_ref?: string;
  vehicle_no?: string;
  payment_status: 'PAID' | 'PARTIAL' | 'UNPAID';
  notes: string;
  created_at: string;
  items: BillingLineItemInput[];
}

export interface GRNLineItemInput {
  item_id?: number | null;
  item_name: string;
  item_description?: string;
  serial_numbers: string[];
  warranty_months: number;
  warranty_label: string;
  qty: number;
  buying_price: number | string;
  selling_price: number | string;
  line_total?: number;
}

export interface GRN {
  id: number;
  grn_no: string;
  supplier_id: number | null;
  supplier_name: string;
  supplier_phone: string;
  ref_no: string;
  total_amount: number;
  paid_amount: number;
  payment_method?: string;
  cheque_no?: string;
  cheque_bank?: string;
  cheque_date?: string;
  cheque_reminder_date?: string;
  payment_ref?: string;
  notes: string;
  created_at: string;
  items: GRNLineItemInput[];
}

export interface DashboardStats {
  todaySalesTotal: number;
  todaySalesCount: number;
  totalRevenue: number;
  totalBalanceDue: number;
  pendingQuotesCount: number;
  lowStockCount: number;
}

export interface PrintDocumentData {
  docType: 'QUOTATION' | 'INVOICE';
  docNo: string;
  refQuoteNo?: string;
  subject?: string;
  description?: string;
  date: string;
  time?: string;
  customerId?: number | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: BillingLineItemInput[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  paidAmount?: number;
  balanceDue?: number;
  paymentMethod?: string;
  chequeNo?: string;
  chequeBank?: string;
  chequeDate?: string;
  paymentRef?: string;
  notes: string;
  extraConvertId?: number | null;
  cashierName?: string;
  repName?: string;
  branchLocation?: string;
  vatRegNo?: string;
  customerPoNo?: string;
  dispatchVehicleNo?: string;
  footerCopyLabel?: string;
  stampType?: 'CREDIT' | 'CASH' | 'PAID' | 'NONE';
  layoutStyle?: 'POS80' | 'STC_OFFICIAL' | 'MODERN';
  paperSize?: 'A4' | 'HALF_A4';
  vatRatePercent?: string;
}

export interface BootstrapResponse {
  settings: ShopSettings;
  items: Item[];
  availableSerials: ItemSerial[];
  customers: Customer[];
  suppliers: Supplier[];
  quotations: Quotation[];
  invoices: Invoice[];
  grns: GRN[];
  stats: DashboardStats;
}
