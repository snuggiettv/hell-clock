// src/activation/useConstellationActivation.ts
export type NodeData = {
  label: string;
  sprite?: string;
  isLocked?: boolean;
  isActivated?: boolean;
  isAvailable?: boolean;
  showLabels?: boolean;
  onClick?: () => void;
  onRightClick?: () => void;
};

export type ActivationCtx = { constellationId: string };

export type UseActivationOptions = {
  enabled?: boolean;
  showLabels?: boolean;
  getNodeState?: (nodeId: string, ctx: ActivationCtx) => Partial<NodeData> | undefined;
  onStarClick?: (nodeId: string, ctx: ActivationCtx) => void;
  onStarRightClick?: (nodeId: string, ctx: ActivationCtx) => void;
};

export type ActivationAdapter = {
  decorateStarData: (base: Partial<NodeData>, srcNode: any, ctx: ActivationCtx) => NodeData;
};

export function useConstellationActivation(opts: UseActivationOptions = {}): ActivationAdapter {
  const enabled = !!opts.enabled;
  const showLabels = !!opts.showLabels;

  const decorateStarData = (base: Partial<NodeData>, srcNode: any, ctx: ActivationCtx): NodeData => {
    const nodeId: string = String(srcNode?.id ?? srcNode?.data?.id ?? base.label ?? "");
    const fromStore = enabled && opts.getNodeState ? (opts.getNodeState(nodeId, ctx) || {}) : {};

    const click = enabled && opts.onStarClick ? () => opts.onStarClick!(nodeId, ctx) : undefined;
    const rightClick = enabled && opts.onStarRightClick ? () => opts.onStarRightClick!(nodeId, ctx) : undefined;

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

export type EdgeLike = { id?: string; source: string; target: string };
export function buildAdjacencyMap(edges: EdgeLike[]) {
  const adj = new Map<string, Set<string>>();
  for (const e of edges || []) {
    if (!e || !e.source || !e.target) continue;
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }
  return adj;
}
