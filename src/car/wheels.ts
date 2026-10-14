import * as THREE from 'three';
import type { CarMaterials } from './carMaterials';
import { beamBetween, ringAt, sideName, WHEEL_RADIUS, WHEEL_Y, WHEEL_Z, AXLE_FRONT_X, AXLE_REAR_X } from './carGeometry';

const TIRE_WIDTH = 0.27;
/** Rim face plane, inset from the sidewall so it seats inside the tire instead of floating proud. */
const RIM_FACE_Z = 0.108;
const RIM_RADIUS = 0.345;
const HUB_RADIUS = 0.095;

export const RIM_STYLES = [1, 2, 3] as const;
export type RimStyle = (typeof RIM_STYLES)[number];

export interface BuiltWheel {
  group: THREE.Group;
  /** One group per rim style; carries both the outboard and inboard faces. */
  rimStyles: THREE.Group[];
}

/**
 * One rim face. `dir` is +1 for the outboard face and -1 for the inboard one.
 * Both faces are built so no viewing angle ever exposes a bare tire disc.
 */
function rimFace(dir: number, style: RimStyle, detailed: boolean, materials: CarMaterials): THREE.Group {
  const group = new THREE.Group();
  const face = dir > 0 ? 'outer' : 'inner';
  group.name = `rim-${face}`;
  const z = dir * RIM_FACE_Z;
  const proud = (extra: number) => z + dir * extra;

  // Chrome backing disc: the rim reads as metal from any angle.
  const backing = new THREE.Mesh(new THREE.CylinderGeometry(RIM_RADIUS, RIM_RADIUS, 0.03, 36), materials.chrome);
  backing.rotation.x = Math.PI / 2;
  backing.position.z = z;
  backing.name = `rim-face-${face}`;
  group.add(backing);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(HUB_RADIUS, HUB_RADIUS, 0.075, 24), materials.trim);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = proud(0.028);
  hub.name = `hub-${face}`;
  group.add(hub);

  if (style === 1) {
    ringAt(group, 0.30, 0.05, proud(0.018), materials.chrome);
    ringAt(group, 0.195, 0.026, proud(0.024), materials.trim);
    if (detailed) ringAt(group, 0.115, 0.022, proud(0.03), materials.chrome);
    return group;
  }

  if (style === 2) {
    ringAt(group, 0.315, 0.032, proud(0.018), materials.chrome);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      group.add(beamBetween(
        new THREE.Vector3(Math.cos(angle) * 0.075, Math.sin(angle) * 0.075, proud(0.022)),
        new THREE.Vector3(Math.cos(angle) * 0.30, Math.sin(angle) * 0.30, proud(0.022)),
        0.026, materials.chrome));
    }
    return group;
  }

  ringAt(group, 0.325, 0.024, proud(0.018), materials.chrome);
  if (detailed) {
    for (let i = 0; i < 14; i++) {
      const angle = i * Math.PI * 2 / 14;
      group.add(beamBetween(
        new THREE.Vector3(Math.cos(angle) * 0.10, Math.sin(angle) * 0.10, proud(0.024)),
        new THREE.Vector3(Math.cos(angle) * 0.30, Math.sin(angle) * 0.30, proud(0.024)),
        0.011, materials.chrome));
    }
  }
  return group;
}

/**
 * Build one wheel. Geometry is authored with the outboard face towards +Z and the
 * -Z wheels are turned 180° about Y (a rotation, so normals and winding stay correct).
 */
export function buildWheel(x: number, side: number, front: boolean, materials: CarMaterials): BuiltWheel {
  const label = `${front ? 'front' : 'rear'}-${sideName(side)}`;
  const group = new THREE.Group();
  group.name = `wheel-${label}`;
  group.position.set(x, WHEEL_Y, side * WHEEL_Z);

  const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS - 0.012, WHEEL_RADIUS - 0.012, TIRE_WIDTH, 40), materials.rubber);
  tire.rotation.x = Math.PI / 2;
  tire.castShadow = true;
  tire.name = `tire-${label}`;
  group.add(tire);

  // A narrower band at full radius gives the tire a tread silhouette without
  // pushing the contact patch below the ground plane.
  const tread = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, TIRE_WIDTH * 0.6, 40, 1, true), materials.rubber);
  tread.rotation.x = Math.PI / 2;
  tread.name = `tread-${label}`;
  group.add(tread);

  const rimStyles = RIM_STYLES.map((style) => {
    const holder = new THREE.Group();
    holder.name = `rim-style-${style}`;
    holder.add(rimFace(1, style, true, materials));   // outboard
    holder.add(rimFace(-1, style, false, materials)); // inboard
    holder.visible = style === 1;
    group.add(holder);
    return holder;
  });

  if (side < 0) group.rotation.y = Math.PI;
  return { group, rimStyles };
}

export interface WheelSet {
  wheels: THREE.Group[];
  rimStyles: THREE.Group[];
}

export function buildWheels(materials: CarMaterials): WheelSet {
  const wheels: THREE.Group[] = [];
  const rimStyles: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    for (const front of [true, false]) {
      const x = front ? AXLE_FRONT_X : AXLE_REAR_X;
      const wheel = buildWheel(x, side, front, materials);
      wheels.push(wheel.group);
      rimStyles.push(...wheel.rimStyles);
    }
  }
  return { wheels, rimStyles };
}
