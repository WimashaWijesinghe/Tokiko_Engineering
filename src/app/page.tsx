'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FilePlus2,
  ClipboardList,
  Receipt,
  PackagePlus,
  ShieldCheck,
  Boxes,
  Settings,
  Search,
  Plus,
  Trash2,
  Printer,
  Download,
  CheckCircle2,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  User,
  Phone,
  MapPin,
  FileText,
  Sparkles,
  CreditCard,
  Banknote,
  Landmark,
  Wallet,
  ChevronDown,
  ChevronUp,
  Zap,
  Store,
  GripVertical,
  Rows2,
  BarChart3,
  Calendar,
  FileSpreadsheet,
  TrendingUp,
  Copy,
  ArrowRightCircle,
  AlertTriangle,
  RefreshCw,
  Command,
  Minus,
  Pencil,
  Loader2,
  Clock,
  PackageCheck,
  LogOut,
  KeyRound,
} from 'lucide-react';
import type {
  ShopSettings,
  Item,
  ItemSerial,
  Customer,
  Quotation,
  Invoice,
  GRN,
  DashboardStats,
  BillingLineItemInput,
  GRNLineItemInput,
  BootstrapResponse,
  PrintDocumentData,
} from '@/types/pos';
import { PrintableDocument } from '@/components/PrintableDocument';
import { CommandPaletteModal } from '@/components/CommandPaletteModal';
import { PaymentSettlementModal, type PaymentTargetInfo } from '@/components/PaymentSettlementModal';
import { WarrantySelector } from '@/components/WarrantySelector';
import { sanitizeClonedDocumentColors } from '@/lib/pdfColorSanitizer';

type ActiveTab = 'billing' | 'quotations' | 'invoices' | 'reports' | 'grn' | 'warranty' | 'inventory' | 'settings';
type BillingMode = 'QUOTATION' | 'INVOICE';

function fmtMoney(val: number | string | undefined): string {
  const num = Number(val || 0);
  return 'Rs. ' + num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function addDaysToTodayIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  return d.toISOString().slice(0, 10);
}

function daysBetweenTodayAndIso(dateStr: string): string {
  if (!dateStr) return '';
  const todayMs = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const targetMs = new Date(dateStr).getTime();
  if (Number.isNaN(targetMs)) return '';
  return String(Math.max(0, Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24))));
}

