import React, { useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  type Node,
  type Edge
} from "reactflow";
import "reactflow/dist/style.css";
import { parseGroupToGraph } from "../constellations/parseGroupToGraph";
import constellationsData from "../data/Constellations.json";

interface AlignViewProps {
  groupId: string; // constellation slug or id
}

const AlignView: React.FC<AlignViewProps> = ({ groupId }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [artProps, setArtProps] = useState<{
    src: string;
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    // 1️⃣ Get the constellation group
    const groupEntry = constellationsData.find((entry: any) => entry.id === groupId);
    if (!groupEntry) {
      console.warn(`⚠️ Constellation group "${groupId}" not found`);
      return;
    }

    // 2️⃣ Parse nodes/edges from group
    const { nodes: parsedNodes, edges: parsedEdges } = parseGroupToGraph(groupEntry.group);
    setNodes(parsedNodes);
    setEdges(parsedEdges);

    // 3️⃣ Get last ConstellationDetails entry for container size
    const detailsEntries = groupEntry.group.filter(
      (entry: any) => entry.type === "ConstellationDetails"
    );
    if (detailsEntries.length === 0) {
      console.warn(`⚠️ No ConstellationDetails found for ${groupId}`);
      return;
    }
    const lastDetails = detailsEntries[detailsEntries.length - 1];
    const { width, height, position } = lastDetails;

    // 4️⃣ Pick art image — here using blurred as base
    const artBase = groupEntry.artBase || `/constellations/${groupId}`;
    const imgSrc = `${artBase}/blur.png`;

    // 5️⃣ Store art props
    setArtProps({
      src: imgSrc,
      width,
      height,
      x: position[0],
      y: position[1]
    });

    // 6️⃣ Offset all node positions so they are centered on art
    const cx = position[0] + width / 2;
    const cy = position[1] + height / 2;

    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        position: {
          x: n.position.x - cx,
          y: n.position.y - cy
        }
      }))
    );
  }, [groupId]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          zoomOnScroll
          zoomOnPinch
          panOnDrag
        >
          {/* Background art layer */}
          {artProps && (
            <div
              style={{
                position: "absolute",
                left: artProps.x,
                top: artProps.y,
                width: artProps.width,
                height: artProps.height,
                pointerEvents: "none",
                zIndex: -1
              }}
            >
              <img
                src={artProps.src}
                alt="Constellation art"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain"
                }}
              />
            </div>
          )}

          <Background />
          <Controls />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default AlignView;
