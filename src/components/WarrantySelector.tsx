'use client';

import React, { useEffect, useRef, useState } from 'react';

export const WARRANTY_PRESETS = [
  { months: 0, label: 'No Warranty' },
  { months: 1, label: '1 Month' },
  { months: 3, label: '3 Months' },
  { months: 6, label: '6 Months' },
  { months: 12, label: '1 Year' },
  { months: 24, label: '2 Years' },
  { months: 36, label: '3 Years' },
  { months: 60, label: '5 Years' },
] as const;

export function formatWarrantyLabel(amount: number, unit: 'years' | 'months'): string {
  const n = Math.max(0, Math.round(amount));
  if (n <= 0) return 'No Warranty';
  if (unit === 'years') return n === 1 ? '1 Year' : `${n} Years`;
  return n === 1 ? '1 Month' : `${n} Months`;
}

function findPreset(months: number, label: string) {
  return (
    WARRANTY_PRESETS.find((p) => p.months === months && p.label === label) ||
    WARRANTY_PRESETS.find((p) => p.months === months)
  );
}

function deriveCustomParts(months: number): { amount: string; unit: 'years' | 'months' } {
  const safe = Math.max(0, Math.round(Number(months) || 0));
  if (safe === 0) return { amount: '10', unit: 'years' };
  if (safe % 12 === 0) return { amount: String(safe / 12), unit: 'years' };
  return { amount: String(safe), unit: 'months' };
}

interface WarrantySelectorProps {
  months: number;
  label: string;
  onChange: (value: { warranty_months: number; warranty_label: string }) => void;
  compact?: boolean;
  selectClassName?: string;
}

export function WarrantySelector({
  months,
  label,
  onChange,
  compact = false,
  selectClassName,
}: WarrantySelectorProps) {
  const initialPreset = findPreset(months, label);
  const initialParts = deriveCustomParts(months);

  const [isCustom, setIsCustom] = useState<boolean>(!initialPreset);
  const [customAmount, setCustomAmount] = useState<string>(initialParts.amount);
  const [customUnit, setCustomUnit] = useState<'years' | 'months'>(initialParts.unit);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastEmittedRef = useRef<{ months: number; label: string } | null>(null);

  useEffect(() => {
    const last = lastEmittedRef.current;
    if (last && last.months === months && last.label === label) {
      return;
    }
    const preset = findPreset(months, label);
    if (preset) {
      setIsCustom(false);
    } else {
      const parts = deriveCustomParts(months);
      setIsCustom(true);
      setCustomAmount(parts.amount);
      setCustomUnit(parts.unit);
    }
  }, [months, label]);

  const emitChange = (nextMonths: number, nextLabel: string) => {
    lastEmittedRef.current = { months: nextMonths, label: nextLabel };
    onChange({ warranty_months: nextMonths, warranty_label: nextLabel });
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'CUSTOM') {
      const parts = deriveCustomParts(months);
      setIsCustom(true);
      setCustomAmount(parts.amount);
      setCustomUnit(parts.unit);
      if (months <= 0) {
        const n = Number(parts.amount) || 10;
        const m = parts.unit === 'years' ? n * 12 : n;
        emitChange(m, formatWarrantyLabel(n, parts.unit));
      }
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 20);
      return;
    }

    const [mStr, lStr] = val.split('|');
    setIsCustom(false);
    emitChange(Number(mStr), lStr);
  };

  const handleAmountChange = (raw: string) => {
    if (raw === '') {
      setCustomAmount('');
      emitChange(0, 'No Warranty');
      return;
    }
    const parsed = Math.floor(Number(raw));
    if (Number.isNaN(parsed) || parsed < 0) return;
    const maxVal = customUnit === 'years' ? 100 : 1200;
    const clamped = Math.min(maxVal, parsed);
    setCustomAmount(String(clamped));
    const nextMonths = customUnit === 'years' ? clamped * 12 : clamped;
    emitChange(nextMonths, formatWarrantyLabel(clamped, customUnit));
  };

  const handleUnitChange = (nextUnit: 'years' | 'months') => {
    setCustomUnit(nextUnit);
    const parsed = Math.max(0, Math.floor(Number(customAmount) || 0));
    const maxVal = nextUnit === 'years' ? 100 : 1200;
    const clamped = Math.min(maxVal, parsed);
    if (customAmount !== '') {
      setCustomAmount(String(clamped));
    }
    const nextMonths = nextUnit === 'years' ? clamped * 12 : clamped;
    emitChange(nextMonths, formatWarrantyLabel(clamped, nextUnit));
  };

  const matchedPreset = findPreset(months, label);
  const selectValue = isCustom || !matchedPreset ? 'CUSTOM' : `${matchedPreset.months}|${matchedPreset.label}`;

  return (
    <div className="w-full">
      <select
        value={selectValue}
        onChange={handleSelectChange}
        className={
          selectClassName ||
          (compact
            ? 'w-full px-2 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:border-indigo-500 outline-none'
            : 'w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:border-indigo-500 outline-none')
        }
      >
        {WARRANTY_PRESETS.map((w) => (
          <option key={w.months} value={`${w.months}|${w.label}`}>
            {w.label}
          </option>
        ))}
        <option value="CUSTOM">Custom...</option>
      </select>

      {isCustom && (
        <div className={compact ? 'mt-1.5 flex items-center gap-1' : 'mt-2 space-y-1'}>
          <div className={compact ? 'flex items-center gap-1 w-full' : 'flex items-center gap-2'}>
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={customUnit === 'years' ? 100 : 1200}
              step={1}
              value={customAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="10"
              aria-label="Custom warranty duration"
              className={
                compact
                  ? 'w-12 px-1.5 py-1 rounded-lg border border-indigo-300 bg-indigo-50/40 text-xs font-bold text-indigo-800 text-center outline-none focus:border-indigo-500 tabular-nums'
                  : 'w-24 px-3 py-1.5 rounded-xl border border-indigo-300 bg-indigo-50/30 text-sm font-bold text-indigo-800 outline-none focus:border-indigo-500 tabular-nums'
              }
            />
            <select
              value={customUnit}
              onChange={(e) => handleUnitChange(e.target.value as 'years' | 'months')}
              aria-label="Custom warranty unit"
              className={
                compact
                  ? 'flex-1 min-w-0 px-1 py-1 rounded-lg border border-indigo-300 bg-white text-[11px] font-semibold text-slate-700 outline-none focus:border-indigo-500'
                  : 'flex-1 px-2.5 py-1.5 rounded-xl border border-indigo-300 bg-white text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500'
              }
            >
              <option value="years">{compact ? 'Yrs' : 'Years'}</option>
              <option value="months">{compact ? 'Mos' : 'Months'}</option>
            </select>
          </div>
          {!compact && months > 0 && (
            <div className="text-[11px] font-medium text-indigo-600">
              {label} ({months} months)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
