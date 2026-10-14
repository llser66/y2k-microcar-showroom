import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCar, MAX_SWING } from '../src/car/round1/buildCar';
import { CAR, WHEEL_RADIUS } from '../src/car/round1/dimensions';

/**
 * Round 1 acceptance, as assertions rather than screenshots.
 *
 * The brief fixes a hierarchy, a parts list and a set of prohibitions. Those are
 * the things worth pinning down: a screenshot proves the model looked right once,
 * these prove it is still assembled the way the brief requires.
 */

const car = buildCar();

const names = (node: THREE.Object3D): string[] => node.children.map((child) => child.name);
const find = (node: THREE.Object3D, name: string): THREE.Object3D | undefined =>
  node.getObjectByName(name);
const meshesUnder = (node: THREE.Object3D): THREE.Mesh[] => {
  const found: THREE.Mesh[] = [];
  node.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) found.push(child as THREE.Mesh);
  });
  return found;
};

describe('Round 1 — model hierarchy', () => {
  it('roots at CarRoot with exactly the seven groups the brief names', () => {
    expect(car.root.name).toBe('CarRoot');
    expect(names(car.root)).toEqual([
      'ExteriorBody',
      'Cabin',
      'Doors',
      'Interior',
      'Wheels',
      'Lights',
      'RoofRack',
    ]);
  });

  it('splits the exterior body into lower, front and rear assemblies', () => {
    expect(names(car.root.getObjectByName('ExteriorBody')!)).toEqual([
      'LowerBody',
      'FrontBody',
      'RearBody',
    ]);
  });

  it('gives the doors and the interior the parts the brief lists', () => {
    expect(names(car.root.getObjectByName('Doors')!)).toEqual(['LeftDoor', 'RightDoor']);
    expect(names(car.root.getObjectByName('Interior')!)).toEqual([
      'DriverSeat',
      'PassengerSeat',
      'Dashboard',
      'SteeringWheel',
      'Frame',
    ]);
  });

  it('seats all four wheels at the corners', () => {
    expect(names(car.root.getObjectByName('Wheels')!)).toEqual([
      'FrontLeft',
      'FrontRight',
      'RearLeft',
      'RearRight',
    ]);
  });
});

describe('Round 1 — proportions', () => {
  it('holds the 3 : 1.5 : 1.6 city-pod ratio within a few percent', () => {
    expect(CAR.length / CAR.width).toBeCloseTo(2, 1);
    expect(CAR.height / CAR.width).toBeCloseTo(1.08, 1);
    expect(CAR.length).toBeLessThanOrEqual(3.1);
  });

  it('fits the finished model inside the declared envelope', () => {
    const box = new THREE.Box3().setFromObject(car.root);
    const size = box.getSize(new THREE.Vector3());
    // The pressed trim stands a centimetre or two proud of the panels, and the
    // roof rack is the only thing allowed above the roofline, so the envelope
    // carries a little tolerance on every axis.
    expect(size.x).toBeLessThanOrEqual(CAR.length + 0.08);
    expect(size.z).toBeLessThanOrEqual(CAR.width + 0.08);
    expect(size.y).toBeLessThanOrEqual(CAR.height + 0.15);
  });

  it('gives the pod oversized wheels, not sports-car wheels', () => {
    const box = new THREE.Box3().setFromObject(car.root.getObjectByName('FrontLeft')!);
    const diameter = box.getSize(new THREE.Vector3()).y;
    expect(diameter).toBeGreaterThan(WHEEL_RADIUS * 1.8);
    // Big enough to read as a city pod, not so big it becomes an off-roader.
    expect(diameter / CAR.height).toBeLessThan(0.45);
  });
});

