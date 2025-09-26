// src/components/FullMap.tsx
import * as React from 'react';
import { parseGroupToGraph } from '../constellations/parseGroup';
import './ConstellationNode.css';
import DevotionOverlay from './DevotionOverlay';
import MapNodeTooltip, { TipData } from './MapNodeTooltip';
import MapTooltipPanel from './MapTooltipPanel';
import MapStatSummary from './MapStatSummary';
import { extractConstellationAffixes, ConstellationAffixRow } from '../utils/extractConstellationAffixes';
import { aggregateTotals, AffixRow as AggRow } from '../utils/aggregateTotals';
import { materializeAffixLine, fmtValueForPattern as fmtValueForPatternShared } from '../utils/materializeAffixLine';
import { effectiveValue } from '../utils/calculateCumulativeValue'

/* ---------- Types ---------- */
type RGB = { Red: number; Green: number; Blue: number };
type ActiveMap = Map<string, Set<string>>;

interface NodeEntry {
  id: string;
  position: { x: number; y: number };
  isRoot?: boolean;
  label?: string; // used to detect Fury/Discipline/Faith on The Three Marys
}
interface Entry {
  id: string;   // slug id
  label: string;
  group: any;   // raw group from master JSON
  lineUrl?: string;
  blurUrl?: string;
  size: { width: number; height: number };
  nodes: NodeEntry[];
  edges: Array<{ source: string; target: string }>;
}
type RequirementsMap = Record<string, { name?: string; requirements: Partial<RGB> }>;
type Placements = Record<string, { x: number; y: number; scale: number; rotation?: number }>;

/* ---------- Assets / layout ---------- */
const HEADER_URL = `${import.meta.env.BASE_URL}ui/letterbox-header.png`;
const FOOTER_URL = `${import.meta.env.BASE_URL}ui/letterbox-footer.png`;
const BG_URL     = `${import.meta.env.BASE_URL}ui/map-bg.png`;
const LETTERBOX  = { HEADER_H: 110, FOOTER_H: 104, SIDE_PAD: -25 };

// ---- Tooltip presets ----

const reqSatisfied = (need? : RGB, have?: RGB) =>
  !!need && (['Red','Green','Blue'] as const).every(k => (have?.[k] ?? 0) >= (need[k] ?? 0));


const OFFSETS_DEFAULT = {
  headerTop: 32,
  iconTop: 130,
  subtitleTop: 255,
  bodyLeft: 18,
  bodyRight: 18,
  bodyBottom: 45,
};

const OFFSETS_MARYS = {
  headerTop: 30,
  iconTop: 136,
  subtitleTop: 250,
  bodyLeft: 18,
  bodyRight: 18,
  bodyBottom: 125,
};

const isMarysTitle = (t?: string) => /three\s*marys?|tres\s*marias/i.test(t ?? '');

const GRAY_FILL = 'rgba(185,205,225,0.75)';
const MAX_K = 4;
const PAD_X = 160;
const FOCUS_DELAY = 250;
const FOCUS_DUR = 1500;
const INITIAL_ZOOM_RATIO = 0.2;

/* ---------- Storage keys ---------- */
const COLOR_KEY    = (id: string) => `constellation:${id}:color`;
const COMPLETE_KEY = (id: string) => `constellation:${id}:complete`;
const ALIGN_KEY    = (id: string) => `constellation:${id}:align`;
const ACTIVE_NODES_KEY = (slug: string) => `constellation:${slug}:activeNodes`; // Marys per-node

/* ---------- Data URLs ---------- */
const getMasterUrl       = () => `${import.meta.env.BASE_URL}data/Constellations.json`;
const getPlacementsUrl   = () => `${import.meta.env.BASE_URL}data/constellation-transforms.json`;
const getRequirementsUrl = () => `${import.meta.env.BASE_URL}data/constellation-requirements.json`;

/* ---------- Helpers (no hooks here) ---------- */

// Helper: apply override text (by statKey or pattern) — with multi-value support
function materializeRowWithOverrides(
  row: ConstellationAffixRow,
  overrides: Record<string, string>
) {
  const statKey = (row as any).statKey ? String((row as any).statKey).trim() : '';
  const basePattern = row.pattern || '';
  const pattern = (statKey && overrides[statKey]) || overrides[basePattern] || basePattern;

  // Assume full rank in the Map view; if you later track per-node rank, feed it here
  const rank = 5;

  const num = (v: any) => Number(v ?? 0);
  const scaled = (vKey: string, perKey: string) => effectiveValue({
    rank,
    value: num((row as any)[vKey]),
    valuePerLevel: num((row as any)[perKey]),
  });

  // Build payload with multiple value slots so longer patterns fill correctly
  const payload: any = { pattern, statKey };

  if (Array.isArray((row as any).rawNumbers)) {
    payload.rawNumbers = (row as any).rawNumbers;
  }

  // value / valuePerLevel
  if ('value' in (row as any) || 'valuePerLevel' in (row as any)) {
    payload.value = scaled('value', 'valuePerLevel');
  }

  // value2/value3/value4 (+ per level)
  for (let i = 2; i <= 4; i++) {
    const vKey = `value${i}`;
    const pKey = `value${i}PerLevel`;
    if (vKey in (row as any) || pKey in (row as any)) {
      payload[vKey] = scaled(vKey, pKey);
    }
  }

  // Common extra fields referenced by patterns
  for (const k of ['duration', 'cooldown', 'chance', 'stacks', 'radius']) {
    if ((row as any)[k] != null) payload[k] = num((row as any)[k]);
  }

  return materializeAffixLine(payload, overrides);
}

