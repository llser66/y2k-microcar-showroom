import * as THREE from 'three';

export interface CarMaterials {
  /** Translucent candy-plastic body shell (Y2K signature). */
  body: THREE.MeshPhysicalMaterial;
  /** Tinted canopy glazing. */
  glass: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  /** Silver-white structural frame. */
  skeleton: THREE.MeshStandardMaterial;
  upholstery: THREE.MeshStandardMaterial;
  interiorPlastic: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  lampEmitter: THREE.MeshStandardMaterial;
  lampLens: THREE.MeshPhysicalMaterial;
  tailLight: THREE.MeshStandardMaterial;
}

export function metal(color: number, roughness = 0.22): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.88, roughness });
}

export function createMaterials(): CarMaterials {
  return {
    body: new THREE.MeshPhysicalMaterial({
      // Milky translucent candy plastic: light passes through the shell, while
      // modest roughness keeps it frosted enough to retain the silhouette.
      color: '#ff86cc', roughness: 0.20, metalness: 0.04, transmission: 0.52,
      thickness: 0.16, ior: 1.38, attenuationColor: '#fff8fc', attenuationDistance: 0.82,
      clearcoat: 0.50, clearcoatRoughness: 0.17, iridescence: 0.48,
      iridescenceIOR: 1.35, iridescenceThicknessRange: [220, 620], side: THREE.DoubleSide,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#c7dfeb', roughness: 0.18, metalness: 0.01, transmission: 0.62, thickness: 0.16,
      ior: 1.48, attenuationColor: '#b7dce9', attenuationDistance: 1.3,
      clearcoat: 0.64, clearcoatRoughness: 0.14, side: THREE.DoubleSide,
    }),
    trim: metal(0xd8e5ed, 0.25),
    rubber: new THREE.MeshStandardMaterial({ color: 0x172630, roughness: 0.74 }),
    chrome: metal(0xeaf7ff, 0.14),
    skeleton: metal(0xeaf2f8, 0.3),
    upholstery: new THREE.MeshStandardMaterial({ color: '#e8ebee', roughness: 0.72, metalness: 0.01 }),
    interiorPlastic: new THREE.MeshStandardMaterial({ color: '#dce1e5', roughness: 0.58, metalness: 0.025 }),
    floor: new THREE.MeshStandardMaterial({ color: '#cfd5da', roughness: 0.78, metalness: 0.015 }),
    lampEmitter: new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: 0x9beeff, emissiveIntensity: 1.8, roughness: 0.14 }),
    lampLens: new THREE.MeshPhysicalMaterial({ color: 0xe9ffff, roughness: 0.12, transmission: 0.42, thickness: 0.08, clearcoat: 1, clearcoatRoughness: 0.08 }),
    // Tail lamps default to their unlit lens. `setTailLights` drives them to a
    // red emissive glow when the lights come on, so they are never a fixed pink.
    tailLight: new THREE.MeshStandardMaterial({ color: 0x9a4658, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.38 }),
  };
}

/** Tail-lamp lens colours, shared by both sides so they always switch together. */
export const TAIL_LIGHT_OFF = { color: 0x9a4658, emissive: 0x000000, intensity: 0 } as const;
export const TAIL_LIGHT_ON = { color: 0xff3553, emissive: 0xff1f4a, intensity: 2.6 } as const;

/** Apply the tail-lamp lit/unlit look to a shared lens material. */
export function setTailLights(material: THREE.MeshStandardMaterial, on: boolean): void {
  const state = on ? TAIL_LIGHT_ON : TAIL_LIGHT_OFF;
  material.color.set(state.color);
  material.emissive.set(state.emissive);
  material.emissiveIntensity = state.intensity;
}

/** Candy-plastic variant used for the door skins so they read slightly more translucent. */
export function cloneDoorSkin(base: THREE.MeshPhysicalMaterial): THREE.MeshPhysicalMaterial {
  const material = base.clone();
  material.transmission = 0.82;
  material.thickness = 0.12;
  material.roughness = 0.16;
  material.attenuationDistance = 1.5;
  return material;
}
