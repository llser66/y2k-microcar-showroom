import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { buildCar } from '../car/buildCar';
import { RaycastInteractions } from './RaycastInteractions';
import { VehicleInteractionController } from '../car/VehicleInteractionController';
import { ShowroomPanel } from './ShowroomPanel';
import { ShowroomState, type ShowroomStateSnapshot } from './ShowroomState';
import { getEntranceFrame, getQualityProfile, type QualityProfile } from './round5';

export class ShowroomApp {
  private renderer!: THREE.WebGLRenderer;
  private composer?: EffectComposer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private controls!: OrbitControls;
  private responsiveCameraMode?: boolean;
  private car = buildCar();
  private explosionParts = this.car.explosionParts.map(({ object, offset }) => ({ object, base: object.position.clone(), offset: offset.clone() }));
  private clock = new THREE.Clock();
  private raycastInteractions?: RaycastInteractions;
  private vehicleInteractions?: VehicleInteractionController;
  private panel!: ShowroomPanel;
  private showroomState = new ShowroomState();
  private spotlights: THREE.SpotLight[] = [];
  private groundPools: THREE.Mesh[] = [];
  private floaters: { object: THREE.Object3D; y: number; speed: number; phase: number; spin: number }[] = [];
  private explosionProgress = 0;
  private configurationMode = false;
  private controlsInteracting = false;
  private environmentTarget?: THREE.WebGLRenderTarget;
  private pmrem?: THREE.PMREMGenerator;
  private reflector?: Reflector;
  private overlay!: HTMLDivElement;
  private loadingManager = new THREE.LoadingManager();
  private quality: QualityProfile = getQualityProfile({
    viewportWidth: innerWidth,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  });
  private carMaterialStates = new Map<THREE.Material, { opacity: number; transparent: boolean }>();
  private entranceElapsed = 0;
  private entranceStarted = false;
  private loadingComplete = false;
  private loadingFallbackTimer?: number;
  private animationFrame?: number;
  private destroyed = false;

  constructor(private host: HTMLDivElement) {
    // Keep the initial phone view on the readable three-quarter angle; the
    // visitor can still turn auto-rotation on from the configuration sheet.
    if (innerWidth <= 650) this.showroomState.dispatch({ type: 'autoRotate', value: false });
    this.host.innerHTML = this.markup();
    this.panel = new ShowroomPanel(
      this.host,
      (action) => this.showroomState.dispatch(action),
      () => this.toggleCameraFacingDoor(),
    );
    this.panel.render(this.showroomState.value);
  }

