// src/components/FullMap-MapBuilder.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
// Parser (same one FullMap uses)
import { parseGroupToGraph } from '../constellations/parseGroup';

type RGB = { Red: number; Green: number; Blue: number };

type NodeDef = { id: string; position: { x: number; y: number } };
type EdgeDef = { source: string; target: string };

type Graph = {
  id: string;
  label: string;
  nodes: NodeDef[];
  edges: EdgeDef[];
  lineUrl?: string;
  blurUrl?: string;
  size: { width: number; height: number };
  group: any; // original group
};

const getMasterUrl = () => `${import.meta.env.BASE_URL}data/Constellations.json`;

const slugify = (s: string) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const englishName = (def: any): string => {
  const en = Array.isArray(def?.nameLocalizationKey ?? def?.nameKey)
    ? (def.nameLocalizationKey ?? def.nameKey).find((k: any) => k?.langCode === 'en')?.langTranslation
    : undefined;
  if (en) return String(en).trim();
  const raw = String(def?.name || '').trim();
  const cleaned = raw.replace(/\s*-\s*Constellation\s+Definition$/i, '').trim();
  return cleaned || String(def?.id ?? 'Unnamed');
};

// Helper: robust parser call that supports BOTH signatures:
//   parseGroupToGraph({ id, artBase, group })  ← new
//   parseGroupToGraph(id, group)               ← legacy
async function callParserRobust(
  id: string,
  group: any,
  artBase: string
): Promise<{
  nodes: Array<{ id: string; position: { x: number; y: number } }>;
  edges: Array<{ source: string; target: string }>;
  lineUrl?: string;
  blurUrl?: string;
  size?: { width: number; height: number } | { width?: number; height?: number } | any;
}> {
  // try new signature first
  try {
    // @ts-ignore – allow flexible parser typing
    const pg = await Promise.resolve(parseGroupToGraph({ id, artBase, group }));
    if (pg && (pg.nodes || pg.edges)) return pg;
    // fallthrough to legacy if shape wasn’t as expected
  } catch {
    // ignore and try legacy below
  }
  // legacy call
  // @ts-ignore
  const pgLegacy = await Promise.resolve(parseGroupToGraph(id, group));
  return pgLegacy || {};
}

const pickSize = (pg: any): { width: number; height: number } => {
  if (pg?.size?.width && pg?.size?.height) return { width: +pg.size.width, height: +pg.size.height };
  if (pg?.container?.width && pg?.container?.height) return { width: +pg.container.width, height: +pg.container.height };
  if (pg?.width && pg?.height) return { width: +pg.width, height: +pg.height };
  return { width: 1200, height: 800 };
};

const Panel: React.CSSProperties = {
  position: 'absolute',
  left: 10,
  top: 10,
  background: 'rgba(0,0,0,0.75)',
  border: '1px solid #3a3f5a',
  borderRadius: 8,
  padding: 10,
  color: '#eef',
  fontSize: 12,
  zIndex: 10,
};

const Badge: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: 999,
  background: '#2a2f48',
  border: '1px solid #4b5070',
  marginLeft: 8,
};

const ItemCard: React.CSSProperties = {
  border: '1px solid #3a3f5a',
  borderRadius: 10,
  background: 'rgba(14,16,24,0.85)',
  color: '#dfe8ff',
  padding: 10,
};

const maskBlock = (url: string, extra?: React.CSSProperties): React.CSSProperties => ({
  position: 'absolute',
  inset: 0,
  WebkitMaskImage: `url(${url})`,
  maskImage: `url(${url})`,
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: '0 0',
  maskPosition: '0 0',
  WebkitMaskSize: '100% 100%',
  maskSize: '100% 100%',
  background: '#fff',
  pointerEvents: 'none',
  ...extra,
});

