import * as THREE from 'three';
import { AXLE_FRONT_X, AXLE_REAR_X, sideName, WHEEL_RADIUS, WHEEL_WIDTH, WHEEL_Y, WHEEL_Z } from './dimensions';
import type { CarMaterials } from './materials';

/** Where the rim's brightwork sits, measured from the wheel's centre plane. */
const RIM_FACE_Z = 0.062;
const RIM_RADIUS = WHEEL_RADIUS - 0.055;
const SPOKES = 6;

/**
 * The tire carcass: a lathed ring so the shoulders are actually round instead of
 * a cylinder with a hard edge. Lathe revolves about +Y, so the mesh is tipped a
 * quarter turn to put its axis along the car's Z.
 */
function tireGeometry(): THREE.LatheGeometry {
  const half = WHEEL_WIDTH / 2;
  const shoulder = 0.05;
  const inner = RIM_RADIUS - 0.01;
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(inner, -half),
    new THREE.Vector2(WHEEL_RADIUS - shoulder, -half),
    new THREE.Vector2(WHEEL_RADIUS, -half + shoulder),
    new THREE.Vector2(WHEEL_RADIUS, half - shoulder),
    new THREE.Vector2(WHEEL_RADIUS - shoulder, half),
    new THREE.Vector2(inner, half),
    new THREE.Vector2(inner, -half),
  ];
  return new THREE.LatheGeometry(profile, 40);
}

/**
 * One rim face. Every wheel gets two — an inboard one as well as the outboard
 * one — so no viewing angle can catch a bare hole where a wheel's brightwork
 * should be.
 */
function rimFace(label: string, facing: 'outer' | 'inner', materials: CarMaterials): THREE.Group {
  const face = new THREE.Group();
  face.name = `rim-${facing}-${label}`;
  face.position.z = (facing === 'outer' ? 1 : -1) * RIM_FACE_Z;

  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(RIM_RADIUS, 0.018, 10, 36), materials.chrome);
  outerRing.name = `rim-outer-ring-${label}`;
  face.add(outerRing);

  const middleRing = new THREE.Mesh(new THREE.TorusGeometry(RIM_RADIUS * 0.66, 0.015, 10, 32), materials.chrome);
  middleRing.name = `rim-middle-ring-${label}`;
  face.add(middleRing);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.05, 20), materials.chrome);
  hub.name = `rim-hub-${label}`;
  hub.rotation.x = Math.PI / 2;
  face.add(hub);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), materials.rubber);
  cap.name = `rim-cap-${label}`;
  cap.scale.set(1, 1, 0.6);
  cap.position.z = 0.03;
  face.add(cap);

  for (let i = 0; i < SPOKES; i++) {
    const angle = (i / SPOKES) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(RIM_RADIUS * 0.62, 0.026, 0.03),
      materials.chrome,
    );
    spoke.name = `rim-spoke-${label}`;
    spoke.position.set(Math.cos(angle) * RIM_RADIUS * 0.5, Math.sin(angle) * RIM_RADIUS * 0.5, 0);
    spoke.rotation.z = angle;
    face.add(spoke);
  }
  return face;
}

function buildWheel(label: string, materials: CarMaterials): THREE.Group {
  const wheel = new THREE.Group();
  wheel.name = `wheel-${label}`;

  const tire = new THREE.Mesh(tireGeometry(), materials.rubber);
  tire.name = `tire-${label}`;
  tire.rotation.x = Math.PI / 2;
  wheel.add(tire);

  // Barrel closing the inside of the rim, so the wheel is solid from every angle.
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(RIM_RADIUS, RIM_RADIUS, WHEEL_WIDTH - 0.03, 28, 1, true),
    materials.chrome,
  );
  barrel.name = `rim-barrel-${label}`;
  barrel.rotation.x = Math.PI / 2;
  wheel.add(barrel);

  wheel.add(rimFace(label, 'outer', materials), rimFace(label, 'inner', materials));
  return wheel;
}

export interface WheelSet {
  wheels: THREE.Group[];
  /** Wheelcentre positions, in car space. */
  anchors: Array<{ label: string; front: boolean; side: number; position: THREE.Vector3 }>;
}

export function buildWheels(materials: CarMaterials): WheelSet {
  const anchors = ([-1, 1] as const).flatMap((side) =>
    [
      { front: true, axle: AXLE_FRONT_X },
      { front: false, axle: AXLE_REAR_X },
    ].map(({ front, axle }) => ({
      label: `${front ? 'front' : 'rear'}-${sideName(side)}`,
      front,
      side: side as number,
      position: new THREE.Vector3(axle, WHEEL_Y, side * WHEEL_Z),
    })),
  );

  const wheels = anchors.map((anchor) => {
    const wheel = buildWheel(anchor.label, materials);
    wheel.position.copy(anchor.position);
    // Mirrored across the car's centreline by rotation, not negative scale, so
    // the winding — and therefore the lighting — stays correct.
    if (anchor.side < 0) wheel.rotation.y = Math.PI;
    return wheel;
  });

  return { wheels, anchors };
}
