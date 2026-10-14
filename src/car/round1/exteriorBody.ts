import * as THREE from 'three';
import {
  APERTURE,
  ARCH_RADIUS,
  AXLE_FRONT_X,
  AXLE_REAR_X,
  BELTLINE_Y,
  CLIP_FRONT_X,
  CLIP_INNER_X,
  CLIP_REAR_X,
  FLOOR_Y,
  HALF_WIDTH,
  SIDE_INNER_Z,
  TUB_HALF_LENGTH,
} from './dimensions';
import {
  archArc,
  archCrossX,
  archTopAt,
  arc,
  extrudeProfile,
  holeFrom,
  quadratic,
  roundedRect,
  shapeFrom,
} from './surface';
import { buildBodyTrim } from './trim';
import type { CarMaterials } from './materials';

export interface ExteriorBody {
  lowerBody: THREE.Group;
  frontBody: THREE.Group;
  rearBody: THREE.Group;
}

/** Underside of a clip. The bumper band and the clip itself are measured from here. */
const CLIP_BASE_Y = 0.3;
/** How far the bumper band stands off the clip it wraps. */
const BUMPER_PROUD = 0.02;
/** Bevel on the bumper band, which also rounds its four corners. */
const BUMPER_BEVEL = 0.02;
/** Vertical extent of the bumper band, in car space. */
const BUMPER_BAND = { minY: 0.32, maxY: 0.52 } as const;

/**
 * The door opening, in side view.
 *
 * Square across the top and the trailing edge, but the two bottom corners peel up
 * around the wheel arches — the reason a real door cut line runs parallel to the
 * tyre instead of squaring off over it.
 */
export function apertureOutline(): Array<[number, number]> {
  const r = APERTURE.clearance;
  return [
    [APERTURE.minX, APERTURE.maxY],
    [APERTURE.minX, archTopAt(AXLE_FRONT_X, r, APERTURE.minX)],
    ...archArc(AXLE_FRONT_X, r, APERTURE.minX, archCrossX(AXLE_FRONT_X, r, APERTURE.minY, true)),
    [archCrossX(AXLE_REAR_X, r, APERTURE.minY, true), APERTURE.minY],
    ...archArc(AXLE_REAR_X, r, archCrossX(AXLE_REAR_X, r, APERTURE.minY, true), APERTURE.maxX),
    [APERTURE.maxX, archTopAt(AXLE_REAR_X, r, APERTURE.maxX)],
    [APERTURE.maxX, APERTURE.maxY],
  ];
}

/**
 * The flank's side view: a flat-topped slab on a flat floor, with the two wheel
 * arches notched out of the bottom edge and the door aperture cut clean through.
 *
 * The arches are notches rather than holes — they open onto the floor line, which
 * is what makes them read as wheel arches instead of slots.
 */
function flankShape(): THREE.Shape {
  const corner = 0.08;
  const points: Array<[number, number]> = [
    [-TUB_HALF_LENGTH, FLOOR_Y],
    [-TUB_HALF_LENGTH, BELTLINE_Y - corner],
    ...quadratic(
      [-TUB_HALF_LENGTH, BELTLINE_Y - corner],
      [-TUB_HALF_LENGTH, BELTLINE_Y],
      [-TUB_HALF_LENGTH + corner, BELTLINE_Y],
    ),
    [TUB_HALF_LENGTH - corner, BELTLINE_Y],
    ...quadratic(
      [TUB_HALF_LENGTH - corner, BELTLINE_Y],
      [TUB_HALF_LENGTH, BELTLINE_Y],
      [TUB_HALF_LENGTH, BELTLINE_Y - corner],
    ),
    [TUB_HALF_LENGTH, FLOOR_Y],
    // Bottom edge, travelling rear to front.
    [AXLE_REAR_X + ARCH_RADIUS, FLOOR_Y],
    ...arc(AXLE_REAR_X, FLOOR_Y, ARCH_RADIUS, 0, Math.PI),
    [AXLE_FRONT_X + ARCH_RADIUS, FLOOR_Y],
    ...arc(AXLE_FRONT_X, FLOOR_Y, ARCH_RADIUS, 0, Math.PI),
  ];

  const shape = shapeFrom(points);
  shape.holes.push(holeFrom(apertureOutline()));
  return shape;
}

/**
 * A flank panel: one extrusion per side, cut with the arches and the aperture.
 *
 * These are the only panels that carry a door opening. Between them sits the
 * solid core, so the aperture is a pocket in the side of the car rather than a
 * tunnel bored through it — exactly how a real body shell is arranged.
 */
function buildFlanks(materials: CarMaterials): THREE.Group {
  const width = HALF_WIDTH - SIDE_INNER_Z;
  const centreZ = (HALF_WIDTH + SIDE_INNER_Z) / 2;
  const group = new THREE.Group();
  group.name = 'lower-body-flanks';

  for (const side of [1, -1]) {
    const mesh = new THREE.Mesh(extrudeProfile(flankShape(), width, 0.05), materials.paint);
    mesh.name = `flank-${side > 0 ? 'left' : 'right'}`;
    mesh.position.z = side * centreZ;
    group.add(mesh);
  }
  return group;
}

