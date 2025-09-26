// src/constellations/parseGroup.ts
import type { Node, Edge } from "reactflow";

// Keep it lightweight: we only need id/artBase/group from the entry
export type MinimalEntry = {
  id: string;
  artBase?: string;   // e.g. `${BASE_URL}constellations/<slug>/`
  group: any;         // a single item from constellationsDetails[]
};

const num = (v: any) => (Number.isFinite(+v) ? +v : 0);

export function parseGroupToGraph(entry: MinimalEntry): {
  key: string;
  nodes: Node[];
  edges: Edge[];
  blurUrl?: string;
  lineUrl?: string;
} {
  const { id, artBase, group } = entry || {};
  const def = group?.definition ?? {};

  // Art file names come without ".png"
  const blurUrl = def?.illustrationBlurredLine && artBase
    ? `${artBase}${def.illustrationBlurredLine}.png`
    : undefined;

  const lineUrl = def?.illustrationLine && artBase
    ? `${artBase}${def.illustrationLine}.png`
    : undefined;

  // Build nodes from definition.nodes[]
  const rawNodes: any[] = Array.isArray(def?.nodes) ? def.nodes : [];

  const nodes: Node[] = rawNodes.map((n) => {
    const pos = Array.isArray(n.Position)
      ? { x: num(n.Position[0]), y: num(n.Position[1]) }
      : { x: num(n.Position?.x), y: num(n.Position?.y) };

    // Prefer localized English label, fallback to raw name
    const label =
      (Array.isArray(n.nameLocalizationKey)
        ? n.nameLocalizationKey.find((l: any) => l.langCode === "en")?.langTranslation
        : undefined) || String(n.name);

    return {
      id: String(n.name),          // names are unique within a constellation (UUIDs or text)
      type: "constellation",
      position: pos,
      data: {
        label,
        isRoot: !!n.isRoot,        // canvas will convert this to isLocked/isAvailable
      },
    } as Node;
  });

  // Build edges: requiredNode.name -> current node.name
  const edges: Edge[] = rawNodes.flatMap((node) => {
    const targetId = String(node?.name);
    const conns: any[] = Array.isArray(node?.edges) ? node.edges : [];
    return conns
      .map((e: any, i: number) => {
        const src = e?.requiredNode?.name;
        if (!src) return null;
        return {
          id: `e-${src}-${targetId}-${i}`,
          source: String(src),
          target: targetId,
          sourceHandle: "a",
          targetHandle: "a",
          type: "straight",
        } as Edge;
      })
      .filter(Boolean) as Edge[];
  });

  return { key: id, nodes, edges, blurUrl, lineUrl };
}
