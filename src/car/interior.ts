import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CarMaterials } from './carMaterials';

export interface Interior {
  floor: THREE.Group;
  seats: THREE.Group;
  dashboard: THREE.Group;
  steering: THREE.Group;
}

/**
 * Cabin furniture. Every part lives inside the shell envelope
 * (|z| ≤ 0.60 against a skin inner face at 0.83) and stays put in the
 * exploded view so the packaging reads from outside.
 */
export function buildInterior(materials: CarMaterials): Interior {
  const floor = new THREE.Group();
  floor.name = 'floor';
  const pan = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.055, 1.02), materials.floor);
  pan.position.set(-0.05, 0.47, 0);
  pan.name = 'cabin-floor-pan';
  pan.receiveShadow = true;
  floor.add(pan);

  const seats = new THREE.Group();
  seats.name = 'seats';
  for (const side of [-1, 1]) {
    const cushion = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.18, 0.48, 5, 0.055), materials.upholstery);
    cushion.position.set(-0.12, 0.73, side * 0.36);
    cushion.castShadow = true;
    cushion.name = `seat-cushion-${side}`;
    seats.add(cushion);

    const back = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.56, 0.46, 5, 0.055), materials.upholstery);
    back.position.set(0.16, 1.05, side * 0.36);
    back.rotation.z = -0.15;
    back.castShadow = true;
    back.name = `seat-back-${side}`;
    seats.add(back);

    const headrest = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.16, 0.28, 4, 0.045), materials.upholstery);
    headrest.position.set(0.2, 1.4, side * 0.36);
    headrest.name = `seat-headrest-${side}`;
    seats.add(headrest);
  }

  const dashboard = new THREE.Group();
  dashboard.name = 'dashboard';
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, 1.06), materials.interiorPlastic);
  dash.position.set(-0.55, 0.78, 0);
  dash.castShadow = true;
  dash.name = 'dashboard-body';
  dashboard.add(dash);

  const binnacle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.34), materials.interiorPlastic);
  binnacle.position.set(-0.52, 1.02, -0.34);
  binnacle.name = 'dashboard-binnacle';
  dashboard.add(binnacle);

  const steering = new THREE.Group();
  steering.name = 'steering';
  steering.position.set(-0.5, 1.04, -0.35);
  const wheelPivot = new THREE.Group();
  wheelPivot.name = 'steering-wheel-pivot';
  wheelPivot.position.set(0.13, 0.02, 0);
  // TorusGeometry lies in XY (normal +Z). Rotating it about Y maps its face
  // toward the driver (+X); the small Z rake follows the steering column.
  wheelPivot.rotation.set(0, Math.PI / 2, -0.12);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.017, 10, 32), materials.interiorPlastic);
  rim.name = 'steering-rim';
  wheelPivot.add(rim);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.033, 12, 10), materials.interiorPlastic);
  hub.name = 'steering-hub';
  wheelPivot.add(hub);
  for (const angle of [0, Math.PI * 0.66, Math.PI * 1.34]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.13, 0.017), materials.interiorPlastic);
    spoke.position.set(Math.cos(angle) * 0.065, Math.sin(angle) * 0.065, 0);
    spoke.rotation.z = angle - Math.PI / 2;
    wheelPivot.add(spoke);
  }
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.28, 10), materials.trim);
  column.rotation.z = Math.PI / 2;
  column.position.set(-0.01, -0.02, 0);
  column.name = 'steering-column';
  steering.add(column, wheelPivot);

  return { floor, seats, dashboard, steering };
}