// Helper: load override strings from /public/data/affix-overrides.json
function useAffixOverrides() {
  const [affixOverrides, setAffixOverrides] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/affix-overrides.json`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (alive && json && typeof json === 'object') setAffixOverrides(json);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  return affixOverrides;
}

const slugify = (s: string) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const englishName = (def: any): string => {
  const arr = (def?.nameLocalizationKey ?? def?.nameKey) as any[];
  const en = Array.isArray(arr) ? arr.find(k => k?.langCode === 'en')?.langTranslation : undefined;
  if (en) return String(en).trim();
  const raw = String(def?.name || '').trim();
  const cleaned = raw.replace(/\s*-\s*Constellation\s+Definition$/i, '').trim();
  return cleaned || String(def?.id ?? 'Unnamed');
};

const normalizeHex = (v: string) =>
  (v || '').trim().startsWith('#') ? (v || '').trim() : `#${(v || '').trim()}`;

const loadColor = (id: string, fallback = '#ffffff') => {
  try {
    const v = localStorage.getItem(COLOR_KEY(id));
    if (v && /^(#)?[0-9a-fA-F]{3,8}$/.test(v.trim())) return normalizeHex(v);
  } catch {}
  return fallback;
};

const isComplete = (slug: string) => {
  try { return localStorage.getItem(COMPLETE_KEY(slug)) === '1'; } catch { return false; }
};

const meets = (h: RGB, n?: Partial<RGB>) =>
  !n || (h.Red >= (n.Red||0) && h.Green >= (n.Green||0) && h.Blue >= (n.Blue||0));

const missingText = (h: RGB, n?: Partial<RGB>) => {
  if (!n) return '';
  const miss:string[]=[]; const d=(x:number,y?:number)=>Math.max(0,(y??0)-x);
  const r=d(h.Red,n.Red), g=d(h.Green,n.Green), b=d(h.Blue,n.Blue);
  if (r) miss.push(`Fury +${r}`); if (g) miss.push(`Discipline +${g}`); if (b) miss.push(`Faith +${b}`);
  return miss.join(' • ');
};

const loadAlign = (id: string) => {
  try {
    const raw = localStorage.getItem(ALIGN_KEY(id)); if (!raw) return { x:0,y:0,scale:1 };
    const j=JSON.parse(raw); return { x:+j?.x||0, y:+j?.y||0, scale:+j?.s||+j?.scale||1 };
  } catch { return { x:0,y:0,scale:1 }; }
};

const pickSize = (pg:any)=> pg?.size?.width&&pg?.size?.height
  ? {width:+pg.size.width,height:+pg.size.height}
  : pg?.container?.width&&pg?.container?.height
    ? {width:+pg.container.width,height:+pg.container.height}
    : pg?.width&&pg?.height ? {width:+pg.width,height:+pg.height} : {width:500,height:500};

const placementFor = (e:Entry,map:Placements)=>
  map[e.id] || map[String(e.group?.definition?.id ?? '')] || {x:0,y:0,scale:1,rotation:0};

/* ---------- Affixes / tooltip helpers ---------- */

// Build a map { nodeId -> rows[] }
function buildAffixIndex(rows: ConstellationAffixRow[]): Map<string, ConstellationAffixRow[]> {
  const m = new Map<string, ConstellationAffixRow[]>();
  for (const r of rows) {
    const k = String((r as any).nodeId ?? '');
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

/** Loads affixes once, returns an index map. */
function useAffixIndex(): Map<string, ConstellationAffixRow[]> {
  const [idx, setIdx] = React.useState<Map<string, ConstellationAffixRow[]>>(new Map());

  React.useEffect(() => {
    let alive = true;

    // 1) Try injected data first (fast path), but only if it exists
    const injected = (window as any).__CONSTELLATIONS_JSON__;
    if (injected && typeof injected === 'object') {
      try {
        const rows = extractConstellationAffixes(injected) || [];
        if (rows.length && alive) {
          setIdx(buildAffixIndex(rows));
          return () => { alive = false; };
        }
      } catch (err) {
        console.warn('[useAffixIndex] injected extract failed:', err);
      }
    }

    // 2) Fallback: fetch master JSON and extract
    (async () => {
      try {
        const res = await fetch(getMasterUrl(), { cache: 'no-store' });
        const json = await res.json();
        const rows = extractConstellationAffixes(json) || [];
        if (alive) setIdx(buildAffixIndex(rows));
      } catch (err) {
        console.warn('[useAffixIndex] fetch/extract failed:', err);
        if (alive) setIdx(new Map());
      }
    })();

    return () => { alive = false; };
  }, []);

  return idx;
}

function fmtValueForPattern(value: number | null | undefined, pattern: string): string {
  return fmtValueForPatternShared(value, pattern);
}

function materializeLine(pattern: string, value?: number | null, valuePerLevel?: number | null) {
  return materializeAffixLine({ pattern, value, valuePerLevel });
}

// Keys look like "<definition.id>:<node.name or node.id>"
function keyCandidates(g: any, n: any): string[] {
  const defId = String(g.group?.definition?.id ?? '');
  const slug  = String(g.id ?? '');
  const label = String(n.label ?? '').trim();
  const nodeId = String(n.id ?? '').trim();

  const nameish: string[] = [];
  if (label) nameish.push(label, label.toLowerCase());
  if (nodeId) nameish.push(nodeId, nodeId.toLowerCase());

  const keys: string[] = [];
  for (const nm of nameish) if (defId) keys.push(`${defId}:${nm}`);
  for (const nm of nameish) if (slug)  keys.push(`${slug}:${nm}`);
  return Array.from(new Set(keys));
}

function lookupAffixes(idx: Map<string, any[]>, g: any, n: any) {
  const byId = idx.get(String(n?.id ?? ''));
  if (byId && byId.length) return { key: String(n.id), rows: byId };
  for (const k of keyCandidates(g, n)) {
    const rows = idx.get(k);
    if (rows && rows.length) return { key: k, rows };
  }
  return { key: null as string | null, rows: [] as any[] };
}

const ICON_BASE = `${import.meta.env.BASE_URL}ui/`;

function isMaryConstellation(e: Entry): boolean {
  const label = String(e?.label || '').toLowerCase();
  const defName = String(e?.group?.definition?.name || '').toLowerCase();
  // Accept both English and Spanish naming
  return /three\s*marys?/.test(label) || /tres\s*marias/.test(label) ||
         /three\s*marys?/.test(defName) || /tres\s*marias/.test(defName);
}

function extractIconKeyFromRow(r: any): string | undefined {
  for (const k of Object.keys(r)) {
    if (/icon|sprite/i.test(k) && typeof r[k] === 'string' && r[k]) return String(r[k]);
  }
  return undefined;
}

function iconKeyFromAffixes(affixes: any[]): string | undefined {
  for (const a of affixes) {
    const key = extractIconKeyFromRow(a);
    if (key) return key;
  }
  return undefined;
}

function iconUrlForUrl(affixes: any[]): string | undefined {
  const key = iconKeyFromAffixes(affixes);
  return key ? `${ICON_BASE}${key}.png` : undefined;
}

/* ---------- Viewport math ---------- */
function clampCentered(
  v:{k:number;x:number;y:number}, vw:number, vh:number, worldW:number, worldH:number,
  minK:number, maxK:number, padX:number
){
  const k = Math.max(minK, Math.min(maxK, v.k));
  const slackX = vw - worldW * k;
  const slackY = vh - worldH * k;
  const x = slackX >= 2*padX ? Math.round(slackX/2) : Math.min(0, Math.max(Math.min(0, slackX), v.x));
  const y = Math.min(0, Math.max(Math.min(0, slackY), v.y));
  return {k,x,y};
}
const easeInOutCubic=(t:number)=> t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
function animateTo(set:(v:any)=>void, get:()=>any, el:HTMLDivElement, to:any,
  worldW:number, worldH:number, minK:number, maxK:number, padX:number, dur=1500){
  const start=performance.now(), from=get(); let raf=0;
  const tick=(now:number)=>{
    const vw=el.clientWidth, vh=el.clientHeight;
    const t=Math.min(1,(now-start)/dur), e=easeInOutCubic(t);
    const v={k:from.k+(to.k-from.k)*e, x:from.x+(to.x-from.x)*e, y:from.y+(to.y-from.y)*e};
    set(clampCentered(v, vw, vh, worldW, worldH, minK, maxK, padX));
    if(t<1) raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick); return ()=>cancelAnimationFrame(raf);
}

/* ---------- Topology / unlock helpers (test mode) ---------- */
function buildAdj(nodes: NodeEntry[], edges: Entry['edges']): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) { const a=String(e.source), b=String(e.target); adj.get(a)?.add(b); adj.get(b)?.add(a); }
  return adj;
}
function inferRoots(nodes: NodeEntry[], edges: Entry['edges']): Set<string> {
  const explicit = nodes.filter(n => n.isRoot).map(n => n.id);
  if (explicit.length) return new Set(explicit);
  const indeg = new Map<string, number>(nodes.map(n => [n.id, 0]));
  for (const e of edges) indeg.set(String(e.target), (indeg.get(String(e.target)) ?? 0) + 1);
  const roots = nodes.filter(n => (indeg.get(n.id) ?? 0) === 0).map(n => n.id);
  return new Set(roots);
}
function deriveAvailable(nodes: NodeEntry[], adj: Map<string, Set<string>>, active: Set<string>, roots: Set<string>): Set<string> {
  const out = new Set<string>();
  if (active.size === 0) { for (const r of roots) out.add(r); return out; }
  for (const n of nodes) {
    if (active.has(n.id)) continue;
    if (roots.has(n.id)) { out.add(n.id); continue; }
    const anyNeighborActive = [...(adj.get(n.id) ?? [])].some(p => active.has(p));
    if (anyNeighborActive) out.add(n.id);
  }
  return out;
}
function cascadeDeactivate(startId: string, adj: Map<string, Set<string>>, active: Set<string>, roots: Set<string>) {
  active.delete(startId);
  const keep = new Set<string>();
  const q: string[] = [...roots].filter(r => active.has(r));
  if (q.length === 0) { active.clear(); return; }
  for (const r of q) keep.add(r);
  while (q.length) {
    const u = q.shift()!;
    for (const v of adj.get(u) ?? []) {
      if (active.has(v) && !keep.has(v)) { keep.add(v); q.push(v); }
    }
  }
  for (const id of Array.from(active)) if (!keep.has(id)) active.delete(id);
}

/* ---------- Art visibility ---------- */
const isWIP = (id: string, label?: string) =>
  /^wip[_-]/i.test(id) || /^wip[_-]/i.test((label ?? ''));

function reqFor(entry: Entry, reqs: RequirementsMap) {
  const defId = String(entry.group?.definition?.id ?? '');
  const bySlug = reqs[entry.id];
  const byDef  = reqs[defId];
  const byName = reqs[englishName(entry.group?.definition)];
  return bySlug ?? byDef ?? byName ?? null;
}

/* ============================================================
   Component
============================================================ */

// ---- layout constants ----
const PANEL_W = 380; // MapStatSummary width
const PANEL_MARGIN = 0; // outer margin
const RIGHT_SAFE = PANEL_W + PANEL_MARGIN + 16; // reserved gutter width for panel + inner padding
export default function FullMap(){
  /* ---------- URL flags ---------- */
  const qs = React.useMemo(() => new URLSearchParams(window.location.search), []);
  const isPreview = qs.get('map') === '1' || qs.get('tab') === 'map';
  const editMode  = qs.get('edit') === '1' || (import.meta.env.DEV && qs.get('edit') === '1');
  const testModeEnabled = isPreview || editMode;

  /* ---------- State ---------- */
  const [entries,setEntries]=React.useState<Entry[]>([]);
  const [placements,setPlacements]=React.useState<Placements>({});
  const [colorMap,setColorMap]=React.useState<Record<string,string>>({});
  const [reqs,setReqs]=React.useState<RequirementsMap>({});
  const [devotion,setDevotion]=React.useState<RGB>({Red:0,Green:0,Blue:0});
  const [tip, setTip] = React.useState<TipData | null>(null);
  const [summaryConstId, setSummaryConstId] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState<{ cid: string; nid: string } | null>(null);

  // preview/test active nodes per constellation
  const [testActive, setTestActive] = React.useState<ActiveMap>(() => new Map());

  /* ---------- Refs ---------- */
  const contentRef=React.useRef<HTMLDivElement>(null);
  const wrapRef=React.useRef<HTMLDivElement>(null);
  const dragging=React.useRef(false);
  const last=React.useRef({x:0,y:0});
  const [view,setView]=React.useState({k:1,x:0,y:0});
  const viewRef=React.useRef(view); React.useEffect(()=>{viewRef.current=view;},[view]);
  const minKRef=React.useRef(0.1);
  const animatingRef=React.useRef(false);
  const [ready,setReady]=React.useState(false);
  const didInitialFocusRef = React.useRef(false); // ✅ new

  // The Three Marys: keep active node IDs in localStorage (also used when canvas fires events)
  const maryActiveRef = React.useRef<Set<string>>(new Set());
  const loadMaryActive = React.useCallback((slug: string) => {
    try {
      const raw = localStorage.getItem(ACTIVE_NODES_KEY(slug));
      if (raw) maryActiveRef.current = new Set<string>(JSON.parse(raw));
    } catch {}
  }, []);
  const saveMaryActive = React.useCallback((slug: string, ids: Set<string>) => {
    try { localStorage.setItem(ACTIVE_NODES_KEY(slug), JSON.stringify([...ids])); } catch {}
  }, []);

  /* ---------- Load data ---------- */
  React.useEffect(()=>{ let ok=true;(async()=>{
    try{
      const r=await fetch(getMasterUrl(),{cache:'no-store'}); const j=await r.json();
      const list:any[] = Array.isArray(j?.constellationsDetails)?j.constellationsDetails:[];
      const seen=new Map<string,number>(); const out:Entry[]=[];
      for (const g of list) {
        if (!g?.definition) continue;
        const label=englishName(g.definition);
        const slug0=slugify(label)||slugify(String(g.definition?.id??'unnamed'));
        const bump=(seen.get(slug0)??0)+1; seen.set(slug0,bump);
        const id=bump===1?slug0:`${slug0}-${bump}`;
        const pg=(parseGroupToGraph as any)({ id, artBase:`${import.meta.env.BASE_URL}constellations/`, group:g });
        const size=pickSize(pg);
        out.push({
          id, label, group:g,
          lineUrl:pg?.lineUrl, blurUrl:pg?.blurUrl,
          size,
          nodes: Array.isArray(pg?.nodes)
            ? pg.nodes.map((n:any)=>({
                id:String(n.id),
                position:{ x:+n.position?.x||0, y:+n.position?.y||0 },
                isRoot: !!n?.data?.isRoot,
                label: String(n?.data?.label ?? n?.label ?? ''),
              }))
            : [],
          edges: Array.isArray(pg?.edges)
            ? pg.edges.map((e:any)=>({ source:String(e.source), target:String(e.target) }))
            : [],
        });
      }
      if(ok) setEntries(out);
    }catch(e){ console.error('[FullMap] master',e); if(ok) setEntries([]); }
  })(); return()=>{ok=false}; },[]);

  React.useEffect(()=>{ let ok=true;(async()=>{
    try{ const r=await fetch(getPlacementsUrl(),{cache:'no-store'}); const j=await r.json();
      if(!ok) return; setPlacements(j?.map||{}); setColorMap(j?.colors||{});
    }catch{ if(ok){ setPlacements({}); setColorMap({}); } }
  })(); return()=>{ok=false}; },[]);

  React.useEffect(()=>{ let ok=true;(async()=>{
    try{ const r=await fetch(getRequirementsUrl(),{cache:'no-store'}); const j=await r.json();
      if(ok) setReqs(j||{});
    }catch{ if(ok) setReqs({}); }
  })(); return()=>{ok=false}; },[]);

  // when entries arrive, preload Mary active set from storage
  React.useEffect(() => {
    const mary = entries.find((e) => isMaryConstellation(e));
    if (mary) loadMaryActive(mary.id);
  }, [entries, loadMaryActive]);

  /* ---------- Affixes index ---------- */
  const affixIndex = useAffixIndex();
  const affixOverrides = useAffixOverrides();
  // Clear Marys live selections when not in test/preview so reload starts clean
  React.useEffect(() => {
    if (!testModeEnabled) {
      try {
        const mary = entries.find((e) => isMaryConstellation(e));
        if (mary) localStorage.removeItem(ACTIVE_NODES_KEY(mary.id));
      } catch {}
    }
  }, [testModeEnabled, entries]);

  /* Build active node ids (test mode = clicked; normal = completed) */
  const activeNodeIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const e of entries) {
      if (testModeEnabled) {
        for (const id of (testActive.get(e.id) ?? [])) ids.add(id);
      } else {
        if (isComplete(e.id)) for (const n of e.nodes) ids.add(n.id);
      }
    }
    return ids;
  }, [entries, testModeEnabled, testActive, isComplete]);

  /* Gather rows for those nodes */
  const globalRows: AggRow[] = React.useMemo(() => {
    const rows: AggRow[] = [];
    for (const id of activeNodeIds) {
      const list = affixIndex.get(id);
      if (!list?.length) continue;
      for (const r of list) {
        rows.push({
          pattern: String((r as any).pattern ?? ''),
          value: Number((r as any).value ?? 0),
          valuePerLevel: Number((r as any).valuePerLevel ?? 0),
          modifierType: (r as any).modifierType,
          statKey: (r as any).statKey,
        });
      }
    }
    return rows;
  }, [activeNodeIds, affixIndex]);

  /* Aggregate → formatted lines */
  const { lines: globalLines } = React.useMemo(
    () => aggregateTotals(globalRows, affixOverrides),
    [globalRows, affixOverrides]
  );

  /* ---------- World bounds ---------- */
  const world=React.useMemo(()=>{
    if(!entries.length) return {width:0,height:0,ox:0,oy:0};
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const e of entries){
      const p=placements[e.id] || {x:0,y:0,scale:1};
      const w=(e.size?.width||500)*(p.scale||1), h=(e.size?.height||500)*(p.scale||1);
      const L=p.x, T=p.y, R=p.x+w, B=p.y+h;
      if(L<minX)minX=L; if(T<minY)minY=T; if(R>maxX)maxX=L+w; if(B>maxY)maxY=T+h;
    }
    const pad=200, ox=-minX+pad, oy=-minY+pad;
    return { width:(maxX-minX)+pad*2, height:(maxY-minY)+pad*2, ox, oy };
  },[entries,placements]);

  const focusBox = React.useMemo(() => { if(!entries.length) return null;
    const mary = entries.find((e) => isMaryConstellation(e));
    if(!mary) return null;
    const p=placements[mary.id] || {x:0,y:0,scale:1};
    const w=(mary.size?.width||500)*(p.scale||1);
    const h=(mary.size?.height||500)*(p.scale||1);
    return { x:world.ox+p.x, y:world.oy+p.y, width:w, height:h };
  },[isPreview,entries,placements,world.ox,world.oy]);

  React.useLayoutEffect(()=>{
    const el=wrapRef.current; if(!el || !entries.length || !world.width) return;
    const vw=el.clientWidth, vh=el.clientHeight;
    minKRef.current = Math.min(Math.max(0.05, (vw - PAD_X*2)/world.width), 1);
    if (focusBox){
      const kTarget=Math.min(vw/focusBox.width, vh/focusBox.height)*0.90;
      const kStart = Math.max(minKRef.current, kTarget*INITIAL_ZOOM_RATIO);
      const cx = focusBox.x + focusBox.width/2;
      const cy = focusBox.y + focusBox.height/2;
      const start = clampCentered({k:kStart, x:vw/2 - cx*kStart, y:vh/2 - cy*kStart}, vw, vh, world.width, world.height, minKRef.current, MAX_K, PAD_X);
      setView(start); setReady(true);
      const to = clampCentered({k:kTarget, x:vw/2 - cx*kTarget, y:vh/2 - cy*kTarget}, vw, vh, world.width, world.height, minKRef.current, MAX_K, PAD_X);
      const t = window.setTimeout(()=>{
        animatingRef.current = true;
        const cancel = animateTo(v=>setView(v), ()=>viewRef.current, el, to, world.width, world.height, minKRef.current, MAX_K, PAD_X, FOCUS_DUR);
        (el as any)._cancelZoom = cancel;
        window.setTimeout(()=>{ animatingRef.current=false; }, FOCUS_DUR+40);
      }, FOCUS_DELAY);
      return ()=>{ clearTimeout(t); (el as any)._cancelZoom?.(); };
    }
    const k=Math.min(vw/world.width, vh / world.height)*0.985;
    setView(clampCentered({k, x:(vw-world.width*k)/2, y:(vh-world.height*k)/2}, vw, vh, world.width, world.height, minKRef.current, MAX_K, PAD_X));
    setReady(true);
  },[entries,world.width,world.height,isPreview,focusBox]);

  // ✅ one-shot robust “focus Marys” once entries + placements are ready
  React.useEffect(() => {
    if (didInitialFocusRef.current) return;
    const el = wrapRef.current;
    if (!el || !entries.length || !world.width) return;

    const mary = entries.find((e) => isMaryConstellation(e));
    if (!mary) return;
    const p = placements[mary.id];
    if (!p) return;

    const vw = el.clientWidth, vh = el.clientHeight;
    minKRef.current = Math.min(Math.max(0.05, (vw - PAD_X*2)/world.width), 1);

    const w=(mary.size?.width||500)*(p.scale||1);
    const h=(mary.size?.height||500)*(p.scale||1);
    const cx = world.ox + p.x + w/2;
    const cy = world.oy + p.y + h/2;

    const kTarget = Math.min(vw/w, vh/h) * 0.90;
    const kStart  = Math.max(minKRef.current, kTarget * INITIAL_ZOOM_RATIO);

    const start = clampCentered({k:kStart, x: vw/2 - cx*kStart, y: vh/2 - cy*kStart}, vw, vh, world.width, world.height, minKRef.current, MAX_K, PAD_X);
    setView(start);
    setReady(true);

    const to = clampCentered({k:kTarget, x: vw/2 - cx*kTarget, y: vh/2 - cy*kTarget}, vw, vh, world.width, world.height, minKRef.current, MAX_K, PAD_X);

    didInitialFocusRef.current = true;
    animatingRef.current = true;
    const cancel = animateTo(v => setView(v), () => viewRef.current, el, to, world.width, world.height, minKRef.current, MAX_K, PAD_X, FOCUS_DUR);
    (el as any)._cancelZoom = cancel;
    const t = window.setTimeout(() => { animatingRef.current = false; }, FOCUS_DUR + 40);
    return () => { window.clearTimeout(t); };
  }, [entries, placements, world.width, world.height]);

  React.useEffect(()=>{
    const el=wrapRef.current; if(!el || !entries.length) return;
    const fit=()=>{
      if (animatingRef.current) return;
      const vw=el.clientWidth, vh=el.clientHeight;
      minKRef.current = Math.min(Math.max(0.05, (vw - PAD_X*2)/world.width), 1);
      setView(v=>clampCentered(v, vw, vh, world.width, world.height, minKRef.current, MAX_K, PAD_X));
    };
    const ro=new ResizeObserver(()=>requestAnimationFrame(fit)); ro.observe(el);
    return ()=>ro.disconnect();
  },[entries,world.width,world.height]);

  React.useEffect(() => {
    const host = contentRef.current || wrapRef.current;
    if (!host || !entries.length) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setTip(null);
      const rect = host.getBoundingClientRect();
      const px = Math.min(e.clientX - rect.left, rect.width - RIGHT_SAFE - 1);
      const py = e.clientY - rect.top;

      const { k, x, y } = viewRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const nextK = Math.max(minKRef.current, Math.min(MAX_K, k * factor));

      const wx = (px - x) / k;
      const wy = (py - y) / k;
      const nx = px - wx * nextK;
      const ny = py - wy * nextK;

      const clamped = clampCentered(
        { k: nextK, x: nx, y: ny },
        host.clientWidth, host.clientHeight,
        world.width, world.height,
        minKRef.current, MAX_K, PAD_X
      );
      setView(clamped);
    };

    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel as any);
  }, [entries.length, world.width, world.height]);

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    setTip(null);
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove:React.MouseEventHandler<HTMLDivElement> = (e)=>{ if(!dragging.current) return;
    const el=wrapRef.current; if(!el) return;
    const dx=e.clientX-last.current.x, dy=e.clientY-last.current.y; last.current={x:e.clientX,y:e.clientY};
    setView(v=>clampCentered({...v, x:v.x+dx, y:v.y+dy}, el.clientWidth, el.clientHeight, world.width, world.height, minKRef.current, MAX_K, PAD_X));
  };
  const stopDrag=()=>{ dragging.current=false; };

  /* ---------- Derived topology for preview/test ---------- */
  const topology = React.useMemo(() => {
    const m = new Map<string, { adj: Map<string, Set<string>>; roots: Set<string> }>();
    for (const e of entries) m.set(e.id, { adj: buildAdj(e.nodes, e.edges), roots: inferRoots(e.nodes, e.edges) });
    return m;
  }, [entries]);

  const availableBySlug = React.useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of entries) {
      const topo = topology.get(e.id); if (!topo) continue;
      const active = testActive.get(e.id) ?? new Set<string>();
      m.set(e.id, deriveAvailable(e.nodes, topo.adj, active, topo.roots));
    }
    return m;
  }, [entries, topology, testActive]);

  const setActiveFor = React.useCallback((slug: string, updater: (set: Set<string>) => void) => {
    setTestActive(prev => {
      const next = new Map(prev);
      const cur  = new Set(next.get(slug) ?? []);
      updater(cur);
      next.set(slug, cur);
      return next;
    });
  }, []);

  /* ---------- Summary predicate (now safe & inside component) ---------- */
  const isNodeActiveForSummary = React.useCallback(
    (e: Entry, nodeId: string): boolean => {
      if (testModeEnabled) {
        const set = testActive.get(e.id);
        return !!set && set.has(nodeId);
      }
      // Outside preview/test: treat completed constellations as fully active for summary
      return isComplete(e.id);
    },
    [testModeEnabled, testActive]
  );

  const summary = React.useMemo(() => {
    if (!summaryConstId) return null;
    const e = entries.find(x => x.id === summaryConstId);
    if (!e) return null;

    const rows: ConstellationAffixRow[] = [];

    // In test/preview: include actively toggled nodes first
    if (testModeEnabled) {
      const set = testActive.get(e.id) ?? new Set<string>();
      if (set.size) {
        for (const id of set) {
          const n = e.nodes.find(nn => nn.id === id);
          if (!n) continue;
          const hit = lookupAffixes(affixIndex, e, n);
          if (hit.rows?.length) rows.push(...hit.rows);
        }
      }
    }

    // If nothing yet, include the hovered node (so hovering shows a summary)
    if (!rows.length && hovered && hovered.cid === e.id) {
      const n = e.nodes.find(nn => nn.id === hovered.nid);
      if (n) {
        const hit = lookupAffixes(affixIndex, e, n);
        if (hit.rows?.length) rows.push(...hit.rows);
      }
    }

    return { title: e.label || e.group?.definition?.englishName || e.id, rows };
  }, [summaryConstId, entries, testModeEnabled, testActive, affixIndex, hovered]);

  const globalSummary = React.useMemo(() => {
    const rows: ConstellationAffixRow[] = [];

    for (const e of entries) {
      // Which nodes count?
      let nodeIds: string[] = [];
      if (testModeEnabled) {
        // sum only actively toggled nodes in preview/test
        nodeIds = Array.from(testActive.get(e.id) ?? []);
      } else {
        // in normal mode, treat completed constellations as active
        if (isComplete(e.id)) nodeIds = e.nodes.map(n => n.id);
      }

      if (!nodeIds.length) continue;

      // push all rows for those nodes
      for (const nodeId of nodeIds) {
        const n = e.nodes.find(nn => nn.id === nodeId);
        if (!n) continue;
        const hit = lookupAffixes(affixIndex, e, n);
        if (hit.rows?.length) rows.push(...hit.rows);
      }
    }

    return { title: 'Total Modifiers', rows };
  }, [entries, testModeEnabled, testActive, affixIndex]);

