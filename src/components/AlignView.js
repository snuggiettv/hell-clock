import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import ReactFlow, { Background, Controls, ReactFlowProvider } from "reactflow";
import "reactflow/dist/style.css";
import { parseGroupToGraph } from "../constellations/parseGroupToGraph";
import constellationsData from "../data/Constellations.json";
const AlignView = ({ groupId }) => {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [artProps, setArtProps] = useState(null);
    useEffect(() => {
        // 1) Get the constellation group (from details array)
        const detailsArr = constellationsData?.constellationsDetails ?? [];
        const groupEntry = detailsArr.find((entry) => String(entry?.definition?.id) === String(groupId));
        if (!groupEntry) {
            console.warn(`⚠️ Constellation group "${groupId}" not found`);
            return;
        }
        // 2) Parse nodes/edges from group — pass definition + details so sizing works
        const { nodes: parsedNodes, edges: parsedEdges } = parseGroupToGraph({
            id: String(groupEntry.definition?.id),
            group: {
                definition: groupEntry.definition, // contains nodes
                constellationsDetails: [groupEntry], // contains width/height/position
            },
        });
        setNodes(parsedNodes);
        setEdges(parsedEdges);
        // 3) Use this ConstellationDetails entry for container size/position
        const lastDetails = groupEntry;
        const { width, height, position } = lastDetails;
        // 4) Pick art image — blurred as base (respect GH Pages base path)
        const base = import.meta.env.BASE_URL || "/";
        const artBase = `${base}constellations/${String(groupId)}`;
        const imgSrc = `${artBase}/blur.png`;
        // 5) Store art props
        setArtProps({
            src: imgSrc,
            width,
            height,
            x: position[0],
            y: position[1],
        });
        // 6) Offset node positions so they’re centered on the art
        const cx = position[0] + width / 2;
        const cy = position[1] + height / 2;
        setNodes((prev) => prev.map((n) => ({
            ...n,
            position: {
                x: n.position.x - cx,
                y: n.position.y - cy,
            },
        })));
    }, [groupId]);
    return (_jsx("div", { style: { width: "100%", height: "100%" }, children: _jsx(ReactFlowProvider, { children: _jsxs(ReactFlow, { nodes: nodes, edges: edges, fitView: true, nodesDraggable: false, zoomOnScroll: true, zoomOnPinch: true, panOnDrag: true, children: [artProps && (_jsx("div", { style: {
                            position: "absolute",
                            left: artProps.x,
                            top: artProps.y,
                            width: artProps.width,
                            height: artProps.height,
                            pointerEvents: "none",
                            zIndex: -1,
                        }, children: _jsx("img", { src: artProps.src, alt: "Constellation art", style: {
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                            } }) })), _jsx(Background, {}), _jsx(Controls, {})] }) }) }));
};
export default AlignView;
