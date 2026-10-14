import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCar, type CarModel } from '../car/round1/buildCar';

/**
 * Round 1 preview.
 *
 * Deliberately bare: no post-processing, no bloom, no UI, no exploded view and no
 * animation. It exists so the model can be inspected and photographed from the
 * four angles the brief asks for.
 *
 *   ?view=three-quarter | side | top | front | rear
 *   &yaw=<degrees>   override the horizontal angle
 *   &pitch=<degrees> override the elevation
 *   &door=<0..1>     door open amount, applied as a fixed pose
 */

interface View {
  yaw: number;
  pitch: number;
  distance: number;
}

const VIEWS: Record<string, View> = {
  'three-quarter': { yaw: 40, pitch: 18, distance: 4.7 },
  side: { yaw: 90, pitch: 5, distance: 5 },
  top: { yaw: 90, pitch: 84, distance: 4.9 },
  front: { yaw: 4, pitch: 9, distance: 4.6 },
  rear: { yaw: 184, pitch: 9, distance: 4.6 },
};

const params = new URLSearchParams(location.search);
const number = (key: string, fallback: number): number => {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const preset = VIEWS[params.get('view') ?? 'three-quarter'] ?? VIEWS['three-quarter'];
const view: View = {
  yaw: number('yaw', preset.yaw),
  pitch: number('pitch', preset.pitch),
  distance: number('distance', preset.distance),
};
const doorOpen = THREE.MathUtils.clamp(number('door', 0), 0, 1);

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Round 1 preview root was not found');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeaeef3);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 100);

const TARGET = new THREE.Vector3(0, 0.72, 0);
function placeCamera(): void {
  const yaw = THREE.MathUtils.degToRad(view.yaw);
  const pitch = THREE.MathUtils.degToRad(view.pitch);
  const radius = view.distance * Math.cos(pitch);
  camera.position.set(-radius * Math.cos(yaw), TARGET.y + view.distance * Math.sin(pitch), radius * Math.sin(yaw));
  camera.lookAt(TARGET);
}
placeCamera();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TARGET);
controls.enableDamping = true;
controls.update();

const hemi = new THREE.HemisphereLight(0xffffff, 0xb9c3cd, 1.1);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(-3.4, 5.2, 3.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -3;
key.shadow.camera.right = 3;
key.shadow.camera.top = 3;
key.shadow.camera.bottom = -3;
scene.add(key);

const fill = new THREE.DirectionalLight(0xdfeaff, 0.85);
fill.position.set(3.6, 2.4, -3.4);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(9, 64),
  new THREE.MeshStandardMaterial({ color: 0xd7dde5, roughness: 0.94, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const car: CarModel = buildCar();
car.setDoorsOpen(doorOpen);
scene.add(car.root);

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
addEventListener('resize', resize);

let frame = 0;
function tick(): void {
  frame = requestAnimationFrame(tick);
  controls.update();
  renderer.render(scene, camera);
}
tick();

// Handles for scripted inspection and for the acceptance screenshots.
declare global {
  interface Window {
    round1: { car: CarModel; camera: THREE.PerspectiveCamera; controls: OrbitControls; setDoorsOpen: (amount: number) => void };
  }
}
window.round1 = {
  car,
  camera,
  controls,
  setDoorsOpen: (amount: number) => car.setDoorsOpen(amount),
};

addEventListener('pagehide', () => {
  cancelAnimationFrame(frame);
  controls.dispose();
  renderer.dispose();
  pmrem.dispose();
});
