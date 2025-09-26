// src/utils/aggregateTotals.ts

export type ModifierType = 'Additive' | 'Multiplicative' | 'Max';

export type AffixRow = {
  pattern: string;              // e.g. "Movement Speed +#%"
  value: number;                // base value (e.g. 8)
  valuePerLevel?: number;       // optional (we'll ignore ranks on the map for now)
  modifierType?: ModifierType;  // optional hint
  statKey?: string;             // optional stable key
};

type Agg = {
  key: string;
  label: string;              // final text template (after overrides)
  total: number;              // percent points OR flat units
  isPercent: boolean;
  stack: 'sum' | 'mult' | 'max';
};

// ——— helpers ———
const isPercentPattern = (s: string) => /%/.test(s);
const normalizeKey = (row: AffixRow) =>
  (row.statKey?.trim() ||
    (row.pattern || '')
      .toLowerCase()
      .replace(/[-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/-?\d+(\.\d+)?/g, '#')
      .trim());

const pickStack = (row: AffixRow): 'sum' | 'mult' | 'max' =>
  row.modifierType === 'Multiplicative' ? 'mult' : 'sum';

const applyOverrides = (row: AffixRow, overrides: Record<string, string>) => {
  const key = row.statKey?.trim() || '';
  return (key && overrides[key]) || overrides[row.pattern] || row.pattern || '';
};

const formatLine = (label: string, total: number, isPercent: boolean) => {
  const val = isPercent ? Math.round(total * 10) / 10 : Math.round(total * 100) / 100;
  return label.replace(/#%?/, isPercent ? `${val}%` : `${val}`);
};

// ——— main ———
export function aggregateTotals(
  rows: AffixRow[],
  overrides: Record<string, string> = {}
): { lines: string[] } {
  const acc = new Map<string, Agg>();

  for (const r of rows) {
    const key = normalizeKey(r);
    const label = applyOverrides(r, overrides);
    const isPct = isPercentPattern(label);
    const stack = pickStack(r);

    if (!acc.has(key)) {
      acc.set(key, {
        key,
        label,
        isPercent: isPct,
        stack,
        total: stack === 'mult' ? 1 : stack === 'max' ? -Infinity : 0,
      });
    }
    const a = acc.get(key)!;

    // Map view: treat everything as rank=1 for now
    const v = Number(r.value || 0);

    if (stack === 'sum') {
      a.total += v;
    } else if (stack === 'mult') {
      // if data is given in percent points, convert to factor (e.g. +10% => *1.10)
      const factor = 1 + v / 100;
      a.total *= factor;
    } else {
      a.total = Math.max(a.total, v);
    }
  }

  // finalize multiplicatives back to percent points
  for (const a of acc.values()) {
    if (a.stack === 'mult') a.total = (a.total - 1) * 100;
    if (a.stack === 'max' && a.total === -Infinity) a.total = 0;
  }

  const items = Array.from(acc.values()).sort((x, y) => x.label.localeCompare(y.label));
  return { lines: items.map(it => formatLine(it.label, it.total, it.isPercent)) };
}
