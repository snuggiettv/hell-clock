// src/utils/affixIndex.ts  (fix zeros; keep legacy percent behavior)
export type StatMath = 'Additive' | 'Multiplicative' | 'MultiplicativeAdditive' | 'Unknown';

export type RawRow = {
  pattern?: string;                   // raw text (unused for legacy behavior)
  statKey?: string;
  statModifierType?: StatMath | string;
  value?: number | null;
  rawNumbers?: number[];
  nodeId?: string;
  icon?: string;
};

export type SummaryResult = {
  sectionLines: Record<string, string[]>;
};

const SECTION_ORDER = ['ORBS','SPEED','DAMAGE','SURVIVAL','ECONOMY','MISC'];

function prettyLabelFromKey(k: string): string {
  if (!k) return 'Unknown';
  return k
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^E /, '')
    .replace(/\bHp\b/i, 'HP')
    .replace(/\bHpMax\b/i, 'Max HP');
}

function mapStatKeyToSection(k: string): string {
  const s = (k || '').toLowerCase();
  if (/(orb|agility|power)/.test(s)) return 'ORBS';
  if (/(move|movement|attack|cast|evasion|cooldown|speed)/.test(s)) return 'SPEED';
  if (/(crit|damage|ignite|plague|wither|blight|fire|lightning|magic|physical|poison|bleed|base)/.test(s)) return 'DAMAGE';
  if (/(life|hp|maxlife|mana|barrier|resist|armor|defense|potion|ward)/.test(s)) return 'SURVIVAL';
  if (/(gold|reroll|cost)/.test(s)) return 'ECONOMY';
  return 'MISC';
}

// legacy (pre percent-aware) behavior: always show additive as %
function displayFor(math: StatMath, acc: {sum?:number, prod?:number, plus?:number}): string {
  if (math === 'Multiplicative') {
    const p = acc.prod ?? 1;
    const pct = (p - 1) * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%[x]`;
  }
  if (math === 'MultiplicativeAdditive') {
    const plus = acc.plus ?? 0;
    const sign = plus >= 0 ? '+' : '';
    return `${sign}${plus.toFixed(1)}%[+]`;
  }
  const s = acc.sum ?? 0;
  const sign = s >= 0 ? '+' : '';
  return `${sign}${s.toFixed(1)}%`;
}

// value source with fallback to rawNumbers (fix zeros)
function guessValue(r: RawRow): number | null {
  if (r.value != null) {
    const v = Number(r.value);
    return Number.isFinite(v) ? v : null;
  }
  if (Array.isArray(r.rawNumbers) && r.rawNumbers.length) {
    const v = Number(r.rawNumbers[0]);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

// normalize into accumulators for each math
function normalizeContrib(math: StatMath, raw: number): {sum?:number, prod?:number, plus?:number} {
  if (math === 'Multiplicative') {
    const factor = Math.abs(raw) > 1.5 ? (1 + raw/100) : raw;
    return { prod: factor };
  }
  if (math === 'MultiplicativeAdditive') {
    let plus = 0;
    if (Math.abs(raw) > 1.5) plus = raw;
    else if (raw > 1)         plus = (raw - 1) * 100;
    else                      plus = raw * 100;
    return { plus };
  }
  // Additive (legacy): assume % numbers
  const sum = (Math.abs(raw) <= 1.5) ? (raw * 100) : raw;
  return { sum };
}

export function buildStatGroups(rows: RawRow[]): SummaryResult {
  const groups = new Map<string, { section: string, label: string, math: StatMath, sum?:number, prod?:number, plus?:number }>();

  for (const r of rows) {
    const key = String(r.statKey || '').trim();
    const math = String(r.statModifierType || 'Additive') as StatMath;
    if (!key) continue;
    if (math === 'Unknown') continue;

    const section = mapStatKeyToSection(key);
    const label = prettyLabelFromKey(key);
    const gkey = `${section}|${label}|${math}`;
    const acc = groups.get(gkey) || { section, label, math, sum: 0, prod: 1, plus: 0 };

    const v = guessValue(r);
    if (v != null) {
      const contrib = normalizeContrib(math, v);
      if (math === 'Multiplicative') {
        acc.prod = (acc.prod ?? 1) * (contrib.prod ?? 1);
      } else if (math === 'MultiplicativeAdditive') {
        acc.plus = (acc.plus ?? 0) + (contrib.plus ?? 0);
      } else {
        acc.sum = (acc.sum ?? 0) + (contrib.sum ?? 0);
      }
    }

    groups.set(gkey, acc);
  }

  const bySection: Record<string, string[]> = {};
  for (const sec of SECTION_ORDER) bySection[sec] = [];

  for (const acc of groups.values()) {
    const line = `${acc.label}: ${displayFor(acc.math, acc)}`;
    (bySection[acc.section] ||= []).push(line);
  }

  for (const sec of Object.keys(bySection)) {
    bySection[sec].sort((a,b) => a.localeCompare(b));
  }

  return { sectionLines: bySection };
}
