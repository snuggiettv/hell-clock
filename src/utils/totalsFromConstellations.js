import { extractConstellationAffixes } from "../utils/extractConstellationAffixes";
export function totalsFromConstellations(raw, activeNodeIds) {
    const rows = extractConstellationAffixes(raw);
    const byStat = {};
    const devotion = { Red: 0, Green: 0, Blue: 0 };
    for (const r of rows) {
        if (!activeNodeIds.has(r.nodeId))
            continue;
        const v = Number(r.value ?? 0);
        const isMult = String(r.statModifierType || '').toLowerCase().includes('multiplicative');
        const norm = isMult && v > 1 ? v - 1 : v;
        byStat[r.statKey] = (byStat[r.statKey] || 0) + norm;
        if (/^Devotion_(Red|Green|Blue)$/.test(r.statKey)) {
            const col = r.statKey.split('_')[1];
            devotion[col] += norm;
        }
    }
    return { byStat, devotion };
}
