/* /src/utils/formatStatDisplay.ts */

export function formatStatDisplay(
  value: number,
  isPercent: boolean,
  modifierType?: 'Additive' | 'Multiplicative'
): string {
  if (modifierType === 'Multiplicative') {
    const delta = (value ?? 1) - 1;
    const sign = delta >= 0 ? '+' : '-';
    const pct = Math.abs(delta) * 100;
    return `${sign}${pct.toFixed(1)}%[x]`;
  }

  const sign = (value ?? 0) >= 0 ? '+' : '-';
  const mag = Math.abs(value ?? 0);
  if (isPercent) return `${sign}${(mag * 100).toFixed(1)}%`;
  return `${sign}${mag.toFixed(1)}`;
}
