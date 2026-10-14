import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';
import type { CarAssembly } from './buildCar';
import { setTailLights } from './carMaterials';

export class VehicleInteractionController {
  private doorOpen: boolean[];
  private doorOpenAmount: number[];
  private doorTweens = new Map<number, TWEEN.Tween<{ open: number }>>();
  private headlightsOn = true;

  constructor(
    private car: CarAssembly,
    private spotlights: THREE.SpotLight[],
    private groundPools: THREE.Mesh[],
    private onDoorsOpenChange: (open: boolean) => void = () => {},
    private onHeadlightsChange: (on: boolean) => void = () => {},
  ) {
    this.doorOpen = car.doorAnchors.map(() => false);
    this.doorOpenAmount = car.doorAnchors.map(() => 0);
    this.setHeadlights(false);
  }

  /** 0..1 normalized door opening, tweened toward the click target each frame. */
  getDoorOpenAmount(index: number): number {
    return this.doorOpenAmount[index] ?? 0;
  }

  toggleDoor(index: number) {
    if (!this.car.doorAnchors[index]) return;
    this.setDoor(index, !this.doorOpen[index]);
  }

  toggleAllDoors() {
    this.setAllDoors(!this.doorOpen.some(Boolean));
  }

  setAllDoors(open: boolean) { this.car.doorAnchors.forEach((_, index) => this.setDoor(index, open)); }

  get hasOpenDoor() { return this.doorOpen.some(Boolean); }

  toggleHeadlights() { this.setHeadlights(!this.headlightsOn); }
  setHeadlightsOn(on: boolean) { this.setHeadlights(on); }

  update() { TWEEN.update(); }

  dispose() {
    this.doorTweens.forEach((tween) => tween.stop());
    this.doorTweens.clear();
  }

  private setDoor(index: number, open: boolean) {
    if (this.doorOpen[index] === open) return;
    this.doorOpen[index] = open;
    this.onDoorsOpenChange(this.hasOpenDoor);
    this.doorTweens.get(index)?.stop();
    const from = { open: this.doorOpenAmount[index] };
    const tween = new TWEEN.Tween(from)
      .to({ open: open ? 1 : 0 }, open ? 430 : 350)
      .easing(open ? TWEEN.Easing.Back.Out : TWEEN.Easing.Cubic.InOut)
      .onUpdate(({ open }) => { this.doorOpenAmount[index] = open; })
      .onComplete(() => this.doorTweens.delete(index))
      .start();
    this.doorTweens.set(index, tween);
  }

  private setHeadlights(on: boolean) {
    if (this.headlightsOn === on) return;
    this.headlightsOn = on;
    this.car.lights.forEach((lamp) => {
      const material = lamp.material as THREE.MeshStandardMaterial;
      material.emissive.set(on ? '#a7efff' : '#274653');
      material.emissiveIntensity = on ? 5 : 0.16;
    });
    this.spotlights.forEach((light) => { light.intensity = on ? 28 : 0; });
    this.groundPools.forEach((pool) => {
      const material = pool.material as THREE.MeshBasicMaterial;
      material.opacity = on ? 0.82 : 0;
      pool.visible = on;
    });
    // Tail lamps share one lens material, so a single switch drives both sides.
    this.car.tailLamps.forEach((tail) => {
      setTailLights(tail.material as THREE.MeshStandardMaterial, on);
    });
    this.onHeadlightsChange(on);
  }
}
