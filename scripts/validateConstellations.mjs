
/**
 * scripts/validateConstellations.mjs
 *
 * Run with Node (no TypeScript tools needed):
 *   node scripts/validateConstellations.mjs ./Constellations.json
 *
 * Checks:
 *  1) Roots that also have requiredNode pointing to another node in the same constellation.
 *  2) Unresolved edges (requiredNode points to name/id not found in same constellation).
 *  3) Duplicate English labels bound to different node ids.
 *  4) Roots with incoming edges (computed from others' requiredNode).
 *
 * Exits with code 1 if any issues were found. Prints a JSON report to stdout.
 */

import fs from "fs";
import path from "path";
import process from "process";

const argvPath = process.argv[2] || "./Constellations.json";
const filePath = path.resolve(process.cwd(), argvPath);
if (!fs.existsSync(filePath)) {
  console.error("[validateConstellations] File not found:", filePath);
  process.exit(2);
}

const raw = fs.readFileSync(filePath, "utf8");
const data = JSON.parse(raw);
const details = data.constellationsDetails || data.constellations || [];

const getEn = (loc) => {
  if (!Array.isArray(loc)) return undefined;
  const en = loc.find(k => /^en($|-)/i.test(String(k?.langCode || "")))?.langTranslation;
  return en ?? loc[0]?.langTranslation;
};
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

let issueCount = 0;

const report = {
  file: filePath,
  totals: { constellations: details.length, issues: 0 },
  constellations: [],
};

for (const root of details) {
  const def = (root?.definition || {});
  const cname = getEn(def.displayNameKey) || getEn(def.nameLocalizationKey) || def.name || def.id || "(unknown)";
  const nodes = def.nodes || [];

  const idToEn = new Map();
  const idSet = new Set();
  for (const n of nodes) {
    const id = n.name || n.id;
    if (!id) continue;
    idSet.add(id);
    idToEn.set(id, getEn(n.nameLocalizationKey) || id);
  }

  // alias map for edge resolution
  const aliasToId = new Map();
  for (const n of nodes) {
    const nid = n.name || n.id;
    if (!nid) continue;
    const en = idToEn.get(nid) || nid;
    const push = (k) => { if (k && !aliasToId.has(k)) aliasToId.set(k, nid); };
    push(nid); push(norm(nid));
    push(en);  push(norm(en));
    push(en + " Node"); push(en + " node"); push(norm(en + " node"));
    const noNode = en.replace(/\s*node$/i, "");
    if (noNode !== en) { push(noNode); push(norm(noNode)); }
  }

  // Incoming edges count
  const incoming = new Map(Array.from(idSet).map(id => [id, 0]));
  const unresolvedEdges = [];

  for (const tgt of nodes) {
    const tgtId = tgt.name || tgt.id;
    if (!tgtId) continue;
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
  const labelToIds = new Map();
  for (const id of idSet) {
    const en = idToEn.get(id) || id;
    const set = labelToIds.get(en) || new Set();
    set.add(id);
    labelToIds.set(en, set);
  }
  const dupLabels = Array.from(labelToIds.entries()).filter(([, set]) => set.size > 1);

  // Roots with local requiredNode edges
  const rootsWithLocalReqs = [];
  for (const n of nodes) {
    if (!n.isRoot) continue;
    const rootId = n.name || n.id;
    if (!rootId) continue;
    const reqs = [];
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

  // isRoot that also has incoming edges
  const rootsWithIncoming = [];
  for (const n of nodes) {
    if (!n.isRoot) continue;
    const id = n.name || n.id;
    if (!id) continue;
    const inc = incoming.get(id) || 0;
    if (inc > 0) rootsWithIncoming.push({ id, name: idToEn.get(id) || id, incomingCount: inc });
  }

  const cReport = {
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
if (issueCount > 0) process.exitCode = 1;
