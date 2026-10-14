import * as THREE from 'three';
import { createMaterials, type CarMaterials } from './materials';
import { buildExteriorBody } from './exteriorBody';
import { buildCabin } from './cabin';
import { buildDoors, MAX_SWING, type DoorRig } from './doors';
import { buildInterior } from './interior';
import { buildWheels } from './wheels';
import { buildLights } from './lights';
import { buildRoofRack } from './roofRack';

export { MAX_SWING };
export type { DoorRig };

export interface CarModel {
  root: THREE.Group;
  materials: CarMaterials;
  doors: DoorRig[];
  wheels: THREE.Group[];
  /** Every mesh that emits light, for a later lighting pass. */
  emitters: THREE.Mesh[];
  /** 0 = shut, 1 = fully open. A pure assignment; there is no animation in Round 1. */
  setDoorsOpen(amount: number): void;
}

/**
 * Round 1 — a structurally complete Y2K two-seat A00 city pod, built entirely
 * from procedural geometry.
 *
 * The hierarchy is fixed:
 *
 *   CarRoot
 *   ├── ExteriorBody  (LowerBody, FrontBody, RearBody)
 *   ├── Cabin
 *   ├── Doors         (LeftDoor, RightDoor)
 *   ├── Interior      (DriverSeat, PassengerSeat, Dashboard, SteeringWheel, Frame)
 *   ├── Wheels        (FrontLeft, FrontRight, RearLeft, RearRight)
 *   ├── Lights
 *   └── RoofRack
 */
export function buildCar(): CarModel {
  const root = new THREE.Group();
  root.name = 'CarRoot';
  const materials = createMaterials();

  const exterior = buildExteriorBody(materials);
  const exteriorBody = new THREE.Group();
  exteriorBody.name = 'ExteriorBody';
  exteriorBody.add(exterior.lowerBody, exterior.frontBody, exterior.rearBody);
  exterior.lowerBody.name = 'LowerBody';
  exterior.frontBody.name = 'FrontBody';
  exterior.rearBody.name = 'RearBody';

  const cabin = buildCabin(materials);
  const doors = buildDoors(materials);
  const interior = buildInterior(materials);
  const { wheels, anchors } = buildWheels(materials);
  const lights = buildLights(materials);
  const roofRack = buildRoofRack(materials);

  const doorGroup = new THREE.Group();
  doorGroup.name = 'Doors';
  doorGroup.add(...doors.map((door) => door.pivot));

  const wheelGroup = new THREE.Group();
  wheelGroup.name = 'Wheels';
  // Added in the order the brief lists them, so the tree reads front-left first
  // rather than in whatever order the builder happened to emit.
  const bySlot = new Map<string, THREE.Group>();
  for (const [index, wheel] of wheels.entries()) {
    const anchor = anchors[index];
    const slot = `${anchor.front ? 'Front' : 'Rear'}${anchor.side > 0 ? 'Left' : 'Right'}`;
    wheel.name = slot;
    bySlot.set(slot, wheel);
  }
  for (const slot of ['FrontLeft', 'FrontRight', 'RearLeft', 'RearRight']) {
    const wheel = bySlot.get(slot);
    if (!wheel) throw new Error(`Round 1 built no ${slot} wheel`);
    wheelGroup.add(wheel);
  }

  root.add(exteriorBody, cabin.group, doorGroup, interior.group, wheelGroup, lights.group, roofRack);

  return {
    root,
    materials,
    doors,
    wheels,
    emitters: lights.emitters,
    setDoorsOpen(amount: number): void {
      const clamped = THREE.MathUtils.clamp(amount, 0, 1);
      for (const door of doors) {
        // Positive on the left, negative on the right: both swing outward.
        door.pivot.rotation.y = -door.side * clamped * MAX_SWING;
      }
    },
  };
}
