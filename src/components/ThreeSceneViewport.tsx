import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  TelecomSite,
  SelectedEntityRef,
  Port,
  Equipment,
  Rack,
  FiberConnection,
} from '../types/telecom';

export type CameraPreset =
  | 'site_overview'
  | 'room_operator'
  | 'room_mmr'
  | 'room_client'
  | 'mmr_closeup';

interface ThreeSceneViewportProps {
  site: TelecomSite;
  selectedEntity: SelectedEntityRef | null;
  onSelectEntity: (entity: SelectedEntityRef | null) => void;
  highlightedFiberIds: string[];
  cameraPreset: CameraPreset;
  explodedFactor: number;
  pulseSpeed: number;
  showPathways: boolean;
  showLabels3D: boolean;
  patchingDraftSource: { equipmentId: string; portId: string } | null;
  onPortClickForPatching: (equipmentId: string, portId: string) => void;
  isPatchingMode: boolean;
}

interface HoverTooltip {
  x: number;
  y: number;
  badgeText: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  meta: string;
  accentColor: string;
}

interface PulseRunner {
  curve: THREE.CatmullRomCurve3;
  mesh: THREE.Mesh;
  hopIndex: number;
  totalHops: number;
  color: THREE.Color;
}

interface ExplodablePart {
  object: THREE.Object3D;
  baseY: number;
  explodeDeltaY: number;
}

// Pre-allocated math helpers at module scope (Zero GC in render loop)
const _vec3A = new THREE.Vector3();

function createLabelCanvasTexture(
  title: string,
  subtitle: string,
  accentHex: string,
  maxAnisotropy: number,
  width = 512,
  height = 128
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, width - 6, height - 6);

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, width, 14);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title.slice(0, 32), width / 2, height * 0.44);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 20px "IBM Plex Mono", monospace';
  ctx.fillText(subtitle.slice(0, 44), width / 2, height * 0.78);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

function createDatacenterTileTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 252);

  ctx.fillStyle = '#334155';
  const corners = [
    [6, 6],
    [244, 6],
    [6, 244],
    [244, 244],
  ];
  corners.forEach(([cx, cy]) => {
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
  });

  ctx.fillStyle = '#090d16';
  for (let gx = 32; gx <= 224; gx += 16) {
    for (let gy = 32; gy <= 224; gy += 16) {
      ctx.beginPath();
      ctx.arc(gx, gy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 14);
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export const ThreeSceneViewport: React.FC<ThreeSceneViewportProps> = ({
  site,
  selectedEntity,
  onSelectEntity,
  highlightedFiberIds,
  cameraPreset,
  explodedFactor,
  pulseSpeed,
  showPathways,
  showLabels3D,
  patchingDraftSource,
  onPortClickForPatching,
  isPatchingMode,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltip | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  const stateRef = useRef({
    site,
    selectedEntity,
    onSelectEntity,
    highlightedFiberIds,
    explodedFactor,
    pulseSpeed,
    showPathways,
    showLabels3D,
    patchingDraftSource,
    onPortClickForPatching,
    isPatchingMode,
  });

  useEffect(() => {
    stateRef.current = {
      site,
      selectedEntity,
      onSelectEntity,
      highlightedFiberIds,
      explodedFactor,
      pulseSpeed,
      showPathways,
      showLabels3D,
      patchingDraftSource,
      onPortClickForPatching,
      isPatchingMode,
    };
  }, [
    site,
    selectedEntity,
    onSelectEntity,
    highlightedFiberIds,
    explodedFactor,
    pulseSpeed,
    showPathways,
    showLabels3D,
    patchingDraftSource,
    onPortClickForPatching,
    isPatchingMode,
  ]);

  const cameraGoalRef = useRef<{
    pos: THREE.Vector3;
    target: THREE.Vector3;
    active: boolean;
  }>({
    pos: new THREE.Vector3(0, 7.8, 13.5),
    target: new THREE.Vector3(0, 1.1, 0),
    active: false,
  });

  const sceneObjectsRef = useRef<{
    scene: THREE.Scene | null;
    dynamicRoot: THREE.Group | null;
    renderer: THREE.WebGLRenderer | null;
    camera: THREE.PerspectiveCamera | null;
    controls: OrbitControls | null;
    interactables: THREE.Object3D[];
    pulseRunners: PulseRunner[];
    explodables: ExplodablePart[];
    pathwayGroup: THREE.Group | null;
    labelsGroup: THREE.Group | null;
    currentExploded: number;
  }>({
    scene: null,
    dynamicRoot: null,
    renderer: null,
    camera: null,
    controls: null,
    interactables: [],
    pulseRunners: [],
    explodables: [],
    pathwayGroup: null,
    labelsGroup: null,
    currentExploded: 0,
  });

  useEffect(() => {
    const goal = cameraGoalRef.current;
    if (cameraPreset === 'site_overview') {
      goal.pos.set(0, 7.8, 13.5);
      goal.target.set(0, 1.1, 0);
    } else if (cameraPreset === 'room_operator') {
      goal.pos.set(-7.5, 4.2, 6.8);
      goal.target.set(-7.5, 1.2, 0);
    } else if (cameraPreset === 'room_mmr') {
      goal.pos.set(0, 3.8, 5.8);
      goal.target.set(0, 1.3, -0.4);
    } else if (cameraPreset === 'room_client') {
      goal.pos.set(7.5, 4.2, 6.8);
      goal.target.set(7.5, 1.2, 0);
    } else if (cameraPreset === 'mmr_closeup') {
      goal.pos.set(0, 2.1, 2.9);
      goal.target.set(0, 1.55, -0.5);
    }
    goal.active = true;
  }, [cameraPreset]);

  useEffect(() => {
    if (!selectedEntity) return;
    const goal = cameraGoalRef.current;
    if (selectedEntity.kind === 'rack') {
      const rk = site.racks.find((r) => r.id === selectedEntity.id);
      if (rk) {
        goal.pos.set(rk.position3D[0], 2.2, rk.position3D[2] + 3.4);
        goal.target.set(rk.position3D[0], 1.2, rk.position3D[2]);
        goal.active = true;
      }
    } else if (selectedEntity.kind === 'room') {
      const rm = site.rooms.find((r) => r.id === selectedEntity.id);
      if (rm) {
        goal.pos.set(rm.bounds.x, 4.8, rm.bounds.z + 7.2);
        goal.target.set(rm.bounds.x, 1.2, rm.bounds.z);
        goal.active = true;
      }
    }
  }, [selectedEntity, site.racks, site.rooms]);

  // 1. Initialize WebGLRenderer & Scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.FogExp2(0x020617, 0.022);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 150);
    camera.position.set(0, 7.8, 13.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const handleContextRestored = () => {
      setWebglLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x0f172a, 0.85);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(12, 18, 14);
    keyLight.castShadow = !isHeadless;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 45;
    const d = 15;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    fillLight.position.set(-14, 10, -10);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 0.75);
    rimLight.position.set(0, 12, -16);
    scene.add(rimLight);

    const baseFloorGeo = new THREE.PlaneGeometry(60, 40);
    const baseFloorMat = new THREE.MeshStandardMaterial({
      color: 0x050914,
      roughness: 0.9,
      metalness: 0.1,
    });
    const baseFloor = new THREE.Mesh(baseFloorGeo, baseFloorMat);
    baseFloor.rotation.x = -Math.PI / 2;
    baseFloor.position.y = -0.04;
    baseFloor.receiveShadow = true;
    scene.add(baseFloor);

    const gridHelper = new THREE.GridHelper(44, 44, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -0.02;
    scene.add(gridHelper);

    const dynamicRoot = new THREE.Group();
    scene.add(dynamicRoot);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 1.2;
    controls.maxDistance = 32;
    controls.target.set(0, 1.1, 0);

    const stopCameraGoal = () => {
      cameraGoalRef.current.active = false;
    };
    controls.addEventListener('start', stopCameraGoal);

    sceneObjectsRef.current.scene = scene;
    sceneObjectsRef.current.dynamicRoot = dynamicRoot;
    sceneObjectsRef.current.renderer = renderer;
    sceneObjectsRef.current.camera = camera;
    sceneObjectsRef.current.controls = controls;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 40) return;
      lastHoverTime = now;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(sceneObjectsRef.current.interactables, false);

      if (hits.length > 0) {
        const hitObj = hits[0].object;
        const ud = hitObj.userData;
        renderer.domElement.style.cursor = 'pointer';
        setHoverTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          badgeText: ud.badgeText || 'COMPOSANT OPTIQUE OS2',
          badgeColor: ud.badgeColor || '#38bdf8',
          title: ud.title || 'Composant Télécom',
          subtitle: ud.subtitle || '',
          meta: ud.meta || '',
          accentColor: ud.accentColor || '#f59e0b',
        });
      } else {
        renderer.domElement.style.cursor = stateRef.current.isPatchingMode ? 'crosshair' : 'grab';
        setHoverTooltip(null);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(sceneObjectsRef.current.interactables, false);

      if (hits.length > 0) {
        const ud = hits[0].object.userData;
        if (ud.entityRef) {
          const ref = ud.entityRef as SelectedEntityRef;
          if (stateRef.current.isPatchingMode && ref.kind === 'port' && ref.equipmentId) {
            stateRef.current.onPortClickForPatching(ref.equipmentId, ref.id);
          } else {
            stateRef.current.onSelectEntity(ref);
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let animFrameId = 0;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      const goal = cameraGoalRef.current;
      if (goal.active) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, goal.pos.x, 4.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, goal.pos.y, 4.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, goal.pos.z, 4.5, delta);

        controls.target.x = THREE.MathUtils.damp(controls.target.x, goal.target.x, 5.5, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, goal.target.y, 5.5, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, goal.target.z, 5.5, delta);

        if (
          camera.position.distanceToSquared(goal.pos) < 0.002 &&
          controls.target.distanceToSquared(goal.target) < 0.002
        ) {
          goal.active = false;
        }
      }

      controls.update();

      const targetExplode = stateRef.current.explodedFactor;
      sceneObjectsRef.current.currentExploded = THREE.MathUtils.damp(
        sceneObjectsRef.current.currentExploded,
        targetExplode,
        6.0,
        delta
      );
      const curExp = sceneObjectsRef.current.currentExploded;
      const explodables = sceneObjectsRef.current.explodables;
      for (let i = 0; i < explodables.length; i++) {
        const item = explodables[i];
        item.object.position.y = item.baseY + item.explodeDeltaY * curExp;
      }

      if (sceneObjectsRef.current.pathwayGroup) {
        sceneObjectsRef.current.pathwayGroup.visible = stateRef.current.showPathways;
      }
      if (sceneObjectsRef.current.labelsGroup) {
        sceneObjectsRef.current.labelsGroup.visible = stateRef.current.showLabels3D;
      }

      const speed = stateRef.current.pulseSpeed;
      const runners = sceneObjectsRef.current.pulseRunners;
      for (let i = 0; i < runners.length; i++) {
        const runner = runners[i];
        if (speed <= 0.01) {
          runner.mesh.visible = false;
          continue;
        }
        runner.mesh.visible = true;
        const cycle = (elapsed * 0.55 * speed - runner.hopIndex * 0.25) % 1.0;
        const t = cycle < 0 ? cycle + 1.0 : cycle;
        runner.curve.getPointAt(t, _vec3A);
        runner.mesh.position.copy(_vec3A);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // 2. Rebuild Dynamic 3D Telecom Infrastructure whenever `site` or selection changes
  useEffect(() => {
    const { scene, dynamicRoot, renderer, camera } = sceneObjectsRef.current;
    if (!scene || !dynamicRoot || !renderer || !camera) return;

    while (dynamicRoot.children.length > 0) {
      const child = dynamicRoot.children[0];
      dynamicRoot.remove(child);
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      });
    }

    const interactables: THREE.Object3D[] = [];
    const pulseRunners: PulseRunner[] = [];
    const explodables: ExplodablePart[] = [];
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const tileTexture = createDatacenterTileTexture(maxAnisotropy);

    const highlightedSet = new Set(highlightedFiberIds);
    const hasActiveHighlight = highlightedSet.size > 0;

    const labelsGroup = new THREE.Group();
    dynamicRoot.add(labelsGroup);
    sceneObjectsRef.current.labelsGroup = labelsGroup;

    const pathwayGroup = new THREE.Group();
    dynamicRoot.add(pathwayGroup);
    sceneObjectsRef.current.pathwayGroup = pathwayGroup;

    const portWorldPositions = new Map<
      string,
      {
        posFront: THREE.Vector3;
        posRear: THREE.Vector3;
        rackPos: THREE.Vector3;
        rackWidth: number;
        rackDepth: number;
        rackId: string;
        roomId: string;
      }
    >();

    // =========================================================================
    // A. BUILD ROOMS (Salle Opérateur, Salle MMR, Salle Client)
    // =========================================================================
    site.rooms.forEach((room) => {
      const roomGroup = new THREE.Group();
      roomGroup.position.set(room.bounds.x, 0, room.bounds.z);
      dynamicRoot.add(roomGroup);

      const isSelected =
        selectedEntity?.kind === 'room' && selectedEntity.id === room.id;
      const roomColor = new THREE.Color(room.colorHex);

      const floorGeo = new THREE.BoxGeometry(room.bounds.width, 0.12, room.bounds.depth);
      const floorMat = new THREE.MeshStandardMaterial({
        map: tileTexture,
        color: isSelected ? 0x1e293b : 0x0f172a,
        roughness: 0.45,
        metalness: 0.3,
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.position.y = -0.06;
      floorMesh.receiveShadow = true;
      floorMesh.userData = {
        badgeText:
          room.type === 'mmr'
            ? 'ZONE ACCÈS EXCLUSIF HÉBERGEUR TIERS'
            : `SALLE TÉLÉCOM (${room.code})`,
        badgeColor: room.colorHex,
        title: room.name,
        subtitle: `${room.accessRestriction}`,
        meta: room.description,
        accentColor: room.colorHex,
        entityRef: { kind: 'room', id: room.id } as SelectedEntityRef,
      };
      roomGroup.add(floorMesh);
      interactables.push(floorMesh);

      const borderGeo = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(room.bounds.width + 0.04, 0.14, room.bounds.depth + 0.04)
      );
      const borderMat = new THREE.LineBasicMaterial({
        color: roomColor,
        transparent: true,
        opacity: isSelected ? 1.0 : 0.65,
      });
      const borderLines = new THREE.LineSegments(borderGeo, borderMat);
      borderLines.position.y = -0.05;
      roomGroup.add(borderLines);

      const pillarGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.7, 16);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.25,
        metalness: 0.85,
      });
      const halfW = room.bounds.width / 2 - 0.1;
      const halfD = room.bounds.depth / 2 - 0.1;
      [
        [-halfW, -halfD],
        [halfW, -halfD],
        [-halfW, halfD],
        [halfW, halfD],
      ].forEach(([px, pz]) => {
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(px, 1.35, pz);
        pillar.castShadow = true;
        roomGroup.add(pillar);
      });

      const backGlassGeo = new THREE.BoxGeometry(room.bounds.width - 0.2, 2.5, 0.04);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: roomColor,
        transparent: true,
        opacity: 0.12,
        roughness: 0.1,
        metalness: 0.1,
        clearcoat: 1.0,
        depthWrite: false,
      });
      const backGlass = new THREE.Mesh(backGlassGeo, glassMat);
      backGlass.position.set(0, 1.25, -halfD);
      backGlass.renderOrder = 2;
      roomGroup.add(backGlass);

      const bannerSubtitle =
        room.type === 'mmr'
          ? 'ACCÈS EXCLUSIF HÉBERGEUR · CROSS-CONNECT OS2'
          : room.type === 'operator'
          ? 'BAIE SFR · DÉPART CÂBLE ROCADE 24FO VERS MMR'
          : 'BAIE CLIENT · DÉPART CÂBLE ROCADE 12FO VERS MMR';

      const bannerTex = createLabelCanvasTexture(
        room.name.toUpperCase(),
        bannerSubtitle,
        room.colorHex,
        maxAnisotropy,
        720,
        140
      );
      const bannerGeo = new THREE.BoxGeometry(3.8, 0.58, 0.06);
      const bannerSideMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.4,
        metalness: 0.7,
      });
      const bannerFrontMat = new THREE.MeshBasicMaterial({ map: bannerTex });
      const bannerMesh = new THREE.Mesh(bannerGeo, [
        bannerSideMat,
        bannerSideMat,
        bannerSideMat,
        bannerSideMat,
        bannerFrontMat,
        bannerFrontMat,
      ]);
      bannerMesh.position.set(room.bounds.x, 3.15, room.bounds.z - halfD);
      bannerMesh.userData = floorMesh.userData;
      labelsGroup.add(bannerMesh);
      interactables.push(bannerMesh);
      explodables.push({
        object: bannerMesh,
        baseY: 3.15,
        explodeDeltaY: 0.85,
      });
    });

    // =========================================================================
    // B. BUILD RACKS & EQUIPMENTS / TIROIRS OPTIQUES (24FO / 12FO)
    // =========================================================================
    site.racks.forEach((rack: Rack) => {
      const room = site.rooms.find((r) => r.id === rack.roomId);
      const rackGroup = new THREE.Group();
      rackGroup.position.set(rack.position3D[0], rack.position3D[1], rack.position3D[2]);
      rackGroup.rotation.y = rack.rotationY;
      dynamicRoot.add(rackGroup);

      const isRackSelected =
        selectedEntity?.kind === 'rack' && selectedEntity.id === rack.id;

      const rw = rack.widthM;
      const rd = rack.depthM;
      const rh = rack.heightM;

      const shadowPlaneGeo = new THREE.PlaneGeometry(rw + 0.35, rd + 0.35);
      const shadowPlaneMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      });
      const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = 0.005;
      rackGroup.add(shadowPlane);

      const plinthGeo = new THREE.BoxGeometry(rw, 0.08, rd);
      const frameMat = new THREE.MeshStandardMaterial({
        color: isRackSelected ? 0x334155 : 0x1e293b,
        roughness: 0.35,
        metalness: 0.82,
      });
      const plinthMesh = new THREE.Mesh(plinthGeo, frameMat);
      plinthMesh.position.y = 0.04;
      plinthMesh.castShadow = true;
      plinthMesh.receiveShadow = true;
      plinthMesh.userData = {
        badgeText: `BAIE TÉLÉCOM 42U (${rack.code})`,
        badgeColor: room?.colorHex || '#38bdf8',
        title: rack.name,
        subtitle: `Salle: ${room?.name || ''} · Hauteur ${rack.uTotal}U`,
        meta:
          rack.customAttributes[0]?.value ||
          'Cliquez pour inspecter les tiroirs optiques et équipements de cette baie',
        accentColor: room?.colorHex || '#38bdf8',
        entityRef: { kind: 'rack', id: rack.id } as SelectedEntityRef,
      };
      rackGroup.add(plinthMesh);
      interactables.push(plinthMesh);

      const postGeo = new THREE.BoxGeometry(0.045, rh - 0.14, 0.045);
      const postOffsets = [
        [-rw / 2 + 0.03, -rd / 2 + 0.03],
        [rw / 2 - 0.03, -rd / 2 + 0.03],
        [-rw / 2 + 0.03, rd / 2 - 0.03],
        [rw / 2 - 0.03, rd / 2 - 0.03],
      ];
      postOffsets.forEach(([px, pz]) => {
        const post = new THREE.Mesh(postGeo, frameMat);
        post.position.set(px, rh / 2, pz);
        post.castShadow = true;
        post.userData = plinthMesh.userData;
        rackGroup.add(post);
        interactables.push(post);
      });

      const roofGeo = new THREE.BoxGeometry(rw, 0.06, rd);
      const roofMesh = new THREE.Mesh(roofGeo, frameMat);
      roofMesh.position.y = rh - 0.03;
      roofMesh.castShadow = true;
      roofMesh.userData = plinthMesh.userData;
      rackGroup.add(roofMesh);
      interactables.push(roofMesh);

      // Front yellow cable entry funnel (for intra-room Jarretières)
      const funnelGeo = new THREE.BoxGeometry(0.18, 0.16, 0.18);
      const funnelMat = new THREE.MeshStandardMaterial({
        color: 0xeab308,
        roughness: 0.3,
        metalness: 0.4,
      });
      const funnelMesh = new THREE.Mesh(funnelGeo, funnelMat);
      funnelMesh.position.set(rw / 2 - 0.08, rh + 0.08, rd / 4);
      rackGroup.add(funnelMesh);

      // Rear blue/slate gland entry on rack roof (for Multi-Fiber Trunk Cables 12FO/24FO)
      const rearGlandGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.18, 16);
      const rearGlandMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.3,
        metalness: 0.7,
      });
      const rearGland = new THREE.Mesh(rearGlandGeo, rearGlandMat);
      rearGland.position.set(0, rh + 0.09, -rd / 2 + 0.14);
      rackGroup.add(rearGland);

      const goulotteGeo = new THREE.BoxGeometry(0.07, rh - 0.16, 0.12);
      const goulotteMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.6,
        metalness: 0.5,
      });
      [-rw / 2 - 0.04, rw / 2 + 0.04].forEach((gx) => {
        const goulotte = new THREE.Mesh(goulotteGeo, goulotteMat);
        goulotte.position.set(gx, rh / 2, rd / 2 - 0.08);
        rackGroup.add(goulotte);
      });

      const rackLabelTex = createLabelCanvasTexture(
        rack.code,
        `${rack.name.slice(0, 26)}`,
        room?.colorHex || '#38bdf8',
        maxAnisotropy,
        420,
        96
      );
      const rackSignGeo = new THREE.PlaneGeometry(rw * 0.96, 0.23);
      const rackSignMat = new THREE.MeshBasicMaterial({
        map: rackLabelTex,
        side: THREE.DoubleSide,
      });
      const rackSign = new THREE.Mesh(rackSignGeo, rackSignMat);
      rackSign.position.set(0, rh + 0.25, rd / 2);
      rackSign.userData = plinthMesh.userData;
      rackGroup.add(rackSign);
      interactables.push(rackSign);

      // Equipments & Tiroirs Optiques inside this Rack
      const rackEquipments = site.equipments.filter((eq) => eq.rackId === rack.id);

      rackEquipments.forEach((eq: Equipment) => {
        const eqGroup = new THREE.Group();
        const uUnitHeightM = (rh - 0.26) / rack.uTotal;
        const eqHeightM = Math.max(0.085, eq.uHeight * uUnitHeightM * 0.92);
        const baseY = 0.12 + (eq.uPosition - 1) * uUnitHeightM;

        eqGroup.position.set(0, baseY, 0);
        rackGroup.add(eqGroup);

        explodables.push({
          object: eqGroup,
          baseY,
          explodeDeltaY: (eq.uPosition / 42) * 0.35,
        });

        const isEqSelected =
          selectedEntity?.kind === 'equipment' && selectedEntity.id === eq.id;

        const chassisW = rw - 0.09;
        const chassisD = rd - 0.12;
        const chassisGeo = new THREE.BoxGeometry(chassisW, eqHeightM, chassisD);
        const chassisMat = new THREE.MeshStandardMaterial({
          color: isEqSelected ? 0x38bdf8 : new THREE.Color(eq.colorHex),
          roughness: 0.28,
          metalness: 0.78,
        });
        const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
        chassisMesh.castShadow = true;
        chassisMesh.receiveShadow = true;
        chassisMesh.userData = {
          badgeText:
            eq.category === 'patch_panel'
              ? `TIROIR OPTIQUE ${eq.trunkCapacity || 'OS2'}`
              : 'ÉQUIPEMENT ACTIF MONOMODE OS2',
          badgeColor: eq.category === 'patch_panel' ? '#0284c7' : '#10b981',
          title: `${eq.name}`,
          subtitle: `Code: ${eq.code} · Position U${eq.uPosition} (${eq.uHeight}U) · 100% OS2 Monomode`,
          meta:
            eq.category === 'patch_panel'
              ? `Face Arrière : Câble Rocade ${eq.trunkCapacity || 'Multi-FO'} (Hébergeur) · Face Avant : Ports Jarretières`
              : `${eq.manufacturer} ${eq.model} · Raccordé par Jarretière Optique OS2`,
          accentColor: eq.category === 'patch_panel' ? '#f59e0b' : '#10b981',
          entityRef: { kind: 'equipment', id: eq.id } as SelectedEntityRef,
        };
        eqGroup.add(chassisMesh);
        interactables.push(chassisMesh);

        // If this is a Patch Panel (Tiroir Optique 24FO / 12FO), add a Rear Breakout Box (Boîtier d'épanouissement arrière pour Câble Rocade)
        if (eq.category === 'patch_panel') {
          const rearBreakoutGeo = new THREE.BoxGeometry(0.18, eqHeightM * 0.85, 0.1);
          const rearBreakoutMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            roughness: 0.35,
            metalness: 0.7,
          });
          const rearBreakout = new THREE.Mesh(rearBreakoutGeo, rearBreakoutMat);
          rearBreakout.position.set(0, 0, -chassisD / 2 - 0.05);
          rearBreakout.userData = chassisMesh.userData;
          eqGroup.add(rearBreakout);
        }

        // Front Faceplate Bezel
        const bezelGeo = new THREE.BoxGeometry(chassisW + 0.02, eqHeightM * 0.92, 0.025);
        const bezelMat = new THREE.MeshStandardMaterial({
          color: eq.category === 'patch_panel' ? 0x090d16 : 0x0f172a,
          roughness: 0.4,
          metalness: 0.65,
        });
        const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
        bezelMesh.position.z = chassisD / 2 + 0.01;
        bezelMesh.userData = chassisMesh.userData;
        eqGroup.add(bezelMesh);
        interactables.push(bezelMesh);

        // Individual 3D Optical Ports along the Front Faceplate
        const portCount = eq.ports.length;
        const portSpanW = chassisW * 0.84;
        const portGeo = new THREE.BoxGeometry(0.036, Math.min(0.036, eqHeightM * 0.55), 0.038);

        eq.ports.forEach((port: Port, pIdx: number) => {
          const px =
            portCount > 1
              ? -portSpanW / 2 + (pIdx / (portCount - 1)) * portSpanW
              : 0;
          const py = -eqHeightM * 0.08;
          const pzFront = chassisD / 2 + 0.03;
          const pzRear = -chassisD / 2 - 0.08;

          const isPartOfHighlightedChain =
            port.connectedFiberId && highlightedSet.has(port.connectedFiberId);
          const isPatchDraftSource =
            patchingDraftSource?.equipmentId === eq.id &&
            patchingDraftSource?.portId === port.id;
          const isPortSelected =
            selectedEntity?.kind === 'port' && selectedEntity.id === port.id;

          let portHex = 0x475569;
          if (isPatchDraftSource || isPortSelected) {
            portHex = 0xf43f5e;
          } else if (isPartOfHighlightedChain) {
            portHex = 0xf59e0b;
          } else if (port.status === 'connected') {
            if (port.connector.includes('APC')) portHex = 0x10b981; // APC Green
            else portHex = 0x3b82f6; // UPC Blue
          }

          const portMat = new THREE.MeshStandardMaterial({
            color: portHex,
            emissive: isPartOfHighlightedChain || isPatchDraftSource ? portHex : 0x000000,
            emissiveIntensity: isPartOfHighlightedChain || isPatchDraftSource ? 0.65 : 0,
            roughness: 0.25,
            metalness: 0.5,
          });

          const portMesh = new THREE.Mesh(portGeo, portMat);
          portMesh.position.set(px, py, pzFront);
          portMesh.userData = {
            badgeText: `PORT OPTIQUE OS2 (${port.connector})`,
            badgeColor: port.connector.includes('APC') ? '#10b981' : '#3b82f6',
            title: `${eq.code} · ${port.label}`,
            subtitle: `Monomode OS2 (${port.wavelengthNm} nm) · État: ${
              port.status === 'connected' ? 'Connecté' : 'Libre'
            }`,
            meta: stateRef.current.isPatchingMode
              ? 'Mode Brassage : Cliquez pour raccorder une jarretière OS2 sur ce port'
              : 'Face Avant : Reçoit une Jarretière Optique (Mono-Fibre ou Bi-Fibre)',
            accentColor: isPartOfHighlightedChain ? '#f59e0b' : '#38bdf8',
            entityRef: {
              kind: 'port',
              id: port.id,
              equipmentId: eq.id,
            } as SelectedEntityRef,
          };

          eqGroup.add(portMesh);
          interactables.push(portMesh);

          const worldPosFront = new THREE.Vector3(
            rack.position3D[0] + px,
            rack.position3D[1] + baseY + py,
            rack.position3D[2] + pzFront
          );
          const worldPosRear = new THREE.Vector3(
            rack.position3D[0] + px * 0.25,
            rack.position3D[1] + baseY + py,
            rack.position3D[2] + pzRear
          );

          portWorldPositions.set(port.id, {
            posFront: worldPosFront,
            posRear: worldPosRear,
            rackPos: new THREE.Vector3(...rack.position3D),
            rackWidth: rw,
            rackDepth: rd,
            rackId: rack.id,
            roomId: rack.roomId,
          });
        });
      });
    });

    // =========================================================================
    // C. BUILD OVERHEAD CABLE PATHWAYS (Chemins de câblage FiberRunner)
    // =========================================================================
    site.pathways.forEach((pathway) => {
      if (pathway.waypoints.length < 2) return;
      const pwSubGroup = new THREE.Group();
      pathwayGroup.add(pwSubGroup);

      const isPwSelected =
        selectedEntity?.kind === 'pathway' && selectedEntity.id === pathway.id;
      const pwColor = new THREE.Color(pathway.colorHex);

      const trayMat = new THREE.MeshPhysicalMaterial({
        color: isPwSelected ? 0xfef08a : pwColor,
        roughness: 0.3,
        metalness: 0.2,
        clearcoat: 0.6,
        transparent: true,
        opacity: 0.72,
      });

      for (let i = 0; i < pathway.waypoints.length - 1; i++) {
        const pA = new THREE.Vector3(...pathway.waypoints[i]);
        const pB = new THREE.Vector3(...pathway.waypoints[i + 1]);
        const segLen = pA.distanceTo(pB);
        const mid = pA.clone().add(pB).multiplyScalar(0.5);

        const segGroup = new THREE.Group();
        segGroup.position.copy(mid);
        segGroup.lookAt(pB);

        const wM = pathway.widthCm / 100;
        const hM = pathway.heightCm / 100;

        const bottomGeo = new THREE.BoxGeometry(wM, 0.02, segLen + wM * 0.4);
        const bottomMesh = new THREE.Mesh(bottomGeo, trayMat);
        bottomMesh.userData = {
          badgeText: 'CHEMIN DE CÂBLAGE OPTIQUE',
          badgeColor: pathway.colorHex,
          title: pathway.name,
          subtitle: `Code: ${pathway.code} · Goulotte ${pathway.widthCm}x${pathway.heightCm} cm`,
          meta: pathway.customAttributes[0]?.value || `Capacité: ${pathway.capacityFibers} fibres`,
          accentColor: pathway.colorHex,
          entityRef: { kind: 'pathway', id: pathway.id } as SelectedEntityRef,
        };
        segGroup.add(bottomMesh);
        interactables.push(bottomMesh);

        const wallGeo = new THREE.BoxGeometry(0.02, hM, segLen + wM * 0.4);
        [-wM / 2 + 0.01, wM / 2 - 0.01].forEach((wx) => {
          const wall = new THREE.Mesh(wallGeo, trayMat);
          wall.position.set(wx, hM / 2, 0);
          wall.userData = bottomMesh.userData;
          segGroup.add(wall);
        });

        pwSubGroup.add(segGroup);
      }

      explodables.push({
        object: pwSubGroup,
        baseY: 0,
        explodeDeltaY: 0.65,
      });
    });

    // =========================================================================
    // D. BUILD DYNAMIC 3D CÂBLES ROCADES (24FO / 12FO) VS JARRETIÈRES (1FO / 2FO)
    // =========================================================================
    const pulseSphereGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const renderedTrunkBadges = new Set<string>();

    site.fibers.forEach((fiber: FiberConnection, fibIdx: number) => {
      const srcInfo = portWorldPositions.get(fiber.sourcePortId);
      const dstInfo = portWorldPositions.get(fiber.targetPortId);
      if (!srcInfo || !dstInfo) return;

      const isHighlighted = highlightedSet.has(fiber.id);
      const isSelected =
        selectedEntity?.kind === 'fiber' && selectedEntity.id === fiber.id;
      const dimmed = hasActiveHighlight && !isHighlighted && !isSelected;

      const isTrunkCable = fiber.kind === 'trunk_cable';
      const isBiFibre = fiber.polarity === 'Bi-Fibre (2FO Duplex)';

      const curvePoints: THREE.Vector3[] = [];

      if (isTrunkCable) {
        // =====================================================================
        // CÂBLE FIBRE OPTIQUE ROCADE (6FO, 12FO, 24FO, 48FO) — INTER-SALLES
        // Part de l'ARRIÈRE du tiroir optique (Baie SFR ou Baie Client) et va
        // vers l'ARRIÈRE du tiroir en Salle MMR via le chemin de câbles haut.
        // =====================================================================
        const pStart = srcInfo.posRear.clone();
        const pEnd = dstInfo.posRear.clone();
        const trunkTrayY = 2.52;
        const zSpine = -0.18;

        curvePoints.push(
          pStart,
          new THREE.Vector3(pStart.x, pStart.y, srcInfo.rackPos.z - srcInfo.rackDepth / 2 - 0.14),
          new THREE.Vector3(srcInfo.rackPos.x, 2.28, srcInfo.rackPos.z - srcInfo.rackDepth / 2 - 0.14),
          new THREE.Vector3(srcInfo.rackPos.x, trunkTrayY, zSpine),
          new THREE.Vector3((srcInfo.rackPos.x + dstInfo.rackPos.x) / 2, trunkTrayY, zSpine),
          new THREE.Vector3(dstInfo.rackPos.x, trunkTrayY, zSpine),
          new THREE.Vector3(dstInfo.rackPos.x, 2.28, dstInfo.rackPos.z - dstInfo.rackDepth / 2 - 0.14),
          new THREE.Vector3(pEnd.x, pEnd.y, dstInfo.rackPos.z - dstInfo.rackDepth / 2 - 0.14),
          pEnd
        );
      } else {
        // =====================================================================
        // JARRETIÈRE OPTIQUE SOUPLE (Intra-salle ou Cross-Connect MMR)
        // Branchée en FACE AVANT des équipements/tiroirs dans la même salle
        // =====================================================================
        const pStart = srcInfo.posFront.clone();
        const pEnd = dstInfo.posFront.clone();
        const laneOffset = ((fibIdx % 5) - 2) * 0.025;

        curvePoints.push(pStart);
        curvePoints.push(pStart.clone().add(new THREE.Vector3(0, 0, 0.11)));

        if (srcInfo.rackId === dstInfo.rackId) {
          // Jarretière dans la même baie (ex: Routeur SFR -> Tiroir SFR 24FO, ou Tiroir Client 12FO -> Routeur Client)
          const goulotteX = srcInfo.rackPos.x + srcInfo.rackWidth / 2 + 0.05;
          curvePoints.push(
            new THREE.Vector3(goulotteX, pStart.y, pStart.z + 0.13),
            new THREE.Vector3(
              goulotteX + 0.04,
              (pStart.y + pEnd.y) / 2,
              srcInfo.rackPos.z + srcInfo.rackDepth / 2 + 0.1
            ),
            new THREE.Vector3(goulotteX, pEnd.y, pEnd.z + 0.13)
          );
        } else {
          // Jarretière entre 2 baies de la MÊME SALLE (ex: Cross-Connect MMR entre Baie MMR-OP et Baie MMR-CLI)
          const goulotteXA = srcInfo.rackPos.x + srcInfo.rackWidth / 2 + 0.04;
          const goulotteXB = dstInfo.rackPos.x - dstInfo.rackWidth / 2 - 0.04;
          const trayY = 2.42 + laneOffset * 0.5;

          curvePoints.push(
            new THREE.Vector3(goulotteXA, pStart.y, pStart.z + 0.12),
            new THREE.Vector3(goulotteXA, 2.22, srcInfo.rackPos.z + 0.25),
            new THREE.Vector3(srcInfo.rackPos.x, trayY, 0.05 + laneOffset),
            new THREE.Vector3((srcInfo.rackPos.x + dstInfo.rackPos.x) / 2, trayY + 0.04, 0.05 + laneOffset),
            new THREE.Vector3(dstInfo.rackPos.x, trayY, 0.05 + laneOffset),
            new THREE.Vector3(goulotteXB, 2.22, dstInfo.rackPos.z + 0.25),
            new THREE.Vector3(goulotteXB, pEnd.y, pEnd.z + 0.12)
          );
        }

        curvePoints.push(pEnd.clone().add(new THREE.Vector3(0, 0, 0.11)));
        curvePoints.push(pEnd);
      }

      const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'centripetal', 0.25);
      const baseColor = new THREE.Color(fiber.JacketColorHex);

      const userDataPayload = {
        badgeText: isTrunkCable
          ? `CÂBLE FIBRE ROCADE ${fiber.trunkCapacity || '24FO'} (INTER-SALLES)`
          : fiber.kind === 'cross_connect_jumper'
          ? `JARRETIÈRE CROSS-CONNECT MMR (${fiber.polarity})`
          : `JARRETIÈRE OPTIQUE INTRA-SALLE (${fiber.polarity})`,
        badgeColor: isTrunkCable ? '#0284c7' : '#eab308',
        title: fiber.name,
        subtitle: `${fiber.code} · Monomode OS2 · ${fiber.polarity} · ${fiber.lengthMeters} m · -${fiber.attenuationDb} dB`,
        meta: `Responsabilité : ${fiber.responsibility}${
          fiber.activeStrandsUsed ? ` · ${fiber.activeStrandsUsed}` : ''
        }`,
        accentColor: fiber.JacketColorHex,
        entityRef: { kind: 'fiber', id: fiber.id } as SelectedEntityRef,
      };

      if (isTrunkCable) {
        // Thick Armored Multi-Fiber Trunk Cable (6FO / 12FO / 24FO / 48FO)
        const trunkRadius = isHighlighted || isSelected ? 0.042 : 0.032;
        const tubeGeo = new THREE.TubeGeometry(curve, 72, trunkRadius, 14, false);
        const tubeMat = new THREE.MeshStandardMaterial({
          color: baseColor,
          emissive: isHighlighted || isSelected ? baseColor : new THREE.Color(0x000000),
          emissiveIntensity: isHighlighted || isSelected ? 0.45 : 0,
          roughness: 0.35,
          metalness: 0.4,
          transparent: dimmed,
          opacity: dimmed ? 0.28 : 1.0,
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        tubeMesh.castShadow = !dimmed;
        tubeMesh.userData = userDataPayload;
        dynamicRoot.add(tubeMesh);
        interactables.push(tubeMesh);

        // Add yellow identification rings along the trunk cable so it looks unmistakably like an armored multi-FO cable
        const ringGeo = new THREE.CylinderGeometry(
          trunkRadius * 1.18,
          trunkRadius * 1.18,
          0.08,
          14
        );
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          roughness: 0.3,
          metalness: 0.3,
        });
        [0.25, 0.5, 0.75].forEach((tPos) => {
          const pt = curve.getPointAt(tPos);
          const tangent = curve.getTangentAt(tPos);
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.copy(pt);
          ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.normalize());
          ring.userData = userDataPayload;
          dynamicRoot.add(ring);
        });

        // Add a 3D floating callout label above each unique inter-room trunk span (Baie SFR 24FO & Baie Client 12FO)
        const spanKey = `${srcInfo.roomId}-${dstInfo.roomId}-${fiber.trunkCapacity}`;
        if (!renderedTrunkBadges.has(spanKey)) {
          renderedTrunkBadges.add(spanKey);
          const midPt = curve.getPointAt(0.5);
          const labelTex = createLabelCanvasTexture(
            `CÂBLE ROCADE ${fiber.trunkCapacity || '24FO'} OS2`,
            `Déployé par l'Hébergeur Tiers (Accès MMR)`,
            '#0284c7',
            maxAnisotropy,
            520,
            115
          );
          const signGeo = new THREE.PlaneGeometry(2.35, 0.46);
          const signMat = new THREE.MeshBasicMaterial({
            map: labelTex,
            side: THREE.DoubleSide,
          });
          const signMesh = new THREE.Mesh(signGeo, signMat);
          signMesh.position.set(midPt.x, midPt.y + 0.38, midPt.z);
          signMesh.userData = userDataPayload;
          labelsGroup.add(signMesh);
          interactables.push(signMesh);
          explodables.push({
            object: signMesh,
            baseY: midPt.y + 0.38,
            explodeDeltaY: 0.65,
          });
        }
      } else {
        // Thin Flexible Yellow OS2 Jarretière (Simplex 1FO or Duplex 2FO)
        const jarRadius = isHighlighted || isSelected ? 0.015 : 0.011;
        const tubeMat = new THREE.MeshStandardMaterial({
          color: baseColor,
          emissive: isHighlighted || isSelected ? baseColor : new THREE.Color(0x000000),
          emissiveIntensity: isHighlighted || isSelected ? 0.6 : 0,
          roughness: 0.25,
          metalness: 0.15,
          transparent: dimmed,
          opacity: dimmed ? 0.22 : 1.0,
        });

        if (isBiFibre) {
          // Bi-Fibre (2FO Duplex) -> Render twin parallel zipcord strands (Strand A TX + Strand B RX)
          [-0.012, 0.012].forEach((offsetX) => {
            const offsetPts = curvePoints.map(
              (pt) => new THREE.Vector3(pt.x + offsetX, pt.y, pt.z)
            );
            const subCurve = new THREE.CatmullRomCurve3(offsetPts, false, 'centripetal', 0.25);
            const subGeo = new THREE.TubeGeometry(subCurve, 56, jarRadius, 8, false);
            const subMesh = new THREE.Mesh(subGeo, tubeMat);
            subMesh.castShadow = !dimmed;
            subMesh.userData = userDataPayload;
            dynamicRoot.add(subMesh);
            interactables.push(subMesh);
          });
        } else {
          // Mono-Fibre (1FO Simplex BiDi) -> Single strand
          const singleGeo = new THREE.TubeGeometry(curve, 56, jarRadius * 1.15, 8, false);
          const singleMesh = new THREE.Mesh(singleGeo, tubeMat);
          singleMesh.castShadow = !dimmed;
          singleMesh.userData = userDataPayload;
          dynamicRoot.add(singleMesh);
          interactables.push(singleMesh);
        }
      }

      // Add glowing optical laser pulse runner if this fiber is part of the highlighted chain
      if (isHighlighted) {
        const hopIndex = highlightedFiberIds.indexOf(fiber.id);
        const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pulseMesh = new THREE.Mesh(pulseSphereGeo, pulseMat);

        const haloGeo = new THREE.SphereGeometry(0.1, 12, 12);
        const haloMat = new THREE.MeshBasicMaterial({
          color: baseColor,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        });
        const haloMesh = new THREE.Mesh(haloGeo, haloMat);
        pulseMesh.add(haloMesh);

        dynamicRoot.add(pulseMesh);
        pulseRunners.push({
          curve,
          mesh: pulseMesh,
          hopIndex: Math.max(0, hopIndex),
          totalHops: highlightedFiberIds.length,
          color: baseColor,
        });
      }
    });

    sceneObjectsRef.current.interactables = interactables;
    sceneObjectsRef.current.pulseRunners = pulseRunners;
    sceneObjectsRef.current.explodables = explodables;

    renderer.compile(scene, camera);
  }, [site, highlightedFiberIds, selectedEntity, patchingDraftSource]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      <div ref={mountRef} className="w-full h-full" />

      {webglLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 z-30 p-6 text-center">
          <p className="text-lg font-semibold text-slate-100 mb-2">
            Contexte graphique 3D temporairement suspendu
          </p>
          <p className="text-sm text-slate-400 max-w-md">
            Le moteur WebGL restaure les ressources matérielles ou vous pouvez basculer sur le Plan 2D &amp; Schéma Logique interactif.
          </p>
        </div>
      )}

      {/* Visual Legend differentiating Jarretière vs Câble Rocade in Top-Right corner of 3D Scene */}
      <div className="pointer-events-auto absolute top-4 right-6 z-20 bg-slate-900/95 border border-slate-800 rounded-xl px-4 py-3 shadow-xl max-w-xs space-y-2">
        <div className="text-xs font-bold text-slate-100">
          Distinction Physique (100% Monomode OS2)
        </div>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-start gap-2">
            <span className="w-3.5 h-2 rounded-xs bg-amber-400 mt-1 shrink-0" />
            <div>
              <span className="font-semibold text-amber-300">
                Jarretière Optique (1FO Mono ou 2FO Bi-Fibre)
              </span>
              <p className="text-slate-400 leading-tight">
                Face avant · Relie équipements/baies dans la <strong>même salle</strong> (ou Cross-Connect entre les 2 baies MMR).
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 pt-1 border-t border-slate-800/80">
            <span className="w-3.5 h-2.5 rounded-xs bg-sky-500 border border-amber-400 mt-1 shrink-0" />
            <div>
              <span className="font-semibold text-sky-400">
                Câble Fibre Rocade (6FO / 12FO / 24FO)
              </span>
              <p className="text-slate-400 leading-tight">
                Arrière tiroir · Relie <strong>Baie SFR (24FO)</strong> ou <strong>Baie Client (12FO)</strong> vers la <strong>Salle MMR</strong> (Déployé par l&apos;Hébergeur Tiers).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Raycast Hover Tooltip */}
      {hoverTooltip && (
        <div
          className="pointer-events-none absolute z-20 px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 shadow-xl max-w-sm"
          style={{
            left: Math.min(hoverTooltip.x + 16, window.innerWidth - 360),
            top: Math.max(hoverTooltip.y - 88, 16),
          }}
        >
          <div
            className="text-[10px] font-mono font-bold uppercase tracking-wider mb-0.5"
            style={{ color: hoverTooltip.badgeColor }}
          >
            {hoverTooltip.badgeText}
          </div>
          <div className="text-xs font-bold text-slate-100">{hoverTooltip.title}</div>
          {hoverTooltip.subtitle && (
            <p className="text-[11px] font-mono text-amber-400 tabular-nums leading-snug mt-0.5">
              {hoverTooltip.subtitle}
            </p>
          )}
          {hoverTooltip.meta && (
            <p className="text-[11px] text-slate-300 mt-1 leading-tight">
              {hoverTooltip.meta}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
