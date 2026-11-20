'use client';

import React, { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, X } from 'lucide-react';

export interface PaymentTargetInfo {
  kind: 'INVOICE' | 'GRN';
  id: number;
  docNo: string;
  partyName: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
}

interface PaymentSettlementModalProps {
  target: PaymentTargetInfo | null;
  fmtMoney: (val: number | string | undefined) => string;
  onClose: () => void;
  onSubmit: (target: PaymentTargetInfo, amount: number) => Promise<void>;
}

export function PaymentSettlementModal({
  target,
  fmtMoney,
  onClose,
  onSubmit,
}: PaymentSettlementModalProps) {
  const [amountInput, setAmountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (target) {
      setAmountInput(String(Number(target.balanceDue || 0)));
      setSubmitting(false);
    }
  }, [target]);

  if (!target) return null;

  const parsedAmount = Number(amountInput);
  const isValid = !Number.isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= target.balanceDue + 0.01;
  const remainingAfter = Math.max(0, target.balanceDue - (Number.isNaN(parsedAmount) ? 0 : parsedAmount));

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(target, parsedAmount);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4 no-print"
      onClick={onClose}
    >
      <form
        onSubmit={handleConfirm}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-modal-in"
      >
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {target.kind === 'INVOICE' ? 'Record Customer Payment' : 'Record Supplier Payment'}
              </h3>
              <p className="text-[11px] text-slate-300">
                {target.docNo} • {target.partyName || 'Walk-in'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Total</div>
              <div className="text-xs font-bold text-slate-800 tabular-nums mt-0.5">
                {fmtMoney(target.totalAmount)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Paid</div>
              <div className="text-xs font-bold text-emerald-700 tabular-nums mt-0.5">
                {fmtMoney(target.paidAmount)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Balance Due</div>
              <div className="text-xs font-extrabold text-rose-600 tabular-nums mt-0.5">
                {fmtMoney(target.balanceDue)}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Payment Amount (Rs.)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAmountInput((target.balanceDue / 2).toFixed(2))}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => setAmountInput(String(target.balanceDue))}
                  className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition"
                >
                  Full Balance
                </button>
              </div>
            </div>
            <input
              type="number"
              step="any"
              min={0.01}
              max={target.balanceDue}
              autoFocus
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15 outline-none text-lg font-extrabold text-right text-slate-900 tabular-nums"
            />
          </div>

          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="font-medium text-slate-600">Remaining Balance After Payment:</span>
            <span className={`font-bold tabular-nums ${remainingAfter <= 0 ? 'text-emerald-600' : 'text-amber-700'}`}>
              {remainingAfter <= 0 ? 'Rs. 0.00 (FULLY PAID)' : fmtMoney(remainingAfter)}
            </span>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || submitting}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Saving...' : 'Confirm Payment'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