/**
 * The floor, the two wheel houses and the sill structure — the parts of the shell
 * that live between the flanks. It is deliberately plain: only its flanks and its
 * underside are ever on show, through the wheel openings and under the car.
 */
function buildCore(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lower-body-core';

  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.14, 0.88), materials.paintDark);
  floor.name = 'underbody-pan';
  floor.position.set(0, FLOOR_Y + 0.07, 0);
  group.add(floor);

  for (const [label, axle] of [
    ['front', AXLE_FRONT_X],
    ['rear', AXLE_REAR_X],
  ] as const) {
    const house = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.44, 0.92), materials.paintDark);
    house.name = `wheel-house-${label}`;
    house.position.set(axle, FLOOR_Y + 0.22, 0);
    group.add(house);
  }

  // Deck panels closing the top of the tub ahead of and behind the cabin. The
  // cabin arch covers the middle, but without these the space between the two
  // flanks is open to the sky at both ends of the car.
  for (const [label, centreX, length] of [
    ['front', -1.12, 0.4],
    ['rear', 1.21, 0.22],
  ] as const) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 0.36, 0.92), materials.paint);
    deck.name = `${label}-deck`;
    deck.position.set(centreX, BELTLINE_Y - 0.18, 0);
    group.add(deck);
  }

  // Sill rails tie the two flanks to the core so the shell reads as one tub.
  for (const side of [1, -1]) {
    const sill = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.06), materials.paintDark);
    sill.name = `sill-${side > 0 ? 'left' : 'right'}`;
    sill.position.set(0, FLOOR_Y + 0.05, side * (SIDE_INNER_Z - 0.02));
    group.add(sill);
  }
  return group;
}

/**
 * A clip: a rounded-square solid capping one end of the tub. Flat top, vertical
 * face, rounded on every corner — the A00 "rounded box" nose and its square tail.
 */
function buildClip(name: string, centreX: number, outward: number, materials: CarMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = name;

  const depth = CLIP_REAR_X - CLIP_INNER_X;
  const height = BELTLINE_Y - CLIP_BASE_Y;
  // `extrudeProfile`'s bevel grows the outline outward by `bevelSize`, so a shape
  // meant to finish at ±depth/2 is drawn inset by exactly that. Without the inset
  // the clip finishes a bevel proud of the tub, stepping the whole top edge.
  const bevel = 0.02;
  const body = new THREE.Mesh(
    extrudeProfile(
      shapeFrom(
        roundedRect(
          -depth / 2 + bevel,
          -height / 2 + bevel,
          depth / 2 - bevel,
          height / 2 - bevel,
          0.08,
        ),
      ),
      HALF_WIDTH * 2,
      bevel,
    ),
    materials.paint,
  );
  body.name = `${name}-shell`;
  body.position.set(centreX, CLIP_BASE_Y + height / 2, 0);
  group.add(body);

  // Bumper band. It is a rounded extrusion of the clip's own profile rather than
  // a box: a box's square corners push out through the rounded ones the clip
  // turns, leaving four tabs floating off the end of the car.
  const outerEdge = outward * (depth / 2 + BUMPER_PROUD);
  const innerEdge = -outward * (depth / 2);
  const bumper = new THREE.Mesh(
    extrudeProfile(
      shapeFrom(
        roundedRect(
          Math.min(innerEdge, outerEdge) + BUMPER_BEVEL,
          BUMPER_BAND.minY - body.position.y + BUMPER_BEVEL,
          Math.max(innerEdge, outerEdge) - BUMPER_BEVEL,
          BUMPER_BAND.maxY - body.position.y - BUMPER_BEVEL,
          0.03,
        ),
      ),
      // Narrower than the clip it wraps. Standing proud in z as well would leave
      // the band's end caps on show as grey plates bolted to the car's sides;
      // kept just inside, only the forward protrusion reads.
      HALF_WIDTH * 2 - 0.06,
      BUMPER_BEVEL,
    ),
    materials.paintDark,
  );
  bumper.name = `${name}-bumper`;
  bumper.position.set(centreX, body.position.y, 0);
  group.add(bumper);

  return group;
}

/** Front clip centre; rear clip centre. */
const FRONT_CLIP_X = (CLIP_FRONT_X - CLIP_INNER_X) / 2;
const REAR_CLIP_X = (CLIP_REAR_X + CLIP_INNER_X) / 2;

export function buildExteriorBody(materials: CarMaterials): ExteriorBody {
  const lowerBody = new THREE.Group();
  lowerBody.name = 'LowerBody';
  lowerBody.add(buildFlanks(materials), buildCore(materials), buildBodyTrim(materials));

  const frontBody = buildClip('FrontBody', FRONT_CLIP_X, -1, materials);
  const rearBody = buildClip('RearBody', REAR_CLIP_X, 1, materials);

  return { lowerBody, frontBody, rearBody };
}
