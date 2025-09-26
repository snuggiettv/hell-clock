// src/components/MapNodeTooltip.tsx
import * as React from 'react';
import { createPortal } from 'react-dom';

export type TipData = {
  x: number;
  y: number;
  show?: boolean;
  title?: string;
  subtitle?: string;
  countText?: string;
  effectLines?: any[];
  effectValues?: any;
  iconUrl?: string;
  reqTotals?: any;
  showBonus?: boolean;
  bonusTotals?: any;
  state?: string;
  [key: string]: any;
};

type Props = {
  data: TipData | null;
  panelWidth: number;
  panelHeight: number;
  render: (d: TipData) => React.ReactNode;
  /** CSS selector for the container we clamp to; defaults to body/viewport */
  containerSelector?: string;
};

export default function MapNodeTooltip({
  data,
  panelWidth,
  panelHeight,
  render,
  containerSelector,
}: Props) {
  // Nothing to render
  if (!data) return null;
  if (data.show === false) return null;

  // Read a debug flag from URL (?debugtip=1) to visualize placement
  const DEBUG =
    typeof window !== 'undefined' &&
    ['1', 'true', 'yes'].includes((new URLSearchParams(window.location.search).get('debugtip') || '').toLowerCase());

  // Get clamping bounds
  const container =
    (containerSelector && typeof document !== 'undefined'
      ? (document.querySelector(containerSelector) as HTMLElement | null)
      : null) || (typeof document !== 'undefined' ? document.body : null);

  const bounds =
    container?.getBoundingClientRect() || {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight,
    };

  // Preferred placement: to the right of cursor; fallback to left if overflowing
  const margin = 12;
  const pointerPadX = 16;
  const pointerPadY = 12;

  let left = data.x + pointerPadX;
  let top = data.y + pointerPadY;

  // If panel would overflow right, flip to left side
  if (left + panelWidth + margin > bounds.right) {
    left = Math.max(bounds.left + margin, data.x - panelWidth - pointerPadX);
  }

  // Clamp vertical position within container
  const minTop = bounds.top + margin;
  const maxTop = bounds.bottom - panelHeight - margin;
  top = Math.min(Math.max(top, minTop), maxTop);

  // Clamp horizontal within container
  left = Math.min(Math.max(left, bounds.left + margin), bounds.right - panelWidth - margin);

  const wrapper = (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        width: panelWidth,
        maxWidth: panelWidth,
        zIndex: 10000,
        pointerEvents: 'none',
        transform: 'translateZ(0)',
        outline: DEBUG ? '2px solid magenta' : 'none',
        boxShadow: DEBUG ? '0 0 0 2px rgba(255,0,255,0.25) inset' : 'none',
      }}
    >
      {DEBUG && (
        <div
          style={{
            position: 'absolute',
            left: -8,
            top: -8,
            width: 6,
            height: 6,
            background: 'magenta',
            borderRadius: 2,
          }}
        />
      )}
      <div style={{ pointerEvents: 'auto' }}>{render(data)}</div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(wrapper, document.body) : wrapper;
}
