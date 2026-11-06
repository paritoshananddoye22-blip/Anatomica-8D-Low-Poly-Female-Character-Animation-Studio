import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import {
  ANIMATION_CLIP_BY_ID,
  DIRECTION_BY_ID,
  DirectionId,
  EIGHT_DIRECTIONS,
} from '../character/animationCatalog';
import {
  evaluateClipPoseAtNormalizedTime,
  getOrCreateAnimationClip,
} from '../character/animationGenerator';
import {
  CHARACTER_COLOR_SCHEMES,
  createRiggedFemaleCharacter,
} from '../character/femaleAnatomyMesh';
import { BONE_DEFINITIONS, BoneName } from '../character/skeletonSpec';

export type CameraPresetId =
  | 'three_quarter'
  | 'front'
  | 'side'
  | 'back'
  | 'head_closeup'
  | 'top_compass';

export interface StudioViewportState {
  activeClipId: string;
  isPlaying: boolean;
  playbackSpeed: number;
  scrubNormalizedTime: number | null;
  rootMotion: boolean;
  showWireframe: boolean;
  showSkeleton: boolean;
  showProportionGuide: boolean;
  colorSchemeId: string;
  cameraPreset: CameraPresetId;
  cameraPresetTrigger: number;
  blendModeActive: boolean;
  blendVector: [number, number]; // [vx, vz] in [-1, 1], where +vx is Right (-X in world) or Left
  gaitTier: 'WLK' | 'FWLK' | 'RUN' | 'SPR' | 'CRW' | 'CRUN' | 'STL';
  manualBoneOverride: { bone: BoneName; rx: number; ry: number; rz: number } | null;
}

interface ThreeCharacterCanvasProps {
  state: StudioViewportState;
  onSelectDirection?: (dir: DirectionId) => void;
  onExportReady?: (exportFn: (mode: 'active' | 'locomotion_pack') => void) => void;
  onTelemetryUpdate?: (timeSec: number, durationSec: number, activeDir: DirectionId) => void;
}

const CAMERA_PRESETS: Record<
  CameraPresetId,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  three_quarter: { pos: [1.95, 1.32, 3.05], target: [0, 0.62, 0] },
  front: { pos: [0.0, 1.08, 3.25], target: [0, 0.68, 0] },
  side: { pos: [3.25, 1.08, 0.0], target: [0, 0.68, 0] },
  back: { pos: [0.0, 1.08, -3.25], target: [0, 0.68, 0] },
  head_closeup: { pos: [0.28, 1.56, 0.72], target: [0, 1.54, 0] },
  top_compass: { pos: [0.0, 3.65, 0.85], target: [0, 0.50, 0] },
};

// Pre-allocated math scratch objects outside render loop (zero GC)
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _euler = new THREE.Euler();
const _quatA = new THREE.Quaternion();
const _quatB = new THREE.Quaternion();
const _vecA = new THREE.Vector3();

function createCompassFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f131a';
  ctx.fillRect(0, 0, 1024, 1024);

  const cx = 512;
  const cy = 512;

  // Concentric metric rings
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 2;
  for (const r of [110, 220, 330, 440]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 8-Direction radial vectors & labels
  // On floor plane (rotated -PI/2 around X):
  // Canvas +Y (down) maps to World +Z (Forward D01).
  // Canvas -X (left) maps to World -X (Character's Right D03).
  // Canvas +X (right) maps to World +X (Character's Left D07).
  const dirCanvasAngles: Array<{ id: DirectionId; label: string; angle: number; primary: boolean }> = [
    { id: 'D01', label: 'D01 · FWD', angle: Math.PI / 2, primary: true },
    { id: 'D02', label: 'D02 · FWD-R', angle: (3 * Math.PI) / 4, primary: false },
    { id: 'D03', label: 'D03 · RIGHT', angle: Math.PI, primary: true },
    { id: 'D04', label: 'D04 · BWD-R', angle: -(3 * Math.PI) / 4, primary: false },
    { id: 'D05', label: 'D05 · BWD', angle: -Math.PI / 2, primary: true },
    { id: 'D06', label: 'D06 · BWD-L', angle: -Math.PI / 4, primary: false },
    { id: 'D07', label: 'D07 · LEFT', angle: 0, primary: true },
    { id: 'D08', label: 'D08 · FWD-L', angle: Math.PI / 4, primary: false },
  ];

  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const d of dirCanvasAngles) {
    const cosA = Math.cos(d.angle);
    const sinA = Math.sin(d.angle);
    ctx.strokeStyle = d.id === 'D01' ? 'rgba(56, 189, 248, 0.55)' : d.primary ? 'rgba(148, 163, 184, 0.28)' : 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = d.id === 'D01' ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(cx + cosA * 55, cy + sinA * 55);
    ctx.lineTo(cx + cosA * 410, cy + sinA * 410);
    ctx.stroke();

    const lx = cx + cosA * 452;
    const ly = cy + sinA * 452;
    ctx.fillStyle = d.id === 'D01' ? '#38bdf8' : '#94a3b8';
    ctx.fillText(d.id, lx, ly);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export function ThreeCharacterCanvas({
  state,
  onExportReady,
  onTelemetryUpdate,
}: ThreeCharacterCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<StudioViewportState>(state);
  stateRef.current = state;

  const telemetryCbRef = useRef(onTelemetryUpdate);
  telemetryCbRef.current = onTelemetryUpdate;

  const characterRigRef = useRef<ReturnType<typeof createRiggedFemaleCharacter> | null>(null);
  const wireframeMeshRef = useRef<THREE.SkinnedMesh | null>(null);
  const skeletonHelperRef = useRef<THREE.SkeletonHelper | null>(null);
  const proportionGuideRef = useRef<THREE.Group | null>(null);
  const dirArrowRef = useRef<THREE.Group | null>(null);
  const cameraTransitionActiveRef = useRef<boolean>(false);
  const lastPresetTriggerRef = useRef<number>(state.cameraPresetTrigger);
  const lastSchemeIdRef = useRef<string>(state.colorSchemeId);

  // Sync material & visibility toggles immediately when props change
  useEffect(() => {
    if (wireframeMeshRef.current) {
      wireframeMeshRef.current.visible = state.showWireframe;
    }
    if (skeletonHelperRef.current) {
      skeletonHelperRef.current.visible = state.showSkeleton;
    }
    if (proportionGuideRef.current) {
      proportionGuideRef.current.visible = state.showProportionGuide;
    }
    if (lastPresetTriggerRef.current !== state.cameraPresetTrigger) {
      lastPresetTriggerRef.current = state.cameraPresetTrigger;
      cameraTransitionActiveRef.current = true;
    }
    if (lastSchemeIdRef.current !== state.colorSchemeId && characterRigRef.current) {
      lastSchemeIdRef.current = state.colorSchemeId;
      const scheme =
        CHARACTER_COLOR_SCHEMES.find((s) => s.id === state.colorSchemeId) ??
        CHARACTER_COLOR_SCHEMES[0];
      const fresh = createRiggedFemaleCharacter(scheme);
      const oldAttr = characterRigRef.current.skinnedMesh.geometry.getAttribute('color');
      const newAttr = fresh.skinnedMesh.geometry.getAttribute('color');
      if (oldAttr && newAttr) {
        (oldAttr.array as Float32Array).set(newAttr.array as Float32Array);
        oldAttr.needsUpdate = true;
      }
      fresh.skinnedMesh.geometry.dispose();
      fresh.material.dispose();
    }
  }, [
    state.showWireframe,
    state.showSkeleton,
    state.showProportionGuide,
    state.cameraPresetTrigger,
    state.colorSchemeId,
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software-WebGL Guard (Three.js skill §2.1)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 1280, container.clientHeight || 720);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0d12);
    scene.fog = new THREE.FogExp2(0x0b0d12, 0.075);

    // 2. Studio Environment Reflection (RoomEnvironment + PMREMGenerator on hardware GPU)
    if (!isSoftwareGl) {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    }

    const camera = new THREE.PerspectiveCamera(
      40,
      (container.clientWidth || 1280) / (container.clientHeight || 720),
      0.08,
      60
    );
    const initialPreset = CAMERA_PRESETS[stateRef.current.cameraPreset];
    camera.position.set(...initialPreset.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...initialPreset.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.45;
    controls.maxDistance = 9.0;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.update();

    controls.addEventListener('start', () => {
      cameraTransitionActiveRef.current = false;
    });

    // 3. Balanced 3-Point Studio Lighting Rig (Warm Key, Cool Hemisphere Fill, Crisp Rim)
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.55);
    hemiLight.position.set(0, 6, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e0, 1.45);
    keyLight.position.set(2.4, 3.8, 2.8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 10;
    const d = 1.8;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
    rimLight.position.set(-2.2, 2.6, -2.8);
    scene.add(rimLight);

    // 4. Studio Ground Plane & 8-Direction Compass Disc (Disjoint Y offsets to prevent Z-fighting)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const compassTex = createCompassFloorTexture(maxAniso);
    const compassDisc = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 64),
      new THREE.MeshStandardMaterial({
        map: compassTex,
        color: 0xffffff,
        roughness: 0.78,
        metalness: 0.12,
      })
    );
    compassDisc.rotation.x = -Math.PI / 2;
    compassDisc.position.y = 0.0;
    compassDisc.receiveShadow = true;
    scene.add(compassDisc);

    // Outer studio floor ring
    const outerFloor = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 18.0, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0b0d12,
        roughness: 0.9,
        metalness: 0.05,
      })
    );
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = -0.005;
    scene.add(outerFloor);

    // Soft radial contact shadow beneath character (y = 0.004)
    const contactShadowTex = createContactShadowTexture();
    const contactShadowMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 32),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
    );
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.y = 0.004;
    scene.add(contactShadowMesh);

    // Active Direction Vector Indicator Arrow on Floor (composite 3-part Group)
    const dirArrowGroup = new THREE.Group();
    dirArrowGroup.position.y = 0.008;
    const shaftGeo = new THREE.BoxGeometry(0.035, 0.006, 0.72);
    shaftGeo.translate(0, 0, 0.42);
    const headGeo = new THREE.ConeGeometry(0.08, 0.18, 4);
    headGeo.rotateX(Math.PI / 2);
    headGeo.translate(0, 0, 0.85);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      roughness: 0.3,
    });
    dirArrowGroup.add(new THREE.Mesh(shaftGeo, arrowMat));
    dirArrowGroup.add(new THREE.Mesh(headGeo, arrowMat));
    scene.add(dirArrowGroup);
    dirArrowRef.current = dirArrowGroup;

    // 5. Build Rigged Low-Poly Female Character (< 1,000 triangles)
    const initialScheme =
      CHARACTER_COLOR_SCHEMES.find((s) => s.id === stateRef.current.colorSchemeId) ??
      CHARACTER_COLOR_SCHEMES[0];
    const rig = createRiggedFemaleCharacter(initialScheme, maxAniso);
    scene.add(rig.characterGroup);
    characterRigRef.current = rig;

    // Wireframe overlay SkinnedMesh (shares skeleton & geometry for live deforming wireframe inspection)
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.42,
      depthTest: true,
    });
    const wireSkinnedMesh = new THREE.SkinnedMesh(rig.skinnedMesh.geometry, wireMat);
    wireSkinnedMesh.frustumCulled = false;
    wireSkinnedMesh.bind(rig.skeleton, rig.skinnedMesh.bindMatrix);
    wireSkinnedMesh.visible = stateRef.current.showWireframe;
    rig.characterGroup.add(wireSkinnedMesh);
    wireframeMeshRef.current = wireSkinnedMesh;

    // SkeletonHelper for live 25-bone joint inspection
    const skelHelper = new THREE.SkeletonHelper(rig.rootBone);
    (skelHelper.material as THREE.LineBasicMaterial).linewidth = 2;
    skelHelper.visible = stateRef.current.showSkeleton;
    scene.add(skelHelper);
    skeletonHelperRef.current = skelHelper;

    // 6. Anatomical 7.3-Head Proportion Stadiometer Guide (composite Group)
    const propGuide = new THREE.Group();
    propGuide.visible = stateRef.current.showProportionGuide;
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.4,
      metalness: 0.6,
    });
    const tickMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.68, 8), poleMat);
    pole.position.set(-0.52, 0.84, 0);
    propGuide.add(pole);
    // 7.3 Head height ticks (every 0.23m from top 1.68m downward)
    for (let h = 0; h <= 7; h++) {
      const yTick = Math.max(0.005, 1.68 - h * 0.23);
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.004, 0.004), tickMat);
      tick.position.set(-0.44, yTick, 0);
      propGuide.add(tick);
    }
    scene.add(propGuide);
    proportionGuideRef.current = propGuide;

    // Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 7. Provide GLTF Exporter callback
    if (onExportReady) {
      onExportReady((mode) => {
        const exporter = new GLTFExporter();
        const clipsToExport: THREE.AnimationClip[] = [];
        if (mode === 'active') {
          clipsToExport.push(
            getOrCreateAnimationClip(stateRef.current.activeClipId, stateRef.current.rootMotion)
          );
        } else {
          // Export core 8-directional locomotion pack (Walk, Run, Sprint, Crouch, Crouch Run, Stealth, Jump, Jump Run, Dodge, Roll, Slide)
          for (const prefix of ['WLK', 'FWLK', 'RUN', 'SPR', 'CRW', 'CRUN', 'STL', 'JUMP', 'JUMP_RUN', 'DDG', 'ROLL', 'SLIDE']) {
            for (const d of EIGHT_DIRECTIONS) {
              clipsToExport.push(getOrCreateAnimationClip(`${prefix}_${d.id}`, false));
            }
          }
        }
        exporter.parse(
          rig.characterGroup,
          (result) => {
            const output = JSON.stringify(result, null, 2);
            const blob = new Blob([output], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download =
              mode === 'active'
                ? `female_human_lowpoly_${stateRef.current.activeClipId}.gltf`
                : 'female_human_lowpoly_8D_locomotion_library.gltf';
            a.click();
            URL.revokeObjectURL(url);
          },
          (err) => {
            console.error('GLTF export failed:', err);
          },
          { animations: clipsToExport, binary: false }
        );
      });
    }

    // 8. Interactive WASD / Arrow Keys Playable Input Listener on window
    const pressedKeys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      pressedKeys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // 9. Animation Loop with Software-WebGL Pacing (`afterDraw`)
    let frameId = 0;
    let unmounted = false;
    let animElapsedSec = 0;
    let lastActiveClipId = stateRef.current.activeClipId;
    let lastTimestamp = performance.now();
    let lastTelemetryTime = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (unmounted) return;
        const syncState = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (sync && syncState === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 4);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 24);
        }
      };
      frameId = window.setTimeout(poll, 4);
    }

    function applyPoseToBones(
      pose: ReturnType<typeof evaluateClipPoseAtNormalizedTime>,
      blendPose?: ReturnType<typeof evaluateClipPoseAtNormalizedTime>,
      blendAlpha = 0
    ) {
      const { boneMap } = rig;
      if (blendPose && blendAlpha > 0) {
        boneMap.Root.position.set(
          THREE.MathUtils.lerp(pose.rootPos[0], blendPose.rootPos[0], blendAlpha),
          THREE.MathUtils.lerp(pose.rootPos[1], blendPose.rootPos[1], blendAlpha),
          THREE.MathUtils.lerp(pose.rootPos[2], blendPose.rootPos[2], blendAlpha)
        );
        boneMap.Pelvis.position.set(
          THREE.MathUtils.lerp(pose.pelvisPos[0], blendPose.pelvisPos[0], blendAlpha),
          THREE.MathUtils.lerp(pose.pelvisPos[1], blendPose.pelvisPos[1], blendAlpha),
          THREE.MathUtils.lerp(pose.pelvisPos[2], blendPose.pelvisPos[2], blendAlpha)
        );
      } else {
        boneMap.Root.position.set(...pose.rootPos);
        boneMap.Pelvis.position.set(...pose.pelvisPos);
      }

      for (const def of BONE_DEFINITIONS) {
        const b = boneMap[def.name];
        const [rx, ry, rz] = pose.rotations[def.name];
        _euler.set(rx, ry, rz, 'XYZ');
        _quatA.setFromEuler(_euler);
        if (blendPose && blendAlpha > 0) {
          const [brx, bry, brz] = blendPose.rotations[def.name];
          _euler.set(brx, bry, brz, 'XYZ');
          _quatB.setFromEuler(_euler);
          _quatA.slerp(_quatB, blendAlpha);
        }
        b.quaternion.copy(_quatA);
      }

      const manual = stateRef.current.manualBoneOverride;
      if (manual) {
        const targetBone = boneMap[manual.bone];
        if (targetBone) {
          targetBone.rotation.set(manual.rx, manual.ry, manual.rz);
        }
      }
      rig.rootBone.updateMatrixWorld(true);
    }

    function tick() {
      if (unmounted) return;
      const now = performance.now();
      const dt = Math.min(0.45, (now - lastTimestamp) / 1000);
      lastTimestamp = now;

      const st = stateRef.current;
      if (st.activeClipId !== lastActiveClipId) {
        lastActiveClipId = st.activeClipId;
        animElapsedSec = 0;
      }

      // Smoothly damp camera preset transitions
      if (cameraTransitionActiveRef.current) {
        const preset = CAMERA_PRESETS[st.cameraPreset];
        _targetCamPos.set(...preset.pos);
        _targetLookAt.set(...preset.target);
        const alpha = 1 - Math.exp(-8 * dt);
        camera.position.lerp(_targetCamPos, alpha);
        controls.target.lerp(_targetLookAt, alpha);
        if (camera.position.distanceToSquared(_targetCamPos) < 0.0005) {
          cameraTransitionActiveRef.current = false;
        }
      }
      controls.update();

      // Determine active animation or 8-Directional Blend Space / WASD input
      let activeDir: DirectionId = 'D01';
      let currentClipMeta =
        ANIMATION_CLIP_BY_ID[st.activeClipId] ?? ANIMATION_CLIP_BY_ID['WLK_D01'];
      let renderedCycleTime = 0;

      // Check WASD / Arrow keys override
      let keyX = 0; // +1 = Right, -1 = Left
      let keyZ = 0; // +1 = Forward, -1 = Backward
      if (pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp')) keyZ += 1;
      if (pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown')) keyZ -= 1;
      if (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight')) keyX += 1;
      if (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft')) keyX -= 1;

      const hasKeyboardInput = keyX !== 0 || keyZ !== 0;

      if (st.blendModeActive || hasKeyboardInput) {
        const bx = hasKeyboardInput ? keyX : st.blendVector[0];
        const bz = hasKeyboardInput ? keyZ : st.blendVector[1];
        const mag = Math.hypot(bx, bz);

        if (mag < 0.12) {
          const idleMeta = ANIMATION_CLIP_BY_ID['IDL_NEUTRAL'];
          if (st.isPlaying) animElapsedSec += dt * st.playbackSpeed;
          const u = (animElapsedSec % idleMeta.duration) / idleMeta.duration;
          renderedCycleTime = u * idleMeta.duration;
          const pose = evaluateClipPoseAtNormalizedTime(idleMeta, u, false);
          applyPoseToBones(pose);
          activeDir = 'D01';
        } else {
          // Continuous 8-direction angular blending between the 2 nearest adjacent directions!
          // Angle in [0, 2PI) clockwise from Forward (+Z): atan2(bx, bz) where bx > 0 is Right
          let angle = Math.atan2(bx, bz);
          if (angle < 0) angle += Math.PI * 2;
          const sectorFloat = (angle / (Math.PI * 2)) * 8;
          const idxA = Math.floor(sectorFloat) % 8;
          const idxB = (idxA + 1) % 8;
          const alphaDir = sectorFloat - Math.floor(sectorFloat);

          const dirA = EIGHT_DIRECTIONS[idxA].id;
          const dirB = EIGHT_DIRECTIONS[idxB].id;
          activeDir = alphaDir < 0.5 ? dirA : dirB;

          const tier = hasKeyboardInput
            ? pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight')
              ? 'SPR'
              : 'RUN'
            : st.gaitTier;

          const clipA = ANIMATION_CLIP_BY_ID[`${tier}_${dirA}`] ?? ANIMATION_CLIP_BY_ID[`WLK_${dirA}`];
          const clipB = ANIMATION_CLIP_BY_ID[`${tier}_${dirB}`] ?? ANIMATION_CLIP_BY_ID[`WLK_${dirB}`];

          if (st.isPlaying) {
            animElapsedSec += dt * st.playbackSpeed * Math.min(1.3, 0.5 + mag * 0.7);
          }
          const u =
            st.scrubNormalizedTime !== null
              ? st.scrubNormalizedTime
              : (animElapsedSec % clipA.duration) / clipA.duration;
          renderedCycleTime = u * clipA.duration;

          const poseA = evaluateClipPoseAtNormalizedTime(clipA, u, st.rootMotion);
          const poseB = evaluateClipPoseAtNormalizedTime(clipB, u, st.rootMotion);
          applyPoseToBones(poseA, poseB, alphaDir);
          currentClipMeta = clipA;
        }
      } else {
        // Standard single-clip playback from the 25-Part Animation Library
        activeDir = currentClipMeta.direction ?? 'D01';
        if (st.isPlaying && st.scrubNormalizedTime === null) {
          animElapsedSec += dt * st.playbackSpeed;
        }
        const cycleTime =
          st.scrubNormalizedTime !== null
            ? st.scrubNormalizedTime * currentClipMeta.duration
            : currentClipMeta.loop
              ? animElapsedSec % currentClipMeta.duration
              : Math.min(currentClipMeta.duration, animElapsedSec % (currentClipMeta.duration + 0.15));
        renderedCycleTime = cycleTime;

        const u = Math.min(1, Math.max(0, cycleTime / currentClipMeta.duration));
        const pose = evaluateClipPoseAtNormalizedTime(currentClipMeta, u, st.rootMotion);
        applyPoseToBones(pose);
      }

      // Rotate floor direction vector arrow to match active direction
      if (dirArrowRef.current) {
        const dirSpec = DIRECTION_BY_ID[activeDir];
        // Since +Z is 0 rad and +X is Left, rotating around Y by -angleRad points toward [vectorXZ[0], vectorXZ[1]]
        dirArrowRef.current.rotation.y = Math.atan2(dirSpec.vectorXZ[0], dirSpec.vectorXZ[1]);
      }

      // Keep contact shadow beneath character's Pelvis XZ
      rig.boneMap.Pelvis.getWorldPosition(_vecA);
      contactShadowMesh.position.x = _vecA.x;
      contactShadowMesh.position.z = _vecA.z;

      // Throttled telemetry callback (<= 10Hz) so React never sets state at 60Hz
      if (now - lastTelemetryTime > 90 && telemetryCbRef.current) {
        lastTelemetryTime = now;
        telemetryCbRef.current(renderedCycleTime, currentClipMeta.duration, activeDir);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 1280;
      const h = container.clientHeight || 720;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };
    window.addEventListener('resize', onResize);

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="character-3d-viewport"
      className="w-full h-full relative overflow-hidden bg-[#0b0d12]"
      aria-label="3D Female Human Character and Eight-Directional Animation Viewport"
    />
  );
}
