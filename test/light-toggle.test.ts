import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCar } from '../src/car/buildCar';
import { VehicleInteractionController } from '../src/car/VehicleInteractionController';

describe('headlight toggle', () => {
  it('drives lamps, spotlights and ground pools through off → on → off', () => {
    const car = buildCar();
    const spots = [new THREE.SpotLight(), new THREE.SpotLight()];
    const pools = [new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial()), new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial())];
    const controller = new VehicleInteractionController(car, spots, pools);
    controller.toggleHeadlights();
    expect(spots.every((spot) => spot.intensity === 28)).toBe(true);
    expect(pools.every((pool) => pool.visible)).toBe(true);
    expect(car.lights.every((lamp) => (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity === 5)).toBe(true);
    controller.toggleHeadlights();
    expect(spots.every((spot) => spot.intensity === 0)).toBe(true);
    expect(pools.every((pool) => !pool.visible)).toBe(true);
  });
});
