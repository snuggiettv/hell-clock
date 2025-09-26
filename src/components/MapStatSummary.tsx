// src/components/MapStatSummary.tsx
import * as React from 'react';
import overrides from '../data/affix-overrides.json';
import {
  FLAT_STATS,
  LABEL_OVERRIDES,
  resolveSectionOverride,
  DISPLAY_OVERRIDES,
  DISPLAY_OVERRIDES_BY_TYPE,
} from '../config/statDisplayRules';
import { materializeAffixLine } from '../utils/materializeAffixLine';

type StatMath = 'Additive' | 'Multiplicative' | 'MultiplicativeAdditive';

type InputRow = any; // incoming shape from map extractor
type Row = {
  raw: string;             // safe, materialized English line with numbers
  type?: string;
  statKey?: string;
  statMath?: string;
  nums: number[];          // parsed numeric values (from rawNumbers or from raw)
};

type Section =
  | 'Life' | 'Mana' | 'Speed' | 'Damage' | 'Resistances' | 'Survival'
  | 'Summons' | 'Skills'
  | 'Power Orb' | 'Agility Orb' | 'Orbs'
  | 'Misc';

const ORDER: Section[] = [
  'Life','Mana','Speed','Damage','Resistances','Survival','Summons','Skills',
  'Power Orb','Agility Orb','Orbs','Misc'
];

/** Normalize weird minus signs and invisible spaces so “−10%[x]” parses as -10. */
function normalizeMinus(s: unknown): string {
  return String(s ?? '')
    // remove zero-width/thin/nbsp that can split sign from digits
    .replace(/[\u200B\u200C\u200D\u2060\u00A0\u202F\u2007\u2009]/g, '')
    // map a wide set of minus-like glyphs to ASCII '-'
    .replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\u2015\u2043\uFF0D\uFE63\u207B\u208B\u2796]/g, '-');
}

// ───────── helpers
function parseNumbersSafe(s: unknown): number[] {
  const text = normalizeMinus(s);
  const hits = text.match(/[+-]?\d+(?:\.\d+)?/g);
  return hits ? hits.map(Number) : [];
}
function toMath(s?: string): StatMath {
  const k = String(s || 'Additive').toLowerCase();
  if (k.startsWith('multiplicativeadd')) return 'MultiplicativeAdditive';
  if (k.startsWith('multiplicative'))    return 'Multiplicative';
  return 'Additive';
}
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
function lifeManaBucket(statKey?: string, raw?: string): Section | undefined {
  const k = String(statKey || '').toLowerCase();
  const s = String(raw || '').toLowerCase();
  if (k === 'life' || k === 'hpmax') return 'Life';
  if (k === 'liferegen' || k === 'liferegeneration' || k === 'liferecovery' || k === 'healthregeneration' || k === 'hpregen') return 'Life';
  if (k === 'mana' || k === 'manamax' || k === 'manaregen') return 'Mana';
  if (/^life\b/i.test(s)) return 'Life';
  if (/^mana\b/i.test(s)) return 'Mana';
  return undefined;
}
function toDisplaySection(statKey?: string, raw?: string, rowType?: string): Section {
  const typeShort = String(rowType || '').replace('NodeAffixDefinition','');

  // 1) explicit type overrides from config
  const byType = (DISPLAY_OVERRIDES_BY_TYPE as any)?.[typeShort] as Section | undefined;
  if (byType) return byType;

  // 2) statKey direct overrides from config
  const direct = (DISPLAY_OVERRIDES as any)?.[statKey || ''] as Section | undefined;
  if (direct) return direct;

  // 3) Life/Mana detection
  const lm = lifeManaBucket(statKey, raw);
  if (lm) return lm;

  // 4) global section overrides (SPEED/DAMAGE/SURVIVAL)
  const secOverride = resolveSectionOverride({ statKey });
  if (secOverride === 'SPEED') return 'Speed';
  if (secOverride === 'DAMAGE') return 'Damage';
  if (secOverride === 'SURVIVAL') return 'Survival';

  // 5) heuristics
  const k = String(statKey || '').toLowerCase();
  const s = String(raw || '').toLowerCase();
  if (k.includes('summon') || s.includes('summon')) return 'Summons';
  if (k.includes('resist') || s.includes('reduction') || s.includes('resist')) return 'Resistances';
  if (k.includes('potion') || s.includes('potion') || k === 'evasion' || k === 'physicalresistance' || k === 'endurance') return 'Survival';
  if (k.includes('damage') || s.includes('damage') || k.includes('crit') || s.includes('crit') || k === 'magicdamage') return 'Damage';
  if (k.includes('speed') || s.includes('speed') || k.includes('haste') || s.includes('haste')) return 'Speed';
  return 'Skills';
}

