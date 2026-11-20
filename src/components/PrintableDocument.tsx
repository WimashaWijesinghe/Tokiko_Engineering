'use client';

import React from 'react';
import type { PrintDocumentData, ShopSettings } from '@/types/pos';

interface PrintableDocumentProps {
  doc: PrintDocumentData;
  settings: ShopSettings;
  fmtMoney: (val: number | string | undefined) => string;
  includePrintStyles?: boolean;
}

function computeDocumentTaxSummary(doc: PrintDocumentData) {
  const vatRate = Number(doc.vatRatePercent || 0);
  const grandTotalDoc = Number(doc.grandTotal || 0);
  const hasExplicitLineVat = doc.items.some(
    (it) => it.vat_rate !== undefined && it.vat_rate !== '' && Number(it.vat_rate) > 0
  );

  let taxableBase = 0;
  let calculatedVat = 0;

  if (hasExplicitLineVat) {
    doc.items.forEach((it) => {
      const q = Number(it.qty || 1);
      const up = Number(it.unit_price || 0);
      const disc = Number(it.item_discount || 0);
      const base = Math.max(0, q * up - disc);
      const rate = Number(it.vat_rate || 0);
      const vat = rate > 0 ? (base * rate) / 100 : 0;
      taxableBase += base;
      calculatedVat += vat;
    });
  } else {
    taxableBase = vatRate > 0 ? grandTotalDoc / (1 + vatRate / 100) : grandTotalDoc;
    calculatedVat = Math.max(0, grandTotalDoc - taxableBase);
  }

  return { vatRate, hasExplicitLineVat, taxableBase, calculatedVat };
}

function DocumentWatermark({
  settings,
  doc,
}: {
  settings: ShopSettings;
  doc: PrintDocumentData;
}) {
  const mode = settings.watermark_mode || 'LOGO';
  if (mode === 'OFF') return null;

  const opacityPct = Math.min(35, Math.max(3, Number(settings.watermark_opacity || 10)));
  const opacity = opacityPct / 100;
  const sizePct = Math.min(90, Math.max(25, Number(settings.watermark_size || 55)));

  const imageSrc =
    mode === 'CUSTOM_IMAGE'
      ? settings.watermark_image || ''
      : mode === 'LOGO'
      ? settings.shop_logo || ''
      : '';

  const fallbackText =
    mode === 'TEXT'
      ? (settings.watermark_text || '').trim() ||
        (settings.shop_name || (doc.docType === 'INVOICE' ? 'INVOICE' : 'QUOTATION'))
      : settings.shop_name || (doc.docType === 'INVOICE' ? 'INVOICE' : 'QUOTATION');

  if (mode === 'CUSTOM_IMAGE' && !imageSrc) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute print:fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          style={{
            opacity,
            width: `${sizePct}%`,
            maxWidth: '480px',
            maxHeight: '480px',
            objectFit: 'contain',
          }}
        />
      ) : (
        <div
          style={{
            opacity,
            transform: 'rotate(-32deg)',
            fontSize: `${Math.max(26, Math.round(sizePct * 0.75))}px`,
          }}
          className="font-black uppercase tracking-widest text-slate-900 text-center leading-tight px-8 max-w-[92%] break-words"
        >
          {fallbackText}
        </div>
      )}
    </div>
  );
}

