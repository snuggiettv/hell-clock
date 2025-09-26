import React from "react";
import { COLOR_LABEL, type RGB } from "../devotion/colors";
import devotionPanel from "../assets/DevotionPaths.png"; // you saved it in /src/assets

type Props = { totals: RGB };
const DevotionBadge: React.FC<Props> = ({ totals }) => {
  return (
    <div style={{ position:"absolute", left:12, top:12, zIndex:50, pointerEvents:"none" }}>
      <div style={{ position:"relative", width:240, height:170 }}>
        <img src={devotionPanel} alt="Devotion Paths"
             style={{ width:"100%", height:"100%", display:"block",
                      filter:"drop-shadow(0 0 6px rgba(0,0,0,.55))" }} />
        <div style={{ position:"absolute", left:32, top:78, color:"#ffb3b3", textShadow:"0 1px 2px #000" }}>
          {COLOR_LABEL.Red}: <strong>{totals.Red}</strong>
        </div>
        <div style={{ position:"absolute", left:32, top:118, color:"#b8ffb8", textShadow:"0 1px 2px #000" }}>
          {COLOR_LABEL.Green}: <strong>{totals.Green}</strong>
        </div>
        <div style={{ position:"absolute", left:32, top:156, color:"#b8c8ff", textShadow:"0 1px 2px #000" }}>
          {COLOR_LABEL.Blue}: <strong>{totals.Blue}</strong>
        </div>
      </div>
    </div>
  );
};
export default DevotionBadge;
