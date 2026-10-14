import * as THREE from 'three';
import { BELTLINE_Y, CABIN_TAPER, FLOOR_Y, ROOF_Y } from './dimensions';

/**
 * Extrude a side-view profile across the car's width.
 *
 * `ExtrudeGeometry` grows from the shape plane toward +Z, so the result is
 * translated back by half its depth. The bevel is what stops the body reading as
 * a box: it rounds the panel where it turns from a flank into an end cap. The
 * solid still spans exactly `width` — the bevel's growth cancels the reduced
 * extrusion depth.
 */
export function extrudeProfile(shape: THREE.Shape, width: number, bevel = 0.05): THREE.ExtrudeGeometry {
  const depth = Math.max(width - bevel * 2, 0.01);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSegments: 3,
    bevelSize: bevel,
    bevelThickness: bevel,
    steps: 1,
    curveSegments: 16,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Sculpt the greenhouse into a capsule: as vertices climb above the beltline they
 * move inboard, so the roof is narrower than the sills.
 *
 * Every panel that crosses the beltline runs through this — cabin, doors — which
 * is what keeps the aperture and the door that fills it exactly flush.
 *
 * The narrowing is a pure function of `y` and is uniform in `z`, so a thin slab
 * such as a door panel keeps parallel faces instead of being skewed, and the
 * sculpt commutes with mirroring.
 */
export function sculptGreenhouse(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const roofSpan = ROOF_Y - BELTLINE_Y;

  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    if (y <= BELTLINE_Y) continue;

    const rise = Math.min((y - BELTLINE_Y) / roofSpan, 1);
    const narrow = 1 - CABIN_TAPER * rise * rise;
    position.setZ(i, position.getZ(i) * narrow);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Sample a quadratic Bézier inclusively: `steps + 1` points from a to b. */
export function quadratic(
  from: readonly [number, number],
  control: readonly [number, number],
  to: readonly [number, number],
  steps = 10,
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    points.push([
      inv * inv * from[0] + 2 * inv * t * control[0] + t * t * to[0],
      inv * inv * from[1] + 2 * inv * t * control[1] + t * t * to[1],
    ]);
  }
  return points;
}

/** Sample a circular arc inclusively over `[start, end]` radians. */
export function arc(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number,
  steps = 20,
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const angle = start + ((end - start) * i) / steps;
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return points;
}

/** Drop consecutive duplicates so the triangulator never sees a zero-length edge. */
function dedupe(points: Array<[number, number]>): Array<[number, number]> {
  return points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 1e-6;
  });
}

/** Build a closed shape from an ordered point list. */
export function shapeFrom(points: Array<[number, number]>): THREE.Shape {
  const cleaned = dedupe(points);
  const shape = new THREE.Shape();
  shape.moveTo(cleaned[0][0], cleaned[0][1]);
  for (const [x, y] of cleaned.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  return shape;
}

/** A hole, built the same way; winding is normalised by the triangulator. */
export function holeFrom(points: Array<[number, number]>): THREE.Path {
  const cleaned = dedupe(points);
  const path = new THREE.Path();
  path.moveTo(cleaned[0][0], cleaned[0][1]);
  for (const [x, y] of cleaned.slice(1)) path.lineTo(x, y);
  path.closePath();
  return path;
}

/**
 * Height of the wheel-arch circle at a given x.
 *
 * Both the door aperture and the door itself are cut to clear the arch, so the
 * two share this. Its clearance radius is what keeps an opening from opening
 * onto fresh air where the arch passes.
 */
export function archTopAt(axleX: number, radius: number, x: number): number {
  return FLOOR_Y + Math.sqrt(Math.max(radius * radius - (x - axleX) ** 2, 1e-6));
}

/** Where the arch circle crosses a given height; toward the car's centre if `inward`. */
export function archCrossX(axleX: number, radius: number, y: number, inward: boolean): number {
  const dx = Math.sqrt(Math.max(radius * radius - (y - FLOOR_Y) ** 2, 0));
  const outward = axleX + Math.sign(axleX) * dx;
  return inward ? axleX - Math.sign(axleX) * dx : outward;
}

/** The arch circle's upper arc between two x values, as a point list. */
export function archArc(
  axleX: number,
  radius: number,
  fromX: number,
  toX: number,
  steps = 16,
): Array<[number, number]> {
  const angleAt = (x: number): number =>
    Math.atan2(Math.sqrt(Math.max(radius * radius - (x - axleX) ** 2, 1e-6)), x - axleX);
  return arc(axleX, FLOOR_Y, radius, angleAt(fromX), angleAt(toX), steps);
}

/** A rounded rectangle as a point list, ready for `shapeFrom` or `holeFrom`. */
export function roundedRect(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  radius = 0.04,
): Array<[number, number]> {
  const r = Math.min(radius, (maxX - minX) / 2, (maxY - minY) / 2);
  return [
    ...quadratic([minX, minY + r], [minX, minY], [minX + r, minY], 4),
    ...quadratic([maxX - r, minY], [maxX, minY], [maxX, minY + r], 4),
    ...quadratic([maxX, maxY - r], [maxX, maxY], [maxX - r, maxY], 4),
    ...quadratic([minX + r, maxY], [minX, maxY], [minX, maxY - r], 4),
  ];
}