/* ---------- Devotion totals (incl. Marys per-node) ---------- */
const recomputeTotals = React.useCallback(() => {
  const totals: RGB = { Red: 0, Green: 0, Blue: 0 };

  // consider test mode "complete" when every node is active
  const isCompleteNow = (e: Entry): boolean => {
    if (testModeEnabled) {
      const set = testActive.get(e.id);
      return !!set && set.size === e.nodes.length && e.nodes.length > 0;
    }
    return isComplete(e.id);
  };

  // 1) Completed constellations → masteredDevotionGranted
  for (const e of entries) {
    // In TEST MODE, skip Marys here; we’ll add her via per-node so totals don’t jump at completion.
    const skipMary = (() => {
      const label = String(e?.label || '').toLowerCase();
      const name  = String(e?.group?.definition?.name || '').toLowerCase();
      return /three\s*marys?/.test(label) || /tres\s*marias/.test(label) ||
             /three\s*marys?/.test(name)  || /tres\s*marias/.test(name);
    })();
    if (testModeEnabled && skipMary) continue;

    if (!isCompleteNow(e)) continue;
    const g = e.group?.definition?.masteredDevotionGranted || {};
    totals.Red   += Number(g.Red   ?? 0);
    totals.Green += Number(g.Green ?? 0);
    totals.Blue  += Number(g.Blue  ?? 0);
  }

  // 2) The Three Marys / Tres Marias → +1 per active node
  const mary = entries.find((e) => {
    const label = String(e?.label || '').toLowerCase();
    const name  = String(e?.group?.definition?.name || '').toLowerCase();
    return /three\s*marys?/.test(label) || /tres\s*marias/.test(label) ||
           /three\s*marys?/.test(name)  || /tres\s*marias/.test(name);
  });

  if (mary) {
    // In TEST MODE: always use per-node (even if Marys is complete) so totals remain stable.
    // In NORMAL MODE: only use per-node when Marys is NOT complete (once complete, mastered grant already counted above).
    const shouldUsePerNode =
      testModeEnabled ? true : !isCompleteNow(mary);

    if (shouldUsePerNode) {
      const activeIds: Iterable<string> =
        testModeEnabled ? (testActive.get(mary.id) ?? new Set<string>()) : new Set<string>();

      // Map to original definition nodes to read affix text
      const defNodes: any[] = mary.group?.definition?.nodes || [];
      const defByKey = new Map<string, any>(
        defNodes.map((dn: any) => [String(dn?.id ?? dn?.name ?? ''), dn])
      );

      for (const id of activeIds) {
        const dn = defByKey.get(String(id));
        if (!dn) continue;
        const affs = dn.affixes || [];
        for (const a of affs) {
          const en = (a.description || []).find((loc: any) => loc.langCode === 'en');
          const text = String(en?.langTranslation || a?.eStatDefinition || a?.type || '').toLowerCase();
          if (/\bfury\s+devotion\b/.test(text))       { totals.Red   += 1; break; }
          if (/\bdiscipline\s+devotion\b/.test(text)) { totals.Green += 1; break; }
          if (/\bfaith\s+devotion\b/.test(text))      { totals.Blue  += 1; break; }
        }
      }
    }
  }

  setDevotion(totals);
  try {
    localStorage.setItem('devotion:totals', JSON.stringify(totals));
    window.dispatchEvent(new CustomEvent('devotion-totals-changed', { detail: totals } as any));
  } catch {}
}, [entries, testActive, testModeEnabled, isComplete]);

  React.useEffect(() => {
    recomputeTotals();
  }, [testActive, testModeEnabled, recomputeTotals]);

  /* Recompute totals on entries/test mode changes */
  React.useEffect(() => {
    recomputeTotals();
  }, [entries, testModeEnabled, recomputeTotals]);

  React.useEffect(() => {
    const handler = (ev: any) => {
      const d = ev?.detail;
      if (!d) return;
      const mary = entries.find((e) => isMaryConstellation(e));
      if (!mary) return;
      const cid = String(d.constellationId ?? '');
      if (cid !== mary.id && cid !== String(mary.group?.definition?.id ?? '')) return;

      const next = new Set(maryActiveRef.current);
      const nodeId = String(d.nodeId ?? '');
      if (!nodeId) return;
      if (d.active) next.add(nodeId); else next.delete(nodeId);
      maryActiveRef.current = next;
      saveMaryActive(mary.id, next);
      recomputeTotals();
    };
    window.addEventListener('node-activation-changed', handler as EventListener);
    return () => window.removeEventListener('node-activation-changed', handler as EventListener);
  }, [entries, saveMaryActive, recomputeTotals]);