function generateSerialCode(used: Set<string>, itemName?: string): string {
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
  for (let attempt = 0; attempt < 50; attempt++) {
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
    const candidate = `${prefix}-${yymmdd}-${rand}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  const fallback = `${prefix}-${yymmdd}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  used.add(fallback);
  return fallback;
}

function createEmptyBillingRow(): BillingLineItemInput {
  return {
    rowId: 'row_' + Math.random().toString(36).slice(2, 9),
    item_name: '',
    item_description: '',
    warranty_months: 12,
    warranty_label: '1 Year',
    qty: 1,
    serial_numbers: [''],
    unit_price: '',
    item_discount: 0,
    vat_rate: '',
  };
}

function createEmptyGrnRow(): GRNLineItemInput {
  return {
    item_name: '',
    item_description: '',
    warranty_months: 12,
    warranty_label: '1 Year',
    qty: 1,
    serial_numbers: [''],
    buying_price: '',
    selling_price: '',
  };
}

export default function SimplePosApp() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('billing');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: number;
    username: string;
    display_name: string;
    role: string;
  } | null>(null);
  const [pwdUsername, setPwdUsername] = useState<string>('');
  const [pwdCurrent, setPwdCurrent] = useState<string>('');
  const [pwdNew, setPwdNew] = useState<string>('');
  const [pwdConfirm, setPwdConfirm] = useState<string>('');
  const [pwdSaving, setPwdSaving] = useState<boolean>(false);

  // Server Data State
  const [settings, setSettings] = useState<ShopSettings>({
    shop_name: '',
    shop_tagline: '',
    shop_address: '',
    shop_phone: '',
    shop_email: '',
    currency: 'Rs.',
    invoice_terms: 'Goods once sold will not be taken back. Please bring this invoice for any warranty claims.',
    vat_reg_no: '',
    branch_location: '',
    rep_name: '',
    cashier_name: '',
    invoice_title: 'Invoice',
    stamp_text: '',
    verification_stamp_title: 'පරීක්ෂා කළා',
    verification_stamp_dept: 'ආරක්ෂක අංශය / ප්‍රදර්ශනාගාරය',
    footer_copy_label: "CUSTOMER'S COPY",
    declaration_text: 'ABOVE ITEMS RECEIVED IN WORKING/GOOD CONDITION :',
    show_dispatch_vehicle: '1',
    vat_rate_percent: '18',
    printer_name: '',
    invoice_layout_style: 'MODERN',
    watermark_mode: 'LOGO',
    watermark_text: '',
    watermark_image: '',
    watermark_opacity: '10',
    watermark_size: '55',
  });
  const [items, setItems] = useState<Item[]>([]);
  const [availableSerials, setAvailableSerials] = useState<ItemSerial[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    todaySalesTotal: 0,
    todaySalesCount: 0,
    totalRevenue: 0,
    totalBalanceDue: 0,
    pendingQuotesCount: 0,
    lowStockCount: 0,
  });

  // Billing Form State
  const [billingMode, setBillingMode] = useState<BillingMode>('QUOTATION');
  const [editingQuotationId, setEditingQuotationId] = useState<number | null>(null);
  const [convertingQuotationId, setConvertingQuotationId] = useState<number | null>(null);
  const [convertingQuotationIds, setConvertingQuotationIds] = useState<number[]>([]);
  const [convertingQuoteNo, setConvertingQuoteNo] = useState<string>('');
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<number[]>([]);

  const [billSubject, setBillSubject] = useState<string>('');
  const [billDescription, setBillDescription] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [showCustomerSuggest, setShowCustomerSuggest] = useState<boolean>(false);

  const [billingRows, setBillingRows] = useState<BillingLineItemInput[]>([createEmptyBillingRow()]);
  const [activeItemSuggestRow, setActiveItemSuggestRow] = useState<number | null>(null);

  const [billDiscount, setBillDiscount] = useState<string>('0');
  const [billPaidAmount, setBillPaidAmount] = useState<string>('');
  const [billPaymentMethod, setBillPaymentMethod] = useState<string>('Cash');
  const [billChequeNo, setBillChequeNo] = useState<string>('');
  const [billChequeBank, setBillChequeBank] = useState<string>('');
  const [billChequeDate, setBillChequeDate] = useState<string>('');
  const [billCreditDays, setBillCreditDays] = useState<string>('30');
  const [billCreditDueDate, setBillCreditDueDate] = useState<string>('');
  const [billVehicleNo, setBillVehicleNo] = useState<string>('');
  const [billNotes, setBillNotes] = useState<string>('');

  // Quotations & Invoices Filters
  const [searchQuotations, setSearchQuotations] = useState<string>('');
  const [filterQuotationStatus, setFilterQuotationStatus] = useState<'ALL' | 'PENDING' | 'INVOICED'>('ALL');
  const [searchInvoices, setSearchInvoices] = useState<string>('');
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState<'ALL' | 'PAID' | 'DUE'>('ALL');
  const [filterInventoryStatus, setFilterInventoryStatus] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [filterWarrantyStatus, setFilterWarrantyStatus] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'IN_STOCK'>('ALL');

  // Sales Report Filters
  const [reportDatePreset, setReportDatePreset] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM'>('MONTH');
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [reportPaymentMethod, setReportPaymentMethod] = useState<string>('ALL');
  const [reportStatus, setReportStatus] = useState<'ALL' | 'PAID' | 'DUE'>('ALL');
  const [reportSearch, setReportSearch] = useState<string>('');
  const [reportLang, setReportLang] = useState<'EN' | 'SI' | 'BOTH'>('BOTH');

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('pos_report_lang');
      if (savedLang === 'EN' || savedLang === 'SI' || savedLang === 'BOTH') {
        setReportLang(savedLang);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('pos_report_lang', reportLang);
    } catch {
      // Ignore storage errors
    }
  }, [reportLang]);

  // GRN Form State
  const [grnSupplierName, setGrnSupplierName] = useState<string>('');
  const [grnSupplierPhone, setGrnSupplierPhone] = useState<string>('');
  const [grnRefNo, setGrnRefNo] = useState<string>('');
  const [grnPaidAmount, setGrnPaidAmount] = useState<string>('');
  const [grnPaymentMethod, setGrnPaymentMethod] = useState<string>('Cash');
  const [grnChequeNo, setGrnChequeNo] = useState<string>('');
  const [grnChequeBank, setGrnChequeBank] = useState<string>('');
  const [grnChequeDate, setGrnChequeDate] = useState<string>('');
  const [grnChequeReminderDate, setGrnChequeReminderDate] = useState<string>('');
  const [grnCreditDays, setGrnCreditDays] = useState<string>('30');
  const [grnCreditDueDate, setGrnCreditDueDate] = useState<string>('');
  const [grnPaymentRef, setGrnPaymentRef] = useState<string>('');
  const [grnNotes, setGrnNotes] = useState<string>('');
  const [grnRows, setGrnRows] = useState<GRNLineItemInput[]>([createEmptyGrnRow()]);
  const [activeGrnSuggestRow, setActiveGrnSuggestRow] = useState<number | null>(null);

  // Warranty Search State
  const [warrantyQuery, setWarrantyQuery] = useState<string>('');
  const [warrantyResults, setWarrantyResults] = useState<ItemSerial[]>([]);

  // Inventory Search & Modal State
  const [searchInventory, setSearchInventory] = useState<string>('');
  const [itemModalOpen, setItemModalOpen] = useState<boolean>(false);
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [editItemName, setEditItemName] = useState<string>('');
  const [editItemDescription, setEditItemDescription] = useState<string>('');
  const [editItemBuying, setEditItemBuying] = useState<string>('');
  const [editItemSelling, setEditItemSelling] = useState<string>('');
  const [editItemWarrantyMonths, setEditItemWarrantyMonths] = useState<number>(12);
  const [editItemWarrantyLabel, setEditItemWarrantyLabel] = useState<string>('1 Year');
  const [editItemStock, setEditItemStock] = useState<string>('0');
  const [editItemVatRate, setEditItemVatRate] = useState<string>('');

  // Print Modal State
  const [printDoc, setPrintDoc] = useState<PrintDocumentData | null>(null);
  const [offscreenPdfDoc, setOffscreenPdfDoc] = useState<PrintDocumentData | null>(null);
  const [downloadingQuoteId, setDownloadingQuoteId] = useState<number | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
  const [showQuickCustomizer, setShowQuickCustomizer] = useState<boolean>(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState<boolean>(false);

  // Command Palette, Settlement Modal & Ergonomic UI State
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTargetInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [expandedDescRows, setExpandedDescRows] = useState<Record<string, boolean>>({});
  const [showGrnSupplierSuggest, setShowGrnSupplierSuggest] = useState<boolean>(false);

  // Modern SaaS Shell & Billing UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [quickItemQuery, setQuickItemQuery] = useState<string>('');
  const [showQuickCatalogDropdown, setShowQuickCatalogDropdown] = useState<boolean>(false);
  const [showScopeBox, setShowScopeBox] = useState<boolean>(false);
  const [billingLeftPct, setBillingLeftPct] = useState<number>(68);
  const [billingStacked, setBillingStacked] = useState<boolean>(false);
  const [isResizingBilling, setIsResizingBilling] = useState<boolean>(false);
  const billingSplitRef = useRef<HTMLElement | null>(null);
  const [summaryScale, setSummaryScale] = useState<'S' | 'M' | 'L'>('M');
  const [summaryLineGap, setSummaryLineGap] = useState<'tight' | 'normal' | 'relaxed'>('normal');
  const [summaryMinHeight, setSummaryMinHeight] = useState<number>(0);
  const [isResizingSummaryH, setIsResizingSummaryH] = useState<boolean>(false);
  const summaryBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const savedPct = localStorage.getItem('pos_billing_split_pct');
      if (savedPct) {
        const parsed = Number(savedPct);
        if (!Number.isNaN(parsed) && parsed >= 48 && parsed <= 78) {
          setBillingLeftPct(parsed);
        }
      }
      const savedStacked = localStorage.getItem('pos_billing_stacked');
      if (savedStacked === 'true') {
        setBillingStacked(true);
      }
      const savedScale = localStorage.getItem('pos_summary_scale');
      if (savedScale === 'S' || savedScale === 'M' || savedScale === 'L') {
        setSummaryScale(savedScale);
      }
      const savedGap = localStorage.getItem('pos_summary_line_gap');
      if (savedGap === 'tight' || savedGap === 'normal' || savedGap === 'relaxed') {
        setSummaryLineGap(savedGap);
      }
      const savedH = localStorage.getItem('pos_summary_min_height');
      if (savedH) {
        const h = Number(savedH);
        if (!Number.isNaN(h) && h >= 0 && h <= 900) {
          setSummaryMinHeight(h);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('pos_billing_split_pct', String(billingLeftPct));
      localStorage.setItem('pos_billing_stacked', String(billingStacked));
      localStorage.setItem('pos_summary_scale', summaryScale);
      localStorage.setItem('pos_summary_line_gap', summaryLineGap);
      localStorage.setItem('pos_summary_min_height', String(summaryMinHeight));
    } catch {
      // Ignore storage errors
    }
  }, [billingLeftPct, billingStacked, summaryScale, summaryLineGap, summaryMinHeight]);

  useEffect(() => {
    if (!isResizingBilling) return;
    const handleMouseMove = (e: MouseEvent) => {
      const container = billingSplitRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rawPct = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(78, Math.max(48, Math.round(rawPct)));
      setBillingLeftPct(clamped);
    };
    const handleMouseUp = () => {
      setIsResizingBilling(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingBilling]);

  useEffect(() => {
    if (!isResizingSummaryH) return;
    const handleMouseMove = (e: MouseEvent) => {
      const box = summaryBoxRef.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const nextH = Math.min(900, Math.max(280, Math.round(e.clientY - rect.top)));
      setSummaryMinHeight(nextH);
    };
    const handleMouseUp = () => {
      setIsResizingSummaryH(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingSummaryH]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const loadBootstrapData = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) return;
      const data: BootstrapResponse = await res.json();
      if (data.settings) setSettings(data.settings);
      setItems(data.items || []);
      setAvailableSerials(data.availableSerials || []);
      setCustomers(data.customers || []);
      setQuotations(data.quotations || []);
      setInvoices(data.invoices || []);
      setGrns(data.grns || []);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      console.error('Failed to fetch bootstrap data:', e);
    }
  }, []);

  useEffect(() => {
    loadBootstrapData();
  }, [loadBootstrapData]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) {
          setCurrentUser(data.user);
          setPwdUsername(data.user.username || '');
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };

  const handleChangePassword = async () => {
    if (!pwdCurrent || !pwdNew) {
      alert('Current password සහ New password ඇතුළත් කරන්න.');
      return;
    }
    if (pwdNew !== pwdConfirm) {
      alert('New password සහ Confirm password සමාන නැත.');
      return;
    }
    if (pwdNew.length < 4) {
      alert('New password අවම වශයෙන් අකුරු 4ක් විය යුතුය.');
      return;
    }
    setPwdSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: pwdUsername.trim(),
          current_password: pwdCurrent,
          new_password: pwdNew,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Failed to update password');
        return;
      }
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
      if (pwdUsername.trim() && currentUser) {
        setCurrentUser({ ...currentUser, username: pwdUsername.trim() });
      }
      showToast('Login credentials updated successfully!');
    } finally {
      setPwdSaving(false);
    }
  };

  const runWarrantySearch = useCallback(async (qStr: string) => {
    try {
      const res = await fetch(`/api/warranty-search?q=${encodeURIComponent(qStr)}`);
      const data = await res.json();
      setWarrantyResults(data.results || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'warranty') {
      runWarrantySearch(warrantyQuery);
    }
  }, [activeTab, warrantyQuery, runWarrantySearch]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadBootstrapData();
      showToast('Data refreshed!');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Global keyboard shortcuts: Ctrl+K Command Palette, PgDn add row, Alt+Q/Alt+I mode switch
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }
      if (commandPaletteOpen || paymentTarget || printDoc || itemModalOpen) return;

      if (e.altKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        setBillingMode('QUOTATION');
        setActiveTab('billing');
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setBillingMode('INVOICE');
        setActiveTab('billing');
        return;
      }

      if (activeTab !== 'billing') return;
      if (e.key === 'PageDown') {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        addBillingRow();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeTab, printDoc, itemModalOpen, commandPaletteOpen, paymentTarget, billingRows.length]);

  // ==========================================================================
  // BILLING HANDLERS (DYNAMIC MULTI-SERIAL PER QTY + DESCRIPTION + AUTO-SAVE)
  // ==========================================================================

  const resetBillingForm = () => {
    setEditingQuotationId(null);
    setConvertingQuotationId(null);
    setConvertingQuotationIds([]);
    setConvertingQuoteNo('');
    setBillSubject('');
    setBillDescription('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setBillDiscount('0');
    setBillPaidAmount('');
    setBillPaymentMethod('Cash');
    setBillChequeNo('');
    setBillChequeBank('');
    setBillChequeDate('');
    setBillCreditDays('30');
    setBillCreditDueDate('');
    setBillVehicleNo('');
    setBillNotes('');
    setBillingRows([createEmptyBillingRow()]);
  };

  const addBillingRow = (targetIdx?: number) => {
    setBillingRows((prev) => {
      const nextIdx = targetIdx !== undefined ? targetIdx : prev.length;
      setTimeout(() => {
        const el = document.getElementById(`item_name_input_${nextIdx}`) as HTMLInputElement | null;
        if (el) {
          el.focus();
          el.select();
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          setTimeout(() => {
            const retryEl = document.getElementById(`item_name_input_${nextIdx}`) as HTMLInputElement | null;
            if (retryEl) {
              retryEl.focus();
              retryEl.select();
              retryEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 80);
        }
      }, 40);
      return [...prev, createEmptyBillingRow()];
    });
  };

  const handleAddNewRowFromEnter = (currentRowIdx: number) => {
    if (currentRowIdx >= billingRows.length - 1) {
      addBillingRow();
    } else {
      const nextRow = billingRows[currentRowIdx + 1];
      if (!nextRow || (nextRow.item_name && nextRow.item_name.trim() !== '')) {
        addBillingRow();
      } else {
        // Focus existing empty next row
        const nextEl = document.getElementById(`item_name_input_${currentRowIdx + 1}`) as HTMLInputElement | null;
        if (nextEl) {
          nextEl.focus();
          nextEl.select();
          nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          addBillingRow();
        }
      }
    }
  };

  const handleBillingRowKeyDown = (e: React.KeyboardEvent, currentRowIdx: number) => {
    if (e.key === 'PageDown') {
      e.preventDefault();
      e.stopPropagation();
      handleAddNewRowFromEnter(currentRowIdx);
    } else if (e.key === 'PageUp') {
      if (currentRowIdx > 0) {
        e.preventDefault();
        e.stopPropagation();
        const prevEl = document.getElementById(`item_name_input_${currentRowIdx - 1}`) as HTMLInputElement | null;
        if (prevEl) {
          prevEl.focus();
          prevEl.select();
          prevEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  };

  const removeBillingRow = (idx: number) => {
    setBillingRows((prev) => {
      if (prev.length <= 1) return [createEmptyBillingRow()];
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updateBillingRow = (idx: number, patch: Partial<BillingLineItemInput>) => {
    setBillingRows((prev) => {
      const used = collectUsedSerials(prev);
      return prev.map((row, i) => {
        if (i !== idx) return row;
        const updated = { ...row, ...patch };
        if (patch.qty !== undefined) {
          const safeQty = Math.max(1, Math.min(100, Number(patch.qty) || 1));
          updated.qty = safeQty;
          const clean = String(updated.item_name || '').trim().toLowerCase();
          const inStockMatch = clean
            ? items.find((it) => it.name.toLowerCase() === clean && Number(it.stock_qty || 0) > 0)
            : undefined;
          const nextSerials: string[] = [];
          for (let s = 0; s < safeQty; s++) {
            const existing = row.serial_numbers[s] || '';
            if (existing) {
              nextSerials.push(existing);
            } else if (clean && !inStockMatch) {
              nextSerials.push(generateSerialCode(used, updated.item_name));
            } else {
              nextSerials.push('');
            }
          }
          updated.serial_numbers = nextSerials;
        }
        return updated;
      });
    });
  };

  const updateBillingRowSerial = (rowIdx: number, snIdx: number, val: string) => {
    setBillingRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        const nextSerials = [...row.serial_numbers];
        nextSerials[snIdx] = val;
        return { ...row, serial_numbers: nextSerials };
      })
    );
  };

  const pickAvailableSerial = (rowIdx: number, serialStr: string) => {
    setBillingRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        if (row.serial_numbers.includes(serialStr)) {
          showToast('එම Serial Number එක දැනටමත් ඇතුළත් කර ඇත!');
          return row;
        }
        const emptyIdx = row.serial_numbers.findIndex((s) => !String(s).trim());
        if (emptyIdx !== -1) {
          const nextSerials = [...row.serial_numbers];
          nextSerials[emptyIdx] = serialStr;
          return { ...row, serial_numbers: nextSerials };
        } else {
          return {
            ...row,
            qty: row.qty + 1,
            serial_numbers: [...row.serial_numbers, serialStr],
          };
        }
      })
    );
  };

  const selectSuggestedItemForBilling = (rowIdx: number, item: Item) => {
    updateBillingRow(rowIdx, {
      item_name: item.name,
      item_description: item.description || '',
      unit_price: item.selling_price,
      warranty_months: item.warranty_months,
      warranty_label: item.warranty_label,
      vat_rate: item.vat_rate !== undefined && item.vat_rate > 0 ? item.vat_rate : '',
    });
    setActiveItemSuggestRow(null);
  };

  const duplicateBillingRow = (idx: number) => {
    setBillingRows((prev) => {
      const source = prev[idx];
      if (!source) return prev;
      const used = collectUsedSerials(prev);
      const clean = String(source.item_name || '').trim();
      const inStock = clean
        ? items.find((it) => it.name.toLowerCase() === clean.toLowerCase() && Number(it.stock_qty || 0) > 0)
        : undefined;
      const freshSerials = Array.from({ length: Math.max(1, Number(source.qty || 1)) }, () =>
        clean && !inStock ? generateSerialCode(used, clean) : ''
      );
      const clone: BillingLineItemInput = {
        ...source,
        rowId: 'row_' + Math.random().toString(36).slice(2, 9),
        serial_numbers: freshSerials,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    showToast('Row duplicated');
  };

  const quickAddCatalogItem = (item: Item, switchToBilling = false) => {
    const existingIdx = billingRows.findIndex(
      (r) => String(r.item_name || '').trim().toLowerCase() === item.name.trim().toLowerCase()
    );
    if (existingIdx !== -1) {
      const nextQty = Math.min(100, Number(billingRows[existingIdx].qty || 1) + 1);
      updateBillingRow(existingIdx, { qty: nextQty });
      setQuickItemQuery('');
      setShowQuickCatalogDropdown(false);
      if (switchToBilling) setActiveTab('billing');
      showToast(`${item.name} — Qty updated to ${nextQty}`);
      return;
    }

    const emptyIdx = billingRows.findIndex((r) => !String(r.item_name || '').trim());
    if (emptyIdx !== -1) {
      selectSuggestedItemForBilling(emptyIdx, item);
    } else {
      const newRow: BillingLineItemInput = {
        ...createEmptyBillingRow(),
        item_name: item.name,
        item_description: item.description || '',
        unit_price: item.selling_price,
        warranty_months: item.warranty_months,
        warranty_label: item.warranty_label,
        vat_rate: item.vat_rate !== undefined && item.vat_rate > 0 ? item.vat_rate : '',
      };
      setBillingRows((prev) => [...prev, newRow]);
    }
    setQuickItemQuery('');
    setShowQuickCatalogDropdown(false);
    if (switchToBilling) setActiveTab('billing');
    showToast(`Added "${item.name}" to billing`);
  };

  const collectUsedSerials = (extraRows: Array<{ serial_numbers: string[] }>) => {
    const used = new Set<string>();
    availableSerials.forEach((s) => {
      if (s.serial_number) used.add(s.serial_number.trim());
    });
    extraRows.forEach((r) => {
      r.serial_numbers.forEach((sn) => {
        if (sn && sn.trim()) used.add(sn.trim());
      });
    });
    return used;
  };

  const autoGenBillingRowSerials = (rowIdx: number) => {
    const used = collectUsedSerials(billingRows);
    setBillingRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        const nextSerials = row.serial_numbers.map((sn) =>
          sn.trim() ? sn : generateSerialCode(used, row.item_name)
        );
        return { ...row, serial_numbers: nextSerials };
      })
    );
    showToast('Serial numbers auto-generated!');
  };

  const autoGenAllBillingSerials = () => {
    const used = collectUsedSerials(billingRows);
    let generatedCount = 0;
    setBillingRows((prev) =>
      prev.map((row) => {
        if (!String(row.item_name || '').trim()) return row;
        const nextSerials = row.serial_numbers.map((sn) => {
          if (sn.trim()) return sn;
          generatedCount++;
          return generateSerialCode(used, row.item_name);
        });
        return { ...row, serial_numbers: nextSerials };
      })
    );
    showToast(
      generatedCount > 0
        ? `Auto-generated ${generatedCount} serial number(s)!`
        : 'All item serial numbers are already filled.'
    );
  };

  const autoGenGrnRowSerials = (rowIdx: number) => {
    const used = collectUsedSerials(grnRows);
    setGrnRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        const nextSerials = row.serial_numbers.map((sn) =>
          sn.trim() ? sn : generateSerialCode(used, row.item_name)
        );
        return { ...row, serial_numbers: nextSerials };
      })
    );
    showToast('GRN serial numbers auto-generated!');
  };

  const autoGenAllGrnSerials = () => {
    const used = collectUsedSerials(grnRows);
    let generatedCount = 0;
    setGrnRows((prev) =>
      prev.map((row) => {
        if (!String(row.item_name || '').trim()) return row;
        const nextSerials = row.serial_numbers.map((sn) => {
          if (sn.trim()) return sn;
          generatedCount++;
          return generateSerialCode(used, row.item_name);
        });
        return { ...row, serial_numbers: nextSerials };
      })
    );
    showToast(
      generatedCount > 0
        ? `Auto-generated ${generatedCount} GRN serial number(s)!`
        : 'All GRN serial numbers are already filled.'
    );
  };

  // Compute Billing Totals with optional per-item VAT
  const subtotalBase = billingRows.reduce((acc, r) => {
    const base = Number(r.qty || 1) * Number(r.unit_price || 0) - Number(r.item_discount || 0);
    return acc + Math.max(0, base);
  }, 0);

  const totalVatAmount = billingRows.reduce((acc, r) => {
    const base = Number(r.qty || 1) * Number(r.unit_price || 0) - Number(r.item_discount || 0);
    const rate = Number(r.vat_rate || 0);
    return acc + (rate > 0 ? (Math.max(0, base) * rate) / 100 : 0);
  }, 0);

  const subtotal = subtotalBase;
  const grandTotal = Math.max(0, subtotalBase + totalVatAmount - Number(billDiscount || 0));
  const effectivePaid = billPaidAmount === '' ? grandTotal : Number(billPaidAmount || 0);
  const balanceDue = Math.max(0, grandTotal - effectivePaid);

  const submitQuotation = async (
    action: 'preview' | 'download' | 'print_and_download' | 'confirm' = 'print_and_download'
  ) => {
    const validRows = billingRows.filter((r) => String(r.item_name || '').trim() !== '');
    if (!validRows.length) {
      alert('කරුණාකර අවම වශයෙන් එක් Item එකක නමක් හෝ ඇතුළත් කරන්න.');
      return;
    }

    const res = await fetch('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingQuotationId,
        subject: billSubject.trim(),
        description: billDescription.trim(),
        customer_name: customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim(),
        discount: Number(billDiscount || 0),
        notes: billNotes.trim(),
        items: validRows,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to save quotation');
      return;
    }

    if (action === 'confirm') {
      showToast(`Quotation ${data.quote_no} confirmed & updated on Quotations page!`);
      await loadBootstrapData();
      resetBillingForm();
      setActiveTab('quotations');
      return;
    }

    if (action === 'print_and_download') {
      showToast(`Quotation ${data.quote_no} saved! Auto-downloading PDF & Opening Print...`);
    } else {
      showToast(`Quotation ${data.quote_no} saved & items auto-saved to DB!`);
    }
    await loadBootstrapData();
    resetBillingForm();

    const resBoot = await fetch('/api/bootstrap');
    const freshBoot: BootstrapResponse = await resBoot.json();
    const createdQ = freshBoot.quotations.find((q) => q.id === data.id);
    if (createdQ) {
      if (action === 'download') {
        downloadQuotationDirect(createdQ);
      } else if (action === 'preview') {
        openQuotationPreview(createdQ);
      } else {
        printAndDownloadQuotation(createdQ);
      }
    }
  };

  const submitInvoice = async () => {
    const validRows = billingRows.filter((r) => String(r.item_name || '').trim() !== '');
    if (!validRows.length) {
      alert('කරුණාකර අවම වශයෙන් එක් Item එකක නමක් හෝ ඇතුළත් කරන්න.');
      return;
    }

    const allConvertingIds =
      convertingQuotationIds.length > 0
        ? convertingQuotationIds
        : convertingQuotationId
        ? [convertingQuotationId]
        : [];

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotation_id: convertingQuotationId,
        quotation_ids: allConvertingIds,
        quote_no: convertingQuoteNo,
        subject: billSubject.trim(),
        description: billDescription.trim(),
        customer_name: customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim(),
        discount: Number(billDiscount || 0),
        paid_amount: billPaidAmount,
        payment_method: billPaymentMethod,
        cheque_no: billChequeNo.trim(),
        cheque_bank: billChequeBank.trim(),
        cheque_date:
          billPaymentMethod === 'Credit'
            ? billCreditDueDate.trim()
            : billChequeDate.trim(),
        credit_days: billPaymentMethod === 'Credit' ? billCreditDays.trim() : '',
        vehicle_no: billVehicleNo.trim(),
        notes: billNotes.trim(),
        items: validRows,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to create invoice');
      return;
    }

    showToast(`Invoice ${data.invoice_no} generated & stock updated!`);
    await loadBootstrapData();
    resetBillingForm();

    const resBoot = await fetch('/api/bootstrap');
    const freshBoot: BootstrapResponse = await resBoot.json();
    const createdInv = freshBoot.invoices.find((inv) => inv.id === data.id);
    if (createdInv) {
      openInvoicePreview(createdInv);
    }
  };

  // Load Quotation into Billing Editor to Confirm & Convert to Invoice
  const confirmQuotationToInvoice = (qt: Quotation) => {
    setEditingQuotationId(null);
    setConvertingQuotationId(qt.id);
    setConvertingQuotationIds([qt.id]);
    setConvertingQuoteNo(qt.quote_no);

    setBillSubject(qt.subject || '');
    setBillDescription(qt.description || '');
    setCustomerName(qt.customer_name || '');
    setCustomerPhone(qt.customer_phone || '');
    setCustomerAddress(qt.customer_address || '');
    setBillDiscount(String(qt.discount || 0));
    setBillNotes(qt.notes || '');
    setBillPaidAmount('');

    const loadedRows: BillingLineItemInput[] = (qt.items || []).map((it) => {
      const qty = Math.max(1, Number(it.qty || 1));
      const existingSerials = Array.isArray(it.serial_numbers) ? it.serial_numbers : [];
      const paddedSerials: string[] = [];
      for (let i = 0; i < qty; i++) {
        paddedSerials.push(existingSerials[i] || '');
      }
      return {
        rowId: 'row_' + Math.random().toString(36).slice(2, 9),
        item_name: it.item_name,
        item_description: it.item_description || '',
        warranty_months: it.warranty_months,
        warranty_label: it.warranty_label,
        qty,
        serial_numbers: paddedSerials,
        unit_price: it.unit_price,
        item_discount: it.item_discount || 0,
        vat_rate: it.vat_rate !== undefined && it.vat_rate !== null ? it.vat_rate : '',
        vat_amount: it.vat_amount || 0,
      };
    });

    setBillingRows(loadedRows.length ? loadedRows : [createEmptyBillingRow()]);
    setBillingMode('INVOICE');
    setActiveTab('billing');
    showToast(`Quotation #${qt.quote_no} loaded! Serial Numbers පරීක්ෂා කර Confirm ඔබන්න.`);
  };

  // Combine Multiple Selected Quotations into a Single Invoice
  const combineSelectedQuotationsToInvoice = () => {
    const selectedQuotes = quotations.filter((q) => selectedQuoteIds.includes(q.id));
    if (!selectedQuotes.length) {
      alert('කරුණාකර අවම වශයෙන් එක් Quotation එකක්වත් තෝරන්න.');
      return;
    }

    setEditingQuotationId(null);
    setConvertingQuotationId(null);
    setConvertingQuotationIds(selectedQuotes.map((q) => q.id));

    const quoteNos = selectedQuotes.map((q) => q.quote_no).join(', ');
    setConvertingQuoteNo(quoteNos);

    // Pick customer from the first quote with a valid name
    const custQuote = selectedQuotes.find((q) => String(q.customer_name || '').trim()) || selectedQuotes[0];
    setCustomerName(custQuote?.customer_name || '');
    setCustomerPhone(custQuote?.customer_phone || '');
    setCustomerAddress(custQuote?.customer_address || '');

    setBillSubject(`Combined Quotations (${quoteNos})`);

    const mergedDesc = selectedQuotes
      .map((q) => {
        const text = [q.subject, q.description].filter(Boolean).join(' - ').trim();
        return text ? `[${q.quote_no}] ${text}` : '';
      })
      .filter(Boolean)
      .join(' | ');
    setBillDescription(mergedDesc);

    const totalDiscount = selectedQuotes.reduce((acc, q) => acc + Number(q.discount || 0), 0);
    setBillDiscount(String(totalDiscount));

    const mergedNotes = selectedQuotes
      .map((q) => (q.notes ? `[${q.quote_no}] ${q.notes}` : ''))
      .filter(Boolean)
      .join('\n');
    setBillNotes(mergedNotes);

    setBillPaidAmount('');

    // Combine all line items from all selected quotations
    const combinedRows: BillingLineItemInput[] = [];
    for (const qt of selectedQuotes) {
      for (const it of qt.items || []) {
        const qty = Math.max(1, Number(it.qty || 1));
        const existingSerials = Array.isArray(it.serial_numbers) ? it.serial_numbers : [];
        const paddedSerials: string[] = [];
        for (let i = 0; i < qty; i++) {
          paddedSerials.push(existingSerials[i] || '');
        }
        combinedRows.push({
          rowId: 'row_' + Math.random().toString(36).slice(2, 9),
          item_name: it.item_name,
          item_description: it.item_description
            ? `[${qt.quote_no}] ${it.item_description}`
            : `[${qt.quote_no}]`,
          warranty_months: it.warranty_months,
          warranty_label: it.warranty_label,
          qty,
          serial_numbers: paddedSerials,
          unit_price: it.unit_price,
          item_discount: it.item_discount || 0,
          vat_rate: it.vat_rate !== undefined && it.vat_rate !== null ? it.vat_rate : '',
          vat_amount: it.vat_amount || 0,
        });
      }
    }

    setBillingRows(combinedRows.length ? combinedRows : [createEmptyBillingRow()]);
    setBillingMode('INVOICE');
    setActiveTab('billing');
    showToast(`තෝරාගත් Quotations ${selectedQuotes.length} (${quoteNos}) එකතු කර Invoice එකට සූදානම් කරන ලදී!`);
  };

  const editQuotation = (qt: Quotation) => {
    setEditingQuotationId(qt.id);
    setConvertingQuotationId(null);
    setConvertingQuotationIds([]);
    setConvertingQuoteNo('');

    setBillSubject(qt.subject || '');
    setBillDescription(qt.description || '');
    setCustomerName(qt.customer_name || '');
    setCustomerPhone(qt.customer_phone || '');
    setCustomerAddress(qt.customer_address || '');
    setBillDiscount(String(qt.discount || 0));
    setBillNotes(qt.notes || '');

    const loadedRows: BillingLineItemInput[] = (qt.items || []).map((it) => {
      const qty = Math.max(1, Number(it.qty || 1));
      const existingSerials = Array.isArray(it.serial_numbers) ? it.serial_numbers : [];
      const paddedSerials: string[] = [];
      for (let i = 0; i < qty; i++) {
        paddedSerials.push(existingSerials[i] || '');
      }
      return {
        rowId: 'row_' + Math.random().toString(36).slice(2, 9),
        item_name: it.item_name,
        item_description: it.item_description || '',
        warranty_months: it.warranty_months,
        warranty_label: it.warranty_label,
        qty,
        serial_numbers: paddedSerials,
        unit_price: it.unit_price,
        item_discount: it.item_discount || 0,
        vat_rate: it.vat_rate !== undefined && it.vat_rate !== null ? it.vat_rate : '',
        vat_amount: it.vat_amount || 0,
      };
    });

    setBillingRows(loadedRows.length ? loadedRows : [createEmptyBillingRow()]);
    setBillingMode('QUOTATION');
    setActiveTab('billing');
  };

  const duplicateQuotation = (qt: Quotation) => {
    editQuotation(qt);
    setEditingQuotationId(null);
    showToast(`Cloned ${qt.quote_no} into a new draft quotation!`);
  };

  const settleInvoiceBalance = (inv: Invoice) => {
    setPaymentTarget({
      kind: 'INVOICE',
      id: inv.id,
      docNo: inv.invoice_no,
      partyName: inv.customer_name || 'Walk-in Customer',
      totalAmount: Number(inv.grand_total || 0),
      paidAmount: Number(inv.paid_amount || 0),
      balanceDue: Number(inv.balance_due || 0),
    });
  };

  // ==========================================================================
  // GRN HANDLERS
  // ==========================================================================

  const resetGrnForm = () => {
    setGrnSupplierName('');
    setGrnSupplierPhone('');
    setGrnRefNo('');
    setGrnPaidAmount('');
    setGrnPaymentMethod('Cash');
    setGrnChequeNo('');
    setGrnChequeBank('');
    setGrnChequeDate('');
    setGrnChequeReminderDate('');
    setGrnCreditDays('30');
    setGrnCreditDueDate('');
    setGrnPaymentRef('');
    setGrnNotes('');
    setGrnRows([createEmptyGrnRow()]);
  };

  const updateGrnRow = (idx: number, patch: Partial<GRNLineItemInput>) => {
    setGrnRows((prev) => {
      const used = collectUsedSerials(prev);
      return prev.map((row, i) => {
        if (i !== idx) return row;
        const updated = { ...row, ...patch };
        const safeQty =
          patch.qty !== undefined
            ? Math.max(1, Math.min(100, Number(patch.qty) || 1))
            : Math.max(1, Number(updated.qty || 1));
        updated.qty = safeQty;
        const hasName = String(updated.item_name || '').trim() !== '';
        if (patch.qty !== undefined || (hasName && patch.buying_price !== undefined)) {
          const nextSerials: string[] = [];
          for (let s = 0; s < safeQty; s++) {
            const existing = row.serial_numbers[s] || '';
            nextSerials.push(
              existing || (hasName ? generateSerialCode(used, updated.item_name) : '')
            );
          }
          updated.serial_numbers = nextSerials;
        }
        return updated;
      });
    });
  };

  const updateGrnRowSerial = (rowIdx: number, snIdx: number, val: string) => {
    setGrnRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        const nextSerials = [...row.serial_numbers];
        nextSerials[snIdx] = val;
        return { ...row, serial_numbers: nextSerials };
      })
    );
  };

  const submitGrn = async () => {
    const validRows = grnRows.filter((r) => String(r.item_name || '').trim() !== '');
    if (!validRows.length) {
      alert('GRN එකට අවම වශයෙන් එක් Item එකක්වත් ඇතුළත් කරන්න.');
      return;
    }

    const resolvedGrnDueDate =
      grnPaymentMethod === 'Credit' ? grnCreditDueDate.trim() : grnChequeDate;
    const resolvedGrnReminder =
      grnPaymentMethod === 'Credit'
        ? grnChequeReminderDate || grnCreditDueDate.trim()
        : grnChequeReminderDate;
    const resolvedGrnPayRef =
      grnPaymentRef.trim() ||
      (grnPaymentMethod === 'Credit' && (grnCreditDays.trim() || grnCreditDueDate.trim())
        ? `Credit: ${[
            grnCreditDays.trim() ? `${grnCreditDays.trim()} Days` : '',
            grnCreditDueDate.trim() ? `Due: ${grnCreditDueDate.trim()}` : '',
          ]
            .filter(Boolean)
            .join(' | ')}`
        : '');

    const res = await fetch('/api/grns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplier_name: grnSupplierName.trim() || 'General Supplier',
        supplier_phone: grnSupplierPhone.trim(),
        ref_no: grnRefNo.trim(),
        paid_amount: grnPaidAmount,
        payment_method: grnPaymentMethod,
        cheque_no: grnChequeNo.trim(),
        cheque_bank: grnChequeBank.trim(),
        cheque_date: resolvedGrnDueDate,
        cheque_reminder_date: resolvedGrnReminder,
        payment_ref: resolvedGrnPayRef,
        notes: grnNotes.trim(),
        items: validRows,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to save GRN');
      return;
    }

    showToast(`GRN ${data.grn_no} saved & stock updated!`);
    await loadBootstrapData();
    resetGrnForm();
  };

  const payGrnSupplier = (grn: GRN) => {
    const remaining = Math.max(0, Number(grn.total_amount || 0) - Number(grn.paid_amount || 0));
    if (remaining <= 0) return;
    setPaymentTarget({
      kind: 'GRN',
      id: grn.id,
      docNo: grn.grn_no,
      partyName: grn.supplier_name || 'Supplier',
      totalAmount: Number(grn.total_amount || 0),
      paidAmount: Number(grn.paid_amount || 0),
      balanceDue: remaining,
    });
  };

  const handlePaymentSettlementSubmit = async (target: PaymentTargetInfo, amount: number) => {
    const url = target.kind === 'INVOICE' ? '/api/invoices/pay' : '/api/grns/pay';
    const payload =
      target.kind === 'INVOICE'
        ? { invoice_id: target.id, amount }
        : { grn_id: target.id, amount };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to record payment');
      return;
    }

    setPaymentTarget(null);
    showToast(
      target.kind === 'INVOICE'
        ? `Payment recorded for ${target.docNo}!`
        : `Supplier payment recorded for ${target.docNo}!`
    );
    await loadBootstrapData();
  };

  // ==========================================================================
  // PRINT & PDF HELPERS & FORMATTING
  // ==========================================================================

  const buildQuotationDoc = (qt: Quotation): PrintDocumentData => {
    const now = new Date();
    return {
      docType: 'QUOTATION',
      docNo: qt.quote_no,
      subject: qt.subject || '',
      description: qt.description || '',
      date: qt.created_at ? qt.created_at.split(' ')[0] : now.toLocaleDateString('en-GB'),
      time: qt.created_at && qt.created_at.split(' ')[1] ? qt.created_at.split(' ')[1] : now.toTimeString().split(' ')[0],
      customerId: qt.customer_id,
      customerName: qt.customer_name,
      customerPhone: qt.customer_phone,
      customerAddress: qt.customer_address,
      items: qt.items || [],
      subtotal: qt.subtotal,
      discount: qt.discount,
      grandTotal: qt.grand_total,
      notes: qt.notes,
      extraConvertId: qt.status === 'PENDING' ? qt.id : null,
      cashierName: settings.cashier_name || 'manohari',
      repName: settings.rep_name || 'Waruna Jayathilaka',
      branchLocation: settings.branch_location || 'SHOP - KURUNEGALA 200',
      vatRegNo: settings.vat_reg_no || '',
      customerPoNo: '',
      dispatchVehicleNo: '',
      footerCopyLabel: settings.footer_copy_label || "CUSTOMER'S COPY",
      stampType: 'NONE',
      layoutStyle: (settings.invoice_layout_style as 'POS80' | 'STC_OFFICIAL' | 'MODERN') || 'MODERN',
      paperSize: 'A4',
      vatRatePercent: settings.vat_rate_percent || '18',
    };
  };

  const buildInvoiceDoc = (inv: Invoice): PrintDocumentData => {
    const now = new Date();
    return {
      docType: 'INVOICE',
      docNo: inv.invoice_no,
      refQuoteNo: inv.quote_no,
      subject: inv.subject || '',
      description: inv.description || '',
      date: inv.created_at ? inv.created_at.split(' ')[0] : now.toLocaleDateString('en-GB'),
      time: inv.created_at && inv.created_at.split(' ')[1] ? inv.created_at.split(' ')[1] : now.toTimeString().split(' ')[0],
      customerId: inv.customer_id,
      customerName: inv.customer_name,
      customerPhone: inv.customer_phone,
      customerAddress: inv.customer_address,
      items: inv.items || [],
      subtotal: inv.subtotal,
      discount: inv.discount,
      grandTotal: inv.grand_total,
      paidAmount: inv.paid_amount,
      balanceDue: inv.balance_due,
      paymentMethod: inv.payment_method,
      chequeNo: inv.cheque_no || '',
      chequeBank: inv.cheque_bank || '',
      chequeDate: inv.cheque_date || '',
      paymentRef: inv.payment_ref || '',
      notes: inv.notes,
      cashierName: settings.cashier_name || 'manohari',
      repName: settings.rep_name || 'Waruna Jayathilaka',
      branchLocation: settings.branch_location || 'SHOP - KURUNEGALA 200',
      vatRegNo: settings.vat_reg_no || '',
      customerPoNo: '',
      dispatchVehicleNo: inv.vehicle_no || '',
      footerCopyLabel: settings.footer_copy_label || "CUSTOMER'S COPY",
      stampType: inv.balance_due > 0 ? 'CREDIT' : 'CASH',
      layoutStyle: (settings.invoice_layout_style as 'POS80' | 'STC_OFFICIAL' | 'MODERN') || 'MODERN',
      paperSize: 'A4',
      vatRatePercent: settings.vat_rate_percent || '18',
    };
  };

  const openQuotationPreview = (qt: Quotation) => {
    setPrintDoc(buildQuotationDoc(qt));
  };

  const openInvoicePreview = (inv: Invoice) => {
    setPrintDoc(buildInvoiceDoc(inv));
  };

  // Direct High-Resolution PDF Download Generator
  const downloadCurrentDocumentPDF = async (
    docOverride?: PrintDocumentData,
    elementId = 'actualPrintDocument'
  ) => {
    const doc = docOverride || printDoc;
    if (!doc) return;

    setIsDownloadingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      // Wait briefly if the element is still committing to the DOM
      let element = document.getElementById(elementId);
      for (let attempt = 0; !element && attempt < 6; attempt++) {
        await new Promise((res) => setTimeout(res, 60));
        element = document.getElementById(elementId);
      }

      if (!element) {
        alert('Document not ready for download. Please click Download PDF again.');
        return;
      }

      const isPOS80 = doc.layoutStyle === 'POS80';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: isPOS80 ? 400 : 1200,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc, clonedEl) => {
          if (clonedEl.parentElement?.dataset.offscreenContainer === 'true') {
            clonedEl.parentElement.style.left = '0px';
            clonedEl.parentElement.style.zIndex = '1';
          }
          sanitizeClonedDocumentColors(clonedDoc, clonedEl);
        },
      });

      const cleanDocNo = (doc.docNo || 'DOC').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${doc.docType === 'QUOTATION' ? 'Quotation' : 'Invoice'}_${cleanDocNo}.pdf`;

      if (isPOS80) {
        const mmWidth = 80;
        const mmHeight = Math.max(80, (canvas.height * mmWidth) / canvas.width);
        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: [mmWidth, mmHeight + 6],
        });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 3, mmWidth, mmHeight, undefined, 'FAST');
        pdf.save(filename);
      } else if (doc.paperSize === 'HALF_A4') {
        const pageWidth = 241; // 241mm (9.5 inches)
        const pageHeight = 139.5; // 139.5mm (5.5 inches)
        const pdf = new jsPDF({
          orientation: 'l',
          unit: 'mm',
          format: [pageWidth, pageHeight],
        });
        const marginTop = 4;
        const marginBottom = 4;
        const marginLeft = 8;
        const marginRight = 6;
        const printWidth = pageWidth - marginLeft - marginRight;
        const maxPrintHeight = pageHeight - marginTop - marginBottom;
        const rawHeight = (canvas.height * printWidth) / canvas.width;

        if (rawHeight <= maxPrintHeight + 1) {
          // Fits directly on 1 Half A4 page
          const imgData = canvas.toDataURL('image/png');
          const finalHeight = Math.min(rawHeight, maxPrintHeight);
          pdf.addImage(imgData, 'PNG', marginLeft, marginTop, printWidth, finalHeight, undefined, 'FAST');
        } else {
          // Automatically paginate across multiple Half A4 (241mm x 139.5mm) pages
          const pxPerMm = canvas.width / printWidth;
          const pageSliceHeightPx = Math.floor(maxPrintHeight * pxPerMm);
          let renderedPx = 0;
          let pageIndex = 0;

          while (renderedPx < canvas.height) {
            const sliceHeightPx = Math.min(pageSliceHeightPx, canvas.height - renderedPx);
            if (sliceHeightPx <= 2) break;

            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = sliceHeightPx;
            const ctx = pageCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
              ctx.drawImage(
                canvas,
                0,
                renderedPx,
                canvas.width,
                sliceHeightPx,
                0,
                0,
                canvas.width,
                sliceHeightPx
              );
            }

            if (pageIndex > 0) {
              pdf.addPage([pageWidth, pageHeight], 'l');
            }

            const sliceHeightMm = sliceHeightPx / pxPerMm;
            const pageImgData = pageCanvas.toDataURL('image/png');
            pdf.addImage(pageImgData, 'PNG', marginLeft, marginTop, printWidth, sliceHeightMm, undefined, 'FAST');

            renderedPx += sliceHeightPx;
            pageIndex += 1;
          }
        }

        pdf.save(filename);
      } else {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 8;
        const printWidth = pageWidth - margin * 2;
        const maxSinglePageHeight = pageHeight - margin * 2;
        const printHeight = (canvas.height * printWidth) / canvas.width;

        if (printHeight <= maxSinglePageHeight + 1) {
          // Fits directly on 1 A4 page with neat margins
          const imgData = canvas.toDataURL('image/png');
          const finalHeight = Math.min(printHeight, maxSinglePageHeight);
          pdf.addImage(imgData, 'PNG', margin, margin, printWidth, finalHeight, undefined, 'FAST');
        } else {
          // Automatically paginate across multiple A4 pages with clean margins
          const pxPerMm = canvas.width / printWidth;
          const pageSliceHeightPx = Math.floor(maxSinglePageHeight * pxPerMm);
          let renderedPx = 0;
          let pageIndex = 0;

          while (renderedPx < canvas.height) {
            const sliceHeightPx = Math.min(pageSliceHeightPx, canvas.height - renderedPx);
            if (sliceHeightPx <= 2) break;

            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = sliceHeightPx;
            const ctx = pageCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
              ctx.drawImage(
                canvas,
                0,
                renderedPx,
                canvas.width,
                sliceHeightPx,
                0,
                0,
                canvas.width,
                sliceHeightPx
              );
            }

            if (pageIndex > 0) {
              pdf.addPage();
            }

            const sliceHeightMm = sliceHeightPx / pxPerMm;
            const pageImgData = pageCanvas.toDataURL('image/png');
            pdf.addImage(pageImgData, 'PNG', margin, margin, printWidth, sliceHeightMm, undefined, 'FAST');

            renderedPx += sliceHeightPx;
            pageIndex += 1;
          }
        }

        pdf.save(filename);
      }

      showToast(`📄 ${filename} සාර්ථකව Download විය!`);
    } catch (err: unknown) {
      console.error('PDF download error:', err);
      alert('PDF generation failed. කරුණාකර "Print / Save PDF" බටන් එකෙන් Save as PDF තෝරන්න.');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const downloadDocumentDirect = async (
    doc: PrintDocumentData,
    opts?: { quoteId?: number; invoiceId?: number }
  ) => {
    if (isDownloadingPDF) return;
    if (opts?.quoteId !== undefined) setDownloadingQuoteId(opts.quoteId);
    if (opts?.invoiceId !== undefined) setDownloadingInvoiceId(opts.invoiceId);
    setOffscreenPdfDoc(doc);

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );

    try {
      await downloadCurrentDocumentPDF(doc, 'offscreenPrintDocument');
    } finally {
      setOffscreenPdfDoc(null);
      setDownloadingQuoteId(null);
      setDownloadingInvoiceId(null);
    }
  };

  const downloadQuotationDirect = (qt: Quotation) => {
    const doc = buildQuotationDoc(qt);
    void downloadDocumentDirect(doc, { quoteId: qt.id });
  };

  const printAndDownloadQuotation = async (qt: Quotation) => {
    const doc = buildQuotationDoc(qt);
    setPrintDoc(doc);
    // Allow React time to render the modal into DOM
    await new Promise((res) => setTimeout(res, 450));
    try {
      await downloadCurrentDocumentPDF(doc);
    } catch (err) {
      console.error('PDF auto-download failed:', err);
    }
    // Small delay after PDF generation to ensure download stream starts before modal print dialog
    setTimeout(() => {
      window.print();
    }, 600);
  };

  const downloadInvoiceDirect = (inv: Invoice) => {
    const doc = buildInvoiceDoc(inv);
    void downloadDocumentDirect(doc, { invoiceId: inv.id });
  };

  const saveQuickCustomizerToDefaults = async () => {
    if (!printDoc) return;
    const newSettings: ShopSettings = {
      ...settings,
      cashier_name: printDoc.cashierName,
      rep_name: printDoc.repName,
      branch_location: printDoc.branchLocation,
      vat_reg_no: printDoc.vatRegNo,
      footer_copy_label: printDoc.footerCopyLabel,
      invoice_layout_style: printDoc.layoutStyle,
      vat_rate_percent: printDoc.vatRatePercent,
    };
    setSettings(newSettings);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    });
    showToast('Invoice preferences saved as default settings!');
  };

  // ==========================================================================
  // ITEM MODAL & SETTINGS HANDLERS
  // ==========================================================================

  const openItemModal = (item?: Item) => {
    if (item) {
      setEditItemId(item.id);
      setEditItemName(item.name);
      setEditItemDescription(item.description || '');
      setEditItemBuying(String(item.buying_price));
      setEditItemSelling(String(item.selling_price));
      setEditItemWarrantyMonths(Number(item.warranty_months ?? 12));
      setEditItemWarrantyLabel(item.warranty_label || '1 Year');
      setEditItemVatRate(item.vat_rate ? String(item.vat_rate) : '');
      setEditItemStock(String(item.stock_qty));
    } else {
      setEditItemId(null);
      setEditItemName('');
      setEditItemDescription('');
      setEditItemBuying('');
      setEditItemSelling('');
      setEditItemWarrantyMonths(12);
      setEditItemWarrantyLabel('1 Year');
      setEditItemVatRate('');
      setEditItemStock('0');
    }
    setItemModalOpen(true);
  };

  const saveItemModal = async () => {
    if (!editItemName.trim()) {
      alert('Item name is required');
      return;
    }
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editItemId,
        name: editItemName.trim(),
        description: editItemDescription.trim(),
        buying_price: Number(editItemBuying || 0),
        selling_price: Number(editItemSelling || 0),
        warranty_months: Number(editItemWarrantyMonths || 0),
        warranty_label: editItemWarrantyLabel || 'No Warranty',
        vat_rate: Number(editItemVatRate || 0),
        stock_qty: Number(editItemStock || 0),
      }),
    });
    if (res.ok) {
      setItemModalOpen(false);
      showToast('Item saved!');
      await loadBootstrapData();
    }
  };

  const saveSettings = async () => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      showToast('Shop & Invoice settings saved successfully!');
      await loadBootstrapData();
    } else {
      const errData = await res.json().catch(() => ({}));
      alert(errData.error || 'Failed to save settings');
    }
  };

  const handleLogoFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rawUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawUrl) return;
      const img = new Image();
      img.onload = () => {
        const maxDim = 420;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const optimized = canvas.toDataURL('image/png');
          setSettings((prev) => ({ ...prev, shop_logo: optimized }));
          showToast('Logo loaded! Click "Save All Settings" to apply.');
          return;
        }
        setSettings((prev) => ({ ...prev, shop_logo: rawUrl }));
        showToast('Logo loaded! Click "Save All Settings" to apply.');
      };
      img.onerror = () => {
        setSettings((prev) => ({ ...prev, shop_logo: rawUrl }));
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleWatermarkFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rawUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawUrl) return;
      const img = new Image();
      img.onload = () => {
        const maxDim = 720;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const optimized = canvas.toDataURL('image/png');
          setSettings((prev) => ({ ...prev, watermark_image: optimized, watermark_mode: 'CUSTOM_IMAGE' }));
          showToast('Watermark image loaded! Click "Save All Settings" to apply.');
          return;
        }
        setSettings((prev) => ({ ...prev, watermark_image: rawUrl, watermark_mode: 'CUSTOM_IMAGE' }));
        showToast('Watermark image loaded! Click "Save All Settings" to apply.');
      };
      img.onerror = () => {
        setSettings((prev) => ({ ...prev, watermark_image: rawUrl, watermark_mode: 'CUSTOM_IMAGE' }));
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  };

  const dueInvoicesCount = invoices.filter((inv) => Number(inv.balance_due || 0) > 0).length;

  const navItems: {
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
    badgeTone?: 'amber' | 'rose';
  }[] = [
    { id: 'billing', label: 'New Quote / Invoice', shortLabel: 'POS Billing', icon: <FilePlus2 className="w-4 h-4 shrink-0" /> },
    {
      id: 'quotations',
      label: 'Quotations',
      shortLabel: 'Quotations',
      icon: <ClipboardList className="w-4 h-4 shrink-0" />,
      badge: stats.pendingQuotesCount,
      badgeTone: 'amber',
    },
    {
      id: 'invoices',
      label: 'Invoices',
      shortLabel: 'Invoices',
      icon: <Receipt className="w-4 h-4 shrink-0" />,
      badge: dueInvoicesCount,
      badgeTone: 'rose',
    },
    { id: 'reports', label: 'Sales Reports', shortLabel: 'Reports', icon: <BarChart3 className="w-4 h-4 shrink-0" /> },
    { id: 'grn', label: 'GRN (Stock In)', shortLabel: 'GRN', icon: <PackagePlus className="w-4 h-4 shrink-0" /> },
    { id: 'warranty', label: 'Warranty / S/N Check', shortLabel: 'Warranty', icon: <ShieldCheck className="w-4 h-4 shrink-0" /> },
    {
      id: 'inventory',
      label: 'Items & Stock',
      shortLabel: 'Inventory',
      icon: <Boxes className="w-4 h-4 shrink-0" />,
      badge: stats.lowStockCount,
      badgeTone: 'rose',
    },
    { id: 'settings', label: 'Invoice Settings', shortLabel: 'Settings', icon: <Settings className="w-4 h-4 shrink-0" /> },
  ];

  const activeNavTitle = navItems.find((n) => n.id === activeTab)?.label || 'POS Billing';

  return (
    <div className="min-h-screen flex bg-[#f4f6fb] text-slate-900 print:block print:min-h-0 print:bg-white">
      {/* Mobile Sidebar Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-40 lg:hidden no-print"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Left Midnight-Slate SaaS Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-30 h-screen bg-slate-950 text-slate-200 border-r border-slate-800/80 flex flex-col justify-between transition-all duration-200 no-print ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Brand Header */}
          <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 text-white flex items-center justify-center font-extrabold text-sm shadow-lg shadow-indigo-950/50 shrink-0">
                <Store className="w-4 h-4" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white truncate leading-tight tracking-tight">
                    Smart POS System
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {settings.branch_location || 'Main Branch'}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Command Trigger inside Sidebar */}
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              title="Quick Search & Jump (Ctrl+K)"
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition ${
                sidebarCollapsed ? 'justify-center px-2' : ''
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Search className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Quick Search...</span>}
              </span>
              {!sidebarCollapsed && (
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono border border-slate-700">
                  Ctrl+K
                </kbd>
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {!sidebarCollapsed && (
              <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Workspace
              </div>
            )}
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-950/50'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900/90'
                  } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </span>
                  {!sidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 text-[11px] rounded-full font-bold tabular-nums ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : item.badgeTone === 'rose'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-slate-800/80 shrink-0 space-y-2">
            {!sidebarCollapsed && (
              <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-100 truncate">
                    {settings.shop_name || 'Smart POS System'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {currentUser ? `${currentUser.display_name} (@${currentUser.username})` : `Cashier: ${settings.cashier_name || 'Staff'}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
                  title="Refresh Database Data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-bold transition ${
                sidebarCollapsed ? 'justify-center px-2' : 'justify-center'
              }`}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!sidebarCollapsed && <span>Sign Out (Logout)</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Column (Top Utility Bar + Content) */}
      <div className="flex-1 flex flex-col min-w-0 no-print">
        {/* Slim Top Utility Bar */}
        <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-slate-200/80 no-print">
          <div className="px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                aria-label="Open menu"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight truncate">
                  {activeNavTitle}
                </h1>
                <p className="text-[11px] text-slate-500 hidden sm:block truncate">
                  {settings.shop_name || 'Smart POS System'} • Fast Quotation, Invoice, GRN &amp; Multi-Serial Warranty
                </p>
              </div>
            </div>

            {/* Search Trigger + Clickable Live KPI Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 text-slate-600 transition"
                title="Open Quick Search & Jump (Ctrl+K)"
              >
                <Command className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-medium">Quick Jump</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white text-slate-500 text-[10px] font-mono border border-slate-200">
                  Ctrl+K
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/90 transition"
                title="View Today's Sales Report"
              >
                <span className="text-slate-500 font-medium">Today</span>
                <span className="font-extrabold text-slate-900 tabular-nums">{fmtMoney(stats.todaySalesTotal)}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterQuotationStatus('PENDING');
                  setActiveTab('quotations');
                }}
                className="flex items-center gap-1.5 bg-amber-50/90 hover:bg-amber-100/80 px-3 py-1.5 rounded-xl border border-amber-200/80 transition"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-amber-800 font-medium">Pending</span>
                <span className="font-extrabold text-amber-950 tabular-nums">{stats.pendingQuotesCount}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterInvoiceStatus('DUE');
                  setActiveTab('invoices');
                }}
                className="flex items-center gap-1.5 bg-rose-50/90 hover:bg-rose-100/80 px-3 py-1.5 rounded-xl border border-rose-200/80 transition"
              >
                <span className="text-rose-800 font-medium">Due</span>
                <span className="font-extrabold text-rose-700 tabular-nums">{fmtMoney(stats.totalBalanceDue)}</span>
              </button>

              {stats.lowStockCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setFilterInventoryStatus('LOW');
                    setActiveTab('inventory');
                  }}
                  className="hidden sm:flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-xl border border-orange-200 transition"
                  title="View low stock items"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                  <span className="text-orange-800 font-medium">Low Stock</span>
                  <span className="font-extrabold text-orange-900 tabular-nums">{stats.lowStockCount}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setFilterInventoryStatus('ALL');
                    setActiveTab('inventory');
                  }}
                  className="hidden sm:flex items-center gap-1.5 bg-emerald-50/80 hover:bg-emerald-100/70 px-3 py-1.5 rounded-xl border border-emerald-200/80 transition"
                >
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-800 font-medium">Catalog</span>
                  <span className="font-extrabold text-emerald-900 tabular-nums">{items.length}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 lg:px-6 py-5 no-print">
        {/* ================================================================ */}
        {/* TAB 1: BILLING (QUOTATION / INVOICE) - MODERN 2-COLUMN POS       */}
        {/* ================================================================ */}
        {activeTab === 'billing' && (() => {
          const totalCartUnits = billingRows.reduce((acc, r) => acc + Number(r.qty || 1), 0);
          const filledItemCount = billingRows.filter((r) => String(r.item_name || '').trim()).length;
          const quickCatalogMatches = items
            .filter((it) => {
              const q = quickItemQuery.trim().toLowerCase();
              return !q || it.name.toLowerCase().includes(q) || (it.description || '').toLowerCase().includes(q);
            })
            .slice(0, 8);
          const isScopeVisible = showScopeBox || Boolean(billDescription.trim());

          return (
            <section
              ref={billingSplitRef}
              style={{ '--billing-left-w': `${billingLeftPct}%` } as React.CSSProperties}
              className={`flex flex-col ${billingStacked ? 'gap-5' : 'xl:flex-row gap-5 xl:gap-0'} items-start`}
            >
              {/* LEFT WORKSPACE: MODE, QUICK ADD, CUSTOMER & LINE ITEMS */}
              <div
                className={`w-full ${
                  billingStacked ? '' : 'xl:w-[var(--billing-left-w)] xl:shrink-0'
                } space-y-4 min-w-0`}
              >
                {/* Top Action & Mode Bar */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setBillingMode('QUOTATION')}
                        title="Shortcut: Alt+Q"
                        className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                          billingMode === 'QUOTATION'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <ClipboardList className="w-4 h-4" />
                        <span>1. Quotation (මිල ගණන්)</span>
                        <kbd className={`hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-mono ${billingMode === 'QUOTATION' ? 'bg-amber-600/70 text-amber-50' : 'bg-white text-slate-400 border border-slate-200'}`}>
                          Alt+Q
                        </kbd>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingMode('INVOICE')}
                        title="Shortcut: Alt+I"
                        className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                          billingMode === 'INVOICE'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Receipt className="w-4 h-4" />
                        <span>2. Direct Invoice (සෘජු බිල්පත)</span>
                        <kbd className={`hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-mono ${billingMode === 'INVOICE' ? 'bg-indigo-700/80 text-indigo-100' : 'bg-white text-slate-400 border border-slate-200'}`}>
                          Alt+I
                        </kbd>
                      </button>
                    </div>

                    {(convertingQuotationId || convertingQuotationIds.length > 0 || editingQuotationId) && (
                      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-900 px-3 py-1.5 rounded-xl text-xs font-semibold">
                        <span>
                          {convertingQuotationIds.length > 1
                            ? `Confirming ${convertingQuotationIds.length} Quotations (${convertingQuoteNo}) → Invoice`
                            : convertingQuotationId || convertingQuotationIds.length === 1
                            ? `Confirming Quote #${convertingQuoteNo} → Invoice`
                            : `Editing Quote #${editingQuotationId}`}
                        </span>
                        <button
                          type="button"
                          onClick={resetBillingForm}
                          className="ml-1 text-[11px] bg-white px-2 py-0.5 rounded-md border border-indigo-200 text-rose-600 hover:bg-rose-50 font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Adjustable Split Presets (Desktop xl+) */}
                    <div
                      className="hidden xl:inline-flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-[11px] font-semibold"
                      title="Adjust Cart / Summary Split Width (or drag the divider)"
                    >
                      {[60, 68, 75].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setBillingStacked(false);
                            setBillingLeftPct(pct);
                          }}
                          className={`px-2 py-1 rounded-lg transition ${
                            !billingStacked && billingLeftPct === pct
                              ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {pct}/{100 - pct}
                        </button>
                      ))}
                      {!billingStacked && ![60, 68, 75].includes(billingLeftPct) && (
                        <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold">
                          {billingLeftPct}/{100 - billingLeftPct}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setBillingStacked((v) => !v)}
                        className={`px-2 py-1 rounded-lg transition inline-flex items-center gap-1 ${
                          billingStacked
                            ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="Full Width Cart (Stack Summary Below)"
                      >
                        <Rows2 className="w-3 h-3" />
                        <span>Stack</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={resetBillingForm}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clear / New</span>
                    </button>
                  </div>
                </div>

                {/* Customer & Document Info Card */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-4 space-y-3">
                  {/* Fast Customer Quick-Pick Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                        Quick Customer:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerName('Walk-in Customer');
                          setCustomerPhone('');
                          setCustomerAddress('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-semibold transition border border-slate-200/80"
                      >
                        Walk-in
                      </button>
                      {customers.slice(0, 5).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCustomerName(c.name);
                            setCustomerPhone(c.phone || '');
                            setCustomerAddress(c.address || '');
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${
                            customerName === c.name
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200/80'
                          }`}
                          title={c.phone || c.address || c.name}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                    {(customerName || customerPhone || customerAddress) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerName('');
                          setCustomerPhone('');
                          setCustomerAddress('');
                        }}
                        className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition inline-flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        <span>Clear Customer</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="relative">
                      <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>Customer Name</span>
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          setShowCustomerSuggest(true);
                        }}
                        onFocus={() => setShowCustomerSuggest(true)}
                        onBlur={() => setTimeout(() => setShowCustomerSuggest(false), 180)}
                        placeholder="Walk-in Customer හෝ නම..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 outline-none text-sm font-medium transition"
                      />
                      {showCustomerSuggest && customers.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                          {customers
                            .filter(
                              (c) =>
                                !customerName.trim() ||
                                c.name.toLowerCase().includes(customerName.toLowerCase()) ||
                                c.phone.includes(customerName)
                            )
                            .slice(0, 6)
                            .map((c) => (
                              <div
                                key={c.id}
                                onMouseDown={() => {
                                  setCustomerName(c.name);
                                  setCustomerPhone(c.phone || '');
                                  setCustomerAddress(c.address || '');
                                  setShowCustomerSuggest(false);
                                }}
                                className="px-3.5 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-none text-xs flex justify-between"
                              >
                                <span className="font-bold text-slate-800">{c.name}</span>
                                <span className="text-slate-500">{c.phone}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>Phone Number</span>
                      </label>
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="07X-XXXXXXX"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 outline-none text-sm font-medium transition"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>Address</span>
                      </label>
                      <input
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Colombo / Company..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 outline-none text-sm font-medium transition"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
                        <FileText className="w-3 h-3" />
                        <span>Subject / Title</span>
                      </label>
                      <input
                        type="text"
                        value={billSubject}
                        onChange={(e) => setBillSubject(e.target.value)}
                        placeholder="e.g. CCTV / UPS Quote..."
                        className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/30 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 outline-none text-sm font-medium transition"
                      />
                    </div>
                  </div>

                  {/* Collapsible Scope of Work / Description */}
                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowScopeBox((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 transition"
                    >
                      {isScopeVisible ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>
                        {billingMode === 'QUOTATION' ? 'Quotation Description / Scope of Work' : 'Invoice Description / Scope of Work'}
                      </span>
                      <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
                    </button>

                    {isScopeVisible && (
                      <div className="mt-2">
                        <textarea
                          rows={2}
                          value={billDescription}
                          onChange={(e) => setBillDescription(e.target.value)}
                          placeholder="උදා: Supply, installation and configuration of 8CH Hikvision CCTV camera system with 2 years comprehensive warranty..."
                          className="w-full px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50/20 focus:bg-white focus:border-indigo-500 outline-none text-xs text-slate-800 resize-y leading-relaxed"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Catalog Search + Line Items Card */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-visible">
                  {/* Header with Quick Add Search */}
                  <div className="p-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 rounded-t-2xl">
                    <div className="flex items-center gap-2.5">
                      <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Cart Items &amp; Multi-Serials
                      </h2>
                      <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-200/80">
                        {billingRows.length} {billingRows.length === 1 ? 'Row' : 'Rows'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
                      {/* Quick Catalog Search Input */}
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={quickItemQuery}
                          onChange={(e) => {
                            setQuickItemQuery(e.target.value);
                            setShowQuickCatalogDropdown(true);
                          }}
                          onFocus={() => setShowQuickCatalogDropdown(true)}
                          onBlur={() => setTimeout(() => setShowQuickCatalogDropdown(false), 180)}
                          placeholder="Quick add from DB catalog..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 outline-none text-xs font-medium"
                        />
                        {showQuickCatalogDropdown && quickCatalogMatches.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 max-h-64 overflow-y-auto">
                            {quickCatalogMatches.map((it) => (
                              <button
                                key={it.id}
                                type="button"
                                onMouseDown={() => quickAddCatalogItem(it)}
                                className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b border-slate-100 last:border-none flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-800 truncate">{it.name}</div>
                                  <div className="text-[10px] text-slate-400">
                                    Stock: <b className={it.stock_qty > 0 ? 'text-emerald-600' : 'text-rose-500'}>{it.stock_qty}</b> • {it.warranty_label}
                                  </div>
                                </div>
                                <span className="font-bold text-indigo-700 shrink-0">{fmtMoney(it.selling_price)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={autoGenAllBillingSerials}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition flex items-center gap-1"
                        title="Auto-generate unique serial numbers for all empty slots"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Auto S/N</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => addBillingRow()}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                        title="Keyboard Shortcut: Press [Page Down] on keyboard"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Row</span>
                        <kbd className="px-1.5 py-0.5 bg-indigo-500 text-indigo-100 rounded text-[10px] font-mono border border-indigo-400">
                          PgDn
                        </kbd>
                      </button>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="overflow-x-auto overflow-y-visible">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/40">
                          <th className="py-2.5 px-3 w-9 text-center">#</th>
                          <th className="py-2.5 px-3 min-w-[230px]">Item Name (භාණ්ඩයේ නම)</th>
                          <th className="py-2.5 px-2.5 w-36">Warranty</th>
                          <th className="py-2.5 px-2.5 w-20 text-center">Qty</th>
                          <th className="py-2.5 px-2.5 min-w-[200px]">Serial Numbers</th>
                          <th className="py-2.5 px-2.5 w-32 text-right">Unit Price</th>
                          <th className="py-2.5 px-2.5 w-24 text-right">Disc.</th>
                          <th className="py-2.5 px-2.5 w-24 text-right">VAT %</th>
                          <th className="py-2.5 px-3 w-32 text-right">Line Total</th>
                          <th className="py-2.5 px-2 w-9"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {billingRows.map((row, idx) => {
                          const cleanName = String(row.item_name || '').trim().toLowerCase();
                          const exactMatch = items.find((it) => it.name.toLowerCase() === cleanName);
                          const matchingStockSerials = exactMatch
                            ? availableSerials.filter(
                                (s) =>
                                  (s.item_id === exactMatch.id ||
                                    s.item_name.toLowerCase() === cleanName) &&
                                  !row.serial_numbers.includes(s.serial_number)
                              )
                            : [];

                          const previousDbSerials: string[] = [];
                          if (exactMatch && cleanName) {
                            const seen = new Set<string>([
                              ...row.serial_numbers,
                              ...matchingStockSerials.map((s) => s.serial_number),
                            ]);
                            const collectFromDocs = (
                              docs: Array<{ items?: Array<{ item_name?: string; serial_numbers?: string[] }> }>
                            ) => {
                              for (const doc of docs) {
                                for (const it of doc.items || []) {
                                  if (String(it.item_name || '').trim().toLowerCase() === cleanName) {
                                    for (const sn of it.serial_numbers || []) {
                                      const cleanSn = String(sn || '').trim();
                                      if (cleanSn && !seen.has(cleanSn)) {
                                        seen.add(cleanSn);
                                        previousDbSerials.push(cleanSn);
                                      }
                                    }
                                  }
                                }
                              }
                            };
                            collectFromDocs(grns);
                            collectFromDocs(quotations);
                            collectFromDocs(invoices);
                          }
                          const baseVal =
                            Number(row.qty || 1) * Number(row.unit_price || 0) - Number(row.item_discount || 0);
                          const rowVatRate = Number(row.vat_rate || 0);
                          const rowVatAmount = rowVatRate > 0 ? (Math.max(0, baseVal) * rowVatRate) / 100 : 0;
                          const lineTotal = Math.max(0, baseVal) + rowVatAmount;

                          const filteredSuggestions = items
                            .filter((it) => !cleanName || it.name.toLowerCase().includes(cleanName))
                            .slice(0, 8);

                          return (
                            <tr
                              key={row.rowId || idx}
                              onKeyDown={(e) => handleBillingRowKeyDown(e, idx)}
                              className="align-top hover:bg-slate-50/70 transition"
                            >
                              <td className="py-3 px-3 text-center font-bold text-slate-400 text-xs pt-4">
                                {idx + 1}
                              </td>

                              {/* Item Name Input */}
                              <td className="py-3 px-3 relative space-y-1">
                                <input
                                  type="text"
                                  id={`item_name_input_${idx}`}
                                  value={row.item_name}
                                  onChange={(e) => {
                                    updateBillingRow(idx, { item_name: e.target.value });
                                    setActiveItemSuggestRow(idx);
                                  }}
                                  onFocus={() => setActiveItemSuggestRow(idx)}
                                  onBlur={() =>
                                    setTimeout(() => {
                                      setActiveItemSuggestRow(null);
                                      setBillingRows((prev) => {
                                        const target = prev[idx];
                                        if (!target) return prev;
                                        const nm = String(target.item_name || '').trim();
                                        if (!nm) return prev;
                                        const inStock = items.find(
                                          (it) => it.name.toLowerCase() === nm.toLowerCase() && Number(it.stock_qty || 0) > 0
                                        );
                                        if (inStock) return prev;
                                        if (!target.serial_numbers.some((s) => !s.trim())) return prev;
                                        const used = collectUsedSerials(prev);
                                        return prev.map((r, rIdx) =>
                                          rIdx !== idx
                                            ? r
                                            : {
                                                ...r,
                                                serial_numbers: r.serial_numbers.map((s) =>
                                                  s.trim() ? s : generateSerialCode(used, nm)
                                                ),
                                              }
                                        );
                                      });
                                    }, 180)
                                  }
                                  placeholder="Item නම (e.g. PROLINK 650VA UPS)..."
                                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 outline-none text-sm font-semibold text-slate-900"
                                />

                                <div className="flex flex-wrap items-center gap-1.5">
                                  {cleanName &&
                                    (exactMatch ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                        In DB (Stock: {exactMatch.stock_qty})
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                        <Sparkles className="w-2.5 h-2.5" /> New Item (Auto-saves)
                                      </span>
                                    ))}
                                  {billingMode === 'INVOICE' && exactMatch && Number(row.qty || 1) > Number(exactMatch.stock_qty || 0) && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Low Stock ({exactMatch.stock_qty})
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const k = row.rowId || String(idx);
                                      setExpandedDescRows((prev) => ({ ...prev, [k]: !prev[k] }));
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 px-1.5 py-0.5 rounded-md transition"
                                    title="Edit line item description"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                    <span>{row.item_description ? 'Desc' : '+Desc'}</span>
                                  </button>
                                </div>

                                {(expandedDescRows[row.rowId || String(idx)] || false) && (
                                  <input
                                    type="text"
                                    value={row.item_description || ''}
                                    onChange={(e) => updateBillingRow(idx, { item_description: e.target.value })}
                                    placeholder="Item specifications / description..."
                                    className="w-full px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50/20 focus:bg-white focus:border-indigo-500 outline-none text-xs text-slate-700"
                                  />
                                )}

                                {activeItemSuggestRow === idx && filteredSuggestions.length > 0 && (
                                  <div className="absolute left-3 right-3 top-11 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 max-h-60 overflow-y-auto">
                                    {filteredSuggestions.map((it) => (
                                      <div
                                        key={it.id}
                                        onMouseDown={() => selectSuggestedItemForBilling(idx, it)}
                                        className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-none flex items-center justify-between text-xs"
                                      >
                                        <div className="pr-2">
                                          <div className="font-bold text-slate-800">{it.name}</div>
                                          {it.description && (
                                            <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                              {it.description}
                                            </div>
                                          )}
                                          <div className="text-[10px] text-slate-400">
                                            Warranty: {it.warranty_label} • Stock: <b>{it.stock_qty}</b>
                                          </div>
                                        </div>
                                        <div className="font-bold text-indigo-700 shrink-0">
                                          {fmtMoney(it.selling_price)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>

                              {/* Warranty */}
                              <td className="py-3 px-2.5">
                                <WarrantySelector
                                  compact
                                  months={Number(row.warranty_months || 0)}
                                  label={row.warranty_label || 'No Warranty'}
                                  onChange={({ warranty_months, warranty_label }) =>
                                    updateBillingRow(idx, { warranty_months, warranty_label })
                                  }
                                />
                              </td>

                              {/* Quantity */}
                              <td className="py-3 px-2.5">
                                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-indigo-50/30 overflow-hidden mx-auto">
                                  <button
                                    type="button"
                                    onClick={() => updateBillingRow(idx, { qty: Math.max(1, Number(row.qty || 1) - 1) })}
                                    className="px-1.5 py-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-100/60 transition"
                                    title="Decrease Qty"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={row.qty}
                                    onChange={(e) => updateBillingRow(idx, { qty: Number(e.target.value) })}
                                    className="w-11 py-1.5 bg-transparent text-center font-extrabold text-sm text-indigo-700 outline-none tabular-nums"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateBillingRow(idx, { qty: Math.min(100, Number(row.qty || 1) + 1) })}
                                    className="px-1.5 py-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-100/60 transition"
                                    title="Increase Qty"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              {/* Multi-Serial Inputs per Unit */}
                              <td className="py-3 px-2.5">
                                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                  {row.serial_numbers.map((sn, snIdx) => (
                                    <div key={snIdx} className="flex items-center gap-1">
                                      <span className="text-[10px] font-bold text-slate-400 w-7 shrink-0">
                                        #{snIdx + 1}
                                      </span>
                                      <input
                                        type="text"
                                        id={`sn_input_${idx}_${snIdx}`}
                                        list={`sn_suggest_${idx}`}
                                        value={sn}
                                        onChange={(e) => updateBillingRowSerial(idx, snIdx, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const nextEl = document.getElementById(
                                              `sn_input_${idx}_${snIdx + 1}`
                                            );
                                            if (nextEl) {
                                              nextEl.focus();
                                            } else {
                                              const upEl = document.getElementById(`unit_price_input_${idx}`);
                                              if (upEl) upEl.focus();
                                            }
                                          }
                                        }}
                                        placeholder={`Serial #${snIdx + 1}`}
                                        className="w-full px-2 py-1 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-xs font-mono bg-slate-50/60 focus:bg-white"
                                      />
                                    </div>
                                  ))}
                                </div>

                                {(matchingStockSerials.length > 0 || previousDbSerials.length > 0) && (
                                  <datalist id={`sn_suggest_${idx}`}>
                                    {matchingStockSerials.map((s) => (
                                      <option key={`st_${s.id}`} value={s.serial_number}>
                                        In Stock
                                      </option>
                                    ))}
                                    {previousDbSerials.slice(0, 20).map((sn) => (
                                      <option key={`prev_${sn}`} value={sn}>
                                        Previous DB S/N
                                      </option>
                                    ))}
                                  </datalist>
                                )}

                                {matchingStockSerials.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                    <span className="text-[10px] font-bold uppercase text-slate-400">
                                      Stock:
                                    </span>
                                    {matchingStockSerials.slice(0, 5).map((s) => (
                                      <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => pickAvailableSerial(idx, s.serial_number)}
                                        className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-mono transition"
                                      >
                                        + {s.serial_number}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {previousDbSerials.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                    <span className="text-[10px] font-bold uppercase text-slate-400">
                                      Prev DB:
                                    </span>
                                    {previousDbSerials.slice(0, 5).map((sn) => (
                                      <button
                                        key={sn}
                                        type="button"
                                        onClick={() => pickAvailableSerial(idx, sn)}
                                        className="text-[10px] bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 px-1.5 py-0.5 rounded font-mono transition"
                                        title="Click to use previous DB serial number"
                                      >
                                        + {sn}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {row.serial_numbers.some((s) => !s.trim()) && (
                                  <button
                                    type="button"
                                    onClick={() => autoGenBillingRowSerials(idx)}
                                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-semibold transition"
                                    title="Auto-generate serial number(s) for this item"
                                  >
                                    <Sparkles className="w-2.5 h-2.5" />
                                    <span>Auto S/N</span>
                                  </button>
                                )}
                              </td>

                              {/* Unit Price */}
                              <td className="py-3 px-2.5">
                                <input
                                  type="number"
                                  step="any"
                                  id={`unit_price_input_${idx}`}
                                  placeholder="0.00"
                                  value={row.unit_price}
                                  onChange={(e) => updateBillingRow(idx, { unit_price: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddNewRowFromEnter(idx);
                                    }
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-right font-bold text-sm focus:border-indigo-500 outline-none"
                                />
                              </td>

                              {/* Item Discount */}
                              <td className="py-3 px-2.5">
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  id={`item_discount_input_${idx}`}
                                  value={row.item_discount}
                                  onChange={(e) => updateBillingRow(idx, { item_discount: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddNewRowFromEnter(idx);
                                    }
                                  }}
                                  className="w-full px-2 py-1.5 rounded-xl border border-slate-200 text-right text-xs text-slate-600 focus:border-indigo-500 outline-none"
                                />
                              </td>

                              {/* Optional VAT % */}
                              <td className="py-3 px-2.5">
                                <div className="space-y-0.5">
                                  <input
                                    type="number"
                                    step="any"
                                    min={0}
                                    max={100}
                                    id={`vat_rate_input_${idx}`}
                                    placeholder="0%"
                                    value={row.vat_rate ?? ''}
                                    onChange={(e) => updateBillingRow(idx, { vat_rate: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddNewRowFromEnter(idx);
                                      }
                                    }}
                                    className="w-full px-2 py-1.5 rounded-xl border border-slate-200 text-right text-xs font-semibold focus:border-indigo-500 outline-none"
                                  />
                                  {rowVatRate > 0 && (
                                    <div className="text-[10px] text-indigo-700 font-mono text-right font-bold whitespace-nowrap">
                                      +{rowVatAmount.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Line Total */}
                              <td className="py-3 px-3 text-right font-extrabold text-slate-900 pt-4 whitespace-nowrap">
                                {fmtMoney(lineTotal)}
                              </td>

                              {/* Duplicate & Remove Row */}
                              <td className="py-3 px-2 text-center pt-3.5">
                                <div className="inline-flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => duplicateBillingRow(idx)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                                    title="Duplicate Row"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeBillingRow(idx)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                    title="Remove Row"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer Fast Billing Hint */}
                  <div className="p-3 bg-slate-50/70 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 rounded-b-2xl">
                    <button
                      type="button"
                      onClick={() => addBillingRow()}
                      className="px-3.5 py-1.5 rounded-xl border border-dashed border-indigo-400 text-indigo-700 hover:bg-indigo-50 text-xs font-bold transition flex items-center gap-1.5 bg-white"
                      title="Keyboard Shortcut: Press [Page Down]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>තවත් Item එකක් එකතු කරන්න (Add Row)</span>
                      <kbd className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-mono">
                        PgDn
                      </kbd>
                    </button>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>
                        <b>Fast Billing:</b> <b>Unit Price</b>, <b>Disc.</b> හෝ <b>VAT %</b> හිදී <b>[Enter]</b> ඔබන්න → අලුත් Row එකක්!
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* DRAGGABLE SPLITTER HANDLE (Desktop xl+ when not stacked) */}
              {!billingStacked && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize billing panels"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsResizingBilling(true);
                  }}
                  onDoubleClick={() => setBillingLeftPct(68)}
                  title="Drag to resize Cart & Summary panels • Double-click to reset (68/32)"
                  className="hidden xl:flex w-4 self-stretch items-center justify-center cursor-col-resize select-none group shrink-0"
                >
                  <div
                    className={`w-1.5 h-24 rounded-full flex items-center justify-center transition-all ${
                      isResizingBilling
                        ? 'bg-indigo-600 h-36 shadow-md'
                        : 'bg-slate-200 group-hover:bg-indigo-400 group-hover:h-32'
                    }`}
                  >
                    <GripVertical
                      className={`w-3 h-3 ${
                        isResizingBilling ? 'text-white' : 'text-slate-500 group-hover:text-white'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* RIGHT STICKY PANEL: SUMMARY, PAYMENT & ACTIONS */}
              <div
                className={`w-full ${
                  billingStacked ? '' : 'xl:flex-1 xl:min-w-[300px] xl:sticky xl:top-20'
                } space-y-4`}
              >
                {/* Totals Summary Card */}
                <div
                  ref={summaryBoxRef}
                  style={summaryMinHeight > 0 ? { minHeight: `${summaryMinHeight}px` } : undefined}
                  className={`bg-white rounded-2xl shadow-xs border border-slate-200/90 flex flex-col justify-between transition-all ${
                    summaryScale === 'S'
                      ? 'p-3 space-y-2'
                      : summaryScale === 'L'
                      ? 'p-5 space-y-4'
                      : 'p-4 space-y-3'
                  }`}
                >
                  <div
                    className={
                      summaryScale === 'S'
                        ? 'space-y-2'
                        : summaryScale === 'L'
                        ? 'space-y-4'
                        : 'space-y-3'
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {billingMode === 'QUOTATION' ? 'Quotation Summary' : 'Invoice Summary'}
                        </h3>
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          {filledItemCount} • {totalCartUnits}u
                        </span>
                      </div>

                      {/* Box Size (S / M / L) & Line Gap Adjusters */}
                      <div className="flex items-center gap-1.5">
                        <div
                          className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-[10px] font-bold"
                          title="Summary Box Size (ලොකු / කුඩා කරන්න)"
                        >
                          {(['S', 'M', 'L'] as const).map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => setSummaryScale(sz)}
                              className={`px-1.5 py-0.5 rounded-md transition ${
                                summaryScale === sz
                                  ? 'bg-white text-indigo-700 shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>

                        <div
                          className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-[10px] font-bold"
                          title="Line Spacing (පේළි පරතරය වෙනස් කරන්න)"
                        >
                          {([
                            { id: 'tight', label: '≡' },
                            { id: 'normal', label: '☰' },
                            { id: 'relaxed', label: '⇕' },
                          ] as const).map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setSummaryLineGap(g.id)}
                              className={`px-1.5 py-0.5 rounded-md transition ${
                                summaryLineGap === g.id
                                  ? 'bg-white text-indigo-700 shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              {g.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`divide-y divide-slate-100 ${
                        summaryScale === 'S'
                          ? 'text-xs'
                          : summaryScale === 'L'
                          ? 'text-base'
                          : 'text-sm'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-between ${
                          summaryLineGap === 'tight'
                            ? 'py-1'
                            : summaryLineGap === 'relaxed'
                            ? 'py-2.5'
                            : 'py-1.5'
                        }`}
                      >
                        <span className="text-slate-600 font-medium">Subtotal (භාණ්ඩ එකතුව)</span>
                        <span className="font-bold text-slate-900">{fmtMoney(subtotal)}</span>
                      </div>

                      {totalVatAmount > 0 && (
                        <div
                          className={`flex items-center justify-between text-indigo-700 bg-indigo-50/70 px-3 rounded-xl border border-indigo-200/80 text-xs ${
                            summaryLineGap === 'tight'
                              ? 'py-1 my-1'
                              : summaryLineGap === 'relaxed'
                              ? 'py-2.5 my-2'
                              : 'py-1.5 my-1.5'
                          }`}
                        >
                          <span className="font-semibold">Total VAT / Tax</span>
                          <span className="font-bold font-mono">+{fmtMoney(totalVatAmount)}</span>
                        </div>
                      )}

                      <div
                        className={`flex items-center justify-between ${
                          summaryLineGap === 'tight'
                            ? 'py-1'
                            : summaryLineGap === 'relaxed'
                            ? 'py-2.5'
                            : 'py-1.5'
                        }`}
                      >
                        <span className="text-slate-600 font-medium">Bill Discount (Rs.)</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={billDiscount}
                          onChange={(e) => setBillDiscount(e.target.value)}
                          className={`w-28 px-2.5 rounded-lg border border-slate-200 text-right font-semibold focus:border-indigo-500 outline-none ${
                            summaryScale === 'S'
                              ? 'py-0.5 text-xs'
                              : summaryScale === 'L'
                              ? 'py-1.5 text-base'
                              : 'py-1 text-sm'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Grand Total Highlight Box */}
                    <div
                      className={`bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl flex items-center justify-between shadow-sm ${
                        summaryScale === 'S'
                          ? 'p-2.5'
                          : summaryScale === 'L'
                          ? 'p-4'
                          : 'p-3.5'
                      }`}
                    >
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-indigo-100 font-semibold">
                          Grand Total (අවසාන මුදල)
                        </div>
                        <div
                          className={`font-extrabold tracking-tight mt-0.5 ${
                            summaryScale === 'S'
                              ? 'text-xl'
                              : summaryScale === 'L'
                              ? 'text-3xl'
                              : 'text-2xl'
                          }`}
                        >
                          {fmtMoney(grandTotal)}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-indigo-100 font-medium">
                        {billingMode === 'QUOTATION' ? 'Estimate' : 'Net Payable'}
                      </div>
                    </div>

                    {/* Invoice Payment Controls */}
                  {billingMode === 'INVOICE' && (
                    <div className="pt-2 border-t border-slate-100 space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Payment Method
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { val: 'Cash', label: 'Cash', icon: <Banknote className="w-3.5 h-3.5" /> },
                            { val: 'Bank Transfer', label: 'Bank / QR', icon: <Landmark className="w-3.5 h-3.5" /> },
                            { val: 'Card', label: 'Card', icon: <CreditCard className="w-3.5 h-3.5" /> },
                            { val: 'Cheque', label: 'Cheque', icon: <FileText className="w-3.5 h-3.5" /> },
                            { val: 'Credit', label: 'Credit', icon: <Wallet className="w-3.5 h-3.5" /> },
                          ].map((pm) => (
                            <button
                              key={pm.val}
                              type="button"
                              onClick={() => {
                                setBillPaymentMethod(pm.val);
                                if (pm.val === 'Credit') {
                                  if (billPaidAmount === '') setBillPaidAmount('0');
                                  if (!billCreditDueDate) {
                                    const dNum = Number(billCreditDays || 30);
                                    setBillCreditDueDate(addDaysToTodayIso(Number.isNaN(dNum) ? 30 : dNum));
                                  }
                                }
                              }}
                              className={`px-2 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1 ${
                                billPaymentMethod === pm.val
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                                  : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {pm.icon}
                              <span>{pm.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Paid Amount (ගෙවූ මුදල Rs.)
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setBillPaidAmount(String(grandTotal))}
                              className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold transition"
                            >
                              Exact
                            </button>
                            <button
                              type="button"
                              onClick={() => setBillPaidAmount((grandTotal / 2).toFixed(2))}
                              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition"
                            >
                              50%
                            </button>
                            <button
                              type="button"
                              onClick={() => setBillPaidAmount('0')}
                              className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold transition"
                            >
                              Credit (0)
                            </button>
                          </div>
                        </div>
                        <input
                          type="number"
                          step="any"
                          placeholder="Auto full amount"
                          value={billPaidAmount}
                          onChange={(e) => setBillPaidAmount(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-right font-bold text-emerald-700 text-sm bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none tabular-nums"
                        />
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {[1000, 5000, 10000].map((note) => (
                            <button
                              key={note}
                              type="button"
                              onClick={() => {
                                const current = billPaidAmount === '' ? 0 : Number(billPaidAmount || 0);
                                setBillPaidAmount(String(current + note));
                              }}
                              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 text-[10px] font-bold tabular-nums transition"
                            >
                              +{note.toLocaleString()}
                            </button>
                          ))}
                          {billPaidAmount !== '' && (
                            <button
                              type="button"
                              onClick={() => setBillPaidAmount('')}
                              className="px-2 py-0.5 rounded-md text-slate-400 hover:text-rose-600 text-[10px] font-semibold ml-auto"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Cheque Payment Details Box */}
                      {billPaymentMethod === 'Cheque' && (
                        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 space-y-2 text-xs">
                          <div className="font-bold text-amber-900">Cheque Payment Details</div>
                          <div className="grid grid-cols-1 gap-2">
                            <input
                              type="text"
                              value={billChequeNo}
                              onChange={(e) => setBillChequeNo(e.target.value)}
                              placeholder="Cheque No * (e.g. 102938)"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white outline-none"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={billChequeBank}
                                onChange={(e) => setBillChequeBank(e.target.value)}
                                placeholder="Bank (BOC / HNB...)"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white outline-none"
                              />
                              <input
                                type="date"
                                value={billChequeDate}
                                onChange={(e) => setBillChequeDate(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Credit Payment Period & Due Date Box */}
                      {billPaymentMethod === 'Credit' && (
                        <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3 space-y-2.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-rose-900 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-rose-600" />
                              <span>Credit Period (ණය ගෙවීමේ කාලය)</span>
                            </span>
                            {billCreditDueDate && (
                              <span className="text-[10px] font-bold text-rose-700 bg-white px-2 py-0.5 rounded-full border border-rose-200">
                                Due: {billCreditDueDate}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {[7, 14, 30, 45, 60, 90].map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => {
                                  setBillCreditDays(String(d));
                                  setBillCreditDueDate(addDaysToTodayIso(d));
                                }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition ${
                                  billCreditDays === String(d)
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                    : 'bg-white text-slate-700 border-rose-200/80 hover:bg-rose-100/70'
                                }`}
                              >
                                {d} Days
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                                Period (Days)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={3650}
                                value={billCreditDays}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBillCreditDays(val);
                                  if (val !== '' && !Number.isNaN(Number(val))) {
                                    setBillCreditDueDate(addDaysToTodayIso(Number(val)));
                                  }
                                }}
                                placeholder="e.g. 30"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white outline-none focus:border-rose-500 tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                                Due Date (අවසන් දිනය)
                              </label>
                              <input
                                type="date"
                                value={billCreditDueDate}
                                onChange={(e) => {
                                  const dt = e.target.value;
                                  setBillCreditDueDate(dt);
                                  setBillCreditDays(daysBetweenTodayAndIso(dt));
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white outline-none focus:border-rose-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Bank Transfer Details Box */}
                      {billPaymentMethod === 'Bank Transfer' && (
                        <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-3 space-y-2 text-xs">
                          <div className="font-bold text-sky-900">Bank Transfer Reference</div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={billChequeNo}
                              onChange={(e) => setBillChequeNo(e.target.value)}
                              placeholder="Ref / Slip No"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white outline-none"
                            />
                            <input
                              type="text"
                              value={billChequeBank}
                              onChange={(e) => setBillChequeBank(e.target.value)}
                              placeholder="Bank Name"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white outline-none"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80">
                        <span className="font-semibold text-slate-600">
                          {effectivePaid > grandTotal ? 'Change to Return:' : 'Balance Due:'}
                        </span>
                        <span
                          className={`font-extrabold tabular-nums ${
                            effectivePaid > grandTotal
                              ? 'text-indigo-700'
                              : balanceDue <= 0
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {effectivePaid > grandTotal
                            ? `${fmtMoney(effectivePaid - grandTotal)} (CHANGE)`
                            : balanceDue <= 0
                            ? 'Rs. 0.00 (FULLY PAID)'
                            : `${fmtMoney(balanceDue)} (CREDIT)`}
                        </span>
                      </div>

                      {/* Optional Dispatch Vehicle No */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Vehicle No (වාහන අංකය - Optional)
                        </label>
                        <input
                          type="text"
                          value={billVehicleNo}
                          onChange={(e) => setBillVehicleNo(e.target.value)}
                          placeholder="e.g. WP CAB-1234 / LB-4567"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none text-xs font-semibold uppercase"
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Additional Notes (අමතර සටහන්)
                    </label>
                    <textarea
                      rows={2}
                      value={billNotes}
                      onChange={(e) => setBillNotes(e.target.value)}
                      placeholder="Quotation valid for 14 days / Delivery notes..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none text-xs"
                    />
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="pt-2 space-y-2">
                    {billingMode === 'QUOTATION' && !convertingQuotationId && convertingQuotationIds.length === 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => submitQuotation('print_and_download')}
                          className="w-full px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95"
                          title="Quotation එක Save කර ස්වයංක්‍රීයව Print කර PDF එකක් ලෙස Download කරගන්න"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Save &amp; Print</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => submitQuotation('confirm')}
                          className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 active:scale-[0.99]"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm Quotation</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={submitInvoice}
                        className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 active:scale-[0.99]"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {convertingQuotationIds.length > 1
                            ? `Confirm ${convertingQuotationIds.length} Quotes (${convertingQuoteNo}) & Create Invoice`
                            : convertingQuotationId || convertingQuotationIds.length === 1
                            ? `Confirm Quote #${convertingQuoteNo} & Create Invoice`
                            : 'Confirm & Generate Invoice'}
                        </span>
                      </button>
                    )}
                  </div>
                  </div>

                  {/* Bottom Drag Handle to Resize Summary Box Height */}
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize summary box height"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsResizingSummaryH(true);
                    }}
                    onDoubleClick={() => setSummaryMinHeight(0)}
                    title="Drag up/down to resize box height • Double-click to reset"
                    className="pt-1 flex items-center justify-center cursor-row-resize select-none group"
                  >
                    <div
                      className={`h-1.5 w-16 rounded-full transition-all ${
                        isResizingSummaryH
                          ? 'bg-indigo-600 w-24'
                          : 'bg-slate-200 group-hover:bg-indigo-400 group-hover:w-20'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ================================================================ */}
        {/* TAB 2: QUOTATIONS LIST                                           */}
        {/* ================================================================ */}
        {activeTab === 'quotations' && (() => {
          const allPendingCount = quotations.filter((q) => q.status === 'PENDING').length;
          const allPendingTotal = quotations
            .filter((q) => q.status === 'PENDING')
            .reduce((acc, q) => acc + Number(q.grand_total || 0), 0);
          const allInvoicedCount = quotations.filter((q) => q.status === 'INVOICED').length;
          const conversionPct = quotations.length > 0 ? Math.round((allInvoicedCount / quotations.length) * 100) : 0;

          const filteredQuotations = quotations.filter((qt) => {
            if (filterQuotationStatus !== 'ALL' && qt.status !== filterQuotationStatus) return false;
            const q = searchQuotations.trim().toLowerCase();
            if (!q) return true;
            return (
              qt.quote_no.toLowerCase().includes(q) ||
              qt.customer_name.toLowerCase().includes(q) ||
              (qt.subject || '').toLowerCase().includes(q) ||
              (qt.description || '').toLowerCase().includes(q) ||
              (qt.customer_phone || '').toLowerCase().includes(q)
            );
          });
          const pendingQuotations = filteredQuotations.filter((q) => q.status === 'PENDING');
          const selectedQuotesList = quotations.filter((q) => selectedQuoteIds.includes(q.id));
          const selectedQuotesTotal = selectedQuotesList.reduce((acc, q) => acc + Number(q.grand_total || 0), 0);
          const selectedCustomerNames = Array.from(new Set(selectedQuotesList.map((q) => q.customer_name).filter(Boolean)));
          const selectedQuoteNumbers = selectedQuotesList.map((q) => q.quote_no).join(', ');
          const allPendingSelected =
            pendingQuotations.length > 0 &&
            pendingQuotations.every((q) => selectedQuoteIds.includes(q.id));

          return (
            <section className="space-y-4">
              {/* Summary KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Quotations</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{quotations.length}</div>
                </div>
                <div className="bg-white rounded-2xl border border-amber-200/90 p-4 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending Value</div>
                  <div className="text-xl font-extrabold text-amber-900 mt-1 tabular-nums">{fmtMoney(allPendingTotal)}</div>
                  <div className="text-[11px] text-amber-700/80 font-medium mt-0.5">{allPendingCount} pending</div>
                </div>
                <div className="bg-white rounded-2xl border border-emerald-200/90 p-4 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Converted to Invoice</div>
                  <div className="text-2xl font-extrabold text-emerald-700 mt-1 tabular-nums">{allInvoicedCount}</div>
                </div>
                <div className="bg-white rounded-2xl border border-indigo-200/90 p-4 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Conversion Rate</div>
                  <div className="text-2xl font-extrabold text-indigo-700 mt-1 tabular-nums">{conversionPct}%</div>
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">Quotations (මිල ගණන් ලැයිස්තුව)</h2>
                    <p className="text-xs text-slate-500">
                      Select multiple Pending checkboxes to combine into one Invoice, or use 1-click PDF, Duplicate &amp; Convert.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold">
                    {([
                      { id: 'ALL', label: `All (${quotations.length})` },
                      { id: 'PENDING', label: `Pending (${allPendingCount})` },
                      { id: 'INVOICED', label: `Invoiced (${allInvoicedCount})` },
                    ] as const).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilterQuotationStatus(tab.id)}
                        className={`px-3 py-1 rounded-lg transition ${
                          filterQuotationStatus === tab.id
                            ? 'bg-white text-indigo-700 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuotations}
                      onChange={(e) => setSearchQuotations(e.target.value)}
                      placeholder="Search Quote #, Customer, Subject..."
                      className="pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm w-64 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition"
                    />
                    {searchQuotations && (
                      <button
                        type="button"
                        onClick={() => setSearchQuotations('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetBillingForm();
                      setBillingMode('QUOTATION');
                      setActiveTab('billing');
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold shadow-xs transition inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Quotation</span>
                  </button>
                </div>
              </div>

              {/* MULTI-QUOTATION SELECTION BANNER */}
              {selectedQuoteIds.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-950 text-white rounded-2xl p-4 shadow-xl border border-indigo-500/40 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shadow-inner">
                      <Receipt className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-extrabold text-base tracking-tight">
                          {selectedQuoteIds.length} Quotation(s) Selected
                        </span>
                        <span className="bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                          {selectedCustomerNames.length === 1
                            ? `Customer: ${selectedCustomerNames[0]}`
                            : `${selectedCustomerNames.length} Customers`}
                        </span>
                      </div>
                      <div className="text-xs text-indigo-200 mt-1 flex flex-wrap items-center gap-2">
                        <span>Quotes: <strong className="text-white">{selectedQuoteNumbers}</strong></span>
                        <span>•</span>
                        <span>Total: <strong className="text-emerald-300 text-sm font-black tabular-nums">{fmtMoney(selectedQuotesTotal)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedQuoteIds([])}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="button"
                      onClick={combineSelectedQuotationsToInvoice}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-black shadow-lg transition inline-flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Combine {selectedQuoteIds.length} &amp; Convert to Invoice</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-3.5 text-center w-12">
                        <input
                          type="checkbox"
                          checked={allPendingSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const pendingIds = pendingQuotations.map((q) => q.id);
                              setSelectedQuoteIds(Array.from(new Set([...selectedQuoteIds, ...pendingIds])));
                            } else {
                              const pendingIds = new Set(pendingQuotations.map((q) => q.id));
                              setSelectedQuoteIds(selectedQuoteIds.filter((id) => !pendingIds.has(id)));
                            }
                          }}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                          title="Select / deselect all pending quotations"
                        />
                      </th>
                      <th className="py-3 px-4">Quote No</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Description / Items</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQuotations.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-sm text-slate-500">
                          No quotations match your current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredQuotations.map((qt) => {
                        const isSelected = selectedQuoteIds.includes(qt.id);
                        const isPending = qt.status === 'PENDING';
                        return (
                          <tr
                            key={qt.id}
                            className={`transition ${isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-slate-50/80'}`}
                          >
                            <td className="py-3 px-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!isPending}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedQuoteIds([...selectedQuoteIds, qt.id]);
                                  } else {
                                    setSelectedQuoteIds(selectedQuoteIds.filter((id) => id !== qt.id));
                                  }
                                }}
                                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                                title={isPending ? 'Select to combine into invoice' : 'Already invoiced'}
                              />
                            </td>
                            <td className="py-3 px-4 font-bold text-indigo-700 whitespace-nowrap">{qt.quote_no}</td>
                            <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">{qt.created_at}</td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{qt.customer_name}</div>
                              <div className="text-xs text-slate-500">{qt.customer_phone}</div>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 max-w-sm">
                              {qt.subject && (
                                <div className="font-bold text-indigo-900 mb-0.5">{qt.subject}</div>
                              )}
                              {qt.description && (
                                <div className="text-slate-700 italic line-clamp-2 mb-1">{qt.description}</div>
                              )}
                              <div className="truncate text-slate-500">
                                {(qt.items || []).map((i) => `${i.item_name} (x${i.qty})`).join(', ')}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                              {fmtMoney(qt.grand_total)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {qt.status === 'INVOICED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Invoiced ({qt.converted_invoice_no})</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Pending</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {qt.status === 'PENDING' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => confirmQuotationToInvoice(qt)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition"
                                      title="Convert Quotation to Invoice"
                                    >
                                      <ArrowRightCircle className="w-3.5 h-3.5" />
                                      <span>Invoice</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => editQuotation(qt)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                                      title="Edit Quotation"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                      <span>Edit</span>
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => duplicateQuotation(qt)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200/80 transition"
                                  title="Duplicate as New Draft Quotation"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadQuotationDirect(qt)}
                                  disabled={isDownloadingPDF}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition disabled:opacity-50"
                                  title="Download Quotation as PDF"
                                >
                                  {isDownloadingPDF && downloadingQuoteId === qt.id ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>PDF...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-3.5 h-3.5" />
                                      <span>PDF</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openQuotationPreview(qt)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition"
                                  title="Preview & Print"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Print</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })()}

        {/* ================================================================ */}
        {/* TAB 3: INVOICES LIST                                             */}
        {/* ================================================================ */}
        {activeTab === 'invoices' && (() => {
          const totalBilled = invoices.reduce((acc, inv) => acc + Number(inv.grand_total || 0), 0);
          const totalCollected = invoices.reduce((acc, inv) => acc + Number(inv.paid_amount || 0), 0);
          const totalDue = invoices.reduce((acc, inv) => acc + Number(inv.balance_due || 0), 0);
          const paidCount = invoices.filter((inv) => Number(inv.balance_due || 0) <= 0).length;
          const dueCount = invoices.length - paidCount;

          const filteredInvoices = invoices.filter((inv) => {
            if (filterInvoiceStatus === 'PAID' && inv.balance_due > 0) return false;
            if (filterInvoiceStatus === 'DUE' && inv.balance_due <= 0) return false;
            const q = searchInvoices.trim().toLowerCase();
            if (!q) return true;
            const serialMatch = (inv.items || []).some((it) =>
              (it.serial_numbers || []).some((sn) => sn.toLowerCase().includes(q))
            );
            return (
              inv.invoice_no.toLowerCase().includes(q) ||
              inv.customer_name.toLowerCase().includes(q) ||
              (inv.customer_phone || '').toLowerCase().includes(q) ||
              (inv.subject || '').toLowerCase().includes(q) ||
              (inv.description || '').toLowerCase().includes(q) ||
              (inv.cheque_no || '').toLowerCase().includes(q) ||
              (inv.cheque_bank || '').toLowerCase().includes(q) ||
              (inv.payment_ref || '').toLowerCase().includes(q) ||
              serialMatch
            );
          });

          return (
          <section className="space-y-4">
            {/* Summary KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Invoices</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{invoices.length}</div>
              </div>
              <div className="bg-white rounded-2xl border border-indigo-200/90 p-4 shadow-2xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Total Billed</div>
                <div className="text-xl font-extrabold text-indigo-800 mt-1 tabular-nums">{fmtMoney(totalBilled)}</div>
              </div>
              <div className="bg-white rounded-2xl border border-emerald-200/90 p-4 shadow-2xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Collected</div>
                <div className="text-xl font-extrabold text-emerald-700 mt-1 tabular-nums">{fmtMoney(totalCollected)}</div>
              </div>
              <button
                type="button"
                onClick={() => setFilterInvoiceStatus('DUE')}
                className="text-left bg-white hover:bg-rose-50/40 rounded-2xl border border-rose-200/90 p-4 shadow-2xs transition"
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Balance Due ({dueCount})</div>
                <div className="text-xl font-extrabold text-rose-600 mt-1 tabular-nums">{fmtMoney(totalDue)}</div>
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Invoices (බිල්පත් ලැයිස්තුව)</h2>
                  <p className="text-xs text-slate-500">
                    සියලුම විකුණුම් බිල්පත්, Serial Numbers සහ Credit / Balance ගෙවීම් මෙතැනින් බලාගන්න.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold">
                  {([
                    { id: 'ALL', label: `All (${invoices.length})` },
                    { id: 'PAID', label: `Paid (${paidCount})` },
                    { id: 'DUE', label: `Due (${dueCount})` },
                  ] as const).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterInvoiceStatus(tab.id)}
                      className={`px-3 py-1 rounded-lg transition ${
                        filterInvoiceStatus === tab.id
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchInvoices}
                    onChange={(e) => setSearchInvoices(e.target.value)}
                    placeholder="Search INV #, Customer, S/N..."
                    className="pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm w-64 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition"
                  />
                  {searchInvoices && (
                    <button
                      type="button"
                      onClick={() => setSearchInvoices('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetBillingForm();
                    setBillingMode('INVOICE');
                    setActiveTab('billing');
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Invoice</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Invoice No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items, Description &amp; Serials</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-right">Paid / Balance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm text-slate-500">
                        No invoices match your current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 align-top transition">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-indigo-700">{inv.invoice_no}</div>
                          {inv.quote_no && (
                            <div className="text-[11px] text-slate-400">From {inv.quote_no}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">{inv.created_at}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{inv.customer_name}</div>
                          <div className="text-xs text-slate-500">{inv.customer_phone}</div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 space-y-1">
                          {inv.subject && (
                            <div className="font-bold text-indigo-900">{inv.subject}</div>
                          )}
                          {inv.description && (
                            <div className="text-slate-700 italic text-[11px] line-clamp-2">{inv.description}</div>
                          )}
                          {(inv.items || []).map((it, i) => (
                            <div key={i}>
                              • <b>{it.item_name}</b> (x{it.qty})
                              {it.serial_numbers && it.serial_numbers.length > 0 && (
                                <span className="font-mono text-[11px] text-indigo-700 ml-1">
                                  [S/N: {it.serial_numbers.join(', ')}]
                                </span>
                              )}
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                          {fmtMoney(inv.grand_total)}
                        </td>
                        <td className="py-3 px-4 text-right text-xs whitespace-nowrap">
                          <div className="text-emerald-700 font-bold tabular-nums">
                            Paid: {fmtMoney(inv.paid_amount)}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            {inv.payment_method || 'Cash'}
                          </div>
                          {inv.cheque_no && (
                            <div className="text-[10px] text-amber-800 font-mono bg-amber-50 rounded px-1.5 py-0.5 mt-0.5 border border-amber-200 inline-block text-left">
                              CHQ #{inv.cheque_no} {inv.cheque_bank ? `(${inv.cheque_bank})` : ''}
                            </div>
                          )}
                          {!inv.cheque_no && inv.cheque_date && (
                            <div
                              className={`text-[10px] font-bold rounded px-1.5 py-0.5 mt-0.5 border inline-block ${
                                inv.balance_due > 0 && inv.cheque_date < new Date().toISOString().slice(0, 10)
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              Due Date: {inv.cheque_date}
                            </div>
                          )}
                          {inv.balance_due > 0 && (
                            <div className="text-rose-600 font-bold mt-0.5 tabular-nums">
                              Due: {fmtMoney(inv.balance_due)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {inv.balance_due <= 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>PAID</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 tabular-nums">
                              DUE: {fmtMoney(inv.balance_due)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {inv.balance_due > 0 && (
                              <button
                                type="button"
                                onClick={() => settleInvoiceBalance(inv)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-2xs transition"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                <span>Pay</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => downloadInvoiceDirect(inv)}
                              disabled={isDownloadingPDF}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition disabled:opacity-50"
                              title="Download Invoice as PDF"
                            >
                              {isDownloadingPDF && downloadingInvoiceId === inv.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>PDF...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  <span>PDF</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => openInvoicePreview(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
          );
        })()}

        {/* ================================================================ */}
        {/* TAB 3B: SALES REPORTS (EN / SI / BILINGUAL)                      */}
        {/* ================================================================ */}
        {activeTab === 'reports' && (() => {
          const rt = (en: string, si: string) =>
            reportLang === 'EN' ? en : reportLang === 'SI' ? si : `${en} (${si})`;

          const todayStr = new Date().toISOString().slice(0, 10);
          const getDateStr = (raw: string) => {
            if (!raw) return '';
            return raw.slice(0, 10);
          };

          let effectiveStart = reportStartDate;
          let effectiveEnd = reportEndDate;
          if (reportDatePreset === 'TODAY') {
            effectiveStart = todayStr;
            effectiveEnd = todayStr;
          } else if (reportDatePreset === 'WEEK') {
            const d = new Date();
            d.setDate(d.getDate() - 6);
            effectiveStart = d.toISOString().slice(0, 10);
            effectiveEnd = todayStr;
          } else if (reportDatePreset === 'MONTH') {
            const d = new Date();
            effectiveStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
            effectiveEnd = todayStr;
          } else if (reportDatePreset === 'ALL') {
            effectiveStart = '';
            effectiveEnd = '';
          }

          const q = reportSearch.trim().toLowerCase();
          const filteredReportInvoices = invoices.filter((inv) => {
            const dStr = getDateStr(inv.created_at);
            if (effectiveStart && dStr && dStr < effectiveStart) return false;
            if (effectiveEnd && dStr && dStr > effectiveEnd) return false;
            if (reportPaymentMethod !== 'ALL' && (inv.payment_method || 'Cash') !== reportPaymentMethod) {
              return false;
            }
            if (reportStatus === 'PAID' && Number(inv.balance_due || 0) > 0) return false;
            if (reportStatus === 'DUE' && Number(inv.balance_due || 0) <= 0) return false;
            if (q) {
              const matchInv = (inv.invoice_no || '').toLowerCase().includes(q);
              const matchCust = (inv.customer_name || '').toLowerCase().includes(q);
              const matchPhone = (inv.customer_phone || '').toLowerCase().includes(q);
              const matchItem = (inv.items || []).some((it) =>
                (it.item_name || '').toLowerCase().includes(q)
              );
              if (!matchInv && !matchCust && !matchPhone && !matchItem) return false;
            }
            return true;
          });

          const totalSales = filteredReportInvoices.reduce((s, inv) => s + Number(inv.grand_total || 0), 0);
          const totalCollected = filteredReportInvoices.reduce((s, inv) => s + Number(inv.paid_amount || 0), 0);
          const totalDue = filteredReportInvoices.reduce((s, inv) => s + Number(inv.balance_due || 0), 0);
          const totalDiscount = filteredReportInvoices.reduce((s, inv) => s + Number(inv.discount || 0), 0);
          const totalVat = filteredReportInvoices.reduce((s, inv) => s + Number(inv.tax_amount || 0), 0);
          const avgInvoice = filteredReportInvoices.length > 0 ? totalSales / filteredReportInvoices.length : 0;
          const collectionPct = totalSales > 0 ? Math.round((totalCollected / totalSales) * 100) : 0;

          // Payment method breakdown
          const pmMap: Record<string, { count: number; total: number; paid: number }> = {};
          filteredReportInvoices.forEach((inv) => {
            const method = inv.payment_method || 'Cash';
            if (!pmMap[method]) pmMap[method] = { count: 0, total: 0, paid: 0 };
            pmMap[method].count += 1;
            pmMap[method].total += Number(inv.grand_total || 0);
            pmMap[method].paid += Number(inv.paid_amount || 0);
          });
          const paymentBreakdown = Object.entries(pmMap).sort((a, b) => b[1].total - a[1].total);

          // Top selling items
          const itemMap: Record<string, { qty: number; revenue: number; invoices: number }> = {};
          filteredReportInvoices.forEach((inv) => {
            (inv.items || []).forEach((it) => {
              const name = (it.item_name || 'Unnamed Item').trim();
              if (!itemMap[name]) itemMap[name] = { qty: 0, revenue: 0, invoices: 0 };
              const qty = Number(it.qty || 1);
              const rev =
                it.line_total !== undefined
                  ? Number(it.line_total)
                  : Math.max(0, qty * Number(it.unit_price || 0) - Number(it.item_discount || 0)) +
                    Number(it.vat_amount || 0);
              itemMap[name].qty += qty;
              itemMap[name].revenue += rev;
              itemMap[name].invoices += 1;
            });
          });
          const topItems = Object.entries(itemMap)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 10);

          // Daily breakdown
          const dailyMap: Record<string, { count: number; total: number; paid: number; due: number }> = {};
          filteredReportInvoices.forEach((inv) => {
            const dStr = getDateStr(inv.created_at) || 'Unknown';
            if (!dailyMap[dStr]) dailyMap[dStr] = { count: 0, total: 0, paid: 0, due: 0 };
            dailyMap[dStr].count += 1;
            dailyMap[dStr].total += Number(inv.grand_total || 0);
            dailyMap[dStr].paid += Number(inv.paid_amount || 0);
            dailyMap[dStr].due += Number(inv.balance_due || 0);
          });
          const dailyRows = Object.entries(dailyMap).sort((a, b) => b[0].localeCompare(a[0]));

          const exportSalesCsv = () => {
            const headers = [
              rt('Invoice No', 'බිල්පත් අංකය'),
              rt('Date', 'දිනය'),
              rt('Customer', 'පාරිභෝගිකයා'),
              rt('Phone', 'දුරකථන අංකය'),
              rt('Payment Method', 'ගෙවීම් ක්‍රමය'),
              rt('Status', 'තත්ත්වය'),
              rt('Subtotal', 'උප එකතුව'),
              
              rt('Discount', 'වට්ටම'),
              rt('Grand Total', 'මුළු මුදල'),
              rt('Paid Amount', 'ගෙවූ මුදල'),
              rt('Balance Due', 'හිඟ මුදල'),
            ];
            const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const rows = filteredReportInvoices.map((inv) => [
              inv.invoice_no,
              getDateStr(inv.created_at),
              inv.customer_name || 'Walk-in',
              inv.customer_phone || '',
              inv.payment_method || 'Cash',
              inv.payment_status,
              Number(inv.subtotal || 0).toFixed(2),
              Number(inv.tax_amount || 0).toFixed(2),
              Number(inv.discount || 0).toFixed(2),
              Number(inv.grand_total || 0).toFixed(2),
              Number(inv.paid_amount || 0).toFixed(2),
              Number(inv.balance_due || 0).toFixed(2),
            ]);
            // UTF-8 BOM (\uFEFF) ensures Excel displays Sinhala characters properly
            const csv = '\uFEFF' + [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sales-report-${reportLang.toLowerCase()}-${effectiveStart || 'all'}-to-${effectiveEnd || todayStr}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast(rt('Sales report CSV downloaded!', 'විකුණුම් වාර්තාව CSV ලෙස බාගත විය!'));
          };

          const printSalesReport = () => {
            const win = window.open('', '_blank', 'width=1060,height=800');
            if (!win) {
              showToast('Popup blocked — please allow popups to print report.');
              return;
            }
            const escHtml = (val: unknown) =>
              String(val ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');

            const rangeLabel =
              reportDatePreset === 'ALL'
                ? rt('All Time', 'සියලු කාලය')
                : `${effectiveStart || ''} → ${effectiveEnd || todayStr}`;
            const nowStr = new Date().toLocaleString('en-LK', {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });

            const dailyRowsHtml = dailyRows
              .map(
                ([dateStr, d]) => `
                  <tr>
                    <td><b>${escHtml(dateStr)}</b></td>
                    <td style="text-align:center">${d.count}</td>
                    <td style="text-align:right"><b>${fmtMoney(d.total)}</b></td>
                    <td style="text-align:right">${fmtMoney(d.paid)}</td>
                    <td style="text-align:right">${fmtMoney(d.due)}</td>
                  </tr>`
              )
              .join('');

            const rowsHtml = filteredReportInvoices
              .map((inv, idx) => {
                const statusCls =
                  inv.payment_status === 'PAID'
                    ? 'badge-paid'
                    : inv.payment_status === 'PARTIAL'
                    ? 'badge-partial'
                    : 'badge-unpaid';
                return `
                <tr>
                  <td style="text-align:center">${idx + 1}</td>
                  <td><b>${escHtml(inv.invoice_no)}</b></td>
                  <td>${escHtml(getDateStr(inv.created_at))}</td>
                  <td>${escHtml(inv.customer_name || 'Walk-in')}</td>
                  <td>${escHtml(inv.payment_method || 'Cash')}</td>
                  <td><span class="badge ${statusCls}">${escHtml(inv.payment_status)}</span></td>
                  <td style="text-align:right; font-weight:700">${fmtMoney(inv.grand_total)}</td>
                  <td style="text-align:right">${fmtMoney(inv.paid_amount)}</td>
                  <td style="text-align:right">${fmtMoney(inv.balance_due)}</td>
                </tr>`;
              })
              .join('');

            win.document.write(`
              <!doctype html>
              <html>
              <head>
                <meta charset="utf-8" />
                <title>${escHtml(rt('Sales Report', 'විකුණුම් වාර්තාව'))} - ${escHtml(rangeLabel)}</title>
                <style>
                  @page { size: A4; margin: 12mm; }
                  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                  body { font-family: 'Noto Sans Sinhala', 'Inter', system-ui, -apple-system, sans-serif; margin: 0; padding: 18px; color: #000; background: #fff; font-size: 11px; line-height: 1.45; }
                  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; gap: 16px; }
                  .shop-name { font-size: 17px; font-weight: 800; color: #000; margin: 0; letter-spacing: -0.01em; }
                  .shop-sub { font-size: 10.5px; color: #000; margin-top: 2px; }
                  .report-badge-box { text-align: right; }
                  .report-badge { display: inline-block; background: #000; color: #fff; font-weight: 800; font-size: 11px; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.04em; text-transform: uppercase; }
                  .meta-grid { margin-top: 6px; font-size: 10.5px; color: #000; }
                  .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #000; margin: 0 0 6px; padding-left: 7px; border-left: 3px solid #000; }
                  .section-block { margin-bottom: 16px; break-inside: avoid; }
                  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
                  th, td { border: 1px solid #000; padding: 5px 7px; text-align: left; color: #000; }
                  th { background: #e5e5e5; font-weight: 800; color: #000; font-size: 10px; text-transform: uppercase; }
                  tbody tr:nth-child(even) { background: #f5f5f5; }
                  tfoot td { background: #e5e5e5; font-weight: 800; border-top: 2px solid #000; color: #000; }
                  .badge { display: inline-block; padding: 1.5px 6px; border-radius: 999px; font-size: 9px; font-weight: 700; border: 1px solid #000; color: #000; }
                  .badge-paid { background: #fff; }
                  .badge-partial { background: #e5e5e5; }
                  .badge-unpaid { background: #000; color: #fff; }
                  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 30px; padding-top: 10px; break-inside: avoid; }
                  .sig-line { border-top: 1px dashed #000; padding-top: 5px; text-align: center; font-size: 10px; color: #000; font-weight: 600; }
                  .footer-note { margin-top: 14px; text-align: center; font-size: 9.5px; color: #000; border-top: 1px solid #000; padding-top: 8px; }
                </style>
              </head>
              <body>
                <div class="header">
                  <div>
                    <h1 class="shop-name">${escHtml(settings.shop_name || 'Smart POS System')}</h1>
                    ${settings.shop_tagline ? `<div class="shop-sub">${escHtml(settings.shop_tagline)}</div>` : ''}
                    <div class="shop-sub">
                      ${escHtml(settings.shop_address || '')}${settings.shop_phone ? ` • Tel: ${escHtml(settings.shop_phone)}` : ''}
                    </div>
                    ${settings.branch_location ? `<div class="shop-sub"><b>Branch:</b> ${escHtml(settings.branch_location)}</div>` : ''}
                  </div>
                  <div class="report-badge-box">
                    <span class="report-badge">${escHtml(rt('Sales Report', 'විකුණුම් වාර්තාව'))}</span>
                    <div class="meta-grid">
                      <div><b>${escHtml(rt('Period', 'කාල සීමාව'))}:</b> ${escHtml(rangeLabel)}</div>
                      <div><b>${escHtml(rt('Generated', 'සකස් කළ දිනය'))}:</b> ${escHtml(nowStr)}</div>
                      <div><b>${escHtml(rt('Filter', 'පෙරහන'))}:</b> ${escHtml(reportPaymentMethod)} / ${escHtml(reportStatus)} (${filteredReportInvoices.length} ${escHtml(rt('Invoices', 'බිල්පත්'))})</div>
                    </div>
                  </div>
                </div>

                ${
                  dailyRows.length > 0
                    ? `<div class="section-block">
                        <h3 class="section-title">${escHtml(rt('Daily Sales Summary', 'දෛනික විකුණුම් සාරාංශය'))} (${dailyRows.length})</h3>
                        <table>
                          <thead>
                            <tr>
                              <th>${escHtml(rt('Date', 'දිනය'))}</th>
                              <th style="text-align:center">${escHtml(rt('Invoices', 'බිල්පත්'))}</th>
                              <th style="text-align:right">${escHtml(rt('Total Sales', 'මුළු විකුණුම්'))}</th>
                              <th style="text-align:right">${escHtml(rt('Collected', 'ලැබුණු මුදල'))}</th>
                              <th style="text-align:right">${escHtml(rt('Balance Due', 'හිඟ මුදල'))}</th>
                            </tr>
                          </thead>
                          <tbody>${dailyRowsHtml}</tbody>
                        </table>
                      </div>`
                    : ''
                }

                <div class="section-block">
                  <h3 class="section-title">${escHtml(rt('Detailed Sales Transactions', 'සවිස්තරාත්මක විකුණුම් ලැයිස්තුව'))} (${filteredReportInvoices.length})</h3>
                  <table>
                    <thead>
                      <tr>
                        <th style="text-align:center">#</th>
                        <th>${escHtml(rt('Invoice #', 'බිල්පත් අංකය'))}</th>
                        <th>${escHtml(rt('Date', 'දිනය'))}</th>
                        <th>${escHtml(rt('Customer', 'පාරිභෝගිකයා'))}</th>
                        <th>${escHtml(rt('Method', 'ක්‍රමය'))}</th>
                        <th>${escHtml(rt('Status', 'තත්ත්වය'))}</th>
                        <th style="text-align:right">${escHtml(rt('Grand Total', 'මුළු මුදල'))}</th>
                        <th style="text-align:right">${escHtml(rt('Paid', 'ගෙවූ'))}</th>
                        <th style="text-align:right">${escHtml(rt('Balance Due', 'හිඟ මුදල'))}</th>
                      </tr>
                    </thead>
                    <tbody>${rowsHtml || `<tr><td colspan="9" style="text-align:center">-</td></tr>`}</tbody>
                    <tfoot>
                      <tr>
                        <td colspan="6" style="text-align:right">${escHtml(rt('GRAND TOTALS', 'මුළු එකතුව'))} (${filteredReportInvoices.length} ${escHtml(rt('Invoices', 'බිල්පත්'))})</td>
                        <td style="text-align:right">${fmtMoney(totalSales)}</td>
                        <td style="text-align:right">${fmtMoney(totalCollected)}</td>
                        <td style="text-align:right">${fmtMoney(totalDue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div class="signatures">
                  <div class="sig-line">${escHtml(rt('Prepared By', 'සකස් කළේ'))}${settings.cashier_name ? ` (${escHtml(settings.cashier_name)})` : ''}</div>
                  <div class="sig-line">${escHtml(rt('Checked By', 'පරීක්ෂා කළේ'))}</div>
                  <div class="sig-line">${escHtml(rt('Authorized Signature', 'අනුමත අත්සන'))}</div>
                </div>

                <div class="footer-note">
                  ${escHtml(settings.shop_name || 'Smart POS System')} • ${escHtml(rt('System Generated Sales Report', 'පද්ධතියෙන් සකස් කළ විකුණුම් වාර්තාව'))}
                </div>
              </body>
              </html>
            `);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 300);
          };

          const pmColors: Record<string, string> = {
            Cash: 'bg-emerald-500',
            'Bank Transfer': 'bg-sky-500',
            Card: 'bg-indigo-500',
            Cheque: 'bg-amber-500',
            Credit: 'bg-rose-500',
          };

          return (
            <section className="space-y-5">
              {/* Header, Language Switcher & Filter Bar */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                        {rt('Sales Reports', 'විකුණුම් වාර්තා')}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {reportLang === 'SI'
                          ? 'දින පරාසය, ගෙවීම් ක්‍රමය සහ භාණ්ඩ අනුව සම්පූර්ණ විකුණුම් වාර්තා බලන්න, Print කරන්න හෝ CSV Export කරන්න.'
                          : reportLang === 'EN'
                          ? 'Analyze sales by date range, payment method, and top items. Print or export as CSV.'
                          : 'Analyze sales by date, payment method & items • Print or CSV Export (සිංහල / English)'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Report Language Toggle */}
                    <div
                      className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold"
                      title="Report Language (වාර්තා භාෂාව)"
                    >
                      {([
                        { id: 'EN', label: 'English' },
                        { id: 'SI', label: 'සිංහල' },
                        { id: 'BOTH', label: 'EN + සිංහල' },
                      ] as const).map((lng) => (
                        <button
                          key={lng.id}
                          type="button"
                          onClick={() => setReportLang(lng.id)}
                          className={`px-2.5 py-1.5 rounded-lg transition ${
                            reportLang === lng.id
                              ? 'bg-white text-indigo-700 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {lng.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={exportSalesCsv}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 active:scale-95"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>{rt('Export CSV', 'CSV බාගන්න')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={printSalesReport}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 active:scale-95"
                    >
                      <Printer className="w-4 h-4" />
                      <span>{rt('Print Report', 'වාර්තාව Print')}</span>
                    </button>
                  </div>
                </div>

                {/* Date Presets & Always-Visible Calendar Pickers */}
                <div className="pt-3.5 border-t border-slate-100 flex flex-wrap items-center gap-3">
                  <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 border border-slate-200/80 text-xs font-semibold">
                    {([
                      { id: 'TODAY', en: 'Today', si: 'අද' },
                      { id: 'WEEK', en: 'Last 7 Days', si: 'දින 7' },
                      { id: 'MONTH', en: 'This Month', si: 'මෙම මස' },
                      { id: 'ALL', en: 'All Time', si: 'සියල්ල' },
                      { id: 'CUSTOM', en: 'Custom', si: 'දින තෝරන්න' },
                    ] as const).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setReportDatePreset(p.id);
                          const now = new Date();
                          const tStr = now.toISOString().slice(0, 10);
                          if (p.id === 'TODAY') {
                            setReportStartDate(tStr);
                            setReportEndDate(tStr);
                          } else if (p.id === 'WEEK') {
                            const w = new Date();
                            w.setDate(w.getDate() - 6);
                            setReportStartDate(w.toISOString().slice(0, 10));
                            setReportEndDate(tStr);
                          } else if (p.id === 'MONTH') {
                            setReportStartDate(
                              `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
                            );
                            setReportEndDate(tStr);
                          } else if (p.id === 'ALL') {
                            setReportStartDate('');
                            setReportEndDate('');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg transition ${
                          reportDatePreset === p.id
                            ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {reportLang === 'SI' ? p.si : p.en}
                      </button>
                    ))}
                  </div>

                  {/* Always-Visible Calendar Date Range Picker */}
                  <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/90 text-xs">
                    <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500">
                      {rt('From', 'සිට')}:
                    </span>
                    <input
                      type="date"
                      value={effectiveStart}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReportDatePreset('CUSTOM');
                        setReportStartDate(val);
                        if (!reportEndDate) setReportEndDate(val);
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-white focus:border-indigo-500 outline-none font-semibold text-slate-800"
                    />
                    <span className="text-slate-400 font-bold">→</span>
                    <span className="text-[11px] font-bold text-slate-500">
                      {rt('To', 'දක්වා')}:
                    </span>
                    <input
                      type="date"
                      value={effectiveEnd}
                      onChange={(e) => {
                        setReportDatePreset('CUSTOM');
                        setReportEndDate(e.target.value);
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-white focus:border-indigo-500 outline-none font-semibold text-slate-800"
                    />
                    {effectiveStart && effectiveStart !== effectiveEnd && (
                      <button
                        type="button"
                        onClick={() => {
                          setReportDatePreset('CUSTOM');
                          setReportEndDate(effectiveStart);
                        }}
                        className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] border border-indigo-200 transition"
                        title="Filter for this single selected day only"
                      >
                        {rt('Only This Day', 'එම දිනය පමණක්')}
                      </button>
                    )}
                  </div>

                  <select
                    value={reportPaymentMethod}
                    onChange={(e) => setReportPaymentMethod(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:border-indigo-500 outline-none"
                  >
                    <option value="ALL">{rt('All Methods', 'සියලු ගෙවීම් ක්‍රම')}</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit">Credit</option>
                  </select>

                  <select
                    value={reportStatus}
                    onChange={(e) => setReportStatus(e.target.value as 'ALL' | 'PAID' | 'DUE')}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:border-indigo-500 outline-none"
                  >
                    <option value="ALL">{rt('All Statuses', 'සියලු තත්ත්වයන්')}</option>
                    <option value="PAID">{rt('Paid Only', 'ගෙවූ බිල්පත්')}</option>
                    <option value="DUE">{rt('Balance Due', 'හිඟ බිල්පත්')}</option>
                  </select>

                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      placeholder={rt('Search INV #, Customer, Item...', 'බිල්පත් අංකය, පාරිභෝගිකයා, භාණ්ඩය...')}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {rt('Total Sales', 'මුළු විකුණුම්')}
                    </span>
                    <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-2">{fmtMoney(totalSales)}</div>
                  <div className="text-xs text-slate-500 mt-1.5">
                    {filteredReportInvoices.length} {rt('Invoices', 'බිල්පත්')} • {rt('Avg', 'සාමාන්‍ය')} {fmtMoney(avgInvoice)}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-emerald-200/80 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      {rt('Total Collected', 'ලැබුණු මුදල')}
                    </span>
                    <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-700 mt-2">
                    {fmtMoney(totalCollected)}
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${collectionPct}%` }} />
                    </div>
                    <div className="text-[11px] text-emerald-700 font-semibold">
                      {collectionPct}% {rt('collected', 'එකතු කර ඇත')}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-rose-200/80 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                      {rt('Balance Due', 'හිඟ මුදල')}
                    </span>
                    <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Wallet className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-rose-600 mt-2">{fmtMoney(totalDue)}</div>
                  <div className="text-xs text-rose-500 mt-1.5 font-medium">
                    {filteredReportInvoices.filter((i) => Number(i.balance_due || 0) > 0).length}{' '}
                    {rt('Unpaid / Partial Invoices', 'නොගෙවූ / අර්ධ බිල්පත්')}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {rt('Discounts & VAT', 'වට්ටම් සහ බදු')}
                    </span>
                    <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                      <Receipt className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 mt-2">
                    {rt('Disc', 'වට්ටම්')}: {fmtMoney(totalDiscount)}
                  </div>
                  <div className="text-xs text-indigo-700 font-semibold mt-1.5">
                    {rt('Total VAT', 'මුළු බදු')}: {fmtMoney(totalVat)}
                  </div>
                </div>
              </div>

              {/* Payment Method Breakdown + Top Selling Items */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Payment Method Breakdown */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2.5">
                    {rt('Sales by Payment Method', 'ගෙවීම් ක්‍රමය අනුව විකුණුම්')}
                  </h3>
                  {paymentBreakdown.length === 0 ? (
                    <div className="text-xs text-slate-400 py-8 text-center">
                      {rt('No invoices in this period.', 'මෙම කාල සීමාවේ බිල්පත් නොමැත.')}
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {paymentBreakdown.map(([method, data]) => {
                        const pct = totalSales > 0 ? Math.round((data.total / totalSales) * 100) : 0;
                        const barColor = pmColors[method] || 'bg-indigo-600';
                        return (
                          <div key={method} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800">
                                {method}{' '}
                                <span className="text-slate-400 font-normal">
                                  ({data.count} {rt('inv', 'බිල්')})
                                </span>
                              </span>
                              <span className="font-bold text-slate-900">
                                {fmtMoney(data.total)} <span className="text-slate-400 font-normal">({pct}%)</span>
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Top Selling Items */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2.5">
                    {rt('Top Selling Items', 'වැඩියෙන්ම අලෙවි වූ භාණ්ඩ')}
                  </h3>
                  {topItems.length === 0 ? (
                    <div className="text-xs text-slate-400 py-8 text-center">
                      {rt('No item sales in this period.', 'මෙම කාල සීමාවේ භාණ්ඩ විකුණුම් නොමැත.')}
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs pr-1">
                      {topItems.map(([name, data], idx) => {
                        const revShare = totalSales > 0 ? Math.round((data.revenue / totalSales) * 100) : 0;
                        return (
                          <div key={name} className="py-2.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center shrink-0 text-[11px] ${
                                  idx === 0
                                    ? 'bg-amber-100 text-amber-800'
                                    : idx === 1
                                    ? 'bg-slate-200 text-slate-700'
                                    : idx === 2
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-indigo-50 text-indigo-700'
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 truncate">{name}</div>
                                <div className="text-[11px] text-slate-400">
                                  {rt('Qty', 'ප්‍රමාණය')}: <b>{data.qty}</b> • {data.invoices} {rt('Inv', 'බිල්')} • {revShare}%
                                </div>
                              </div>
                            </div>
                            <div className="font-extrabold text-slate-900 shrink-0">{fmtMoney(data.revenue)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Daily Summary */}
              {dailyRows.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      {rt('Daily Sales Summary', 'දෛනික විකුණුම් සාරාංශය')} ({dailyRows.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-500 bg-slate-50/40">
                          <th className="py-2.5 px-5">{rt('Date', 'දිනය')}</th>
                          <th className="py-2.5 px-4 text-center">{rt('Invoices', 'බිල්පත්')}</th>
                          <th className="py-2.5 px-4 text-right">{rt('Total Sales', 'මුළු විකුණුම්')}</th>
                          <th className="py-2.5 px-4 text-right">{rt('Collected', 'ලැබුණු මුදල')}</th>
                          <th className="py-2.5 px-5 text-right">{rt('Balance Due', 'හිඟ මුදල')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dailyRows.map(([dateStr, d]) => (
                          <tr key={dateStr} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-5 font-bold text-slate-800">{dateStr}</td>
                            <td className="py-2.5 px-4 text-center font-semibold text-slate-600">{d.count}</td>
                            <td className="py-2.5 px-4 text-right font-bold text-slate-900">{fmtMoney(d.total)}</td>
                            <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">{fmtMoney(d.paid)}</td>
                            <td className="py-2.5 px-5 text-right font-semibold text-rose-600">{fmtMoney(d.due)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detailed Sales Invoices Table */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {rt('Detailed Sales Transactions', 'සවිස්තරාත්මක විකුණුම් ලැයිස්තුව')} ({filteredReportInvoices.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-500 bg-slate-50/40">
                        <th className="py-2.5 px-5">{rt('Invoice #', 'බිල්පත් අංකය')}</th>
                        <th className="py-2.5 px-4">{rt('Date', 'දිනය')}</th>
                        <th className="py-2.5 px-4">{rt('Customer', 'පාරිභෝගිකයා')}</th>
                        <th className="py-2.5 px-4">{rt('Method', 'ක්‍රමය')}</th>
                        <th className="py-2.5 px-4">{rt('Status', 'තත්ත්වය')}</th>
                        <th className="py-2.5 px-4 text-right">{rt('Grand Total', 'මුළු මුදල')}</th>
                        <th className="py-2.5 px-4 text-right">{rt('Paid', 'ගෙවූ')}</th>
                        <th className="py-2.5 px-4 text-right">{rt('Balance Due', 'හිඟ මුදල')}</th>
                        <th className="py-2.5 px-5 text-right">{rt('Action', 'ක්‍රියාව')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredReportInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-slate-400">
                            {rt('No matching sales records found.', 'ගැලපෙන විකුණුම් වාර්තා හමු නොවීය.')}
                          </td>
                        </tr>
                      ) : (
                        filteredReportInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-5 font-bold text-indigo-700">{inv.invoice_no}</td>
                            <td className="py-2.5 px-4 text-slate-600">{getDateStr(inv.created_at)}</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-800">
                              {inv.customer_name || 'Walk-in'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">{inv.payment_method || 'Cash'}</td>
                            <td className="py-2.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  inv.payment_status === 'PAID'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : inv.payment_status === 'PARTIAL'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {inv.payment_status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                              {fmtMoney(inv.grand_total)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">
                              {fmtMoney(inv.paid_amount)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-rose-600">
                              {fmtMoney(inv.balance_due)}
                            </td>
                            <td className="py-2.5 px-5 text-right">
                              <button
                                type="button"
                                onClick={() => openInvoicePreview(inv)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-[11px]"
                              >
                                {rt('View / Print', 'බලන්න / Print')}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ================================================================ */}
        {/* TAB 4: GRN (GOODS RECEIVED NOTE / STOCK IN)                      */}
        {/* ================================================================ */}
        {activeTab === 'grn' && (() => {
          const todayStr = new Date().toISOString().slice(0, 10);
          const nextWeek = new Date();
          nextWeek.setDate(nextWeek.getDate() + 7);
          const nextWeekStr = nextWeek.toISOString().slice(0, 10);

          const upcomingCheques = grns.filter((g) => {
            const rDate = String(g.cheque_reminder_date || '').trim();
            return rDate !== '' && rDate <= nextWeekStr;
          });

          return (
          <section className="space-y-5">
            {upcomingCheques.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col gap-2 shadow-xs">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-2">
                  <span>🔔 GRN Supplier Cheque Reminders ({upcomingCheques.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {upcomingCheques.map((g) => {
                    const rDate = String(g.cheque_reminder_date || '');
                    const isOverdue = rDate < todayStr;
                    const isToday = rDate === todayStr;
                    return (
                      <div
                        key={g.id}
                        className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 ${
                          isOverdue
                            ? 'bg-rose-50 border-rose-300 text-rose-900'
                            : isToday
                            ? 'bg-amber-100 border-amber-400 text-amber-950 font-bold'
                            : 'bg-white border-amber-200 text-slate-800'
                        }`}
                      >
                        <span className="font-bold">{g.grn_no}</span>
                        <span>• {g.supplier_name}</span>
                        {g.cheque_no && <span className="font-mono">(#{g.cheque_no})</span>}
                        <span className="font-bold">
                          {isOverdue ? 'Overdue:' : isToday ? 'Today:' : 'Reminder:'} {rDate}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    📦 New GRN — Goods Received Note (තොග ඇතුළත් කිරීම)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Supplier ගෙන් ගත් බඩු, ගත් මිල (Buying Price), විකුණන මිල (Selling Price), සහ Serial Numbers ඇතුළත් කරන්න.
                  </p>
                </div>
                <button
                  onClick={resetGrnForm}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                >
                  🔄 Reset GRN Form
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="relative">
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    value={grnSupplierName}
                    onChange={(e) => {
                      setGrnSupplierName(e.target.value);
                      setShowGrnSupplierSuggest(true);
                    }}
                    onFocus={() => setShowGrnSupplierSuggest(true)}
                    onBlur={() => setTimeout(() => setShowGrnSupplierSuggest(false), 180)}
                    placeholder="e.g. Singer / Barclays / TechZone"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition"
                  />
                  {showGrnSupplierSuggest && (() => {
                    const seen = new Set<string>();
                    const uniqueSuppliers = grns
                      .filter((g) => {
                        const nm = (g.supplier_name || '').trim();
                        if (!nm || seen.has(nm.toLowerCase())) return false;
                        seen.add(nm.toLowerCase());
                        return !grnSupplierName.trim() || nm.toLowerCase().includes(grnSupplierName.trim().toLowerCase());
                      })
                      .slice(0, 6);
                    if (!uniqueSuppliers.length) return null;
                    return (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                        {uniqueSuppliers.map((g) => (
                          <div
                            key={g.id}
                            onMouseDown={() => {
                              setGrnSupplierName(g.supplier_name || '');
                              if (g.supplier_phone) setGrnSupplierPhone(g.supplier_phone);
                              setShowGrnSupplierSuggest(false);
                            }}
                            className="px-3.5 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-none text-xs flex justify-between"
                          >
                            <span className="font-bold text-slate-800">{g.supplier_name}</span>
                            <span className="text-slate-500">{g.supplier_phone}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Supplier Phone
                  </label>
                  <input
                    type="text"
                    value={grnSupplierPhone}
                    onChange={(e) => setGrnSupplierPhone(e.target.value)}
                    placeholder="011-XXXXXXX"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Supplier Invoice / Ref No
                  </label>
                  <input
                    type="text"
                    value={grnRefNo}
                    onChange={(e) => setGrnRefNo(e.target.value)}
                    placeholder="SUP-INV-9921"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Note
                  </label>
                  <input
                    type="text"
                    value={grnNotes}
                    onChange={(e) => setGrnNotes(e.target.value)}
                    placeholder="Batch note..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-visible mb-4">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                      <th className="py-2.5 px-3 w-10">#</th>
                      <th className="py-2.5 px-3 min-w-[240px]">Item Name (Type existing or new)</th>
                      <th className="py-2.5 px-3 w-36">Warranty</th>
                      <th className="py-2.5 px-3 w-24 text-center">Qty</th>
                      <th className="py-2.5 px-3 min-w-[240px]">Received Serial Numbers</th>
                      <th className="py-2.5 px-3 w-36 text-right">Buying Cost (Rs.)</th>
                      <th className="py-2.5 px-3 w-36 text-right">Selling Price (Rs.)</th>
                      <th className="py-2.5 px-3 w-36 text-right">Line Cost</th>
                      <th className="py-2.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {grnRows.map((row, idx) => {
                      const clean = String(row.item_name || '').trim().toLowerCase();
                      const matches = items
                        .filter((it) => !clean || it.name.toLowerCase().includes(clean))
                        .slice(0, 6);
                      const lineCost = Number(row.qty || 1) * Number(row.buying_price || 0);

                      return (
                        <tr key={idx} className="align-top">
                          <td className="py-2.5 px-3 text-xs font-bold text-slate-400 pt-4">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 relative">
                            <input
                              type="text"
                              value={row.item_name}
                              onChange={(e) => {
                                updateGrnRow(idx, { item_name: e.target.value });
                                setActiveGrnSuggestRow(idx);
                              }}
                              onFocus={() => setActiveGrnSuggestRow(idx)}
                              onBlur={() =>
                                setTimeout(() => {
                                  setActiveGrnSuggestRow(null);
                                  setGrnRows((prev) => {
                                    const target = prev[idx];
                                    if (!target) return prev;
                                    const nm = String(target.item_name || '').trim();
                                    if (!nm || !target.serial_numbers.some((s) => !s.trim())) return prev;
                                    const used = collectUsedSerials(prev);
                                    return prev.map((r, rIdx) =>
                                      rIdx !== idx
                                        ? r
                                        : {
                                            ...r,
                                            serial_numbers: r.serial_numbers.map((s) =>
                                              s.trim() ? s : generateSerialCode(used, nm)
                                            ),
                                          }
                                    );
                                  });
                                }, 180)
                              }
                              placeholder="Type item name..."
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold"
                            />
                            {activeGrnSuggestRow === idx && matches.length > 0 && (
                              <div className="absolute left-3 right-3 top-11 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                                {matches.map((it) => (
                                  <div
                                    key={it.id}
                                    onMouseDown={() => {
                                      updateGrnRow(idx, {
                                        item_name: it.name,
                                        buying_price: it.buying_price,
                                        selling_price: it.selling_price,
                                        warranty_months: it.warranty_months,
                                        warranty_label: it.warranty_label,
                                      });
                                      setActiveGrnSuggestRow(null);
                                    }}
                                    className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-none flex justify-between text-xs"
                                  >
                                    <span className="font-bold text-slate-800">{it.name}</span>
                                    <span className="text-slate-500">
                                      Buy: {fmtMoney(it.buying_price)} | Sell: {fmtMoney(it.selling_price)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <WarrantySelector
                              compact
                              months={Number(row.warranty_months || 0)}
                              label={row.warranty_label || 'No Warranty'}
                              selectClassName="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:border-indigo-500 outline-none"
                              onChange={({ warranty_months, warranty_label }) =>
                                updateGrnRow(idx, { warranty_months, warranty_label })
                              }
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={row.qty}
                              onChange={(e) => updateGrnRow(idx, { qty: Number(e.target.value) })}
                              className="w-20 mx-auto block px-2.5 py-1.5 rounded-lg border border-slate-300 text-center font-bold text-sm"
                            />
                          </td>
                          <td className="py-2.5 px-3 space-y-1 max-h-36 overflow-y-auto">
                            {row.serial_numbers.map((sn, snIdx) => (
                              <div key={snIdx} className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-slate-400 w-9">
                                  #{snIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={sn}
                                  onChange={(e) => updateGrnRowSerial(idx, snIdx, e.target.value)}
                                  placeholder={`Received S/N #${snIdx + 1}`}
                                  className="w-full px-2 py-1 rounded border border-slate-300 text-xs font-mono"
                                />
                              </div>
                            ))}
                            {row.serial_numbers.some((s) => !s.trim()) && (
                              <button
                                type="button"
                                onClick={() => autoGenGrnRowSerials(idx)}
                                className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-semibold transition"
                                title="Auto-generate serial number(s) for this GRN row"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>Auto S/N</span>
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={row.buying_price}
                              onChange={(e) => updateGrnRow(idx, { buying_price: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-right text-sm font-semibold"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={row.selling_price}
                              onChange={(e) => updateGrnRow(idx, { selling_price: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-right text-sm font-bold text-indigo-700"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 pt-4">
                            {fmtMoney(lineCost)}
                          </td>
                          <td className="py-2.5 px-2 text-center pt-3">
                            <button
                              type="button"
                              onClick={() =>
                                setGrnRows((prev) =>
                                  prev.length <= 1
                                    ? [createEmptyGrnRow()]
                                    : prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="text-slate-400 hover:text-rose-600 font-bold"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGrnRows((prev) => [...prev, createEmptyGrnRow()])}
                      className="px-3.5 py-1.5 rounded-lg border border-dashed border-indigo-400 text-indigo-700 hover:bg-indigo-50 text-xs font-bold"
                    >
                      ＋ Add GRN Item Row
                    </button>
                    <button
                      type="button"
                      onClick={autoGenAllGrnSerials}
                      className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1"
                      title="Auto-generate unique serial numbers for all empty GRN rows"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto-Fill All S/Ns</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    {(() => {
                      const grnTotal = grnRows.reduce(
                        (acc, r) => acc + Number(r.qty || 1) * Number(r.buying_price || 0),
                        0
                      );
                      const grnPaid =
                        grnPaidAmount === '' ? grnTotal : Math.max(0, Number(grnPaidAmount || 0));
                      const grnBalance = Math.max(0, grnTotal - grnPaid);
                      return (
                        <>
                          <div className="text-sm text-slate-600">
                            Total GRN Cost:{' '}
                            <b className="text-lg text-slate-900">{fmtMoney(grnTotal)}</b>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-600 whitespace-nowrap">
                              Paid to Supplier (Rs.):
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              placeholder="Auto full amount"
                              value={grnPaidAmount}
                              onChange={(e) => setGrnPaidAmount(e.target.value)}
                              className="w-36 px-3 py-1.5 rounded-xl border border-slate-300 text-right font-bold text-emerald-700 text-sm bg-white focus:border-indigo-600 outline-none"
                            />
                          </div>
                          <div className="text-xs font-bold">
                            {grnBalance <= 0 ? (
                              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                FULL PAID
                              </span>
                            ) : (
                              <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                                Due: {fmtMoney(grnBalance)}
                              </span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={submitGrn}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow"
                    >
                      📥 Save GRN & Update Stock
                    </button>
                  </div>
                </div>

                {/* Supplier Payment Method & Cheque Reminder Details */}
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-3 bg-slate-50/70 p-3.5 rounded-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Supplier Payment Method (ගෙවීම් ක්‍රමය)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { val: 'Cash', label: 'Cash', icon: <Banknote className="w-3.5 h-3.5" /> },
                        { val: 'Bank Transfer', label: 'Bank / QR', icon: <Landmark className="w-3.5 h-3.5" /> },
                        { val: 'Card', label: 'Card', icon: <CreditCard className="w-3.5 h-3.5" /> },
                        { val: 'Cheque', label: 'Cheque', icon: <FileText className="w-3.5 h-3.5" /> },
                        { val: 'Credit', label: 'Credit', icon: <Wallet className="w-3.5 h-3.5" /> },
                      ].map((pm) => (
                        <button
                          key={pm.val}
                          type="button"
                          onClick={() => {
                            setGrnPaymentMethod(pm.val);
                            if (pm.val === 'Credit') {
                              if (grnPaidAmount === '') setGrnPaidAmount('0');
                              if (!grnCreditDueDate) {
                                const dNum = Number(grnCreditDays || 30);
                                const due = addDaysToTodayIso(Number.isNaN(dNum) ? 30 : dNum);
                                setGrnCreditDueDate(due);
                                if (!grnChequeReminderDate) setGrnChequeReminderDate(due);
                              }
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                            grnPaymentMethod === pm.val
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {pm.icon}
                          <span>{pm.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {grnPaymentMethod === 'Cheque' && (
                    <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 space-y-2 text-xs">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <span>📄 Supplier Cheque Details &amp; Reminder (චෙක්පත් විස්තර සහ මතක් කිරීම)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Cheque No (චෙක් අංකය)
                          </label>
                          <input
                            type="text"
                            value={grnChequeNo}
                            onChange={(e) => setGrnChequeNo(e.target.value)}
                            placeholder="e.g. 102938"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono font-bold bg-white focus:border-amber-600 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Bank Name (බැංකුව)
                          </label>
                          <input
                            type="text"
                            value={grnChequeBank}
                            onChange={(e) => setGrnChequeBank(e.target.value)}
                            placeholder="e.g. BOC / HNB / Sampath"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:border-amber-600 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Cheque Date (චෙක් දිනය)
                          </label>
                          <input
                            type="date"
                            value={grnChequeDate}
                            onChange={(e) => {
                              setGrnChequeDate(e.target.value);
                              if (!grnChequeReminderDate) {
                                setGrnChequeReminderDate(e.target.value);
                              }
                            }}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:border-amber-600 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-amber-900 mb-1">
                            🔔 Cheque Reminder Date (මතක් කිරීමේ දිනය)
                          </label>
                          <input
                            type="date"
                            value={grnChequeReminderDate}
                            onChange={(e) => setGrnChequeReminderDate(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-amber-400 bg-white font-semibold text-amber-900 focus:border-amber-600 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {grnPaymentMethod === 'Credit' && (
                    <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3 space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-rose-900 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-rose-600" />
                          <span>Supplier Credit Period (ණය ගෙවීමේ කාලය)</span>
                        </span>
                        {grnCreditDueDate && (
                          <span className="text-[10px] font-bold text-rose-700 bg-white px-2 py-0.5 rounded-full border border-rose-200">
                            Due: {grnCreditDueDate}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[7, 14, 30, 45, 60, 90].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              const due = addDaysToTodayIso(d);
                              setGrnCreditDays(String(d));
                              setGrnCreditDueDate(due);
                              setGrnChequeReminderDate(due);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                              grnCreditDays === String(d)
                                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-rose-200/80 hover:bg-rose-100/70'
                            }`}
                          >
                            {d} Days
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Credit Period (Days)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={3650}
                            value={grnCreditDays}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGrnCreditDays(val);
                              if (val !== '' && !Number.isNaN(Number(val))) {
                                const due = addDaysToTodayIso(Number(val));
                                setGrnCreditDueDate(due);
                                setGrnChequeReminderDate(due);
                              }
                            }}
                            placeholder="e.g. 30"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white focus:border-rose-500 outline-none tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Due Date (අවසන් දිනය)
                          </label>
                          <input
                            type="date"
                            value={grnCreditDueDate}
                            onChange={(e) => {
                              const dt = e.target.value;
                              setGrnCreditDueDate(dt);
                              setGrnCreditDays(daysBetweenTodayAndIso(dt));
                              if (dt) setGrnChequeReminderDate(dt);
                            }}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:border-rose-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-rose-900 mb-1">
                            🔔 Reminder Date
                          </label>
                          <input
                            type="date"
                            value={grnChequeReminderDate}
                            onChange={(e) => setGrnChequeReminderDate(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-rose-300 bg-white font-semibold text-rose-900 focus:border-rose-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {grnPaymentMethod === 'Bank Transfer' && (
                    <div className="bg-sky-50/90 border border-sky-200 rounded-xl p-3 space-y-2 text-xs">
                      <div className="font-bold text-sky-900">Bank Transfer / QR Reference</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={grnPaymentRef}
                          onChange={(e) => setGrnPaymentRef(e.target.value)}
                          placeholder="Transaction Ref / Slip No"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono bg-white focus:border-sky-600 outline-none"
                        />
                        <input
                          type="text"
                          value={grnChequeBank}
                          onChange={(e) => setGrnChequeBank(e.target.value)}
                          placeholder="Bank Name (e.g. BOC / Commercial)"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:border-sky-600 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-sm text-slate-800">
                Recent GRN History (පසුගිය තොග ගැනුම්)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                      <th className="py-2.5 px-4">GRN No</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Supplier</th>
                      <th className="py-2.5 px-4">Ref No</th>
                      <th className="py-2.5 px-4">Payment / Cheque Reminder</th>
                      <th className="py-2.5 px-4">Items Received</th>
                      <th className="py-2.5 px-4 text-right">Total Cost</th>
                      <th className="py-2.5 px-4 text-right">Paid</th>
                      <th className="py-2.5 px-4 text-right">Balance Due</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {grns.map((g) => {
                      const totalAmt = Number(g.total_amount || 0);
                      const paidAmt = Number(g.paid_amount ?? totalAmt);
                      const dueAmt = Math.max(0, totalAmt - paidAmt);
                      const rDate = String(g.cheque_reminder_date || '').trim();
                      return (
                        <tr key={g.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-bold text-indigo-700">{g.grn_no}</td>
                          <td className="py-2.5 px-4 text-xs text-slate-500">{g.created_at}</td>
                          <td className="py-2.5 px-4 font-semibold">{g.supplier_name}</td>
                          <td className="py-2.5 px-4 text-xs text-slate-500">{g.ref_no || '-'}</td>
                          <td className="py-2.5 px-4 text-xs">
                            <div className="font-semibold text-slate-800">
                              {g.payment_method || 'Cash'}
                              {g.cheque_no ? ` • #${g.cheque_no}` : ''}
                              {g.payment_ref ? ` • ${g.payment_ref}` : ''}
                            </div>
                            {g.cheque_bank && (
                              <div className="text-[11px] text-slate-500">{g.cheque_bank}</div>
                            )}
                            {rDate && (
                              <div
                                className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  rDate < todayStr
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : rDate === todayStr
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}
                              >
                                🔔 Reminder: {rDate}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-700">
                            {(g.items || []).map((i) => `${i.item_name} (x${i.qty})`).join(', ')}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold">
                            {fmtMoney(totalAmt)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">
                            {fmtMoney(paidAmt)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold">
                            {dueAmt <= 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                PAID
                              </span>
                            ) : (
                              <span className="text-rose-600">{fmtMoney(dueAmt)}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {dueAmt > 0 ? (
                              <button
                                type="button"
                                onClick={() => payGrnSupplier(g)}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                              >
                                Pay Supplier
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
          );
        })()}

        {/* ================================================================ */}
        {/* TAB 5: WARRANTY & SERIAL NUMBER CHECKER                          */}
        {/* ================================================================ */}
        {activeTab === 'warranty' && (() => {
          const today = new Date().toISOString().split('T')[0];
          const getWarrantyState = (r: ItemSerial): 'ACTIVE' | 'EXPIRED' | 'IN_STOCK' => {
            if (r.status !== 'SOLD') return 'IN_STOCK';
            if (!r.warranty_expiry || Number(r.warranty_months) <= 0) return 'EXPIRED';
            return r.warranty_expiry >= today ? 'ACTIVE' : 'EXPIRED';
          };

          const activeCount = warrantyResults.filter((r) => getWarrantyState(r) === 'ACTIVE').length;
          const expiredCount = warrantyResults.filter((r) => getWarrantyState(r) === 'EXPIRED').length;
          const inStockCount = warrantyResults.filter((r) => getWarrantyState(r) === 'IN_STOCK').length;

          const filteredWarrantyResults = warrantyResults.filter(
            (r) => filterWarrantyStatus === 'ALL' || getWarrantyState(r) === filterWarrantyStatus
          );

          return (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <span>Warranty &amp; Serial Number Lookup</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ඕනෑම භාණ්ඩයක <b>Serial Number</b>, <b>Invoice Number</b> හෝ <b>Customer Phone</b> ගසා ක්ෂණිකව Warranty පරීක්ෂා කරන්න.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold">
                  {([
                    { id: 'ALL', label: `All (${warrantyResults.length})` },
                    { id: 'ACTIVE', label: `Active (${activeCount})` },
                    { id: 'EXPIRED', label: `Expired (${expiredCount})` },
                    { id: 'IN_STOCK', label: `In Stock (${inStockCount})` },
                  ] as const).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterWarrantyStatus(tab.id)}
                      className={`px-3 py-1 rounded-lg transition ${
                        filterWarrantyStatus === tab.id
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={warrantyQuery}
                    onChange={(e) => setWarrantyQuery(e.target.value)}
                    placeholder="Scan or type Serial Number (e.g. KNG-500-982341), Invoice #, or Customer Phone..."
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 outline-none transition"
                  />
                  {warrantyQuery && (
                    <button
                      type="button"
                      onClick={() => setWarrantyQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => runWarrantySearch(warrantyQuery)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs transition inline-flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Search Serial</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Serial Number (S/N)</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Invoice / GRN</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Warranty Period</th>
                    <th className="py-3 px-4">Sold Date → Expiry</th>
                    <th className="py-3 px-4 text-center">Warranty Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWarrantyResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm text-slate-500">
                        No serial numbers match your search or filter.
                      </td>
                    </tr>
                  ) : (
                    filteredWarrantyResults.map((r) => {
                      let badge = (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                          In Stock
                        </span>
                      );
                      if (r.status === 'SOLD') {
                        if (!r.warranty_expiry || Number(r.warranty_months) <= 0) {
                          badge = (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                              No Warranty
                            </span>
                          );
                        } else if (r.warranty_expiry >= today) {
                          const daysLeft = Math.ceil(
                            (new Date(r.warranty_expiry).getTime() - new Date(today).getTime()) /
                              (1000 * 60 * 60 * 24)
                          );
                          badge = (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Active ({daysLeft}d left)</span>
                            </span>
                          );
                        } else {
                          badge = (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Expired</span>
                            </span>
                          );
                        }
                      }

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700 whitespace-nowrap">
                            {r.serial_number}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{r.item_name}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {r.status === 'SOLD' ? (
                              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                SOLD
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                IN STOCK
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs whitespace-nowrap">
                            {r.invoice_no && (
                              <div className="font-bold text-slate-800">INV: {r.invoice_no}</div>
                            )}
                            {r.grn_no && <div className="text-slate-500">GRN: {r.grn_no}</div>}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <div className="font-bold text-slate-800">{r.customer_name || '-'}</div>
                            <div className="text-slate-500">{r.customer_phone || ''}</div>
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold whitespace-nowrap">{r.warranty_label}</td>
                          <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                            {r.sold_date ? `${r.sold_date} → ${r.warranty_expiry || 'N/A'}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">{badge}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
          );
        })()}

        {/* ================================================================ */}
        {/* TAB 6: ITEMS & STOCK DIRECTORY                                   */}
        {/* ================================================================ */}
        {activeTab === 'inventory' && (() => {
          const totalUnitsInStock = items.reduce((acc, it) => acc + Math.max(0, Number(it.stock_qty || 0)), 0);
          const lowStockItemsCount = items.filter((it) => Number(it.stock_qty || 0) <= 3).length;
          const outOfStockCount = items.filter((it) => Number(it.stock_qty || 0) <= 0).length;
          const totalStockValue = items.reduce(
            (acc, it) => acc + Math.max(0, Number(it.stock_qty || 0)) * Number(it.selling_price || 0),
            0
          );

          const filteredItems = items.filter((it) => {
            if (filterInventoryStatus === 'LOW' && Number(it.stock_qty || 0) > 3) return false;
            if (filterInventoryStatus === 'OUT' && Number(it.stock_qty || 0) > 0) return false;
            const q = searchInventory.trim().toLowerCase();
            if (!q) return true;
            return (
              it.name.toLowerCase().includes(q) ||
              (it.description || '').toLowerCase().includes(q)
            );
          });

          return (
          <section className="space-y-4">
            {/* Summary KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Catalog SKUs</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{items.length}</div>
              </div>
              <div className="bg-white rounded-2xl border border-emerald-200/90 p-4 shadow-2xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Total Stock Units</div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-1 tabular-nums">{totalUnitsInStock}</div>
              </div>
              <button
                type="button"
                onClick={() => setFilterInventoryStatus('LOW')}
                className="text-left bg-white hover:bg-orange-50/40 rounded-2xl border border-orange-200/90 p-4 shadow-2xs transition"
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Low Stock (≤ 3)</div>
                <div className="text-2xl font-extrabold text-orange-600 mt-1 tabular-nums">{lowStockItemsCount}</div>
              </button>
              <div className="bg-white rounded-2xl border border-indigo-200/90 p-4 shadow-2xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Retail Stock Value</div>
                <div className="text-xl font-extrabold text-indigo-800 mt-1 tabular-nums">{fmtMoney(totalStockValue)}</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Saved Items &amp; Stock Directory
                  </h2>
                  <p className="text-xs text-slate-500">
                    Quotation, Invoice සහ GRN දාන විට ඔබ Type කරන Items ස්වයංක්‍රීයව Save වේ. Click <b>+ Bill</b> to add straight to cart.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold">
                  {([
                    { id: 'ALL', label: `All (${items.length})` },
                    { id: 'LOW', label: `Low Stock (${lowStockItemsCount})` },
                    { id: 'OUT', label: `Out of Stock (${outOfStockCount})` },
                  ] as const).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterInventoryStatus(tab.id)}
                      className={`px-3 py-1 rounded-lg transition ${
                        filterInventoryStatus === tab.id
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchInventory}
                    onChange={(e) => setSearchInventory(e.target.value)}
                    placeholder="Search items..."
                    className="pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm w-64 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition"
                  />
                  {searchInventory && (
                    <button
                      type="button"
                      onClick={() => setSearchInventory('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openItemModal()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">ID / Stock Code</th>
                    <th className="py-3 px-4">Item Name &amp; Default Description</th>
                    <th className="py-3 px-4">Default Warranty</th>
                    <th className="py-3 px-4 text-right">Buying Price</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-center">In-Stock Qty</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                        No items match your search or stock filter.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 text-xs font-mono font-bold text-slate-500 whitespace-nowrap">
                          {String(it.id).padStart(6, '0')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{it.name}</div>
                          {it.description && (
                            <div className="text-xs text-slate-500 mt-0.5">{it.description}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
                          {it.warranty_label}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums whitespace-nowrap">
                          {fmtMoney(it.buying_price)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="font-bold text-indigo-700 tabular-nums">{fmtMoney(it.selling_price)}</div>
                          {Number(it.vat_rate || 0) > 0 && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-bold inline-block mt-0.5">
                              VAT {it.vat_rate}%
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold tabular-nums ${
                              it.stock_qty <= 0
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : it.stock_qty <= 3
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {it.stock_qty}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => quickAddCatalogItem(it, true)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition"
                              title="Add straight to Billing Cart"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Bill</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openItemModal(it)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
          );
        })()}

        {/* ================================================================ */}
        {/* TAB 7: SHOP & INVOICE SETTINGS (FULL APP CUSTOMIZER)            */}
        {/* ================================================================ */}
        {activeTab === 'settings' && (
          <section className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    ⚙️ Invoice Designer & Shop Profile (බිල්පත් සැකසුම්)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    ඔබට අවශ්‍ය පරිදි සමාගමේ නම, ලිපිනය, VAT අංකය, Showroom නම, Cashier, Sales Rep, සහ Invoice එකේ මුද්‍රණය වන සියලුම දෑ මෙතැනින් පහසුවෙන්ම වෙනස් කළ හැක.
                  </p>
                </div>
                <button
                  onClick={saveSettings}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition"
                >
                  💾 Save All Settings
                </button>
              </div>

              {/* Layout format picker */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-extrabold uppercase text-indigo-700 tracking-wider">
                  Select Invoice Layout Style (බිල්පතේ මෝස්තරය තෝරන්න)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
                      settings.invoice_layout_style === 'POS80'
                        ? 'border-indigo-600 bg-white shadow-xs'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="inv_style"
                      checked={settings.invoice_layout_style === 'POS80'}
                      onChange={() =>
                        setSettings({ ...settings, invoice_layout_style: 'POS80' })
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        🧾 POSPrinter POS80 (80mm Thermal Receipt)
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        POS80 (80mm thermal roll) මුද්‍රණ යන්ත්‍ර සඳහාම විශේෂිත වූ continuous roll receipt slip layout එක.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
                      settings.invoice_layout_style === 'STC_OFFICIAL'
                        ? 'border-indigo-600 bg-white shadow-xs'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="inv_style"
                      checked={settings.invoice_layout_style === 'STC_OFFICIAL'}
                      onChange={() =>
                        setSettings({ ...settings, invoice_layout_style: 'STC_OFFICIAL' })
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        📄 Official Tax Invoice (Uploaded PDF Format)
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        ඔබ එවූ PDF ලේඛනයේ ආකෘතියටම: Centered Header, Boxed Info (Invoice No, Date, Customer, Address, Payment), Full Grid Items Table (Stock Code, Description, Qty, Unit Price, Value, VAT), Subtotal & Grand Total, Signatures සහ Customer's Copy සහිත නිල A4 Invoice එක.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
                      settings.invoice_layout_style === 'MODERN'
                        ? 'border-indigo-600 bg-white shadow-xs'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="inv_style"
                      checked={settings.invoice_layout_style === 'MODERN'}
                      onChange={() => setSettings({ ...settings, invoice_layout_style: 'MODERN' })}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        ✨ Classic Blue Executive Invoice (A4)
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Logo, Company Tagline &amp; Contact Header, CUSTOMER ID, TO / INVOICE No &amp; DATE bars, Dotted-Line Table (No, Description, Qty, Unit Price, Amount) සහ Thank You / TOTAL footer සහිත A4 බිල්පත.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Company Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b pb-2">
                  1. Company & Header Details (ආයතනයේ ප්‍රධාන තොරතුරු)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Company / Business Full Name (සමාගමේ නම)
                    </label>
                    <input
                      type="text"
                      value={settings.shop_name || ''}
                      onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
                      placeholder="e.g. Tokiko Engineering (Pvt)Ltd"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Business Tagline / Services Description (ව්‍යාපාරික විස්තරය)
                    </label>
                    <textarea
                      rows={3}
                      value={settings.shop_tagline || ''}
                      onChange={(e) => setSettings({ ...settings, shop_tagline: e.target.value })}
                      placeholder="e.g. All Kind of Vehicles, Machineries Spare Parts & General Hardware Item Distributers."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Company Address Line (ලිපිනය)
                    </label>
                    <input
                      type="text"
                      value={settings.shop_address || ''}
                      onChange={(e) => setSettings({ ...settings, shop_address: e.target.value })}
                      placeholder="e.g. 464/B, IDH Road, Gothatuwa."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Telephone Numbers (දුරකථන අංක)
                    </label>
                    <input
                      type="text"
                      value={settings.shop_phone || ''}
                      onChange={(e) => setSettings({ ...settings, shop_phone: e.target.value })}
                      placeholder="e.g. 070-6383800 / 0113-483800"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Email Address (විද්‍යුත් තැපෑල)
                    </label>
                    <input
                      type="email"
                      value={settings.shop_email || ''}
                      onChange={(e) => setSettings({ ...settings, shop_email: e.target.value })}
                      placeholder="e.g. info@company.lk"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Website (වෙබ් අඩවිය - Optional)
                    </label>
                    <input
                      type="text"
                      value={settings.shop_website || ''}
                      onChange={(e) => setSettings({ ...settings, shop_website: e.target.value })}
                      placeholder="e.g. www.company.lk"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2 bg-slate-50/80 border-2 border-dashed border-slate-300 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                          Company Logo (ආයතනයේ ලාංඡනය / Logo)
                        </label>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Invoice සහ Quotation මුදුනේ වම් පසින් පෙන්වීමට PNG / JPG logo එකක් upload කරන්න (හෝ URL එකක් දමන්න).
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5" />
                          <span>{settings.shop_logo ? 'Change Logo' : 'Upload Logo'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleLogoFileSelect(file);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                        {settings.shop_logo && (
                          <button
                            type="button"
                            onClick={() => setSettings({ ...settings, shop_logo: '' })}
                            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="w-28 h-20 rounded-xl border border-slate-200 bg-white flex items-center justify-center p-2 shrink-0 overflow-hidden">
                        {settings.shop_logo ? (
                          <img
                            src={settings.shop_logo}
                            alt="Company Logo Preview"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium text-center">
                            No Logo
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-[220px]">
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Or Paste Logo Image URL / Data URI (Optional)
                        </label>
                        <input
                          type="text"
                          value={settings.shop_logo || ''}
                          onChange={(e) => setSettings({ ...settings, shop_logo: e.target.value })}
                          placeholder="https://example.com/logo.png or upload image above"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Invoice & Quotation Watermark Settings */}
                  <div className="md:col-span-2 bg-slate-50/80 border-2 border-dashed border-slate-300 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                          Document Watermark (Invoice &amp; Quotation Watermark)
                        </label>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Invoice සහ Quotation පසුබිමේ (background) Company Logo, Custom Text, හෝ වෙනම Image එකක් watermark එකක් ලෙස පෙන්වන්න.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            { id: 'LOGO', label: 'Company Logo' },
                            { id: 'TEXT', label: 'Custom Text' },
                            { id: 'CUSTOM_IMAGE', label: 'Custom Image' },
                            { id: 'OFF', label: 'Off' },
                          ] as const
                        ).map((opt) => {
                          const active = (settings.watermark_mode || 'LOGO') === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setSettings({ ...settings, watermark_mode: opt.id })}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                                active
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {(settings.watermark_mode || 'LOGO') !== 'OFF' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 items-center">
                        <div className="md:col-span-2 space-y-3">
                          {(settings.watermark_mode || 'LOGO') === 'TEXT' && (
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Watermark Text (හිස්ව තැබුවොත් Company Name එක පෙන්නයි)
                              </label>
                              <input
                                type="text"
                                value={settings.watermark_text || ''}
                                onChange={(e) =>
                                  setSettings({ ...settings, watermark_text: e.target.value })
                                }
                                placeholder={settings.shop_name || 'e.g. ORIGINAL / COMPANY NAME'}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                              />
                            </div>
                          )}

                          {(settings.watermark_mode || 'LOGO') === 'CUSTOM_IMAGE' && (
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="cursor-pointer px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5" />
                                <span>
                                  {settings.watermark_image
                                    ? 'Change Watermark Image'
                                    : 'Upload Watermark Image'}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleWatermarkFileSelect(file);
                                    e.target.value = '';
                                  }}
                                  className="hidden"
                                />
                              </label>
                              {settings.watermark_image && (
                                <button
                                  type="button"
                                  onClick={() => setSettings({ ...settings, watermark_image: '' })}
                                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                                <span>Opacity (විනිවිදභාවය)</span>
                                <span className="text-indigo-700 tabular-nums">
                                  {settings.watermark_opacity || '10'}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={4}
                                max={30}
                                step={1}
                                value={Number(settings.watermark_opacity || 10)}
                                onChange={(e) =>
                                  setSettings({ ...settings, watermark_opacity: e.target.value })
                                }
                                className="w-full accent-indigo-600"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                                <span>Size (ප්‍රමාණය)</span>
                                <span className="text-indigo-700 tabular-nums">
                                  {settings.watermark_size || '55'}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={30}
                                max={85}
                                step={5}
                                value={Number(settings.watermark_size || 55)}
                                onChange={(e) =>
                                  setSettings({ ...settings, watermark_size: e.target.value })
                                }
                                className="w-full accent-indigo-600"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Live Mini Preview */}
                        <div className="relative h-28 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center p-2">
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
                            {((settings.watermark_mode || 'LOGO') === 'LOGO' && settings.shop_logo) ||
                            ((settings.watermark_mode || 'LOGO') === 'CUSTOM_IMAGE' &&
                              settings.watermark_image) ? (
                              <img
                                src={
                                  (settings.watermark_mode || 'LOGO') === 'CUSTOM_IMAGE'
                                    ? settings.watermark_image
                                    : settings.shop_logo
                                }
                                alt="Watermark Preview"
                                style={{
                                  opacity: Number(settings.watermark_opacity || 10) / 100,
                                  width: `${Math.min(85, Math.max(30, Number(settings.watermark_size || 55)))}%`,
                                  maxHeight: '90%',
                                  objectFit: 'contain',
                                }}
                              />
                            ) : (
                              <span
                                style={{
                                  opacity: Number(settings.watermark_opacity || 10) / 100,
                                  transform: 'rotate(-24deg)',
                                }}
                                className="font-black uppercase tracking-wider text-slate-900 text-xs text-center px-2 leading-tight"
                              >
                                {(settings.watermark_mode || 'LOGO') === 'TEXT'
                                  ? (settings.watermark_text || '').trim() ||
                                    settings.shop_name ||
                                    'WATERMARK'
                                  : settings.shop_name || 'WATERMARK'}
                              </span>
                            )}
                          </div>
                          <div className="relative z-10 text-center space-y-0.5 pointer-events-none">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                              Live Preview
                            </div>
                            <div className="text-[10px] font-bold text-slate-700">
                              INVOICE / QUOTATION
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Invoice Meta Bar Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b pb-2">
                  2. Invoice Meta & Showroom Info (බිල්පතේ ශාඛා සහ නිලධාරී තොරතුරු)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Location / Showroom (ස්ථානය)
                    </label>
                    <input
                      type="text"
                      value={settings.branch_location || ''}
                      onChange={(e) => setSettings({ ...settings, branch_location: e.target.value })}
                      placeholder="e.g. SHOP - KURUNEGALA 200"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  {/*<div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      VAT Registration No (වැට් අංකය)
                    </label>
                    <input
                      type="text"
                      value={settings.vat_reg_no || ''}
                      onChange={(e) => setSettings({ ...settings, vat_reg_no: e.target.value })}
                      placeholder=""
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>*/}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Document Title (බිල්පත් ශීර්ෂය)
                    </label>
                    <input
                      type="text"
                      value={settings.invoice_title || 'Tax Invoice'}
                      onChange={(e) => setSettings({ ...settings, invoice_title: e.target.value })}
                      placeholder="e.g. Tax Invoice / Commercial Invoice"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Default Cashier (කැෂියර් නම)
                    </label>
                    <input
                      type="text"
                      value={settings.cashier_name || ''}
                      onChange={(e) => setSettings({ ...settings, cashier_name: e.target.value })}
                      placeholder="e.g. manohari"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Default Sales Rep (විකුණුම් නියෝජිත)
                    </label>
                    <input
                      type="text"
                      value={settings.rep_name || ''}
                      onChange={(e) => setSettings({ ...settings, rep_name: e.target.value })}
                      placeholder="e.g. Waruna Jayathilaka"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      VAT Rate % (වැට් ප්‍රතිශතය)
                    </label>
                    <input
                      type="number"
                      value={settings.vat_rate_percent || '18'}
                      onChange={(e) => setSettings({ ...settings, vat_rate_percent: e.target.value })}
                      placeholder="18 (Set 0 for No VAT column)"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Thermal Printer (මුද්‍රණ යන්ත්‍රය)
                    </label>
                    <input
                      type="text"
                      value={settings.printer_name || 'POSPrinter POS80'}
                      onChange={(e) => setSettings({ ...settings, printer_name: e.target.value })}
                      placeholder="e.g. POSPrinter POS80"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Stamps, Dispatches & Declarations */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b pb-2">
                  3. Official Stamps & Declaration Text (මුද්‍රා සහ කොන්දේසි)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Credit Sale / Stamp Text (මුද්‍රාවේ සඳහන් විස්තරය)
                    </label>
                    <textarea
                      rows={3}
                      value={settings.stamp_text || ''}
                      onChange={(e) => setSettings({ ...settings, stamp_text: e.target.value })}
                      placeholder="CREDIT SALE&#10;Sri Lanka State Trading (Gen.) Cor.Ltd&#10;Kurunegala Showroom"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Verification Stamp (පරීක්ෂා කළ මුද්‍රාව)
                    </label>
                    <input
                      type="text"
                      value={settings.verification_stamp_title || 'පරීක්ෂා කළා'}
                      onChange={(e) =>
                        setSettings({ ...settings, verification_stamp_title: e.target.value })
                      }
                      placeholder="පරීක්ෂා කළා"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm mb-2"
                    />
                    <input
                      type="text"
                      value={settings.verification_stamp_dept || 'ආරක්ෂක අංශය / ප්‍රදර්ශනාගාරය'}
                      onChange={(e) =>
                        setSettings({ ...settings, verification_stamp_dept: e.target.value })
                      }
                      placeholder="ආරක්ෂක අංශය / ප්‍රදර්ශනාගාරය"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Declaration Line Text (භාණ්ඩ ලැබීමේ ප්‍රකාශය)
                    </label>
                    <input
                      type="text"
                      value={
                        settings.declaration_text ||
                        'Received the above items in good condition.'
                      }
                      onChange={(e) =>
                        setSettings({ ...settings, declaration_text: e.target.value })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Footer Copy Label (පිටපත් නාමය)
                    </label>
                    <input
                      type="text"
                      value={settings.footer_copy_label || "CUSTOMER'S COPY"}
                      onChange={(e) =>
                        setSettings({ ...settings, footer_copy_label: e.target.value })
                      }
                      placeholder="e.g. CUSTOMER'S COPY / OFFICE COPY"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={saveSettings}
                  className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg transition"
                >
                  💾 Save All Settings (සියලු වෙනස්කම් සුරකින්න)
                </button>
              </div>
            </div>

            {/* Account & Login Password Security */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Login Account &amp; Password (පද්ධතියේ මුරපදය වෙනස් කිරීම)
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={pwdUsername}
                    onChange={(e) => setPwdUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Current Password *
                  </label>
                  <input
                    type="password"
                    value={pwdCurrent}
                    onChange={(e) => setPwdCurrent(e.target.value)}
                    placeholder="Current password"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    New Password *
                  </label>
                  <input
                    type="password"
                    value={pwdNew}
                    onChange={(e) => setPwdNew(e.target.value)}
                    placeholder="New password"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={pwdSaving}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-xs shadow transition inline-flex items-center gap-2"
                >
                  {pwdSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  <span>Update Login Credentials</span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
      </div>

      {/* ================================================================== */}
      {/* PRINT / PDF PREVIEW MODAL (OFFICIAL SLIP + MODERN)                 */}
      {/* ================================================================== */}
      {printDoc && (
        <div
          id="printModal"
          className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-2 md:p-4 print:static print:block print:p-0 print:bg-white"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden print:block print:max-w-none print:max-h-none print:rounded-none print:shadow-none print:overflow-visible">
            {/* Top Toolbar Controls (Hidden during actual print) */}
            <div className="bg-slate-900 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm">
                  🖨️ Document Preview ({printDoc.docNo})
                </span>
                <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700 text-indigo-300">
                  Style: {printDoc.layoutStyle === 'POS80' ? '🧾 POSPrinter POS80 (80mm)' : printDoc.layoutStyle === 'STC_OFFICIAL' ? '📄 Official Tax Invoice (PDF)' : '✨ Modern Attractive Executive'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {printDoc.layoutStyle !== 'POS80' && (
                  <div className="inline-flex items-center rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setPrintDoc({ ...printDoc, paperSize: 'A4' })}
                      className={`px-2.5 py-1 rounded-md transition ${
                        (printDoc.paperSize || 'A4') === 'A4'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                      title="Full A4 Page"
                    >
                      A4 Full
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintDoc({ ...printDoc, paperSize: 'HALF_A4' })}
                      className={`px-2.5 py-1 rounded-md transition ${
                        printDoc.paperSize === 'HALF_A4'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                      title="Half A4 (241mm × 139.5mm)"
                    >
                      Half A4 (241×139.5mm)
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setShowQuickCustomizer(!showQuickCustomizer)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                >
                  <span>✏️</span> {showQuickCustomizer ? 'Hide Editor' : 'Edit Print Fields'}
                </button>
                <button
                  onClick={() => downloadCurrentDocumentPDF()}
                  disabled={isDownloadingPDF}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                  title="PDF එකක් ලෙස පරිගණකයට බාගන්න (Download)"
                >
                  <span>📥</span> {isDownloadingPDF ? 'Downloading...' : 'Download PDF'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow"
                >
                  🖨️ Print / Save PDF
                </button>
                <button
                  onClick={() => setPrintDoc(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Quick Live Customizer inside Modal (No-print) */}
            {showQuickCustomizer && (
              <div className="bg-indigo-50/70 border-b border-indigo-100 p-4 no-print space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-indigo-200">
                  <div className="font-bold text-indigo-900">
                    ⚡ Quick Print Customizer (මෙම බිල්පත සඳහා පමණක් හෝ Default එකක් ලෙස වෙනස් කරන්න)
                  </div>
                  <button
                    onClick={saveQuickCustomizerToDefaults}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded shadow-xs"
                  >
                    💾 Save as Default Settings
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Layout Template</label>
                    <select
                      value={printDoc.layoutStyle || 'MODERN'}
                      onChange={(e) =>
                        setPrintDoc({
                          ...printDoc,
                          layoutStyle: e.target.value as 'POS80' | 'STC_OFFICIAL' | 'MODERN',
                        })
                      }
                      className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white"
                    >
                      <option value="POS80">🧾 POSPrinter POS80 (80mm Thermal)</option>
                      <option value="STC_OFFICIAL">📄 Official Tax Invoice (PDF Format)</option>
                      <option value="MODERN">✨ Modern Attractive Executive (A4)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Stamp Type</label>
                    <select
                      value={printDoc.stampType || 'NONE'}
                      onChange={(e) =>
                        setPrintDoc({
                          ...printDoc,
                          stampType: e.target.value as 'CREDIT' | 'CASH' | 'PAID' | 'NONE',
                        })
                      }
                      className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white"
                    >
                      <option value="CREDIT">Stamp: CREDIT SALE</option>
                      <option value="CASH">Stamp: CASH SALE</option>
                      <option value="PAID">Stamp: PAID</option>
                      <option value="NONE">No Stamp</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Footer Copy Label</label>
                    <input
                      type="text"
                      value={printDoc.footerCopyLabel || "CUSTOMER'S COPY"}
                      onChange={(e) =>
                        setPrintDoc({ ...printDoc, footerCopyLabel: e.target.value })
                      }
                      className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">VAT Rate %</label>
                    <input
                      type="number"
                      value={printDoc.vatRatePercent || '18'}
                      onChange={(e) =>
                        setPrintDoc({ ...printDoc, vatRatePercent: e.target.value })
                      }
                      className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Cashier Name</label>
                    <input
                      type="text"
                      value={printDoc.cashierName || ''}
                      onChange={(e) => setPrintDoc({ ...printDoc, cashierName: e.target.value })}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Sales Rep</label>
                    <input
                      type="text"
                      value={printDoc.repName || ''}
                      onChange={(e) => setPrintDoc({ ...printDoc, repName: e.target.value })}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Location / Branch</label>
                    <input
                      type="text"
                      value={printDoc.branchLocation || ''}
                      onChange={(e) =>
                        setPrintDoc({ ...printDoc, branchLocation: e.target.value })
                      }
                      className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Dispatch Vehicle No</label>
                    <input
                      type="text"
                      value={printDoc.dispatchVehicleNo || ''}
                      onChange={(e) =>
                        setPrintDoc({ ...printDoc, dispatchVehicleNo: e.target.value })
                      }
                      placeholder="e.g. WP-CA-1234"
                      className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Payment Reference</label>
                    <input
                      type="text"
                      value={printDoc.paymentRef || ''}
                      onChange={(e) =>
                        setPrintDoc({ ...printDoc, paymentRef: e.target.value })
                      }
                      placeholder="e.g. CHEQUE- 8,720.00 (CHQ #102938 | BOC)"
                      className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-600 mb-1">Quotation / Invoice Subject</label>
                    <input
                      type="text"
                      value={printDoc.subject || ''}
                      onChange={(e) =>
                        setPrintDoc({ ...printDoc, subject: e.target.value })
                      }
                      placeholder="Subject / Title..."
                      className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-600 mb-1">Description / Scope of Work</label>
                    <textarea
                      rows={2}
                      value={printDoc.description || ''}
                      onChange={(e) =>
                        setPrintDoc({ ...printDoc, description: e.target.value })
                      }
                      placeholder="Full description..."
                      className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white resize-y text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Printable Content Area */}
            <div id="printModalContent" className="p-4 md:p-6 bg-slate-100/70 text-slate-900 overflow-y-auto flex-1 print:p-0 print:bg-white print:overflow-visible">
              {printDoc.extraConvertId && (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between no-print">
                  <span className="text-xs font-semibold text-amber-900">
                    Customer මේ Quotation එක Confirm කළා නම් කෙලින්ම Invoice එකක් හදන්න:
                  </span>
                  <button
                    onClick={() => {
                      const targetQ = quotations.find((q) => q.id === printDoc.extraConvertId);
                      setPrintDoc(null);
                      if (targetQ) confirmQuotationToInvoice(targetQ);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow"
                  >
                    ✅ Confirm & Convert to Invoice
                  </button>
                </div>
              )}

              {/* Actual Printable & Downloadable Slip Container */}
              <div
                id="actualPrintDocument"
                className={`bg-white ${printDoc.layoutStyle !== 'POS80' ? (printDoc.paperSize === 'HALF_A4' ? 'w-[241mm] max-w-[241mm] mx-auto shadow-sm print:w-full print:max-w-none print:shadow-none' : 'max-w-[210mm] mx-auto print:max-w-none') : ''}`}
              >
                <PrintableDocument
                  doc={printDoc}
                  settings={settings}
                  fmtMoney={fmtMoney}
                  includePrintStyles={true}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {offscreenPdfDoc && (
        <div
          aria-hidden="true"
          data-offscreen-container="true"
          className="fixed top-0 left-[-10000px] z-[-1] pointer-events-none bg-white no-print"
          style={{ width: offscreenPdfDoc.layoutStyle === 'POS80' ? '80mm' : offscreenPdfDoc.paperSize === 'HALF_A4' ? '241mm' : '210mm' }}
        >
          <div
            id="offscreenPrintDocument"
            className={`bg-white ${offscreenPdfDoc.layoutStyle !== 'POS80' ? (offscreenPdfDoc.paperSize === 'HALF_A4' ? 'w-[241mm] max-w-[241mm] mx-auto' : 'w-full max-w-[210mm] mx-auto') : ''}`}
          >
            <PrintableDocument
              doc={offscreenPdfDoc}
              settings={settings}
              fmtMoney={fmtMoney}
              includePrintStyles={false}
            />
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ITEM ADD / EDIT MODAL                                              */}
      {/* ================================================================== */}
      {itemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-lg text-slate-900">
              {editItemId ? 'Edit Item' : 'Add New Item'}
            </h3>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Item Name
              </label>
              <input
                type="text"
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Default Description / Specifications
              </label>
              <textarea
                rows={2}
                value={editItemDescription}
                onChange={(e) => setEditItemDescription(e.target.value)}
                placeholder="Specs, model details..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Buying Price (Rs.)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editItemBuying}
                  onChange={(e) => setEditItemBuying(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Selling Price (Rs.)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editItemSelling}
                  onChange={(e) => setEditItemSelling(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Default Warranty
                </label>
                <WarrantySelector
                  months={editItemWarrantyMonths}
                  label={editItemWarrantyLabel}
                  onChange={({ warranty_months, warranty_label }) => {
                    setEditItemWarrantyMonths(warranty_months);
                    setEditItemWarrantyLabel(warranty_label);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Current Stock Qty
                </label>
                <input
                  type="number"
                  value={editItemStock}
                  onChange={(e) => setEditItemStock(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Default VAT Rate % (Optional - උදා: 18 හෝ 0)
              </label>
              <input
                type="number"
                step="any"
                min={0}
                max={100}
                placeholder="0% (Optional)"
                value={editItemVatRate}
                onChange={(e) => setEditItemVatRate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setItemModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={saveItemModal}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold"
              >
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}

      <CommandPaletteModal
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={items}
        customers={customers}
        quotations={quotations}
        invoices={invoices}
        fmtMoney={fmtMoney}
        onNavigateTab={(tab, mode) => {
          if (mode) setBillingMode(mode);
          setActiveTab(tab);
        }}
        onAddItemToCart={(it) => quickAddCatalogItem(it, true)}
        onSelectCustomer={(c) => {
          setCustomerName(c.name);
          setCustomerPhone(c.phone || '');
          setCustomerAddress(c.address || '');
          setActiveTab('billing');
          showToast(`Customer "${c.name}" loaded!`);
        }}
        onPreviewQuotation={openQuotationPreview}
        onDownloadQuotationPdf={downloadQuotationDirect}
        onPreviewInvoice={openInvoicePreview}
        onDownloadInvoicePdf={downloadInvoiceDirect}
      />

      <PaymentSettlementModal
        target={paymentTarget}
        fmtMoney={fmtMoney}
        onClose={() => setPaymentTarget(null)}
        onSubmit={handlePaymentSettlementSubmit}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-950 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700/80 text-sm font-semibold flex items-center gap-2 no-print animate-modal-in">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
