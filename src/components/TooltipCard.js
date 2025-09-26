import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { formatStatDisplay } from '../utils/formatStatDisplay';
import { calculateCumulativeValue } from '../utils/calculateCumulativeValue';
const TooltipCard = ({ tooltip }) => {
    const { label, rank, maxRank, icon, x, y, value, valuePerLevel, isPercent, statKey, modifierType = 'Additive', shouldSkipScaling = false, affixes = [], } = tooltip;
    const clampedRank = Math.max(0, Math.min(rank, maxRank));
    const currentValue = shouldSkipScaling
        ? value
        : calculateCumulativeValue({ rank, value, valuePerLevel, modifierType });
    const nextValue = !shouldSkipScaling && rank < maxRank
        ? calculateCumulativeValue({ rank: rank + 1, value, valuePerLevel, modifierType })
        : currentValue;
    const hasMeaningfulCurrent = !shouldSkipScaling && clampedRank > 0;
    const hasMeaningfulNext = !shouldSkipScaling && clampedRank < maxRank;
    const formattedCurrent = hasMeaningfulCurrent
        ? formatStatDisplay(currentValue, isPercent, modifierType)
        : '';
    const formattedNext = hasMeaningfulNext
        ? formatStatDisplay(nextValue, isPercent, modifierType)
        : '';
    const fallbackLabel = affixes?.[0]?.description?.find((d) => d.langCode === 'en')?.langTranslation || 'Unknown Stat';
    const formattedStatKey = statKey
        ? statKey
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
            .replace(/^./, (s) => s.toUpperCase())
        : fallbackLabel;
    return (_jsxs("div", { style: {
            position: 'absolute',
            left: x,
            top: y,
            zIndex: 9999,
            background: '#141018',
            color: 'white',
            padding: '18px',
            borderRadius: 12,
            border: '2px solid #b983ff',
            width: 300,
            fontFamily: 'inherit',
            boxShadow: '0 0 12px rgba(0,0,0,0.5)',
        }, children: [_jsx("div", { style: {
                    fontSize: 30,
                    fontWeight: 'bold',
                    marginBottom: 6,
                    textAlign: 'center',
                    borderBottom: '1px solid #444',
                    paddingBottom: 6,
                }, children: label }), _jsxs("div", { style: { textAlign: 'center', fontSize: 22, color: '#aaa', marginBottom: 40 }, children: ["(", clampedRank, " / ", maxRank, ")"] }), _jsx("div", { style: { display: 'flex', justifyContent: 'center', marginBottom: 30 }, children: _jsx("div", { style: {
                        width: 64,
                        height: 64,
                        backgroundColor: '#111',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 6px #332244',
                    }, children: _jsx("img", { src: `${import.meta.env.BASE_URL}ui/${icon}`, alt: label, style: { width: 110, height: 110, marginBottom: 0 } }) }) }), _jsxs("div", { style: {
                    background: '#1f1924',
                    padding: '12px',
                    borderRadius: 8,
                    textAlign: 'center',
                    border: '1px solid #444',
                    fontSize: 24,
                    fontWeight: 500,
                    color: '#ffffff',
                    marginTop: 15,
                    marginBottom: 10,
                }, children: [hasMeaningfulCurrent && (_jsxs("div", { children: [formattedStatKey, " ", formattedCurrent] })), hasMeaningfulNext && (_jsxs("div", { style: { marginTop: clampedRank > 0 ? 8 : 0, textAlign: 'left' }, children: [_jsx("div", { style: {
                                    fontSize: 16,
                                    textTransform: 'uppercase',
                                    color: '#aaa',
                                    marginBottom: 4,
                                    marginTop: 10,
                                }, children: "Next Rank:" }), _jsxs("div", { style: {
                                    fontSize: 16,
                                    color: '#b983ff',
                                    background: '#141018',
                                    border: '1px solid #333',
                                    padding: '8px 12px',
                                    borderRadius: 4,
                                    display: 'block',
                                    width: '90%',
                                    textAlign: 'center',
                                }, children: [formattedStatKey, " ", formattedNext] })] })), shouldSkipScaling && (_jsxs(_Fragment, { children: [_jsx("div", { children: formattedStatKey }), _jsx("div", { style: {
                                    textAlign: 'center',
                                    fontSize: 13,
                                    color: '#aaa',
                                    paddingTop: 8,
                                    fontStyle: 'italic',
                                }, children: "Special stat \u2014 not rank-scaled" })] }))] })] }));
};
export default TooltipCard;
