// src/components/MapTooltipPanel.tsx
import * as React from 'react';

// --- affix override loader kept (unused by body text now, but harmless) ---
function useAffixOverrides() {
  const [ov, setOv] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/affix-overrides.json?ts=${Date.now()}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : {}))
      .then(setOv)
      .catch(() => setOv({}));
  }, []);
  return ov;
}

const BASE = import.meta.env.BASE_URL;
const IMG_TOP         = `${BASE}ui/tooltip/panel_top.png`;        // 484 x 372
const IMG_MID         = `${BASE}ui/tooltip/panel_mid.png`;        // 484 x 12 (repeat-y)
const IMG_BOTTOM      = `${BASE}ui/tooltip/panel_bottom.png`;     // 484 x 35
const IMG_COMPLETION  = `${BASE}ui/tooltip/panel_completion.png`; // 484 x 76

// Constants (keep your exact sizes)
const TOP_H = 372;
const BOTTOM_H = 35;
const COUNT_BLOCK_H = 54;
const COMPLETION_H = 76;

// visual tweaks
const TITLE_PAD_TOP = 40;
const MID_PAD_V     = 4;
const CHIP_Y        = -10;
const CHIP_X        = 10;

const ICON_TOP_GAP = 45;
const ICON_SIZE    = 112;
const SUBTITLE_TOP_GAP = 40;

type RGB = { Red?: number; Green?: number; Blue?: number };
const DEV_ICON = {
  Red:   `${BASE}ui/devotion-fury.png`,
  Green: `${BASE}ui/devotion-discipline.png`,
  Blue:  `${BASE}ui/devotion-faith.png`,
};

// --- typed keys for RGB; keeps literals from widening to string ---
const KEYS = ['Red', 'Green', 'Blue'] as const;
type RGBKey = typeof KEYS[number];

