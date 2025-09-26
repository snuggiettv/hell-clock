
/**
 * scripts/validateConstellations.ts
 *
 * Usage:
 *   # with tsx (recommended)
 *   npx tsx scripts/validateConstellations.ts ./Constellations.json
 *
 *   # or with ts-node
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/validateConstellations.ts ./Constellations.json
 *
 * Checks:
 *  1) Root nodes that also have requiredNode pointing to another node in the same constellation.
 *  2) Unresolved edges (requiredNode points to name/id that doesn't exist in the same constellation).
 *  3) Duplicate EN labels bound to different node ids (can cause UI confusion).
 *  4) Nodes marked isRoot that also have *incoming* edges (someone else requires them).
 *
 * Exit code is 1 if any issues were found.
 */

import fs from "fs";
import path from "path";

type Loc = { langCode?: string; langTranslation?: string };
type NodeDef = {
  name?: string; id?: string;
  nameLocalizationKey?: Loc[];
  isRoot?: boolean;
  sprite?: string;
  edges?: Array<{
    requiredNode?: { name?: string; id?: string };
    pointsToUnlock?: number;
  }>;
};
type ConstellationDef = {
  name?: string; id?: string;
  displayNameKey?: Loc[]; nameLocalizationKey?: Loc[];
  nodes?: NodeDef[];
};
type Root = {
  definition?: ConstellationDef;
};
type FileShape = {
  constellationsDetails?: Root[];
  constellations?: Root[];
};

const argvPath = process.argv[2] || "./Constellations.json";
const filePath = path.resolve(process.cwd(), argvPath);
if (!fs.existsSync(filePath)) {
  console.error("[validateConstellations] File not found:", filePath);
  process.exit(2);
}

const raw = fs.readFileSync(filePath, "utf8");
const data: FileShape | any = JSON.parse(raw);
const details: Root[] = data.constellationsDetails || data.constellations || [];

function getEn(loc?: Loc[] | null) {
  if (!Array.isArray(loc)) return undefined;
  let en = loc.find(k => /^en($|-)/i.test(String(k?.langCode || "")))?.langTranslation;
  return en ?? loc[0]?.langTranslation;
}
const norm = (s: any) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

let issueCount = 0;

const report: any = {
  file: filePath,
  totals: { constellations: details.length, issues: 0 },
  constellations: [] as any[],
};

for (const root of details) {
  const def = (root?.definition || {}) as ConstellationDef;
  const cname = getEn(def.displayNameKey) || getEn(def.nameLocalizationKey) || def.name || def.id || "(unknown)";
  const nodes = (def.nodes || []) as NodeDef[];

  const idToEn = new Map<string,string>();
  const idSet = new Set<string>();
  for (const n of nodes) {
    const id = (n.name || n.id)!;
    idSet.add(id);
    idToEn.set(id, getEn(n.nameLocalizationKey) || id);
  }

  // Build alias map for edge resolution
  const aliasToId = new Map<string,string>();
  for (const n of nodes) {
    const nid = (n.name || n.id)!;
    const en = idToEn.get(nid) || nid;
    const push = (k?: string) => { if (k && !aliasToId.has(k)) aliasToId.set(k, nid); };
    push(nid); push(norm(nid));
    push(en);  push(norm(en));
    push(en + " Node"); push(en + " node"); push(norm(en + " node"));
    const noNode = en.replace(/\s*node$/i, "");
    if (noNode !== en) { push(noNode); push(norm(noNode)); }
  }

  // Incoming edge counts (by id)
  const incoming = new Map<string, number>(Array.from(idSet).map(id => [id, 0]));
  const unresolvedEdges: Array<{ targetId: string; targetName: string; requiredRaw: string }> = [];

  for (const tgt of nodes) {
    const tgtId = (tgt.name || tgt.id)!;
    for (const e of (tgt.edges || [])) {
      const rawReq = e?.requiredNode?.name || e?.requiredNode?.id;
      if (!rawReq) continue;
      const resolved = aliasToId.get(rawReq) || aliasToId.get(norm(rawReq)) || rawReq;
      if (idSet.has(resolved)) {
        incoming.set(tgtId, (incoming.get(tgtId) || 0) + 1);
      } else {
        unresolvedEdges.push({ targetId: tgtId, targetName: idToEn.get(tgtId) || tgtId, requiredRaw: String(rawReq) });
      }
    }
  }

  // Duplicate EN labels
  const labelToIds = new Map<string, Set<string>>();
  for (const id of idSet) {
    const en = idToEn.get(id) || id;
    const set = labelToIds.get(en) || new Set<string>();
    set.add(id);
    labelToIds.set(en, set);
  }
  const dupLabels = Array.from(labelToIds.entries()).filter(([, set]) => set.size > 1);

  // Roots with local requiredNode edges
  const rootsWithLocalReqs: Array<{ rootId: string; rootName: string; required: Array<{ id: string; name: string }> }> = [];
  for (const n of nodes) {
    if (!n.isRoot) continue;
    const rootId = (n.name || n.id)!;
    const reqs: Array<{ id: string; name: string }> = [];
    for (const e of (n.edges || [])) {
      const rawReq = e?.requiredNode?.name || e?.requiredNode?.id;
      if (!rawReq) continue;
      const resolved = aliasToId.get(rawReq) || aliasToId.get(norm(rawReq)) || rawReq;
      if (idSet.has(resolved) && resolved !== rootId) {
        reqs.push({ id: resolved, name: idToEn.get(resolved) || resolved });
      }
    }
    if (reqs.length) {
      rootsWithLocalReqs.push({ rootId, rootName: idToEn.get(rootId) || rootId, required: reqs });
    }
  }

  // isRoot that *also* has incoming edges (from any other node)
  const rootsWithIncoming: Array<{ id: string; name: string; incomingCount: number }> = [];
  for (const n of nodes) {
    if (!n.isRoot) continue;
    const id = (n.name || n.id)!;
    const inc = incoming.get(id) || 0;
    if (inc > 0) rootsWithIncoming.push({ id, name: idToEn.get(id) || id, incomingCount: inc });
  }

  const cReport: any = {
    name: cname,
    counts: {
      nodes: nodes.length,
      duplicatesByLabel: dupLabels.length,
      unresolvedEdges: unresolvedEdges.length,
      rootsWithLocalRequired: rootsWithLocalReqs.length,
      rootsWithIncoming: rootsWithIncoming.length,
    },
    duplicatesByLabel: dupLabels.map(([label, ids]) => ({ label, ids: Array.from(ids) })),
    unresolvedEdges,
    rootsWithLocalRequired: rootsWithLocalReqs,
    rootsWithIncoming,
  };

  report.constellations.push(cReport);
  issueCount += cReport.counts.duplicatesByLabel + cReport.counts.unresolvedEdges + cReport.counts.rootsWithLocalRequired + cReport.counts.rootsWithIncoming;
}

report.totals.issues = issueCount;

console.log(JSON.stringify(report, null, 2));

if (issueCount > 0) {
  process.exitCode = 1;
}
