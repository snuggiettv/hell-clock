import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const MapNodeTooltip = ({ data, containerSelector = '#letterbox-content', panelWidth, panelHeight, render, }) => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const DEBUG_TIP = !!(params && ['1', 'true', 'yes'].includes((params.get('debugtip') || '').toLowerCase()));
    if (!data?.show)
        return null;
    if (DEBUG_TIP) {
        console.log('[Tooltip] render', data.title, data.x, data.y);
    }
    // Fallback fonts if CSS vars aren’t defined
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    const headingFont = (root && getComputedStyle(root).getPropertyValue('--ui-font-heading').trim()) ||
        '"Cinzel", "Trajan Pro", Georgia, serif';
    const bodyFont = (root && getComputedStyle(root).getPropertyValue('--ui-font-body').trim()) ||
        '"Cormorant Garamond", "EB Garamond", Georgia, serif';
    // Bounds (letterbox if present; else viewport)
    const pad = 10;
    let leftBound = pad, topBound = pad;
    let rightBound = (typeof window !== 'undefined' ? window.innerWidth : 1024) - pad;
    let bottomBound = (typeof window !== 'undefined' ? window.innerHeight : 768) - pad;
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
    // Size: if custom panel is provided, use its fixed size to clamp.
    const defaultWidth = 320;
    const defaultHeight = Math.min(360, 48 + (data.lines?.length ?? 0) * 18);
    const width = panelWidth ?? defaultWidth;
    const height = panelHeight ?? defaultHeight;
    const left = clamp(data.x + 16, leftBound, rightBound - width);
    const top = clamp(data.y + 16, topBound, bottomBound - height);
    // Default compact bubble (fallback if no custom render)
    const bubble = (_jsxs("div", { style: { fontFamily: bodyFont }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }, children: [data.iconUrl && (_jsx("img", { src: data.iconUrl, alt: "", width: 24, height: 24, style: { flex: '0 0 auto', opacity: 0.95 } })), _jsx("div", { style: { fontFamily: headingFont, fontWeight: 700, fontSize: 15, letterSpacing: 0.2, flex: 1 }, children: data.title }), data.state && (_jsx("div", { style: {
                            fontSize: 11,
                            opacity: 0.85,
                            padding: '2px 6px',
                            borderRadius: 999,
                            background: 'rgba(255,255,255,0.12)',
                            border: '1px solid rgba(153,170,204,0.35)',
                        }, children: data.state }))] }), !!data.lines?.length && (_jsx("ul", { style: { listStyle: 'none', padding: 0, margin: 0, fontSize: 13, lineHeight: '18px' }, children: data.lines.map((t, i) => (_jsx("li", { style: { whiteSpace: 'nowrap' }, children: t }, i))) }))] }));
    const body = (_jsx("div", { style: {
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
        }, children: render ? render(data) : bubble }));
    return createPortal(body, document.body);
};
export default MapNodeTooltip;
