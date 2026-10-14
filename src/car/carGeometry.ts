import * as THREE from 'three';

/**
 * Automotive convention for this model: the car faces -X (headlamps at x ≈ -1.99),
 * so with +Y up the car's **left** is +Z and its **right** is -Z.
 */
export const sideName = (side: number): 'left' | 'right' => (side > 0 ? 'left' : 'right');

/** Outer Z of the painted body skin. Both sides are mirror images about z = 0. */
export const SIDE_Z = 0.87;
/** Outer capsule skin plane, slightly beyond the legacy inner side hardware. */
export const CAPSULE_SIDE_Z = 0.89;
/** Half the extrusion depth of the body skin. */
export const SKIN_HALF_DEPTH = 0.04;

/** Ground-plan constants shared by the body, greenhouse and chassis. */
export const BELTLINE_Y = 1.16;
/** Exact outer contour of the door aperture in the capsule side skin. */
export const DOOR_OPENING = {
  leftX: -0.66,
  rightX: 0.56,
  bottomY: 0.36,
  topY: 1.91,
  cornerRadius: 0.08,
} as const;
/** Outer tread radius; the wheel centre sits exactly this high so the tire touches y = 0. */
export const WHEEL_RADIUS = 0.48;
export const WHEEL_Y = 0.48;
export const WHEEL_Z = 0.82;
export const AXLE_FRONT_X = -1.31;
export const AXLE_REAR_X = 1.31;

/** Where the side skin is sliced so the shells can separate along X. */
export const SLICE_FRONT_X = -0.72;
export const SLICE_REAR_X = 0.62;

/** Door aperture carved out of the mid side skin. */
export const APERTURE = { minX: -0.6, maxX: 0.48, minY: 0.4, maxY: 1.1 } as const;

export const CAPSULE_ROOF_FRONT_X = -0.86;
export const CAPSULE_ROOF_REAR_X = 0.91;
export const CAPSULE_ROOF_Y = 1.94;
export const CAPSULE_ROOF_PEAK = 0.025;

export type CapsuleLoftRow = readonly [x: number, y: number, halfWidth: number, crown: number];

/** Shared cross-section stations. Side skins, crown panels and shoulder joins use these same edges. */
export const FRONT_CROWN_ROWS = [
  [-2.12, 0.86, 0.68, 0.015], [-2.08, 1.17, 0.77, 0.035],
  [-1.91, 1.52, 0.83, 0.055], [-1.62, 1.75, 0.86, 0.06],
  [-1.48, 1.85, 0.86, 0.055],
] as const satisfies ReadonlyArray<CapsuleLoftRow>;
export const CAPSULE_ROOF_ROWS = [
  [-1.48, 1.85, 0.86, 0.055], [-1.18, 1.93, 0.88, 0.07],
  [CAPSULE_ROOF_FRONT_X, CAPSULE_ROOF_Y, 0.89, 0.075], [-0.46, CAPSULE_ROOF_Y + CAPSULE_ROOF_PEAK, 0.89, 0.075],
  [0.35, CAPSULE_ROOF_Y + CAPSULE_ROOF_PEAK, 0.89, 0.075],
  [CAPSULE_ROOF_REAR_X, CAPSULE_ROOF_Y, 0.89, 0.075], [1.18, 1.93, 0.88, 0.07],
  [1.48, 1.85, 0.86, 0.055],
] as const satisfies ReadonlyArray<CapsuleLoftRow>;
export const REAR_CROWN_ROWS = [
  [1.48, 1.85, 0.86, 0.055], [1.62, 1.75, 0.86, 0.06],
  [1.91, 1.52, 0.83, 0.055], [2.08, 1.17, 0.77, 0.035],
  [2.12, 0.86, 0.68, 0.015],
] as const satisfies ReadonlyArray<CapsuleLoftRow>;
export const BODY_UPPER_ROWS: ReadonlyArray<CapsuleLoftRow> = [
  ...FRONT_CROWN_ROWS,
  ...CAPSULE_ROOF_ROWS.slice(1),
  ...REAR_CROWN_ROWS.slice(1),
];

/** Shared upper edge for the side glazing, inset below the capsule roof crown. */
export const SIDE_WINDOW_TOP = 1.85;
/** Keep the pane and the matching body aperture on identical curve samples. */
export const SIDE_WINDOW_CURVE_SEGMENTS = 64;

export function capsuleRoofY(x: number): number {
  let index = 0;
  while (index < CAPSULE_ROOF_ROWS.length - 2 && x > CAPSULE_ROOF_ROWS[index + 1][0]) index++;
  const a = CAPSULE_ROOF_ROWS[index];
  const b = CAPSULE_ROOF_ROWS[index + 1];
  return THREE.MathUtils.lerp(a[1], b[1], THREE.MathUtils.clamp((x - a[0]) / (b[0] - a[0]), 0, 1));
}

