/**
 * materializeAffixLine.ts  —  COMMENTED
 *
 * Purpose
 *  Turn an affix "pattern" (e.g., "+#%[x] Critical Chance") plus its numeric
 *  values into the exact, human-readable line the player should see.
 *
 * This file feeds BOTH:
 *  • Tooltips (computed lines = no '#', correct % math)
 *  • Stat Summary (numbers are parsed from these same materialized lines)
 *
 * Key rules (do NOT change behavior here):
 *  • Prefer structured values from the data export (value, value2, ...).
 *    Use rawNumbers ONLY as a fallback when structured values are absent.
 *  • If there are no numbers for the pattern, return the pattern verbatim
 *    (never inject 0s into '#'). This avoids "0.0%[x]" artifacts.
 *  • Percent handling:
 *      - "%[x]" and "%[+]" typically receive factors/decimals (1.15 or 0.15).
 *        Convert these to percent points for display (1.15 → 15.0, 0.15 → 15.0).
 *      - Simple additive "%" may also arrive as decimals; convert small decimals
 *        to percent points (0.30 → 30.0).
 *  • Flats: render as integers when possible; otherwise one decimal is fine.
 *
 * Known good behavior
 *  • Hunter’s Vision should display "15.0%[x]" (or "14.0%[x]" depending on data).
 *    If you ever see "0.0%[x]" in the tooltip, it means a caller rendered RAW
 *    template lines and templated with empty/zero effect values — that is NOT
 *    the materializer’s fault. Ensure the tooltip prefers computed lines.
 */

// src/utils/materializeAffixLine.ts
export type OverrideMap = Record<string, string>;

export type AffixRowForMaterialize = {
  pattern: string;
  value?: number | null;
  value2?: number | null;
  value3?: number | null;
  value4?: number | null;
  valuePerLevel?: number | null;
  statKey?: string | null;
  statModifierType?: string | null;
  rawNumbers?: Array<number | string> | null;
};

/**
 * applyOverrides(pattern, statKey, overrides)
 *  - Applies text overrides for a given pattern/statKey.
 *  - Special pattern "__HIDE__" means "suppress this row" (caller should omit it).
 *  - Notes:
 *      • This controls TEXT ONLY; it does not change aggregation math.
 */
export function applyOverrides(
  pattern: string,
  statKey?: string | null,
  overrides?: OverrideMap
): string {
  const base = pattern || '';
  if (!overrides) return base;
  const key = (statKey ?? '').trim();
  const byStat = key ? overrides[key] : undefined;
  const byPattern = overrides[base];
  const pick = byStat ?? byPattern ?? base;
  return pick === '__HIDE__' ? '' : pick;
}

// Formats a single numeric token according to the pattern semantics.
/**
 * fmtValueForPattern(value, pattern)
 *  - Formats a single numeric token for the given pattern.
 *  - Handles multiplicatives (`%[x]`) and plus-bucket (`%[+]`) by converting
 *    factor/decimal inputs (e.g., 1.15 or 0.15) into percent points (15.0).
 *  - For additive "%" lines, small decimals are treated as percent points (0.30 → 30.0).
 *  - Returns "#" if the value is missing/NaN so the caller preserves the token.
 */
export function fmtValueForPattern(
  value: number | null | undefined,
  pattern: string
): string {
  if (value == null) return '#';

  let v = Number(value);
  if (Number.isNaN(v)) return '#';

  const hasPercent = pattern.includes('%');
  const isMult = pattern.includes('%[x]');
  const isPlus = pattern.includes('%[+]');

  // Multiplicative / plus-bucket: treat factor/decimal as percent points
  if (hasPercent && (isMult || isPlus)) {
    if (Math.abs(v) <= 2) v = v > 1 ? (v - 1) * 100 : v * 100; // 1.14→14, 0.14→14
    return v.toFixed(1);
  }

  // Simple additive %: small decimals are percent points
  if (hasPercent) {
    if (Math.abs(v) <= 1.5) v = v * 100; // 0.30→30
    return v.toFixed(1);
  }

  // Flat numbers
  const rounded = Math.round(v);
  return Math.abs(v - rounded) < 1e-6 ? String(rounded) : v.toFixed(1);
}

// Prefer structured values; only fall back to rawNumbers if needed.
/**
 * numberSequence(row, pattern)
 *  - Builds the ordered list of numbers that replace '#' tokens in `pattern`.
 *  - Prefers structured fields: value, value2, value3, value4 (and friends).
 *  - Falls back to rawNumbers ONLY if structured values are absent.
 *  - Do not coerce empties into zeros; an empty sequence must stay empty.
 */
function numberSequence(row: AffixRowForMaterialize, _pattern: string): number[] {
  const seq: number[] = [];
  const push = (x: unknown) => {
    const n = Number(x as any);
    if (x != null && !Number.isNaN(n)) seq.push(n);
  };

  push(row.value);
  push(row.value2); push(row.value3); push(row.value4);
  // (optionally include row.valuePerLevel if your patterns expect it)

  if (seq.length > 0) return seq;

  if (Array.isArray(row.rawNumbers)) {
    for (const n of row.rawNumbers) {
      const num = Number(n as any);
      if (!Number.isNaN(num)) seq.push(num);
    }
  }
  return seq;
}

/**
 * materializeAffixLine(row, overrides)
 *  - Produces the final player-facing string by injecting numbers into '#' tokens.
 *  - Critical behavior:
 *      • If there are no numbers for this pattern, return the pattern verbatim.
 *        (This prevents "0%"/"0.0%[x]" artifacts that come from fake zero fill.)
 *      • Each token is routed through fmtValueForPattern so percent math matches QA.
 *  - If Hunter’s Vision ever shows "0.0%[x]", check the tooltip callsite:
 *    ensure it uses these materialized lines, not raw templates.
 */
export function materializeAffixLine(
  row: AffixRowForMaterialize,
  overrides?: OverrideMap
): string {
  const base = row?.pattern ?? '';
  const pattern = applyOverrides(base, row?.statKey ?? undefined, overrides);
  if (!pattern) return '';

  const seq = numberSequence(row, pattern);
  if (!Array.isArray(seq) || seq.length === 0) {
    // No numbers available — return the original pattern verbatim (never inject 0s).
    return pattern;
  }

  let i = 0;
  return pattern.replace(/#/g, () => fmtValueForPattern(seq[i++] ?? null, pattern));
}
