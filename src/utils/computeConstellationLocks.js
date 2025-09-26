// --- computeConstellationLocks.ts 
export function computeConstellationLocks(nodes, edges) {
    // Build rank map from node.data.rank (defaults to 0)
    const rankOf = new Map();
    nodes.forEach(n => rankOf.set(n.id, Number(n.data?.rank ?? 0)));
    // Group incoming requirements per target
    const incoming = new Map();
    edges.forEach(e => {
        const list = incoming.get(e.target) ?? [];
        list.push({
            source: e.source,
            pointsToUnlock: Number.isFinite(+e.data?.pointsToUnlock) ? +e.data?.pointsToUnlock : 1,
        });
        incoming.set(e.target, list);
    });
    // Evaluate each node's lock/availability
    return nodes.map(n => {
        const rank = rankOf.get(n.id) ?? 0;
        // Active or root nodes are not locked
        if (rank > 0 || n.data?.isRoot) {
            return { ...n, data: { ...n.data, isLocked: false, isAvailable: rank === 0 } };
        }
        const reqs = incoming.get(n.id) ?? [];
        // If there are no requirements, it's available
        if (reqs.length === 0) {
            return { ...n, data: { ...n.data, isLocked: false, isAvailable: true } };
        }
        // ANY-of unlocking: at least one predecessor meets its threshold
        const anyMet = reqs.some(req => {
            const srcRank = rankOf.get(req.source) ?? 0;
            return srcRank >= req.pointsToUnlock;
        });
        return { ...n, data: { ...n.data, isLocked: !anyMet, isAvailable: anyMet } };
    });
}
