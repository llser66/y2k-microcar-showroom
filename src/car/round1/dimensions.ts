import * as THREE from 'three';

/**
 * Round 1 — dimensions for a Y2K two-seat A00 city pod.
 *
 * Silhouette target is length : width : height ≈ 3 : 1.5 : 1.6, short wheelbase,
 * tall roof, wheels pushed to the corners and deliberately oversized.
 *
 * Axes: the car faces **-X**, +Y is up, so in the car's own frame of reference
 * its **left** is +Z and its **right** is -Z.
 */

export const CAR = {
  length: 3.0,
  width: 1.5,
  height: 1.62,
} as const;

export const HALF_LENGTH = CAR.length / 2;
export const HALF_WIDTH = CAR.width / 2;

/** Underbody line — the lowest point of the painted shell. */
export const FLOOR_Y = 0.28;
/** Flat top of the tub. Everything above this is cabin. */
export const BELTLINE_Y = 1.06;
/** Underside of the cabin capsule. It tucks below the beltline so the two fuse. */
export const CABIN_BASE_Y = 0.88;
export const ROOF_Y = CAR.height;

/**
 * The tub carries both wheel arches and the door aperture, so it runs almost the
 * full length. Its flanks are the outer skin at z = ±0.75.
 */
export const TUB_HALF_LENGTH = 1.32;
/** Front and rear clips: the rounded-square nose and the square tail. */
export const CLIP_FRONT_X = -1.5;
export const CLIP_REAR_X = 1.5;
export const CLIP_INNER_X = 1.26;

/** Only the outer 0.31 of each flank is cut with arches and a door aperture. */
export const SIDE_INNER_Z = 0.44;

export const WHEEL_RADIUS = 0.3;
export const WHEEL_WIDTH = 0.2;
/** Wheel centre height, so the tread meets the ground at y = 0. */
export const WHEEL_Y = WHEEL_RADIUS;
export const AXLE_FRONT_X = -0.88;
export const AXLE_REAR_X = 0.88;
export const WHEEL_Z = 0.58;
export const ARCH_RADIUS = 0.4;

/**
 * Door aperture cut clean through the flank (x, y in car space).
 *
 * `clearance` is the radius of the circle about each axle that the opening keeps
 * out of. It is larger than the arch itself, so the cut line runs parallel to the
 * wheel arch the way a real door skin does, instead of squaring off over the tyre.
 */
export const APERTURE = {
  minX: -0.72,
  maxX: 0.62,
  minY: 0.42,
  maxY: 0.99,
  clearance: 0.48,
} as const;

/** Cabin capsule, in side view. Forward enough to be cab-forward, not a bonnet. */
export const CABIN_FRONT_X = -0.95;
export const CABIN_REAR_X = 1.12;
/** The cabin is inset a little so it never fights the tub's flanks for depth. */
export const CABIN_WIDTH = 1.44;

/** Side glass aperture, shared by the cabin and the door. */
export const WINDOW = { minX: -0.56, maxX: 0.44, minY: 1.02, maxY: 1.46 } as const;
/** Rear quarter light — the blind quarter a two-seater would otherwise have. */
export const QUARTER = { minX: 0.62, maxX: 0.92, minY: 1.06, maxY: 1.42 } as const;

/**
 * Door slab outline.
 *
 * The leading edge is a straight vertical cut, and the bottom-front corner peels
 * up around the front arch — the same scallop the aperture has, tightened by
 * `clearance` so the skin laps onto solid flank all the way round.
 */
export const DOOR = {
  frontX: -0.78,
  rearX: 0.68,
  topY: 1.46,
  /** Beltline: above this the door carries the A-pillar and the glass. */
  beltY: 0.88,
  bottomY: 0.36,
  clearance: 0.42,
  /** Rounding on the door's top corners, so the skin reads as pressed metal. */
  cornerRadius: 0.07,
} as const;
/** Door glazing, inset inside the slab so a frame survives all round. */
export const DOOR_GLASS = { minX: -0.5, maxX: 0.36, minY: 1.06, maxY: 1.42 } as const;

/** Door hinge line: on the flank, at the bottom of the leading edge. */
export const HINGE = { x: DOOR.frontX, y: 0, z: 0.705 } as const;

/**
 * Greenhouse tumblehome — how far the cabin narrows from beltline to roof.
 * Applied to the cabin *and* to the door above the beltline, so the aperture and
 * the door that fills it stay exactly flush. It is uniform in z, so a thin slab
 * such as a door panel is never skewed by it.
 */
export const CABIN_TAPER = 0.17;
/** The roof itself is flat, as an A00 pod's should be. */
export const ROOF_FLAT = true;

export const sideName = (side: number): 'left' | 'right' => (side > 0 ? 'left' : 'right');

/** Cylinder that follows a->b; the shared primitive for every tube in the model. */
export function beamBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(b, a);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 12), material);
  beam.position.copy(a).add(b).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return beam;
}

/** Rounded box, so no part of the car reads as a raw cube. */
export function roundedBox(
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw, hh);
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  shape.closePath();

  const bevel = Math.min(radius, depth / 2 - 0.001);
  const front = bevel > 0.001 ? bevel : 0;
  const depth2 = Math.max(depth - front * 2, 0.004);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth2,
    bevelEnabled: front > 0.001,
    bevelSegments: 3,
    bevelSize: front,
    bevelThickness: front,
    steps: 1,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -depth2 / 2);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}