/** Front quarter glass opening, shared by the shell cutout and its glass pane. */
export function capsuleFrontQuarterPath(): THREE.Shape {
  const path = new THREE.Shape();
  path.moveTo(-1.5, BELTLINE_Y);
  path.quadraticCurveTo(-1.51, 1.50, -1.24, 1.72);
  path.quadraticCurveTo(-1.04, 1.81, CAPSULE_ROOF_FRONT_X, SIDE_WINDOW_TOP);
  path.lineTo(-0.70, SIDE_WINDOW_TOP);
  path.lineTo(-0.70, BELTLINE_Y);
  path.closePath();
  return path;
}

/** Rear quarter glass opening, shared by the shell cutout and its glass pane. */
export function capsuleRearQuarterPath(): THREE.Shape {
  const path = new THREE.Shape();
  path.moveTo(0.58, BELTLINE_Y);
  path.lineTo(0.58, SIDE_WINDOW_TOP);
  path.quadraticCurveTo(0.74, 1.81, CAPSULE_ROOF_REAR_X, SIDE_WINDOW_TOP);
  path.quadraticCurveTo(1.16, 1.68, 1.25, BELTLINE_Y);
  path.closePath();
  return path;
}

/**
 * Long exterior capsule side profile with genuine wheel arch, door and side
 * glazing openings. The paired side surface and crowned roof loft form the
 * continuous three-dimensional outer shell.
 */
export function capsuleSideShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-2.08, 0.34);
  shape.quadraticCurveTo(-2.20, 0.45, FRONT_CROWN_ROWS[0][0], FRONT_CROWN_ROWS[0][1]);
  // Match the side-skin roof edge to the exact same stations as the crown lofts.
  // This removes the narrow open strip that appeared where those independent
  // procedural surfaces used slightly different silhouettes.
  for (let segment = 0; segment < BODY_UPPER_ROWS.length - 1; segment++) {
    const a = BODY_UPPER_ROWS[segment];
    const b = BODY_UPPER_ROWS[segment + 1];
    for (let step = 1; step <= 12; step++) {
      const t = step / 12;
      shape.lineTo(THREE.MathUtils.lerp(a[0], b[0], t), THREE.MathUtils.lerp(a[1], b[1], t));
    }
  }
  shape.quadraticCurveTo(2.18, 0.45, 2.02, 0.34);
  shape.lineTo(AXLE_REAR_X + 0.59, 0.34);
  shape.lineTo(AXLE_REAR_X + 0.59, WHEEL_Y);
  shape.absarc(AXLE_REAR_X, WHEEL_Y, 0.59, 0, Math.PI, false);
  shape.lineTo(AXLE_FRONT_X + 0.59, 0.34);
  shape.lineTo(AXLE_FRONT_X + 0.59, WHEEL_Y);
  shape.absarc(AXLE_FRONT_X, WHEEL_Y, 0.59, 0, Math.PI, false);
  shape.lineTo(-2.08, 0.34);
  shape.closePath();

  // This contour is shared with the door meshes so the shut door covers the
  // opening exactly, including the rounded rear-lower corner.
  const door = new THREE.Path();
  const { leftX, rightX, bottomY, topY, cornerRadius } = DOOR_OPENING;
  door.moveTo(leftX, bottomY);
  door.lineTo(leftX, topY - cornerRadius);
  door.quadraticCurveTo(leftX, topY, leftX + cornerRadius, topY);
  door.lineTo(rightX - cornerRadius, topY);
  door.quadraticCurveTo(rightX, topY, rightX, topY - cornerRadius);
  door.lineTo(rightX, bottomY + cornerRadius);
  door.quadraticCurveTo(rightX, bottomY, rightX - cornerRadius, bottomY);
  door.closePath();
  shape.holes.push(door);

  shape.holes.push(capsuleFrontQuarterPath(), capsuleRearQuarterPath());
  return shape;
}

export function beamBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(b, a);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 10), material);
  beam.position.copy(a).add(b).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  beam.castShadow = true;
  return beam;
}

export function ringAt(parent: THREE.Object3D, radius: number, tube: number, z: number, material: THREE.Material): THREE.Mesh {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 48), material);
  ring.position.set(0, 0, z);
  parent.add(ring);
  return ring;
}

/** Extrude a side-profile shape into a slab centred on z = 0 so ±Z panels mirror exactly. */
export function extrudeSkin(shape: THREE.Shape, depth: number): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSegments: 4, steps: 1,
    bevelSize: 0.025, bevelThickness: 0.018, curveSegments: 12,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** Extrude a flat side panel (pillars, door cards) centred on z = 0. */
