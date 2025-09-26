import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatStatName } from '../utils/formatStatName';
import { formatStatDisplay } from '../utils/formatStatDisplay';
import { calculateCumulativeValue } from '../utils/calculateCumulativeValue';
function categorizeStatKey(statKey) {
    const s = (statKey || '').toLowerCase();
    if (/life|health|max[_\s]?life|life[_\s]?regen/.test(s))
        return 'Life';
    if (/mana|max[_\s]?mana|mana[_\s]?regen/.test(s))
        return 'Mana';
    if (/attack[_\s]?speed|cast[_\s]?speed|movement[_\s]?speed|cooldown|cdr/.test(s))
        return 'Speed';
    if (/crit|damage|pen(etration)?|over[_\s]?time|dot/.test(s))
        return 'Damage';
    if (/resist|all[_\s]?res|(fire|cold|lightning|poison|shadow|holy|arcane).*res/.test(s))
        return 'Resistances';
    return 'Skills';
}
const SECTION_ORDER = ['Life', 'Mana', 'Speed', 'Damage', 'Resistances', 'Skills'];
const StatSummary = ({ statTotals, nodes = [], totalRanks = 0 }) => {
    const lines = Object.entries(statTotals).map(([statKey, entry]) => {
        const isPercent = !!entry.isPercent;
        let modifierForDisplay = entry.modifierType || 'Additive';
        // Prefer provided nodeData (if any). Otherwise, derive from nodes by matching affixes.
        const contributors = Array.isArray(entry.nodeData) && entry.nodeData.length > 0
            ? entry.nodeData
                .map((d) => nodes.find((n) => n.id === d.nodeId))
                .filter(Boolean)
            : nodes.filter((n) => Array.isArray(n?.data?.affixes) &&
                n.data.affixes.some((a) => a?.eStatDefinition === statKey || a?.eCharacterIncrement === statKey));
        const computedTotal = contributors.reduce((sum, node) => {
            const rank = Number(node?.data?.rank ?? 0);
            if (rank <= 0)
                return sum;
            const affixes = Array.isArray(node?.data?.affixes) ? node.data.affixes : [];
            const matches = affixes.filter((a) => a?.eStatDefinition === statKey || a?.eCharacterIncrement === statKey);
            if (matches.length === 0)
                return sum;
            const nodeSum = matches.reduce((inner, affix) => {
                const value = Number(affix?.value ?? 0);
                const valuePerLevel = Number(affix?.valuePerLevel ?? 0);
                if (valuePerLevel !== 0)
                    return inner; // skip special per-level definitions
                const rawMt = String(affix?.statModifierType || '');
                const mt = /multiplicative/i.test(rawMt) ? 'Multiplicative' : 'Additive';
                modifierForDisplay = mt;
                return (inner +
                    calculateCumulativeValue({
                        rank,
                        value,
                        valuePerLevel,
                        modifierType: mt,
                    }));
            }, 0);
            return sum + nodeSum;
        }, 0);
        const displayTotal = typeof entry?.value === 'number' ? entry.value : computedTotal;
        const name = formatStatName(statKey);
        const text = `${name}: ${formatStatDisplay(displayTotal, isPercent, modifierForDisplay)}`;
        return { text, section: categorizeStatKey(statKey), sortKey: name.toLowerCase() };
    });
    const bySection = new Map();
    for (const sec of SECTION_ORDER)
        bySection.set(sec, []);
    for (const l of lines)
        bySection.get(l.section).push(l);
    for (const sec of SECTION_ORDER) {
        bySection.set(sec, (bySection.get(sec) || []).sort((a, b) => a.sortKey.localeCompare(b.sortKey)));
    }
    return (_jsxs("div", { style: {
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
        }, children: [_jsx("div", { style: { fontWeight: 'bold', fontSize: 22, marginBottom: 6 }, children: "Stat Summary" }), _jsxs("div", { style: { marginBottom: 8, color: '#ccc' }, children: ["Total Points Spent: ", _jsx("b", { children: (totalRanks && totalRanks > 0) ? totalRanks : (Array.isArray(nodes) ? nodes.reduce((s, n) => s + Number(n?.data?.rank ?? 0), 0) : 0) })] }), SECTION_ORDER.map((sec) => {
                const items = bySection.get(sec) || [];
                if (!items.length)
                    return null;
                return (_jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("div", { style: { color: '#b389ff', fontWeight: 700, textTransform: 'uppercase', fontSize: 12, margin: '8px 0 4px' }, children: sec }), items.map((it, i) => (_jsx("div", { children: it.text }, `${sec}-${i}`)))] }, sec));
            })] }));
};
export default StatSummary;
