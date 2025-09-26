import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { COLOR_LABEL } from "../devotion/colors";
import devotionPanel from "../assets/DevotionPaths.png"; // you saved it in /src/assets
const DevotionBadge = ({ totals }) => {
    return (_jsx("div", { style: { position: "absolute", left: 12, top: 12, zIndex: 50, pointerEvents: "none" }, children: _jsxs("div", { style: { position: "relative", width: 240, height: 170 }, children: [_jsx("img", { src: devotionPanel, alt: "Devotion Paths", style: { width: "100%", height: "100%", display: "block",
                        filter: "drop-shadow(0 0 6px rgba(0,0,0,.55))" } }), _jsxs("div", { style: { position: "absolute", left: 32, top: 78, color: "#ffb3b3", textShadow: "0 1px 2px #000" }, children: [COLOR_LABEL.Red, ": ", _jsx("strong", { children: totals.Red })] }), _jsxs("div", { style: { position: "absolute", left: 32, top: 118, color: "#b8ffb8", textShadow: "0 1px 2px #000" }, children: [COLOR_LABEL.Green, ": ", _jsx("strong", { children: totals.Green })] }), _jsxs("div", { style: { position: "absolute", left: 32, top: 156, color: "#b8c8ff", textShadow: "0 1px 2px #000" }, children: [COLOR_LABEL.Blue, ": ", _jsx("strong", { children: totals.Blue })] })] }) }));
};
export default DevotionBadge;