export function extrudePlate(shape: THREE.Shape, depth: number): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.014, bevelThickness: 0.014, curveSegments: 10,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** Door aperture cut out of the mid side skin so the cabin stays a real cavity. */
export function doorOpeningPath(): THREE.Path {
  const path = new THREE.Path();
  path.moveTo(APERTURE.minX, APERTURE.minY);
  path.lineTo(APERTURE.maxX - 0.08, APERTURE.minY);
  path.quadraticCurveTo(APERTURE.maxX, APERTURE.minY, APERTURE.maxX, APERTURE.minY + 0.08);
  path.lineTo(APERTURE.maxX, APERTURE.maxY - 0.08);
  path.quadraticCurveTo(APERTURE.maxX, APERTURE.maxY, APERTURE.maxX - 0.08, APERTURE.maxY);
  path.lineTo(APERTURE.minX + 0.08, APERTURE.maxY);
  path.quadraticCurveTo(APERTURE.minX, APERTURE.maxY, APERTURE.minX, APERTURE.maxY - 0.08);
  path.lineTo(APERTURE.minX, APERTURE.minY);
  path.closePath();
  return path;
}

/** Front fascia slice: nose through the front arch, x ∈ [-2.12, SLICE_FRONT_X]. */
export function frontSliceShape(): THREE.Shape {
  const shape = new THREE.Shape();
  const x = SLICE_FRONT_X;
  shape.moveTo(-2.06, 0.34);
  shape.quadraticCurveTo(-2.12, 0.46, -2.10, 0.58);
  shape.lineTo(-2.08, 0.82);
  shape.quadraticCurveTo(-2.00, 0.99, -1.78, 1.07);
  shape.quadraticCurveTo(-1.53, 1.15, -1.22, BELTLINE_Y);
  shape.lineTo(x, BELTLINE_Y);
  shape.lineTo(x, 0.29);
  shape.lineTo(-0.75, 0.48);
  shape.absarc(AXLE_FRONT_X, WHEEL_Y, 0.56, 0, Math.PI, false);
  shape.lineTo(-1.94, 0.29);
  shape.lineTo(-2.06, 0.34);
  shape.closePath();
  return shape;
}

/**
 * Lower sill below the door aperture.  It is deliberately separate from the
 * jambs: modelling the side as one rectangle with a closed hole leaves a
 * permanent horizontal strip above the hole, which remains in place when a
 * door swings open.
 */
export function midSillShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(SLICE_FRONT_X, 0.29);
  shape.lineTo(SLICE_REAR_X, 0.29);
  shape.lineTo(SLICE_REAR_X, APERTURE.minY);
  shape.lineTo(SLICE_FRONT_X, APERTURE.minY);
  shape.closePath();
  return shape;
}

/** Front vertical edge of the real door aperture (the A-pillar-side jamb). */
export function frontDoorJambShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(SLICE_FRONT_X, 0.29);
  shape.lineTo(APERTURE.minX, 0.29);
  shape.lineTo(APERTURE.minX, BELTLINE_Y);
  shape.lineTo(SLICE_FRONT_X, BELTLINE_Y);
  shape.closePath();
  return shape;
}

/** Rear vertical edge of the real door aperture (the B/C-pillar-side jamb). */
export function rearDoorJambShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(APERTURE.maxX, 0.29);
  shape.lineTo(SLICE_REAR_X, 0.29);
  shape.lineTo(SLICE_REAR_X, BELTLINE_Y);
  shape.lineTo(APERTURE.maxX, BELTLINE_Y);
  shape.closePath();
  return shape;
}

/** Rear fascia slice: rear arch through the tail, x ∈ [SLICE_REAR_X, 2.04]. */
export function rearSliceShape(): THREE.Shape {
  const shape = new THREE.Shape();
  const x = SLICE_REAR_X;
  shape.moveTo(x, 0.29);
  shape.lineTo(x, BELTLINE_Y);
  shape.lineTo(0.86, BELTLINE_Y);
  shape.quadraticCurveTo(1.17, 1.15, 1.43, 1.07);
  shape.quadraticCurveTo(1.79, 0.97, 1.94, 0.80);
  shape.lineTo(1.98, 0.54);
  shape.quadraticCurveTo(2.00, 0.40, 1.94, 0.32);
  shape.lineTo(1.87, 0.48);
  shape.absarc(AXLE_REAR_X, WHEEL_Y, 0.56, 0, Math.PI, false);
  shape.lineTo(x, 0.29);
  shape.closePath();
  return shape;
}
