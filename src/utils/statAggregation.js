// src/utils/statAggregation.ts
// Replace ALL prior stat/affix total logic with this.
/** Treat multiplicatives as factors → convert to delta (1.2 → 0.2). Everything else is raw. */
function normalizeValue(v, statModifierType) {
    const mt = (statModifierType || '').toLowerCase();
    const isMult = mt.includes('multiplicative');
    if (!Number.isFinite(v))
        return 0;
    if (isMult && v > 1)
        return v - 1; // factor -> delta
    return v;
}
/** If key is a devotion color, return the bucket name; otherwise null. */
function devotionBucket(statKey) {
    if (!statKey)
        return null;
    if (/^Devotion_(Red|Green|Blue)$/i.test(statKey)) {
        return statKey.split('_')[1];
    }
    if (/^(Red|Green|Blue)$/i.test(statKey)) {
        return statKey;
    }
    return null;
}
/**
 * Aggregate totals directly from react-flow nodes.
 * - Binary activation
 * - Multiplicatives normalized to deltas
 * - Devotion counted separately (still left in byStat under its statKey)
 */
export function aggregateFromNodes(nodes) {
    const byStat = Object.create(null);
    const devotion = { Red: 0, Green: 0, Blue: 0 };
    const contributingNodes = {};
    for (const n of nodes) {
        if (!n?.data?.isActivated)
            continue;
        const affixes = n.data.affixes ?? [];
        if (!affixes.length)
            continue;
        let nodeSum = 0;
        const nodeRows = [];
        for (const a of affixes) {
            // DevotionIncrementNodeAffixDefinition: count as +1 unless value is specified
            if (a.type === 'DevotionIncrementNodeAffixDefinition') {
                const bucket = a.eDevotionCategory;
                const inc = Number(a.valuePerLevel ?? a.value ?? 1);
                if (bucket && (bucket === 'Red' || bucket === 'Green' || bucket === 'Blue')) {
                    devotion[bucket] += inc;
                    byStat[`Devotion_${bucket}`] = (byStat[`Devotion_${bucket}`] || 0) + inc;
                }
                nodeSum += inc;
                nodeRows.push(a);
                continue;
            }
            // Regular stat modifiers
            if (a.type === 'StatModifierNodeAffixDefinition') {
                const statKey = a.eStatDefinition || a.eCharacterIncrement || 'Unknown';
                const base = Number(a.value ?? 0);
                const per = Number(a.valuePerLevel ?? 0); // usually 0 for constellations
                const vNorm = normalizeValue(base + per * 0, a.statModifierType); // binary activation → per*0
                const signed = (a.isNegative ? -1 : 1) * vNorm;
                byStat[statKey] = (byStat[statKey] || 0) + signed;
                const devo = devotionBucket(statKey);
                if (devo)
                    devotion[devo] += signed;
                nodeSum += signed;
                nodeRows.push(a);
                continue;
            }
            // SkillBehaviorNodeAffixDefinition → not numeric (skip)
        }
        if (nodeRows.length) {
            contributingNodes[n.id] = { value: nodeSum, rows: nodeRows };
        }
    }
    return { byStat, devotion, details: { contributingNodes } };
}
