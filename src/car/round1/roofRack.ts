import * as THREE from 'three';
import { beamBetween, ROOF_Y } from './dimensions';
import type { CarMaterials } from './materials';

/** The roof is flat, so the rack is a simple pair of rails on short feet. */
const RAIL_Z = 0.44;
const RAIL_Y = ROOF_Y + 0.075;
/** Kept inside the flat run of the roof, which spans x = -0.22 to 0.76. */
const RAIL_FROM_X = -0.16;
const RAIL_TO_X = 0.7;

export function buildRoofRack(materials: CarMaterials): THREE.Group {
  const rack = new THREE.Group();
  rack.name = 'RoofRack';

  for (const side of [1, -1] as const) {
    const z = side * RAIL_Z;
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, RAIL_TO_X - RAIL_FROM_X, 12),
      materials.chrome,
    );
    rail.name = `roof-rail-${side > 0 ? 'left' : 'right'}`;
    rail.rotation.z = Math.PI / 2;
    rail.position.set((RAIL_FROM_X + RAIL_TO_X) / 2, RAIL_Y, z);
    rack.add(rail);

    for (const x of [RAIL_FROM_X + 0.06, RAIL_TO_X - 0.06]) {
      rack.add(
        beamBetween(new THREE.Vector3(x, ROOF_Y - 0.01, z), new THREE.Vector3(x, RAIL_Y, z), 0.018, materials.chrome),
      );
    }
  }

  for (const x of [RAIL_FROM_X + 0.06, RAIL_TO_X - 0.06]) {
    const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, RAIL_Z * 2, 12), materials.chrome);
    crossBar.name = 'roof-rack-crossbar';
    crossBar.rotation.x = Math.PI / 2;
    crossBar.position.set(x, RAIL_Y + 0.028, 0);
    rack.add(crossBar);
  }
  return rack;
}
