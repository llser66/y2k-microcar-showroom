import * as THREE from 'three';

type Activation = () => void;

/** One click registry for all 3D interaction targets. Drags remain OrbitControls gestures. */
export class RaycastInteractions {
  private raycaster = new THREE.Raycaster();
  private targets = new Map<THREE.Object3D, Activation>();
  private down?: { x: number; y: number; pointerId: number };

  constructor(private canvas: HTMLCanvasElement, private camera: THREE.Camera) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
  }

  register(target: THREE.Object3D, activate: Activation) {
    this.targets.set(target, activate);
    return () => this.targets.delete(target);
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.targets.clear();
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.down = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  };

  private onPointerUp = (event: PointerEvent) => {
    const down = this.down;
    this.down = undefined;
    if (!down || down.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) return;
    if (this.targets.size === 0) return;

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = this.raycaster.intersectObjects([...this.targets.keys()], true)[0];
    if (!hit) return;

    let object: THREE.Object3D | null = hit.object;
    while (object) {
      const activate = this.targets.get(object);
      if (activate) { activate(); return; }
      object = object.parent;
    }
  };

  private onPointerCancel = () => { this.down = undefined; };
}