/* ---------- Render viewport ---------- */
const viewport = (
  <div
    ref={wrapRef}
    onMouseDown={onMouseDown}
    onMouseMove={onMouseMove}
    onMouseUp={stopDrag}
    onMouseLeave={stopDrag}
    style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      cursor: dragging.current ? 'grabbing' : 'grab',
      background: '#0a0c16',
      overscrollBehavior: 'none',
      touchAction: 'none',
    }}
  >
    <DevotionOverlay
      totals={devotion}
      containerRef={contentRef as unknown as React.RefObject<HTMLElement>}
      inset={LETTERBOX.HEADER_H + LETTERBOX.SIDE_PAD}
    />
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: world.width,
        height: world.height,
        transform: `matrix(${view.k},0,0,${view.k},${view.x},${view.y})`,
        transformOrigin: '0 0',
        visibility: ready ? 'visible' : 'hidden',
      }}
    >
      {entries.map((g) => {
        const align = loadAlign(g.id);
        const CW = g.size.width, CH = g.size.height;
        const cx = CW / 2, cy = CH / 2;
        const p = placementFor(g, placements);
        const color = colorMap[g.id] || loadColor(g.id);
        const transform = `translate(${p.x + world.ox}px, ${p.y + world.oy}px) ${
          p.rotation ? `rotate(${p.rotation}deg)` : ''
        } scale(${p.scale})`;
        const toLocal = (pt: { x: number; y: number }) => ({
          x: Math.round(cx + align.x + pt.x * align.scale),
          y: Math.round(cy + align.y + pt.y * align.scale),
        });

        const topo = { adj: buildAdj(g.nodes, g.edges), roots: inferRoots(g.nodes, g.edges) };
        const active = testActive.get(g.id) ?? new Set<string>();
        const available = deriveAvailable(g.nodes, topo.adj, active, topo.roots);

        const req = reqFor(g, reqs);
        const need = req?.requirements;
        const ok = meets(devotion, need);
        const complete = testModeEnabled
          ? active.size === g.nodes.length && g.nodes.length > 0
          : isComplete(g.id);

        // gating for art
        const has99Gate = !!need && ['Red', 'Green', 'Blue'].some(
          (c) => Number((need as any)[c]) === 99
        );
        const hideArtHard = isWIP(g.id, g.label) || has99Gate;
        const mayShowArt = ok && !hideArtHard;

        const lineUrl = mayShowArt ? g.lineUrl || '' : '';
        const blurUrl = mayShowArt ? g.blurUrl || '' : '';
        const showLine = mayShowArt && complete && !!lineUrl;
        const showBlur = mayShowArt && !showLine && !!blurUrl;

        const pos = new Map(g.nodes.map((n) => [n.id, toLocal(n.position)]));

        const handleRight: React.MouseEventHandler<HTMLDivElement> = (e) => {
          if (!testModeEnabled || (!ok && !isMaryConstellation(g))) return;
          e.preventDefault();
          const id = (e.currentTarget as HTMLDivElement).dataset.id!;
          setTestActive((prev) => {
            const next = new Map(prev);
            const set = new Set(next.get(g.id) ?? []);
            if (!set.has(id)) return next;
            cascadeDeactivate(id, topo.adj, set, topo.roots);
            next.set(g.id, set);
            return next;
          });
        };

        const isActive = (id: string) =>
          complete ? true : testModeEnabled ? active.has(id) : ok;

        return (
          <div
            key={g.id}
            style={{
              position: 'absolute',
              transform,
              transformOrigin: 'top left',
              left: 0,
              top: 0,
              width: CW,
              height: CH,
              overflow: 'visible',
              opacity: ok ? 1 : 0.5,
              filter: ok ? 'none' : 'grayscale(0.2)',
            }}
            title={ok ? g.label : `${g.label}\nLocked — ${missingText(devotion, need)}`}
          >
            {/* ART (z:0) */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
              {showBlur && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(185,205,225,0.75)',
                    WebkitMaskImage: `url("${blurUrl}")`,
                    maskImage: `url("${blurUrl}")`,
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    pointerEvents: 'none',
                    opacity: 0.98,
                    filter: 'brightness(1.02) contrast(1.05)',
                  }}
                />
              )}
              {showLine && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: color,
                    WebkitMaskImage: `url("${lineUrl}")`,
                    maskImage: `url("${lineUrl}")`,
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    pointerEvents: 'none',
                    opacity: 1,
                    filter: 'drop-shadow(0 0 12px rgba(255,255,255,.28)) contrast(1.05)',
                  }}
                />
              )}
            </div>

            {/* EDGES (z:1) */}
            <svg
              width={CW}
              height={CH}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                pointerEvents: 'none',
                zIndex: 1,
                overflow: 'visible',
              }}
            >
              {g.edges.map((e, i) => {
                const a = pos.get(e.source);
                const b = pos.get(e.target);
                if (!a || !b) return null;
                const bright = complete
                  ? true
                  : testModeEnabled
                  ? active.has(e.source) && active.has(e.target)
                  : ok;
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={bright ? color : 'rgba(185,205,225,0.45)'}
                    strokeWidth={2}
                    opacity={bright ? 0.9 : 0.6}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            {/* NODES (z:2) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 2,
                pointerEvents: 'auto',
              }}
            >
              {g.nodes.map((n) => {
                const pt = pos.get(n.id)!;
                const size = 16 * (align.scale || 1);

                // “ok” => constellation unlocked
                // available if graph says so OR it’s a root
                const isAvail = ok && (available.has(n.id) || topo.roots.has(n.id));

                const stateClass = isActive(n.id)
                  ? 'node-activated'
                  : isAvail
                  ? 'node-unlocked'
                  : 'node-locked';

                return (
                  <div
                    key={n.id}
                    data-id={n.id}
                    className={`diamond-node ${stateClass}`}
                    onMouseDown={(e) => { e.stopPropagation(); }}
                    onClick={(e) => {
                      e.stopPropagation();

                      // Block clicks unless constellation is unlocked, except Marys (live +1)
                      if (!testModeEnabled || (!ok && !isMaryConstellation(g))) return;

                      setTestActive((prev) => {
                        const next = new Map(prev);
                        const set = new Set(next.get(g.id) ?? []);

                        const wasActive = set.has(n.id);
                        if (wasActive) {
                          set.delete(n.id);
                        } else {
                          if (!isAvail) return prev; // only allow if available/root
                          set.add(n.id);
                        }

                        next.set(g.id, set);

                        // --- Marys bookkeeping ---
                        if (isMaryConstellation(g)) {
                          const maryNext = new Set(maryActiveRef.current);
                          if (wasActive) maryNext.delete(n.id);
                          else maryNext.add(n.id);
                          maryActiveRef.current = maryNext;
                          try { saveMaryActive(g.id, maryNext); } catch {}
                        }

                        try {
                          window.dispatchEvent(
                            new CustomEvent('node-activation-changed', {
                              detail: { constellationId: g.id, nodeId: n.id, active: !wasActive },
                            })
                          );
                        } catch {}

                        recomputeTotals();
                        return next;
                      });
                    }}
                    onContextMenu={testModeEnabled ? handleRight : undefined}
                    onMouseEnter={(e) => {
                      const activeNow = isActive(n.id);
                      const availableNow = testModeEnabled ? available.has(n.id) : ok;
                      setSummaryConstId(g.id);
                      setHovered({ cid: g.id, nid: n.id });
                      const { rows: affixes } = lookupAffixes(affixIndex, g, n);
                      const effectLines = affixes
                        .map((a) => materializeRowWithOverrides(a, affixOverrides))
                        .filter((t) => t && !/^_+HIDE_+$/.test(String(t).trim()));

                      // Optional: Marys +1 hint from affix text (using def nodes mapping)
                      if (isMaryConstellation(g)) {
                        const defNodes: any[] = g.group?.definition?.nodes || [];
                        const map = new Map<string, any>(defNodes.map((dn: any) => [String(dn?.id ?? dn?.name ?? ''), dn]));
                        const dn = map.get(String(n.id));
                        if (dn) {
                          const affs = dn.affixes || [];
                          const hasFury  = affs.some((a: any) => {
                            const en = (a.description || []).find((loc: any) => loc.langCode === 'en');
                            const t = String(en?.langTranslation || a?.eStatDefinition || a?.type || '').toLowerCase();
                            return /\bfury\s+devotion\b/.test(t);
                          });
                          const hasDisc  = affs.some((a: any) => {
                            const en = (a.description || []).find((loc: any) => loc.langCode === 'en');
                            const t = String(en?.langTranslation || a?.eStatDefinition || a?.type || '').toLowerCase();
                            return /\bdiscipline\s+devotion\b/.test(t);
                          });
                          const hasFaith = affs.some((a: any) => {
                            const en = (a.description || []).find((loc: any) => loc.langCode === 'en');
                            const t = String(en?.langTranslation || a?.eStatDefinition || a?.type || '').toLowerCase();
                            return /\bfaith\s+devotion\b/.test(t);
                          });
                          if (hasFury)  effectLines.push('+1 Fury');
                          if (hasDisc)  effectLines.push('+1 Discipline');
                          if (hasFaith) effectLines.push('+1 Faith');
                        }
                      }

                      // ✅ Build raw, verbatim lines from the original definition node for THIS node
                      const defNodes: any[] = g.group?.definition?.nodes || [];

                      // Multi-key map for robust lookup: id, name, English localized name, and slug(English name)
                      const defByKey = new Map<string, any>();
                      for (const dn of defNodes) {
                        const idKey   = String(dn?.id ?? '').trim();
                        const nameKey = String(dn?.name ?? '').trim();

                        const enArr = (dn?.nameLocalizationKey ?? dn?.nameKey) as any[];
                        const enTxt = Array.isArray(enArr) ? enArr.find(k => k?.langCode === 'en')?.langTranslation : undefined;
                        const enKey = enTxt ? String(enTxt).trim() : '';

                        if (idKey)   defByKey.set(idKey, dn);
                        if (nameKey) defByKey.set(nameKey, dn);
                        if (enKey) { defByKey.set(enKey, dn); defByKey.set(slugify(enKey), dn); }
                      }

                      // Try id, then label, then slug(label)
                      const lookupKeys = [String(n.id), String(n.label || ''), slugify(String(n.label || ''))]
                        .map(s => s.trim())
                        .filter(Boolean);

                      let defNode: any = null;
                      for (const k of lookupKeys) { if (defByKey.has(k)) { defNode = defByKey.get(k); break; } }

                      // Extract raw EN lines
                      let rawLines: string[] = [];
                      if (defNode) {
                        rawLines = (defNode.affixes || [])
                          .map((ax: any) => {
                            const en = (ax.description || []).find((loc: any) => loc.langCode === 'en');
                            return en?.langTranslation || '';
                          })
                          .filter((s: string) => !!s && /\S/.test(s));
                      }

                      // Apply __HIDE__ overrides: normalize numbers to '#' before testing override key
                      const rawLinesFiltered = rawLines.filter((line) => {
                        const norm = String(line ?? '')
                          .replace(/(?<!\w)(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?/g, '#')
                          .replace(/#+/g, '#')
                          .trim();
                        return !affixOverrides || affixOverrides[norm] !== '__HIDE__';
                      });

                      const iconUrl = iconUrlForUrl(affixes);

                      const reqTotals = need
                        ? {
                            Red:   Number((need as any).Red   || 0),
                            Green: Number((need as any).Green || 0),
                            Blue:  Number((need as any).Blue  || 0),
                          }
                        : undefined;

                      const bonusTotals = (g.group?.definition?.masteredDevotionGranted as any) || undefined;

                      setTip({
                        show: true,
                        x: e.clientX,
                        y: e.clientY,
                        title: g.label,
                        subtitle: n.label || g.label,
                        state: activeNow ? 'Activated' : (availableNow ? 'Available' : 'Locked'),
                        effectLines,
                        iconUrl,
                        countText:
                          ((active.size > 0 || complete) && (ok || testModeEnabled))
                            ? `${complete ? g.nodes.length : active.size}/${g.nodes.length}`
                            : undefined,
                        reqTotals,
                        bonusTotals,
                        showBonus: !complete,

                        // ✅ pass verbatim text (no TS issues; no node/constellation fields)
                        rawLines: rawLinesFiltered,
                      });

                    }}
                    onMouseMove={(e) => {
                      setTip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
                    }}
                    onMouseLeave={() => { setTip(null); setHovered(null); }}
                    style={{
                      position: 'absolute',
                      left: pt.x - size / 2,
                      top:  pt.y - size / 2,
                      cursor: testModeEnabled ? 'pointer' : 'default',
                      ['--cn-size' as any]: `${size}px`,
                      ['--cn-tint' as any]: color,   // constellation tint
                      ['--cn-glow' as any]: color,   // keep if used elsewhere
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

/* ---------- Render ---------- */
if (!isPreview) {
  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0 }}>
      <div
        id="letterbox-content"
        ref={contentRef}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          background: 'rgba(5,8,14,0.55)',
          backdropFilter: 'blur(2px)',
          zIndex: 1,
        }}
      >
        
          {/* World clipped to leave space for the stat panel */}
          <div
            id="viewport-clip"
            style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: RIGHT_SAFE, overflow: 'hidden', zIndex: 1 }}
          >
            {viewport}
          </div>

          {/* Solid slab under the stat panel */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: RIGHT_SAFE,
              background: '#0a0c16',
              borderLeft: '1px solid #20263a',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />

        {/* (globalLines is computed; MapStatSummary consumes raw rows) */}
        {globalSummary && (
          <MapStatSummary title={globalSummary.title} rows={globalSummary.rows} />
        )}
      </div>

   
      {/* Header / Footer overlays */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: LETTERBOX.HEADER_H,
          zIndex: 2,
          background: `top center / 100% auto no-repeat url(${HEADER_URL})`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: LETTERBOX.FOOTER_H,
          zIndex: 2,
          background: `bottom center / 100% auto no-repeat url(${FOOTER_URL})`,
          pointerEvents: 'none',
        }}
      />
     {/* Tooltip */}
      <MapNodeTooltip
        data={tip}
        panelWidth={484}
        panelHeight={519}
        render={(d) => {
          const isMarys = isMarysTitle(d.title);
          const reqMet = d.state !== 'Locked';
          const rawLines: string[] = Array.isArray((d as any)?.rawLines) ? (d as any).rawLines : [];

          return (
            <MapTooltipPanel
              title={String(d.title ?? '')}
              subtitle={d.subtitle}
              countText={d.countText}
              effectLines={rawLines.length ? rawLines : d.effectLines}
              iconUrl={d.iconUrl}
              effectValues={d.effectValues}
              reqTotals={d.reqTotals}
              reqMet={reqMet}
              reqLabel="Unlocks at"
              bonusTotals={d.bonusTotals}
              showBonus={d.showBonus}
              isThreeMarys={isMarys}
            />
          );
        }}
      />
    </div>
  );
}

