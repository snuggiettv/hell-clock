// src/utils/aggregateTotals.ts
// ——— helpers ———
const isPercentPattern = (s) => /%/.test(s);
const normalizeKey = (row) => (row.statKey?.trim() ||
    (row.pattern || '')
        .toLowerCase()
        .replace(/[-–—]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/-?\d+(\.\d+)?/g, '#')
        .trim());
const pickStack = (row) => row.modifierType === 'Multiplicative' ? 'mult' : 'sum';
const applyOverrides = (row, overrides) => {
    const key = row.statKey?.trim() || '';
    return (key && overrides[key]) || overrides[row.pattern] || row.pattern || '';
};
const formatLine = (label, total, isPercent) => {
    const val = isPercent ? Math.round(total * 10) / 10 : Math.round(total * 100) / 100;
    return label.replace(/#%?/, isPercent ? `${val}%` : `${val}`);
};
// ——— main ———
export function aggregateTotals(rows, overrides = {}) {
    const acc = new Map();
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
        const a = acc.get(key);
        // Map view: treat everything as rank=1 for now
        const v = Number(r.value || 0);
        if (stack === 'sum') {
            a.total += v;
        }
        else if (stack === 'mult') {
            // if data is given in percent points, convert to factor (e.g. +10% => *1.10)
            const factor = 1 + v / 100;
            a.total *= factor;
        }
        else {
            a.total = Math.max(a.total, v);
        }
    }
    // finalize multiplicatives back to percent points
    for (const a of acc.values()) {
        if (a.stack === 'mult')
            a.total = (a.total - 1) * 100;
        if (a.stack === 'max' && a.total === -Infinity)
            a.total = 0;
    }
    const items = Array.from(acc.values()).sort((x, y) => x.label.localeCompare(y.label));
    return { lines: items.map(it => formatLine(it.label, it.total, it.isPercent)) };
}
