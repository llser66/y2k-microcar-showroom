import * as THREE from 'three';
import type { CarMaterials } from './carMaterials';
import { BELTLINE_Y, CAPSULE_SIDE_Z, DOOR_OPENING, sideName } from './carGeometry';

/** Hinge line: the front edge of the door aperture, on the body skin plane. */
const HINGE_X = -0.6;
const HINGE_Y = 0.31;
const HINGE_Z = 0.79;
/** Local door coordinates derive from the exact cutout in the capsule side. */
const DOOR_LEFT = DOOR_OPENING.leftX - HINGE_X;
const DOOR_RIGHT = DOOR_OPENING.rightX - HINGE_X;
const DOOR_BOTTOM = DOOR_OPENING.bottomY - HINGE_Y;
const WINDOW_BOTTOM = BELTLINE_Y - HINGE_Y;
const WINDOW_TOP = DOOR_OPENING.topY - HINGE_Y;
const WINDOW_SHOULDER_Y = WINDOW_TOP - 0.05;
const WINDOW_SIDE_TOP_Y = WINDOW_TOP - 0.17;
const PANEL_TOP = WINDOW_BOTTOM;
const DOOR_GLASS_Z = CAPSULE_SIDE_Z - HINGE_Z;
const DOOR_PANEL_DEPTH = 0.08;
const DOOR_PANEL_HALF_DEPTH = DOOR_PANEL_DEPTH / 2;
const DOOR_Z_OFFSET = CAPSULE_SIDE_Z - HINGE_Z - DOOR_PANEL_HALF_DEPTH;

export interface DoorAnchor {
  /** Outer wrapper carrying the exploded-view translation (slides the door clear). */
  rig: THREE.Group;
  /** Hinge pivot carrying the swing rotation and all door meshes. */
  pivot: THREE.Group;
  /** -1 for the -Z door, +1 for the +Z door. */
  side: number;
}

function doorPanelShape(top = PANEL_TOP): THREE.Shape {
  const shape = new THREE.Shape();
  const radius = DOOR_OPENING.cornerRadius;
  shape.moveTo(DOOR_LEFT, DOOR_BOTTOM);
  shape.lineTo(DOOR_RIGHT - radius, DOOR_BOTTOM);
  shape.quadraticCurveTo(DOOR_RIGHT, DOOR_BOTTOM, DOOR_RIGHT, DOOR_BOTTOM + radius);
  // The upper edge is a straight shared seam at the beltline; rounding it
  // independently of the window frame left diagonal slivers in the aperture.
  shape.lineTo(DOOR_RIGHT, top);
  shape.lineTo(DOOR_LEFT, top);
  shape.closePath();
  return shape;
}

function doorWindowShape(): THREE.Shape {
  const shape = new THREE.Shape();
  // This pane is dimensioned from the same local coordinates as the lower
  // door skin: its bottom meets the beltline exactly and its side edges leave
  // a narrow, even channel for the rubber seal and chrome surround.
  // The pane starts at the same beltline as the lower skin and sits inside the
  // continuous upper frame, leaving an even channel for its seal.
  shape.moveTo(DOOR_LEFT + 0.08, WINDOW_BOTTOM);
  shape.lineTo(DOOR_RIGHT - 0.08, WINDOW_BOTTOM);
  shape.lineTo(DOOR_RIGHT - 0.025, WINDOW_SIDE_TOP_Y);
  shape.quadraticCurveTo(DOOR_RIGHT - 0.03, WINDOW_TOP - 0.08, DOOR_RIGHT - 0.12, WINDOW_SHOULDER_Y);
  shape.quadraticCurveTo(0.91, WINDOW_TOP - 0.01, 0.55, WINDOW_TOP);
  shape.quadraticCurveTo(0.19, WINDOW_TOP - 0.01, DOOR_LEFT + 0.08, WINDOW_SHOULDER_Y);
  shape.quadraticCurveTo(DOOR_LEFT + 0.02, WINDOW_TOP - 0.08, DOOR_LEFT + 0.025, WINDOW_SIDE_TOP_Y);
  shape.lineTo(DOOR_LEFT + 0.03, WINDOW_BOTTOM + 0.09);
  shape.quadraticCurveTo(DOOR_LEFT + 0.03, WINDOW_BOTTOM, DOOR_LEFT + 0.08, WINDOW_BOTTOM);
  shape.closePath();
  return shape;
}

