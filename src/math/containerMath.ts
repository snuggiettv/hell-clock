/** src/math/containerMath.ts
 * Math utilities for placing constellation art + stars.
 * The contract:
 *  - All local node positions are CENTER-ORIGIN *in container pixels*.
 *  - World space has +X to the right, +Y UP.
 *  - mapScale uniformly scales both art and star positions.
 */

export type LocalNode = {
  id: string;
  label: string;
  localX: number; // container pixels, center-origin
  localY: number; // container pixels, center-origin
};

export type ContainerSpec = {
  id: string;
  displayName: string;
  containerWidth: number;
  containerHeight: number;
  containerCenterX: number; // world-space (unscaled) center X for the container
  containerCenterY: number; // world-space (unscaled) center Y for the container
  illustrationFileName: string;
  isWorkInProgress: boolean;
  imageNaturalWidth: number;  // PNG natural pixels
  imageNaturalHeight: number; // PNG natural pixels
};

/** Scale that "contain-fits" the image inside the container (no overflow). */
export function computeContainScale(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number
): number {
  if (!containerW || !containerH || !imageW || !imageH) return 1;
  const s = Math.min(containerW / imageW, containerH / imageH);
  return isFinite(s) && s > 0 ? s : 1;
}

export type LayoutOptions = {
  worldCenterYAxis: "up" | "down"; // global axis for the map/world
  localYAxis: "up" | "down";       // inside the container
  mapOffsetX?: number;
  mapOffsetY?: number;
  mapScale?: number;
  localNodeOffsetX?: number;
  localNodeOffsetY?: number;
  localNodeScale?: number;
  localNodeRotationDeg?: number;
};

export type PlacedNode = {
  id: string;
  label: string;
  worldX: number;
  worldY: number;
};

export type LayoutResult = {
  renderedWidth: number;
  renderedHeight: number;
  artTopLeftX: number;
  artTopLeftY: number;
  nodes: PlacedNode[];
};

/** Rotate a point in local container space (center-origin). */
function rotate(lx: number, ly: number, deg: number) {
  if (!deg) return { x: lx, y: ly };
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  return { x: lx * cos - ly * sin, y: lx * sin + ly * cos };
}

/** Core layout: converts local container pixels to world space. */
export function layoutConstellationWithContainer(
  spec: ContainerSpec,
  locals: LocalNode[],
  opts: LayoutOptions
): LayoutResult {
  const mapScale = opts.mapScale ?? 1;
  const mapOffsetX = opts.mapOffsetX ?? 0;
  const mapOffsetY = opts.mapOffsetY ?? 0;
  const localScale = opts.localNodeScale ?? 1;
  const localDX = opts.localNodeOffsetX ?? 0;
  const localDY = opts.localNodeOffsetY ?? 0;
  const localRot = opts.localNodeRotationDeg ?? 0;

  // World center (apply map offsets then scale)
  const worldCenterX = (spec.containerCenterX + mapOffsetX) * mapScale;
  const worldCenterYUnflipped = (spec.containerCenterY + mapOffsetY) * mapScale;
  const worldCenterY = (opts.worldCenterYAxis === "up")
    ? -worldCenterYUnflipped
    :  worldCenterYUnflipped;

  // Art size (PNG -> contain-fit inside container -> scale by mapScale)
  const imgScale = computeContainScale(spec.containerWidth, spec.containerHeight, spec.imageNaturalWidth, spec.imageNaturalHeight);
  const renderedWidth = spec.imageNaturalWidth * imgScale * mapScale;
  const renderedHeight = spec.imageNaturalHeight * imgScale * mapScale;
  const artTopLeftX = worldCenterX - renderedWidth / 2;
  const artTopLeftY = worldCenterY - renderedHeight / 2;

  // Local→World conversion
  const placed: PlacedNode[] = [];
  for (const n of locals) {
    // 1) apply per-constellation local transforms (offset/scale/rotate)
    const rx = (n.localX + localDX) * localScale;
    const ry = (n.localY + localDY) * localScale;
    const r = rotate(rx, ry, localRot);

    // 2) map to world Y-up
    const dy = (opts.localYAxis === "down") ? -r.y : r.y;
    const worldX = worldCenterX + r.x * mapScale;
    const worldY = worldCenterY + dy * mapScale;

    placed.push({ id: n.id, label: n.label, worldX, worldY });
  }

  return { renderedWidth, renderedHeight, artTopLeftX, artTopLeftY, nodes: placed };
}
