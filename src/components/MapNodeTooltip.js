import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
export default function MapNodeTooltip({ data, panelWidth, panelHeight, render, containerSelector, }) {
    // Nothing to render
    if (!data)
        return null;
    if (data.show === false)
        return null;
    // Read a debug flag from URL (?debugtip=1) to visualize placement
    const DEBUG = typeof window !== 'undefined' &&
        ['1', 'true', 'yes'].includes((new URLSearchParams(window.location.search).get('debugtip') || '').toLowerCase());
    // Get clamping bounds
    const container = (containerSelector && typeof document !== 'undefined'
        ? document.querySelector(containerSelector)
        : null) || (typeof document !== 'undefined' ? document.body : null);
    const bounds = container?.getBoundingClientRect() || {
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
    const wrapper = (_jsxs("div", { style: {
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
        }, children: [DEBUG && (_jsx("div", { style: {
                    position: 'absolute',
                    left: -8,
                    top: -8,
                    width: 6,
                    height: 6,
                    background: 'magenta',
                    borderRadius: 2,
                } })), _jsx("div", { style: { pointerEvents: 'auto' }, children: render(data) })] }));
    return typeof document !== 'undefined' ? createPortal(wrapper, document.body) : wrapper;
}