/** Painted upper door frame around a slightly inset, properly sealed pane. */
function doorWindowFrameShape(windowShape: THREE.Shape): THREE.Shape {
  const frame = new THREE.Shape();
  const openingLeft = DOOR_LEFT;
  const openingRight = DOOR_RIGHT;
  const openingTop = WINDOW_TOP;
  const radius = DOOR_OPENING.cornerRadius;
  frame.moveTo(openingLeft, WINDOW_BOTTOM);
  frame.lineTo(openingRight, WINDOW_BOTTOM);
  frame.lineTo(openingRight, openingTop - radius);
  frame.quadraticCurveTo(openingRight, openingTop, openingRight - radius, openingTop);
  frame.lineTo(openingLeft + radius, openingTop);
  frame.quadraticCurveTo(openingLeft, openingTop, openingLeft, openingTop - radius);
  frame.closePath();
  frame.holes.push(windowShape);
  return frame;
}

function addWindowBead(
  parent: THREE.Group,
  shape: THREE.Shape,
  side: number,
  name: string,
  localZ: number,
  radius: number,
  material: THREE.Material,
): void {
  const outline = shape.getPoints(48);
  // Shape.getPoints includes the starting point at the end for a closed path;
  // remove that duplicate before creating a smooth closed tube.
  if (outline.length > 1 && outline[0].distanceToSquared(outline[outline.length - 1]) < 1e-10) outline.pop();
  const curve = new THREE.CatmullRomCurve3(
    outline.map(({ x, y }) => new THREE.Vector3(x, y, side * localZ)),
    true,
    'centripetal',
  );
  const bead = new THREE.Mesh(new THREE.TubeGeometry(curve, 192, radius, 8, true), material);
  bead.name = `${name}-${sideName(side)}`;
  bead.castShadow = true;
  parent.add(bead);
}

export function buildDoors(materials: CarMaterials): { doorAnchors: DoorAnchor[]; materials: THREE.MeshPhysicalMaterial[] } {
  const doorAnchors: DoorAnchor[] = [];
  const skins: THREE.MeshPhysicalMaterial[] = [];
  const panelShape = doorPanelShape();
  const innerCardShape = doorPanelShape(WINDOW_BOTTOM);
  const windowShape = doorWindowShape();
  const upperFrameShape = doorWindowFrameShape(windowShape);

  for (const side of [-1, 1]) {
    const label = sideName(side);
    const rig = new THREE.Group(); rig.name = `door-rig-${label}`;
    const pivot = new THREE.Group(); pivot.position.set(HINGE_X, HINGE_Y, side * HINGE_Z); pivot.name = `door-pivot-${label}`;
    rig.add(pivot);

    const skin = materials.body.clone();
    skin.transmission = 0.52;
    skin.thickness = 0.16;
    skin.roughness = 0.20;
    skin.attenuationColor.set('#fff8fc');
    skin.attenuationDistance = 0.95;
    skins.push(skin);

    const panelGeometry = new THREE.ExtrudeGeometry(panelShape, {
      depth: DOOR_PANEL_DEPTH,
      bevelEnabled: false,
      curveSegments: 16,
    });
    panelGeometry.translate(0, 0, -DOOR_PANEL_HALF_DEPTH);
    const panel = new THREE.Mesh(panelGeometry, skin);
    panel.position.z = side * DOOR_Z_OFFSET;
    panel.castShadow = true;
    panel.name = `door-panel-${label}`;
    pivot.add(panel);

    const upperFrame = new THREE.Mesh(new THREE.ShapeGeometry(upperFrameShape, 24), skin);
    upperFrame.position.z = side * DOOR_GLASS_Z;
    upperFrame.name = `door-window-frame-${label}`;
    upperFrame.castShadow = true;
    pivot.add(upperFrame);

    const card = new THREE.Mesh(
      new THREE.ShapeGeometry(innerCardShape, 12),
      new THREE.MeshStandardMaterial({ color: '#e0e4e7', roughness: 0.5, metalness: 0.025, side: THREE.DoubleSide }),
    );
    // Keep the upholstered inner card against the cabin-facing surface of the
    // slab; embedding it near the outer face caused a second visible seam.
    card.position.z = side * (DOOR_Z_OFFSET - DOOR_PANEL_HALF_DEPTH - 0.002);
    card.name = `door-card-${label}`;
    pivot.add(card);

    const window = new THREE.Mesh(new THREE.ShapeGeometry(windowShape, 12), materials.glass);
    window.position.z = side * DOOR_GLASS_Z;
    window.name = `door-window-${label}`;
    pivot.add(window);

    // Match the fixed side panes: one slim glass-toned bead follows the pane
    // outline and overlaps its edge, without a contrasting dark rubber ring.
    addWindowBead(pivot, windowShape, side, 'door-window-trim', DOOR_GLASS_Z + 0.004, 0.0045, materials.glass);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.05), materials.chrome);
    handle.position.set(0.88, 0.5, side * 0.115);
    handle.name = `door-handle-${label}`;
    pivot.add(handle);

    doorAnchors.push({ rig, pivot, side });
  }
  return { doorAnchors, materials: skins };
}
