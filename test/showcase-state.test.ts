import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCar } from '../src/car/buildCar';
import { APERTURE } from '../src/car/carGeometry';

/** The resting state: no explosion, no door swing — exactly what Showcase renders. */
function showcase(car: ReturnType<typeof buildCar>): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(car.root);
  scene.updateMatrixWorld(true);
  return scene;
}

const WHEELS = ['wheel-front-left', 'wheel-front-right', 'wheel-rear-left', 'wheel-rear-right'];

const findDeep = (root: THREE.Object3D, name: string): THREE.Object3D | undefined =>
  root.getObjectByName(name);

describe('showcase state — four-wheel completeness', () => {
  const car = buildCar();
  const scene = showcase(car);

  it('builds all four wheels, each with a tire, a hub and both rim faces', () => {
    for (const name of WHEELS) {
      const wheel = scene.getObjectByName(name);
      expect(wheel, `missing ${name}`).toBeTruthy();

      const activeRim = wheel!.children.find((child) => child.name === 'rim-style-1');
      expect(activeRim, `${name} has no rim-style-1 holder`).toBeTruthy();

      expect(findDeep(wheel!, `tire-${name.slice('wheel-'.length)}`), `${name} is missing its tire`).toBeTruthy();
      expect(findDeep(wheel!, `tread-${name.slice('wheel-'.length)}`)).toBeTruthy();
      for (const part of ['rim-outer', 'rim-inner', 'hub-outer', 'hub-inner', 'rim-face-outer', 'rim-face-inner']) {
        expect(findDeep(activeRim!, part), `${name} is missing ${part}`).toBeTruthy();
      }
    }
  });

  it('turns every outboard rim face away from the car centreline', () => {
    const worldPosition = new THREE.Vector3();
    for (const name of WHEELS) {
      const wheel = scene.getObjectByName(name)!;
      const outerRim = wheel.getObjectByName('rim-face-outer')!;
      outerRim.getWorldPosition(worldPosition);

      // The wheel's own world Z tells us which side of the car it is on; the
      // outboard rim face must be further out still, on the same side.
      const wheelZ = wheel.getWorldPosition(new THREE.Vector3()).z;
      expect(Math.sign(worldPosition.z), `${name} rim faces inboard`).toBe(Math.sign(wheelZ));
      expect(Math.abs(worldPosition.z)).toBeGreaterThan(Math.abs(wheelZ));
    }
  });

  it('keeps every rim face outside the tire carcass, not floating proud of it', () => {
    for (const name of WHEELS) {
      const wheel = scene.getObjectByName(name)!;
      const outer = new THREE.Box3().setFromObject(wheel.getObjectByName('rim-face-outer')!);
      const tire = new THREE.Box3().setFromObject(wheel.getObjectByName(`tire-${name.slice('wheel-'.length)}`)!);
      // Rim sits inside the tire's width so no viewing angle exposes a bare disc.
      expect(outer.min.z).toBeGreaterThanOrEqual(tire.min.z - 1e-6);
      expect(outer.max.z).toBeLessThanOrEqual(tire.max.z + 1e-6);
    }
  });
});

describe('showcase state — nothing is wrongly hidden', () => {
  const car = buildCar();

  it('hides only the unselected rim styles', () => {
    const hidden: string[] = [];
    car.root.traverse((object) => {
      if (!object.visible) hidden.push(object.name || object.type);
    });
    expect(hidden.length).toBeGreaterThan(0);
    for (const name of hidden) {
      expect(name, `unexpectedly hidden: ${name}`).toMatch(/^rim-style-[23]$/);
    }
  });

  it('gives every mesh a material and a finite transform', () => {
    car.root.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      expect(mesh.material, `${mesh.name} has no material`).toBeTruthy();
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(Number.isFinite(mesh.position[axis]), `${mesh.name} position.${axis}`).toBe(true);
        expect(Number.isFinite(mesh.scale[axis]), `${mesh.name} scale.${axis}`).toBe(true);
      }
      expect(mesh.scale.x).toBeGreaterThan(0);
      expect(mesh.scale.y).toBeGreaterThan(0);
      expect(mesh.scale.z).toBeGreaterThan(0);
    });
  });
});

