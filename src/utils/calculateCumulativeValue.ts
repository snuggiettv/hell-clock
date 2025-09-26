/* /src/utils/calculateCumulativeValue.ts */

export type ModifierType = 'Additive' | 'Multiplicative' | 'Max';

export interface CumValueInput {
  /** Rank/level of the node affix. If you don’t use ranks yet, pass 1. */
  rank?: number;
  /** Base value at rank 1 (e.g. 8 or 8%). */
  value: number;
  /** Optional increment per rank above 1. */
  valuePerLevel?: number;
  /** How this line stacks when aggregating across many rows. */
  modifierType?: ModifierType;
}

/** Returns the numeric value for the given rank (e.g. 8 + (rank-1)*2). */
export function effectiveValue({
  rank = 1,
  value,
  valuePerLevel = 0,
}: Pick<CumValueInput, 'rank' | 'value' | 'valuePerLevel'>): number {
  const r = Math.max(1, Math.floor(rank));
  return Number(value || 0) + (r - 1) * Number(valuePerLevel || 0);
}

/** Turns a percent-point value (e.g. +10%) into a multiplicative factor (1.10). */
export function percentPointsToFactor(points: number): number {
  return 1 + points / 100;
}

/**
 * Convenience: for multiplicative lines return a factor; otherwise return the additive number.
 * This is handy if you want to accumulate factors for "Multiplicative" and sum for "Additive".
 */
export function cumulativeUnit({
  rank = 1,
  value,
  valuePerLevel = 0,
  modifierType = 'Additive',
}: CumValueInput): number {
  const v = effectiveValue({ rank, value, valuePerLevel });
  if (modifierType === 'Multiplicative') return percentPointsToFactor(v);
  return v; // Additive / Max use raw numeric
}

export function calculateCumulativeValue({
  rank,
  value,
  valuePerLevel,
  modifierType,
}: {
  rank: number;
  value: number;
  valuePerLevel: number;
  modifierType: 'Additive' | 'Multiplicative';
}): number {
  if (rank <= 0) return 0;

  // Handle valuePerLevel special case
  if (valuePerLevel !== 0) {
    return value + valuePerLevel * (rank - 1);
  }

  // Handle additive vs multiplicative separately
  if (modifierType === 'Multiplicative') {
    return Math.pow(value, rank);
  }

  // Default linear scaling if valuePerLevel is zero
  return value * rank;
}