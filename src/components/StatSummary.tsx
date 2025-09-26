/* /src/components/StatSummary.tsx */

import React from 'react';
import type { Node } from 'reactflow';
import { formatStatName } from '../utils/formatStatName';
import { formatStatDisplay } from '../utils/formatStatDisplay';
import { calculateCumulativeValue } from '../utils/calculateCumulativeValue';

interface NodeContribution {
  nodeId: string;
  rank: number;
  contribution: number;
}

interface TotalsEntry {
  value: number;
  isNegative: boolean;
  isPercent?: boolean;
  modifierType?: 'Additive' | 'Multiplicative';
  nodeData?: NodeContribution[];
}

interface StatSummaryProps {
  statTotals: Record<string, TotalsEntry>;
  nodes?: Node[];
  totalRanks?: number;
}

// -------- categorization for published view --------
type Section = 'Life' | 'Mana' | 'Speed' | 'Damage' | 'Resistances' | 'Skills';

function categorizeStatKey(statKey: string): Section {
  const s = (statKey || '').toLowerCase();

  if (/life|health|max[_\s]?life|life[_\s]?regen/.test(s)) return 'Life';
  if (/mana|max[_\s]?mana|mana[_\s]?regen/.test(s)) return 'Mana';

  if (/attack[_\s]?speed|cast[_\s]?speed|movement[_\s]?speed|cooldown|cdr/.test(s)) return 'Speed';

  if (/crit|damage|pen(etration)?|over[_\s]?time|dot/.test(s)) return 'Damage';

  if (/resist|all[_\s]?res|(fire|cold|lightning|poison|shadow|holy|arcane).*res/.test(s)) return 'Resistances';

  return 'Skills';
}
const SECTION_ORDER: Section[] = ['Life', 'Mana', 'Speed', 'Damage', 'Resistances', 'Skills'];

const StatSummary: React.FC<StatSummaryProps> = ({ statTotals, nodes = [], totalRanks = 0 }) => {
  // Build display lines for each stat, then bucket by section
  type Line = { text: string; section: Section; sortKey: string };

  const lines: Line[] = Object.entries(statTotals).map(([statKey, entry]) => {
    const isPercent = !!entry.isPercent;
    let modifierForDisplay: 'Additive' | 'Multiplicative' = entry.modifierType || 'Additive';

    // Prefer provided nodeData (if any). Otherwise, derive from nodes by matching affixes.
    const contributors: Node[] =
      Array.isArray(entry.nodeData) && entry.nodeData.length > 0
        ? (entry.nodeData
            .map((d) => nodes.find((n) => n.id === d.nodeId))
            .filter(Boolean) as Node[])
        : nodes.filter((n) =>
            Array.isArray(n?.data?.affixes) &&
            n.data.affixes.some(
              (a: any) => a?.eStatDefinition === statKey || a?.eCharacterIncrement === statKey
            )
          );

    const computedTotal = contributors.reduce((sum, node) => {
      const rank: number = Number(node?.data?.rank ?? 0);
      if (rank <= 0) return sum;

      const affixes: any[] = Array.isArray(node?.data?.affixes) ? node.data.affixes : [];
      const matches = affixes.filter(
        (a) => a?.eStatDefinition === statKey || a?.eCharacterIncrement === statKey
      );
      if (matches.length === 0) return sum;

      const nodeSum = matches.reduce((inner, affix) => {
        const value = Number(affix?.value ?? 0);
        const valuePerLevel = Number(affix?.valuePerLevel ?? 0);
        if (valuePerLevel !== 0) return inner; // skip special per-level definitions
        const rawMt = String(affix?.statModifierType || '');
        const mt: 'Additive' | 'Multiplicative' = /multiplicative/i.test(rawMt) ? 'Multiplicative' : 'Additive';
        modifierForDisplay = mt;
        return (
          inner +
          calculateCumulativeValue({
            rank,
            value,
            valuePerLevel,
            modifierType: mt,
          })
        );
      }, 0);

      return sum + nodeSum;
    }, 0);

    const displayTotal = typeof (entry as any)?.value === 'number' ? (entry as any).value : computedTotal;

    const name = formatStatName(statKey);
    const text = `${name}: ${formatStatDisplay(displayTotal, isPercent, modifierForDisplay)}`;
    return { text, section: categorizeStatKey(statKey), sortKey: name.toLowerCase() };
  });

  const bySection = new Map<Section, Line[]>();
  for (const sec of SECTION_ORDER) bySection.set(sec, []);
  for (const l of lines) bySection.get(l.section)!.push(l);
  for (const sec of SECTION_ORDER) {
    bySection.set(sec, (bySection.get(sec) || []).sort((a, b) => a.sortKey.localeCompare(b.sortKey)));
  }

  return (
    <div
      style={{
        backgroundColor: '#000',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: 8,
        zIndex: 10,
        fontSize: 14,
        border: '2px solid #800080',
        boxShadow: '0 0 10px #800080',
        minWidth: 240,
        lineHeight: 1.6,
        fontFamily: 'monospace',
        maxHeight: 460,
        overflow: 'auto',
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: 22, marginBottom: 6 }}>
        Stat Summary
      </div>

      <div style={{ marginBottom: 8, color: '#ccc' }}>
        Total Points Spent: <b>{(totalRanks && totalRanks > 0) ? totalRanks : (Array.isArray(nodes) ? nodes.reduce((s: number, n: any) => s + Number(n?.data?.rank ?? 0), 0) : 0)}</b>
      </div>

      {SECTION_ORDER.map((sec) => {
        const items = bySection.get(sec) || [];
        if (!items.length) return null;
        return (
          <div key={sec} style={{ marginBottom: 10 }}>
            <div style={{ color: '#b389ff', fontWeight: 700, textTransform: 'uppercase', fontSize: 12, margin: '8px 0 4px' }}>
              {sec}
            </div>
            {items.map((it, i) => (
              <div key={`${sec}-${i}`}>{it.text}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default StatSummary;
