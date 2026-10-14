import * as THREE from 'three';
import { AXLE_FRONT_X, AXLE_REAR_X, DOOR, DOOR_GLASS, HINGE, roundedBox, sideName } from './dimensions';
import {
  archArc,
  archCrossX,
  archTopAt,
  extrudeProfile,
  holeFrom,
  quadratic,
  roundedRect,
  sculptGreenhouse,
  shapeFrom,
} from './surface';
import { creaseSegment } from './trim';
import type { CarMaterials } from './materials';

export interface DoorRig {
  /** The hinge pivot. Rotating it about Y swings the door; nothing else moves. */
  pivot: THREE.Group;
  side: number;
}

const THICKNESS = 0.1;
/** How far the door swings when open, in radians. */
export const MAX_SWING = 1.1;

/**
 * The door's outline in side view: one slab that carries the skin, the A-pillar
 * above the beltline and the frame around the glass.
 *
 * Its leading edge is the same straight cut the aperture has, and its bottom
 * corners peel up around the arches on a slightly tighter circle than the
 * aperture's, so the skin laps onto solid flank all the way round instead of
 * floating over the tyres.
 */
function doorOutline(): Array<[number, number]> {
  const r = DOOR.clearance;
  const c = DOOR.cornerRadius;
  const rearSillX = archCrossX(AXLE_REAR_X, r, DOOR.bottomY, true);
  const frontSillX = archCrossX(AXLE_FRONT_X, r, DOOR.bottomY, true);

  return [
    [DOOR.frontX, DOOR.topY - c],
    ...quadratic([DOOR.frontX, DOOR.topY - c], [DOOR.frontX, DOOR.topY], [DOOR.frontX + c, DOOR.topY], 4),
    [DOOR.rearX - c, DOOR.topY],
    ...quadratic([DOOR.rearX - c, DOOR.topY], [DOOR.rearX, DOOR.topY], [DOOR.rearX, DOOR.topY - c], 4),
    [DOOR.rearX, archTopAt(AXLE_REAR_X, r, DOOR.rearX)],
    ...archArc(AXLE_REAR_X, r, DOOR.rearX, rearSillX),
    [frontSillX, DOOR.bottomY],
    ...archArc(AXLE_FRONT_X, r, frontSillX, DOOR.frontX),
    [DOOR.frontX, archTopAt(AXLE_FRONT_X, r, DOOR.frontX)],
  ];
}

/**
 * Inner trim card, inset from the outline so a flange of the skin survives.
 *
 * Its corners are rounded hard because it rides on the door's inboard face,
 * which passes close to the tyres at the front and rear corners.
 */
function doorCardOutline(): Array<[number, number]> {
  return roundedRect(
    DOOR.frontX + 0.18,
    DOOR.bottomY + 0.08,
    DOOR.rearX - 0.18,
    DOOR.beltY,
    0.14,
  );
}

/**
 * Move a door part so it hangs off the hinge, mirrored for the far side.
 *
 * `extrudeProfile` already centres the solid on z = 0, and the pivot supplies the
 * outboard offset — so only x is corrected here. Translating z as well would
 * double the offset and fling the door clear of the car.
 */
function hinged(geometry: THREE.BufferGeometry, side: number): THREE.BufferGeometry {
  const placed = side > 0 ? geometry : geometry.clone().scale(1, 1, -1);
  placed.translate(-HINGE.x, 0, 0);
  return placed;
}

export function buildDoors(materials: CarMaterials): DoorRig[] {
  const shell = shapeFrom(doorOutline());
  const glassOutline = roundedRect(DOOR_GLASS.minX, DOOR_GLASS.minY, DOOR_GLASS.maxX, DOOR_GLASS.maxY, 0.05);
  shell.holes.push(holeFrom(glassOutline));

  // Outer skin, inner skin and the frame around the glass all come from one
  // extrusion, so the door is a single closed solid rather than a stack of plates.
  const slab = extrudeProfile(shell, THICKNESS, 0.022);
  sculptGreenhouse(slab);

  const glass = extrudeProfile(shapeFrom(glassOutline), THICKNESS - 0.04, 0.008);
  sculptGreenhouse(glass);

  const card = extrudeProfile(shapeFrom(doorCardOutline()), 0.024, 0.006);
  sculptGreenhouse(card);

  return ([1, -1] as const).map((side) => {
    const label = sideName(side);
    const pivot = new THREE.Group();
    pivot.name = side > 0 ? 'LeftDoor' : 'RightDoor';
    pivot.position.set(HINGE.x, 0, side * HINGE.z);

    const panel = new THREE.Mesh(hinged(slab, side), materials.doorPaint);
    panel.name = `door-panel-${label}`;

    const window = new THREE.Mesh(hinged(glass, side), materials.glass);
    window.name = `door-window-${label}`;

    const innerPanel = new THREE.Mesh(hinged(card, side), materials.interior);
    innerPanel.name = `door-inner-panel-${label}`;
    // The card sits against the door's inboard face, not through its middle.
    innerPanel.position.z = -side * 0.032;

    // The door carries the length of shoulder crease that crosses it, so the line
    // runs unbroken down the closed car and swings away with the door when open.
    const crease = new THREE.Mesh(hinged(creaseSegment(DOOR.frontX, DOOR.rearX), side), materials.doorPaint);
    crease.name = `door-crease-${label}`;
    // Relative to the pivot, which already carries the outboard offset — the same
    // trap as `hinged()` above. Only the half-thickness belongs here.
    crease.position.z = side * (THICKNESS / 2);

    const handle = roundedBox(0.2, 0.05, 0.03, 0.014, materials.chrome);
    handle.name = `door-handle-${label}`;
    // Local to the pivot, so it swings with the door. Near the trailing edge,
    // where a front-hinged door's handle belongs.
    handle.position.set(DOOR.rearX - 0.16 - HINGE.x, 0.86, side * (THICKNESS / 2 + 0.014));

    pivot.add(panel, window, innerPanel, crease, handle);
    return { pivot, side };
  });
}