export function PrintableDocument({
  doc,
  settings,
  fmtMoney,
  includePrintStyles = true,
}: PrintableDocumentProps) {
  const { vatRate, hasExplicitLineVat, taxableBase, calculatedVat } = computeDocumentTaxSummary(doc);

  if (doc.layoutStyle === 'POS80') {
    return (
      <div className="pos80-receipt font-mono text-[11px] text-black leading-tight max-w-[76mm] mx-auto bg-white p-2 select-text shadow-sm border border-slate-200">
        {includePrintStyles && (
          <style>{`
            @media print {
              @page {
                size: 80mm auto !important;
                margin: 2mm 2mm 4mm 2mm !important;
              }
              html, body {
                width: 80mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
              }
              #printModal {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 80mm !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              #printModalContent {
                width: 74mm !important;
                max-width: 74mm !important;
                margin: 0 auto !important;
                padding: 0 !important;
                background: transparent !important;
              }
              .pos80-receipt {
                border: none !important;
                box-shadow: none !important;
                padding: 1mm 1mm 4mm 1mm !important;
                width: 74mm !important;
                max-width: 74mm !important;
              }
            }
          `}</style>
        )}

        {/* Header */}
        <div className="text-center pb-1.5">
          <div className="font-black text-[14px] uppercase tracking-wide leading-tight">
            {settings.shop_name}
          </div>
          {settings.shop_tagline && (
            <div className="text-[10px] uppercase font-semibold text-slate-700 mt-0.5">
              {settings.shop_tagline}
            </div>
          )}
          <div className="text-[10px] mt-0.5 leading-snug">{settings.shop_address}</div>
          <div className="text-[10px]">Tel: {settings.shop_phone}</div>
          {doc.vatRegNo && (
            <div className="text-[10px] font-semibold mt-0.5">VAT Reg No: {doc.vatRegNo}</div>
          )}
          {doc.branchLocation && (
            <div className="text-[10px] font-semibold mt-0.5">[{doc.branchLocation}]</div>
          )}
        </div>

        {/* Receipt Title */}
        <div className="border-t border-b border-black py-1 my-1 text-center font-extrabold text-[12px] uppercase tracking-wider">
          *** {doc.docType === 'INVOICE' ? 'TAX INVOICE' : 'QUOTATION'} ***
        </div>

        {/* Metadata */}
        <div className="text-[10px] space-y-0.5 py-1">
          <div className="flex justify-between">
            <span className="font-bold">{doc.docType === 'INVOICE' ? 'Invoice No:' : 'Quote No:'}</span>
            <span className="font-black">{doc.docNo}</span>
          </div>
          {doc.refQuoteNo && (
            <div className="flex justify-between">
              <span>Ref Quote:</span>
              <span className="font-semibold">{doc.refQuoteNo}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Date & Time:</span>
            <span>{doc.date} {doc.time || ''}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier / Rep:</span>
            <span>{doc.cashierName || 'Admin'} / {doc.repName || 'Sales'}</span>
          </div>
          {doc.dispatchVehicleNo && (
            <div className="flex justify-between">
              <span className="font-bold">Vehicle No:</span>
              <span className="font-bold uppercase">{doc.dispatchVehicleNo}</span>
            </div>
          )}
          <div className="flex justify-between text-[9px] text-slate-600">
            <span>Printer:</span>
            <span>{settings.printer_name || 'POSPrinter POS80'}</span>
          </div>

          {/* Customer Info */}
          <div className="border-t border-dotted border-black/40 pt-1 mt-1">
            <div className="flex justify-between">
              <span className="font-bold">Customer:</span>
              <span className="font-bold uppercase text-right max-w-[46mm] truncate">{doc.customerName}</span>
            </div>
            {doc.customerPhone && (
              <div className="flex justify-between">
                <span>Phone:</span>
                <span>{doc.customerPhone}</span>
              </div>
            )}
            {doc.customerAddress && (
              <div className="text-[9px] text-slate-700 truncate">
                Addr: {doc.customerAddress}
              </div>
            )}
          </div>

          {/* Subject & Description Box */}
          {(doc.subject || doc.description) && (
            <div className="border border-dashed border-black/60 p-1.5 my-1 bg-slate-50 rounded max-w-full overflow-hidden break-words [overflow-wrap:anywhere] [word-break:break-word]">
              <div className="font-bold text-[9px] text-black uppercase mb-0.5 tracking-wider">
                -- DESCRIPTION / SCOPE --
              </div>
              {doc.subject && (
                <div className="font-bold text-[9.5px] text-black break-words [overflow-wrap:anywhere] [word-break:break-word]">
                  Subject: {doc.subject}
                </div>
              )}
              {doc.description && (
                <div className="text-[9px] text-black whitespace-pre-wrap leading-tight mt-1 break-words [overflow-wrap:anywhere] [word-break:break-word] max-w-full">
                  {doc.description}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Items Header */}
        <div className="border-t border-b border-black text-[10px] font-bold py-1 flex justify-between">
          <span className="w-[38mm]">ITEM</span>
          <span className="w-[7mm] text-center">QTY</span>
          <span className="w-[13mm] text-right">PRICE</span>
          <span className="w-[14mm] text-right">TOTAL</span>
        </div>

        {/* Line Items */}
        <div className="divide-y divide-dotted divide-black/30 py-0.5">
          {doc.items.map((it, idx) => {
            const qtyNum = Number(it.qty || 1);
            const unitPriceNum = Number(it.unit_price || 0);
            const itemDisc = Number(it.item_discount || 0);
            const rawBase = Math.max(0, qtyNum * unitPriceNum - itemDisc);
            const hasExplicit = it.vat_rate !== undefined && it.vat_rate !== '';
            const lineVatRate = hasExplicit ? Number(it.vat_rate) : (hasExplicitLineVat ? 0 : vatRate);
            const lineTotal = Number(it.line_total || rawBase);

            return (
              <div key={idx} className="py-0.5">
                <div className="flex justify-between items-start font-semibold text-[10.5px]">
                  <span className="w-[38mm] break-words text-slate-950 font-bold">{it.item_name}</span>
                  <span className="w-[7mm] text-center font-bold">{qtyNum}</span>
                  <span className="w-[13mm] text-right">{unitPriceNum.toFixed(2)}</span>
                  <span className="w-[14mm] text-right font-bold">{lineTotal.toFixed(2)}</span>
                </div>

                {it.serial_numbers && it.serial_numbers.length > 0 && (
                  <div className="pl-1 pt-0.5 text-[9px] text-slate-800">
                    <span className="font-bold underline">S/N:</span> {it.serial_numbers.join(', ')}
                  </div>
                )}

                <div className="pl-1 flex flex-wrap gap-2 text-[8.5px] text-slate-600">
                  {it.warranty_months > 0 && (
                    <span>Warranty: {it.warranty_label || `${it.warranty_months}M`}</span>
                  )}
                  {hasExplicit && lineVatRate > 0 && (
                    <span>VAT: {lineVatRate}%</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals Section */}
        <div className="border-t border-b-2 border-black py-1 space-y-0.5 text-[10.5px]">
          <div className="flex justify-between">
            <span>Sub Total:</span>
            <span className="font-semibold">{taxableBase.toFixed(2)}</span>
          </div>
          {calculatedVat > 0 && (
            <div className="flex justify-between">
              <span>VAT Amount ({doc.vatRatePercent || '18'}%):</span>
              <span className="font-semibold">{calculatedVat.toFixed(2)}</span>
            </div>
          )}
          {Number(doc.discount) > 0 && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span className="font-semibold">- {Number(doc.discount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-black pt-1 text-[13px] font-black">
            <span>GRAND TOTAL:</span>
            <span>{doc.grandTotal.toFixed(2)}</span>
          </div>
          {doc.docType === 'INVOICE' && (
            <>
              <div className="flex justify-between pt-0.5 font-bold">
                <span>PAID AMOUNT:</span>
                <span>{(Number(doc.paidAmount) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>BALANCE DUE:</span>
                <span>{(Number(doc.balanceDue) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[9.5px] text-slate-700 pt-0.5">
                <span>Payment Method:</span>
                <span className="font-bold uppercase">{doc.paymentMethod || 'CASH'}</span>
              </div>
              {doc.paymentMethod?.toUpperCase() === 'CHEQUE' && (
                <div className="text-[9px] text-slate-800 bg-slate-100 p-1 rounded mt-0.5 space-y-0.5">
                  <div>Cheque No: <span className="font-bold">{doc.chequeNo || '—'}</span></div>
                  <div>Bank: <span className="font-bold">{doc.chequeBank || '—'}</span></div>
                  {doc.chequeDate && <div>Date: <span className="font-bold">{doc.chequeDate}</span></div>}
                </div>
              )}
              {doc.paymentMethod?.toUpperCase() === 'CREDIT' && doc.chequeDate && (
                <div className="flex justify-between text-[9.5px] text-slate-800 font-bold pt-0.5">
                  <span>Credit Due Date:</span>
                  <span>{doc.chequeDate}</span>
                </div>
              )}
              {doc.paymentRef && (
                <div className="text-[9px] text-slate-700">
                  Ref: <span className="font-semibold">{doc.paymentRef}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Summary Count */}
        <div className="text-center text-[9px] text-slate-700 py-1">
          Items: {doc.items.length} | Total Units: {doc.items.reduce((acc, i) => acc + Number(i.qty || 1), 0)}
        </div>

        {/* Rubber Stamp (if enabled) */}
        {doc.stampType && doc.stampType !== 'NONE' && (
          <div className="my-1.5 text-center">
            <div className="inline-block border-2 border-black px-3 py-1 font-extrabold text-[11px] tracking-wider uppercase">
              *** {doc.stampType === 'CREDIT' ? 'CREDIT SALE' : doc.stampType === 'PAID' ? 'PAID' : 'CASH SALE'} ***
            </div>
          </div>
        )}

        {/* Footer Terms & Greetings */}
        <div className="text-center text-[9px] text-slate-700 space-y-0.5 pt-1.5 border-t border-dotted border-black">
          {settings.invoice_terms && (
            <div className="text-[8px] leading-tight text-slate-600">
              {settings.invoice_terms}
            </div>
          )}
          <div className="font-extrabold text-[10px] text-black tracking-wide pt-0.5">
            *** THANK YOU COME AGAIN ***
          </div>
          <div className="text-[8px] text-slate-500 font-sans">
            Powered by Smart POS System • {settings.printer_name || 'POSPrinter POS80'} Ready
          </div>
          <div className="text-[8px] uppercase tracking-wider font-bold text-black pt-0.5">
            [{doc.footerCopyLabel || settings.footer_copy_label || "CUSTOMER'S COPY"}]
          </div>
        </div>

        {/* Cutter Feed Spacing for Thermal Tear-off */}
        <div className="h-4"></div>
      </div>
    );
  }

  const isHalfA4 = doc.paperSize === 'HALF_A4';

  if (doc.layoutStyle === 'STC_OFFICIAL') {
    return (
      <div
        className={`printable-doc-root relative overflow-hidden print:overflow-visible font-sans text-[10.5pt] text-black leading-tight py-3 pr-3 pl-10 md:py-4 md:pr-4 md:pl-12 bg-white max-w-4xl mx-auto select-text print:max-w-none print:p-0 ${
          isHalfA4 ? 'half-a4-doc border-b-2 border-dashed border-slate-300 print:border-none' : ''
        }`}
      >
        <DocumentWatermark settings={settings} doc={doc} />
        <div className="relative z-10">
        {includePrintStyles && (
          <style>{`
            .half-a4-doc {
              width: 241mm;
              min-height: 139.5mm;
              font-size: 9pt;
              line-height: 1.18;
              padding: 8px 12px 8px 24px;
            }
            .half-a4-doc h1 { font-size: 14pt !important; }
            .half-a4-doc img { max-height: 38px !important; }
            .half-a4-doc table { font-size: 8.5pt !important; }
            .half-a4-doc table th, .half-a4-doc table td {
              padding: 2px 5px !important;
              width: auto !important;
            }
            @media print {
              @page {
                size: ${isHalfA4 ? '241mm 139.5mm' : 'A4 portrait'} !important;
                margin: ${isHalfA4 ? '4mm 6mm 4mm 10mm' : '8mm 8mm 8mm 16mm'} !important;
              }
              html, body {
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
              }
              #printModal {
                position: static !important;
                display: block !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
              }
              #printModalContent {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
                background: #ffffff !important;
              }
              .printable-doc-root {
                overflow: visible !important;
                height: auto !important;
              }
              .printable-doc-root table {
                page-break-inside: auto !important;
                break-inside: auto !important;
              }
              .printable-doc-root thead {
                display: table-header-group !important;
              }
              .printable-doc-root tfoot {
                display: table-row-group !important;
              }
              .printable-doc-root tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .print-keep-together {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .half-a4-doc {
                width: 100% !important;
                min-height: auto !important;
                padding: 1mm 2mm !important;
              }
            }
          `}</style>
        )}

        {/* Header */}
        <div className="text-center space-y-0.5 mb-1.5">
          {settings.shop_logo && (
            <div className="flex justify-center mb-1">
              <img
                src={settings.shop_logo}
                alt={settings.shop_name || 'Company Logo'}
                className="max-h-14 w-auto object-contain"
              />
            </div>
          )}
          <h1 className="text-lg md:text-xl font-bold tracking-wide uppercase text-black">
            {settings.shop_name || 'YOUR COMPANY NAME (PVT) LTD.'}
          </h1>
          <div className="text-[10pt] text-black">
            {settings.shop_address || 'Company Address, City, Sri Lanka'}{' '}
            {settings.shop_phone ? `| Tel: ${settings.shop_phone}` : ''}
          </div>
          <div className="text-[10pt] text-black">
            <span className="font-semibold">VAT REG. NO:</span>{' '}
            <span>{doc.vatRegNo || settings.vat_reg_no || '________________________'}</span>
          </div>
        </div>

        {/* Document Title */}
        <div className="text-center font-bold text-[12pt] tracking-widest uppercase my-1.5 text-black">
          {doc.docType === 'INVOICE'
            ? settings.invoice_title || 'TAX INVOICE'
            : 'QUOTATION'}
        </div>

        {/* Boxed Metadata Table */}
        <table className="w-full table-fixed border-collapse border border-black text-[10.5pt] text-black mb-1.5">
          <tbody>
            <tr className="border-b border-black">
              <td className="w-1/2 p-1 border-r border-black">
                <span className="font-bold">INVOICE NO:</span>{' '}
                <span className="font-mono font-semibold">{doc.docNo}</span>
              </td>
              <td className="w-1/2 p-1">
                <span className="font-bold">DATE:</span>{' '}
                <span>{doc.date}</span>
              </td>
            </tr>
            <tr className="border-b border-black">
              <td className="p-1 border-r border-black">
                <span className="font-bold">CASHIER:</span>{' '}
                <span>{doc.cashierName || settings.cashier_name || '—'}</span>
              </td>
              <td className="p-1">
                <span className="font-bold">TIME:</span>{' '}
                <span>{doc.time}</span>
              </td>
            </tr>
            <tr className="border-b border-black">
              <td className="p-1 border-r border-black">
                <span className="font-bold">CUSTOMER:</span>{' '}
                <span className="uppercase font-semibold">{doc.customerName}</span>
              </td>
              <td className="p-1">
                <span className="font-bold">CUSTOMER PO NO:</span>{' '}
                <span>{doc.customerPoNo || '—'}</span>
              </td>
            </tr>
            <tr>
              <td className="p-1 border-r border-black">
                <span className="font-bold">ADDRESS:</span>{' '}
                <span>{doc.customerAddress || '—'}</span>
              </td>
              <td className="p-1">
                <span className="font-bold">PAYMENT:</span>{' '}
                <span className="uppercase font-semibold">
                  {doc.paymentMethod === 'CREDIT' || (doc.balanceDue !== undefined && Number(doc.balanceDue) > 0)
                    ? 'CASH / CREDIT'
                    : (doc.paymentMethod || 'CASH')}
                </span>
              </td>
            </tr>
            {doc.dispatchVehicleNo && (
              <tr className="border-t border-black">
                <td colSpan={2} className="p-1">
                  <span className="font-bold">VEHICLE NO:</span>{' '}
                  <span className="uppercase font-mono font-semibold">{doc.dispatchVehicleNo}</span>
                </td>
              </tr>
            )}
            {(doc.subject || doc.description) && (
              <tr className="border-t border-black bg-slate-50/70">
                <td colSpan={2} className="p-1.5 border-black max-w-full overflow-hidden">
                  <div className="text-[9.5pt] font-black text-black uppercase tracking-wider mb-0.5">
                    SCOPE OF WORK / DESCRIPTION (විස්තරය):
                  </div>
                  {doc.subject && (
                    <div className="font-bold text-[10.5pt] text-black uppercase mb-0.5 break-words [overflow-wrap:anywhere] [word-break:break-word]">
                      <span>SUBJECT: </span>
                      <span>{doc.subject}</span>
                    </div>
                  )}
                  {doc.description && (
                    <div className="whitespace-pre-wrap text-black text-[10.5pt] leading-tight break-words [overflow-wrap:anywhere] [word-break:break-word] max-w-full overflow-hidden">
                      {doc.description}
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Items Table */}
        <table className="w-full text-left border-collapse border border-black my-1 text-[10.5pt] text-black">
          <thead>
            <tr className="border-b border-black font-bold uppercase text-[9.5pt] bg-slate-50/60">
              <th className="border border-black py-1 px-1.5 text-center w-24">STOCK CODE</th>
              <th className="border border-black py-1 px-1.5">DESCRIPTION</th>
              <th className="border border-black py-1 px-1.5 text-center w-14">QTY</th>
              <th className="border border-black py-1 px-1.5 text-right w-28">UNIT PRICE</th>
              <th className="border border-black py-1 px-1.5 text-right w-28">VALUE</th>
              <th className="border border-black py-1 px-1.5 text-right w-24">VAT</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((it, idx) => {
              const qtyNum = Number(it.qty || 1);
              const unitPriceNum = Number(it.unit_price || 0);
              const itemDisc = Number(it.item_discount || 0);
              const rawBase = Math.max(0, qtyNum * unitPriceNum - itemDisc);

              const hasExplicit = it.vat_rate !== undefined && it.vat_rate !== '';
              const lineVatRate = hasExplicit ? Number(it.vat_rate) : (hasExplicitLineVat ? 0 : vatRate);
              const lineBase = hasExplicit
                ? rawBase
                : vatRate > 0
                ? rawBase / (1 + vatRate / 100)
                : rawBase;
              const lineVat = hasExplicit
                ? (rawBase * lineVatRate) / 100
                : Math.max(0, rawBase - lineBase);

              const stockCode = it.item_id
                ? String(it.item_id).padStart(6, '0')
                : String(199000 + idx + 1);

              return (
                <tr key={idx} className="align-top border-b border-black">
                  <td className="border border-black py-1 px-1.5 text-center font-bold text-[10pt]">
                    {stockCode}
                  </td>
                  <td className="border border-black py-1 px-1.5 space-y-0.5">
                    <div className="font-bold uppercase text-slate-950 text-[10.5pt]">{it.item_name}</div>
                    {it.serial_numbers && it.serial_numbers.length > 0 && (
                      <div className="text-[9.5pt] font-mono pt-0.5">
                        <span className="font-bold">S.N.</span>{' '}
                        <span>{it.serial_numbers.join(', ')}</span>
                      </div>
                    )}
                    {it.warranty_months > 0 && (
                      <div className="text-[9pt] text-slate-600">
                        Warranty: {it.warranty_label || `${it.warranty_months} Months`}
                      </div>
                    )}
                  </td>
                  <td className="border border-black py-1 px-1.5 text-center font-bold">
                    {it.qty}
                  </td>
                  <td className="border border-black py-1 px-1.5 text-right font-mono">
                    {unitPriceNum.toFixed(2)}
                  </td>
                  <td className="border border-black py-1 px-1.5 text-right font-mono font-semibold">
                    {lineBase.toFixed(2)}
                  </td>
                  <td className="border border-black py-1 px-1.5 text-right font-mono">
                    {lineVat > 0 ? lineVat.toFixed(2) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Below Table */}
        <div className="print-keep-together">
        <div className="grid grid-cols-2 gap-4 mt-1.5 text-[10.5pt] text-black">
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wide">NO. OF ITEMS:</span>
              <span className="font-mono font-bold">{String(doc.items.length).padStart(4, '0')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wide">PAYMENT REFERENCE:</span>
              <span className="font-mono font-semibold text-[10pt]">
                {doc.paymentRef || (doc.paymentMethod === 'CHEQUE' ? `CHQ: ${doc.chequeNo || ''} (${doc.chequeBank || ''})` : '—')}
              </span>
            </div>
            {doc.stampType && doc.stampType !== 'NONE' && (
              <div className="pt-1.5">
                <div className="inline-block border-2 border-black px-3 py-0.5 text-center font-black tracking-widest text-[10pt] uppercase">
                  *** {doc.stampType === 'CREDIT' ? 'CREDIT SALE' : doc.stampType === 'PAID' ? 'PAID' : 'CASH SALE'} ***
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1 text-[10.5pt] text-black">
            <div className="flex justify-between items-center py-0.5">
              <span className="font-bold uppercase tracking-wide">SUB TOTAL</span>
              <span className="font-mono font-bold text-right border-b border-black min-w-[32mm] inline-block pb-0.5">
                {taxableBase.toFixed(2)}
              </span>
            </div>
            {calculatedVat > 0 && (
              <div className="flex justify-between items-center py-0.5">
                <span className="font-bold uppercase tracking-wide">TAX / SURCHARGE</span>
                <span className="font-mono font-bold text-right border-b border-black min-w-[32mm] inline-block pb-0.5">
                  {calculatedVat.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-0.5 font-black text-[11.5pt]">
              <span className="uppercase tracking-wide">GRAND TOTAL</span>
              <span className="font-mono text-right border-b-2 border-black min-w-[32mm] inline-block pb-0.5">
                {doc.grandTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="font-bold uppercase tracking-wide">AMOUNT RECEIVED</span>
              <span className="font-mono font-bold text-right border-b border-black min-w-[32mm] inline-block pb-0.5">
                {(Number(doc.paidAmount) || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 font-bold">
              <span className="uppercase tracking-wide">CREDIT / BALANCE</span>
              <span className="font-mono font-bold text-right border-b border-black min-w-[32mm] inline-block pb-0.5">
                {(Number(doc.balanceDue) || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Declaration text */}
        <div className="mt-2 text-[10pt] text-black">
          {settings.declaration_text || 'Received the above items in good condition.'}
        </div>

        {/* Signatures (spaced for manual seal & signature) */}
        <div className="mt-2 flex justify-between items-end text-[10pt] text-black px-4">
          <div className="text-center w-52">
            <div className="h-10" />
            <div className="border-t border-black mb-1"></div>
            <div className="font-bold text-[10pt]">Authorized Signature</div>
          </div>
          <div className="text-center w-52">
            <div className="h-10" />
            <div className="border-t border-black mb-1"></div>
            <div className="font-bold text-[10pt]">Customer Signature</div>
          </div>
        </div>

        {/* Customer's Copy Footer */}
        <div className="mt-2 text-center">
          <span className="font-bold text-[9.5pt] uppercase tracking-widest text-black">
            {doc.footerCopyLabel || settings.footer_copy_label || "CUSTOMER'S COPY"}
          </span>
        </div>
        </div>
        </div>
      </div>
    );
  }

  const hasDiscount = Number(doc.discount) > 0;
  const hasVat = calculatedVat > 0;
  const showPaidBalance =
    doc.docType === 'INVOICE' &&
    (Number(doc.balanceDue) > 0 ||
      (Number(doc.paidAmount) > 0 && Number(doc.paidAmount) < Number(doc.grandTotal)));
  const universCondensedStyle: React.CSSProperties = {
    fontFamily: "'Univers Condensed', 'Univers LT Std 57 Cn', 'Univers 57 Condensed', 'Univers', 'Arial Narrow', sans-serif",
  };

  return (
    <div
      style={{ fontFamily: "Calibri, 'Carlito', 'Segoe UI', Arial, sans-serif" }}
      className={`printable-doc-root relative overflow-hidden print:overflow-visible w-full text-[10.5pt] text-slate-900 leading-snug py-4 pr-4 pl-10 md:py-5 md:pr-5 md:pl-12 bg-white select-text print:w-full print:p-2 ${
        isHalfA4 ? 'half-a4-doc border-b-2 border-dashed border-slate-300 print:border-none' : ''
      }`}
    >
      <DocumentWatermark settings={settings} doc={doc} />
      {includePrintStyles && (
        <style>{`
          .half-a4-doc {
            width: 241mm;
            min-height: 139.5mm;
            font-size: 9pt;
            line-height: 1.18;
            padding: 8px 12px 8px 24px;
          }
          .half-a4-doc h1 { font-size: 16pt !important; }
          .half-a4-doc img { max-height: 44px !important; }
          .half-a4-doc .contact-block {
            min-width: 195px !important;
            max-width: 250px !important;
            font-size: 8.5pt !important;
          }
          .half-a4-doc table { font-size: 8.5pt !important; }
          .half-a4-doc table th, .half-a4-doc table td {
            padding: 2px 5px !important;
            width: auto !important;
          }
          .half-a4-doc .sig-spacer { height: 18px !important; }
          @media print {
            @page {
              size: ${isHalfA4 ? '241mm 139.5mm' : 'A4 portrait'} !important;
              margin: ${isHalfA4 ? '4mm 6mm 4mm 10mm' : '8mm 8mm 8mm 16mm'} !important;
            }
            html, body {
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            #printModal {
              position: static !important;
              display: block !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            #printModalContent {
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
            }
            .printable-doc-root {
              overflow: visible !important;
              height: auto !important;
            }
            .printable-doc-root table {
              page-break-inside: auto !important;
              break-inside: auto !important;
            }
            .printable-doc-root thead {
              display: table-header-group !important;
            }
            .printable-doc-root tfoot {
              display: table-row-group !important;
            }
            .printable-doc-root tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .print-keep-together {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .half-a4-doc {
              width: 100% !important;
              min-height: auto !important;
              padding: 1mm 2mm !important;
            }
          }
        `}</style>
      )}

      <div className="relative z-10">
        {/* Top Company Header matching uploaded PDF */}
        <div className="flex items-start justify-between gap-3">
          {settings.shop_logo ? (
            <div className="shrink-0 max-w-[140px]">
              <img
                src={settings.shop_logo}
                alt={settings.shop_name || 'Company Logo'}
                className="max-h-20 w-auto object-contain"
              />
            </div>
          ) : null}

          <div className="flex-1 space-y-1">
            <h1 className="text-[24px] font-bold text-[#5b84b1] tracking-tight leading-tight text-center">
              {settings.shop_name || 'YOUR COMPANY NAME'}
            </h1>

            <div className="flex items-start justify-between gap-3 pt-0.5">
              <div className="flex-1 text-center font-bold text-[10pt] text-black leading-snug whitespace-pre-line">
                {settings.shop_tagline || ''}
              </div>

              <div
                style={universCondensedStyle}
                className="contact-block border-l border-slate-700 pl-3 text-[10pt] text-slate-800 space-y-0.5 leading-snug min-w-[225px] max-w-[270px]"
              >
                {settings.shop_address && (
                  <div className="whitespace-pre-line">{settings.shop_address}</div>
                )}
                {settings.shop_phone && <div>Phone: {settings.shop_phone}</div>}
                {settings.shop_email && <div>Email: {settings.shop_email}</div>}
                {settings.shop_website && <div>Web: {settings.shop_website}</div>}
                {doc.vatRegNo && hasVat && <div>VAT Reg: {doc.vatRegNo}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Title & Customer ID Row */}
        <div className="mt-2.5 mb-1.5 flex items-center justify-between gap-4">
          <div className="w-[46%]">
            <span className="text-[22px] font-black uppercase tracking-wide text-black underline underline-offset-4">
              {doc.docType === 'INVOICE'
                ? (settings.invoice_title || 'INVOICE').toUpperCase()
                : 'QUOTATION'}
            </span>
          </div>
          <div className="w-[46%] space-y-1">
            <div className="bg-[#9bb7d4] px-2.5 py-0.5 text-[10pt] font-bold uppercase text-slate-900 flex items-center justify-between">
              <span>CUSTOMER ID:</span>
              <span>
                {doc.customerId ? String(doc.customerId).padStart(4, '0') : doc.customerPhone || ''}
              </span>
            </div>
            {doc.dispatchVehicleNo && (
              <div className="bg-[#9bb7d4] px-2.5 py-0.5 text-[10pt] font-bold uppercase text-slate-900 flex items-center justify-between">
                <span>VEHICLE NO:</span>
                <span>{doc.dispatchVehicleNo}</span>
              </div>
            )}
          </div>
        </div>

        {/* TO & INVOICE No / DATE Row */}
        <div style={universCondensedStyle} className="flex items-start justify-between gap-4 mb-2">
          {/* Left: TO */}
          <div className="w-[46%]">
            <div className="bg-[#9bb7d4] px-2.5 py-0.5 text-[10pt] font-bold uppercase text-slate-900">
              TO
            </div>
            <div className="pt-1 px-0.5 text-[10.5pt] text-slate-800 leading-snug space-y-0.5">
              <div className="font-semibold text-black">{doc.customerName}</div>
              {doc.customerAddress && (
                <div className="whitespace-pre-line">{doc.customerAddress}</div>
              )}
              {doc.customerPhone && <div>{doc.customerPhone}</div>}
            </div>
          </div>

          {/* Right: INVOICE No / DATE */}
          <div className="w-[46%]">
            <div className="bg-[#9bb7d4] px-2.5 py-0.5 text-[10pt] font-bold uppercase text-slate-900 grid grid-cols-2 gap-2">
              <span>{doc.docType === 'INVOICE' ? 'INVOICE No:' : 'QUOTATION No:'}</span>
              <span>DATE</span>
            </div>
            <div className="px-2.5 pt-1 text-[10.5pt] text-slate-900 grid grid-cols-2 gap-2">
              <span className="font-medium">{doc.docNo}</span>
              <span>{doc.date}</span>
            </div>
            {(doc.refQuoteNo || (doc.docType === 'INVOICE' && (doc.paymentMethod || doc.chequeDate))) && (
              <div className="px-2.5 pt-0.5 text-[9.5pt] text-slate-700 space-y-0.5">
                {doc.refQuoteNo && <div>Ref Quote: {doc.refQuoteNo}</div>}
                {doc.docType === 'INVOICE' && (
                  <div
                    className={
                      doc.paymentMethod?.toUpperCase() === 'CREDIT'
                        ? 'font-semibold text-red-600'
                        : undefined
                    }
                  >
                    Payment: {doc.paymentMethod || 'Cash'}
                    {doc.chequeDate ? ` | Due Date: ${doc.chequeDate}` : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Optional Subject / Scope of Work */}
        {(doc.subject || doc.description) && (
          <div className="mb-2 px-2 py-1 border border-slate-400 bg-slate-50/50 text-[10.5pt] text-slate-800 space-y-0.5 break-inside-avoid">
            {doc.subject && (
              <div className="font-bold text-black">
                Subject: {doc.subject}
              </div>
            )}
            {doc.description && (
              <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {doc.description}
              </div>
            )}
          </div>
        )}

        {/* Line Items Table matching uploaded PDF */}
        <div className="mb-2.5">
          <table className="w-full border-collapse border border-slate-700 text-[10.5pt] text-slate-900">
            <thead>
              <tr className="bg-[#9bb7d4] text-black font-bold uppercase text-[10pt] border-b border-slate-700">
                <th className="py-1 px-2 text-center border-r border-slate-700 w-11">
                  No
                </th>
                <th className="py-1 px-2 text-center border-r border-slate-700">
                  DESCRIPTION
                </th>
                <th className="py-1 px-2 text-center border-r border-slate-700 w-16">
                  QTY
                </th>
                <th className="py-1 px-2 text-center border-r border-slate-700 w-32">
                  UNIT PRICE
                </th>
                {hasDiscount && (
                  <th className="py-1 px-2 text-center border-r border-slate-700 w-24">
                    DISC.
                  </th>
                )}
                {hasVat && (
                  <th className="py-1 px-2 text-center border-r border-slate-700 w-24">
                    VAT
                  </th>
                )}
                <th className="py-1 px-2 text-center w-36">
                  AMOUNT
                </th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((it, i) => {
                const qtyNum = Number(it.qty || 1);
                const unitPriceNum = Number(it.unit_price || 0);
                const itemDisc = Number(it.item_discount || 0);
                const rawBase = Math.max(0, qtyNum * unitPriceNum - itemDisc);

                const hasExplicit = it.vat_rate !== undefined && it.vat_rate !== '';
                const lineVatRate = hasExplicit ? Number(it.vat_rate) : (hasExplicitLineVat ? 0 : vatRate);
                const lineBase = hasExplicit
                  ? rawBase
                  : vatRate > 0
                  ? rawBase / (1 + vatRate / 100)
                  : rawBase;
                const lineVat = hasExplicit
                  ? (rawBase * lineVatRate) / 100
                  : Math.max(0, rawBase - lineBase);
                const lineTotal = Number(it.line_total || rawBase);

                return (
                  <tr
                    key={i}
                    className="align-top border-b border-dotted border-slate-500"
                  >
                    <td className="py-1 px-2 text-right border-r border-slate-700 text-slate-800">
                      {i + 1}
                    </td>
                    <td className="py-1 px-2 border-r border-slate-700 space-y-0.5">
                      <div className="font-medium text-black break-words [overflow-wrap:anywhere]">
                        {it.item_name}
                      </div>
                      {it.item_description && (
                        <div className="text-[9.5pt] text-slate-600 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {it.item_description}
                        </div>
                      )}
                      {it.serial_numbers && it.serial_numbers.length > 0 && (
                        <div className="text-[9.5pt] text-slate-700">
                          S/N: {it.serial_numbers.join(', ')}
                        </div>
                      )}
                      {it.warranty_months > 0 && (
                        <div className="text-[9.5pt] text-slate-600">
                          Warranty: {it.warranty_label || `${it.warranty_months}M`}
                        </div>
                      )}
                    </td>
                    <td className="py-1 px-2 text-center border-r border-slate-700">
                      {it.qty}
                    </td>
                    <td className="py-1 px-2 text-right border-r border-slate-700 tabular-nums whitespace-nowrap">
                      {fmtMoney(it.unit_price)}
                    </td>
                    {hasDiscount && (
                      <td className="py-1 px-2 text-right border-r border-slate-700 tabular-nums whitespace-nowrap">
                        {Number(it.item_discount) > 0 ? `- ${fmtMoney(it.item_discount)}` : '—'}
                      </td>
                    )}
                    {hasVat && (
                      <td className="py-1 px-2 text-right border-r border-slate-700 tabular-nums whitespace-nowrap">
                        {lineVat > 0 ? fmtMoney(lineVat) : '—'}
                      </td>
                    )}
                    <td className="py-1 px-2 text-right tabular-nums whitespace-nowrap">
                      {fmtMoney(lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-700">
              {(hasVat || hasDiscount) && (
                <>
                  <tr className="border-b border-dotted border-slate-400 text-[10.5pt]">
                    <td className="py-1 px-2 border-r border-slate-700">&nbsp;</td>
                    <td className="py-1 px-3 border-r border-slate-700">&nbsp;</td>
                    <td
                      colSpan={2 + (hasDiscount ? 1 : 0) + (hasVat ? 1 : 0)}
                      className="py-1 px-3 text-right border-r border-slate-700 font-semibold text-slate-700 whitespace-nowrap"
                    >
                      Subtotal
                    </td>
                    <td className="py-1 px-2.5 text-right tabular-nums whitespace-nowrap">
                      {fmtMoney(taxableBase)}
                    </td>
                  </tr>
                  {hasVat && (
                    <tr className="border-b border-dotted border-slate-400 text-[10.5pt]">
                      <td className="py-1 px-2 border-r border-slate-700">&nbsp;</td>
                      <td className="py-1 px-3 border-r border-slate-700">&nbsp;</td>
                      <td
                        colSpan={2 + (hasDiscount ? 1 : 0) + (hasVat ? 1 : 0)}
                        className="py-1 px-3 text-right border-r border-slate-700 font-semibold text-slate-700 whitespace-nowrap"
                      >
                        Sales Tax {doc.vatRatePercent || '18'}%
                      </td>
                      <td className="py-1 px-2.5 text-right tabular-nums whitespace-nowrap">
                        {fmtMoney(calculatedVat)}
                      </td>
                    </tr>
                  )}
                  {hasDiscount && (
                    <tr className="border-b border-dotted border-slate-400 text-[10.5pt]">
                      <td className="py-1 px-2 border-r border-slate-700">&nbsp;</td>
                      <td className="py-1 px-3 border-r border-slate-700">&nbsp;</td>
                      <td
                        colSpan={2 + (hasDiscount ? 1 : 0) + (hasVat ? 1 : 0)}
                        className="py-1 px-3 text-right border-r border-slate-700 font-semibold text-slate-700 whitespace-nowrap"
                      >
                        Discount
                      </td>
                      <td className="py-1 px-2.5 text-right tabular-nums whitespace-nowrap">
                        - {fmtMoney(doc.discount)}
                      </td>
                    </tr>
                  )}
                </>
              )}

              <tr style={universCondensedStyle}>
                <td className="py-1.5 px-2 border-r border-slate-700">&nbsp;</td>
                <td className="py-1.5 px-2 border-r border-slate-700">&nbsp;</td>
                <td
                  colSpan={2 + (hasDiscount ? 1 : 0) + (hasVat ? 1 : 0)}
                  className="py-1.5 px-2 text-center border-r border-slate-700 font-bold text-[11.5pt] text-black uppercase whitespace-nowrap"
                >
                  TOTAL
                </td>
                <td className="py-1.5 px-2 text-right font-bold text-[11.5pt] text-black tabular-nums whitespace-nowrap">
                  {fmtMoney(doc.grandTotal)}
                </td>
              </tr>

              {showPaidBalance && (
                <>
                  <tr style={universCondensedStyle} className="border-t border-dotted border-slate-400 text-[11.5pt]">
                    <td className="py-1.5 px-2 border-r border-slate-700">&nbsp;</td>
                    <td className="py-1.5 px-2 border-r border-slate-700">&nbsp;</td>
                    <td
                      colSpan={2 + (hasDiscount ? 1 : 0) + (hasVat ? 1 : 0)}
                      className="py-1.5 px-2 text-center border-r border-slate-700 font-semibold text-slate-800 uppercase whitespace-nowrap"
                    >
                      PAID
                    </td>
                    <td className="py-1.5 px-2 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {fmtMoney(doc.paidAmount)}
                    </td>
                  </tr>
                  <tr style={universCondensedStyle} className="border-t border-dotted border-slate-400 text-[11.5pt] font-bold">
                    <td className="py-1.5 px-2 border-r border-slate-700">&nbsp;</td>
                    <td className="py-1.5 px-2 border-r border-slate-700">&nbsp;</td>
                    <td
                      colSpan={2 + (hasDiscount ? 1 : 0) + (hasVat ? 1 : 0)}
                      className="py-1.5 px-2 text-center border-r border-slate-700 text-red-600 uppercase whitespace-nowrap"
                    >
                      BALANCE DUE
                    </td>
                    <td className="py-1.5 px-2 text-right text-red-600 tabular-nums whitespace-nowrap">
                      {fmtMoney(doc.balanceDue)}
                    </td>
                  </tr>
                </>
              )}
            </tfoot>
          </table>
        </div>

        {/* Authorized Signature on Right (clear space for manual seal & signature) */}
        <div className="print-keep-together flex justify-end mt-4 mb-2 pr-2">
          <div className="w-56 text-center">
            <div className="sig-spacer h-10" />
            <div className="border-t border-slate-500 pt-1 text-[10pt] font-medium text-slate-700">
              Authorized Signature
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-Left Terms & Payment Details */}
      <div className="print-keep-together relative z-10 mt-3 pt-2 text-[10pt] text-slate-900 space-y-1.5">
        {(settings.invoice_terms || doc.notes) && (
          <div className="space-y-0.5">
            <div className="font-bold text-black">Terms &amp; Conditions</div>
            {settings.invoice_terms && (
              <div className="text-slate-800">{settings.invoice_terms}</div>
            )}
            {doc.notes && (
              <div className="text-slate-800 whitespace-pre-wrap">{doc.notes}</div>
            )}
          </div>
        )}

        {(doc.paymentMethod?.toUpperCase() === 'CHEQUE' || doc.paymentRef || doc.branchLocation) && (
          <div className="text-[10pt] text-slate-800 space-y-0.5">
            {doc.paymentMethod?.toUpperCase() === 'CHEQUE' && (
              <div>
                Cheque No: {doc.chequeNo || '—'} | Bank: {doc.chequeBank || '—'}
                {doc.chequeDate ? ` | Date: ${doc.chequeDate}` : ''}
              </div>
            )}
            {doc.paymentRef && <div>Payment Ref: {doc.paymentRef}</div>}
            {doc.branchLocation && <div>Branch: {doc.branchLocation}</div>}
          </div>
        )}
      </div>

      {/* Footer Thank You Message */}
      <div
        style={universCondensedStyle}
        className="print-keep-together relative z-10 mt-4 pt-2 border-t border-slate-200 text-center text-[11pt] font-semibold text-slate-900"
      >
        Thank You for Your Business!
      </div>
    </div>
  );
}
