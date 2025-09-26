// src/components/StarNode.tsx
import React, { useMemo, useRef } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import './ConstellationNode.css';

type StarNodeData = {
  id: string;
  label: string;
  rank: number;
  maxRank: number;
  isLocked: boolean;
  sprite?: string;
  slug?: string;
  align?: { x: number; y: number; scale: number };
  onClick?: (id: string) => void;
  onRightClick?: (id: string) => void;
  onHover?: (rect: DOMRect, state: 'Locked' | 'Available' | 'Activated') => void;
  onHoverOut?: () => void;
  getState?: () => 'Locked' | 'Available' | 'Activated'; // now optional
};

const StarNode: React.FC<NodeProps<StarNodeData>> = ({ data }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  const state = data.getState
    ? data.getState()
    : data.isLocked
    ? 'Locked'
    : data.rank >= data.maxRank
    ? 'Activated'
    : 'Available';

  const className = useMemo(() => {
    if (state === 'Activated') return 'star activated';
    if (state === 'Available') return 'star available';
    return 'star locked';
  }, [state]);

  const onClick = () => data.onClick?.(data.id);
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    data.onRightClick?.(data.id);
  };

  const onMouseEnter = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) data.onHover?.(rect, state);
  };
  const onMouseLeave = () => data.onHoverOut?.();

  return (
    <div
      ref={ref}
      className={className}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        transform: 'rotate(45deg)',
        border: state === 'Locked' ? '2px solid #4b2e6d' : '2px solid #eae7ff',
        background: state === 'Locked' ? '#150b20' : '#ffffff',
        boxShadow:
          state === 'Activated'
            ? '0 0 14px rgba(255,255,255,0.9)'
            : state === 'Available'
            ? '0 0 10px rgba(168, 85, 247, 0.6)'
            : 'none',
        cursor: state === 'Locked' ? 'not-allowed' : 'pointer',
      }}
      title={data.label}
    >
      <Handle type="source" position={Position.Right} id="a" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} id="a" style={{ opacity: 0 }} />
    </div>
  );
};

export default StarNode;
