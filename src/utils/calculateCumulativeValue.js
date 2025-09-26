/* /src/utils/calculateCumulativeValue.ts */
/** Returns the numeric value for the given rank (e.g. 8 + (rank-1)*2). */
export function effectiveValue({ rank = 1, value, valuePerLevel = 0, }) {
    const r = Math.max(1, Math.floor(rank));
    return Number(value || 0) + (r - 1) * Number(valuePerLevel || 0);
}
/** Turns a percent-point value (e.g. +10%) into a multiplicative factor (1.10). */
export function percentPointsToFactor(points) {
    return 1 + points / 100;
}
/**
 * Convenience: for multiplicative lines return a factor; otherwise return the additive number.
 * This is handy if you want to accumulate factors for "Multiplicative" and sum for "Additive".
 */
export function cumulativeUnit({ rank = 1, value, valuePerLevel = 0, modifierType = 'Additive', }) {
    const v = effectiveValue({ rank, value, valuePerLevel });
    if (modifierType === 'Multiplicative')
        return percentPointsToFactor(v);
    return v; // Additive / Max use raw numeric
}
export function calculateCumulativeValue({ rank, value, valuePerLevel, modifierType, }) {
    if (rank <= 0)
        return 0;
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
