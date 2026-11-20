'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  FilePlus2,
  ClipboardList,
  Receipt,
  BarChart3,
  PackagePlus,
  ShieldCheck,
  Boxes,
  Settings,
  User,
  Package,
  Download,
  ArrowRight,
  X,
} from 'lucide-react';
import type { Customer, Invoice, Item, Quotation } from '@/types/pos';

export type CommandTabId =
  | 'billing'
  | 'quotations'
  | 'invoices'
  | 'reports'
  | 'grn'
  | 'warranty'
  | 'inventory'
  | 'settings';

interface CommandActionItem {
  id: string;
  group: 'Navigation' | 'Catalog Items' | 'Customers' | 'Quotations' | 'Invoices';
  title: string;
  subtitle: string;
  badge?: string;
  badgeTone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  icon: React.ReactNode;
  onSelect: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
  items: Item[];
  customers: Customer[];
  quotations: Quotation[];
  invoices: Invoice[];
  fmtMoney: (val: number | string | undefined) => string;
  onNavigateTab: (tab: CommandTabId, billingMode?: 'QUOTATION' | 'INVOICE') => void;
  onAddItemToCart: (item: Item) => void;
  onSelectCustomer: (customer: Customer) => void;
  onPreviewQuotation: (qt: Quotation) => void;
  onDownloadQuotationPdf: (qt: Quotation) => void;
  onPreviewInvoice: (inv: Invoice) => void;
  onDownloadInvoicePdf: (inv: Invoice) => void;
}

