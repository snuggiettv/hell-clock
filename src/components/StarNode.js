import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/components/StarNode.tsx
import { useMemo, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import './ConstellationNode.css';
const StarNode = ({ data }) => {
    const ref = useRef(null);
    const state = data.getState
        ? data.getState()
        : data.isLocked
            ? 'Locked'
            : data.rank >= data.maxRank
                ? 'Activated'
                : 'Available';
    const className = useMemo(() => {
        if (state === 'Activated')
            return 'star activated';
        if (state === 'Available')
            return 'star available';
        return 'star locked';
    }, [state]);
    const onClick = () => data.onClick?.(data.id);
    const onContextMenu = (e) => {
        e.preventDefault();
        data.onRightClick?.(data.id);
    };
    const onMouseEnter = () => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect)
            data.onHover?.(rect, state);
    };
    const onMouseLeave = () => data.onHoverOut?.();
    return (_jsxs("div", { ref: ref, className: className, onClick: onClick, onContextMenu: onContextMenu, onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave, style: {
            width: 24,
            height: 24,
            borderRadius: 4,
            transform: 'rotate(45deg)',
            border: state === 'Locked' ? '2px solid #4b2e6d' : '2px solid #eae7ff',
            background: state === 'Locked' ? '#150b20' : '#ffffff',
            boxShadow: state === 'Activated'
                ? '0 0 14px rgba(255,255,255,0.9)'
                : state === 'Available'
                    ? '0 0 10px rgba(168, 85, 247, 0.6)'
                    : 'none',
            cursor: state === 'Locked' ? 'not-allowed' : 'pointer',
        }, title: data.label, children: [_jsx(Handle, { type: "source", position: Position.Right, id: "a", style: { opacity: 0 } }), _jsx(Handle, { type: "target", position: Position.Left, id: "a", style: { opacity: 0 } })] }));
};
export default StarNode;