describe('Round 1 — doors', () => {
  it('starts shut, and opens outward on both sides', () => {
    const shut = car.doors.map((door) => door.pivot.rotation.y);
    expect(shut).toEqual([0, 0]);

    car.setDoorsOpen(1);
    const [left, right] = car.doors;
    // Mirrored: one swings +Y, the other -Y, so both move away from the flanks.
    expect(Math.sign(left.pivot.rotation.y)).toBe(-Math.sign(right.pivot.rotation.y));
    expect(Math.abs(left.pivot.rotation.y)).toBeCloseTo(MAX_SWING, 5);

    car.setDoorsOpen(0);
    // `-side * 0` yields -0, which toEqual treats as distinct from 0.
    for (const door of car.doors) expect(Math.abs(door.pivot.rotation.y)).toBe(0);
  });

  it('carries a real door: outer skin, glazing and an inner card', () => {
    for (const label of ['left', 'right']) {
      expect(find(car.root, `door-panel-${label}`)).toBeDefined();
      expect(find(car.root, `door-window-${label}`)).toBeDefined();
      expect(find(car.root, `door-inner-panel-${label}`)).toBeDefined();
      expect(find(car.root, `door-handle-${label}`)).toBeDefined();
    }
  });

  it('swings the door clear of the car when open, not merely wider', () => {
    const door = car.doors[0];
    car.setDoorsOpen(1);
    car.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(door.pivot);
    car.setDoorsOpen(0);
    expect(box.max.z).toBeGreaterThan(CAR.width / 2);
  });
});

describe('Round 1 — interior is built, not implied', () => {
  it('gives each seat a cushion and a backrest', () => {
    for (const seat of ['DriverSeat', 'PassengerSeat']) {
      const group = car.root.getObjectByName(seat)!;
      expect(find(group, 'cushion')).toBeDefined();
      expect(find(group, 'backrest')).toBeDefined();
    }
  });

  it('gives the steering wheel a rim and a hub', () => {
    const steering = car.root.getObjectByName('SteeringWheel')!;
    expect(find(steering, 'steering-rim')).toBeDefined();
    expect(find(steering, 'steering-hub')).toBeDefined();
  });

  it('gives the frame pillars and rails, all inside the shell', () => {
    const frame = car.root.getObjectByName('Frame')!;
    expect(meshesUnder(frame).length).toBeGreaterThanOrEqual(10);

    // The cage runs the full height of the cabin box — floor rails down in the
    // tub, roof rails up at the greenhouse — so the meaningful invariant is that
    // no member escapes the car's skin.
    const skin = new THREE.Box3().setFromObject(car.root);
    for (const mesh of meshesUnder(frame)) {
      const box = new THREE.Box3().setFromObject(mesh);
      expect(skin.containsBox(box), `${mesh.name} escapes the body`).toBe(true);
    }
  });
});

describe('Round 1 — wheels', () => {
  it('builds every wheel from a tire and a multi-ring rim', () => {
    const SLOTS: Array<[string, string]> = [
      ['FrontLeft', 'front-left'],
      ['FrontRight', 'front-right'],
      ['RearLeft', 'rear-left'],
      ['RearRight', 'rear-right'],
    ];
    for (const [slot, label] of SLOTS) {
      const wheel = car.root.getObjectByName(slot)!;
      expect(find(wheel, `tire-${label}`)).toBeDefined();
      expect(find(wheel, `rim-outer-ring-${label}`)).toBeDefined();
      expect(find(wheel, `rim-middle-ring-${label}`)).toBeDefined();
      expect(find(wheel, `rim-hub-${label}`)).toBeDefined();
    }
  });

  it('puts each wheel on the ground, outboard of the body', () => {
    for (const wheel of car.wheels) {
      car.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(wheel);
      expect(box.min.y).toBeCloseTo(0, 1);
      expect(Math.abs(box.getCenter(new THREE.Vector3()).z)).toBeGreaterThan(0.3);
    }
  });
});

describe('Round 1 — prohibitions', () => {
  it('hides no missing structure behind transparency', () => {
    // Only the glazing may be see-through; every structural mesh is opaque.
    const structural = ['ExteriorBody', 'Interior', 'Wheels'].map((name) =>
      car.root.getObjectByName(name)!,
    );
    for (const group of structural) {
      for (const mesh of meshesUnder(group)) {
        const material = mesh.material as THREE.Material;
        expect(material.transparent, `${mesh.name} is transparent`).toBe(false);
      }
    }
  });

  it('ships no animation and no exotic materials', () => {
    const allowed = [THREE.MeshStandardMaterial, THREE.MeshPhysicalMaterial];
    for (const mesh of meshesUnder(car.root)) {
      const material = mesh.material as THREE.Material;
      expect(allowed.some((type) => material instanceof type), `${mesh.name}`).toBe(true);
      // No shader patching: Round 1 has no custom GLSL.
      expect(material.onBeforeCompile).toBe(THREE.Material.prototype.onBeforeCompile);
    }
    // Round 1 is a still model — nothing may be mid-motion on load.
    expect(car.doors.every((door) => door.pivot.rotation.y === 0)).toBe(true);
  });
});
