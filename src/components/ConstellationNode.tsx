// src/components/ConstellationNode.tsx
import { memo, useEffect } from "react";
import {
  Handle,
  Position,
  type NodeProps,
  useUpdateNodeInternals,
} from "reactflow";
import "./ConstellationNode.css";

type NodeData = {
  label: string;
  themeColor?: string;
  isLocked?: boolean;
  isActivated?: boolean;
  isAvailable?: boolean;
  isComplete?: boolean;
  showLabels?: boolean;
  onClick?: () => void;
  onRightClick?: () => void;
};

function ConstellationNode({ id, data }: NodeProps<NodeData>) {
  const updateNodeInternals = useUpdateNodeInternals();

  // Tint is the per-constellation color; CSS uses it for the plates/halo.
  const tint = data.themeColor ?? "#7aa5ff";

  // Map to the CSS state classes your stylesheet expects.
  const stateClass =
    data.isActivated
      ? "node-activated"
      : data.isAvailable && !data.isLocked
      ? "node-unlocked"
      : "node-locked";

  useEffect(() => {
    // Keep ports/handles layout in sync when state changes.
    updateNodeInternals(id);
  }, [id, stateClass, updateNodeInternals]);

  return (
    <div
      className="cn-root"
      // Prevent graph drag/select when interacting with the node
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        data.onRightClick?.();
      }}
      title={data.label}
      // Only the variables your CSS needs:
      style={
        {
          ["--cn-size" as any]: "30px",
          ["--cn-tint" as any]: tint,
        } as React.CSSProperties
      }
    >
      <div style={{ width: 30, height: 30, position: "relative" }}>
        <div
          className={`diamond-node ${stateClass}`}
          role="button"
          aria-label={data.label}
          aria-pressed={!!data.isActivated}
          style={{
            pointerEvents: "auto",
            cursor: data.isActivated
              ? "default"
              : data.isAvailable && !data.isLocked
              ? "pointer"
              : "not-allowed",
            position: "relative",
            zIndex: 2,
          }}
          onClick={(e) => {
            e.stopPropagation();
            // Shift-click -> treat as right click
            if (e.shiftKey) {
              data.onRightClick?.();
            } else if (data.isActivated || (data.isAvailable && !data.isLocked)) {
              data.onClick?.();
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            data.onRightClick?.();
          }}
          onPointerDown={(e) => {
            if (e.button === 2) {
              e.preventDefault();
              e.stopPropagation();
              data.onRightClick?.();
            }
          }}
        />

        {/* Keep handles present for edge routing, but invisible and centered */}
        <Handle
          type="source"
          id="a"
          position={Position.Top}
          style={{
            opacity: 0,
            width: 0,
            height: 0,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <Handle
          type="target"
          id="a"
          position={Position.Bottom}
          style={{
            opacity: 0,
            width: 0,
            height: 0,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      </div>

      {data.showLabels && <div className="cn-label">{data.label}</div>}
    </div>
  );
}

export default memo(ConstellationNode);
