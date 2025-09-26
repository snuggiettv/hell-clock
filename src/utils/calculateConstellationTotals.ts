// src/components/ConstellationCanvas.tsx
import React from 'react';
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge as RFEdge,
  type Node as RFNode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ConstellationNode from './ConstellationNode';

type RGB = { Red: number; Green: number; Blue: number };

type NodeData = {
  label: string;
  sprite?: string;
  isRoot?: boolean;
  isLocked?: boolean;
  isActivated?: boolean;
  isAvailable?: boolean;
  isComplete?: boolean;
  showLabels?: boolean;
  onClick?: () => void;
  onRightClick?: () => void;
  themeColor?: string;
  affixes?: any[];
};

type InitialGraph = {
  nodes: RFNode<NodeData>[];
  edges: RFEdge[];
  blurUrl?: string;
  lineUrl?: string;
  size?: { width: number; height: number };
};

type Props = {
  source: { id: string };
  initialGraph?: InitialGraph;
  is99Lock?: boolean;
};

const nodeTypes = { constellation: ConstellationNode } as const;
const GRAY = '#8ea1b8';

function keyFor(a: string, b: string) {
  const x = String(a), y = String(b);
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

function buildAdj(edges: RFEdge[]) {
  const adj = new Map<string, Set<string>>();
  const seen = new Set<string>();
  for (const e of edges || []) {
    const a = String(e.source), b = String(e.target);
    if (!a || !b || a === b) continue;
    const k = keyFor(a, b);
    if (seen.has(k)) continue;
    seen.add(k);
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  return adj;
}

function bfsReachableFromRoots(active: Set<string>, roots: Set<string>, adj: Map<string, Set<string>>) {
  const seen = new Set<string>();
  const q: string[] = [];
  for (const r of roots) if (active.has(r)) { seen.add(r); q.push(r); }
  while (q.length) {
    const n = q.shift()!;
    for (const nb of adj.get(n) ?? []) {
      if (!active.has(nb)) continue;
      if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
    }
  }
  return seen;
}

const Inner: React.FC<Props> = ({ source, initialGraph, is99Lock }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([]);
  const activeRef = React.useRef<Set<string>>(new Set());
  const rootsRef  = React.useRef<Set<string>>(new Set());
  const adjRef    = React.useRef<Map<string, Set<string>>>(new Map());

  const [blurUrl, setBlurUrl] = React.useState<string>('');
  const [lineUrl, setLineUrl] = React.useState<string>('');
  const [isComplete, setIsComplete] = React.useState(false);

  // align controls (nodes move; art is fixed)
  const [offsetX, setOffsetX] = React.useState(0);
  const [offsetY, setOffsetY] = React.useState(0);
  const [imgScale, setImgScale] = React.useState(1);
  const showLabels = React.useRef<boolean>(true);
  const themeColor = React.useRef<string>('#ffffff');

  // seed graph
  React.useEffect(() => {
    if (!initialGraph) return;

    setBlurUrl(initialGraph.blurUrl || '');
    setLineUrl(initialGraph.lineUrl || '');

    // build nodes with handlers
    const seeded: RFNode<NodeData>[] = (initialGraph.nodes || []).map((n) => ({
      ...n,
      draggable: false,
      data: {
        ...n.data,
        isActivated: false,
        isAvailable: false,
        isLocked: true,
        showLabels: showLabels.current,
        themeColor: themeColor.current,
      },
    }));
    setNodes(seeded);

    // center-to-center edges + gray
    const seen = new Set<string>();
    const E: RFEdge[] = (initialGraph.edges || []).reduce((acc: RFEdge[], e, i) => {
      const a = String(e.source), b = String(e.target);
      if (!a || !b || a === b) return acc;
      const k = keyFor(a, b);
      if (seen.has(k)) return acc;
      seen.add(k);
      acc.push({
        id: e.id ?? `e-${i}-${a}-${b}`,
        source: a,
        target: b,
        sourceHandle: 'a',
        targetHandle: 'a',
        type: 'straight',
        style: { stroke: GRAY, strokeWidth: 2, opacity: 1 },
      } as RFEdge);
      return acc;
    }, []);
    setEdges(E);
    adjRef.current = buildAdj(E);

    // roots: prefer explicit flags
    const explicit = new Set(seeded.filter(n => !!n.data?.isRoot).map(n => n.id));
    let roots = explicit;
    if (roots.size === 0) {
      // fallback: if no explicit roots, pick nodes with degree 0 (isolated) OR the first node
      const deg = new Map<string, number>();
      for (const n of seeded) deg.set(n.id, (adjRef.current.get(n.id) || new Set()).size);
      const iso = seeded.filter(n => (deg.get(n.id) || 0) === 0).map(n => n.id);
      roots = new Set(iso.length ? iso : (seeded[0] ? [seeded[0].id] : []));
    }
    rootsRef.current = roots;

    // make roots available initially
    setNodes(curr => curr.map(n => ({
      ...n,
      data: { ...n.data, isAvailable: roots.has(n.id), isLocked: !roots.has(n.id) }
    })));
  }, [initialGraph, setNodes, setEdges]);

  // apply align to positions whenever offsets/scale change
  const rawRef = React.useRef<Record<string, {x:number;y:number}>>({});
  React.useEffect(() => {
    if (!initialGraph) return;
    const raw: Record<string, {x:number;y:number}> = {};
    for (const n of (initialGraph.nodes || [])) {
      raw[n.id] = { x: n.position?.x || 0, y: n.position?.y || 0 };
    }
    rawRef.current = raw;
    // first layout
    setNodes(arr => arr.map(n => {
      const r = raw[n.id] || {x:0,y:0};
      return { ...n, position: { x: offsetX + r.x * imgScale, y: offsetY + r.y * imgScale } };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGraph]);

  React.useEffect(() => {
    setNodes(arr => arr.map(n => {
      const r = rawRef.current[n.id] || {x:0,y:0};
      return { ...n, position: { x: offsetX + r.x * imgScale, y: offsetY + r.y * imgScale } };
    }));
  }, [offsetX, offsetY, imgScale, setNodes]);

  // recompute visuals + completion
  const recompute = React.useCallback((active: Set<string>) => {
    activeRef.current = new Set(active);
    const complete = nodes.length > 0 && active.size === nodes.length;
    setIsComplete(complete);

    setEdges(curr => curr.map(e => {
      const a = active.has(e.source), b = active.has(e.target);
      const stroke = (a && b) || complete ? '#ffffff' : GRAY;
      return { ...e, style: { ...(e.style||{}), stroke, strokeWidth: 2, opacity: 1 } };
    }));

    setNodes(curr => curr.map(n => {
      const a = active.has(n.id);
      const root = rootsRef.current.has(n.id);
      const nearActive = [...(adjRef.current.get(n.id) || [])].some(nb => active.has(nb));
      const avail = !a && (root || nearActive);
      return {
        ...n,
        data: {
          ...n.data,
          isActivated: a,
          isAvailable: avail,
          isLocked: !a && !avail,
          isComplete: complete,
        }
      };
    }));
  }, [nodes.length, setNodes, setEdges]);

  const activate = React.useCallback((id: string) => {
    setNodes(curr => {
      const active = new Set(activeRef.current);
      if (active.has(id)) return curr;
      // can activate only if available:
      const root = rootsRef.current.has(id);
      const nearActive = [...(adjRef.current.get(id) || [])].some(nb => active.has(nb));
      if (!root && !nearActive) return curr;

      active.add(id);
      setTimeout(() => recompute(active), 0);
      return curr.map(n => n.id === id ? { ...n, data: { ...n.data, isActivated: true } } : n);
    });
  }, [recompute, setNodes]);

  const deactivate = React.useCallback((id: string) => {
    setNodes(curr => {
      const active = new Set(activeRef.current);
      if (!active.has(id)) return curr;

      const isRoot = rootsRef.current.has(id);
      if (isRoot) {
        const remaining = new Set(active); remaining.delete(id);
        const otherRoots = new Set<string>([...rootsRef.current].filter(r => r !== id && remaining.has(r)));
        const keep = bfsReachableFromRoots(remaining, otherRoots, adjRef.current);
        // if any active (non-root) would be lost, block
        let stranded = false;
        for (const nid of remaining) {
          if (rootsRef.current.has(nid)) continue;
          if (!keep.has(nid)) { stranded = true; break; }
        }
        if (stranded) return curr; // guard
        setTimeout(() => recompute(remaining), 0);
        return curr.map(n => n.id === id ? { ...n, data: { ...n.data, isActivated: false } } : n);
      }

      // non-root: remove and keep only nodes reachable from remaining active roots
      active.delete(id);
      const actRoots = new Set<string>([...rootsRef.current].filter(r => active.has(r)));
      const keep = bfsReachableFromRoots(active, actRoots, adjRef.current);
      const finalActive = new Set(keep);
      setTimeout(() => recompute(finalActive), 0);

      return curr.map(n => {
        const a = finalActive.has(n.id);
        return a ? n : { ...n, data: { ...n.data, isActivated: false } };
      });
    });
  }, [recompute, setNodes]);

  // install handlers into node data
  React.useEffect(() => {
    setNodes(curr => curr.map(n => ({
      ...n,
      data: {
        ...n.data,
        onClick: () => activate(n.id),
        onRightClick: () => deactivate(n.id),
      }
    })));
  }, [activate, deactivate, setNodes]);

  // simple art: prefer blur while incomplete; else line
  const artSrc = (!isComplete ? (blurUrl || lineUrl) : (lineUrl || blurUrl)) || '';
  const artVisible = !!artSrc && !is99Lock;

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', background:'#0b0f1c' }}>
      {/* Art underlay */}
      {artVisible && (
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:1 }}>
          <img
            src={artSrc}
            alt=""
            draggable={false}
            style={{
              position:'absolute',
              left:'50%', top:'50%',
              transform:`translate(-50%, -50%)`,
              maxWidth:'100%', maxHeight:'100%',
              objectFit:'contain',
              opacity: isComplete ? 1 : 0.9,
              filter: isComplete ? 'none' : 'brightness(0.95)',
            }}
          />
        </div>
      )}

      {/* Node/edge layer */}
      <div style={{ position:'absolute', inset:0, zIndex:2 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodeOrigin={[0.5, 0.5]}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          translateExtent={[[-10000,-10000],[10000,10000]]}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnDoubleClick={false}
          panOnScroll
          zoomOnScroll
          panOnDrag
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {/* Minimal align controls (optional) */}
      {!is99Lock && (
        <div style={{ position:'absolute', right:10, top:10, zIndex:5, background:'rgba(0,0,0,0.5)', padding:8, borderRadius:8, border:'1px solid #3a3f5a', color:'#cfe1ff', fontSize:12 }}>
          <div style={{ display:'flex', gap:6, marginBottom:6 }}>
            <button onClick={() => setOffsetY(v=>v-1)}>↑</button>
            <button onClick={() => setOffsetX(v=>v-1)}>←</button>
            <button onClick={() => setOffsetX(v=>v+1)}>→</button>
            <button onClick={() => setOffsetY(v=>v+1)}>↓</button>
            <button onClick={() => setImgScale(s=>+(s+0.01).toFixed(2))}>+</button>
            <button onClick={() => setImgScale(s=>+(s-0.01).toFixed(2))}>−</button>
            <button onClick={() => { setOffsetX(0); setOffsetY(0); setImgScale(1); }}>Reset</button>
          </div>
        </div>
      )}
    </div>
  );
};

const ConstellationCanvas: React.FC<Props> = (props) => (
  <ReactFlowProvider>
    <Inner {...props} />
  </ReactFlowProvider>
);

export default ConstellationCanvas;
