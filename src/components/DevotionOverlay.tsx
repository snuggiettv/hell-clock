import * as React from 'react';
import DevotionPaths from '../assets/DevotionPaths.png';

export type RGB = { Red: number; Green: number; Blue: number };

type Anchors = {
  red:   { x: number; y: number };
  green: { x: number; y: number };
  blue:  { x: number; y: number };
};

type Props = {
  totals: RGB;
  containerRef: React.RefObject<HTMLElement>; 
  inset?: number;
  insetTop?: number;
  insetLeft?: number;
};

const BASE_W = 512;
const BASE_H = 226;

// Defaults (you can tweak these)
const DEFAULTS: Anchors = {
  red:   { x: 0.344, y: 0.78 },
  green: { x: 0.49,  y: 0.78 },
  blue:  { x: 0.65,  y: 0.78 },
};

// SAFE query parser: null/"" -> fallback
function qpNum(qs: URLSearchParams, key: string, fallback: number) {
  const raw = qs.get(key);
  if (raw === null || raw.trim() === '') return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

const DevotionOverlay: React.FC<Props> = ({ 
    totals, 
    containerRef,
    inset = 24,
    insetTop = 90,
    insetLeft = -100,
  }) => {
  const top = insetTop ?? inset;
  const left = insetLeft ?? inset;

  const qs = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();

  // Overall scale (1 = 512x226). Clamp so it never collapses.
  const scaleRaw = qpNum(qs, 'ov', 1.2);
  const scale    = Math.max(0.5, Math.min(scaleRaw, 3));
  const W = Math.round(BASE_W * scale);
  const H = Math.round(BASE_H * scale);

  // Anchors (0..1) with safe fallbacks
  const anchors: Anchors = {
    red:   { x: qpNum(qs, 'rx', DEFAULTS.red.x),   y: qpNum(qs, 'ry', DEFAULTS.red.y) },
    green: { x: qpNum(qs, 'gx', DEFAULTS.green.x), y: qpNum(qs, 'gy', DEFAULTS.green.y) },
    blue:  { x: qpNum(qs, 'bx', DEFAULTS.blue.x),  y: qpNum(qs, 'by', DEFAULTS.blue.y) },
  };

  const fontPx = Math.max(14, Math.min(Math.round(W * 0.10), 26));

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width: W,
        height: H,
        zIndex: 20,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      <img
        src={DevotionPaths}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
        }}
      />

      {/* Fury */}
      <div style={{
        position: 'absolute',
        top:  `${anchors.red.y * 100}%`,
        left: `${anchors.red.x * 100}%`,
        transform: 'translate(-50%, -50%)',
        fontWeight: 800,
        fontSize: fontPx,
        color: '#ff6a6a',
        textShadow: '0 0 6px rgba(0,0,0,0.8)',
      }}>
        {totals.Red ?? 0}
      </div>

      {/* Discipline */}
      <div style={{
        position: 'absolute',
        top:  `${anchors.green.y * 100}%`,
        left: `${anchors.green.x * 100}%`,
        transform: 'translate(-50%, -50%)',
        fontWeight: 800,
        fontSize: fontPx,
        color: '#67ff9b',
        textShadow: '0 0 6px rgba(0,0,0,0.8)',
      }}>
        {totals.Green ?? 0}
      </div>

      {/* Faith */}
      <div style={{
        position: 'absolute',
        top:  `${anchors.blue.y * 100}%`,
        left: `${anchors.blue.x * 100}%`,
        transform: 'translate(-50%, -50%)',
        fontWeight: 800,
        fontSize: fontPx,
        color: '#8ac7ff',
        textShadow: '0 0 6px rgba(0,0,0,0.8)',
      }}>
        {totals.Blue ?? 0}
      </div>
    </div>
  );
};

export default DevotionOverlay;
