/* ConstellationCanvas.tsx
   ALIGN VIEW — art stays still; nodes move.
   - Art is drawn once, centered by *scaled image size*, aspect-preserved (downscale-only).
   - Offsets (x,y) && scale affect NODES ONLY, not the art.
   - Nodes are positioned from container center (0,0), so Align matches Full Map.
   - nodeOrigin = center (no half-node drift)
   - 10% translateExtent + fitView padding so edges never clip.
   - Quick Nudge panel + Alignment HUD (Shift+D) + "Log art URLs".
*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useStore,
  ReactFlowProvider,
} from 'reactflow';
import type { Edge as RFEdge, Node as RFNode } from 'reactflow';
import 'reactflow/dist/style.css';

import ConstellationNode from './ConstellationNode';

const nodeTypes = { constellation: ConstellationNode } as const;

type NodeData = {
  label: string;
  isLocked: boolean;
  isActivated: boolean;
  isAvailable?: boolean;
  showLabels?: boolean;
  onClick?: () => void;
  onRightClick?: () => void;
  themeColor?: string;
  isComplete?: boolean;
};

type InitialGraph = {
  nodes: RFNode<NodeData>[];
  edges: RFEdge[];
  blurUrl?: string;  // exact name & case from JSON
  lineUrl?: string;  // exact name & case from JSON
  size?: { width: number; height: number }; // container size from JSON (last entry)
};

type Props = {
  source: { id: string };        // storage key for alignment
  initialGraph?: InitialGraph;
  is99Lock?: boolean;            // disables alignment UI
};

// --- UNLOCK TEST MODE (self-contained) ---------------------------------------
type NodeLike = { id: string };
type EdgeLike = { source: string; target: string };

function buildPredecessors(nodes: NodeLike[], edges: EdgeLike[]) {
  const preds = new Map<string, Set<string>>();
  for (const n of nodes) preds.set(n.id, new Set());
  for (const e of edges) {
    // treat an edge A->B as "B depends on A"
    if (preds.has(e.target)) preds.get(e.target)!.add(e.source);
  }
  return preds;
}

function deriveAvailable(
  nodes: NodeLike[],
  preds: Map<string, Set<string>>,
  activated: Set<string>
): Set<string> {
  const out = new Set<string>();
  for (const n of nodes) {
    if (activated.has(n.id)) continue;
    const need = preds.get(n.id);
    if (!need || [...need].every(p => activated.has(p))) out.add(n.id);
  }
  return out;
}

function lsKeyProgress(id: string) {
  return `constellation:${id}:testProgress`;
}

function loadProgress(id: string): Set<string> {
  try {
    const raw = localStorage.getItem(lsKeyProgress(id));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set<string>(Array.isArray(arr) ? arr : []);
  } catch { return new Set<string>(); }
}

function saveProgress(id: string, set: Set<string>) {
  try { localStorage.setItem(lsKeyProgress(id), JSON.stringify([...set])); } catch {}
}

const STORAGE_KEY = (key: string) => `constellation:${key}:align`;
const HUD_KEY = 'constellationDebugHUD';
const LABELS_KEY = 'constellationShowLabels';
const COLOR_KEY = (key: string) => `constellation:${key}:color`;

const Inner: React.FC<Props> = ({ source, initialGraph, is99Lock }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([]);
  const edgesRef = useRef<RFEdge[]>([]);
  const activeRef = useRef<Set<string>>(new Set());
  const [blurUrl, setBlurUrl] = useState<string>('');
  const [lineUrl, setLineUrl] = useState<string>('');
  const [isComplete, setIsComplete] = useState<boolean>(false);

  // art load flags
  const [blurLoaded, setBlurLoaded] = useState(false);
  const [lineLoaded, setLineLoaded] = useState(false);

  // Alignment + HUD (AFFECTS NODES ONLY)
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [imgScale, setImgScale] = useState(1);
  const [nudge, setNudge] = useState(1);
  const [scaleStep, setScaleStep] = useState(0.01);
  const [snapGrid, setSnapGrid] = useState(2);
  const [showHUD, setShowHUD] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [themeColor, setThemeColor] = useState<string>('#ffffff');

  // Fit-to-container (aspect preserved, downscale only) — ART ONLY
  const W = initialGraph?.size?.width ?? 500;
  const H = initialGraph?.size?.height ?? 500;
  const [natW, setNatW] = useState(0);
  const [natH, setNatH] = useState(0);
  const [baseScale, setBaseScale] = useState(1);

  // derived scaled image size (for perfect centering)
  const scaledW = Math.max(0, natW * (baseScale || 1));
  const scaledH = Math.max(0, natH * (baseScale || 1));

  // 10% padded extent so edges never clip
  const PAD_W = W * 0.10;
  const PAD_H = H * 0.10;
  const translateExtent = useMemo<
    [[number, number], [number, number]]
  >(() => {
    // world is centered at (0,0)
    return [[-W / 2 - PAD_W, -H / 2 - PAD_H], [W / 2 + PAD_W, H / 2 + PAD_H]];
  }, [W, H, PAD_W, PAD_H]);

  // Art presence & control gating
  const artAvailable = !!(blurUrl || lineUrl);
  const controlsEnabled = !is99Lock; // controls allowed even if art is missing

  // soft gray used for unlocked/partial edges && blur
  const GRAY_STROKE = 'rgba(185,205,225,0.65)';
  const GRAY_FILL   = 'rgba(185,205,225,0.75)';


  // helpers
  const adjacencyMap = useMemo(() => new Map<string, Set<string>>(), []);
  const rootSet = useRef<Set<string>>(new Set());

  // viewport transform (from React Flow)
  const [tx, ty, k] = useStore(s => s.transform);

  // keep raw (untransformed) node positions — so we can recompute positions without losing flags
  const rawPos = useRef<Record<string, { x: number; y: number }>>({});

  // Reset per constellation
  useEffect(() => {
    setNatW(0); setNatH(0); setBaseScale(1);
    setBlurLoaded(false); setLineLoaded(false);
    rawPos.current = {};
  }, [source.id]);

  // Seed graph (store raw positions; create nodes once)
  useEffect(() => {
    if (!initialGraph) return;

    // Apply WIP / placeholder-art suppression
    const rawBlur = initialGraph.blurUrl || '';
    const rawLine = initialGraph.lineUrl || '';
    const idIsWIP = /^wip[-_]/i.test(source.id);
    const isOgum = /(^|-)ogum$/i.test(source.id);
    const hasOgum = /Ogum/i.test(rawBlur) || /Ogum/i.test(rawLine);
    const hideArt = idIsWIP || (hasOgum && !isOgum);

    setBlurUrl(hideArt ? '' : rawBlur);
    setLineUrl(hideArt ? '' : rawLine);

    // Save raw positions (assumed centered coordinates)
    rawPos.current = {};
    for (const n of initialGraph.nodes || []) {
      rawPos.current[n.id] = { x: n.position?.x || 0, y: n.position?.y || 0 };
    }

    // Build nodes with handlers; positions will be set below by applyAlign()
    const withData: RFNode<NodeData>[] = (initialGraph.nodes || []).map((n) => ({
      ...n,
      draggable: false,
      data: {
        ...n.data,
        isActivated: false,
        isAvailable: false,
        isLocked: true,
        showLabels,
        themeColor,
        onClick: () => handleActivate(n.id),
        onRightClick: () => handleDeactivate(n.id),
      },
    })) as RFNode<NodeData>[];

    setNodes(withData);
    // Force center-to-center edges + default gray stroke
    const seededEdges: RFEdge[] = (initialGraph.edges || []).map((e, i) => ({
      id: e.id ?? `e-${i}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      sourceHandle: 'a',   // <<< matches <Handle id="a" .../> in ConstellationNode.tsx
      targetHandle: 'a',
      type: 'straight',
      style: { stroke: GRAY_STROKE, strokeWidth: 2, opacity: 1 },
    }));
    setEdges(seededEdges);

    
  // roots (available) — honor ONLY explicit isRoot;
  // use edge-based fallback ONLY if the JSON has no isRoot at all
  const explicitRoots = new Set(withData
    .filter(n => (n.data as any)?.isRoot)
    .map(n => n.id)
  );

  let roots = explicitRoots;
  if (roots.size === 0) {
    // defensive fallback (rare): nodes with no incoming edges
    const targetIds = new Set((seededEdges || []).map(e => e.target));
    roots = new Set(withData.filter(n => !targetIds.has(n.id)).map(n => n.id));
  }

  rootSet.current = roots;

  setNodes(curr => curr.map(n => ({
    ...n,
    data: {
      ...n.data,
      isLocked: !roots.has(n.id),
      isAvailable: roots.has(n.id),
      isActivated: false,
    },
  })));

    setNodes(curr => curr.map(n => ({
      ...n,
      data: {
        ...n.data,
        isLocked: !roots.has(n.id),
        isAvailable: roots.has(n.id),
        isActivated: false,
      },
    })));
    // After seeding, apply alignment to positions
    applyAlign(withData);
    setTimeout(() => recompute(new Set()), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGraph]);


  // keep edgesRef in sync
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  // Build adjacency for unlock logic
  useEffect(() => {
    adjacencyMap.clear();
    edges.forEach(e => {
      if (!adjacencyMap.has(e.source)) adjacencyMap.set(e.source, new Set());
      if (!adjacencyMap.has(e.target)) adjacencyMap.set(e.target, new Set());
      adjacencyMap.get(e.source)!.add(e.target);
      adjacencyMap.get(e.target)!.add(e.source);
    });
  }, [edges, adjacencyMap]);

  // restore alignment + prefs + keybinds
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY(source.id));
      if (saved) {
        const { x, y, scale } = JSON.parse(saved);
        if (typeof x === 'number') setOffsetX(x);
        if (typeof y === 'number') setOffsetY(y);
        if (typeof scale === 'number') setImgScale(scale);
      }
    } catch {}

    setShowHUD(localStorage.getItem(HUD_KEY) === '1');
    setShowLabels(localStorage.getItem(LABELS_KEY) === '1');

    // load saved tint color (per constellation)
    try {
      const savedColor = localStorage.getItem(COLOR_KEY(source.id));
      if (savedColor) setThemeColor(savedColor);
    } catch {}

    const onKey = (e: KeyboardEvent) => {
      // Shift+D toggles HUD (only if alignmentEnabled)
      if (e.key.toLowerCase() === 'd' && e.shiftKey && controlsEnabled) {
        setShowHUD(prev => {
          const next = !prev; localStorage.setItem(HUD_KEY, next ? '1' : '0'); return next;
        });
      }
      // L toggles labels
      if (e.key.toLowerCase() === 'l') {
        setShowLabels(prev => {
          const next = !prev; localStorage.setItem(LABELS_KEY, next ? '1' : '0');
          setNodes(curr => curr.map(n => ({ ...n, data: { ...n.data, showLabels: next } })));
          return next;
        });
      }
      if (!controlsEnabled) return;

      const step = (e.shiftKey ? 5 : 1) * nudge;
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowLeft') setOffsetX(v => v - step);
        if (e.key === 'ArrowRight') setOffsetX(v => v + step);
        if (e.key === 'ArrowUp') setOffsetY(v => v - step);
        if (e.key === 'ArrowDown') setOffsetY(v => v + step);
      }
      if (e.key === '=' || e.key === '+') setImgScale(s => +(s + scaleStep).toFixed(4));
      if (e.key === '-') setImgScale(s => +(s - scaleStep).toFixed(4));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controlsEnabled, nudge, scaleStep, source.id, setNodes]);

  // propagate themeColor to all nodes when it changes
  useEffect(() => {
    setNodes(curr => curr.map(n => ({ ...n, data: { ...n.data, themeColor } })));
  }, [themeColor, setNodes]);

  // persist alignment
  useEffect(() => {
    if (!controlsEnabled) return;
    try {
      localStorage.setItem(
        STORAGE_KEY(source.id),
        JSON.stringify({ x: offsetX, y: offsetY, scale: imgScale })
      );
    } catch {}
  }, [controlsEnabled, offsetX, offsetY, imgScale, source.id]);

  // When offset/scale change, recompute node positions (ART DOES NOT MOVE)
  useEffect(() => {
    applyAlign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetX, offsetY, imgScale]);

  // ------- Unlock recomputation -------
  
  
  // Fallback: build incoming requirements map on the fly (when incomingRef is unavailable)
  function __buildIncomingOnTheFly(nodesArr: Array<{id:string}>, edgesArr: Array<{source:string;target:string; data?: any}>) {
    const ids = new Set(nodesArr.map((n:any) => n.id));
    const m = new Map<string, Array<{source:string; pointsToUnlock:number}>>();
    for (const e of edgesArr || []) {
      if (!ids.has(e.source) || !ids.has(e.target)) continue;
      const ptuRaw = (e as any)?.data?.pointsToUnlock;
      const ptu = Number.isFinite(+ptuRaw) ? +ptuRaw : 1;
      const arr = m.get(e.target) || [];
      arr.push({ source: e.source, pointsToUnlock: ptu });
      m.set(e.target, arr);
    }
    return m;
  }
// ------- Unlock recomputation (cascade from isRoot) -------
  
  // ------- Unlock recomputation (cascade from isRoot) -------
    // ------- Unlock recomputation (with cascade by connectivity to roots) -------
  const recompute = (seedActive: Set<string>) => {
    // Build finalActive by keeping only nodes connected to at least one ACTIVE root
    const finalActive = new Set<string>();
    const q: string[] = [];

    // Seed queue with active roots
    for (const id of seedActive) {
      if (rootSet.current.has(id)) {
        finalActive.add(id);
        q.push(id);
      }
    }

    // BFS across ACTIVE edges only (treat graph as undirected)
    while (q.length) {
      const u = q.shift() as string;
      const nbrs = adjacencyMap.get(u) || new Set<string>();
      for (const v of nbrs) {
        if (!seedActive.has(v) || finalActive.has(v)) continue; // must already be active to stay
        finalActive.add(v);
        q.push(v);
      }
    }

    // Update nodes and edges based on finalActive, and compute availability
    setNodes((curr) => {
      const total = curr.length;
      const done = finalActive.size === total && total > 0;
      setIsComplete(done);
      try { localStorage.setItem(`constellation:${source.id}:complete`, done ? '1' : '0'); } catch {}

      // Edge coloring: bright when both endpoints are active (or all complete)
      setEdges((currEdges) =>
        currEdges.map((e) => {
          const a = finalActive.has(e.source);
          const b = finalActive.has(e.target);
          const stroke = done || (a && b) ? (themeColor || '#ffffff') : GRAY_STROKE;
          return { ...e, style: { ...(e.style || {}), stroke, strokeWidth: 2, opacity: 1 } };
        })
      );

      // expose for handlers
      activeRef.current = finalActive;

      return curr.map((n) => {
        const isActivated = finalActive.has(n.id);
        const isRoot = rootSet.current.has(n.id);

        // Availability rule (bi-directional/adjacent): a node is available if
        // - it's a root (not yet activated), or
        // - it touches ANY active node (regardless of explicit prereqs in data)
        const hasActiveNeighbor = [...(adjacencyMap.get(n.id) || [])].some(nb => finalActive.has(nb));
        const isAvailable = !isActivated && (isRoot || hasActiveNeighbor);
        const isLocked = !isActivated && !isAvailable;

        return { ...n, data: { ...n.data, isActivated, isAvailable, isLocked, isComplete: done } };
      });
    });
  };
    ;
  
  const handleActivate = (id: string) => {
    setNodes((curr) => {
      const me = curr.find((n) => n.id === id);
      // must be available (and not already active)
      if (!me || me.data?.isActivated || !me.data?.isAvailable) return curr;

      const desired = new Set<string>(Array.from(activeRef.current));
      desired.add(id);

      // optional optimistic flip; recompute will cascade correctness
      const next = curr.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, isActivated: true, isLocked: false, isAvailable: false } }
          : n
      );

      setTimeout(() => recompute(desired), 0);
      return next;
    });
  };


  const handleDeactivate = (id: string) => {
    setNodes((curr) => {
      const desired = new Set<string>(Array.from(activeRef.current));
      if (!desired.has(id)) return curr;
      desired.delete(id);
      const next = curr.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, isActivated: false, isAvailable: rootSet.current.has(n.id) } }
          : n
      );
      setTimeout(() => recompute(desired), 0);
      return next;
    });
  };


  // ------- Fit-to-container (aspect preserved) — ART ONLY -------
  const updateBaseScale = (nw: number, nh: number) => {
    if (!nw || !nh) return;
    setNatW(nw); setNatH(nh);
    // contain + only scale down (never up)
    const s = Math.min(W / nw, H / nh, 1);
    setBaseScale(Number.isFinite(s) && s > 0 ? s : 1);
  };
  const onBlurLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setBlurLoaded(true);
    updateBaseScale(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
  };
  const onLineLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setLineLoaded(true);
    updateBaseScale(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
  };

  // ---------- ART TRANSFORM (fixed, centered by *scaled* size) ----------
  const viewportTf = useMemo(
    () => `matrix(${k},0,0,${k},${tx},${ty})`,
    [k, tx, ty]
  );
  const artCenterTf = useMemo(() => {
    const tw = scaledW || W;  // fallback to container while natural size not known
    const th = scaledH || H;
    return `translate(${-tw / 2}px, ${-th / 2}px) scale(${baseScale || 1})`;
  }, [scaledW, scaledH, W, H, baseScale]);

  // shared <img> styles
  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    transformOrigin: '0 0',
    pointerEvents: 'none',
  };

  const useTint = (themeColor || '').toLowerCase() !== '#ffffff';

  // ---------- APPLY ALIGN TO NODES (ONLY) ----------
  function applyAlign(seed?: RFNode<NodeData>[]) {
    // Nodes live around world (0,0) == art center.
    // position = offset + raw * imgScale
    const upd = (arr: RFNode<NodeData>[]) =>
      arr.map(n => {
        const p = rawPos.current[n.id] || { x: n.position?.x || 0, y: n.position?.y || 0 };
        const nx = Math.round(offsetX + p.x * imgScale);
        const ny = Math.round(offsetY + p.y * imgScale);
        return { ...n, position: { x: nx, y: ny } };
      });

    if (seed) {
      setNodes(upd(seed));
    } else {
      setNodes((curr: RFNode<NodeData>[]) => upd(curr));
    }
  }

  // Quick Nudge helpers (respect Shift for coarse)
  const nudgeBy = (dx: number, dy: number, ev?: React.MouseEvent) => {
    const mult = ev?.shiftKey ? 5 : 1;
    if (dx) setOffsetX(v => v + dx * nudge * mult);
    if (dy) setOffsetY(v => v + dy * nudge * mult);
  };
  const scaleBy = (delta: number, ev?: React.MouseEvent) => {
    const mult = ev?.shiftKey ? 5 : 1;
    const total = +(imgScale + delta * scaleStep * mult).toFixed(4);
    setImgScale(total);
  };

  const logArtPaths = () => {
    // eslint-disable-next-line no-console
    console.log('[ConstellationCanvas] art URLs for', source.id, {
      blurUrl, lineUrl,
      baseURL: import.meta.env.BASE_URL,
      container: { width: W, height: H },
      naturalSize: { natW, natH },
      baseScale,
      alignAffects: 'NODES_ONLY',
      align: { x: offsetX, y: offsetY, scale: imgScale },
    });
    alert('Logged art URLs to console.');
  };

  // Center nodes: compute center from RAW node positions && set align so center → container center
  const handleCenterNodes = (prefer: 'bbox' | 'mean' = 'bbox') => {
    const rawList = Object.values(rawPos.current || {}).map(p => ({ position: { x: p.x, y: p.y } }));
    const { centroid, bboxCenter } = computeNodeCenters(rawList as any);
    const c = prefer === 'mean' ? centroid : bboxCenter;
    const s = imgScale || 1;
    setOffsetX(-(c.x) * s);
    setOffsetY(-(c.y) * s);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0b0d1a' }}>
      {/* ART LAYER — fixed in place */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: viewportTf,
          transformOrigin: '0 0',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <div style={{ transform: artCenterTf, transformOrigin: '0 0', position: 'relative' }}>
          {/* invisible loaders to measure natural size (keep these) */}
          {blurUrl && (
            <img
              src={blurUrl}
              alt="blur"
              onLoad={onBlurLoad}
              onError={() => setBlurLoaded(false)}
              style={{ ...imgStyle, opacity: 0, display: blurLoaded ? 'block' : 'none' }}
            />
          )}
          {lineUrl && (
            <img
              src={lineUrl}
              alt="line"
              onLoad={onLineLoad}
              onError={() => setLineLoaded(false)}
              style={{ ...imgStyle, opacity: 0, display: lineLoaded ? 'block' : 'none' }}
            />
          )}

          {/* visible, state-tinted art */}
          {!isComplete && blurUrl && (
            <div
              style={{
                position: 'absolute', left: 0, top: 0,
                width: natW || '100%', height: natH || '100%',
                transformOrigin: '0 0',
                background: 'rgba(185,205,225,0.75)',                // GRAY_FILL
                WebkitMaskImage: `url(${blurUrl})`, maskImage: `url(${blurUrl})`,
                WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center', maskPosition: 'center',
                WebkitMaskSize: 'contain', maskSize: 'contain',
                opacity: 0.9, zIndex: 0, pointerEvents: 'none',
                filter: 'brightness(0.95)',
              }}
            />
          )}

          {isComplete && lineUrl && (
            <div
              style={{
                position: 'absolute', left: 0, top: 0,
                width: natW || '100%', height: natH || '100%',
                transformOrigin: '0 0',
                background: themeColor || '#ffffff',                 // constellation tint
                WebkitMaskImage: `url(${lineUrl})`, maskImage: `url(${lineUrl})`,
                WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center', maskPosition: 'center',
                WebkitMaskSize: 'contain', maskSize: 'contain',
                zIndex: 2, pointerEvents: 'none',
                filter: 'drop-shadow(0 0 12px rgba(255,255,255,.35))',
              }}
            />
          )}
        </div>
      </div>

      {/* NODE LAYER — moves with align */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}      // visual padding on first fit
          translateExtent={translateExtent}      // pannable area includes 10% margin
          nodeOrigin={[0.5, 0.5]}                // center-origin nodes (matches Full Map)
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnDoubleClick={false}
          onPaneContextMenu={(e) => e.preventDefault()}
          panOnScroll
          zoomOnScroll
          panOnDrag
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {/* Quick Nudge Panel (only when HUD is closed) */}
      {controlsEnabled && !showHUD && (
        <div style={{
          position: 'absolute', right: 120, top: 10, zIndex: 4,
          background: 'rgba(0,0,0,0.70)', padding: 10, borderRadius: 8,
          color: '#eee', fontSize: 12, width: 600, border: '1px solid #3a3f5a'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Quick Nudge</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, justifyItems: 'center' }}>
            <button title="Up (Shift = ×5)" onMouseDown={(e) => nudgeBy(0, -1, e)} style={btnS}>↑</button>
            <div />
            <button title="Scale + (Shift = ×5)" onMouseDown={(e) => scaleBy(+1, e)} style={btnS}>+</button>

            <button title="Left (Shift = ×5)" onMouseDown={(e) => nudgeBy(-1, 0, e)} style={btnS}>←</button>
            <button title="Right (Shift = ×5)" onMouseDown={(e) => nudgeBy(+1, 0, e)} style={btnS}>→</button>
            <button title="Scale − (Shift = ×5)" onMouseDown={(e) => scaleBy(-1, e)} style={btnS}>−</button>

            <button title="Down (Shift = ×5)" onMouseDown={(e) => nudgeBy(0, +1, e)} style={btnS}>↓</button>
            <div />
            <button title="Reset scale" onMouseDown={() => setImgScale(1)} style={btnS}>1×</button>
          </div>

          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 6, alignItems: 'center' }}>
            <span style={{ opacity: 0.8 }}>nudge</span>
            <input type="number" value={nudge} step={1}
              onChange={(e) => setNudge(parseFloat(e.target.value || '0'))}
              style={numInput} />
            <span style={{ opacity: 0.8 }}>scale step</span>
            <input type="number" value={scaleStep} step={0.001}
              onChange={(e) => setScaleStep(parseFloat(e.target.value || '0.001'))}
              style={numInput} />
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <Btn onClick={() => {
              setOffsetX(Math.round(offsetX / snapGrid) * snapGrid);
              setOffsetY(Math.round(offsetY / snapGrid) * snapGrid);
            }}>Snap offsets</Btn>
            <Btn onClick={() => { setOffsetX(0); setOffsetY(0); setImgScale(1); }}>Reset</Btn>
            <Btn onClick={() => handleCenterNodes('bbox')} title="Place nodes' BBOX center at container center">Center nodes</Btn>
            <Btn onClick={() => handleCenterNodes('mean')} title="Use arithmetic-mean center (ignores shape width/height)">Center (mean)</Btn>
            <Btn onClick={() => {
              try {
                localStorage.setItem(
                  STORAGE_KEY(source.id),
                  JSON.stringify({ x: offsetX, y: offsetY, scale: imgScale })
                );
              } catch {}
            }}>Save</Btn>
            <Btn onClick={() => {
              try {
                const raw = localStorage.getItem(STORAGE_KEY(source.id));
                if (!raw) return;
                const { x, y, scale } = JSON.parse(raw);
                if (typeof x === 'number') setOffsetX(x);
                if (typeof y === 'number') setOffsetY(y);
                if (typeof scale === 'number') setImgScale(scale);
              } catch {}
            }}>Load</Btn>
            <Btn onClick={() => setShowHUD(false)}>Close</Btn>
            <Btn onClick={logArtPaths} title="Log the exact art URLs, sizes && align to the console">Log art URLs</Btn>
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span style={{ opacity: 0.8 }}>color</span>
              <input
                type="color"
                value={themeColor}
                onChange={(e) => {
                  const v = e.target.value || '#ffffff';
                  setThemeColor(v);
                  try { localStorage.setItem(COLOR_KEY(source.id), v); } catch {}
                }}
                style={{ width: 48, height: 24, background: 'transparent', border: '1px solid #3a3f5a', borderRadius: 4 }}
              />
            </label>
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => {
                  const next = e.target.checked;
                  setShowLabels(next);
                  localStorage.setItem(LABELS_KEY, next ? '1' : '0');
                  setNodes(curr => curr.map(n => ({ ...n, data: { ...n.data, showLabels: next } })));
                }}
              />
              Show labels (L)
            </label>
          </div>
        </div>
      )}

      {/* Informational badge when alignment disabled */}
      {is99Lock && (
        <div style={{
          position:'absolute', right:10, top:10, zIndex:4,
          background:'rgba(0,0,0,0.6)', color:'#ffb',
          padding:'6px 8px', border:'1px solid #665', borderRadius:6, fontSize:12
        }}>
          99-lock: alignment disabled
        </div>
      )}
      {!is99Lock && !artAvailable && (
        <div style={{
          position:'absolute', right:10, top:10, zIndex:4,
          background:'rgba(0,0,0,0.45)', color:'#cfe',
          padding:'6px 8px', border:'1px solid #355', borderRadius:6, fontSize:12
        }}>
          No art for this constellation — controls still active
        </div>
      )}
    </div>
  );
};

