import * as THREE from 'three';
import type { CarMaterials } from './carMaterials';
import {
  CAPSULE_ROOF_FRONT_X,
  CAPSULE_ROOF_PEAK,
  CAPSULE_ROOF_REAR_X,
  CAPSULE_ROOF_Y,
  CAPSULE_SIDE_Z,
  SIDE_WINDOW_CURVE_SEGMENTS,
  capsuleFrontQuarterPath,
  capsuleRearQuarterPath,
  capsuleRoofY,
} from './carGeometry';

/** Top of the completed external roof; used to mount the roof rack. */
export const ROOF_Y = CAPSULE_ROOF_Y + CAPSULE_ROOF_PEAK + 0.075;
// Stand the pane just clear of the painted shell so close surfaces cannot
// compete in the depth buffer at the aperture edge.
const Z_SIDE_GLASS = CAPSULE_SIDE_Z + 0.002;
// Let the slim, glass-toned edge bead overlap the glazing plane slightly so it
// reads as a fitted glazing edge rather than a separate white rail.
const Z_SIDE_TRIM = CAPSULE_SIDE_Z + 0.004;
const Z_ROOF = CAPSULE_SIDE_Z - 0.02;
const ROOF_CROSS_CROWN = 0.075;
const ROOF_INSET = 0.045;

export interface Greenhouse {
  /** Slim glass/metal trim belonging to the continuous outer capsule shell. */
  cabinShell: THREE.Group;
  /** Windshield, rear screen, quarter windows and panoramic roof glass. */
  glass: THREE.Group;
}

function tubeAlongSide(
  name: string,
  side: number,
  points: ReadonlyArray<readonly [number, number]>,
  material: THREE.Material,
  radius: number,
  closed = false,
): THREE.Mesh {
  const vertices = points.map(([x, y]) => new THREE.Vector3(x, y, side * Z_SIDE_TRIM));
  // Shape.getPoints repeats its first point at the end for closed paths.
  // Catmull-Rom interpreted both copies as separate controls and curled the
  // trim at the join; remove the duplicate so the seam closes cleanly.
  if (closed && vertices.length > 1 && vertices[0].distanceToSquared(vertices[vertices.length - 1]) < 1e-10) {
    vertices.pop();
  }
  const curve = new THREE.CatmullRomCurve3(
    vertices,
    closed,
    'centripetal',
  );
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(64, vertices.length * 4), radius, 8, closed), material);
  mesh.name = `${name}-${side}`;
  mesh.castShadow = true;
  return mesh;
}

function shapePane(name: string, side: number, shape: THREE.Shape, material: THREE.Material): THREE.Mesh {
  const pane = new THREE.Mesh(new THREE.ShapeGeometry(shape, SIDE_WINDOW_CURVE_SEGMENTS), material);
  pane.position.z = side * Z_SIDE_GLASS;
  pane.name = name;
  return pane;
}

/** Cross-width curved roof glass follows the same longitudinal capsule arch. */
function buildArchedRoofGlass(): THREE.BufferGeometry {
  const fromX = CAPSULE_ROOF_FRONT_X + ROOF_INSET;
  const toX = CAPSULE_ROOF_REAR_X - ROOF_INSET;
  const longitudinalSegments = 32;
  const widthSegments = 16;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= longitudinalSegments; row++) {
    const x = fromX + ((toX - fromX) * row) / longitudinalSegments;
    for (let col = 0; col <= widthSegments; col++) {
      const lateral = (col / widthSegments) * 2 - 1;
      const crossCrown = ROOF_CROSS_CROWN * (1 - lateral * lateral);
      positions.push(x, capsuleRoofY(x) + crossCrown - 0.012, lateral * Z_ROOF);
    }
  }
  for (let row = 0; row < longitudinalSegments; row++) {
    for (let col = 0; col < widthSegments; col++) {
      const start = row * (widthSegments + 1) + col;
      indices.push(start, start + widthSegments + 1, start + 1);
      indices.push(start + 1, start + widthSegments + 1, start + widthSegments + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildGreenhouse(materials: CarMaterials): Greenhouse {
  const cabinShell = new THREE.Group();
  cabinShell.name = 'cabin-shell';
  const glass = new THREE.Group();
  glass.name = 'glass';

  // The main capsule side skins contain quarter-window openings. Reuse the
  // exact paths here so each pane sits cleanly in its exterior aperture.
  for (const side of [-1, 1]) {
    const frontWindow = capsuleFrontQuarterPath();
    const rearWindow = capsuleRearQuarterPath();
    glass.add(shapePane(`capsule-quarter-glass-front-${side}`, side, frontWindow, materials.glass));
    glass.add(shapePane(`capsule-quarter-glass-rear-${side}`, side, rearWindow, materials.glass));

    cabinShell.add(tubeAlongSide('capsule-front-window-trim', side, frontWindow.getPoints(48).map(({ x, y }) => [x, y] as const), materials.glass, 0.0045, true));
    cabinShell.add(tubeAlongSide('capsule-rear-window-trim', side, rearWindow.getPoints(48).map(({ x, y }) => [x, y] as const), materials.glass, 0.0045, true));

    // The capsule roof itself forms the upper seal. Avoid adding a separate
    // curved side tube here; it looked like an arbitrary cage bar and doubled
    // the window header.
  }

  const roofGlass = new THREE.Mesh(buildArchedRoofGlass(), materials.glass);
  roofGlass.name = 'panoramic-roof-glass';
  glass.add(roofGlass);

  return { cabinShell, glass };
}
