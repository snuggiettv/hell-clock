import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import ReactFlow, { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import fuzzysort from 'fuzzysort';
import SkillNode from './components/SkillNode';
import TooltipCard from './components/TooltipCard';
import StatSummary from './components/StatSummary';
import useTagFilter from './utils/useTagFilter';
import TreeSelector from './components/TreeSelector';
import AutoCenter from './components/AutoCenter';
import { formatStatName } from './utils/formatStatName';
import DebugConstellationAudit from './components/DebugConstellationAudit';
_jsx(DebugConstellationAudit, {});
function DiamondEdge({ sourceX, sourceY, targetX, targetY, data }) {
    const required = parseInt(data?.requiredRank || '0', 10);
    const current = parseInt(data?.currentRank || '0', 10);
    const diamondSize = 7;
    const spacing = 4;
    const bgPadding = 4;
    const centerX = (sourceX + targetX) / 2;
    const centerY = (sourceY + targetY) / 2;
    const totalWidth = required * (diamondSize + spacing) - spacing;
    const startX = centerX - totalWidth / 2;
    const backgroundBoxWidth = totalWidth + bgPadding * 2;
    const backgroundBoxHeight = diamondSize + bgPadding * 2;
    return (_jsxs("g", { children: [_jsx("path", { d: `M${sourceX},${sourceY} L${targetX},${targetY}`, stroke: "#000", strokeWidth: 4, fill: "none" }), _jsx("rect", { x: centerX - backgroundBoxWidth / 2, y: centerY - backgroundBoxHeight / 2, width: backgroundBoxWidth, height: backgroundBoxHeight, fill: "#191420" }), Array.from({ length: required }, (_, i) => {
                const filled = i < current;
                const dx = startX + i * (diamondSize + spacing);
                const dy = centerY - diamondSize / 2;
                return (_jsx("rect", { x: dx, y: dy, width: diamondSize, height: diamondSize, transform: `rotate(45 ${dx + diamondSize / 2} ${dy + diamondSize / 2})`, fill: filled ? '#800080' : '#ccc', stroke: "#000", strokeWidth: 1 }, i));
            })] }));
}
export const nodeTypes = { skill: SkillNode };
export const edgeTypes = { diamond: DiamondEdge };
export default function App({ initialUrl, hideTreeSelector = false }) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [tooltip, setTooltip] = useState(null);
    const { selectedTag, setSelectedTag, tagOptions, setTagOptions } = useTagFilter();
    const [treeUrl, setTreeUrl] = useState(initialUrl ?? 'https://raw.githubusercontent.com/snuggiettv/hellclock-data-export/refs/heads/main/data/Infernal%20Bell.json');
    const [totalRanks, setTotalRanks] = useState(0);
    const [showSummary, setShowSummary] = useState(true);
    useEffect(() => {
        setNodes([]);
        setEdges([]);
        setTooltip(null);
        fetch(treeUrl)
            .then((res) => res.json())
            .then((raw) => {
            const biDirectionalEdges = {};
            const nodeMap = {};
            raw.nodes.forEach((node) => {
                nodeMap[node.name] = node;
            });
            raw.nodes.forEach((node) => {
                const targetId = node.name;
                node.edges.forEach((edge) => {
                    const sourceId = edge.requiredNode.name;
                    const points = edge.pointsToUnlock;
                    if (!biDirectionalEdges[targetId])
                        biDirectionalEdges[targetId] = [];
                    if (!biDirectionalEdges[sourceId])
                        biDirectionalEdges[sourceId] = [];
                    biDirectionalEdges[targetId].push({ source: sourceId, target: targetId, pointsToUnlock: points });
                    biDirectionalEdges[sourceId].push({ source: targetId, target: sourceId, pointsToUnlock: points });
                });
            });
            window.biDirectionalEdges = biDirectionalEdges;
            const parsedNodes = raw.nodes.map((node) => {
                const label = node.nameLocalizationKey?.find((l) => l.langCode === 'en')?.langTranslation || 'Unnamed';
                const affix = node.affixes?.[0];
                const affixDescription = affix?.description?.find((d) => d.langCode === 'en')?.langTranslation || '';
                const statKey = affix?.eStatDefinition || affix?.eCharacterIncrement || null;
                const isPercent = affix?.isPercent ?? affixDescription.includes('%');
                const isNegative = affix?.isNegative ?? affixDescription.includes('-');
                const value = affix?.value ?? 0;
                const valuePerLevel = affix?.valuePerLevel ?? 0;
                return {
                    id: node.name,
                    type: 'skill',
                    position: { x: node.Position[0], y: node.Position[1] },
                    data: {
                        label,
                        icon: `${node.sprite}.png`,
                        rank: 0,
                        maxRank: node.maxLevel,
                        statKey,
                        isPercent,
                        isNegative,
                        value,
                        valuePerLevel,
                        affixes: node.affixes,
                        description: affixDescription,
                        isLocked: !node.isRoot,
                        isRoot: node.isRoot || false,
                    }
                };
            });
            const parsedEdges = raw.nodes.flatMap((node) => node.edges.map((edge) => ({
                id: `e${edge.requiredNode.name}-${node.name}`,
                source: edge.requiredNode.name,
                target: node.name,
                type: 'diamond',
                sourceHandle: 'a',
                targetHandle: 'a',
                data: {
                    requiredRank: edge.pointsToUnlock,
                    currentRank: 0,
                }
            })));
            const uniqueTags = new Set();
            parsedNodes.forEach((node) => {
                const key = node.data.statKey;
                if (key)
                    uniqueTags.add(key);
            });
            ['Cooldown', 'Resistance', 'Reliquary', 'Second Wind', 'Red Portal'].forEach(tag => uniqueTags.add(tag));
            setTagOptions([...uniqueTags].sort());
            console.log('✅ Parsed Nodes:', parsedNodes);
            console.log('✅ Parsed Edges:', parsedEdges);
            setNodes(parsedNodes);
            setEdges(parsedEdges);
        });
    }, [treeUrl]);
    const updateLocks = (updatedNodes) => {
        const edgeMap = window.biDirectionalEdges || {};
        return updatedNodes.map((node) => {
            if (node.data.rank > 0 || node.data.isRoot) {
                return { ...node, data: { ...node.data, isLocked: false } };
            }
            const connections = edgeMap[node.id] || [];
            const unlocked = connections.some(({ source, pointsToUnlock }) => {
                const sourceNode = updatedNodes.find((n) => n.id === source);
                return sourceNode && sourceNode.data.rank >= pointsToUnlock;
            });
            return { ...node, data: { ...node.data, isLocked: !unlocked } };
        });
    };
    const statTotals = useMemo(() => {
        const totals = {};
        const total = nodes.reduce((sum, n) => sum + Number(n?.data?.rank ?? 0), 0);
        setTotalRanks(total);
        for (const node of nodes) {
            const rank = Number(node?.data?.rank ?? 0);
            if (rank <= 0)
                continue;
            const affixes = Array.isArray(node?.data?.affixes) ? node.data.affixes : [];
            for (const affix of affixes) {
                const statKey = affix.eStatDefinition || affix.eCharacterIncrement || 'Unknown';
                const base = Number(affix.value ?? 0);
                const per = Number(affix.valuePerLevel ?? 0);
                const desc = String(affix?.description || '');
                const rawType = String(affix?.statModifierType || '');
                const isMultiplicative = /multiplicative/i.test(rawType);
                // Robust percent detection
                const magnitudeLooksPercent = Math.abs(base) <= 1 && Math.abs(per) <= 1;
                const isPercentish = !!affix?.isPercent || /percent/i.test(rawType) || /%/.test(desc) || isMultiplicative || magnitudeLooksPercent;
                const isNeg = !!affix?.isNegative;
                const signedBase = isNeg ? -base : base;
                const signedPer = isNeg ? -per : per;
                let contribution = 0;
                let modifierType = isMultiplicative ? 'Multiplicative' : 'Additive';
                if (isMultiplicative) {
                    // Heuristic: if base is a positive multiplier (0 < base <= 1.5) and per==0, treat it as the multiplier itself.
                    // Else treat base/per as deltas added to 1.0.
                    let multiplier;
                    const looksLikeMultiplier = signedPer === 0 && signedBase > 0 && signedBase <= 1.5;
                    if (looksLikeMultiplier) {
                        multiplier = signedBase; // e.g., 0.9 -> -10%[x]
                    }
                    else {
                        const currentDelta = signedBase + signedPer * Math.max(0, rank - 1); // e.g., -0.1
                        multiplier = 1 + currentDelta; // e.g., 0.9
                    }
                    const totalMultiplier = Math.pow(multiplier, Math.max(1, rank));
                    contribution = totalMultiplier;
                }
                else {
                    if (per !== 0) {
                        // linear per-level (final value at this rank)
                        contribution = signedBase + signedPer * Math.max(0, rank - 1);
                    }
                    else {
                        // flat repeated per rank
                        contribution = signedBase * rank;
                    }
                }
                // Accumulate
                const prev = totals[statKey]?.value ?? (isMultiplicative ? 1 : 0);
                const newVal = isMultiplicative ? (prev * (contribution || 1)) : (prev + contribution);
                totals[statKey] = {
                    value: newVal,
                    isNegative: isMultiplicative ? (newVal < 1) : (newVal < 0),
                    isPercent: isPercentish,
                    modifierType,
                    nodeData: [
                        ...(totals[statKey]?.nodeData ?? []),
                        { nodeId: String(node.id), rank, contribution }
                    ],
                };
            }
        }
        return totals;
    }, [nodes]);
    const updateTooltip = (id, updated) => {
        if (!tooltip || tooltip.id !== id)
            return;
        const match = updated.find((n) => n.id === id);
        if (!match)
            return;
        const { rank, maxRank, value = 0, valuePerLevel = 0, isNegative = false, description = 'No description', } = match.data;
        const modifier = isNegative ? -1 : 1;
        const currentValue = (value + valuePerLevel * (rank - 1)) * modifier;
        const nextValue = rank < maxRank ? (value + valuePerLevel * rank) * modifier : currentValue;
        setTooltip({
            ...match.data,
            id,
            rank,
            description,
            currentValue,
            nextValue,
            x: tooltip.x,
            y: tooltip.y
        });
    };
    const increaseRank = (id) => {
        setNodes((nds) => {
            const updated = nds.map((n) => n.id === id && !n.data.isLocked && n.data.rank < n.data.maxRank
                ? { ...n, data: { ...n.data, rank: n.data.rank + 1 } }
                : n);
            const relocked = updateLocks(updated);
            updateTooltip(id, relocked);
            return relocked;
        });
    };
    const decreaseRank = (id) => {
        setNodes((nds) => {
            const updated = nds.map((n) => n.id === id && n.data.rank > 0
                ? { ...n, data: { ...n.data, rank: n.data.rank - 1 } }
                : n);
            const relocked = updateLocks(updated);
            updateTooltip(id, relocked);
            return relocked;
        });
    };
    const resetTree = () => {
        setNodes((nds) => {
            const reset = nds.map((n) => ({
                ...n,
                data: {
                    ...n.data,
                    rank: 0,
                    isLocked: !n.data.isRoot,
                }
            }));
            setTooltip(null);
            return updateLocks(reset);
        });
    };
    const nodesWithHandlers = useMemo(() => {
        return nodes.map((n) => {
            const key = n.data.statKey;
            const label = key ? formatStatName(key) : '';
            const matchesFilter = selectedTag
                ? fuzzysort.single(selectedTag, label)?.score !== undefined
                : false;
            return {
                ...n,
                style: matchesFilter
                    ? {
                        ...n.style,
                        boxShadow: '0 0 12px 4px #ff00ff',
                        border: '2px solid #ff00ff',
                        borderRadius: '50%',
                    }
                    : n.style,
                data: {
                    ...n.data,
                    onClick: increaseRank,
                    onRightClick: decreaseRank,
                    onHover: setTooltip,
                }
            };
        });
    }, [nodes, selectedTag]);
    useEffect(() => {
        setEdges((eds) => eds.map((e) => {
            const source = nodes.find((n) => n.id === e.source);
            const target = nodes.find((n) => n.id === e.target);
            const sourceRank = source?.data?.rank || 0;
            const targetRank = target?.data?.rank || 0;
            const currentRank = Math.max(sourceRank, targetRank);
            return {
                ...e,
                data: {
                    ...e.data,
                    currentRank,
                }
            };
        }));
    }, [nodes]);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                    position: 'absolute',
                    top: 25,
                    right: 25,
                    zIndex: 25,
                    backgroundColor: '#0b0b0f',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    border: '2px solid #800080',
                    boxShadow: '0 0 10px #800080',
                    fontFamily: 'monospace',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '10px'
                }, children: [_jsx("label", { htmlFor: "statFilter", style: { color: 'white' }, children: "Filter by Tag:" }), _jsxs("select", { id: "statFilter", value: selectedTag, onChange: (e) => setSelectedTag(e.target.value), style: {
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '14px',
                        }, children: [_jsx("option", { value: "", children: "-- Show All --" }), tagOptions.map((tag) => (_jsx("option", { value: tag, children: formatStatName(tag) }, tag)))] })] }), _jsxs("div", { style: { position: 'absolute', bottom: 20, right: 20, zIndex: 10 }, children: [_jsx("button", { onClick: resetTree, style: {
                            marginBottom: '10px',
                            backgroundColor: '#800080',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            width: '100%',
                        }, children: "Reset Tree" }), _jsx("button", { onClick: () => setShowSummary(!showSummary), style: {
                            marginBottom: '10px',
                            backgroundColor: '#1e152a',
                            color: 'white',
                            border: '1px solid #800080',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: 13,
                            cursor: 'pointer',
                            width: '100%',
                        }, children: showSummary ? 'Hide Stat Summary' : 'Show Stat Summary' }), showSummary && (_jsx(StatSummary, { statTotals: statTotals, totalRanks: totalRanks, nodes: nodes }))] }), !hideTreeSelector && _jsx(TreeSelector, { selected: treeUrl, onChange: setTreeUrl }), _jsxs("div", { style: {
                    position: 'absolute',
                    top: 40,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 30,
                    backgroundColor: '#0b0b0f',
                    padding: '6px 18px',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: 18,
                    fontWeight: 'bold',
                    border: '2px solid #444',
                    boxShadow: '0 0 12px #800080',
                    fontFamily: 'Georgia, serif',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                }, children: [_jsx("svg", { width: "16", height: "16", viewBox: "0 0 16 16", children: _jsx("rect", { x: "4", y: "4", width: "8", height: "8", transform: "rotate(45 8 8)", fill: "#800080", stroke: "#000", strokeWidth: "1" }) }), _jsx("span", { style: { fontSize: 24 }, children: totalRanks }), _jsx("span", { children: "Total Points Spent" }), _jsx("svg", { width: "16", height: "16", viewBox: "0 0 16 16", children: _jsx("rect", { x: "4", y: "4", width: "8", height: "8", transform: "rotate(45 8 8)", fill: "#800080", stroke: "#000", strokeWidth: "1" }) })] }), _jsx("div", { style: { width: '100vw', height: '100vh', position: 'relative' }, children: _jsxs(ReactFlowProvider, { children: [_jsx(AutoCenter, { nodes: nodesWithHandlers }), _jsx(ReactFlow, { nodes: nodesWithHandlers, edges: edges, onNodesChange: onNodesChange, onEdgesChange: onEdgesChange, nodeTypes: nodeTypes, edgeTypes: edgeTypes, nodesDraggable: false, nodesConnectable: false, zoomOnDoubleClick: false, onContextMenu: (e) => e.preventDefault(), style: { backgroundColor: '#0e0e12' } }), tooltip && _jsx(TooltipCard, { tooltip: tooltip })] }) })] }));
}
