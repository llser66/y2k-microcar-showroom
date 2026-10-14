import * as THREE from 'three';

/**
 * Round 1 palette.
 *
 * Every structural surface is **opaque**. Transparency is reserved for the two
 * glazed openings (windscreen, side windows) where a real material would be
 * transparent anyway — it is never used to disguise geometry that is missing.
 */
export interface CarMaterials {
  /** Candy body paint. */
  paint: THREE.MeshStandardMaterial;
  /** The same paint on the doors, which are meshes rather than solids. */
  doorPaint: THREE.MeshStandardMaterial;
  /** Darker shade for bumpers, sills and the underbody. */
  paintDark: THREE.MeshStandardMaterial;
  /** Glazing; the only translucent surfaces in the model. */
  glass: THREE.MeshPhysicalMaterial;
  rubber: THREE.MeshStandardMaterial;
  /** Bright trim: rim barrels, roof rails, door handles. */
  chrome: THREE.MeshStandardMaterial;
  /** Satin structural tubing — A/B pillars, subframes. */
  frame: THREE.MeshStandardMaterial;
  upholstery: THREE.MeshStandardMaterial;
  /** Hard interior plastics: dashboard, door cards. */
  interior: THREE.MeshStandardMaterial;
  carpet: THREE.MeshStandardMaterial;
  lampEmitter: THREE.MeshStandardMaterial;
  lampLens: THREE.MeshPhysicalMaterial;
  tailLight: THREE.MeshStandardMaterial;
  display: THREE.MeshStandardMaterial;
}

export function createMaterials(): CarMaterials {
  return {
    paint: new THREE.MeshStandardMaterial({
      color: 0xff8ecb,
      roughness: 0.24,
      metalness: 0.14,
      envMapIntensity: 1.1,
    }),
    doorPaint: new THREE.MeshStandardMaterial({
      color: 0xff8ecb,
      roughness: 0.24,
      metalness: 0.14,
      envMapIntensity: 1.1,
      // A door is a slab, and the far-side one is a mirrored copy. Rendering both
      // faces keeps that mirror from turning the panel inside out.
      side: THREE.DoubleSide,
    }),
    paintDark: new THREE.MeshStandardMaterial({
      color: 0x4a5560,
      roughness: 0.62,
      metalness: 0.08,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xa9d4e4,
      roughness: 0.06,
      metalness: 0.0,
      transparent: true,
      opacity: 0.26,
      // Opaque sorting is unreliable on a double-sided curved pane; disabling
      // depth writes lets the interior show through cleanly from every angle.
      depthWrite: false,
      side: THREE.DoubleSide,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.86, metalness: 0.02 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xeef3f7, roughness: 0.16, metalness: 0.94 }),
    frame: new THREE.MeshStandardMaterial({ color: 0xdfe6ec, roughness: 0.4, metalness: 0.55 }),
    upholstery: new THREE.MeshStandardMaterial({ color: 0x8f97a3, roughness: 0.88, metalness: 0.02 }),
    interior: new THREE.MeshStandardMaterial({ color: 0xd9dde3, roughness: 0.66, metalness: 0.04 }),
    carpet: new THREE.MeshStandardMaterial({ color: 0x5d646e, roughness: 0.95, metalness: 0.0 }),
    lampEmitter: new THREE.MeshStandardMaterial({
      color: 0xf2ffff,
      emissive: 0xa8ecff,
      emissiveIntensity: 1.6,
      roughness: 0.16,
    }),
    lampLens: new THREE.MeshPhysicalMaterial({
      color: 0xe6ffff,
      roughness: 0.1,
      transparent: true,
      opacity: 0.55,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
    tailLight: new THREE.MeshStandardMaterial({
      color: 0xff4d7e,
      emissive: 0xff0f4a,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    }),
    display: new THREE.MeshStandardMaterial({
      color: 0x1a2a33,
      emissive: 0x2fd6c9,
      emissiveIntensity: 0.85,
      roughness: 0.22,
    }),
  };
}
