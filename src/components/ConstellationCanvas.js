import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/* ConstellationCanvas.tsx
   ALIGN VIEW — art stays still; nodes move.
   - Art is drawn once, centered by *scaled image size*, aspect-preserved (downscale-only).
   - Offsets (x,y) && scale affect NODES ONLY, not the art.
   - Nodes are positioned from container center (0,0), so Align matches Full Map.
   - nodeOrigin = center (no half-node drift)
   - 10% translateExtent + fitView padding so edges never clip.
   - Quick Nudge panel + Alignment HUD (Shift+D) + "Log art URLs".
*/
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, useStore, ReactFlowProvider, } from 'reactflow';
import 'reactflow/dist/style.css';
import ConstellationNode from './ConstellationNode';
const nodeTypes = { constellation: ConstellationNode };
function buildPredecessors(nodes, edges) {
    const preds = new Map();
    for (const n of nodes)
        preds.set(n.id, new Set());
    for (const e of edges) {
        // treat an edge A->B as "B depends on A"
        if (preds.has(e.target))
            preds.get(e.target).add(e.source);
    }
    return preds;
}
function deriveAvailable(nodes, preds, activated) {
    const out = new Set();
    for (const n of nodes) {
        if (activated.has(n.id))
            continue;
        const need = preds.get(n.id);
        if (!need || [...need].every(p => activated.has(p)))
            out.add(n.id);
    }
    return out;
}
function lsKeyProgress(id) {
    return `constellation:${id}:testProgress`;
}
function loadProgress(id) {
    try {
        const raw = localStorage.getItem(lsKeyProgress(id));
        const arr = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(arr) ? arr : []);
    }
    catch {
        return new Set();
    }
}
function saveProgress(id, set) {
    try {
        localStorage.setItem(lsKeyProgress(id), JSON.stringify([...set]));
    }
    catch { }
}
const STORAGE_KEY = (key) => `constellation:${key}:align`;
const HUD_KEY = 'constellationDebugHUD';
const LABELS_KEY = 'constellationShowLabels';
const COLOR_KEY = (key) => `constellation:${key}:color`;
const Inner = ({ source, initialGraph, is99Lock }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const edgesRef = useRef([]);
    const activeRef = useRef(new Set());
    const [blurUrl, setBlurUrl] = useState('');
    const [lineUrl, setLineUrl] = useState('');
    const [isComplete, setIsComplete] = useState(false);
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
    const [themeColor, setThemeColor] = useState('#ffffff');
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
    const translateExtent = useMemo(() => {
        // world is centered at (0,0)
        return [[-W / 2 - PAD_W, -H / 2 - PAD_H], [W / 2 + PAD_W, H / 2 + PAD_H]];
    }, [W, H, PAD_W, PAD_H]);
    // Art presence & control gating
    const artAvailable = !!(blurUrl || lineUrl);
    const controlsEnabled = !is99Lock; // controls allowed even if art is missing
    // soft gray used for unlocked/partial edges && blur
    const GRAY_STROKE = 'rgba(185,205,225,0.65)';
    const GRAY_FILL = 'rgba(185,205,225,0.75)';
    // helpers
    const adjacencyMap = useMemo(() => new Map(), []);
    const rootSet = useRef(new Set());
    // viewport transform (from React Flow)
    const [tx, ty, k] = useStore(s => s.transform);
    // keep raw (untransformed) node positions — so we can recompute positions without losing flags
    const rawPos = useRef({});
    // Reset per constellation
    useEffect(() => {
        setNatW(0);
        setNatH(0);
        setBaseScale(1);
        setBlurLoaded(false);
        setLineLoaded(false);
        rawPos.current = {};
    }, [source.id]);
    // Seed graph (store raw positions; create nodes once)
    useEffect(() => {
        if (!initialGraph)
            return;
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
        const withData = (initialGraph.nodes || []).map((n) => ({
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
        }));
        setNodes(withData);
        // Force center-to-center edges + default gray stroke
        const seededEdges = (initialGraph.edges || []).map((e, i) => ({
            id: e.id ?? `e-${i}-${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            sourceHandle: 'a', // <<< matches <Handle id="a" .../> in ConstellationNode.tsx
            targetHandle: 'a',
            type: 'straight',
            style: { stroke: GRAY_STROKE, strokeWidth: 2, opacity: 1 },
        }));
        setEdges(seededEdges);
        // roots (available) — honor ONLY explicit isRoot;
        // use edge-based fallback ONLY if the JSON has no isRoot at all
        const explicitRoots = new Set(withData
            .filter(n => n.data?.isRoot)
            .map(n => n.id));
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
            if (!adjacencyMap.has(e.source))
                adjacencyMap.set(e.source, new Set());
            if (!adjacencyMap.has(e.target))
                adjacencyMap.set(e.target, new Set());
            adjacencyMap.get(e.source).add(e.target);
            adjacencyMap.get(e.target).add(e.source);
        });
    }, [edges, adjacencyMap]);
    // restore alignment + prefs + keybinds
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY(source.id));
            if (saved) {
                const { x, y, scale } = JSON.parse(saved);
                if (typeof x === 'number')
                    setOffsetX(x);
                if (typeof y === 'number')
                    setOffsetY(y);
                if (typeof scale === 'number')
                    setImgScale(scale);
            }
        }
        catch { }
        setShowHUD(localStorage.getItem(HUD_KEY) === '1');
        setShowLabels(localStorage.getItem(LABELS_KEY) === '1');
        // load saved tint color (per constellation)
        try {
            const savedColor = localStorage.getItem(COLOR_KEY(source.id));
            if (savedColor)
                setThemeColor(savedColor);
        }
        catch { }
        const onKey = (e) => {
            // Shift+D toggles HUD (only if alignmentEnabled)
            if (e.key.toLowerCase() === 'd' && e.shiftKey && controlsEnabled) {
                setShowHUD(prev => {
                    const next = !prev;
                    localStorage.setItem(HUD_KEY, next ? '1' : '0');
                    return next;
                });
            }
            // L toggles labels
            if (e.key.toLowerCase() === 'l') {
                setShowLabels(prev => {
                    const next = !prev;
                    localStorage.setItem(LABELS_KEY, next ? '1' : '0');
                    setNodes(curr => curr.map(n => ({ ...n, data: { ...n.data, showLabels: next } })));
                    return next;
                });
            }
            if (!controlsEnabled)
                return;
            const step = (e.shiftKey ? 5 : 1) * nudge;
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                if (e.key === 'ArrowLeft')
                    setOffsetX(v => v - step);
                if (e.key === 'ArrowRight')
                    setOffsetX(v => v + step);
                if (e.key === 'ArrowUp')
                    setOffsetY(v => v - step);
                if (e.key === 'ArrowDown')
                    setOffsetY(v => v + step);
            }
            if (e.key === '=' || e.key === '+')
                setImgScale(s => +(s + scaleStep).toFixed(4));
            if (e.key === '-')
                setImgScale(s => +(s - scaleStep).toFixed(4));
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
        if (!controlsEnabled)
            return;
        try {
            localStorage.setItem(STORAGE_KEY(source.id), JSON.stringify({ x: offsetX, y: offsetY, scale: imgScale }));
        }
        catch { }
    }, [controlsEnabled, offsetX, offsetY, imgScale, source.id]);
    // When offset/scale change, recompute node positions (ART DOES NOT MOVE)
    useEffect(() => {
        applyAlign();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offsetX, offsetY, imgScale]);
    // ------- Unlock recomputation -------
    // Fallback: build incoming requirements map on the fly (when incomingRef is unavailable)
    function __buildIncomingOnTheFly(nodesArr, edgesArr) {
        const ids = new Set(nodesArr.map((n) => n.id));
        const m = new Map();
        for (const e of edgesArr || []) {
            if (!ids.has(e.source) || !ids.has(e.target))
                continue;
            const ptuRaw = e?.data?.pointsToUnlock;
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
    const recompute = (seedActive) => {
        // Build finalActive by keeping only nodes connected to at least one ACTIVE root
        const finalActive = new Set();
        const q = [];
        // Seed queue with active roots
        for (const id of seedActive) {
            if (rootSet.current.has(id)) {
                finalActive.add(id);
                q.push(id);
            }
        }
        // BFS across ACTIVE edges only (treat graph as undirected)
        while (q.length) {
            const u = q.shift();
            const nbrs = adjacencyMap.get(u) || new Set();
            for (const v of nbrs) {
                if (!seedActive.has(v) || finalActive.has(v))
                    continue; // must already be active to stay
                finalActive.add(v);
                q.push(v);
            }
        }
        // Update nodes and edges based on finalActive, and compute availability
        setNodes((curr) => {
            const total = curr.length;
            const done = finalActive.size === total && total > 0;
            setIsComplete(done);
            try {
                localStorage.setItem(`constellation:${source.id}:complete`, done ? '1' : '0');
            }
            catch { }
            // Edge coloring: bright when both endpoints are active (or all complete)
            setEdges((currEdges) => currEdges.map((e) => {
                const a = finalActive.has(e.source);
                const b = finalActive.has(e.target);
                const stroke = done || (a && b) ? (themeColor || '#ffffff') : GRAY_STROKE;
                return { ...e, style: { ...(e.style || {}), stroke, strokeWidth: 2, opacity: 1 } };
            }));
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
    const handleActivate = (id) => {
        setNodes((curr) => {
            const me = curr.find((n) => n.id === id);
            // must be available (and not already active)
            if (!me || me.data?.isActivated || !me.data?.isAvailable)
                return curr;
            const desired = new Set(Array.from(activeRef.current));
            desired.add(id);
            // optional optimistic flip; recompute will cascade correctness
            const next = curr.map((n) => n.id === id
                ? { ...n, data: { ...n.data, isActivated: true, isLocked: false, isAvailable: false } }
                : n);
            setTimeout(() => recompute(desired), 0);
            return next;
        });
    };
    const handleDeactivate = (id) => {
        setNodes((curr) => {
            const desired = new Set(Array.from(activeRef.current));
            if (!desired.has(id))
                return curr;
            desired.delete(id);
            const next = curr.map((n) => n.id === id
                ? { ...n, data: { ...n.data, isActivated: false, isAvailable: rootSet.current.has(n.id) } }
                : n);
            setTimeout(() => recompute(desired), 0);
            return next;
        });
    };
    // ------- Fit-to-container (aspect preserved) — ART ONLY -------
    const updateBaseScale = (nw, nh) => {
        if (!nw || !nh)
            return;
        setNatW(nw);
        setNatH(nh);
        // contain + only scale down (never up)
        const s = Math.min(W / nw, H / nh, 1);
        setBaseScale(Number.isFinite(s) && s > 0 ? s : 1);
    };
    const onBlurLoad = (e) => {
        setBlurLoaded(true);
        updateBaseScale(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
    };
    const onLineLoad = (e) => {
        setLineLoaded(true);
        updateBaseScale(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
    };
    // ---------- ART TRANSFORM (fixed, centered by *scaled* size) ----------
    const viewportTf = useMemo(() => `matrix(${k},0,0,${k},${tx},${ty})`, [k, tx, ty]);
    const artCenterTf = useMemo(() => {
        const tw = scaledW || W; // fallback to container while natural size not known
        const th = scaledH || H;
        return `translate(${-tw / 2}px, ${-th / 2}px) scale(${baseScale || 1})`;
    }, [scaledW, scaledH, W, H, baseScale]);
    // shared <img> styles
    const imgStyle = {
        position: 'absolute',
        left: 0,
        top: 0,
        transformOrigin: '0 0',
        pointerEvents: 'none',
    };
    const useTint = (themeColor || '').toLowerCase() !== '#ffffff';
    // ---------- APPLY ALIGN TO NODES (ONLY) ----------
    function applyAlign(seed) {
        // Nodes live around world (0,0) == art center.
        // position = offset + raw * imgScale
        const upd = (arr) => arr.map(n => {
            const p = rawPos.current[n.id] || { x: n.position?.x || 0, y: n.position?.y || 0 };
            const nx = Math.round(offsetX + p.x * imgScale);
            const ny = Math.round(offsetY + p.y * imgScale);
            return { ...n, position: { x: nx, y: ny } };
        });
        if (seed) {
            setNodes(upd(seed));
        }
        else {
            setNodes((curr) => upd(curr));
        }
    }
    // Quick Nudge helpers (respect Shift for coarse)
    const nudgeBy = (dx, dy, ev) => {
        const mult = ev?.shiftKey ? 5 : 1;
        if (dx)
            setOffsetX(v => v + dx * nudge * mult);
        if (dy)
            setOffsetY(v => v + dy * nudge * mult);
    };
    const scaleBy = (delta, ev) => {
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
    const handleCenterNodes = (prefer = 'bbox') => {
        const rawList = Object.values(rawPos.current || {}).map(p => ({ position: { x: p.x, y: p.y } }));
        const { centroid, bboxCenter } = computeNodeCenters(rawList);
        const c = prefer === 'mean' ? centroid : bboxCenter;
        const s = imgScale || 1;
        setOffsetX(-(c.x) * s);
        setOffsetY(-(c.y) * s);
    };
    return (_jsxs("div", { style: { width: '100vw', height: '100vh', position: 'relative', background: '#0b0d1a' }, children: [_jsx("div", { style: {
                    position: 'absolute',
                    inset: 0,
                    transform: viewportTf,
                    transformOrigin: '0 0',
                    pointerEvents: 'none',
                    zIndex: 1,
                }, children: _jsxs("div", { style: { transform: artCenterTf, transformOrigin: '0 0', position: 'relative' }, children: [blurUrl && (_jsx("img", { src: blurUrl, alt: "blur", onLoad: onBlurLoad, onError: () => setBlurLoaded(false), style: { ...imgStyle, opacity: 0, display: blurLoaded ? 'block' : 'none' } })), lineUrl && (_jsx("img", { src: lineUrl, alt: "line", onLoad: onLineLoad, onError: () => setLineLoaded(false), style: { ...imgStyle, opacity: 0, display: lineLoaded ? 'block' : 'none' } })), !isComplete && blurUrl && (_jsx("div", { style: {
                                position: 'absolute', left: 0, top: 0,
                                width: natW || '100%', height: natH || '100%',
                                transformOrigin: '0 0',
                                background: 'rgba(185,205,225,0.75)', // GRAY_FILL
                                WebkitMaskImage: `url(${blurUrl})`, maskImage: `url(${blurUrl})`,
                                WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center', maskPosition: 'center',
                                WebkitMaskSize: 'contain', maskSize: 'contain',
                                opacity: 0.9, zIndex: 0, pointerEvents: 'none',
                                filter: 'brightness(0.95)',
                            } })), isComplete && lineUrl && (_jsx("div", { style: {
                                position: 'absolute', left: 0, top: 0,
                                width: natW || '100%', height: natH || '100%',
                                transformOrigin: '0 0',
                                background: themeColor || '#ffffff', // constellation tint
                                WebkitMaskImage: `url(${lineUrl})`, maskImage: `url(${lineUrl})`,
                                WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center', maskPosition: 'center',
                                WebkitMaskSize: 'contain', maskSize: 'contain',
                                zIndex: 2, pointerEvents: 'none',
                                filter: 'drop-shadow(0 0 12px rgba(255,255,255,.35))',
                            } }))] }) }), _jsx("div", { style: { position: 'relative', zIndex: 2, width: '100%', height: '100%' }, children: _jsxs(ReactFlow, { nodes: nodes, edges: edges, onNodesChange: onNodesChange, onEdgesChange: onEdgesChange, nodeTypes: nodeTypes, fitView: true, fitViewOptions: { padding: 0.2 }, translateExtent: translateExtent, nodeOrigin: [0.5, 0.5], nodesDraggable: false, nodesConnectable: false, elementsSelectable: false, zoomOnDoubleClick: false, onPaneContextMenu: (e) => e.preventDefault(), panOnScroll: true, zoomOnScroll: true, panOnDrag: true, children: [_jsx(Background, {}), _jsx(Controls, {})] }) }), controlsEnabled && !showHUD && (_jsxs("div", { style: {
                    position: 'absolute', right: 120, top: 10, zIndex: 4,
                    background: 'rgba(0,0,0,0.70)', padding: 10, borderRadius: 8,
                    color: '#eee', fontSize: 12, width: 600, border: '1px solid #3a3f5a'
                }, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: 6 }, children: "Quick Nudge" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, justifyItems: 'center' }, children: [_jsx("button", { title: "Up (Shift = \u00D75)", onMouseDown: (e) => nudgeBy(0, -1, e), style: btnS, children: "\u2191" }), _jsx("div", {}), _jsx("button", { title: "Scale + (Shift = \u00D75)", onMouseDown: (e) => scaleBy(+1, e), style: btnS, children: "+" }), _jsx("button", { title: "Left (Shift = \u00D75)", onMouseDown: (e) => nudgeBy(-1, 0, e), style: btnS, children: "\u2190" }), _jsx("button", { title: "Right (Shift = \u00D75)", onMouseDown: (e) => nudgeBy(+1, 0, e), style: btnS, children: "\u2192" }), _jsx("button", { title: "Scale \u2212 (Shift = \u00D75)", onMouseDown: (e) => scaleBy(-1, e), style: btnS, children: "\u2212" }), _jsx("button", { title: "Down (Shift = \u00D75)", onMouseDown: (e) => nudgeBy(0, +1, e), style: btnS, children: "\u2193" }), _jsx("div", {}), _jsx("button", { title: "Reset scale", onMouseDown: () => setImgScale(1), style: btnS, children: "1\u00D7" })] }), _jsxs("div", { style: { marginTop: 8, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 6, alignItems: 'center' }, children: [_jsx("span", { style: { opacity: 0.8 }, children: "nudge" }), _jsx("input", { type: "number", value: nudge, step: 1, onChange: (e) => setNudge(parseFloat(e.target.value || '0')), style: numInput }), _jsx("span", { style: { opacity: 0.8 }, children: "scale step" }), _jsx("input", { type: "number", value: scaleStep, step: 0.001, onChange: (e) => setScaleStep(parseFloat(e.target.value || '0.001')), style: numInput })] }), _jsxs("div", { style: { display: 'flex', gap: 6, marginTop: 8 }, children: [_jsx(Btn, { onClick: () => {
                                    setOffsetX(Math.round(offsetX / snapGrid) * snapGrid);
                                    setOffsetY(Math.round(offsetY / snapGrid) * snapGrid);
                                }, children: "Snap offsets" }), _jsx(Btn, { onClick: () => { setOffsetX(0); setOffsetY(0); setImgScale(1); }, children: "Reset" }), _jsx(Btn, { onClick: () => handleCenterNodes('bbox'), title: "Place nodes' BBOX center at container center", children: "Center nodes" }), _jsx(Btn, { onClick: () => handleCenterNodes('mean'), title: "Use arithmetic-mean center (ignores shape width/height)", children: "Center (mean)" }), _jsx(Btn, { onClick: () => {
                                    try {
                                        localStorage.setItem(STORAGE_KEY(source.id), JSON.stringify({ x: offsetX, y: offsetY, scale: imgScale }));
                                    }
                                    catch { }
                                }, children: "Save" }), _jsx(Btn, { onClick: () => {
                                    try {
                                        const raw = localStorage.getItem(STORAGE_KEY(source.id));
                                        if (!raw)
                                            return;
                                        const { x, y, scale } = JSON.parse(raw);
                                        if (typeof x === 'number')
                                            setOffsetX(x);
                                        if (typeof y === 'number')
                                            setOffsetY(y);
                                        if (typeof scale === 'number')
                                            setImgScale(scale);
                                    }
                                    catch { }
                                }, children: "Load" }), _jsx(Btn, { onClick: () => setShowHUD(false), children: "Close" }), _jsx(Btn, { onClick: logArtPaths, title: "Log the exact art URLs, sizes && align to the console", children: "Log art URLs" })] }), _jsx("div", { style: { marginTop: 8 }, children: _jsxs("label", { style: { display: 'inline-flex', gap: 6, alignItems: 'center' }, children: [_jsx("span", { style: { opacity: 0.8 }, children: "color" }), _jsx("input", { type: "color", value: themeColor, onChange: (e) => {
                                        const v = e.target.value || '#ffffff';
                                        setThemeColor(v);
                                        try {
                                            localStorage.setItem(COLOR_KEY(source.id), v);
                                        }
                                        catch { }
                                    }, style: { width: 48, height: 24, background: 'transparent', border: '1px solid #3a3f5a', borderRadius: 4 } })] }) }), _jsx("div", { style: { marginTop: 8 }, children: _jsxs("label", { style: { display: 'inline-flex', gap: 6, alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", checked: showLabels, onChange: (e) => {
                                        const next = e.target.checked;
                                        setShowLabels(next);
                                        localStorage.setItem(LABELS_KEY, next ? '1' : '0');
                                        setNodes(curr => curr.map(n => ({ ...n, data: { ...n.data, showLabels: next } })));
                                    } }), "Show labels (L)"] }) })] })), is99Lock && (_jsx("div", { style: {
                    position: 'absolute', right: 10, top: 10, zIndex: 4,
                    background: 'rgba(0,0,0,0.6)', color: '#ffb',
                    padding: '6px 8px', border: '1px solid #665', borderRadius: 6, fontSize: 12
                }, children: "99-lock: alignment disabled" })), !is99Lock && !artAvailable && (_jsx("div", { style: {
                    position: 'absolute', right: 10, top: 10, zIndex: 4,
                    background: 'rgba(0,0,0,0.45)', color: '#cfe',
                    padding: '6px 8px', border: '1px solid #355', borderRadius: 6, fontSize: 12
                }, children: "No art for this constellation \u2014 controls still active" }))] }));
};
// Compute centers from the current nodes
function computeNodeCenters(nodes) {
    if (!nodes?.length)
        return { centroid: { x: 0, y: 0 }, bboxCenter: { x: 0, y: 0 } };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let sx = 0, sy = 0;
    for (const n of nodes) {
        const x = +(n.position?.x ?? 0);
        const y = +(n.position?.y ?? 0);
        sx += x;
        sy += y;
        if (x < minX)
            minX = x;
        if (x > maxX)
            maxX = x;
        if (y < minY)
            minY = y;
        if (y > maxY)
            maxY = y;
    }
    const centroid = { x: sx / nodes.length, y: sy / nodes.length };
    const bboxCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    return { centroid, bboxCenter };
}
// Centers the nodes by writing align {x,y} so their center lands on the container center
function centerNodesToContainer(opts) {
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
const Row = ({ label, children }) => (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '92px 1fr', alignItems: 'center', gap: 6, marginBottom: 6 }, children: [_jsx("div", { style: { opacity: 0.8 }, children: label }), _jsx("div", { style: { display: 'flex', gap: 6 }, children: children })] }));
const Num = ({ value, onChange, step = 1, width = 70 }) => (_jsx("input", { type: "number", value: value, step: step, onChange: (e) => onChange(parseFloat(e.target.value || '0')), style: { width, background: '#0f1220', color: '#eee', border: '1px solid #3a3f5a', borderRadius: 4, padding: '3px 6px' } }));
const Btn = ({ children, ...rest }) => (_jsx("button", { ...rest, style: { padding: '4px 8px', background: '#2a2f48', color: '#fff', border: '1px solid #4b5070', borderRadius: 4, cursor: 'pointer' }, children: children }));
// Small square button
const btnS = {
    padding: '4px 8px',
    background: '#2a2f48',
    color: '#fff',
    border: '1px solid #4b5070',
    borderRadius: 4,
    cursor: 'pointer',
    minWidth: 34,
};
const numInput = {
    width: 80, background: '#0f1220', color: '#eee',
    border: '1px solid #3a3f5a', borderRadius: 4, padding: '3px 6px'
};
/* ------- Wrapper ------- */
const ConstellationCanvas = (props) => (_jsx(ReactFlowProvider, { children: _jsx(Inner, { ...props }) }));
export default ConstellationCanvas;
