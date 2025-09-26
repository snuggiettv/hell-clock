import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/**
 * Tooltip that clamps within a given container (by CSS selector).
 * If no container is found, falls back to the window viewport.
 */
const NodeTooltip = ({ data, containerSelector, }) => {
    if (!data?.show)
        return null;
    // layout
    const pad = 10;
    const width = 320;
    const height = Math.min(360, 48 + (data.lines?.length ?? 0) * 18);
    // find clamp container (letterbox content), else window
    let leftBound = pad;
    let topBound = pad;
    let rightBound = (typeof window !== 'undefined' ? window.innerWidth : width) - pad;
    let bottomBound = (typeof window !== 'undefined' ? window.innerHeight : height) - pad;
    if (containerSelector && typeof document !== 'undefined') {
        const el = document.querySelector(containerSelector);
        if (el) {
            const r = el.getBoundingClientRect();
            leftBound = r.left + pad;
            topBound = r.top + pad;
            rightBound = r.right - pad;
            bottomBound = r.bottom - pad;
        }
    }
    const left = clamp(data.x + 16, leftBound, rightBound - width);
    const top = clamp(data.y + 16, topBound, bottomBound - height);
    const body = (_jsxs("div", { style: {
            position: 'fixed',
            left,
            top,
            width,
            maxWidth: width,
            zIndex: 10000,
            background: 'rgba(10,12,22,0.96)',
            color: '#cfe1ff',
            border: '1px solid rgba(95,105,150,0.6)',
            borderRadius: 10,
            boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
            padding: '10px 12px',
            pointerEvents: 'none',
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }, children: [data.iconUrl && (_jsx("img", { src: data.iconUrl, alt: "", width: 24, height: 24, style: { flex: '0 0 auto', opacity: 0.95 } })), _jsx("div", { style: { fontWeight: 700, fontSize: 15, letterSpacing: 0.2, flex: 1 }, children: data.title }), data.state && (_jsx("div", { style: {
                            fontSize: 11,
                            opacity: 0.85,
                            padding: '2px 6px',
                            borderRadius: 999,
                            background: 'rgba(255,255,255,0.12)',
                            border: '1px solid rgba(153,170,204,0.35)',
                        }, children: data.state }))] }), !!data.lines?.length && (_jsx("ul", { style: { listStyle: 'none', padding: 0, margin: 0, fontSize: 13, lineHeight: '18px' }, children: data.lines.map((t, i) => (_jsx("li", { style: { whiteSpace: 'nowrap' }, children: t }, i))) }))] }));
    return createPortal(body, document.body);
};
export default NodeTooltip;