export default function FullMapBuilder() {
  const [graphs, setGraphs] = useState<Graph[]>([]);
  const [loading, setLoading] = useState<{ total: number; done: number }>({ total: 0, done: 0 });
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setError('');
        const res = await fetch(getMasterUrl(), { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to fetch Constellations.json (${res.status})`);
        const master = await res.json();

        const list: any[] = Array.isArray(master?.constellationsDetails)
          ? master.constellationsDetails
          : [];
        const base = import.meta.env.BASE_URL;
        const seen = new Map<string, number>();
        const out: Graph[] = [];

        setLoading({ total: list.length, done: 0 });

        for (let i = 0; i < list.length; i++) {
          const g = list[i];
          if (!g?.definition) continue;

          const label = englishName(g.definition);
          const slug0 = slugify(label) || slugify(String(g.definition?.id ?? 'unnamed'));
          const bump = (seen.get(slug0) ?? 0) + 1;
          seen.set(slug0, bump);
          const id = bump === 1 ? slug0 : `${slug0}-${bump}`;

          // ⚙️ robust parser call
          const pg = await callParserRobust(id, g, `${base}constellations/`);

          out.push({
            id,
            label,
            group: g,
            lineUrl: pg?.lineUrl,
            blurUrl: pg?.blurUrl,
            size: pickSize(pg),
            nodes: Array.isArray(pg?.nodes)
              ? pg.nodes.map((n: any) => ({ id: n.id, position: { x: +n.position.x, y: +n.position.y } }))
              : [],
            edges: Array.isArray(pg?.edges)
              ? pg.edges.map((e: any) => ({ source: e.source, target: e.target }))
              : [],
          });

          if (mounted) setLoading({ total: list.length, done: i + 1 });
        }

        if (!mounted) return;
        setGraphs(out);
      } catch (err: any) {
        console.error('[Builder] load error:', err);
        if (!mounted) return;
        setError(String(err?.message || err || 'Unknown error'));
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0c16', color: '#eef', position: 'relative' }}>
      <div style={Panel}>
        <b>Map Builder</b>
        <span style={Badge}>
          {loading.done}/{loading.total} loaded
        </span>
        {error && (
          <div style={{ marginTop: 8, color: '#ffb3b3' }}>
            <div style={{ fontWeight: 700 }}>Error</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{error}</div>
            <div style={{ marginTop: 6, opacity: 0.8 }}>
              Check the browser console for stack traces (parser signature / fetch path usually).
            </div>
          </div>
        )}
      </div>

      {!error && graphs.length === 0 ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: 0.85 }}>
          <div>Loading… {loading.done}/{loading.total}</div>
        </div>
      ) : (
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {graphs.map((g) => {
            const CW = g.size.width, CH = g.size.height;
            const cx = CW / 2, cy = CH / 2;

            // show the art exactly as parser specified
            const hasArt = !!(g.blurUrl || g.lineUrl);

            return (
              <div key={g.id} style={ItemCard}>
                <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{g.label}</div>
                  <code style={{ opacity: 0.7, fontSize: 11 }}>{g.id}</code>
                </div>

                <div style={{ position: 'relative', width: CW, height: CH, background: '#0b0e1c', borderRadius: 8, overflow: 'hidden' }}>
                  {hasArt && (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      {g.blurUrl && (
                        <div style={maskBlock(g.blurUrl, { background: 'rgba(185,205,225,0.75)', opacity: 0.9 })} />
                      )}
                      {g.lineUrl && (
                        <div style={maskBlock(g.lineUrl, { background: '#fff', opacity: 0.95 })} />
                      )}
                    </div>
                  )}

                  {/* Edges */}
                  <svg width={CW} height={CH} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
                    {g.edges.map((e, i) => {
                      const a = g.nodes.find(n => n.id === e.source)?.position;
                      const b = g.nodes.find(n => n.id === e.target)?.position;
                      if (!a || !b) return null;
                      const ax = Math.round(cx + a.x);
                      const ay = Math.round(cy + a.y);
                      const bx = Math.round(cx + b.x);
                      const by = Math.round(cy + b.y);
                      return <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke="rgba(185,205,225,0.55)" strokeWidth={1.5} />;
                    })}
                  </svg>

                  {/* Nodes (little dots just for previewing placement) */}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {g.nodes.map((n) => {
                      const nx = Math.round(cx + n.position.x);
                      const ny = Math.round(cy + n.position.y);
                      const s = 8;
                      return (
                        <div
                          key={n.id}
                          style={{
                            position: 'absolute',
                            left: nx - s / 2,
                            top: ny - s / 2,
                            width: s,
                            height: s,
                            borderRadius: 4,
                            background: '#fff',
                            boxShadow: '0 0 8px rgba(255,255,255,0.6)',
                          }}
                          title={n.id}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