describe('showcase state — the car is one closed structure', () => {
  const car = buildCar();
  const scene = showcase(car);

  it('keeps the silver frame inside the body envelope', () => {
    const skeleton = scene.getObjectByName('skeleton');
    expect(skeleton, 'skeleton is missing from the showcase state').toBeTruthy();
    expect(skeleton!.children.length).toBeGreaterThan(10);

    const frame = new THREE.Box3().setFromObject(skeleton!);
    expect(frame.min.x).toBeGreaterThan(-2.1);
    expect(frame.max.x).toBeLessThan(2.1);
    expect(frame.min.y).toBeGreaterThan(0.25);
    // Normal showcase keeps frame work below the beltline: no buggy-like roll cage.
    expect(frame.max.y).toBeLessThan(0.82);
    expect(Math.abs(frame.min.z)).toBeLessThan(0.9);
    expect(Math.abs(frame.max.z)).toBeLessThan(0.9);
  });

  it('bridges the two body skins so the shell is not a pair of floating slabs', () => {
    // Full-width caps close the nose, the tail and the underside.
    for (const cap of ['front-fascia', 'rear-fascia', 'underbody-pan']) {
      const mesh = scene.getObjectByName(cap);
      expect(mesh, `missing cap "${cap}"`).toBeTruthy();
      const box = new THREE.Box3().setFromObject(mesh!);
      expect(box.max.z - box.min.z, `${cap} does not span the body width`).toBeGreaterThan(1.5);
    }
  });

  it('seats the cabin glass on the pillars instead of floating it', () => {
    const glass = new THREE.Box3().setFromObject(scene.getObjectByName('glass')!);
    const cabin = new THREE.Box3().setFromObject(scene.getObjectByName('cabin-shell')!);
    expect(glass.min.y).toBeLessThanOrEqual(cabin.max.y + 1e-6);
    expect(glass.max.y).toBeLessThanOrEqual(cabin.max.y + 0.05);
  });

  it('seats the seats, dashboard and steering wheel inside the shell', () => {
    for (const name of ['seats', 'dashboard', 'steering']) {
      const part = scene.getObjectByName(name);
      expect(part, `missing ${name}`).toBeTruthy();
      const box = new THREE.Box3().setFromObject(part!);
      expect(box.min.y, `${name} sinks through the floor`).toBeGreaterThan(0.4);
      expect(Math.abs(box.min.z), `${name} pokes out of the side skin`).toBeLessThan(0.83);
      expect(Math.abs(box.max.z), `${name} pokes out of the side skin`).toBeLessThan(0.83);
    }
  });

  it('closes each door slab over the full aperture', () => {
    for (const side of ['left', 'right']) {
      const panel = new THREE.Box3().setFromObject(scene.getObjectByName(`door-panel-${side}`)!);
      expect(panel.min.x).toBeLessThanOrEqual(APERTURE.minX);
      expect(panel.max.x).toBeGreaterThanOrEqual(APERTURE.maxX);
      expect(panel.min.y).toBeLessThanOrEqual(APERTURE.minY);
      expect(panel.max.y).toBeGreaterThanOrEqual(APERTURE.maxY);
    }
  });

  it('keeps the passenger doorway free of structural beams', () => {
    const frame = scene.getObjectByName('skeleton')!;
    const doorway = new THREE.Box3(
      new THREE.Vector3(APERTURE.minX, 0.62, -0.9),
      new THREE.Vector3(APERTURE.maxX, APERTURE.maxY, 0.9),
    );
    frame.children.forEach((beam) => {
      expect(new THREE.Box3().setFromObject(beam).intersectsBox(doorway), `${beam.name} blocks the entry`).toBe(false);
    });
  });

  it('does not create a fixed beltline bar across either door opening', () => {
    expect(scene.getObjectByName('beltline-lip--1')).toBeUndefined();
    expect(scene.getObjectByName('beltline-lip-1')).toBeUndefined();
  });

  it('builds the side wall from a sill and vertical jambs, with no static lintel in the door opening', () => {
    const clearDoorway = new THREE.Box3(
      // Start above the retained lower sill and its extrusion bevel.
      // Keep clear of the small bevels on the retained vertical jambs.
      new THREE.Vector3(APERTURE.minX + 0.05, APERTURE.minY + 0.04, -0.95),
      new THREE.Vector3(APERTURE.maxX - 0.05, 1.155, 0.95),
    );
    for (const side of ['left', 'right']) {
      for (const name of [`door-sill-panel-${side}`, `door-jamb-front-${side}`, `door-jamb-rear-${side}`]) {
        const mesh = scene.getObjectByName(name);
        expect(mesh, `missing body component ${name}`).toBeTruthy();
        expect(new THREE.Box3().setFromObject(mesh!).intersectsBox(clearDoorway), `${name} crosses the open doorway`).toBe(false);
      }
    }
    expect(scene.getObjectByName('side-wall-panel-left')).toBeUndefined();
    expect(scene.getObjectByName('side-wall-panel-right')).toBeUndefined();
  });

  it('orients the steering wheel toward the driver along the car X axis', () => {
    const pivot = scene.getObjectByName('steering-wheel-pivot');
    expect(pivot).toBeTruthy();
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(pivot!.getWorldQuaternion(new THREE.Quaternion()));
    expect(normal.x).toBeGreaterThan(0.94);
    expect(Math.abs(normal.z)).toBeLessThan(0.12);
  });

  it('keeps every wheel in contact with the ground plane', () => {
    for (const name of WHEELS) {
      const box = new THREE.Box3().setFromObject(scene.getObjectByName(name)!);
      expect(box.min.y, `${name} floats or sinks`).toBeGreaterThan(-0.005);
      expect(box.min.y).toBeLessThan(0.005);
    }
  });
});
