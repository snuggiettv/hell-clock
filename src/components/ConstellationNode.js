import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/components/ConstellationNode.tsx
import { memo, useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals, } from "reactflow";
import "./ConstellationNode.css";
function ConstellationNode({ id, data }) {
    const updateNodeInternals = useUpdateNodeInternals();
    // Tint is the per-constellation color; CSS uses it for the plates/halo.
    const tint = data.themeColor ?? "#7aa5ff";
    // Map to the CSS state classes your stylesheet expects.
    const stateClass = data.isActivated
        ? "node-activated"
        : data.isAvailable && !data.isLocked
            ? "node-unlocked"
            : "node-locked";
    useEffect(() => {
        // Keep ports/handles layout in sync when state changes.
        updateNodeInternals(id);
    }, [id, stateClass, updateNodeInternals]);
    return (_jsxs("div", { className: "cn-root", 
        // Prevent graph drag/select when interacting with the node
        onMouseDown: (e) => e.stopPropagation(), onDoubleClick: (e) => e.stopPropagation(), onContextMenu: (e) => {
            e.preventDefault();
            e.stopPropagation();
            data.onRightClick?.();
        }, title: data.label, 
        // Only the variables your CSS needs:
        style: {
            ["--cn-size"]: "30px",
            ["--cn-tint"]: tint,
        }, children: [_jsxs("div", { style: { width: 30, height: 30, position: "relative" }, children: [_jsx("div", { className: `diamond-node ${stateClass}`, role: "button", "aria-label": data.label, "aria-pressed": !!data.isActivated, style: {
                            pointerEvents: "auto",
                            cursor: data.isActivated
                                ? "default"
                                : data.isAvailable && !data.isLocked
                                    ? "pointer"
                                    : "not-allowed",
                            position: "relative",
                            zIndex: 2,
                        }, onClick: (e) => {
                            e.stopPropagation();
                            // Shift-click -> treat as right click
                            if (e.shiftKey) {
                                data.onRightClick?.();
                            }
                            else if (data.isActivated || (data.isAvailable && !data.isLocked)) {
                                data.onClick?.();
                            }
                        }, onContextMenu: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            data.onRightClick?.();
                        }, onPointerDown: (e) => {
                            if (e.button === 2) {
                                e.preventDefault();
                                e.stopPropagation();
                                data.onRightClick?.();
                            }
                        } }), _jsx(Handle, { type: "source", id: "a", position: Position.Top, style: {
                            opacity: 0,
                            width: 0,
                            height: 0,
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            pointerEvents: "none",
                            zIndex: 0,
                        } }), _jsx(Handle, { type: "target", id: "a", position: Position.Bottom, style: {
                            opacity: 0,
                            width: 0,
                            height: 0,
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            pointerEvents: "none",
                            zIndex: 0,
                        } })] }), data.showLabels && _jsx("div", { className: "cn-label", children: data.label })] }));
}
export default memo(ConstellationNode);
