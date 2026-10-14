import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCar } from '../src/car/buildCar';

/** Apply the exploded-view transforms (progress = 1) the same way ShowroomApp does. */
function explode(car: ReturnType<typeof buildCar>): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(car.root);
  car.explosionParts.forEach(({ object, offset }) => {
    object.position.copy(object.position.clone().add(offset)); // base + offset, progress 1
  });
  car.doorAnchors.forEach(({ rig, pivot, side }) => {
    pivot.rotation.y = -side * 1.42; // factor 1
    rig.position.z = side * 0.42;
  });
  scene.updateMatrixWorld(true);
  return scene;
}

const boxOf = (scene: THREE.Scene, name: string): THREE.Box3 => {
  const object = scene.getObjectByName(name);
  expect(object, `missing part "${name}"`).toBeTruthy();
  return new THREE.Box3().setFromObject(object!);
};

const mirrorZ = (box: THREE.Box3): THREE.Box3 =>
  new THREE.Box3(
    new THREE.Vector3(box.min.x, box.min.y, -box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, -box.min.z),
  );

const WHEELS = ['wheel-front-left', 'wheel-front-right', 'wheel-rear-left', 'wheel-rear-right'];
const SHELLS = ['front-shell', 'rear-shell', 'side-wall-left', 'side-wall-right'];

describe('exploded view symmetry', () => {
  const scene = explode(buildCar());

  it('mirrors left/right side walls about the Z axis', () => {
    const left = boxOf(scene, 'side-wall-left');
    const right = boxOf(scene, 'side-wall-right');
    expect(mirrorZ(left).min.distanceTo(right.min)).toBeLessThan(0.01);
    expect(mirrorZ(left).max.distanceTo(right.max)).toBeLessThan(0.01);
  });

  it('mirrors left/right body shells (front and rear) about the Z axis', () => {
    for (const name of ['front-shell', 'rear-shell']) {
      const left = boxOf(scene, `${name}-panel-left`);
      const right = boxOf(scene, `${name}-panel-right`);
      expect(mirrorZ(left).min.distanceTo(right.min)).toBeLessThan(0.01);
      expect(mirrorZ(left).max.distanceTo(right.max)).toBeLessThan(0.01);
    }
  });

  it('mirrors left/right wheels about the Z axis', () => {
    for (const axle of ['front', 'rear']) {
      const left = boxOf(scene, `wheel-${axle}-left`);
      const right = boxOf(scene, `wheel-${axle}-right`);
      expect(mirrorZ(left).min.distanceTo(right.min)).toBeLessThan(0.01);
      expect(mirrorZ(left).max.distanceTo(right.max)).toBeLessThan(0.01);
    }
  });
});

describe('exploded view separation (no interpenetration)', () => {
  const scene = explode(buildCar());

  it('keeps wheels clear of the body shells (no tire through body)', () => {
    for (const wheel of WHEELS) {
      const wheelBox = boxOf(scene, wheel);
      for (const shell of SHELLS) {
        expect(wheelBox.intersectsBox(boxOf(scene, shell)),
          `${wheel} should not intersect ${shell}`).toBe(false);
      }
    }
  });

  it('separates the front and rear shells longitudinally', () => {
    expect(boxOf(scene, 'front-shell').intersectsBox(boxOf(scene, 'rear-shell'))).toBe(false);
  });

  it('swings each door outward past its side wall and clear of the cabin interior', () => {
    const leftDoor = boxOf(scene, 'door-rig-left');
    const rightDoor = boxOf(scene, 'door-rig-right');
    // Far edge reaches further out than the wall (opens away from the body)...
    expect(leftDoor.max.z).toBeGreaterThan(boxOf(scene, 'side-wall-left').max.z);
    expect(rightDoor.min.z).toBeLessThan(boxOf(scene, 'side-wall-right').min.z);
    // ...and never swings through the interior seats.
    expect(leftDoor.intersectsBox(boxOf(scene, 'seats'))).toBe(false);
    expect(rightDoor.intersectsBox(boxOf(scene, 'seats'))).toBe(false);
  });

  it('lifts the glass canopy clear of the cabin shell (no glass through roof)', () => {
    const roofGlass = boxOf(scene, 'panoramic-roof-glass');
    const cabin = boxOf(scene, 'cabin-shell');
    expect(roofGlass.min.y).toBeGreaterThan(cabin.max.y);
  });
});
