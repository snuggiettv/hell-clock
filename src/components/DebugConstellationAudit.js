import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
// src/components/DebugConstellationAudit.tsx
import * as React from 'react';
import { FLAT_STATS, SECTION_OVERRIDES, LABEL_OVERRIDES, DISPLAY_OVERRIDES, DISPLAY_OVERRIDES_BY_TYPE, } from '../config/statDisplayRules';
export const QA_VERSION = 'QA-compact-v2-miscLong';
const DISPLAY_ORDER = ['Life', 'Mana', 'Speed', 'Damage', 'Resistances', 'Survival', 'Summons', 'Skills', 'Misc'];
/* utils */
function en(arr) {
    if (!arr)
        return '';
    const hit = arr.find(x => x.langCode === 'en') || arr[0];
    return hit ? hit.langTranslation : '';
}
function normalizeMinus(s) {
    return String(s || '')
        .replace(/[\u200B\u200C\u200D\u2060\u00A0\u202F\u2007\u2009]/g, '')
        .replace(/[\u2212\u2010-\u2015\u2043\uFF0D\uFE63\u207B\u208B\u2796]/g, '-');
}
function parseNumbers(s) {
    const hits = normalizeMinus(s).match(/[+-]?\d+(?:\.\d+)?/g);
    return hits ? hits.map(Number) : [];
}
function toMath(s) {
    const k = String(s || 'Additive').toLowerCase();
    if (k.startsWith('multiplicativeadd'))
        return 'MultiplicativeAdditive';
    if (k.startsWith('multiplicative'))
        return 'Multiplicative';
    return 'Additive';
}
function prettyLabelFromKey(k) {
    if (!k)
        return 'Unknown';
    return k
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^E /, '')
        .replace(/\bHp\b/i, 'HP')
        .replace(/\bHpMax\b/i, 'Max HP');
}
function keyFor(r) { return `${r.constellationId}|${r.nodeId}|${r.affixId}`; }
function isPseudoStatKey(k) {
    const t = String(k || '').toLowerCase();
    if (!t)
        return false;
    return t.includes('skillbehavior') || t.includes('characterincrement') || t.includes('nodeaffix') || t.includes('affixdefinition') || t === 'basedamage';
}
function lifeManaBucket(statKey, raw) {
    const k = String(statKey || '').toLowerCase();
    const s = String(raw || '').toLowerCase();
    if (k === 'life' || k === 'hpmax')
        return 'Life';
    if (k === 'liferegen' || k === 'liferegeneration' || k === 'liferecovery' || k === 'healthregeneration' || k === 'hpregen')
        return 'Life';
    if (k === 'mana' || k === 'manamax' || k === 'manaregen')
        return 'Mana';
    if (/^life\b/i.test(s))
        return 'Life';
    if (/^mana\b/i.test(s))
        return 'Mana';
    return undefined;
}
function toDisplaySection(statKey, secKey, raw, rowType) {
    const typeShort = String(rowType || '').replace('NodeAffixDefinition', '');
    const byType = DISPLAY_OVERRIDES_BY_TYPE[typeShort];
    if (byType)
        return byType;
    const direct = DISPLAY_OVERRIDES[statKey || ''];
    if (direct)
        return direct;
    const lm = lifeManaBucket(statKey, raw);
    if (lm)
        return lm;
    if (secKey === 'SPEED')
        return 'Speed';
    if (secKey === 'DAMAGE')
        return 'Damage';
    if (secKey === 'SURVIVAL')
        return 'Survival';
    const k = String(statKey || '').toLowerCase();
    const s = String(raw || '').toLowerCase();
    if (k.includes('summon') || s.includes('summon'))
        return 'Summons';
    if (k.includes('resist') || k.includes('reduction') || s.includes('resist'))
        return 'Resistances';
    if (k.includes('potion') || s.includes('potion'))
        return 'Survival';
    if (k === 'evasion' || k === 'physicalresistance' || k === 'endurance')
        return 'Survival';
    if (k.includes('damage') || s.includes('damage') || k.includes('crit') || s.includes('crit') || k === 'magicdamage')
        return 'Damage';
    if (k.includes('speed') || s.includes('speed') || k.includes('haste') || s.includes('haste'))
        return 'Speed';
    return 'Skills';
}
function numbersFromRow(r) {
    const nums = [...(r.nums || [])];
    if (!nums.length && r.raw) {
        const m = normalizeMinus(r.raw).match(/[+-]?\d+(?:\.\d+)?/);
        if (m)
            nums.push(Number(m[0]));
    }
    return nums;
}
function isLongTextMisc(r) {
    const typeKey = String(r.type || '').replace('NodeAffixDefinition', '');
    return isPseudoStatKey(r.statKey) || typeKey === 'SkillBehavior' || typeKey === 'CharacterIncrement' || r.statKey === 'BaseDamage';
}
/* storage */
const STORAGE_NS = 'qa-notes-v1';
function loadSaved(url) { try {
    const raw = localStorage.getItem(`${STORAGE_NS}::${url}`);
    return raw ? JSON.parse(raw) : null;
}
catch {
    return null;
} }
function saveState(url, state) { try {
    localStorage.setItem(`${STORAGE_NS}::${url}`, JSON.stringify(state));
}
catch { } }
/* aggregation */
function buildNodeSectionTotals(rows) {
    const groups = new Map();
    const miscText = new Set();
    for (const r of rows) {
        if (isLongTextMisc(r)) {
            if (r.raw?.trim())
                miscText.add(r.raw.trim());
            continue;
        }
        if (!r.statKey)
            continue;
        const secKey = SECTION_OVERRIDES[r.statKey] ?? undefined;
        const section = toDisplaySection(r.statKey, secKey, r.raw, r.type);
        let label = LABEL_OVERRIDES[r.statKey] ?? prettyLabelFromKey(r.statKey);
        if (section === 'Resistances')
            label = label.replace(/\s*Resistance$/i, '').replace(/\s*Resist$/i, '');
        if (section === 'Survival' && (r.statKey === 'BarrierGain' || r.statKey === 'BarrierDecayResilience')) {
            label = label.replace(/\bBarrier\b/g, 'Conviction');
        }
        const math = toMath(r.statMath);
        const key = `${section}|${label}|${r.statKey}|${math}`;
        const acc = groups.get(key) || { section, label, statKey: r.statKey, math, sum: 0, prod: 1, plus: 0 };
        const list = numbersFromRow(r);
        const v = list.length ? list[0] : null;
        const rawHasPercent = /%/.test(String(r.raw || ''));
        if (v != null) {
            if (math === 'Multiplicative') {
                const factor = rawHasPercent ? (1 + v / 100) : (Math.abs(v) > 1.5 ? (1 + v / 100) : v);
                acc.prod = (acc.prod ?? 1) * factor;
            }
            else if (math === 'MultiplicativeAdditive') {
                const plus = rawHasPercent ? v : (v > 1 ? (v - 1) * 100 : v * 100);
                acc.plus = (acc.plus ?? 0) + plus;
            }
            else {
                const isFlat = FLAT_STATS.has(r.statKey);
                if (isFlat)
                    acc.sum = (acc.sum ?? 0) + v;
                else
                    acc.sum = (acc.sum ?? 0) + (rawHasPercent ? v : (Math.abs(v) < 1 ? v * 100 : v));
            }
        }
        groups.set(key, acc);
    }
    const out = {
        Life: [], Mana: [], Speed: [], Damage: [], Resistances: [], Survival: [], Summons: [], Skills: [], Misc: []
    };
    function fmt(acc) {
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
        const s = acc.sum ?? 0;
        const sign = s >= 0 ? '+' : '';
        return FLAT_STATS.has(acc.statKey) ? `${sign}${Math.round(s)}` : `${sign}${s.toFixed(1)}%`;
    }
    for (const acc of groups.values())
        out[acc.section].push(`${acc.label}: ${fmt(acc)}`);
    for (const line of miscText)
        out.Misc.push(line);
    for (const k of DISPLAY_ORDER)
        out[k].sort((a, b) => a.localeCompare(b));
    return out;
}
/* component */
export default function DebugConstellationAudit() {
    const [url, setUrl] = React.useState(() => { const saved = loadSaved('__last__'); return saved?.url || '/Constellations.json'; });
    const [data, setData] = React.useState(null);
    const [rows, setRows] = React.useState([]);
    const [filter, setFilter] = React.useState(() => loadSaved(url)?.filter || '');
    const [statusFilter, setStatusFilter] = React.useState(() => loadSaved(url)?.statusFilter || 'all');
    const [notes, setNotes] = React.useState(() => loadSaved(url)?.notes || {});
    const [showHidden, setShowHidden] = React.useState(false);
    const [onlyShowNeeds, setOnlyShowNeeds] = React.useState(true);
    React.useEffect(() => { saveState('__last__', { url }); }, [url]);
    React.useEffect(() => {
        fetch(url, { cache: 'no-store' }).then(r => r.json()).then(setData).catch(() => setData(null));
    }, [url]);
    React.useEffect(() => {
        if (!data)
            return;
        const all = [];
        for (const det of data.constellationsDetails || []) {
            const def = det.definition;
            const cname = (def.nameKey?.find(k => k.langCode === 'en')?.langTranslation) || def.name || '';
            for (const node of def.nodes || []) {
                const nname = (node.nameLocalizationKey?.find(k => k.langCode === 'en')?.langTranslation) || node.name || '';
                for (const af of node.affixes || []) {
                    const raw = en(af.description);
                    const nums = parseNumbers(raw);
                    // strip pseudo stat keys here too to prevent accidental aggregation
                    const rawStat = af.eStatDefinition;
                    const statKey = isPseudoStatKey(rawStat) ? undefined : rawStat;
                    all.push({
                        constellationId: def.id,
                        constellation: cname,
                        nodeId: node.name,
                        node: nname,
                        affixId: af.name,
                        raw,
                        type: af.type,
                        statKey,
                        statMath: (af.statModifierType || af.eModifierType || ''),
                        nums,
                    });
                }
            }
        }
        setRows(all);
    }, [data]);
    React.useEffect(() => { saveState(url, { notes, filter, statusFilter }); }, [url, notes, filter, statusFilter]);
    const byNode = React.useMemo(() => {
        const m = new Map();
        for (const r of rows) {
            if (!showHidden && String(notes[keyFor(r)]?.note || '').includes('__HIDE__'))
                continue;
            const id = r.constellationId + '|' + r.nodeId;
            if (!m.has(id))
                m.set(id, { constellationId: r.constellationId, constellation: r.constellation, nodeId: r.nodeId, node: r.node, rows: [] });
            m.get(id).rows.push(r);
        }
        return Array.from(m.values());
    }, [rows, notes, showHidden]);
    const filteredNodes = React.useMemo(() => {
        const q = filter.trim().toLowerCase();
        function matches(r) {
            return !q || r.constellation.toLowerCase().includes(q) || r.node.toLowerCase().includes(q) ||
                r.raw.toLowerCase().includes(q) || (r.statKey || '').toLowerCase().includes(q) || (r.type || '').toLowerCase().includes(q);
        }
        function statusOK(r) {
            const st = notes[keyFor(r)]?.status || 'unknown';
            if (statusFilter === 'all')
                return true;
            return st === statusFilter;
        }
        return byNode.map(n => ({ ...n, rows: n.rows.filter(r => matches(r) && statusOK(r)) }))
            .filter(n => n.rows.length > 0);
    }, [byNode, filter, statusFilter, notes]);
    function setRowStatus(id, status) {
        setNotes(prev => ({ ...prev, [id]: { status, note: prev[id]?.note || '' } }));
    }
    function setRowNote(id, note) {
        setNotes(prev => ({ ...prev, [id]: { status: prev[id]?.status || 'unknown', note } }));
    }
    function markVisibleAsOK() {
        const upd = { ...notes };
        for (const node of filteredNodes) {
            for (const r of node.rows) {
                const id = keyFor(r);
                if (!upd[id])
                    upd[id] = { status: 'ok', note: '' };
                else
                    upd[id].status = 'ok';
            }
        }
        setNotes(upd);
    }
    /* CSV import/export (unchanged) */
    function exportCSV() {
        const headers = ['Constellation', 'Node', 'Node ID', 'Affix ID', 'Type', 'Stat Key', 'Stat Math', 'Raw', 'Status', 'Note'];
        const lines = [headers.join(',')];
        for (const r of rows) {
            const id = keyFor(r);
            const st = notes[id]?.status || 'unknown';
            const nt = (notes[id]?.note || '').replace(/"/g, '""');
            const cells = [
                r.constellation, r.node, r.nodeId, r.affixId, r.type, r.statKey || '', r.statMath || '', r.raw, st, nt
            ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`);
            lines.push(cells.join(','));
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const urlObj = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = 'constellation_qa_notes.csv';
        a.click();
        URL.revokeObjectURL(urlObj);
    }
    function normStatus(s) {
        const t = (s || '').toLowerCase().replace(/[^a-z]/g, '');
        if (t === 'ok')
            return 'ok';
        if (t === 'needsfix')
            return 'needsfix';
        return 'unknown';
    }
    function importCSV(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = String(reader.result || '');
                const lines = text.split(/\r?\n/).filter(Boolean);
                if (!lines.length)
                    return;
                const header = lines.shift();
                const cols = header.split(',').map(s => s.replace(/^"|"$/g, ''));
                const idx = (name) => cols.findIndex(c => c.trim().toLowerCase() === name.trim().toLowerCase());
                const iConst = idx('Constellation');
                const iNodeId = idx('Node ID');
                const iAff = idx('Affix ID');
                const iStatus = idx('Status');
                const iNote = idx('Note');
                const map = new Map();
                for (const r of rows)
                    map.set(`${r.constellation}|${r.nodeId}|${r.affixId}`, keyFor(r));
                const upd = { ...notes };
                for (const line of lines) {
                    const cells = line.match(/(?<=^|,)"(?:[^"]|"")*"(?=,|$)/g) || [];
                    const vals = cells.map(c => c.slice(1, -1).replace(/""/g, '"'));
                    const k = `${vals[iConst]}|${vals[iNodeId]}|${vals[iAff]}`;
                    const id = map.get(k);
                    if (id) {
                        const st = normStatus(vals[iStatus] || 'unknown');
                        const nt = vals[iNote] || '';
                        upd[id] = { status: st, note: nt };
                    }
                }
                setNotes(upd);
            }
            catch { }
        };
        reader.readAsText(file);
    }
    const fileInputRef = React.useRef(null);
    const bd = '#6b46c1', bg = '#0b0b0f', fgDim = '#cbd5e1';
    const borderFor = (st) => st === 'ok' ? '#22c55e' : st === 'needsfix' ? '#ef4444' : '#8885';
    return (_jsxs("div", { style: { padding: 16, color: 'white', background: '#0a0a0a', minHeight: 0 }, children: [_jsxs("h2", { style: { fontSize: 20, fontWeight: 700, marginBottom: 8 }, children: ["Constellation QA (Compact) ", _jsxs("span", { style: { fontSize: 12, opacity: 0.6 }, children: ["(", QA_VERSION, ")"] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx("label", { style: { fontSize: 13, opacity: 0.85 }, children: "JSON URL:" }), _jsx("input", { value: url, onChange: e => setUrl(e.target.value), style: { background: bg, border: `1px solid ${bd}`, color: 'white', padding: '6px 8px', width: 520, borderRadius: 6 } }), _jsx("input", { placeholder: "Filter (constellation / node / text / stat key / type)", value: filter, onChange: e => setFilter(e.target.value), style: { background: bg, border: `1px solid ${bd}`, color: 'white', padding: '6px 8px', flex: 1, minWidth: 260, borderRadius: 6 } }), _jsxs("select", { value: statusFilter, onChange: e => setStatusFilter(e.target.value), style: { background: bg, border: `1px solid ${bd}`, color: 'white', padding: '6px 8px', borderRadius: 6 }, children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "unknown", children: "Untouched" }), _jsx("option", { value: "ok", children: "OK" }), _jsx("option", { value: "needsfix", children: "Needs Fix" })] }), _jsxs("label", { style: { fontSize: 12 }, children: [_jsx("input", { type: "checkbox", checked: onlyShowNeeds, onChange: e => setOnlyShowNeeds(e.target.checked) }), " Only show Needs Fix / Untouched"] }), _jsxs("label", { style: { fontSize: 12 }, children: [_jsx("input", { type: "checkbox", checked: showHidden, onChange: e => setShowHidden(e.target.checked) }), " Show hidden"] }), _jsx("button", { onClick: markVisibleAsOK, style: { background: '#134e4a', border: '1px solid #10b981', color: 'white', padding: '6px 10px', borderRadius: 6 }, children: "Mark Visible as OK" }), _jsx("button", { onClick: exportCSV, style: { background: '#111827', border: '1px solid #6b46c1', color: 'white', padding: '6px 10px', borderRadius: 6 }, children: "Export CSV" }), _jsx("button", { onClick: () => fileInputRef.current?.click(), style: { background: '#0f172a', border: '1px solid #71717a', color: 'white', padding: '6px 10px', borderRadius: 6 }, children: "Import CSV" }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".csv,text/csv", style: { display: 'none' }, onChange: (e) => { const f = e.target.files?.[0]; if (f)
                            importCSV(f); e.currentTarget.value = ''; } })] }), _jsxs("div", { style: { fontSize: 12, color: fgDim, marginTop: 6, marginBottom: 12 }, children: ["Nodes shown: ", filteredNodes.length, " \u2014 your notes and statuses are auto-saved per URL."] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: '1fr', gap: 14 }, children: filteredNodes.map(node => {
                    const totals = buildNodeSectionTotals(node.rows);
                    const listRows = node.rows.filter(r => {
                        const st = notes[keyFor(r)]?.status || 'unknown';
                        return onlyShowNeeds ? (st === 'needsfix' || st === 'unknown') : true;
                    });
                    return (_jsxs("div", { style: { border: '1px solid #2f2a3e', borderRadius: 12, padding: 12, background: '#0c0f14' }, children: [_jsxs("div", { style: { fontSize: 12, color: '#94a3b8', marginBottom: 8 }, children: [node.constellation, " \u2022 ", node.node, " \u2022 ", _jsx("code", { children: node.nodeId })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, color: fgDim, marginBottom: 4 }, children: "Totals (aggregated):" }), DISPLAY_ORDER.map(sec => (totals[sec]?.length ? (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("div", { style: { fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }, children: sec.toUpperCase() }), _jsx("ul", { style: { margin: 0, paddingLeft: 18 }, children: totals[sec].map((line, i) => _jsx("li", { children: line }, i)) })] }, sec)) : null))] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, color: fgDim, marginBottom: 6 }, children: "Rows to review:" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr', gap: 10 }, children: [listRows.map((r, idx) => {
                                                        const id = keyFor(r);
                                                        const st = notes[id]?.status || 'unknown';
                                                        return (_jsxs("div", { style: { border: `1px solid ${st === 'ok' ? '#22c55e' : st === 'needsfix' ? '#ef4444' : '#8885'}`,
                                                                borderRadius: 10, padding: 10, background: '#0c1016' }, children: [_jsxs("div", { style: { fontSize: 12, color: '#94a3b8' }, children: ["Affix ", _jsx("code", { children: r.affixId }), " \u2022 ", _jsx("b", { children: r.type.replace('NodeAffixDefinition', '') }), r.statKey ? _jsxs(_Fragment, { children: [" \u2022 Stat: ", _jsx("b", { children: r.statKey })] }) : null] }), _jsx("div", { style: { fontWeight: 600, marginTop: 4, whiteSpace: 'pre-wrap' }, children: r.raw }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }, children: [_jsx("label", { style: { fontSize: 12, color: fgDim }, children: "Status:" }), _jsxs("label", { style: { fontSize: 12 }, children: [_jsx("input", { type: "radio", name: `st-${id}`, checked: st === 'unknown', onChange: () => setRowStatus(id, 'unknown') }), " Untouched"] }), _jsxs("label", { style: { fontSize: 12 }, children: [_jsx("input", { type: "radio", name: `st-${id}`, checked: st === 'ok', onChange: () => setRowStatus(id, 'ok') }), " OK"] }), _jsxs("label", { style: { fontSize: 12 }, children: [_jsx("input", { type: "radio", name: `st-${id}`, checked: st === 'needsfix', onChange: () => setRowStatus(id, 'needsfix') }), " Needs Fix"] }), _jsx("input", { placeholder: "note\u2026", value: notes[id]?.note || '', onChange: e => setRowNote(id, e.target.value), style: { background: '#0b0b0f', border: `1px solid ${bd}`, color: 'white', padding: '6px 8px', flex: 1, minWidth: 200, borderRadius: 6 } })] })] }, idx));
                                                    }), !listRows.length && _jsx("div", { style: { opacity: 0.7, fontSize: 12 }, children: "No rows to review in this node." })] })] })] })] }, node.constellationId + '|' + node.nodeId));
                }) })] }));
}
