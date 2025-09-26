// src/components/MapNodeTooltip.tsx
import React from 'react';
import { createPortal } from 'react-dom';

export type TipData = {
  show: boolean;
  x: number;
  y: number;
  title: string;           // constellation name (e.g., "Expeditus")
  subtitle?: string;       // node name (e.g., "Quick Sagacity")
  iconUrl?: string;
  lines?: string[];        // generic bullet lines
  effectLines?: string[];  // effect stat lines (used by panel)
  effectValues?: number[];
  countText?: string | number; // ✅ allow number (so 0/5 shows)
  state?: 'Activated' | 'Available' | 'Locked' | string;

  // static rows shown in the big panel
  reqTotals?: { Red?: number; Green?: number; Blue?: number };
  bonusTotals?: { Red?: number; Green?: number; Blue?: number };
  showBonus?: boolean;

  // ✅ whether the requirement is already met (controls "Unlocks at" visibility)
  reqMet?: boolean;
};

type Props = {
  data: TipData | null;
  /** Clamp to this element; defaults to '#letterbox-content' */
  containerSelector?: string;
  /** Supply panel size if you render a custom panel, for better clamping */
  panelWidth?: number;
  panelHeight?: number;
  /** Custom renderer to draw a big styled panel instead of the default bubble */
  render?: (data: TipData) => React.ReactNode;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const MapNodeTooltip: React.FC<Props> = ({
  data,
  containerSelector = '#letterbox-content',
  panelWidth,
  panelHeight,
  render,
}) => {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const DEBUG_TIP = !!(params && ['1','true','yes'].includes((params.get('debugtip')||'').toLowerCase()));
  if (!data?.show) return null;
  if (DEBUG_TIP) { console.log('[Tooltip] render', data.title, data.x, data.y); }

  // Fallback fonts if CSS vars aren’t defined
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const headingFont =
    (root && getComputedStyle(root).getPropertyValue('--ui-font-heading').trim()) ||
    '"Cinzel", "Trajan Pro", Georgia, serif';
  const bodyFont =
    (root && getComputedStyle(root).getPropertyValue('--ui-font-body').trim()) ||
    '"Cormorant Garamond", "EB Garamond", Georgia, serif';

  // Bounds (letterbox if present; else viewport)
  const pad = 10;
  let leftBound = pad, topBound = pad;
  let rightBound = (typeof window !== 'undefined' ? window.innerWidth : 1024) - pad;
  let bottomBound = (typeof window !== 'undefined' ? window.innerHeight : 768) - pad;

  if (containerSelector && typeof document !== 'undefined') {
    const el = document.querySelector(containerSelector) as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      leftBound = r.left + pad;
      topBound = r.top + pad;
      rightBound = r.right - pad;
      bottomBound = r.bottom - pad;
    }
  }

  // Size: if custom panel is provided, use its fixed size to clamp.
  const defaultWidth = 320;
  const defaultHeight = Math.min(360, 48 + (data.lines?.length ?? 0) * 18);
  const width = panelWidth ?? defaultWidth;
  const height = panelHeight ?? defaultHeight;

  const left = clamp(data.x + 16, leftBound, rightBound - width);
  const top = clamp(data.y + 16, topBound, bottomBound - height);

  // Default compact bubble (fallback if no custom render)
  const bubble = (
    <div style={{ fontFamily: bodyFont }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {data.iconUrl && (
          <img src={data.iconUrl} alt="" width={24} height={24} style={{ flex: '0 0 auto', opacity: 0.95 }} />
        )}
        <div style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 15, letterSpacing: 0.2, flex: 1 }}>
          {data.title}
        </div>
        {data.state && (
          <div
            style={{
              fontSize: 11,
              opacity: 0.85,
              padding: '2px 6px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(153,170,204,0.35)',
            }}
          >
            {data.state}
          </div>
        )}
      </div>

      {!!data.lines?.length && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, lineHeight: '18px' }}>
          {data.lines.map((t, i) => (
            <li key={i} style={{ whiteSpace: 'nowrap' }}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );

  const body = (
    <div
      style={{
        position: 'fixed',
        outline: DEBUG_TIP ? '2px solid #ff00ff' : 'none',
        boxShadow: DEBUG_TIP ? '0 0 0 2px rgba(255,0,255,0.3) inset' : 'none',
        left,
        top,
        width,
        maxWidth: width,
        zIndex: 10000,
        background: render ? 'transparent' : 'rgba(10,12,22,0.96)',
        color: '#cfe1ff',
        border: render ? 'none' : '1px solid rgba(95,105,150,0.6)',
        borderRadius: render ? 0 : 10,
        boxShadow: render ? 'none' : '0 6px 20px rgba(0,0,0,0.45)',
        padding: render ? 0 : '10px 12px',
        pointerEvents: 'none',
      }}
    >
      {render ? render(data) : bubble}
    </div>
  );

  return createPortal(body, document.body);
};

export default MapNodeTooltip;
