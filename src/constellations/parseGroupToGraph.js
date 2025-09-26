const asNum = (v, def = 0) => (Number.isFinite(+v) ? +v : def);
const norm = (s) => String(s ?? '').trim();
const normKey = (s) => norm(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
/** Prefer the last ConstellationDetails block for size/position. */
function pickDetails(group) {
    const arr = Array.isArray(group) ? group : Array.isArray(group?.constellationsDetails) ? group.constellationsDetails : [];
    const details = arr.filter((x) => x?.type === 'ConstellationDetails');
    if (details.length) {
        const d = details[details.length - 1];
        const w = asNum(d?.width, 500);
        const h = asNum(d?.height, 500);
        const posArr = Array.isArray(d?.position) ? d.position : [asNum(d?.position?.[0]), asNum(d?.position?.[1])];
        const x = asNum(posArr?.[0], 0);
        const y = asNum(posArr?.[1], 0);
        return { width: w, height: h, position: [x, y] };
    }
    // Fallbacks
    const w = asNum(group?.width, 500);
    const h = asNum(group?.height, 500);
    const x = asNum(group?.position?.[0], 0);
    const y = asNum(group?.position?.[1], 0);
    return { width: w, height: h, position: [x, y] };
}
function englishNameFromLoc(locArr, fallback) {
    if (!Array.isArray(locArr))
        return fallback ?? '';
    const en = locArr.find((k) => /^en($|-)/i.test(String(k?.langCode || '')));
    return norm(en?.langTranslation ?? fallback ?? '');
}
function toUrl(base, path) {
    if (!path)
        return undefined;
    if (/^https?:\/\//i.test(path))
        return path;
    return base ? `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}` : path;
}
export function parseGroupToGraph(input) {
    const { id, artBase, group } = input;
    const def = group?.definition ?? {};
    // ---- size / placement (top-left in full-map space) ----
    const { width, height, position } = pickDetails(group);
    const center = { x: position[0] + width / 2, y: position[1] + height / 2 };
    // ---- nodes source ----
    const rawNodes = Array.isArray(def?.nodes) ? def.nodes :
        Array.isArray(group?.nodes) ? group.nodes :
            [];
    // ---- name map for edge resolution (raw id + english label variants) ----
    const nameToId = new Map();
    for (const rn of rawNodes) {
        const rawId = rn?.name ?? rn?.id;
        const idStr = String(rawId);
        const enLabel = englishNameFromLoc(rn?.nameLocalizationKey, rn?.name);
        const add = (k) => {
            const key = norm(k);
            if (!key)
                return;
            const nk = normKey(key);
            if (!nameToId.has(key))
                nameToId.set(key, idStr);
            if (!nameToId.has(nk))
                nameToId.set(nk, idStr);
        };
        add(idStr);
        add(rawId);
        add(enLabel);
        add(`${enLabel} node`); // tolerate “Foo Node” forms
    }
    // ---- art urls ----
    const blurUrl = toUrl(artBase, def?.illustrationBlurredLine);
    const lineUrl = toUrl(artBase, def?.illustrationLine);
    // ---- build nodes (keep center-origin positions) ----
    let nodes = rawNodes.map((n) => {
        const pos = Array.isArray(n.Position)
            ? { x: asNum(n.Position[0]), y: asNum(n.Position[1]) }
            : { x: asNum(n.Position?.x), y: asNum(n.Position?.y) };
        const label = englishNameFromLoc(n?.nameLocalizationKey, n?.name || n?.id) ||
            String(n?.name || n?.id);
        const sprite = typeof n?.sprite === 'string' ? n.sprite : undefined;
        const affixes = Array.isArray(n?.affixes) ? n.affixes : [];
        return {
            id: String(n?.name || n?.id),
            type: 'constellation',
            position: pos, // center-origin
            data: {
                label,
                name: label,
                isRoot: !!n?.isRoot, // will be augmented by indegree inference below
                sprite,
                affixes,
                maxLevel: Number.isFinite(+n?.maxLevel) ? +n.maxLevel : 1,
                rank: 0,
            },
        };
    });
    // ---- edges: from each node's edges[] (requiredNode.name | source | from) ----
    const edges = [];
    for (const node of rawNodes) {
        const targetRaw = node?.name ?? node?.id;
        const targetId = nameToId.get(norm(targetRaw)) ||
            nameToId.get(normKey(targetRaw)) ||
            String(targetRaw);
        const conns = Array.isArray(node?.edges) ? node.edges : [];
        conns.forEach((e, i) => {
            const srcRaw = e?.requiredNode?.name ?? e?.source ?? e?.from;
            if (!srcRaw)
                return;
            const sourceId = nameToId.get(norm(srcRaw)) ||
                nameToId.get(normKey(srcRaw)) ||
                String(srcRaw);
            if (!sourceId || !targetId || sourceId === targetId)
                return; // skip zero-length
            edges.push({
                id: `e-${sourceId}-${targetId}-${i}`,
                source: String(sourceId),
                target: String(targetId),
                sourceHandle: 'a',
                targetHandle: 'a',
                type: 'straight',
                data: {
                    pointsToUnlock: Number.isFinite(+e?.pointsToUnlock) ? +e.pointsToUnlock : 1,
                },
            });
        });
    }
    // ---- infer roots by indegree (preserve existing isRoot=true) ----
    const indeg = new Map();
    nodes.forEach((n) => indeg.set(n.id, 0));
    edges.forEach((e) => indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1));
    nodes = nodes.map((n) => {
        const already = Boolean(n.data?.isRoot);
        const inferred = (indeg.get(n.id) ?? 0) === 0;
        return {
            ...n,
            data: { ...n.data, isRoot: already || inferred },
        };
    });
    return {
        key: id,
        definitionId: def?.id,
        nodes,
        edges,
        blurUrl,
        lineUrl,
        size: { width, height },
        container: { x: position[0], y: position[1] },
        center,
    };
}
export default parseGroupToGraph;
