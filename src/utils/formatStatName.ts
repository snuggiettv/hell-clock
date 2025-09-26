// * src/utils/formatStatName.ts * //

export const formatStatName = (key: string): string => {
  const customMap: Record<string, string> = {
    MagicResistance: 'Magic Resistance',
    PhysicalResistance: 'Physical Resistance',
    PlagueResistance: 'Plague Resistance',
    MovementSpeed: 'Movement Speed',
    GoldGain: 'Gold Gain',
    SoulStoneGain: 'Soul Stone Gain',
    BaseLife: 'Base Life',
    BaseMana: 'Base Mana',
    BaseDamage: 'Base Damage',
    PotionHealingAmount: 'Potion Healing Amount',
    PotionAmount: 'Potion Amount',
    MaximumSkillLevelIncrementAmount: 'Max Skill Level',
    RelicInventoryTierIncrementNodeAffixDefinition: 'Max Relic Inventory'
  };

  if (customMap[key]) return customMap[key];

  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2') // insert space before capital letters
    .replace(/^./, (s) => s.toUpperCase()); // capitalize first letter
};
