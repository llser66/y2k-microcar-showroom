import * as THREE from 'three';
import { createMaterials, metal, type CarMaterials } from './carMaterials';
import { buildBodyShells } from './bodyShell';
import { buildChassis } from './chassis';
import { buildInterior } from './interior';
import { buildGreenhouse, ROOF_Y } from './greenhouse';
import { buildDoors, type DoorAnchor } from './doors';
import { buildWheels } from './wheels';
import { beamBetween, sideName } from './carGeometry';

export type { DoorAnchor };

export interface ExplosionPart {
  /** The scene object whose local transform is interpolated. */
  object: THREE.Object3D;
  /** Exploded-position delta from the object's rest position. */
  offset: THREE.Vector3;
}

export interface CarAssembly {
  root: THREE.Group;
  doorAnchors: DoorAnchor[];
  wheels: THREE.Group[];
  lights: THREE.Mesh[];
  /** Rear lamp lenses; toggled to a red glow with the headlights. */
  tailLamps: THREE.Mesh[];
  explosionParts: ExplosionPart[];
  bodyMaterials: THREE.MeshPhysicalMaterial[];
}

/** Headlamps seat on the nose face; the rear lamps lie along the rear-deck rake. */
// Keep the lamp assembly proud of the rounded-square front fascia. The previous
// position sat behind the new flatter nose crown, hiding the headlamp face.
const HEADLAMP = { x: -2.15, y: 0.62, z: 0.5 } as const;
/** Rear panel below the deck rake, where the tail surface is close to vertical. */
const TAIL_LAMP = { x: 2.0063, y: 0.4737, z: 0.55 } as const;
const REAR_PANEL_ANGLE = 0.1452;

function buildLights(materials: CarMaterials): { lights: THREE.Mesh[]; groups: THREE.Group[]; tails: THREE.Mesh[]; tailLamps: THREE.Mesh[] } {
  const lights: THREE.Mesh[] = [];
  const groups: THREE.Group[] = [];
  const tails: THREE.Mesh[] = [];
  const tailLamps: THREE.Mesh[] = [];

  for (const side of [-1, 1]) {
    const label = sideName(side);
    const lamp = new THREE.Group();
    lamp.name = `headlamp-${label}`;

    // Dark bezel first, so the lens always reads against the pale body.
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.028, 10, 28), materials.rubber);
    // The vehicle faces -X; point the chrome bezel normal forward with the lens.
    bezel.rotation.y = -Math.PI / 2;
    bezel.position.set(HEADLAMP.x + 0.012, HEADLAMP.y, side * HEADLAMP.z);
    bezel.name = `headlamp-bezel-${label}`;
    lamp.add(bezel);

    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12), materials.lampEmitter);
    emitter.scale.set(0.32, 0.8, 1);
    emitter.position.set(HEADLAMP.x, HEADLAMP.y, side * HEADLAMP.z);
    emitter.name = `headlamp-emitter-${label}`;
    lamp.add(emitter);
    lights.push(emitter);

    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 12), materials.lampLens);
    lens.scale.set(0.32, 0.85, 1);
    lens.position.set(HEADLAMP.x - 0.018, HEADLAMP.y, side * HEADLAMP.z);
    lens.name = `headlamp-lens-${label}`;
    lamp.add(lens);

    groups.push(lamp);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.48), materials.rubber);
    housing.position.set(TAIL_LAMP.x, TAIL_LAMP.y, side * TAIL_LAMP.z);
    housing.rotation.z = REAR_PANEL_ANGLE;
    housing.name = `tail-light-housing-${label}`;
    tails.push(housing);

    // Offset along the panel normal (0.9895, 0.1445) so the lens sits proud of its bezel.
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.4), materials.tailLight);
    tail.position.set(TAIL_LAMP.x + 0.0198, TAIL_LAMP.y + 0.0029, side * TAIL_LAMP.z);
    tail.rotation.z = REAR_PANEL_ANGLE;
    tail.name = `tail-light-${label}`;
    tails.push(tail);
    tailLamps.push(tail);
  }
  return { lights, groups, tails, tailLamps };
}

/** Roof rack, carried just clear of the roof glass. */
function buildRack(): THREE.Group {
  const rack = new THREE.Group();
  rack.name = 'roof-rack';
  const rackMaterial = metal(0xe9f7fa, 0.26);
  const railY = ROOF_Y + 0.07;

  for (const z of [-0.55, 0.55]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.54, 12), rackMaterial);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0.05, railY, z);
    rack.add(rail);
    // Feet dropping onto the roof so the rack is mounted, not floating.
    for (const x of [-0.57, 0.67]) {
      rack.add(beamBetween(
        new THREE.Vector3(x, ROOF_Y - 0.01, z),
        new THREE.Vector3(x, railY, z),
        0.018, rackMaterial));
    }
  }
  for (const x of [-0.57, 0.67]) {
    const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 1.14, 12), rackMaterial);
    crossBar.rotation.x = Math.PI / 2;
    crossBar.position.set(x, railY + 0.03, 0);
    rack.add(crossBar);
  }
  return rack;
}

