import React, { useRef } from 'react';
import { Handle, Position } from 'reactflow';

interface SkillNodeProps {
  id: string;
  data: {
    label: string;
    icon: string;
    rank: number;
    maxRank: number;
    statKey: string;
    value: number;
    valuePerLevel: number;
    modifierType: 'Additive' | 'Multiplicative';
    isPercent: boolean;
    isNegative: boolean;
    affixes: any[];
    isLocked: boolean;
    onClick?: (id: string) => void;
    onRightClick?: (id: string) => void;
    onHover?: (tooltip: any) => void;
  };
}

export default function SkillNode({ id, data }: SkillNodeProps) {
  const { isLocked, rank, maxRank } = data;
  const isMaxed = rank >= maxRank;

  const rafId = useRef<number | null>(null);
  const lastMouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const showTooltip = (clientX: number, clientY: number, overrideRank = rank) => {
    const tooltipWidth = 260;
    const tooltipHeight = 220;
    const padding = 10;

    let x = clientX + 12;
    let y = clientY;

    if (x + tooltipWidth + padding > window.innerWidth) {
      x = clientX - tooltipWidth - 12;
    }
    if (y + tooltipHeight + padding > window.innerHeight) {
      y = clientY - tooltipHeight - 12;
    }

    x = Math.max(padding, Math.min(x, window.innerWidth - tooltipWidth - padding));
    y = Math.max(padding, Math.min(y, window.innerHeight - tooltipHeight - padding));

    const safeRank = Math.max(0, Math.min(overrideRank, maxRank));
    const affix = data.affixes?.[0];

    const modifierType = affix?.statModifierType ?? 'Additive';
    const baseValue = affix?.value ?? 0;
    const valuePerLevel = affix?.valuePerLevel ?? 0;

    const description = affix?.description?.find((d: any) => d.langCode === 'en')?.langTranslation || '';
    const containsPercent = description.includes('%');

    const isPercent = containsPercent && valuePerLevel === 0;
    const isNegative = affix?.isNegative ?? (modifierType === 'Multiplicative' ? baseValue < 1 : baseValue < 0);

    data.onHover?.({
      id,
      label: data.label,
      rank: safeRank,
      maxRank,
      icon: data.icon,
      statKey: data.statKey,
      value: baseValue,
      valuePerLevel,
      isPercent,
      isNegative,
      modifierType,
      affixes: data.affixes,
      x,
      y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    lastMouse.current = { x: e.clientX, y: e.clientY };
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        showTooltip(lastMouse.current.x, lastMouse.current.y);
        rafId.current = null;
      });
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    showTooltip(e.clientX, e.clientY);
  };

  const handleMouseLeave = () => {
    data.onHover?.(null);
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  };

  const handleClick = () => {
    if (!isLocked && rank < maxRank) {
      data.onClick?.(id);
      if (lastMouse.current) {
        showTooltip(lastMouse.current.x, lastMouse.current.y, rank + 1);
      }
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (rank > 0) {
      data.onRightClick?.(id);
      if (lastMouse.current) {
        showTooltip(lastMouse.current.x, lastMouse.current.y, rank - 1);
      }
    }
  };

  const filter =
    isLocked ? 'brightness(0.6) grayscale(0.8)' :
    isMaxed ? 'brightness(1.2) contrast(1.2)' :
    'invert(5%) sepia(90%) saturate(100%) hue-rotate(270deg)';

  return (
    <div
      onClick={handleClick}
      onContextMenu={handleRightClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{
        width: 70,
        height: 70,
        borderRadius: '50%',
        border: '2px solid #888',
        backgroundColor: isLocked ? '#111' : '#222',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        filter: isLocked ? 'brightness(0.7) saturate(0.8)' : 'none',
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}/ui/${data.icon}`}
        alt={data.label}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          objectFit: 'cover',
          filter,
          border:
            isMaxed ? '2px solid white' :
            !isLocked ? '2px solid #d47aff' : '2px solid #555',
          boxShadow:
            isMaxed ? '0 0 6px white' :
            !isLocked ? '0 0 4px #800080' : 'none',
        }}
      />

      {isLocked && (
      <div
        style={{
          position: 'absolute',
          top: -8, // adjust this upward
          right: 0,
          backgroundColor: '#111',
          borderRadius: '50%',
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          color: 'white',
          cursor: 'not-allowed',
          zIndex: 10,
        }}
      >
        🔒
      </div>
      )}

      <div style={{
        position: 'absolute',
        bottom: -22,
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#191420',
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: 18,
        border: '2px solid #800080',
        color: '#fff',
        whiteSpace: 'nowrap',
      }}>
        {rank} / {maxRank}
      </div>

      <Handle type="source" position={Position.Top} id="a"
        style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="target" position={Position.Top} id="a"
        style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
    </div>
  );
}
