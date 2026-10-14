import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { CarMaterials } from './carMaterials';
import {
  AXLE_FRONT_X, AXLE_REAR_X, BODY_UPPER_ROWS, CAPSULE_ROOF_ROWS, CAPSULE_SIDE_Z,
  FRONT_CROWN_ROWS, REAR_CROWN_ROWS, capsuleSideShape, sideName, WHEEL_Y,
  SIDE_WINDOW_CURVE_SEGMENTS,
  type CapsuleLoftRow,
} from './carGeometry';

/** Programmatic exterior pieces, kept separate only for the exploded view. */
export interface BodyShells {
  frontShell: THREE.Group;
  rearShell: THREE.Group;
  sideWallLeft: THREE.Group;
  sideWallRight: THREE.Group;
  /** One parent for both side surfaces and the continuous capsule roof. */
  capsuleBridge: THREE.Group;
  underbody: THREE.Group;
  materials: THREE.MeshPhysicalMaterial[];
}

const V = (x: number, y: number) => new THREE.Vector2(x, y);

type LoftRow = readonly [x: number, y: number, halfWidth: number, crown: number];
interface CrownWindow {
  xMin: number;
  xMax: number;
  halfWidth: number;
  cornerX: number;
  cornerLateral: number;
}

const FRONT_WINDSCREEN: CrownWindow = { xMin: -2.02, xMax: -1.54, halfWidth: 0.68, cornerX: 0.075, cornerLateral: 0.12 };
const REAR_WINDSCREEN: CrownWindow = { xMin: 1.54, xMax: 2.02, halfWidth: 0.68, cornerX: 0.075, cornerLateral: 0.12 };

function archPoints(cx: number, cy: number, radius: number, steps = 24): THREE.Vector2[] {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (index / steps) * Math.PI;
    return new THREE.Vector2(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  });
}

