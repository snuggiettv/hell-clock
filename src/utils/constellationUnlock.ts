
// src/utils/constellationUnlock.ts
// Shared helpers for sequential unlocks with cascade from isRoot.

export type UnlockNode = { id: string; isRoot?: boolean };
export type UnlockEdge = { source: string; target: string; pointsToUnlock?: number };

/** Build incoming requirements map: target -> array of { source, pointsToUnlock } */
export function buildIncoming(nodes: UnlockNode[], edges: UnlockEdge[]) {
  const incoming = new Map<string, Array<{ source: string; pointsToUnlock: number }>>();
  const nodeIds = new Set(nodes.map(n => n.id));
  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    const arr = incoming.get(e.target) || [];
    arr.push({ source: e.source, pointsToUnlock: Number.isFinite(+e.pointsToUnlock!) ? +e.pointsToUnlock! : 1 });
    incoming.set(e.target, arr);
  }
  return incoming;
}

/** Prune a desired active set so only nodes that are still valid (ANY-of) remain active */
export function cascadeFromRoot(
  desiredActive: Set<string>,
  roots: Set<string>,
  incoming: Map<string, Array<{ source: string; pointsToUnlock: number }>>,
): Set<string> {
  const finalActive = new Set<string>(desiredActive);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of Array.from(finalActive)) {
      if (roots.has(id)) continue;
      const reqs = incoming.get(id) || [];
      if (reqs.length === 0) { finalActive.delete(id); changed = true; continue; }
      const ok = reqs.some(r => finalActive.has(r.source)); // ANY-of
      if (!ok) { finalActive.delete(id); changed = true; }
    }
  }
  return finalActive;
}

/** For UI flags: compute availability/lock for all nodes */
export function computeFlags(
  nodeIds: string[],
  roots: Set<string>,
  finalActive: Set<string>,
  incoming: Map<string, Array<{ source: string; pointsToUnlock: number }>>,
) {
  return nodeIds.map(id => {
    const isActivated = finalActive.has(id);
    const reqs = incoming.get(id) || [];
    const unlockedByReqs = reqs.length > 0 && reqs.some(r => finalActive.has(r.source));
    const isAvailable = !isActivated && (roots.has(id) || unlockedByReqs);
    const isLocked = !isAvailable && !isActivated;
    return { id, isActivated, isAvailable, isLocked };
  });
}