export default function MapTooltipPanel({
  title,
  subtitle,
  countText,
  iconUrl,

  // body text:
  effectLines = [],                    // existing prop (kept)
  rawAffixDescriptions,               // NEW optional prop: prefer raw descriptions when provided
  effectValues,
  // requirements / unlock row
  reqTotals,
  reqLabel = 'Unlocks at',
  reqMet = false,

  // completion chips
  showBonus,
  bonusTotals,

  // special bottom art cases
  isConstellationComplete = false,
  isThreeMarys = false,
}: {
  title: string;
  subtitle?: string;
  countText?: string | number;
  iconUrl?: string;

  effectLines?: string[];
  rawAffixDescriptions?: string[];
  effectValues?: any;
  
  reqTotals?: RGB;
  reqLabel?: string;
  reqMet?: boolean;

  showBonus?: boolean;
  bonusTotals?: RGB;

  isConstellationComplete?: boolean;
  isThreeMarys?: boolean;
}) {
  useAffixOverrides(); // keep loading once (no longer used to transform text)

  const heading =
    getComputedStyle(document.documentElement).getPropertyValue('--ui-font-heading').trim() ||
    '"Cinzel","Trajan Pro",Georgia,serif';
  const body =
    getComputedStyle(document.documentElement).getPropertyValue('--ui-font-body').trim() ||
    '"Cormorant Garamond","EB Garamond",Georgia,serif';

  // ✅ VERBATIM BODY TEXT (no math, no templating, no overrides)
  const lines = React.useMemo(() => {
    const preferred = (rawAffixDescriptions && rawAffixDescriptions.length)
      ? rawAffixDescriptions
      : effectLines;
    return preferred.map(s => String(s ?? '').trim()).filter(Boolean);
  }, [rawAffixDescriptions, effectLines]);

  const hasReq     = !!reqTotals && ((reqTotals.Red||0)+(reqTotals.Green||0)+(reqTotals.Blue||0) > 0);
  const showReqRow = hasReq && !reqMet;        // hide unlock row when requirement is met
  const hasBonus   = !!(showBonus && bonusTotals && ((bonusTotals.Red||0)+(bonusTotals.Green||0)+(bonusTotals.Blue||0) > 0));

  // choose bottom image (use completion art unless forced to plain bottom)
  const forceBottom = isConstellationComplete || isThreeMarys;
  const bottomImg   = (!forceBottom && hasBonus) ? IMG_COMPLETION : IMG_BOTTOM;

  // --- ChipRow (typed) ---
  const ChipRow: React.FC<{ totals: RGB }> = ({ totals }) => {
    const t = totals as Record<RGBKey, number | undefined>;
    const items: Array<{ k: RGBKey; v: number }> =
      KEYS.map(k => ({ k, v: Number(t[k] || 0) })).filter(i => i.v > 0);

    if (!items.length) return null;

    const COLOR: Record<RGBKey, string> = {
      Red: '#ff6b6b',
      Green: '#8bd16a',
      Blue: '#5cc9ff',
    };

    return (
      <div style={{ display:'flex', gap:14, alignItems:'center' }}>
        {items.map(({k,v}) => (
          <div key={k} style={{ display:'flex', gap:6, alignItems:'center' }}>
            <img src={DEV_ICON[k]} width={18} height={18} alt="" />
            <span style={{ fontWeight:700, color:COLOR[k] }}>{v}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      style={{
        position:'relative',
        width: 484,                         // your exact panel width
        pointerEvents:'auto',
        color:'#c7d2e4',
        textShadow:'0 1px 0 rgba(0,0,0,0.5)',
      }}
      // hard-stop map zoom/pan while cursor is over the tooltip
      onWheelCapture={(e)=>{ e.preventDefault(); e.stopPropagation(); }}
      onPointerDownCapture={(e)=>{ e.stopPropagation(); }}
      onPointerMoveCapture={(e)=>{ e.stopPropagation(); }}
      onTouchMoveCapture={(e)=>{ e.preventDefault(); e.stopPropagation(); }}
    >
      {/* TOP CAP (fixed 372px) */}
      <div
        style={{
          height: TOP_H,
          background: `url(${IMG_TOP}) center top / 100% ${TOP_H}px no-repeat`,
          position: 'relative',
        }}
      >
        {/* Lock the header stack so layout never shifts */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: TITLE_PAD_TOP, textAlign: 'center' }}>
          {/* Title */}
          <div
            style={{
              fontFamily: heading,
              fontWeight: 900,
              fontSize: 24,
              letterSpacing: 0.5,
              color: '#f0d3b2',
            }}
          >
            {title}
          </div>

          {/* Reserved slot for 0/5 (always same height) */}
          <div
            style={{
              height: COUNT_BLOCK_H,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            {(countText !== undefined && countText !== null) && (
              <div
                style={{
                  fontFamily: heading,
                  fontWeight: 700,
                  fontSize: 18,
                  color: '#e8e6dd',
                }}
              >
                {String(countText)}
              </div>
            )}
          </div>

          {/* Icon */}
          {iconUrl && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: ICON_TOP_GAP }}>
              <SmartIcon srcLike={iconUrl} size={ICON_SIZE} />
            </div>
          )}

          {/* Subtitle */}
          {subtitle && (
            <div
              style={{
                marginTop: SUBTITLE_TOP_GAP,
                fontFamily: heading,
                fontWeight: 800,
                fontSize: 26,
                color: '#d7d7d1',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* MID (repeat-y; holds body text) */}
      <div
        style={{
          backgroundImage: `url(${IMG_MID})`,
          backgroundRepeat: 'repeat-y',
          backgroundSize: '100% auto',
          backgroundPosition: 'center top',
          padding: `${MID_PAD_V}px 18px ${MID_PAD_V}px`,
        }}
      >
        {(showReqRow || lines.length) && (
          <div
            style={{
              textAlign:'center',
              fontFamily: body,
              fontSize: 20,
              lineHeight: '28px',
              color:'#e6e6e6',
              whiteSpace:'pre-wrap',        // preserve JSON line breaks verbatim
            }}
          >
            {showReqRow && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:10 }}>
                <span style={{ fontFamily: heading, fontWeight:700, fontSize:14, opacity:.9 }}>
                  {reqLabel}:</span>
                <div style={{ marginLeft:16 }}>
                  <ChipRow totals={reqTotals!} />
                </div>
              </div>
            )}
            {lines.map((t,i)=><div key={i}>{t}</div>)}
          </div>
        )}
      </div>

      {/* BOTTOM (either plain bottom or completion version) */}
      <div
        style={{
          height: (!forceBottom && hasBonus) ? COMPLETION_H : BOTTOM_H,
          background: `url(${(!forceBottom && hasBonus) ? IMG_COMPLETION : IMG_BOTTOM}) center bottom / 100% ${(!forceBottom && hasBonus) ? `${COMPLETION_H}px` : `${BOTTOM_H}px`} no-repeat`,
          position: 'relative',
        }}
      >
        {/* overlay chips when we are using the completion image */}
        {(!forceBottom && hasBonus) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `translate(${CHIP_X}px, ${CHIP_Y}px)`,
            }}
          >
            <ChipRow totals={bonusTotals!} />
          </div>
        )}
      </div>
    </div>
  );
}

// --- helper image loader kept intact ---
function buildIconCandidates(input?: string): string[] {
  if (!input) return [];
  if (/^https?:|^\//.test(input)) return [input];
  const base = `${BASE}ui/icons/`;
  const k = input.replace(/^Icon_/,'');
  const lower = input.toLowerCase(), lowerK = k.toLowerCase();
  return [
    `${base}${input}.png`, `${base}${input}.webp`,
    `${base}${k}.png`,     `${base}${k}.webp`,
    `${base}${lower}.png`, `${base}${lower}.webp`,
    `${base}${lowerK}.png`,`${base}${lowerK}.webp`,
  ];
}

const SmartIcon: React.FC<{ srcLike?: string; size?: number }> = ({ srcLike, size = 112 }) => {
  const c = React.useMemo(() => buildIconCandidates(srcLike), [srcLike]);
  const [i, setI] = React.useState(0);
  const src = c[i]; if (!src) return null;
  return (
    <img
      src={src} width={size} height={size} alt="" draggable={false}
      onError={() => setI(n => (n + 1 < c.length ? n + 1 : n))}
      style={{ filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.5))' }}
    />
  );
};
