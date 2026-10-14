import * as THREE from 'three';
import { beamBetween, roundedBox } from './dimensions';
import type { CarMaterials } from './materials';

export interface Interior {
  group: THREE.Group;
  seats: THREE.Group[];
  dashboard: THREE.Group;
  steering: THREE.Group;
  frame: THREE.Group;
}

/** Where the driver sits: left-hand drive, and the car faces -X, so +Z. */
const DRIVER_SIDE = 1;
const SEAT_X = 0.1;
const SEAT_PITCH = 0.28;
/** Roof rail height. Kept just under the cabin skin so the cage reads as structure. */
const RAIL_Y = 1.5;

/**
 * The skeleton. Every member sits inside the shell and is visible through the
 * glazing, so the car reads as a structure with a body around it — not a body
 * with a frame bolted underneath.
 */
function buildFrame(materials: CarMaterials): THREE.Group {
  const frame = new THREE.Group();
  frame.name = 'Frame';
  const tube = materials.frame;
  const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

  for (const side of [1, -1]) {
    // A-, B- and C-pillars, following the cabin: the A-pillar rakes back from the
    // cowl, the B-pillar lands on the door's trailing edge, the C-pillar closes it.
    frame.add(
      beamBetween(v(-0.86, 0.46, side * 0.5), v(-0.56, RAIL_Y, side * 0.4), 0.034, tube),
      beamBetween(v(0.66, 0.46, side * 0.5), v(0.6, RAIL_Y, side * 0.4), 0.032, tube),
      beamBetween(v(1.0, 0.46, side * 0.48), v(0.95, 1.48, side * 0.38), 0.032, tube),
      // Roof rails tying the three stations together.
      beamBetween(v(-0.56, RAIL_Y, side * 0.4), v(0.6, RAIL_Y, side * 0.4), 0.028, tube),
      beamBetween(v(0.6, RAIL_Y, side * 0.4), v(0.95, 1.48, side * 0.38), 0.028, tube),
      // Floor rails, inboard of the sills.
      beamBetween(v(-1.05, 0.44, side * 0.36), v(1.05, 0.44, side * 0.36), 0.036, tube),
      // Diagonal from the rocker up to the A-pillar foot.
      beamBetween(v(0.2, 0.44, side * 0.36), v(-0.62, 1.02, side * 0.42), 0.024, tube),
    );
  }

  for (const x of [-0.56, 0.6, 0.95]) {
    frame.add(beamBetween(v(x, RAIL_Y, -0.4), v(x, RAIL_Y, 0.4), 0.026, tube));
  }
  for (const x of [-0.95, -0.4, 0.1, 0.6, 1.0]) {
    frame.add(beamBetween(v(x, 0.44, -0.36), v(x, 0.44, 0.36), 0.026, tube));
  }
  return frame;
}

function buildSeat(materials: CarMaterials, side: number): THREE.Group {
  const seat = new THREE.Group();
  seat.name = side > 0 ? 'DriverSeat' : 'PassengerSeat';
  const z = side * SEAT_PITCH;

  const riser = roundedBox(0.38, 0.3, 0.34, 0.05, materials.interior);
  riser.name = 'cushion-base';
  riser.position.set(SEAT_X, 0.56, z);
  seat.add(riser);

  const cushion = roundedBox(0.44, 0.13, 0.4, 0.06, materials.upholstery);
  cushion.name = 'cushion';
  cushion.position.set(SEAT_X, 0.75, z);
  seat.add(cushion);

  const backrest = roundedBox(0.14, 0.52, 0.38, 0.06, materials.upholstery);
  backrest.name = 'backrest';
  backrest.position.set(SEAT_X + 0.24, 0.99, z);
  backrest.rotation.z = -0.15;
  seat.add(backrest);

  const headrest = roundedBox(0.11, 0.16, 0.22, 0.05, materials.upholstery);
  headrest.name = 'headrest';
  headrest.position.set(SEAT_X + 0.31, 1.28, z);
  seat.add(headrest);

  return seat;
}

function buildDashboard(materials: CarMaterials): THREE.Group {
  const dashboard = new THREE.Group();
  dashboard.name = 'Dashboard';

  const body = roundedBox(0.3, 0.26, 1.04, 0.06, materials.interior);
  body.name = 'dash-body';
  body.position.set(-0.58, 0.92, 0);
  dashboard.add(body);

  const shelf = roundedBox(0.14, 0.06, 0.9, 0.03, materials.interior);
  shelf.name = 'dash-shelf';
  shelf.position.set(-0.62, 1.04, 0);
  dashboard.add(shelf);

  const cluster = roundedBox(0.06, 0.13, 0.32, 0.03, materials.display);
  cluster.name = 'instrument-cluster';
  cluster.position.set(-0.47, 1.08, DRIVER_SIDE * 0.3);
  dashboard.add(cluster);

  const console = roundedBox(0.44, 0.18, 0.2, 0.05, materials.interior);
  console.name = 'centre-console';
  console.position.set(0.16, 0.53, 0);
  dashboard.add(console);

  return dashboard;
}

function buildSteering(materials: CarMaterials): THREE.Group {
  const steering = new THREE.Group();
  steering.name = 'SteeringWheel';

  // The column rakes down to the dash; the wheel's top leans away from the driver.
  const tilt = new THREE.Group();
  tilt.rotation.z = 0.44;
  const yoke = new THREE.Group();
  yoke.rotation.y = Math.PI / 2;
  tilt.add(yoke);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.021, 12, 36), materials.interior);
  rim.name = 'steering-rim';
  yoke.add(rim);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 20), materials.interior);
  hub.name = 'steering-hub';
  hub.rotation.x = Math.PI / 2;
  yoke.add(hub);

  for (const angle of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.026, 0.018), materials.interior);
    spoke.name = 'steering-spoke';
    spoke.position.set(Math.cos(angle) * 0.075, Math.sin(angle) * 0.075, 0);
    spoke.rotation.z = angle;
    yoke.add(spoke);
  }

  steering.add(tilt);
  steering.position.set(-0.4, 0.98, DRIVER_SIDE * SEAT_PITCH);

  // The column is expressed relative to the group's own origin, which already
  // sits at the hub. Handing `beamBetween` car-space points here would apply the
  // group's offset a second time and fling the column up through the roof.
  const column = beamBetween(
    new THREE.Vector3(-0.26, -0.14, 0),
    new THREE.Vector3(-0.02, -0.02, 0),
    0.03,
    materials.interior,
  );
  column.name = 'steering-column';
  steering.add(column);

  return steering;
}

export function buildInterior(materials: CarMaterials): Interior {
  const group = new THREE.Group();
  group.name = 'Interior';

  // The hierarchy the brief calls for: Interior holds the seating, the controls
  // and the skeleton as siblings, all of it present in the resting state.
  const driverSeat = buildSeat(materials, DRIVER_SIDE);
  const passengerSeat = buildSeat(materials, -DRIVER_SIDE);
  const dashboard = buildDashboard(materials);
  const steering = buildSteering(materials);
  const frame = buildFrame(materials);

  group.add(driverSeat, passengerSeat, dashboard, steering, frame);
  return { group, seats: [driverSeat, passengerSeat], dashboard, steering, frame };
}
