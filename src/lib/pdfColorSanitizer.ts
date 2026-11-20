/**
 * Sanitizes modern CSS color functions (oklch, oklab, color-mix, lab, lch, color())
 * in a cloned DOM tree for html2canvas 1.4.x compatibility with Tailwind CSS v4.
 */

const MODERN_COLOR_HINT_RE = /(oklch|oklab|color-mix|\blch\(|\blab\(|color\()/i;
const MODERN_COLOR_FN_RE = /(oklch|oklab|color-mix|lch|lab|color)\s*\(/gi;

function findMatchingParen(str: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function replaceModernColorFunctions(
  value: string,
  resolveColor: (expr: string) => string
): string {
  if (!MODERN_COLOR_HINT_RE.test(value)) return value;

  MODERN_COLOR_FN_RE.lastIndex = 0;
  let result = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = MODERN_COLOR_FN_RE.exec(value)) !== null) {
    const start = match.index;
    if (start > 0 && /[a-zA-Z0-9_-]/.test(value[start - 1])) {
      continue;
    }

    const openParen = value.indexOf('(', start);
    if (openParen === -1) break;

    const closeParen = findMatchingParen(value, openParen);
    if (closeParen === -1) break;

    const expr = value.slice(start, closeParen + 1);
    const resolved = resolveColor(expr);

    result += value.slice(cursor, start) + resolved;
    cursor = closeParen + 1;
    MODERN_COLOR_FN_RE.lastIndex = cursor;
  }

  if (cursor === 0) return value;
  return result + value.slice(cursor);
}

function createCanvasColorResolver(): (expr: string) => string {
  const cache = new Map<string, string>();
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  return (expr: string): string => {
    const trimmed = expr.trim();
    if (!trimmed) return expr;

    const cached = cache.get(trimmed);
    if (cached !== undefined) return cached;

    if (!ctx) return expr;
    if (
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      !CSS.supports('color', trimmed)
    ) {
      return expr;
    }

    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillStyle = trimmed;
    ctx.fillRect(0, 0, 1, 1);

    const data = ctx.getImageData(0, 0, 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const a = data[3];

    const converted =
      a === 255
        ? `rgb(${r}, ${g}, ${b})`
        : `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(3))})`;

    cache.set(trimmed, converted);
    return converted;
  };
}

export function sanitizeClonedDocumentColors(
  clonedDoc: Document,
  clonedRoot: HTMLElement
): void {
  const clonedWin = clonedDoc.defaultView || window;
  const resolveColor = createCanvasColorResolver();

  clonedDoc.documentElement.style.setProperty('background-color', '#ffffff', 'important');
  clonedDoc.body.style.setProperty('background-color', '#ffffff', 'important');

  const elements: Element[] = [
    clonedDoc.documentElement,
    clonedDoc.body,
    clonedRoot,
    ...Array.from(clonedRoot.querySelectorAll('*')),
  ];

  const pseudoRules: string[] = [];
  let pseudoCounter = 0;

  for (const el of elements) {
    const cs = clonedWin.getComputedStyle(el);
    if ('style' in el && el.style) {
      const styleDecl = (el as HTMLElement | SVGElement).style;
      for (let i = 0; i < cs.length; i++) {
        const prop = cs[i];
        const val = cs.getPropertyValue(prop);
        if (!val || !MODERN_COLOR_HINT_RE.test(val)) continue;
        const converted = replaceModernColorFunctions(val, resolveColor);
        if (converted !== val) {
          styleDecl.setProperty(prop, converted, 'important');
        }
      }
    }

    for (const pseudo of ['::before', '::after'] as const) {
      const pcs = clonedWin.getComputedStyle(el, pseudo);
      if (!pcs.content || pcs.content === 'none' || pcs.content === 'normal') continue;

      const overrides: string[] = [];
      for (let i = 0; i < pcs.length; i++) {
        const prop = pcs[i];
        const val = pcs.getPropertyValue(prop);
        if (!val || !MODERN_COLOR_HINT_RE.test(val)) continue;
        const converted = replaceModernColorFunctions(val, resolveColor);
        if (converted !== val) {
          overrides.push(`${prop}: ${converted} !important;`);
        }
      }

      if (overrides.length > 0) {
        const marker = String(++pseudoCounter);
        el.setAttribute('data-h2c-pseudo', marker);
        pseudoRules.push(`[data-h2c-pseudo="${marker}"]${pseudo} { ${overrides.join(' ')} }`);
      }
    }
  }

  if (pseudoRules.length > 0) {
    const styleEl = clonedDoc.createElement('style');
    styleEl.textContent = pseudoRules.join('\n');
    clonedDoc.head.appendChild(styleEl);
  }
}