// Compute centers from the current nodes
function computeNodeCenters(nodes: Array<{ position?: { x: number; y: number } }>) {
  if (!nodes?.length) return { centroid: { x: 0, y: 0 }, bboxCenter: { x: 0, y: 0 } };

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let sx = 0, sy = 0;

  for (const n of nodes) {
    const x = +(n.position?.x ?? 0);
    const y = +(n.position?.y ?? 0);
    sx += x; sy += y;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const centroid = { x: sx / nodes.length, y: sy / nodes.length };
  const bboxCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  return { centroid, bboxCenter };
}

// Centers the nodes by writing align {x,y} so their center lands on the container center
function centerNodesToContainer(opts: {
  id: string;
  nodes: Array<{ position?: { x: number; y: number } }>;
  align: { x: number; y: number; scale: number };
  prefer?: "bbox" | "mean"; // default 'bbox'
  save: (next: { x: number; y: number; scale: number }) => void;
}) {
  const { id, nodes, align, prefer = "bbox", save } = opts;
  const { centroid, bboxCenter } = computeNodeCenters(nodes);
  const c = prefer === "mean" ? centroid : bboxCenter;
  const s = align?.scale ?? 1;
  // In canvas we render: cx + align.x + node.x * align.scale
  // So to place center at cx we need align.x = -center.x * scale
  const next = { x: -c.x * s, y: -c.y * s, scale: s };
  save(next);
}



/* ------- tiny HUD helpers ------- */
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr', alignItems: 'center', gap: 6, marginBottom: 6 }}>
    <div style={{ opacity: 0.8 }}>{label}</div>
    <div style={{ display: 'flex', gap: 6 }}>{children}</div>
  </div>
);
const Num: React.FC<{ value: number; onChange: (n: number) => void; step?: number; width?: number }> = ({ value, onChange, step = 1, width = 70 }) => (
  <input type="number" value={value} step={step} onChange={(e) => onChange(parseFloat(e.target.value || '0'))}
    style={{ width, background: '#0f1220', color: '#eee', border: '1px solid #3a3f5a', borderRadius: 4, padding: '3px 6px' }} />
);
const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...rest }) => (
  <button {...rest}
    style={{ padding: '4px 8px', background: '#2a2f48', color: '#fff', border: '1px solid #4b5070', borderRadius: 4, cursor: 'pointer' }} >
    {children}
  </button>
);

// Small square button
const btnS: React.CSSProperties = {
  padding: '4px 8px',
  background: '#2a2f48',
  color: '#fff',
  border: '1px solid #4b5070',
  borderRadius: 4,
  cursor: 'pointer',
  minWidth: 34,
};

const numInput: React.CSSProperties = {
  width: 80, background: '#0f1220', color: '#eee',
  border: '1px solid #3a3f5a', borderRadius: 4, padding: '3px 6px'
};

/* ------- Wrapper ------- */
const ConstellationCanvas: React.FC<Props> = (props) => (
  <ReactFlowProvider>
    <Inner {...props} />
  </ReactFlowProvider>
);

export default ConstellationCanvas;