  start() {
    this.overlay = this.host.querySelector('.loading')!;
    this.configureLoadingManager();
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.quality.low, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.pixelRatioCap));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Preserve frosted-plastic, chrome and interior detail before bloom.
    this.renderer.toneMappingExposure = 0.82;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.host.querySelector('.viewport')!.append(this.renderer.domElement);
    this.camera.position.set(-6.2, 3.3, 7.6);
    this.scene.background = new THREE.Color('#d8deea');
    this.scene.fog = new THREE.Fog('#d8deea', 12, 26);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.95, 0);
    this.controls.minPolarAngle = 0.55; this.controls.maxPolarAngle = 1.42;
    this.controls.minDistance = 4.5; this.controls.maxDistance = 12; this.controls.enableDamping = true;
    this.controls.autoRotate = this.showroomState.value.autoRotate; this.controls.autoRotateSpeed = 0.55;
    this.controls.addEventListener('start', () => {
      this.controlsInteracting = true;
      this.controls.autoRotate = false;
    });
    this.controls.addEventListener('end', () => {
      this.controlsInteracting = false;
      this.controls.autoRotate = this.showroomState.value.autoRotate;
    });
    this.makeStage();
    this.setupPostProcessing();
    this.loadEnvironment();
    this.car.root.visible = false;
    this.scene.add(this.car.root);
    this.createHeadlightRig();
    this.vehicleInteractions = new VehicleInteractionController(
      this.car, this.spotlights, this.groundPools,
      (doorsOpen) => this.showroomState.setDoorsOpen(doorsOpen),
      (headlightsOn) => this.showroomState.dispatch({ type: 'headlightsOn', value: headlightsOn }),
    );
    this.raycastInteractions = new RaycastInteractions(this.renderer.domElement, this.camera);
    this.car.doorAnchors.forEach((anchor, index) => this.raycastInteractions!.register(anchor.pivot, () => this.vehicleInteractions!.toggleDoor(index)));
    this.car.root.children.filter((child) => child.name.startsWith('headlamp-')).forEach((lamp) => this.raycastInteractions!.register(lamp, () => this.vehicleInteractions!.toggleHeadlights()));
    this.showroomState.subscribe((next, previous) => this.applyShowroomState(next, previous));
    this.resize(); addEventListener('resize', this.resize);
    this.animate();
  }

  dispose() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
    if (this.loadingFallbackTimer !== undefined) window.clearTimeout(this.loadingFallbackTimer);
    removeEventListener('resize', this.resize);
    this.raycastInteractions?.dispose();
    this.vehicleInteractions?.dispose();
    this.controls?.dispose();
    this.composer?.dispose();
    this.pmrem?.dispose();
    this.environmentTarget?.dispose();
    this.reflector?.dispose();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.filter(Boolean).forEach((material) => {
        Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) value.dispose(); });
        material.dispose();
      });
    });
    if (this.scene.background instanceof THREE.Texture) this.scene.background.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private configureLoadingManager() {
    const pct = this.host.querySelector('.load-pct')!;
    const bar = this.host.querySelector<HTMLElement>('.load-track i')!;
    const update = (loaded: number, total: number, label: string) => {
      const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
      bar.style.width = `${progress}%`;
      pct.textContent = `${String(progress).padStart(3, '0')}% — ${label}`;
    };
    this.loadingManager.onStart = (_url, loaded, total) => update(loaded, total, '初始化环境');
    this.loadingManager.onProgress = (_url, loaded, total) => update(loaded, total, '加载 HDR 光照');
    this.loadingManager.onError = () => { pct.textContent = '100% — 使用默认光照'; };
    this.loadingManager.onLoad = () => this.finishLoading();
    // Guard against a stalled asset: even if the HDR never settles, the showroom
    // must still enter after a bounded wait instead of hanging on the loading screen.
    this.loadingFallbackTimer = window.setTimeout(() => this.finishLoading(), 8000);
  }

  private finishLoading() {
    if (this.loadingComplete) return;
    this.loadingComplete = true;
    if (this.loadingFallbackTimer !== undefined) window.clearTimeout(this.loadingFallbackTimer);
    const pct = this.host.querySelector('.load-pct');
    const bar = this.host.querySelector<HTMLElement>('.load-track i');
    if (pct) pct.textContent = '100% — READY';
    if (bar) bar.style.width = '100%';
    this.car.root.visible = true;
    this.entranceElapsed = 0;
    this.entranceStarted = true;
    requestAnimationFrame(() => {
      this.overlay.classList.add('done');
      this.host.querySelector('.intro')?.classList.add('visible');
    });
  }

  private createHeadlightRig() {
    const flareCanvas = document.createElement('canvas'); flareCanvas.width = flareCanvas.height = 128;
    const context = flareCanvas.getContext('2d')!;
    const gradient = context.createRadialGradient(64, 64, 3, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(178,246,255,0.92)'); gradient.addColorStop(0.22, 'rgba(150,232,255,0.54)');
    gradient.addColorStop(0.58, 'rgba(126,209,255,0.16)'); gradient.addColorStop(1, 'rgba(126,209,255,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
    const glowTexture = new THREE.CanvasTexture(flareCanvas); glowTexture.colorSpace = THREE.SRGBColorSpace;

    this.car.lights.forEach((emitter, index) => {
      const side = index === 0 ? -1 : 1;
      const lampGroup = emitter.parent as THREE.Group;
      const spot = new THREE.SpotLight(0xa7efff, 0, 7, Math.PI / 7, 0.58, 1.4);
      spot.position.copy(emitter.position);
      spot.target.position.set(-4.25, -0.065, side * 0.78);
      lampGroup.add(spot); this.car.root.add(spot.target); this.spotlights.push(spot);

      const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.45), new THREE.MeshBasicMaterial({
        map: glowTexture, color: '#b5f4ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false,
      }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(-4.25, -0.033, side * 0.78); pool.visible = false;
      pool.name = `headlight-ground-pool-${side}`; this.scene.add(pool); this.groundPools.push(pool);
    });
  }

  private loadEnvironment() {
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();
    new RGBELoader(this.loadingManager).load('/hdr/studio_small_03_1k.hdr', (texture) => {
      this.environmentTarget = this.pmrem!.fromEquirectangular(texture);
      this.scene.environment = this.environmentTarget.texture;
      this.scene.environmentIntensity = this.showroomState.value.ambientIntensity;
      texture.dispose();
      this.pmrem?.dispose();
      this.pmrem = undefined;
    }, undefined, (error) => console.error('Failed to load studio HDR environment', error));
  }

  private makeStage() {
    this.scene.add(new THREE.HemisphereLight(0xf2f6ff, 0x707c9d, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.15); key.position.set(-3, 7, 4); key.castShadow = true;
    key.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize); key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5; key.shadow.bias = -0.0004; this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xb3c7ff, 0.72); fill.position.set(2, 4, -5); this.scene.add(fill);
    this.scene.background = this.makeGradientGridBackground();
    const floorBase = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ color: '#c6d0df', roughness: 0.62, metalness: 0.06 }));
    floorBase.rotation.x = -Math.PI / 2; floorBase.position.y = -0.065; floorBase.receiveShadow = true; this.scene.add(floorBase);
    const reflectionShader = {
      uniforms: {
        color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, blurStep: { value: new THREE.Vector2(this.quality.low ? 0.0038 : 0.0018, this.quality.low ? 0.0038 : 0.0018) },
      },
      vertexShader: /* glsl */`
        uniform mat4 textureMatrix;
        varying vec4 vUv;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main() {
          vUv = textureMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 color;
        uniform sampler2D tDiffuse;
        uniform vec2 blurStep;
        varying vec4 vUv;
        #include <logdepthbuf_pars_fragment>
        vec3 overlay(vec3 base, vec3 tint) {
          return mix(2.0 * base * tint, 1.0 - 2.0 * (1.0 - base) * (1.0 - tint), step(vec3(0.5), base));
        }
        void main() {
          #include <logdepthbuf_fragment>
          vec2 uv = vUv.xy / vUv.w;
          vec2 d = blurStep;
          vec3 reflected = texture2D(tDiffuse, uv).rgb * 0.14;
          reflected += texture2D(tDiffuse, uv + vec2(d.x, 0.0)).rgb * 0.05;
          reflected += texture2D(tDiffuse, uv - vec2(d.x, 0.0)).rgb * 0.05;
          reflected += texture2D(tDiffuse, uv + vec2(0.0, d.y)).rgb * 0.05;
          reflected += texture2D(tDiffuse, uv - vec2(0.0, d.y)).rgb * 0.05;
          reflected += texture2D(tDiffuse, uv + d).rgb * 0.02;
          reflected += texture2D(tDiffuse, uv - d).rgb * 0.02;
          reflected += texture2D(tDiffuse, uv + vec2(d.x, -d.y)).rgb * 0.02;
          reflected += texture2D(tDiffuse, uv + vec2(-d.x, d.y)).rgb * 0.02;
          gl_FragColor = vec4(reflected + color * 0.09, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    };
    const reflector = new Reflector(new THREE.PlaneGeometry(18, 18), {
      color: '#b7c6d4', textureWidth: this.quality.reflectorResolution, textureHeight: this.quality.reflectorResolution,
      clipBias: 0.003, multisample: 0, shader: reflectionShader,
    });
    reflector.rotation.x = -Math.PI / 2; reflector.position.y = -0.04; reflector.name = 'soft-mirror-reflector'; this.scene.add(reflector);
    this.reflector = reflector;
    const grid = new THREE.GridHelper(18, 36, 0x9ba9bd, 0xb8c2d0); grid.position.y = -0.025; (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.22; this.scene.add(grid);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(2.2, 64), new THREE.MeshBasicMaterial({ color: '#c5a6db', transparent: true, opacity: 0.14, depthWrite: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = -0.018; halo.scale.set(1.5, 0.62, 1); this.scene.add(halo);

    const starShape = new THREE.Shape();
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI * 2 / 16 - Math.PI / 2;
      const radius = i % 2 === 0 ? 0.2 : 0.055;
      const point = new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
      if (i === 0) starShape.moveTo(point.x, point.y); else starShape.lineTo(point.x, point.y);
    }
    starShape.closePath();
    // Keep the three starbursts separated across the showroom volume. They are
    // individual meshes so their bobbing phases never make a clumped ornament.
    [
      { position: new THREE.Vector3(-2.85, 2.72, 0.20), scale: 0.72, phase: 0, spin: 0.12 },
      { position: new THREE.Vector3(2.45, 3.15, -1.00), scale: 0.52, phase: 1.9, spin: -0.10 },
      { position: new THREE.Vector3(-2.55, 2.15, -1.65), scale: 0.46, phase: 3.8, spin: 0.09 },
    ].forEach(({ position, scale, phase, spin }, index) => {
      const star = new THREE.Mesh(new THREE.ShapeGeometry(starShape), new THREE.MeshBasicMaterial({ color: '#f48ec6', side: THREE.DoubleSide }));
      star.name = `y2k-star-${index + 1}`;
      star.position.copy(position); star.scale.setScalar(scale); star.rotation.z = Math.PI / 8;
      this.addFloater(star, position.y, 0.44 + index * 0.08, phase, spin);
    });

    const dropGeometry = new THREE.LatheGeometry([
      new THREE.Vector2(0, -0.24), new THREE.Vector2(0.07, -0.2), new THREE.Vector2(0.13, -0.08),
      new THREE.Vector2(0.16, 0.05), new THREE.Vector2(0.13, 0.17), new THREE.Vector2(0.07, 0.29),
      new THREE.Vector2(0.012, 0.39),
    ], 24);
    // Mobile skips the glass droplets so floater and Reflector costs stay
    // bounded; the starbursts keep a Y2K accent on every tier.
    if (!this.quality.low) {
      const dropMaterials = [
        new THREE.MeshPhysicalMaterial({ color: '#77dce7', roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }),
        new THREE.MeshPhysicalMaterial({ color: '#b4a8ed', roughness: 0.2, metalness: 0.16, clearcoat: 1, clearcoatRoughness: 0.12 }),
      ];
      [
        { position: new THREE.Vector3(3.15, 2.25, -1.10), scale: 0.62, material: dropMaterials[0], phase: 1.7, spin: 0.16 },
        { position: new THREE.Vector3(2.75, 3.00, -1.80), scale: 0.46, material: dropMaterials[1], phase: 3.1, spin: -0.13 },
        { position: new THREE.Vector3(-3.15, 2.45, -0.20), scale: 0.44, material: dropMaterials[0], phase: 4.6, spin: 0.11 },
      ].forEach(({ position, scale, material, phase, spin }, index) => {
        const drop = new THREE.Mesh(dropGeometry, material);
        drop.name = `y2k-drop-${index + 1}`;
        drop.position.copy(position); drop.scale.setScalar(scale);
        this.addFloater(drop, position.y, 0.38 + index * 0.05, phase, spin);
      });
    }
  }

  private addFloater(object: THREE.Object3D, y: number, speed: number, phase: number, spin: number) {
    this.scene.add(object);
    this.floaters.push({ object, y, speed, phase, spin });
  }

  private setupPostProcessing() {
    if (!this.quality.usePostProcessing) return;
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Keep the bloom restrained so the pastel shell and chrome retain detail.
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.09, 0.12, 0.96));
    const colorFringe = new ShaderPass(RGBShiftShader);
    colorFringe.uniforms['amount'].value = 0.0001;
    colorFringe.uniforms['angle'].value = 0;
    this.composer.addPass(colorFringe);
    this.composer.addPass(new OutputPass());
  }

  private makeGradientGridBackground() {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#d9e1ed'); gradient.addColorStop(0.48, '#d0dbea'); gradient.addColorStop(1, '#bdcbe0');
    context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
    const fade = context.createLinearGradient(0, 170, 0, canvas.height);
    fade.addColorStop(0, 'rgba(118,145,177,0)'); fade.addColorStop(1, 'rgba(118,145,177,0.19)');
    context.strokeStyle = fade; context.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 48) { context.beginPath(); context.moveTo(x, 120); context.lineTo(x, canvas.height); context.stroke(); }
    for (let y = 150; y <= canvas.height; y += 32) { context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke(); }
    const texture = new THREE.CanvasTexture(canvas); texture.mapping = THREE.EquirectangularReflectionMapping; texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private applyShowroomState(next: ShowroomStateSnapshot, previous: ShowroomStateSnapshot) {
    this.panel.render(next);
    if (next.bodyColor !== previous.bodyColor) this.car.bodyMaterials.forEach((material) => material.color.set(next.bodyColor));
    if (next.wheelStyle !== previous.wheelStyle) {
      this.car.wheels.forEach((wheel) => wheel.children
        .filter((child) => child.name.startsWith('rim-style-'))
        .forEach((rim) => { rim.visible = rim.name === `rim-style-${next.wheelStyle}`; }));
    }
    if (next.roofRackVisible !== previous.roofRackVisible) {
      const rack = this.car.root.getObjectByName('roof-rack'); if (rack) rack.visible = next.roofRackVisible;
    }
    if (next.autoRotate !== previous.autoRotate && this.controls) this.controls.autoRotate = next.autoRotate && !this.controlsInteracting;
    if (next.ambientIntensity !== previous.ambientIntensity) this.scene.environmentIntensity = next.ambientIntensity;
    if (next.headlightsOn !== previous.headlightsOn) this.vehicleInteractions?.setHeadlightsOn(next.headlightsOn);
  }

  private animate = () => {
    if (this.destroyed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta(); const time = this.clock.elapsedTime;
    if (this.entranceStarted) {
      this.entranceElapsed += delta;
      const entrance = getEntranceFrame(this.entranceElapsed);
      this.car.root.position.y = entrance.y;
      this.car.root.scale.setScalar(entrance.scale);
      this.setCarOpacity(entrance.opacity);
      if (entrance.complete) this.entranceStarted = false;
    }
    this.vehicleInteractions?.update();
    this.floaters.forEach(({ object, y, speed, phase, spin }) => {
      object.position.y = y + Math.sin(time * speed + phase) * 0.12;
      object.rotation.y += spin * delta;
    });
    this.controls.update();
    this.updateExplosion(delta);
    this.updateDoors();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  private updateExplosion(delta: number) {
    const distance = this.camera.position.distanceTo(this.controls.target);
    if (!this.configurationMode && distance <= 7.2) this.setConfigurationMode(true);
    else if (this.configurationMode && distance >= 8.0) this.setConfigurationMode(false);

    const target = this.configurationMode
      ? THREE.MathUtils.clamp((7.2 - distance) / (7.2 - 4.8), 0, 1)
      : 0;
    this.explosionProgress = THREE.MathUtils.damp(this.explosionProgress, target, 11, delta);
    if (Math.abs(this.explosionProgress - target) < 0.001) this.explosionProgress = target;
    this.explosionParts.forEach(({ object, base, offset }) => object.position.copy(base).addScaledVector(offset, this.explosionProgress));

    const currentState = this.showroomState.value;
    if (currentState.configurationMode !== this.configurationMode
      || Math.round(currentState.explosionProgress * 100) !== Math.round(this.explosionProgress * 100)) {
      this.showroomState.setSceneMode(this.configurationMode, this.explosionProgress);
    }
  }

  private setConfigurationMode(active: boolean) {
    this.configurationMode = active;
    this.showroomState.setSceneMode(active, this.explosionProgress);
  }

  /** The showcase button opens only the door facing the current camera. */
  private toggleCameraFacingDoor() {
    const visibleSide = this.camera.position.z >= 0 ? 1 : -1;
    const index = this.car.doorAnchors.findIndex(({ side }) => side === visibleSide);
    if (index >= 0) this.vehicleInteractions?.toggleDoor(index);
  }

  /** Doors swing around their hinge pivot and slide clear of the aperture as the view explodes. */
  private updateDoors() {
    this.car.doorAnchors.forEach(({ rig, pivot, side }, index) => {
      const clickOpen = this.vehicleInteractions?.getDoorOpenAmount(index) ?? 0;
      const factor = Math.max(clickOpen, this.explosionProgress);
      // Around 60° keeps the opened panel visibly door-shaped from the side;
      // the previous ~81° pose projected it almost edge-on.
      pivot.rotation.y = -side * 1.05 * factor;
      rig.position.z = side * 0.24 * this.explosionProgress;
    });
  }

  private resize = () => {
    this.syncResponsiveCamera();
    const bounds = this.host.querySelector('.viewport')!.getBoundingClientRect();
    this.camera.aspect = bounds.width / Math.max(1, bounds.height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(bounds.width, bounds.height);
    this.composer?.setSize(bounds.width, bounds.height);
  };

  /** Give narrow portrait screens a little more breathing room around the car. */
  private syncResponsiveCamera() {
    const compact = window.innerWidth <= 650;
    if (this.responsiveCameraMode === compact) return;
    this.responsiveCameraMode = compact;
    this.camera.fov = compact ? 36 : 32;
    this.camera.position.set(
      compact ? -6.5 : -6.2,
      compact ? 3.82 : 3.3,
      compact ? 8.1 : 7.6,
    );
    this.controls.target.set(0, compact ? 1.42 : 0.95, 0);
    this.controls.update();
    this.camera.updateProjectionMatrix();
  }

  private setCarOpacity(opacity: number) {
    this.car.root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.filter(Boolean).forEach((material) => {
        if (!this.carMaterialStates.has(material)) {
          this.carMaterialStates.set(material, { opacity: material.opacity, transparent: material.transparent });
        }
        const original = this.carMaterialStates.get(material)!;
        material.transparent = original.transparent || opacity < 1;
        material.opacity = original.opacity * opacity;
        material.needsUpdate = true;
      });
    });
  }

  private markup() { return `<div class="loading"><div class="load-mark">N<span>•</span></div><div class="load-copy">ASSEMBLING YOUR CITY POD <b>R1</b></div><div class="load-track"><i></i></div><div class="load-pct">0xFF — READY</div></div>
    <div class="viewport"></div><div class="grain"></div>
    <header class="topbar"><a class="brand" href="#"><span class="brand-icon">N</span><span>NEONETTE<small>MICRO MOBILITY / 2001</small></span></a><div class="edition">CITY POD <span>01 — A00</span></div><button class="sound" aria-label="声音设置">◌ <span>STUDIO MODE</span></button></header>
    <section class="intro"><div class="eyebrow">城市新日常 <i></i> 01 / 05</div><h1>Small car.<br><em>Big energy.</em></h1><p>程序化构建的 Y2K 双座城市舱，圆润外壳、全景座舱与金属细节。</p><div class="intro-actions"><button id="door-action" class="pill-button"><span id="door-action-label">打开车门</span><span>↗</span></button><button id="lamp-action" class="lamp-status" type="button" aria-pressed="false"><i class="status-dot"></i><span id="lamp-action-label">○ 车灯：关闭</span></button></div></section>
    ${ShowroomPanel.markup()}
    <div class="bottom-meta"><span>FIG. 001 — CITY POD IN BUBBLEGUM</span><span>WEBGL / PROCEDURAL OBJECT</span></div>`; }
}