/* ============================================================
   OVERRIDES matching (whitespace-insensitive, number-agnostic)
============================================================ */
const NUM_RE = /(?<!\w)(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?/g;
function normalizeForOverride(s: string): string {
  return normalizeMinus(s)
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')      // collapse all whitespace/newlines to single space
    .replace(NUM_RE, '#')      // replace numbers with # token
    .replace(/#+/g, '#')       // collapse "##" → "#"
    .trim();
}

// Build a normalized map once at module load
const OV_MAP: Map<string, string | string[]> = (() => {
  const any = overrides as Record<string, string | string[]>;
  const m = new Map<string, string | string[]>();
  for (const [k, v] of Object.entries(any || {})) {
    m.set(normalizeForOverride(k), v as any);
  }
  return m;
})();

/* ============================================================
   Single-pass token expander:  #  #i  #3  #3i
============================================================ */
function expandTemplateWithCaptures(tmpl: string, captures: string[]): string {
  let seq = 0; // for sequential (# / #i)
  const asInt = (s: string) => {
    const n = Number(String(s).replace(/,/g, ''));
    return Number.isFinite(n) ? String(Math.round(n)) : s;
  };

  // Matches either indexed (#3 / #3i) or sequential (# / #i)
  const TOKEN = /#(?:(\d+)(i)?)|#(i)?/g;

  return tmpl.replace(
    TOKEN,
    (_m, idxStr: string | undefined, idxHasI: string | undefined, seqHasI: string | undefined) => {
      if (idxStr) {
        const idx = parseInt(idxStr, 10) - 1;
        const v = captures[idx] ?? '';
        return idxHasI ? asInt(v) : v;
      } else {
        const v = captures[seq++] ?? '';
        return seqHasI ? asInt(v) : v;
      }
    }
  );
}

// affix-overrides → bullet points materializer (with multiline support)
function materializeOverride(raw: string): string[] {
  if (!raw) return [];
  const key = normalizeForOverride(raw);
  const ov = OV_MAP.get(key);
  if (!ov) return [];

  if (ov === '__HIDE__') return ['__HIDE__'];

  // Use the actual numbers from the raw line (in order)
  const captures = Array.from(String(raw).matchAll(NUM_RE)).map((m) => m[0]);
  const vals = Array.isArray(ov) ? (ov as string[]) : [String(ov)];

  const lines: string[] = [];
  for (const v of vals) {
    const filled = expandTemplateWithCaptures(v, captures);
    for (const piece of filled.split(/\r?\n/)) {
      const trimmed = piece.trim();
      if (trimmed) lines.push(trimmed);
    }
  }
  return lines;
}

// Should we hide this line entirely based on overrides/type?
function shouldHide(raw: string, statKey?: string, rowType?: string): boolean {
  // 1) Explicit Devotion increments are always hidden (The Three Marys)
  const t = String(rowType || '').replace('NodeAffixDefinition','');
  if (t === 'DevotionIncrement') return true;

  // 2) Stat keys that represent devotion/colors
  const k = String(statKey || '').toLowerCase();
  if (
    k === 'red' || k === 'green' || k === 'blue' ||
    k === 'furydevotion' || k === 'faithdevotion' || k === 'disciplinedevotion'
  ) return true;

  // 3) affix-overrides entries that map to __HIDE__ (using normalized key)
  if (OV_MAP.get(normalizeForOverride(raw)) === '__HIDE__') return true;

  return false;
}

// Normalize incoming rows to our Row shape
function normalizeRows(incoming: InputRow[] | undefined): Row[] {
  if (!Array.isArray(incoming)) return [];
  const out: Row[] = [];
  for (const r of incoming) {
    // try to materialize a readable line with numbers
    let line = '';
    try { line = materializeAffixLine(r) || ''; } catch { line = ''; }
    if (!line) line = String(r.raw || r.pattern || '');
    const nums = Array.isArray(r.rawNumbers)
      ? r.rawNumbers.map((n: any) => Number(n)).filter((n: any) => !Number.isNaN(n))
      : parseNumbersSafe(line);
    out.push({
      raw: line,
      type: r.type,
      statKey: r.statKey || r.eStatDefinition,
      statMath: r.statModifierType || r.eModifierType,
      nums,
    });
  }
  return out;
}

/* ============================================================
   Restructure Orb section to gather "Each Orb" bullets
   - Pulls "Grants +#% X per {Orb} Orb." → "• +#% X"
   - Gathers override bullets and normalizes an "Each Orb:" subsection
   - Keeps "Chance to Spawn:" cluster, "Max ... Orbs" and tail lines
============================================================ */
function restructureOrbSection(arr: string[] | undefined, kind: 'Agility' | 'Power'): string[] {
  if (!arr || !arr.length) return arr || [];

  const chanceHeaderRe = /^Chance to Spawn:\s*$/i;
  const eachHeaderRe   = /^Each Orb:\s*$/i;
  const maxRe          = new RegExp(`^Max ${kind} Orbs:\\s*(\\d+)\\s*$`, 'i');
  const perOrbRe       = new RegExp(`^Grants\\s+\\+?(\\d+(?:\\.\\d+)?)%\\s+(.+?)\\s+per\\s+${kind}\\s+Orb\\.?$`, 'i');

  const spawnBullets: string[] = [];
  const eachBullets: string[] = [];
  const others: string[] = [];

  let sawSpawnHeader = false;
  let sawEachHeader  = false;
  let maxLine: string | null = null;
  const tail: string[] = []; // things we want after Max, e.g., “Taking damage …”

  for (const line of arr) {
    const l = line.trim();
    if (!l) continue;

    if (chanceHeaderRe.test(l)) { sawSpawnHeader = true; continue; }
    if (eachHeaderRe.test(l))   { sawEachHeader  = true; continue; }

    // Convert “Grants +X% Something per {Orb} Orb.” → bullet
    const mPer = l.match(perOrbRe);
    if (mPer) {
      const pct = mPer[1]; const what = mPer[2];
      eachBullets.push(`• +${pct}% ${what}`);
      continue;
    }

    // Bullets
    if (/^•\s+/.test(l)) {
      if (/On\s+(Kill|Elite)/i.test(l)) spawnBullets.push(l);
      else eachBullets.push(l);
      continue;
    }

    // Capture Max line (already aggregated earlier)
    if (maxRe.test(l)) { maxLine = l; continue; }

    // Put “Taking damage removes … Orb” and similar tail info after Max
    if (/^Taking damage removes/i.test(l)) { tail.push(l); continue; }

    // Everything else we keep in “others” (preserve insertion)
    others.push(l);
  }

  // Dedup bullets, with a small priority for nicer order
  const dedup = (xs: string[]) => {
    const seen = new Set<string>();
    return xs.filter((s) => (seen.has(s) ? false : (seen.add(s), true)));
  };
  const prio = (s: string) => {
    if (/Move Speed/i.test(s)) return 10;
    if (/Attack Speed/i.test(s)) return 20;
    if (/Critical Damage/i.test(s)) return 30;
    return 99;
  };
  const spawn = dedup(spawnBullets);
  const each  = dedup(eachBullets).sort((a, b) => prio(a) - prio(b));

  // Compose in the desired order
  const out: string[] = [];
  if (spawn.length || sawSpawnHeader) {
    out.push('Chance to Spawn:');
    out.push(...spawn);
  }
  if (each.length || sawEachHeader) {
    out.push('Each Orb:');
    out.push(...each);
  }
  if (maxLine) out.push(maxLine);
  out.push(...tail);
  out.push(...others);

  return out;
}

// Allow "__SECTION__:Name|Text" directives in overrides
function parseSectionDirective(line: string): { section?: Section; text: string } {
  const m = String(line).match(
    /^__SECTION__:(Life|Mana|Speed|Damage|Resistances|Survival|Summons|Skills|Power Orb|Agility Orb|Orbs|Misc)\|(.*)$/
  );
  if (m) {
    const sec = m[1] as Section;
    const txt = m[2].trim();
    return { section: sec, text: txt };
  }
  return { text: line };
}

// Build totals like QA
function buildTotals(rows: Row[]) {
  type Acc = { section: Section; label: string; statKey: string; math: StatMath; sum?: number; prod?: number; plus?: number; };
  const groups = new Map<string, Acc>();
  const miscText: string[] = [];

  // Declare 'out' BEFORE any rerouting into out[sec]
  const out: Record<Section, string[]> = {
    Life: [], Mana: [], Speed: [], Damage: [], Resistances: [], Survival: [], Summons: [], Skills: [],
    'Power Orb': [], 'Agility Orb': [], Orbs: [], Misc: []
  };

  for (const r of rows) {
    // global hide rules
    if (shouldHide(r.raw, r.statKey, r.type)) { continue; }

    const typeKey = String(r.type || '').replace('NodeAffixDefinition','');

    // Always route these to Misc as full text (with overrides/section directives)
    if (r.statKey === 'BaseDamage' || typeKey === 'SkillBehavior' || typeKey === 'CharacterIncrement') {
      const longs = materializeOverride(r.raw);
      if (longs.length) {
        for (const ln of longs) {
          if (ln === '__HIDE__') continue;
          const { section: sec, text } = parseSectionDirective(ln);
          if (sec) out[sec].push(text);
          else miscText.push(ln);
        }
      } else {
        miscText.push(r.raw);
      }
      continue;
    }

    // rows without a statKey: try to materialize; otherwise treat as Misc
    if (!r.statKey) {
      const longs = materializeOverride(r.raw);
      if (longs.length) {
        for (const ln of longs) {
          if (ln === '__HIDE__') continue;
          const { section: sec, text } = parseSectionDirective(ln);
          if (sec) out[sec].push(text);
          else miscText.push(ln);
        }
      }
      continue;
    }

    const section = toDisplaySection(r.statKey, r.raw, r.type);

    let label = LABEL_OVERRIDES[r.statKey] ?? prettyLabelFromKey(r.statKey);
    if (section === 'Resistances') label = label.replace(/\s*Resistance$/i, '').replace(/\s*Resist$/i, '');
    if (section === 'Survival' && (r.statKey === 'BarrierGain' || r.statKey === 'BarrierDecayResilience')) {
      label = label.replace(/\bBarrier\b/g, 'Conviction');
    }

    const math = toMath(r.statMath);
    const key = `${section}|${label}|${r.statKey}|${math}`;
    const acc = groups.get(key) || { section, label, statKey: r.statKey, math, sum:0, prod:1, plus:0 };

    const v = r.nums.length ? r.nums[0] : 0;
    const rawHasPercent = /%/.test(normalizeMinus(r.raw));

    if (math === 'Multiplicative') {
      // percent-aware; preserves negatives like “−10%[x]” → factor 0.9
      const factor = rawHasPercent ? (1 + v/100) : (Math.abs(v) > 1.5 ? (1 + v/100) : v);
      acc.prod = (acc.prod ?? 1) * factor;
    } else if (math === 'MultiplicativeAdditive') {
      let plus = 0;
      if (rawHasPercent) plus = v;
      else if (Math.abs(v) > 1.5) plus = v;
      else if (v > 1) plus = (v - 1) * 100;
      else plus = v * 100;
      acc.plus = (acc.plus ?? 0) + plus;
    } else {
      const isFlat = FLAT_STATS.has(acc.statKey);
      if (isFlat) {
        acc.sum = (acc.sum ?? 0) + v;
      } else {
        acc.sum = (acc.sum ?? 0) + (rawHasPercent ? v : (Math.abs(v) <= 1.5 ? v * 100 : v));
      }
    }
    groups.set(key, acc);
  }

  function fmt(acc: Acc) {
    if (acc.math === 'Multiplicative') {
      const pct = ((acc.prod ?? 1) - 1) * 100;
      const sign = pct >= 0 ? '+' : '';
      return `${sign}${pct.toFixed(1)}%[x]`;
    }
    if (acc.math === 'MultiplicativeAdditive') {
      const plus = acc.plus ?? 0;
      const sign = plus >= 0 ? '+' : '';
      return `${sign}${plus.toFixed(1)}%[+]`;
    }
    const s = acc.sum ?? 0; const sign = s >= 0 ? '+' : '';
    return FLAT_STATS.has(acc.statKey) ? `${sign}${Math.round(s)}` : `${sign}${s.toFixed(1)}%`;
  }

  for (const acc of groups.values()) out[acc.section].push(`${acc.label}: ${fmt(acc)}`);

  /* ============================================================
     Aggregate orb caps (supports "set" and "increment" phrasings)
     MODE: 'sum' (stack) or 'max' (take highest)
  ============================================================ */
  const ORB_CAP_MODE: 'sum' | 'max' = 'sum';

  function aggregateOrbCaps(arr: string[] | undefined, label: 'Agility' | 'Power') {
    if (!arr || arr.length < 2) return;

    // Patterns to extract integers
    const setRe  = new RegExp(`^Max ${label} Orbs:\\s*(\\d+)\\s*$`, 'i');
    const incRe1 = new RegExp(`^Max ${label} Orbs\\s*\\+\\s*(\\d+)\\s*$`, 'i');
    const incRe2 = new RegExp(`^Increase(?:s)? Max ${label} Orbs by\\s*(\\d+)\\s*$`, 'i');

    const idxs: number[] = [];
    const vals: number[] = [];

    for (let i = 0; i < arr.length; i++) {
      const line = arr[i];
      const mSet  = line.match(setRe);
      const mInc1 = line.match(incRe1);
      const mInc2 = line.match(incRe2);

      if (mSet)  { idxs.push(i); vals.push(parseInt(mSet[1], 10)); continue; }
      if (mInc1) { idxs.push(i); vals.push(parseInt(mInc1[1], 10)); continue; }
      if (mInc2) { idxs.push(i); vals.push(parseInt(mInc2[1], 10)); continue; }
    }

    if (idxs.length <= 1) return;

    const total = ORB_CAP_MODE === 'sum'
      ? vals.reduce((a, b) => a + b, 0)
      : Math.max(...vals);

    const first = idxs[0];
    arr[first] = `Max ${label} Orbs: ${total}`;
    for (let j = idxs.length - 1; j >= 1; j--) {
      arr.splice(idxs[j], 1);
    }
  }

  aggregateOrbCaps(out['Agility Orb'], 'Agility');
  aggregateOrbCaps(out['Power Orb'],   'Power');

  // Pull together "Each Orb" bullets (& converts “Grants +#% X per …”)
  out['Agility Orb'] = restructureOrbSection(out['Agility Orb'], 'Agility');
  out['Power Orb']   = restructureOrbSection(out['Power Orb'], 'Power');

  // 🔽 Keep insertion order for Orb sections and Misc; sort others alphabetically
  const DONT_SORT: Section[] = ['Orbs','Power Orb','Agility Orb','Misc'];
  for (const k of ORDER) {
    if (!DONT_SORT.includes(k)) {
      out[k].sort((a,b)=>a.localeCompare(b));
    }
  }

  // Append misc at the end (already in desired order)
  for (const line of miscText) out.Misc.push(line);

  return out;
}

export default function MapStatSummary({
  title,
  rows: rowsProp,
  masteredGrant,
}: {
  title: string;
  rows?: InputRow[];
  masteredGrant?: { Red?: number; Green?: number; Blue?: number };
}) {
  // prefer prop; else global getter (so we don't depend on one specific name)
  const rowsInput: InputRow[] = React.useMemo(() => {
    if (Array.isArray(rowsProp) && rowsProp.length) return rowsProp;
    const w: any = window;
    const candidates = [
      w.__constellationRows,
      w.__mapRows,
      w.__affixRows,
      w.__getConstellationRows,
    ].filter((fn: any) => typeof fn === 'function');
    if (candidates.length) {
      try {
        const r = candidates[0]();
        if (Array.isArray(r)) return r;
      } catch {}
    }
    return [];
  }, [rowsProp]);

  const rows = React.useMemo(() => normalizeRows(rowsInput), [rowsInput]);
  const totals = React.useMemo(() => buildTotals(rows), [rows]);

  // fonts
  const cs = getComputedStyle(document.documentElement);
  const headingVar = cs.getPropertyValue('--ui-font-heading').trim();
  const bodyVar    = cs.getPropertyValue('--ui-font-body').trim();

  const heading =
    headingVar || '"Cinzel","Trajan Pro",Georgia,serif';
  const body =
    bodyVar || '"Cormorant Garamond","EB Garamond",Georgia,serif';

  const titleFor = (sec: Section) => (sec === 'Survival' ? 'DEFENSE' : sec.toUpperCase());

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 16,
        width: 380,
        zIndex: 5,
        pointerEvents: 'auto',
        background: 'rgba(10,12,20,0.85)',
        border: '1px solid rgba(120,140,180,0.35)',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid rgba(120,140,180,0.25)',
          fontFamily: heading,
          fontWeight: 900,
          fontSize: 18,
          color: '#f0d3b2',
          textAlign: 'center',
        }}
      >
        {title}
      </div>

      <div style={{ padding: 12, overflow: 'auto', flex: 1, fontFamily: body, color: '#dfe7ff' }}>
        {ORDER.every((sec) => (totals[sec] || []).length === 0) ? (
          <div style={{ opacity: 0.7, fontStyle: 'italic' }}>No active modifiers.</div>
        ) : (
          ORDER.map((sec) => {
            const items = totals[sec] || [];
            if (!items.length) return null;
            return (
              <div key={sec} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    margin: '8px 0 6px',
                    fontFamily: heading,
                    fontWeight: 800,
                    fontSize: 14,
                    letterSpacing: 0.4,
                    color: '#c8d6ff',
                    textTransform: 'uppercase',
                    opacity: 0.9,
                  }}
                >
                  {titleFor(sec)}
                </div>
                <div>
                  {items.map((line, i) => (
                    <div key={`${sec}-${i}`}>{line}</div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {masteredGrant && (masteredGrant.Red || masteredGrant.Green || masteredGrant.Blue) && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.06)',
            borderTop: '1px solid rgba(120,140,180,0.25)',
            fontFamily: heading,
            fontWeight: 700,
            fontSize: 14,
            color: '#e9e4d9',
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
          }}
        >
          {masteredGrant.Red ? <span style={{ color: '#ff6a6a' } }>Fury +{masteredGrant.Red}</span> : null}
          {masteredGrant.Green ? <span style={{ color: '#67ff9b' }}>Discipline +{masteredGrant.Green}</span> : null}
          {masteredGrant.Blue ? <span style={{ color: '#8ac7ff' }}>Faith +{masteredGrant.Blue}</span> : null}
        </div>
      )}
    </div>
  );
}