/** A paired set of compact, body-colour side mirrors mounted at the A-pillars. */
function buildSideMirrors(materials: CarMaterials): THREE.Group {
  const mirrors = new THREE.Group();
  mirrors.name = 'side-mirrors';
  const mirrorGlass = new THREE.MeshPhysicalMaterial({
    color: '#b7e4ec', roughness: 0.12, metalness: 0.46,
    clearcoat: 0.95, clearcoatRoughness: 0.08, side: THREE.DoubleSide,
  });

  for (const side of [-1, 1]) {
    const label = sideName(side);
    const mirror = new THREE.Group();
    mirror.name = `side-mirror-${label}`;

    const stalk = beamBetween(
      new THREE.Vector3(-1.48, 1.36, side * 0.84),
      new THREE.Vector3(-1.41, 1.46, side * 0.925),
      0.016,
      materials.chrome,
    );
    stalk.name = `side-mirror-stalk-${label}`;
    mirror.add(stalk);

    const center = new THREE.Vector3(-1.39, 1.48, side * 1.0);
    const housing = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), materials.body);
    housing.scale.set(0.12, 0.075, 0.085);
    housing.position.copy(center);
    housing.name = `side-mirror-housing-${label}`;
    housing.castShadow = true;
    mirror.add(housing);

    // The reflective face looks rearward and outward from the driver's seat.
    const normal = new THREE.Vector3(0.42, 0.08, side * 0.9).normalize();
    const lens = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mirrorGlass);
    lens.scale.set(0.086, 0.05, 0.008);
    lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    lens.position.copy(center).addScaledVector(normal, 0.068);
    lens.name = `side-mirror-glass-${label}`;
    mirror.add(lens);
    mirrors.add(mirror);
  }
  return mirrors;
}

/**
 * Assemble the complete car. Every part is present in the resting (showcase)
 * state; the exploded view is expressed purely as offsets applied later.
 */
export function buildCar(): CarAssembly {
  const root = new THREE.Group();
  root.name = 'procedural-city-pod';

  const materials = createMaterials();

  // ---- painted shell: front / rear / left / right ---------------------------
  const shells = buildBodyShells(materials);
  const doors = buildDoors(materials);
  const greenhouse = buildGreenhouse(materials);
  const interior = buildInterior(materials);
  const skeleton = buildChassis(materials);
  const { wheels } = buildWheels(materials);
  const { lights, groups: headlampGroups, tails: tailLights, tailLamps } = buildLights(materials);
  const mirrors = buildSideMirrors(materials);
  const rack = buildRack();

  root.add(
    shells.frontShell, shells.rearShell, shells.capsuleBridge, shells.underbody,
    greenhouse.cabinShell, greenhouse.glass,
    skeleton, interior.floor, interior.seats, interior.dashboard, interior.steering,
    ...doors.doorAnchors.map((anchor) => anchor.rig),
    ...wheels, ...headlampGroups, ...tailLights, mirrors,
    rack,
  );

  // ---- exploded-view parts (rest → exploded position interpolation) ---------
  const explosionParts: ExplosionPart[] = [
    { object: shells.frontShell, offset: new THREE.Vector3(-0.34, 0, 0) },
    { object: shells.rearShell, offset: new THREE.Vector3(0.34, 0, 0) },
    { object: shells.sideWallLeft, offset: new THREE.Vector3(0, 0, 0.2) },
    { object: shells.sideWallRight, offset: new THREE.Vector3(0, 0, -0.2) },
    { object: shells.capsuleBridge, offset: new THREE.Vector3(0, 0.22, 0) },
    { object: greenhouse.cabinShell, offset: new THREE.Vector3(0, 0.24, 0) },
    { object: greenhouse.glass, offset: new THREE.Vector3(0, 0.42, 0) },
    { object: rack, offset: new THREE.Vector3(0, 0.4, 0) },
    { object: mirrors, offset: new THREE.Vector3(-0.18, 0.04, 0) },
    // Interior, chassis and underbody hold their resting positions so the
    // structure stays readable.
    { object: shells.underbody, offset: new THREE.Vector3(0, 0, 0) },
    { object: skeleton, offset: new THREE.Vector3(0, 0, 0) },
    { object: interior.floor, offset: new THREE.Vector3(0, 0, 0) },
    { object: interior.seats, offset: new THREE.Vector3(0, 0, 0) },
    { object: interior.dashboard, offset: new THREE.Vector3(0, 0, 0) },
    { object: interior.steering, offset: new THREE.Vector3(0, 0, 0) },
    ...wheels.map((wheel) => ({
      object: wheel,
      offset: new THREE.Vector3(Math.sign(wheel.position.x) * 0.1, 0, Math.sign(wheel.position.z) * 0.4),
    })),
    ...headlampGroups.map((lamp) => ({
      object: lamp,
      offset: new THREE.Vector3(-0.25, 0.03, Math.sign(lamp.children[0].position.z) * 0.1),
    })),
    ...tailLights.map((tail) => ({
      object: tail,
      offset: new THREE.Vector3(0.25, 0.03, Math.sign(tail.position.z) * 0.1),
    })),
  ];

  return {
    root,
    doorAnchors: doors.doorAnchors,
    wheels,
    lights,
    tailLamps,
    explosionParts,
    bodyMaterials: [materials.body, ...doors.materials],
  };
}