function capStrip(
  name: string,
  points: THREE.Vector2[],
  zA: number,
  zB: number,
  material: THREE.Material,
): THREE.Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  points.forEach((point, index) => {
    positions.push(point.x, point.y, zA, point.x, point.y, zB);
    if (index === 0) return;
    const start = (index - 1) * 2;
    indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function loftPoint(rows: ReadonlyArray<LoftRow>, x: number, lateral: number): THREE.Vector3 {
  let index = 0;
  while (index < rows.length - 2 && x > rows[index + 1][0]) index++;
  const a = rows[index];
  const b = rows[index + 1];
  const t = THREE.MathUtils.clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
  const y = THREE.MathUtils.lerp(a[1], b[1], t);
  const halfWidth = THREE.MathUtils.lerp(a[2], b[2], t);
  const crown = THREE.MathUtils.lerp(a[3], b[3], t);
  return new THREE.Vector3(x, y + crown * (1 - lateral * lateral), lateral * halfWidth);
}

function subdivideRows(rows: ReadonlyArray<LoftRow>, subdivisions: number): LoftRow[] {
  const denseRows: LoftRow[] = [];
  for (let index = 0; index < rows.length - 1; index++) {
    const start = rows[index];
    const end = rows[index + 1];
    for (let step = 0; step < subdivisions; step++) {
      const t = step / subdivisions;
      denseRows.push([
        THREE.MathUtils.lerp(start[0], end[0], t),
        THREE.MathUtils.lerp(start[1], end[1], t),
        THREE.MathUtils.lerp(start[2], end[2], t),
        THREE.MathUtils.lerp(start[3], end[3], t),
      ]);
    }
  }
  denseRows.push(rows[rows.length - 1]);
  return denseRows;
}

function insideRoundedWindow(x: number, lateral: number, window: CrownWindow): boolean {
  if (x < window.xMin || x > window.xMax || Math.abs(lateral) > window.halfWidth) return false;
  const centerX = THREE.MathUtils.clamp(x, window.xMin + window.cornerX, window.xMax - window.cornerX);
  const centerLateral = THREE.MathUtils.clamp(lateral, -window.halfWidth + window.cornerLateral, window.halfWidth - window.cornerLateral);
  const dx = (x - centerX) / window.cornerX;
  const dz = (lateral - centerLateral) / window.cornerLateral;
  return dx * dx + dz * dz <= 1;
}

function windowHalfSpan(window: CrownWindow, x: number): number {
  let cornerDistance = 0;
  if (x < window.xMin + window.cornerX) {
    const t = THREE.MathUtils.clamp((x - window.xMin) / window.cornerX, 0, 1);
    cornerDistance = window.cornerLateral * (1 - Math.sqrt(Math.max(0, 1 - (1 - t) ** 2)));
  } else if (x > window.xMax - window.cornerX) {
    const t = THREE.MathUtils.clamp((window.xMax - x) / window.cornerX, 0, 1);
    cornerDistance = window.cornerLateral * (1 - Math.sqrt(Math.max(0, 1 - (1 - t) ** 2)));
  }
  return window.halfWidth - cornerDistance;
}

function addCrownWindscreen(
  parent: THREE.Group,
  rows: ReadonlyArray<LoftRow>,
  window: CrownWindow,
  name: string,
  materials: CarMaterials,
): void {
  const xSegments = 48;
  const lateralSegments = 40;
  const positions: number[] = [];
  const indices: number[] = [];
  const surfaceOffset = 0.009;

  for (let row = 0; row <= xSegments; row++) {
    const x = THREE.MathUtils.lerp(window.xMin, window.xMax, row / xSegments);
    const halfSpan = windowHalfSpan(window, x);
    for (let col = 0; col <= lateralSegments; col++) {
      const lateral = THREE.MathUtils.lerp(-halfSpan, halfSpan, col / lateralSegments);
      const point = loftPoint(rows, x, lateral);
      const x0 = loftPoint(rows, Math.max(rows[0][0], x - 0.002), lateral);
      const x1 = loftPoint(rows, Math.min(rows[rows.length - 1][0], x + 0.002), lateral);
      const l0 = loftPoint(rows, x, Math.max(-1, lateral - 0.002));
      const l1 = loftPoint(rows, x, Math.min(1, lateral + 0.002));
      const normal = new THREE.Vector3().subVectors(l1, l0).cross(new THREE.Vector3().subVectors(x1, x0)).normalize();
      point.addScaledVector(normal, surfaceOffset);
      positions.push(point.x, point.y, point.z);
    }
  }
  for (let row = 0; row < xSegments; row++) {
    for (let col = 0; col < lateralSegments; col++) {
      const start = row * (lateralSegments + 1) + col;
      indices.push(start, start + 1, start + lateralSegments + 1);
      indices.push(start + 1, start + lateralSegments + 2, start + lateralSegments + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const pane = new THREE.Mesh(geometry, materials.glass);
  pane.name = `${name}-glass`;
  parent.add(pane);

  const border: THREE.Vector3[] = [];
  const samples = 48;
  for (let i = 0; i <= samples; i++) {
    const x = THREE.MathUtils.lerp(window.xMin, window.xMax, i / samples);
    border.push(loftPoint(rows, x, -windowHalfSpan(window, x)).add(new THREE.Vector3(0, surfaceOffset * 1.7, 0)));
  }
  const rightHalfSpan = windowHalfSpan(window, window.xMax);
  for (let i = 1; i <= 24; i++) {
    const lateral = THREE.MathUtils.lerp(-rightHalfSpan, rightHalfSpan, i / 24);
    border.push(loftPoint(rows, window.xMax, lateral).add(new THREE.Vector3(0, surfaceOffset * 1.7, 0)));
  }
  for (let i = 1; i <= samples; i++) {
    const x = THREE.MathUtils.lerp(window.xMax, window.xMin, i / samples);
    border.push(loftPoint(rows, x, windowHalfSpan(window, x)).add(new THREE.Vector3(0, surfaceOffset * 1.7, 0)));
  }
  const leftHalfSpan = windowHalfSpan(window, window.xMin);
  for (let i = 1; i < 24; i++) {
    const lateral = THREE.MathUtils.lerp(leftHalfSpan, -leftHalfSpan, i / 24);
    border.push(loftPoint(rows, window.xMin, lateral).add(new THREE.Vector3(0, surfaceOffset * 1.7, 0)));
  }
  const curve = new THREE.CatmullRomCurve3(border, true, 'centripetal');
  const trim = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.009, 8, true), materials.trim);
  trim.name = `${name}-seal-trim`;
  parent.add(trim);
}

/** Make a gently crowned top surface from longitudinal rows. */
function roofLoft(
  name: string,
  rows: ReadonlyArray<LoftRow>,
  material: THREE.Material,
  window?: CrownWindow,
): THREE.Mesh {
  const subdivisions = window ? 24 : 1;
  const across = window ? 64 : 16;
  const denseRows = subdivideRows(rows, subdivisions);
  const positions: number[] = [];
  const indices: number[] = [];
  denseRows.forEach(([x, y, halfWidth, crown]) => {
    for (let index = 0; index <= across; index++) {
      const lateral = (index / across) * 2 - 1;
      positions.push(x, y + crown * (1 - lateral * lateral), lateral * halfWidth);
    }
  });
  for (let row = 0; row < denseRows.length - 1; row++) {
    for (let col = 0; col < across; col++) {
      const start = row * (across + 1) + col;
      const x0 = denseRows[row][0];
      const x1 = denseRows[row + 1][0];
      const lateral0 = (col / across) * 2 - 1;
      const lateral1 = ((col + 1) / across) * 2 - 1;
      const points = [
        [x0, lateral0], [x1, lateral0], [x0, lateral1], [x1, lateral1],
        [(x0 + x1) / 2, (lateral0 + lateral1) / 2],
      ] as const;
      if (window && points.some(([x, lateral]) => insideRoundedWindow(x, lateral, window))) continue;
      indices.push(start, start + across + 1, start + 1, start + 1, start + across + 1, start + across + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** Close the tapered shoulder between each crown panel edge and the side skin. */
function shoulderBridge(name: string, rows: ReadonlyArray<CapsuleLoftRow>, side: number, material: THREE.Material): THREE.Mesh {
  const samples = subdivideRows(rows, 24);
  const positions: number[] = [];
  const indices: number[] = [];
  for (const [x, y, halfWidth] of samples) {
    positions.push(x, y, side * halfWidth, x, y, side * CAPSULE_SIDE_Z);
  }
  for (let row = 0; row < samples.length - 1; row++) {
    const a = samples[row];
    const b = samples[row + 1];
    if (Math.min(a[2], b[2]) >= CAPSULE_SIDE_Z - 1e-5) continue;
    const start = row * 2;
    indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export function buildBodyShells(materials: CarMaterials): BodyShells {
  const frontShell = new THREE.Group(); frontShell.name = 'front-shell';
  const rearShell = new THREE.Group(); rearShell.name = 'rear-shell';
  const sideWallLeft = new THREE.Group(); sideWallLeft.name = 'side-wall-left';
  const sideWallRight = new THREE.Group(); sideWallRight.name = 'side-wall-right';

  // This is the exterior capsule body: each side is one shaped membrane with
  // real wheel, quarter-window, and door openings. No complete old side shell
  // is left underneath it, so every adjoining part shares the same envelope.
  const exterior = new THREE.Group();
  exterior.name = 'capsule-exterior-shell';
  exterior.add(sideWallLeft, sideWallRight);
  const roofBridge = new THREE.Group();
  roofBridge.name = 'capsule-cabin-bridge';
  exterior.add(roofBridge);

  for (const side of [-1, 1]) {
    const label = sideName(side);
    const sideGroup = side > 0 ? sideWallLeft : sideWallRight;
    const sideSkin = new THREE.Mesh(new THREE.ShapeGeometry(capsuleSideShape(), SIDE_WINDOW_CURVE_SEGMENTS), materials.body);
    sideSkin.position.z = side * CAPSULE_SIDE_Z;
    sideSkin.name = `capsule-exterior-side-${label}`;
    sideSkin.castShadow = sideSkin.receiveShadow = true;
    sideGroup.add(sideSkin);

    // Close only the depth of the wheel tubs. The visible outer arches remain
    // cut into the capsule skin and align to the tires.
    for (const [axle, axleName] of [[AXLE_FRONT_X, 'front'], [AXLE_REAR_X, 'rear']] as const) {
      sideGroup.add(capStrip(
        `${axleName}-wheel-tub-${label}`,
        archPoints(axle, WHEEL_Y, 0.59),
        side * 0.60,
        side * CAPSULE_SIDE_Z,
        materials.body,
      ));
    }
  }

  roofBridge.add(roofLoft('capsule-roof-skin', CAPSULE_ROOF_ROWS, materials.body));

  // Rounded-square end caps give the capsule a recognizable short-car nose
  // and tail. Their upper edges meet the fore/aft crown lofts and side skin.
  const frontFace = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.52, 1.78, 6, 0.10), materials.body);
  frontFace.position.set(-2.12, 0.62, 0);
  frontFace.name = 'front-fascia';
  frontFace.castShadow = frontFace.receiveShadow = true;
  frontShell.add(frontFace);
  const rearFace = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.52, 1.78, 6, 0.10), materials.body);
  rearFace.position.set(2.12, 0.62, 0);
  rearFace.name = 'rear-fascia';
  rearFace.castShadow = rearFace.receiveShadow = true;
  rearShell.add(rearFace);

  frontShell.add(roofLoft('rounded-nose-crown', FRONT_CROWN_ROWS, materials.body, FRONT_WINDSCREEN));
  addCrownWindscreen(frontShell, FRONT_CROWN_ROWS, FRONT_WINDSCREEN, 'front-windscreen', materials);

  rearShell.add(roofLoft('rounded-tail-crown', REAR_CROWN_ROWS, materials.body, REAR_WINDSCREEN));
  addCrownWindscreen(rearShell, REAR_CROWN_ROWS, REAR_WINDSCREEN, 'rear-windscreen', materials);

  for (const side of [-1, 1]) {
    roofBridge.add(shoulderBridge(`capsule-shoulder-${sideName(side)}`, BODY_UPPER_ROWS, side, materials.body));
  }

  const underbody = new THREE.Group();
  underbody.name = 'underbody';
  underbody.add(capStrip('underbody-pan', [V(-0.75, 0.29), V(0.75, 0.29)], -0.87, 0.87, materials.body));

  return {
    frontShell,
    rearShell,
    sideWallLeft,
    sideWallRight,
    capsuleBridge: exterior,
    underbody,
    materials: [materials.body],
  };
}
