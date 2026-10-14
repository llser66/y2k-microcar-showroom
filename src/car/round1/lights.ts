import * as THREE from 'three';
import { CLIP_FRONT_X, CLIP_REAR_X, sideName } from './dimensions';
import type { CarMaterials } from './materials';

export interface Lights {
  group: THREE.Group;
  /** Meshes that glow; handy for tests and for a future lighting pass. */
  emitters: THREE.Mesh[];
}

const LAMP_Y = 0.78;
const LAMP_Z = 0.44;
/** How far the lamp assembly is recessed behind the body's end plane. */
const LAMP_RECESS = 0.03;

export function buildLights(materials: CarMaterials): Lights {
  const group = new THREE.Group();
  group.name = 'Lights';
  const emitters: THREE.Mesh[] = [];

  for (const side of [1, -1] as const) {
    const label = sideName(side);
    const z = side * LAMP_Z;

    // Both lamps are pushed in behind the body's end plane so only the lens and
    // the bezel ring stand proud. Mounting them on the plane itself would leave
    // the whole assembly hanging off the nose.
    const head = new THREE.Group();
    head.name = `headlamp-${label}`;
    head.position.set(CLIP_FRONT_X + LAMP_RECESS, LAMP_Y, z);

    // The ring has to clear the lens, not sit inside it. Sized any smaller and the
    // lens swallows the bezel whole, leaving a pale disc with no visible edge.
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 10, 28), materials.rubber);
    bezel.name = `headlamp-bezel-${label}`;
    bezel.rotation.y = Math.PI / 2;
    bezel.position.x = -0.01;
    head.add(bezel);

    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 14), materials.lampEmitter);
    emitter.name = `headlamp-emitter-${label}`;
    emitter.scale.set(0.36, 0.95, 1);
    emitter.position.x = 0.02;
    head.add(emitter);
    emitters.push(emitter);

    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 14), materials.lampLens);
    lens.name = `headlamp-lens-${label}`;
    lens.scale.set(0.36, 0.95, 1);
    lens.position.x = 0.01;
    head.add(lens);

    group.add(head);

    const tail = new THREE.Group();
    tail.name = `tail-light-${label}`;
    tail.position.set(CLIP_REAR_X - LAMP_RECESS, LAMP_Y, z);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.44), materials.rubber);
    housing.name = `tail-housing-${label}`;
    tail.add(housing);

    const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.19, 0.38), materials.tailLight);
    tailLamp.name = `tail-emitter-${label}`;
    tailLamp.position.x = 0.02;
    tail.add(tailLamp);
    emitters.push(tailLamp);

    group.add(tail);
  }
  return { group, emitters };
}
