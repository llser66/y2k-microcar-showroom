import * as THREE from 'three';
import { AXLE_FRONT_X, AXLE_REAR_X, FLOOR_Y, HALF_WIDTH, sideName } from './dimensions';
import { extrudeProfile, shapeFrom } from './surface';
import type { CarMaterials } from './materials';

/**
 * Round 1 — pressed trim: the shoulder crease and the rocker skirt.
 *
 * These exist to stop the flanks reading as flat slabs. Without a line running
 * the length of the car, a tub built from a handful of extrusions reads as
 * exactly that: a handful of extrusions.
 */

/** Height of the pressed shoulder line that runs down each flank. */
export const CREASE_Y = 0.72;
/** How far trim stands off the panel it is pressed into. */
const TRIM_PROUD = 0.014;
/** Bevel on a trim strip; its outline is inset by this so it finishes flush. */
const TRIM_BEVEL = 0.006;
const CREASE_HALF_HEIGHT = 0.03;
/** Rocker skirt: shallow, and low enough to clear the bottom of the door. */
const ROCKER_TOP_Y = 0.35;

/**
 * The crease stops either side of the door aperture. The door carries its own
 * length of the same line, so the crease breaks at the shut lines exactly as it
 * does on a real car — and continues across the door when that door is open.
 */
export const CREASE_FRONT_SPAN = [-1.34, -0.8] as const;
export const CREASE_REAR_SPAN = [0.7, 1.34] as const;

/** The rocker runs between the arches, so it never crosses a wheel opening. */
const ROCKER_SPAN = [AXLE_FRONT_X + 0.4, AXLE_REAR_X - 0.4] as const;

/** A square-cornered rectangle as a shape; the bevel is what rounds it. */
function rectShape(minX: number, minY: number, maxX: number, maxY: number): THREE.Shape {
  return shapeFrom([
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ]);
}

/**
 * One length of the shoulder crease, centred on z = 0 for the caller to place.
 *
 * Its ends are square rather than rounded because a length always terminates on
 * a shut line, where it has to meet the neighbouring length without a step.
 */
export function creaseSegment(fromX: number, toX: number): THREE.BufferGeometry {
  return extrudeProfile(
    rectShape(
      fromX + TRIM_BEVEL,
      CREASE_Y - CREASE_HALF_HEIGHT + TRIM_BEVEL,
      toX - TRIM_BEVEL,
      CREASE_Y + CREASE_HALF_HEIGHT - TRIM_BEVEL,
    ),
    TRIM_PROUD * 2,
    TRIM_BEVEL,
  );
}

/** The rocker skirt, as a strip centred on z = 0 like the crease. */
function rockerSegment(): THREE.BufferGeometry {
  return extrudeProfile(
    rectShape(
      ROCKER_SPAN[0] + TRIM_BEVEL,
      FLOOR_Y + TRIM_BEVEL,
      ROCKER_SPAN[1] - TRIM_BEVEL,
      ROCKER_TOP_Y - TRIM_BEVEL,
    ),
    0.045,
    TRIM_BEVEL,
  );
}

/** Lay a strip on both flanks. No mirroring is needed: an extrusion is symmetric in z. */
function addToBothSides(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  offsetZ: number,
  material: THREE.Material,
  label: string,
): void {
  for (const side of [1, -1] as const) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${label}-${sideName(side)}`;
    mesh.position.z = side * offsetZ;
    group.add(mesh);
  }
}

/** Trim that belongs to the shell — everything the doors do not carry away with them. */
export function buildBodyTrim(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = 'body-trim';

  const creaseFront = creaseSegment(CREASE_FRONT_SPAN[0], CREASE_FRONT_SPAN[1]);
  const creaseRear = creaseSegment(CREASE_REAR_SPAN[0], CREASE_REAR_SPAN[1]);
  addToBothSides(group, creaseFront, HALF_WIDTH, materials.paint, 'crease-front');
  addToBothSides(group, creaseRear, HALF_WIDTH, materials.paint, 'crease-rear');

  addToBothSides(group, rockerSegment(), HALF_WIDTH - TRIM_PROUD / 2, materials.paintDark, 'rocker');

  return group;
}
