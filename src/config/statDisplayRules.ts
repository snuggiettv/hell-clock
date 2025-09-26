// src/config/statDisplayRules.ts
export type StatMath = 'Additive' | 'Multiplicative' | 'MultiplicativeAdditive';

/** Logical buckets used by rule engine (not UI columns) */
export type SectionKey = 'ORBS' | 'SPEED' | 'DAMAGE' | 'SURVIVAL' | 'ECONOMY' | 'MISC';

/** UI columns shown in QA / Stat Summary */
export type DisplaySection =
  | 'Life' | 'Mana' | 'Speed' | 'Damage' | 'Resistances' | 'Survival' | 'Summons' | 'Skills' | 'Misc';

// 1) Stats that should be flat (no %)
export const FLAT_STATS = new Set<string>([
  'Life', 'Mana', 'Barrier',
  'HpMax', 'ManaMax', 'BarrierMax',
  'PotionCapacity',
]);

// 2) (Rare) force math per affix id
export const MATH_OVERRIDES_BY_AFFIX: Record<string, StatMath> = {
  // 'AFFIX_ID_HERE': 'MultiplicativeAdditive',
};

// 3) Global section (logical) overrides by stat key
export const SECTION_OVERRIDES: Record<string, SectionKey> = {
  // Survival-ish
  Evasion: 'SURVIVAL',
  PhysicalResistance: 'SURVIVAL',
  PotionCapacity: 'SURVIVAL',
  Endurance: 'SURVIVAL',
  BarrierGain: 'SURVIVAL',
  BarrierDecayResilience: 'SURVIVAL',
  BaseDamage: 'DAMAGE',
};

// 4) Per-AFFIX section overrides (highest priority)
export const SECTION_OVERRIDES_BY_AFFIX: Record<string, SectionKey> = {
  // 'affix-id-here': 'SPEED',
};

// 5) Per-NODE section overrides (next priority)
//  - 'constellationId|nodeId|statKey'
//  - 'nodeId|statKey'
//  - 'constellationId|nodeId'   (applies to ALL stats in that node)
export const SECTION_OVERRIDES_BY_NODE: Record<string, SectionKey> = {
  // '52535f87-1acf-4e33-86e8-49b66b17dd7|Urgent Cause|AttackSpeed': 'SPEED',
};

// 6) Label overrides (rename in totals/QA output)
export const LABEL_OVERRIDES: Record<string, string> = {
  PhysicalDamage: 'Physical',
  PlagueDamage: 'Plague',
  FireDamage: 'Fire',
  LightningDamage: 'Lightning',
  MagicDamage: 'Elemental',                // Magic → Elemental

  CriticalChance: 'Critical Chance',
  AttackSpeed: 'Attack Speed',
  MoveSpeed: 'Move Speed',

  // Barrier → Conviction
  BarrierGain: 'Conviction Gain',
  BarrierDecayResilience: 'Conviction Decay Resilience',
  
  BleedDamage: 'Bleed',
  CriticalDamage: 'Critical',
  FireResistance: 'Fire',
  IgniteDamage: 'Ignite',
  LightningResistance: 'Lightning',
  MagicResistance: 'Magic',
  PhysicalResistance: 'Physical',
  PlagueResistance: 'Plague',
  SkillMeleeDamage: 'SkillMelee',
  SkillSpellDamage: 'SkillSpell',
};

/** 7) Force a statKey directly to a UI column */
export const DISPLAY_OVERRIDES: Record<string, DisplaySection> = {
  // Skills / behavior
  CooldownSpeed: 'Skills',

  BaseDamage: 'Misc',

  // Summons
  SummonLifePercentage: 'Summons',
  SummonDamagePercentage: 'Summons',

  // Survival
  Endurance: 'Survival',
  Evasion: 'Survival',
  PhysicalResistance: 'Survival',
  PotionCapacity: 'Survival',
  BarrierGain: 'Survival',
  BarrierDecayResilience: 'Survival',
  LifeRegen: 'Life',
  MagicResistance: 'Resistances',
  ManaRegen: 'Mana',
};

/** 8) Force an entire affix TYPE to a UI column */
export const DISPLAY_OVERRIDES_BY_TYPE: Record<string, DisplaySection> = {
  CharacterIncrement: 'Misc',
  SkillBehavior: 'Skills',
  // SkillEquip: 'Misc',
  // SkillUnlock: 'Skills',

};

// Helper: resolve a logical SectionKey override
export function resolveSectionOverride(arg: {
  statKey?: string;
  affixId?: string;
  constellationId?: string;
  nodeId?: string;
}): SectionKey | undefined {
  const { statKey, affixId, constellationId, nodeId } = arg || ({} as any);

  // 1) Affix-level
  if (affixId && SECTION_OVERRIDES_BY_AFFIX[affixId]) {
    return SECTION_OVERRIDES_BY_AFFIX[affixId];
  }

  // 2) Node-level (most specific first)
  const composite: string[] = [];
  if (constellationId && nodeId && statKey) composite.push(`${constellationId}|${nodeId}|${statKey}`);
  if (nodeId && statKey) composite.push(`${nodeId}|${statKey}`);
  if (constellationId && nodeId) composite.push(`${constellationId}|${nodeId}`);

  for (const k of composite) {
    if (SECTION_OVERRIDES_BY_NODE[k]) return SECTION_OVERRIDES_BY_NODE[k];
  }

  // 3) Global by stat key
  if (statKey && SECTION_OVERRIDES[statKey]) return SECTION_OVERRIDES[statKey];

  // 4) No override → let auto-categorizer decide
  return undefined;
}
