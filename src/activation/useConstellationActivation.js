export function useConstellationActivation(opts = {}) {
    const enabled = !!opts.enabled;
    const showLabels = !!opts.showLabels;
    const decorateStarData = (base, srcNode, ctx) => {
        const nodeId = String(srcNode?.id ?? srcNode?.data?.id ?? base.label ?? "");
        const fromStore = enabled && opts.getNodeState ? (opts.getNodeState(nodeId, ctx) || {}) : {};
        const click = enabled && opts.onStarClick ? () => opts.onStarClick(nodeId, ctx) : undefined;
        const rightClick = enabled && opts.onStarRightClick ? () => opts.onStarRightClick(nodeId, ctx) : undefined;
        return {
            label: String(base.label ?? srcNode?.data?.label ?? ""),
            sprite: fromStore.sprite ?? base.sprite,
            isLocked: fromStore.isLocked ?? base.isLocked ?? false,
            isActivated: fromStore.isActivated ?? base.isActivated ?? false,
            isAvailable: fromStore.isAvailable ?? base.isAvailable ?? false,
            showLabels,
            onClick: click,
            onRightClick: rightClick,
        };
    };
    return { decorateStarData };
}
export function buildAdjacencyMap(edges) {
    const adj = new Map();
    for (const e of edges || []) {
        if (!e || !e.source || !e.target)
            continue;
        if (!adj.has(e.source))
            adj.set(e.source, new Set());
        if (!adj.has(e.target))
            adj.set(e.target, new Set());
        adj.get(e.source).add(e.target);
        adj.get(e.target).add(e.source);
    }
    return adj;
}
