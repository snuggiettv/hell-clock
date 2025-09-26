/* /src/components/App-MapBuild.tsx
   Map Builder shell that restores the old workflow:
   - Single-constellation alignment via <ConstellationCanvas/>
   - Full-map placement via <FullMap-MapBuilder/>
   - Simple toolbar to switch modes, pick a constellation, and export JSON snippets

   Notes
   - ConstellationCanvas saves per-constellation alignment to localStorage under
       key = `constellation:${id}:align`
   - FullMap-MapBuilder saves full-map placements to localStorage under
       key = `constellation:fullmap:placements`
   - This shell lets you copy both into the formats used by `constellation-transforms.json`.
*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ConstellationCanvas from './ConstellationCanvas';
import FullMapBuilder from './FullMap-MapBuilder';
import { parseGroupToGraph } from '../constellations/parseGroup';

// ----- types -----
interface Entry {
  id: string;           // canonical slug we use for storage + images
  label: string;        // human readable name (usually EN)
  group: any;           // raw group from master json
  artBase: string;      // `${BASE_URL}constellations/${id}/`
}

// Prefer ?src=... if provided, else default to `/data/constellations.json` under BASE_URL
const getMasterUrl = (): string => {
  const qp = new URLSearchParams(location.search);
  const src = qp.get('src');
  if (src) return src;
  return `${import.meta.env.BASE_URL}data/Constellations.json`;
};

const slugify = (s: string) =>
  String(s || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const englishName = (def: any): string => {
  const en = Array.isArray(def?.nameKey)
    ? def.nameKey.find((k: any) => k?.langCode === 'en')?.langTranslation
    : undefined;
  if (en) return String(en).trim();
  const raw = String(def?.name || '').trim();
  const cleaned = raw.replace(/\s*-\s*Constellation\s+Definition$/i, '').trim();
  return cleaned || String(def?.id ?? 'Unnamed');
};

const ALIGN_KEY = (id: string) => `constellation:${id}:align`;
const MAP_KEY = 'constellation:fullmap:placements';

type Mode = 'single' | 'fullmap';

const AppMapBuild: React.FC = () => {
  const [mode, setMode] = useState<Mode>('single');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [initialGraph, setInitialGraph] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // load registry from master json
  useEffect(() => {
    (async () => {
      try {
        const url = getMasterUrl();
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const master = await res.json();
        const list: any[] = Array.isArray(master?.constellationsDetails)
          ? master.constellationsDetails
          : [];

        const base = import.meta.env.BASE_URL;
        const seen = new Map<string, number>();
        const out: Entry[] = list
          .filter((g) => g && typeof g === 'object' && g.definition)
          .map((g) => {
            const label = englishName(g.definition);
            const slug = slugify(label) || slugify(String(g.definition?.id ?? 'unnamed'));
            const bump = (seen.get(slug) ?? 0) + 1;
            seen.set(slug, bump);
            const id = bump === 1 ? slug : `${slug}-${bump}`;
            return { id, label, group: g, artBase: `${base}constellations/` };
          })
          .sort((a, b) => a.label.localeCompare(b.label));

        setEntries(out);
        if (out.length && !selected) setSelected(out[0].id);
      } catch (e) {
        console.error('[App-MapBuild] failed to load master', e);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // build initialGraph for the selected constellation
  useEffect(() => {
    if (!selected) { setInitialGraph(null); return; }
    const entry = entries.find(e => e.id === selected);
    if (!entry) { setInitialGraph(null); return; }

    try {
    const pg = parseGroupToGraph({ id: entry.id, artBase: entry.artBase, group: entry.group });
    setInitialGraph({
        nodes: pg.nodes || [],
        edges: pg.edges || [],
        blurUrl: pg.blurUrl || '',
        lineUrl: pg.lineUrl || '',
        size: pg.size,                 // NEW: { width, height }
        container: pg.container,       // NEW: { x, y } (for full map later)
        center: pg.center,             // NEW: { x, y }
      });
    } catch (e) {
      console.error('[App-MapBuild] parseGroupToGraph failed', e);
      setInitialGraph(null);
    }
  }, [entries, selected]);

  // copy helpers
  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); alert('Copied to clipboard'); }
    catch { alert('Could not copy'); }
  };

  const handleCopyAlign = () => {
    const id = selected;
    if (!id) return;
    try {
      const raw = localStorage.getItem(ALIGN_KEY(id));
      if (!raw) { alert('No saved alignment for this constellation (use the HUD Save)'); return; }
      const a = JSON.parse(raw);
      const snippet = JSON.stringify({ [id]: { align: { x: +a.x || 0, y: +a.y || 0, scale: +(a.scale ?? 1) || 1 } } }, null, 2);
      copyText(snippet);
    } catch {
      alert('Bad align JSON in storage');
    }
  };

  const handleCopyMap = () => {
    try {
      const raw = localStorage.getItem(MAP_KEY);
      if (!raw) { alert('No placements found — move things in Full Map Builder first'); return; }
      const placements = JSON.parse(raw) || {};
      // export as { "map": { id: { x,y,scale } } }
      const out = { map: placements } as any;
      copyText(JSON.stringify(out, null, 2));
    } catch {
      alert('Bad placements JSON in storage');
    }
  };


    const handleImportJson = async () => {
    const toNum = (v: any, d=0) => Number.isFinite(+v) ? +v : d;
    const AKEY = (id: string) => `constellation:${id}:align`;
    const MAP_KEY = 'constellation:fullmap:placements';

    try {
      const raw = prompt('Paste constellation-transforms.json (or per-constellation shape):');
      if (!raw) return;
      const data = JSON.parse(raw);

      let aliases: Record<string,string> = {};
      try {
        const a = prompt('Optional: paste constellation-aliases.json (or Cancel to skip):');
        if (a && a.trim()) aliases = JSON.parse(a);
      } catch {}

      const applyAlias = (k: string) => aliases[k] || k;

      // normalize to {align:{}, map:{}}
      const norm = { align: {} as any, map: {} as any };
      if (data && (data.align || data.map)) {
        Object.assign(norm.align, data.align || {});
        Object.assign(norm.map, data.map || {});
      } else {
        for (const [k, v] of Object.entries<any>(data || {})) {
          if (v?.align) norm.align[k] = v.align;
          if (v?.map)   norm.map[k]   = v.map;
        }
      }

      let alignCount = 0;
      for (const [key, v] of Object.entries<any>(norm.align)) {
        if (!v) continue;
        const id = applyAlias(key);
        const x = toNum(v.x, 0), y = toNum(v.y, 0), scale = toNum(v.scale, 1);
        localStorage.setItem(AKEY(id), JSON.stringify({ x, y, scale }));
        alignCount++;
      }

      let mapCount = 0;
      const mapOut: Record<string, any> = {};
      for (const [key, v] of Object.entries<any>(norm.map)) {
        if (!v) continue;
        const id = applyAlias(key);
        const x = toNum(v.x, 0), y = toNum(v.y, 0), scale = toNum(v.scale, 1);
        const rotation = v.rotation != null ? toNum(v.rotation, 0) : undefined;
        mapOut[id] = rotation != null ? { id, x, y, scale, rotation } : { id, x, y, scale };
        mapCount++;
      }
      localStorage.setItem(MAP_KEY, JSON.stringify(mapOut));

      alert(`Imported: ${alignCount} alignments, ${mapCount} map placements.\nReloading…`);
      location.reload();
    } catch (e: any) {
      alert('Import failed: ' + (e?.message || e));
    }
  };

  if (loading) return <div style={{ padding: 16, color: '#ddd' }}>Loading…</div>;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0b0d1a', color: '#eee', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid #333' }}>
        <strong>Map Builder</strong>
        <span style={{ opacity: 0.7 }}>base:</span>
        <code>{import.meta.env.BASE_URL}</code>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setMode('single')} disabled={mode==='single'}>Single (Align)</button>
          <button onClick={() => setMode('fullmap')} disabled={mode==='fullmap'}>Full Map (Place)</button>
        </div>
      </div>

      {/* Workspace */}
      <div style={{ position: 'relative' }}>
        {mode === 'single' ? (
          <>
            {/* side controls */}
            <div style={{ position: 'absolute', left: 10, top: 10, zIndex: 5, background: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 8, display: 'grid', gap: 8, minWidth: 320 }}>
              <div style={{ fontWeight: 700 }}>Single Constellation (Align)</div>
              <div>
                <label style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 6, alignItems: 'center' }}>
                  <span>Pick</span>
                  <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                    {entries.map((e) => (
                      <option key={e.id} value={e.id}>{e.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Tip: Shift+D toggles the alignment HUD; L toggles labels; arrow keys nudge; +/- scales.</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={handleCopyAlign}>Copy align JSON for current</button>
                <button onClick={() => {
                  // convenience reset
                  try { localStorage.removeItem(ALIGN_KEY(selected)); alert('Cleared saved align for this constellation'); } catch {}
                }}>Clear align (current)</button>
              </div>
            </div>

            {/* canvas */}
            {initialGraph ? (
              <ConstellationCanvas source={{ id: selected }} initialGraph={initialGraph} />
            ) : (
              <div style={{ padding: 16 }}>Select a constellation</div>
            )}
          </>
        ) : (
          <>
            {/* Full map builder with its own toolbar (import/export/nudge + overlay) */}
            <FullMapBuilder />

            {/* right-side helpers */}
            <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 5, background: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 8, display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Export helpers</div>
              <button onClick={handleCopyMap}>Copy map JSON from localStorage</button>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Paste these into <code>/public/constellation-transforms.json</code> (merge with existing).</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AppMapBuild;
