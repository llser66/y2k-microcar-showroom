import * as THREE from 'three';
import type { CarMaterials } from './carMaterials';
import { beamBetween, AXLE_FRONT_X, AXLE_REAR_X, WHEEL_Y, SLICE_FRONT_X, SLICE_REAR_X } from './carGeometry';

/** Longitudinal rail height: sits just under the floor pan, never inside it. */
const RAIL_Y = 0.375;
/** Rail plane: tucked under the floor pan (|z| ≤ 0.51) so the rails never cross the door entry. */
const RAIL_Z = 0.44;
const RAIL_R = 0.048;

/**
 * Silver-white structural frame. It is part of the normal interior/chassis —
 * always present, never gated on the exploded view — so the car reads as a
 * complete machine through the door apertures and the canopy glazing.
 */
export function buildChassis(materials: CarMaterials): THREE.Group {
  const frame = new THREE.Group();
  frame.name = 'skeleton';
  const m = materials.skeleton;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // ---- longitudinal rails + cross members ----------------------------------
  for (const side of [-1, 1]) {
    const z = side * RAIL_Z;
    frame.add(beamBetween(v(-1.92, RAIL_Y, z), v(1.86, RAIL_Y, z), RAIL_R, m));
    // Rail kick-ups tying the floor rails into each subframe.
    frame.add(beamBetween(v(AXLE_FRONT_X, RAIL_Y, z), v(AXLE_FRONT_X, 0.62, z), 0.032, m));
    frame.add(beamBetween(v(AXLE_REAR_X, RAIL_Y, z), v(AXLE_REAR_X, 0.62, z), 0.032, m));
  }
  for (const x of [-1.86, AXLE_FRONT_X, SLICE_FRONT_X, 0, SLICE_REAR_X, AXLE_REAR_X, 1.80]) {
    frame.add(beamBetween(v(x, RAIL_Y, -RAIL_Z), v(x, RAIL_Y, RAIL_Z), x === 0 ? 0.04 : 0.034, m));
  }

  // ---- front / rear subframes around each axle -----------------------------
  for (const axle of [AXLE_FRONT_X, AXLE_REAR_X]) {
    for (const side of [-1, 1]) {
      const z = side * RAIL_Z;
      frame.add(beamBetween(v(axle, 0.62, z), v(axle, 0.62, side * 0.72), 0.028, m));
      // Lower + upper wishbones running out to the hub carrier.
      frame.add(beamBetween(v(axle + 0.46, RAIL_Y, z), v(axle, WHEEL_Y, side * 0.70), 0.026, m));
      frame.add(beamBetween(v(axle - 0.46, RAIL_Y, z), v(axle, WHEEL_Y, side * 0.70), 0.026, m));
      frame.add(beamBetween(v(axle, WHEEL_Y, side * 0.70), v(axle, 0.62, side * 0.72), 0.026, m));
    }
    frame.add(beamBetween(v(axle, WHEEL_Y, -0.70), v(axle, WHEEL_Y, 0.70), 0.03, m));
  }

  // ---- concealed floor bracing ---------------------------------------------
  // The original exposed roll cage made the city pod read as a buggy and put
  // bars across the entry. Keep the structural data, but park it below the
  // floor and inside the sill where it is only glimpsed through the shell.
  frame.add(beamBetween(v(SLICE_FRONT_X, 0.36, -0.44), v(SLICE_REAR_X, 0.36, 0.44), 0.018, m));
  frame.add(beamBetween(v(SLICE_FRONT_X, 0.36, 0.44), v(SLICE_REAR_X, 0.36, -0.44), 0.018, m));

  // ---- seat pedestals ------------------------------------------------------
  for (const side of [-1, 1]) {
    for (const x of [-0.3, 0.06]) {
      frame.add(beamBetween(v(x, 0.4, side * 0.36), v(x, 0.55, side * 0.36), 0.016, m));
    }
    frame.add(beamBetween(v(-0.3, 0.54, side * 0.36), v(0.06, 0.54, side * 0.36), 0.014, m));
  }
  return frame;
}
