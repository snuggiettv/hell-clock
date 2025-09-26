import { useEffect, useRef } from 'react';
import { useReactFlow } from 'reactflow';
const AutoCenter = ({ nodes }) => {
    const reactFlow = useReactFlow();
    const hasCentered = useRef(false);
    useEffect(() => {
        if (hasCentered.current)
            return; // ✅ prevent repeated zooming
        const rootNodes = nodes.filter((n) => n.data?.isRoot);
        if (rootNodes.length === 0)
            return;
        const centerX = rootNodes.reduce((sum, n) => sum + n.position.x, 0) / rootNodes.length;
        const centerY = rootNodes.reduce((sum, n) => sum + n.position.y, 0) / rootNodes.length;
        // Fit entire canvas to window briefly (auto scale)
        reactFlow.fitView();
        // Then animate to desired zoom/position
        setTimeout(() => {
            reactFlow.setViewport({
                x: centerX * -1 + window.innerWidth / 2 - 130,
                y: centerY * -1 + window.innerHeight / 2 + 25,
                zoom: 1.1,
            }, { duration: 1000 });
            hasCentered.current = true; // ✅ don't repeat
        }, 250);
    }, [nodes]);
    return null;
};
export default AutoCenter;
