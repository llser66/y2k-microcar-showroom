import * as THREE from 'three';
import {
  CABIN_BASE_Y,
  CABIN_FRONT_X,
  CABIN_REAR_X,
  CABIN_WIDTH,
  QUARTER,
  ROOF_Y,
  sideName,
  WINDOW,
} from './dimensions';
import { extrudeProfile, holeFrom, quadratic, roundedRect, sculptGreenhouse, shapeFrom } from './surface';
import type { CarMaterials } from './materials';

export interface Cabin {
  group: THREE.Group;
  /** Glass the cabin owns: the windscreen and the two rear quarter lights. */
  glass: THREE.Group;
}

const WALL_THICKNESS = 0.07;
/** The cavity's roof, which leaves a roof skin of `ROOF_Y - CAVITY_ROOF_Y`. */
const CAVITY_ROOF_Y = 1.57;
const CAVITY_BASE_Y = 1.0;

/** Side view of the capsule: rounded ends, flat roof, flat underside. */
function capsuleOutline(): Array<[number, number]> {
  return [
    [CABIN_FRONT_X, CABIN_BASE_Y],
    ...quadratic([CABIN_FRONT_X, CABIN_BASE_Y], [-0.98, 1.28], [-0.58, 1.52], 14),
    ...quadratic([-0.58, 1.52], [-0.44, ROOF_Y], [-0.22, ROOF_Y], 8),
    [0.76, ROOF_Y],
    ...quadratic([0.76, ROOF_Y], [1.0, ROOF_Y - 0.02], [1.08, 1.44], 10),
    ...quadratic([1.08, 1.44], [1.18, 1.2], [CABIN_REAR_X, CABIN_BASE_Y], 10),
  ];
}

/**
 * The windscreen's outer edge, i.e. the line the cowl and the header meet.
 *
 * The cavity's forward boundary *is* this line, which is what leaves the mouth
 * of the cavity open at the front: that opening is the windscreen.
 */
function windscreenOuter(): Array<[number, number]> {
  return [
    [-0.86, 0.96],
    ...quadratic([-0.86, 0.96], [-0.86, 1.22], [-0.52, 1.42], 10),
    ...quadratic([-0.52, 1.42], [-0.4, 1.48], [-0.28, 1.48], 4),
  ];
}

/**
 * The void inside the shell.
 *
 * Cutting one closed hole rather than several adjacent ones keeps the
 * triangulator on solid ground — the windscreen and the cabin are the same
 * opening seen from two directions, so they are one region here.
 */
function cavityOutline(): Array<[number, number]> {
  return [
    ...windscreenOuter(),
    ...quadratic([-0.28, 1.48], [-0.36, 1.55], [-0.22, CAVITY_ROOF_Y], 6),
    [0.74, CAVITY_ROOF_Y],
    ...quadratic([0.74, CAVITY_ROOF_Y], [0.95, 1.55], [1.03, 1.41], 10),
    ...quadratic([1.03, 1.41], [1.1, 1.2], [1.05, CAVITY_BASE_Y], 10),
  ];
}

/**
 * The shell's cross-section: the band between the capsule and the cavity, walked
 * as one open loop with the floor left out.
 *
 * Modelling it as a ring with a hole would put a floor plate across the cabin at
 * seat height. Walking the band as a single closed polygon instead leaves the
 * underside open, so the tub's floor is the floor and the seats pass through.
 */
function shellOutline(): Array<[number, number]> {
  const cavity = cavityOutline();
  return [
    ...capsuleOutline(),
    [1.05, CAVITY_BASE_Y],
    ...cavity.slice().reverse(),
  ];
}

/** The windscreen pane: a crescent filling the mouth of the cavity. */
function windscreenPane(): Array<[number, number]> {
  return [
    ...windscreenOuter(),
    ...quadratic([-0.28, 1.48], [-0.44, 1.36], [-0.68, 1.1], 8),
    ...quadratic([-0.68, 1.1], [-0.78, 1.0], [-0.86, 0.96], 4),
  ];
}

/** The side apertures: real holes through a real wall. */
const WINDOW_OPENING = roundedRect(WINDOW.minX, WINDOW.minY, WINDOW.maxX, WINDOW.maxY, 0.05);
const QUARTER_OPENING = roundedRect(QUARTER.minX, QUARTER.minY, QUARTER.maxX, QUARTER.maxY, 0.05);

export function buildCabin(materials: CarMaterials): Cabin {
  const group = new THREE.Group();
  group.name = 'Cabin';
  const glass = new THREE.Group();
  glass.name = 'cabin-glass';

  // The shell is a skin, not a solid — an arch over the cabin rather than a block
  // with the cabin buried in it. That is what leaves the interior room to exist,
  // and to be seen through the glazing.
  const shellGeometry = extrudeProfile(shapeFrom(shellOutline()), CABIN_WIDTH, 0.008);
  sculptGreenhouse(shellGeometry);
  const shell = new THREE.Mesh(shellGeometry, materials.paint);
  shell.name = 'cabin-shell';
  group.add(shell);

  // The greenhouse's left and right walls. Each carries the window and the
  // quarter light as apertures, so the openings survive with the doors open.
  const wallShape = shapeFrom(capsuleOutline());
  wallShape.holes.push(holeFrom(WINDOW_OPENING), holeFrom(QUARTER_OPENING));
  const wallGeometry = extrudeProfile(wallShape, WALL_THICKNESS, 0.02);
  wallGeometry.translate(0, 0, CABIN_WIDTH / 2 - WALL_THICKNESS / 2);
  sculptGreenhouse(wallGeometry);

  for (const side of [1, -1]) {
    const wall = new THREE.Mesh(
      side > 0 ? wallGeometry : wallGeometry.clone().scale(1, 1, -1),
      materials.paint,
    );
    wall.name = `cabin-wall-${sideName(side)}`;
    group.add(wall);
  }

  // Windscreen: one wide pane closing the cavity's forward mouth. Extruded about
  // the centreline, so the greenhouse sculpt narrows it in step with the shell.
  const windscreenGeometry = extrudeProfile(shapeFrom(windscreenPane()), CABIN_WIDTH - 0.11, 0.006);
  sculptGreenhouse(windscreenGeometry);
  const windscreen = new THREE.Mesh(windscreenGeometry, materials.glass);
  windscreen.name = 'windscreen';
  glass.add(windscreen);

  // Quarter lights: a thin plate per flank, translated outboard *before* the
  // sculpt so the tumblehome carries it in with the wall rather than leaving it
  // standing proud of the narrowing roof.
  const quarterGeometry = extrudeProfile(shapeFrom(QUARTER_OPENING), 0.022, 0.006);
  quarterGeometry.translate(0, 0, CABIN_WIDTH / 2 - WALL_THICKNESS / 2);
  sculptGreenhouse(quarterGeometry);

  for (const side of [1, -1]) {
    const light = new THREE.Mesh(
      side > 0 ? quarterGeometry : quarterGeometry.clone().scale(1, 1, -1),
      materials.glass,
    );
    light.name = `quarter-glass-${sideName(side)}`;
    glass.add(light);
  }

  group.add(glass);
  return { group, glass };
}