const BADGE_CLASSES: Record<NonNullable<CommandActionItem['badgeTone']>, string> = {
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function CommandPaletteModal({
  open,
  onClose,
  items,
  customers,
  quotations,
  invoices,
  fmtMoney,
  onNavigateTab,
  onAddItemToCart,
  onSelectCustomer,
  onPreviewQuotation,
  onDownloadQuotationPdf,
  onPreviewInvoice,
  onDownloadInvoicePdf,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const results = useMemo<CommandActionItem[]>(() => {
    const q = query.trim().toLowerCase();

    const navActions: CommandActionItem[] = [
      {
        id: 'nav-new-quote',
        group: 'Navigation',
        title: 'New Quotation (නව මිල ගණන් පත්‍රය)',
        subtitle: 'Switch to Billing in Quotation mode',
        badge: 'Alt+Q',
        badgeTone: 'amber',
        icon: <FilePlus2 className="w-4 h-4 text-amber-600" />,
        onSelect: () => {
          onNavigateTab('billing', 'QUOTATION');
          onClose();
        },
      },
      {
        id: 'nav-new-invoice',
        group: 'Navigation',
        title: 'New Direct Invoice (සෘජු බිල්පත)',
        subtitle: 'Switch to Billing in Invoice mode',
        badge: 'Alt+I',
        badgeTone: 'indigo',
        icon: <Receipt className="w-4 h-4 text-indigo-600" />,
        onSelect: () => {
          onNavigateTab('billing', 'INVOICE');
          onClose();
        },
      },
      {
        id: 'nav-quotations',
        group: 'Navigation',
        title: 'Quotations List',
        subtitle: 'View, confirm, edit, or download quotation PDFs',
        icon: <ClipboardList className="w-4 h-4 text-slate-600" />,
        onSelect: () => {
          onNavigateTab('quotations');
          onClose();
        },
      },
      {
        id: 'nav-invoices',
        group: 'Navigation',
        title: 'Invoices List',
        subtitle: 'Manage invoices, payments & due balances',
        icon: <Receipt className="w-4 h-4 text-slate-600" />,
        onSelect: () => {
          onNavigateTab('invoices');
          onClose();
        },
      },
      {
        id: 'nav-reports',
        group: 'Navigation',
        title: 'Sales Reports',
        subtitle: 'Daily, monthly & tax reports',
        icon: <BarChart3 className="w-4 h-4 text-slate-600" />,
        onSelect: () => {
          onNavigateTab('reports');
          onClose();
        },
      },
      {
        id: 'nav-grn',
        group: 'Navigation',
        title: 'GRN (Stock In)',
        subtitle: 'Receive supplier stock & serial numbers',
        icon: <PackagePlus className="w-4 h-4 text-slate-600" />,
        onSelect: () => {
          onNavigateTab('grn');
          onClose();
        },
      },
      {
        id: 'nav-warranty',
        group: 'Navigation',
        title: 'Warranty & Serial Lookup',
        subtitle: 'Check S/N warranty expiry & invoice history',
        icon: <ShieldCheck className="w-4 h-4 text-slate-600" />,
        onSelect: () => {
          onNavigateTab('warranty');
          onClose();
        },
      },
      {
        id: 'nav-inventory',
        group: 'Navigation',
        title: 'Items & Stock Directory',
        subtitle: 'Browse catalog, prices & low-stock items',
        icon: <Boxes className="w-4 h-4 text-slate-600" />,
        onSelect: () => {
          onNavigateTab('inventory');
          onClose();
        },
      },
      {
        id: 'nav-settings',
        group: 'Navigation',
        title: 'Shop & Invoice Settings',
        subtitle: 'Customize shop info, layout & VAT defaults',
        icon: <Settings className="w-4 h-4 text-slate-600" />,
        onSelect: () => {
          onNavigateTab('settings');
          onClose();
        },
      },
    ];

    const matchedNav = navActions
      .filter((a) => !q || a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q))
      .slice(0, q ? 5 : 4);

    const matchedItems: CommandActionItem[] = items
      .filter(
        (it) =>
          !q ||
          it.name.toLowerCase().includes(q) ||
          (it.description || '').toLowerCase().includes(q)
      )
      .slice(0, q ? 6 : 3)
      .map((it) => ({
        id: `item-${it.id}`,
        group: 'Catalog Items',
        title: it.name,
        subtitle: `Add to Cart • Stock: ${it.stock_qty} • ${it.warranty_label}`,
        badge: fmtMoney(it.selling_price),
        badgeTone: it.stock_qty > 0 ? 'emerald' : 'rose',
        icon: <Package className="w-4 h-4 text-emerald-600" />,
        onSelect: () => {
          onAddItemToCart(it);
          onClose();
        },
      }));

    const matchedCustomers: CommandActionItem[] = customers
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.address || '').toLowerCase().includes(q)
      )
      .slice(0, q ? 5 : 2)
      .map((c) => ({
        id: `cust-${c.id}`,
        group: 'Customers',
        title: c.name,
        subtitle: [c.phone, c.address].filter(Boolean).join(' • ') || 'Select customer for billing',
        badge: 'Use Customer',
        badgeTone: 'indigo',
        icon: <User className="w-4 h-4 text-indigo-600" />,
        onSelect: () => {
          onSelectCustomer(c);
          onClose();
        },
      }));

    const matchedQuotes: CommandActionItem[] = quotations
      .filter(
        (qt) =>
          !q ||
          qt.quote_no.toLowerCase().includes(q) ||
          qt.customer_name.toLowerCase().includes(q) ||
          (qt.subject || '').toLowerCase().includes(q)
      )
      .slice(0, q ? 5 : 3)
      .map((qt) => ({
        id: `qt-${qt.id}`,
        group: 'Quotations',
        title: `${qt.quote_no} — ${qt.customer_name}`,
        subtitle: `${fmtMoney(qt.grand_total)} • ${qt.status}${qt.subject ? ` • ${qt.subject}` : ''}`,
        badge: qt.status === 'PENDING' ? 'Pending' : 'Invoiced',
        badgeTone: qt.status === 'PENDING' ? 'amber' : 'emerald',
        icon: <ClipboardList className="w-4 h-4 text-amber-600" />,
        onSelect: () => {
          onPreviewQuotation(qt);
          onClose();
        },
        secondaryLabel: 'PDF',
        onSecondary: () => {
          onDownloadQuotationPdf(qt);
          onClose();
        },
      }));

    const matchedInvoices: CommandActionItem[] = invoices
      .filter(
        (inv) =>
          !q ||
          inv.invoice_no.toLowerCase().includes(q) ||
          inv.customer_name.toLowerCase().includes(q) ||
          (inv.quote_no || '').toLowerCase().includes(q)
      )
      .slice(0, q ? 5 : 2)
      .map((inv) => ({
        id: `inv-${inv.id}`,
        group: 'Invoices',
        title: `${inv.invoice_no} — ${inv.customer_name}`,
        subtitle: `${fmtMoney(inv.grand_total)} • ${inv.balance_due > 0 ? `Due ${fmtMoney(inv.balance_due)}` : 'Paid'}`,
        badge: inv.balance_due > 0 ? 'Due' : 'Paid',
        badgeTone: inv.balance_due > 0 ? 'rose' : 'emerald',
        icon: <Receipt className="w-4 h-4 text-indigo-600" />,
        onSelect: () => {
          onPreviewInvoice(inv);
          onClose();
        },
        secondaryLabel: 'PDF',
        onSecondary: () => {
          onDownloadInvoicePdf(inv);
          onClose();
        },
      }));

    return [...matchedNav, ...matchedItems, ...matchedCustomers, ...matchedQuotes, ...matchedInvoices];
  }, [
    query,
    items,
    customers,
    quotations,
    invoices,
    fmtMoney,
    onNavigateTab,
    onAddItemToCart,
    onSelectCustomer,
    onPreviewQuotation,
    onDownloadQuotationPdf,
    onPreviewInvoice,
    onDownloadInvoicePdf,
    onClose,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (results.length ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (results.length ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      results[activeIndex].onSelect();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-start justify-center pt-[10vh] p-4 no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 bg-slate-50/70">
          <Search className="w-5 h-5 text-indigo-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items to add, customers, QTN #, INV #, or jump to page..."
            className="flex-1 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-500 bg-white border border-slate-200 rounded-md">
            Esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
            aria-label="Close quick search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No matching pages, items, customers, or documents found.
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === activeIndex;
              const prevGroup = idx > 0 ? results[idx - 1].group : null;
              const showGroupHeader = item.group !== prevGroup;

              return (
                <React.Fragment key={item.id}>
                  {showGroupHeader && (
                    <div className="px-4 py-1.5 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {item.group}
                    </div>
                  )}
                  <div
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={item.onSelect}
                    className={`px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition ${
                      isSelected ? 'bg-indigo-50/90' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{item.subtitle}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            BADGE_CLASSES[item.badgeTone || 'slate']
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {item.secondaryLabel && item.onSecondary && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            item.onSecondary?.();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition"
                        >
                          <Download className="w-3 h-3" />
                          <span>{item.secondaryLabel}</span>
                        </button>
                      )}
                      <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono">Enter</kbd> Open / Add</span>
          </div>
          <span>Instant POS Command Palette</span>
        </div>
      </div>
    </div>
  );
}