return (
  <div
    id="letterbox-root"
    style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#060a12' }}
  >
    {/* Background layer */}
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        backgroundImage: `url(${BG_URL}), radial-gradient(1200px 800px at 50% 50%, #0c1120, #080c16 60%, #060a12)`,
        backgroundRepeat: 'no-repeat, no-repeat',
        backgroundSize: 'cover, 100% 100%',
        backgroundPosition: 'center, center',
        pointerEvents: 'none',
      }}
    />

    {/* Content layer */}
    <div
      id="letterbox-content"
      ref={contentRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: 1,
        background: 'rgba(5,8,14,0.55)',
        backdropFilter: 'blur(2px)',
      }}
    >
      {viewport}
      {globalSummary && (
        <MapStatSummary title={globalSummary.title} rows={globalSummary.rows} />
      )}
    </div>

    {/* Header / Footer */}
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: LETTERBOX.HEADER_H,
        zIndex: 2,
        background: `top center / 100% auto no-repeat url(${HEADER_URL})`,
        pointerEvents: 'none',
      }}
    />
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: LETTERBOX.FOOTER_H,
        zIndex: 2,
        background: `bottom center / 100% auto no-repeat url(${FOOTER_URL})`,
        pointerEvents: 'none',
      }}
    />

    {/* Tooltip */}
    <MapNodeTooltip
      data={tip}
      panelWidth={484}
      panelHeight={519}
      render={(d) => {
        const isMarys = isMarysTitle(d.title);
        const offsets = isMarys ? OFFSETS_MARYS : OFFSETS_DEFAULT;
        const reqMet = d.state !== 'Locked';

        // ✅ Prefer raw lines passed on the tip (verbatim JSON), fallback to old effectLines
        const rawLines: string[] = Array.isArray((d as any)?.rawLines) ? (d as any).rawLines : [];

        return (
          <MapTooltipPanel
            title={String(d.title ?? '')}
            subtitle={d.subtitle}
            countText={d.countText}
            effectLines={rawLines.length ? rawLines : d.effectLines}
            iconUrl={d.iconUrl}
            effectValues={d.effectValues}
            reqTotals={d.reqTotals}
            reqMet={reqMet}
            reqLabel="Unlocks at"
            bonusTotals={d.bonusTotals}
            showBonus={d.showBonus}
            isThreeMarys={isMarys}
          />
        );
      }}
    />
  </div>
  )
}
