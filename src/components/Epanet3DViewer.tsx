/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  Compass,
  Play,
  Pause,
  AlertTriangle,
  Wrench,
  Radio,
  Gauge,
  CheckCircle2
} from 'lucide-react';
import { ISOMETRIC_HOTSPOTS, IsometricHotspot } from '../utils/dashboardData';

interface Epanet3DViewerProps {
  isSimulating: boolean;
  isolatedValves: string[];
  onToggleValve: (valveId: string) => void;
  selectedHotspotId?: string | null;
  onSelectHotspot: (hotspot: IsometricHotspot) => void;
  showSensors?: boolean;
  showValves?: boolean;
  showStress?: boolean;
  showDimensions?: boolean;
  className?: string;
}

// 3D Pipe definition
interface PipeDef {
  id: string;
  from: [number, number, number];
  to: [number, number, number];
  radius: number;
  color: number;
  label: string;
  isIsolatedSection?: boolean;
}

export const Epanet3DViewer: React.FC<Epanet3DViewerProps> = ({
  isSimulating,
  isolatedValves,
  onToggleValve,
  selectedHotspotId,
  onSelectHotspot,
  showSensors = true,
  showValves = true,
  showStress = true,
  showDimensions = true,
  className = ''
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [hoveredObject, setHoveredObject] = useState<{ id: string; label: string; type: string } | null>(null);
  const [cameraView, setCameraView] = useState<'isometric' | 'top' | 'leak' | 'pump'>('isometric');

  // Internal Three.js references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<number | null>(null);

  // Dynamic animated objects
  const sprayParticlesRef = useRef<THREE.Points | null>(null);
  const sprayVelocitiesRef = useRef<Float32Array | null>(null);
  const flowParticlesRef = useRef<THREE.InstancedMesh | null>(null);
  const flowPositionsRef = useRef<THREE.Vector3[]>([]);
  const flowTangentsRef = useRef<THREE.Vector3[]>([]);
  const flowProgressRef = useRef<Float32Array | null>(null);
  const pumpImpellerRef = useRef<THREE.Group | null>(null);
  const ruptureBeaconRef = useRef<THREE.Mesh | null>(null);
  const shockwaveRingsRef = useRef<THREE.Mesh[]>([]);
  const valveMeshesRef = useRef<Map<string, THREE.Group>>(new Map());

  // Camera animation target
  const targetCamPos = useRef<THREE.Vector3>(new THREE.Vector3(26, 22, 28));
  const targetControlsLookAt = useRef<THREE.Vector3>(new THREE.Vector3(4, 1.5, 2));

  // Detect software WebGL to balance visual fidelity vs rendering performance
  const isSoftwareGl = useRef<boolean>(false);

  // Pipe segments in 3D engineering coordinates
  const pipeSegments: PipeDef[] = [
    // Bulk Intake from R-1 (-30, 3, -10) to Header (-18, 1.5, -4)
    { id: 'P-INTAKE', from: [-30, 3, -10], to: [-18, 1.5, -4], radius: 0.8, color: 0x0284c7, label: '24" Bulk Intake Trunk' },
    // Intake header to Main Cross J-102 (-8, 1.5, 0)
    { id: 'P-MAIN-1', from: [-18, 1.5, -4], to: [-8, 1.5, 0], radius: 0.7, color: 0x0369a1, label: '20" Transmission Main' },
    // J-102 to Booster Pump PS-01 (-2, 1.5, 14)
    { id: 'P-PUMP-IN', from: [-8, 1.5, 0], to: [-2, 1.5, 14], radius: 0.6, color: 0x0ea5e9, label: '16" Pump Suction Feed' },
    // Pump discharge to South loop
    { id: 'P-PUMP-OUT', from: [2, 1.5, 14], to: [18, 1.5, 14], radius: 0.6, color: 0x0ea5e9, label: '16" Booster Discharge' },
    // North loop from J-102 to north feeder (-8, 1.5, -16)
    { id: 'P-NORTH-1', from: [-8, 1.5, 0], to: [-8, 1.5, -16], radius: 0.5, color: 0x38bdf8, label: '12" North Arterial Branch' },
    // North arterial spanning east
    { id: 'P-NORTH-2', from: [-8, 1.5, -16], to: [14, 1.5, -16], radius: 0.5, color: 0x38bdf8, label: '12" North Feeder Loop' },
    // North return to main header
    { id: 'P-NORTH-3', from: [14, 1.5, -16], to: [26, 1.5, 0], radius: 0.5, color: 0x38bdf8, label: '12" North Return' },
    // Core Arterial from J-102 to Valve V-108A (8, 1.5, 0)
    { id: 'P-ART-1', from: [-8, 1.5, 0], to: [8, 1.5, 0], radius: 0.65, color: 0x0284c7, label: '16" High-Pressure Arterial' },
    // Critical Section: Valve V-108A to Rupture Node J-108 (16, 1.5, 0)
    { id: 'P-RUPTURE-A', from: [8, 1.5, 0], to: [16, 1.5, 0], radius: 0.65, color: 0x0284c7, label: '16" Rupture Sector A', isIsolatedSection: true },
    // Critical Section: Rupture Node J-108 to Valve V-108B (24, 1.5, 0)
    { id: 'P-RUPTURE-B', from: [16, 1.5, 0], to: [24, 1.5, 0], radius: 0.65, color: 0x0284c7, label: '16" Rupture Sector B', isIsolatedSection: true },
    // Post-isolation downstream arterial
    { id: 'P-ART-2', from: [24, 1.5, 0], to: [32, 1.5, 0], radius: 0.6, color: 0x0369a1, label: '14" Downstream Distribution' },
    // South return connection
    { id: 'P-SOUTH-CONN', from: [18, 1.5, 14], to: [24, 1.5, 0], radius: 0.55, color: 0x0ea5e9, label: '14" South Loop Tie-In' }
  ];

  // Reusable hotspot coordinate mapper (3D coordinates)
  const getHotspot3DPos = useCallback((id: string): [number, number, number] => {
    switch (id) {
      case 'R-1': return [-30, 3, -10];
      case 'S-01': return [-18, 1.5, -4];
      case 'J-102': return [-8, 1.5, 0];
      case 'PS-01': return [0, 1.5, 14];
      case 'S-02': return [6, 1.5, 14];
      case 'S-03': return [0, 1.5, 0];
      case 'V-108A': return [8, 1.5, 0];
      case 'J-108': return [16, 1.5, 0];
      case 'V-108B': return [24, 1.5, 0];
      case 'S-04': return [16, 1.5, 14];
      case 'S-05': return [2, 1.5, -16];
      case 'S-06': return [30, 1.5, 0];
      default: return [0, 1.5, 0];
    }
  }, []);

  // Set camera view preset
  const handleSetCameraView = (view: 'isometric' | 'top' | 'leak' | 'pump') => {
    setCameraView(view);
    if (!controlsRef.current) return;

    if (view === 'isometric') {
      targetCamPos.current.set(26, 22, 28);
      targetControlsLookAt.current.set(4, 1.5, 2);
    } else if (view === 'top') {
      targetCamPos.current.set(4, 46, 2.1);
      targetControlsLookAt.current.set(4, 0, 2);
    } else if (view === 'leak') {
      targetCamPos.current.set(18, 7, 9);
      targetControlsLookAt.current.set(16, 1.5, 0);
    } else if (view === 'pump') {
      targetCamPos.current.set(4, 7, 22);
      targetControlsLookAt.current.set(0, 1.5, 14);
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const factor = direction === 'in' ? 0.8 : 1.25;
    const offset = new THREE.Vector3().subVectors(cameraRef.current.position, controlsRef.current.target);
    offset.multiplyScalar(factor);
    cameraRef.current.position.addVectors(controlsRef.current.target, offset);
    controlsRef.current.update();
  };

  const handleReset = () => {
    handleSetCameraView('isometric');
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(26, 22, 28);
      controlsRef.current.target.set(4, 1.5, 2);
      controlsRef.current.update();
    }
  };

  // Main Three.js Scene Setup & Lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Probe for software WebGL
    try {
      const glProbe = document.createElement('canvas').getContext('webgl2');
      if (glProbe) {
        const ext = glProbe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : glProbe.RENDERER;
        const gpu = String(glProbe.getParameter(param));
        glProbe.getExtension('WEBGL_lose_context')?.loseContext();
        isSoftwareGl.current = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } else {
        isSoftwareGl.current = true;
      }
    } catch {
      isSoftwareGl.current = true;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 2. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1120); // Deep industrial navy
    scene.fog = new THREE.FogExp2(0x0a1120, 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 250);
    camera.position.set(26, 22, 28);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl.current,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl.current ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl.current;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Studio Environment Lighting (RoomEnvironment PMREM)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 5. 3-Point Studio Lighting Rig
    const ambientLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(30, 45, 20);
    if (!isSoftwareGl.current) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 10;
      keyLight.shadow.camera.far = 120;
      keyLight.shadow.camera.left = -40;
      keyLight.shadow.camera.right = 40;
      keyLight.shadow.camera.top = 40;
      keyLight.shadow.camera.bottom = -40;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    fillLight.position.set(-25, 20, -25);
    scene.add(fillLight);

    // 6. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(4, 1.5, 2);
    controls.enableDamping = !isSoftwareGl.current;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Prevent dipping beneath floor
    controls.minDistance = 6;
    controls.maxDistance = 90;
    controlsRef.current = controls;

    // 7. Blueprint Grid & Foundation Ground
    const gridHelper = new THREE.GridHelper(80, 40, 0x0284c7, 0x1e293b);
    gridHelper.position.y = -0.02;
    scene.add(gridHelper);

    // Subtle coordinate tick axes
    const axesGroup = new THREE.Group();
    const axisMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.5 });
    const xPoints = [new THREE.Vector3(-40, 0, 0), new THREE.Vector3(40, 0, 0)];
    const zPoints = [new THREE.Vector3(0, 0, -40), new THREE.Vector3(0, 0, 40)];
    axesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(xPoints), axisMat));
    axesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(zPoints), axisMat));
    scene.add(axesGroup);

    // 8. Ground Contact Shadow Plane
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0b1329,
      roughness: 0.85,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = !isSoftwareGl.current;
    scene.add(ground);

    // 9. Build 3D Pipe Network Meshes
    const pipeGroup = new THREE.Group();
    scene.add(pipeGroup);

    const pipeMatNormal = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.75,
      roughness: 0.25
    });

    const pipeMatIsolated = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.5,
      roughness: 0.5
    });

    const flangeMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      metalness: 0.85,
      roughness: 0.2
    });

    // Generate cylinder meshes for each pipe
    pipeSegments.forEach(pipe => {
      const start = new THREE.Vector3(...pipe.from);
      const end = new THREE.Vector3(...pipe.to);
      const distance = start.distanceTo(end);
      const direction = new THREE.Vector3().subVectors(end, start).normalize();

      const cylinderGeo = new THREE.CylinderGeometry(pipe.radius, pipe.radius, distance, 24);
      const isIsolated = pipe.isIsolatedSection && isolatedValves.includes('V-108A') && isolatedValves.includes('V-108B');
      const cylinder = new THREE.Mesh(cylinderGeo, isIsolated ? pipeMatIsolated : pipeMatNormal);

      // Align cylinder between start and end
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      cylinder.position.copy(midpoint);
      cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      cylinder.castShadow = !isSoftwareGl.current;
      cylinder.receiveShadow = !isSoftwareGl.current;
      cylinder.userData = { id: pipe.id, label: pipe.label, type: 'Pipe Segment' };

      pipeGroup.add(cylinder);

      // Add flanged joint rings along long pipes
      const numFlanges = Math.max(1, Math.floor(distance / 6));
      for (let i = 1; i <= numFlanges; i++) {
        const t = i / (numFlanges + 1);
        const flangePos = new THREE.Vector3().lerpVectors(start, end, t);
        const flangeGeo = new THREE.CylinderGeometry(pipe.radius * 1.35, pipe.radius * 1.35, 0.25, 24);
        const flange = new THREE.Mesh(flangeGeo, flangeMat);
        flange.position.copy(flangePos);
        flange.quaternion.copy(cylinder.quaternion);
        pipeGroup.add(flange);
      }
    });

    // 10. Build 3D Storage Reservoir R-1 (Cylindrical tank at -30, 3, -10)
    const reservoirGroup = new THREE.Group();
    reservoirGroup.position.set(-30, 0, -10);

    // Concrete Plinth
    const plinthGeo = new THREE.CylinderGeometry(6.5, 7, 0.8, 32);
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 0.4;
    reservoirGroup.add(plinth);

    // Main Steel Shell
    const tankGeo = new THREE.CylinderGeometry(6, 6, 9, 32);
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.8,
      roughness: 0.25
    });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.y = 5.3;
    tank.castShadow = !isSoftwareGl.current;
    tank.userData = { id: 'R-1', label: 'Main Municipal Reservoir R-1', type: 'Storage Reservoir' };
    reservoirGroup.add(tank);

    // Dome Roof
    const domeGeo = new THREE.SphereGeometry(6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, metalness: 0.85, roughness: 0.2 });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 9.8;
    dome.rotation.x = Math.PI;
    reservoirGroup.add(dome);

    scene.add(reservoirGroup);

    // 11. Build 3D Booster Pump Station PS-01 (at 0, 1.5, 14)
    const pumpGroup = new THREE.Group();
    pumpGroup.position.set(0, 0, 14);

    // Concrete Mounting Foundation
    const pumpPad = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.6, 5),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
    );
    pumpPad.position.y = 0.3;
    pumpGroup.add(pumpPad);

    // Electric Motor Housing (Blue cylinder with cooling ribs)
    const motorGeo = new THREE.CylinderGeometry(1.2, 1.2, 3.2, 24);
    const motorMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.8, roughness: 0.3 });
    const motor = new THREE.Mesh(motorGeo, motorMat);
    motor.rotation.z = Math.PI / 2;
    motor.position.set(-1.2, 1.5, 0);
    motor.userData = { id: 'PS-01', label: 'Booster Pump Station PS-01', type: 'Booster Pump' };
    pumpGroup.add(motor);

    // Centrifugal Volute Casing (Spiral pump housing)
    const voluteGeo = new THREE.CylinderGeometry(1.8, 1.8, 1.2, 24);
    const voluteMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, metalness: 0.85, roughness: 0.2 });
    const volute = new THREE.Mesh(voluteGeo, voluteMat);
    volute.position.set(1.2, 1.5, 0);
    volute.userData = { id: 'PS-01', label: 'Booster Pump Station PS-01', type: 'Booster Pump' };
    pumpGroup.add(volute);

    // Rotating Impeller Indicator
    const impellerGroup = new THREE.Group();
    impellerGroup.position.set(1.2, 1.5, 0);
    const bladeGeo = new THREE.BoxGeometry(0.2, 1.4, 0.4);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.1 });
    const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
    const blade2 = blade1.clone();
    blade2.rotation.z = Math.PI / 2;
    impellerGroup.add(blade1, blade2);
    pumpGroup.add(impellerGroup);
    pumpImpellerRef.current = impellerGroup;

    scene.add(pumpGroup);

    // 12. Build 3D Isolation Gate Valves (V-108A at 8, 1.5, 0 and V-108B at 24, 1.5, 0)
    const createValveMesh = (id: string, x: number, y: number, z: number) => {
      const valveGroup = new THREE.Group();
      valveGroup.position.set(x, y, z);

      // Flanged Valve Body
      const bodyGeo = new THREE.BoxGeometry(1.6, 1.8, 1.6);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.8, roughness: 0.3 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.userData = { id, label: `Isolation Valve ${id}`, type: 'Isolation Valve' };
      valveGroup.add(body);

      // Valve Bonnet / Spindle
      const spindleGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 16);
      const spindleMat = new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.9, roughness: 0.2 });
      const spindle = new THREE.Mesh(spindleGeo, spindleMat);
      spindle.position.y = 1.3;
      valveGroup.add(spindle);

      // Valve Handwheel (Red wheel on top)
      const isIsolated = isolatedValves.includes(id);
      const wheelGeo = new THREE.TorusGeometry(0.8, 0.12, 12, 24);
      const wheelMat = new THREE.MeshStandardMaterial({
        color: isIsolated ? 0xf59e0b : 0xd97706,
        metalness: 0.85,
        roughness: 0.2
      });
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.y = 2.0;
      wheel.userData = { id, label: `Isolation Valve ${id}`, type: 'Isolation Valve' };
      valveGroup.add(wheel);

      // Cross spokes
      const spokeGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8);
      const spoke1 = new THREE.Mesh(spokeGeo, spindleMat);
      spoke1.rotation.z = Math.PI / 2;
      spoke1.position.y = 2.0;
      const spoke2 = spoke1.clone();
      spoke2.rotation.y = Math.PI / 2;
      valveGroup.add(spoke1, spoke2);

      valveMeshesRef.current.set(id, valveGroup);
      scene.add(valveGroup);
    };

    createValveMesh('V-108A', 8, 1.5, 0);
    createValveMesh('V-108B', 24, 1.5, 0);

    // 13. Build 3D Rupture Node J-108 (Target Rupture at 16, 1.5, 0)
    const ruptureGroup = new THREE.Group();
    ruptureGroup.position.set(16, 1.5, 0);

    // Tee Manifold
    const teeCrossGeo = new THREE.SphereGeometry(1.0, 24, 24);
    const teeCrossMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    const teeCross = new THREE.Mesh(teeCrossGeo, teeCrossMat);
    teeCross.userData = { id: 'J-108', label: 'Junction J-108 (Target Rupture)', type: 'Rupture Junction' };
    ruptureGroup.add(teeCross);

    // Flanged branch stub pointing upwards
    const branchStubGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.8, 16);
    const branchStub = new THREE.Mesh(branchStubGeo, teeCrossMat);
    branchStub.position.y = 0.7;
    ruptureGroup.add(branchStub);

    // Red Stress Beacon Sphere
    const beaconGeo = new THREE.SphereGeometry(1.6, 24, 24);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.35,
      wireframe: true
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 1.0;
    ruptureBeaconRef.current = beacon;
    ruptureGroup.add(beacon);

    // Concentric shockwave ripple rings
    shockwaveRingsRef.current = [];
    for (let r = 0; r < 3; r++) {
      const ringGeo = new THREE.RingGeometry(1.2 + r * 0.8, 1.4 + r * 0.8, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf87171,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      ruptureGroup.add(ring);
      shockwaveRingsRef.current.push(ring);
    }

    scene.add(ruptureGroup);

    // 14. Animated Water Spray Particles at Node J-108 (when simulation is active)
    const particleCount = 200;
    const sprayGeo = new THREE.BufferGeometry();
    const sprayPositions = new Float32Array(particleCount * 3);
    const sprayVelocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      sprayPositions[i * 3] = 16 + (Math.random() - 0.5) * 0.4;
      sprayPositions[i * 3 + 1] = 2.0;
      sprayPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;

      sprayVelocities[i * 3] = (Math.random() - 0.5) * 4.5;
      sprayVelocities[i * 3 + 1] = 6.0 + Math.random() * 8.0; // Strong upward jet
      sprayVelocities[i * 3 + 2] = (Math.random() - 0.5) * 4.5;
    }

    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPositions, 3));
    sprayVelocitiesRef.current = sprayVelocities;

    const sprayMat = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.35,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    const sprayPoints = new THREE.Points(sprayGeo, sprayMat);
    sprayPoints.visible = isSimulating && !(isolatedValves.includes('V-108A') && isolatedValves.includes('V-108B'));
    sprayParticlesRef.current = sprayPoints;
    scene.add(sprayPoints);

    // 15. Animated Water Flow Pulses (Traveling through pipes)
    const flowCount = 120;
    const flowMeshGeo = new THREE.SphereGeometry(0.22, 12, 12);
    const flowMeshMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.95
    });

    const flowInstancedMesh = new THREE.InstancedMesh(flowMeshGeo, flowMeshMat, flowCount);
    flowInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    flowParticlesRef.current = flowInstancedMesh;
    scene.add(flowInstancedMesh);

    // Assign each flow particle to a random pipe segment and position
    const flowPositions: THREE.Vector3[] = [];
    const flowTangents: THREE.Vector3[] = [];
    const flowProgress = new Float32Array(flowCount);

    for (let i = 0; i < flowCount; i++) {
      const pipeIdx = i % pipeSegments.length;
      const pipe = pipeSegments[pipeIdx];
      const start = new THREE.Vector3(...pipe.from);
      const end = new THREE.Vector3(...pipe.to);
      const tangent = new THREE.Vector3().subVectors(end, start).normalize();
      const progress = Math.random();

      flowPositions.push(new THREE.Vector3().lerpVectors(start, end, progress));
      flowTangents.push(tangent);
      flowProgress[i] = progress;
    }

    flowPositionsRef.current = flowPositions;
    flowTangentsRef.current = flowTangents;
    flowProgressRef.current = flowProgress;

    // 16. Build 3D Sensors (S-01 to S-06)
    const sensorGroup = new THREE.Group();
    scene.add(sensorGroup);

    const sensorIds = ['S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06'];
    sensorIds.forEach(id => {
      const [x, y, z] = getHotspot3DPos(id);
      const sensorPod = new THREE.Group();
      sensorPod.position.set(x, y + 0.6, z);

      // Clamping Ring
      const clampGeo = new THREE.TorusGeometry(0.8, 0.1, 8, 16);
      const clampMat = new THREE.MeshStandardMaterial({ color: 0x059669, metalness: 0.7, roughness: 0.3 });
      const clamp = new THREE.Mesh(clampGeo, clampMat);
      clamp.rotation.x = Math.PI / 2;
      sensorPod.add(clamp);

      // Sensor Body (Electronics enclosure)
      const encGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.7, 16);
      const encMat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.6, roughness: 0.2 });
      const enc = new THREE.Mesh(encGeo, encMat);
      enc.position.y = 0.55;
      enc.userData = { id, label: `Sensor ${id}`, type: 'IoT Telemetry Logger' };
      sensorPod.add(enc);

      // Antenna Mast
      const mastGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
      const mastMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
      const mast = new THREE.Mesh(mastGeo, mastMat);
      mast.position.y = 1.25;
      sensorPod.add(mast);

      // Pulsing Status LED
      const ledGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(0, 0.8, 0.36);
      sensorPod.add(led);

      sensorGroup.add(sensorPod);
    });

    // 17. Raycaster for clicking 3D elements
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      let found: { id: string; label: string; type: string } | null = null;
      for (const hit of intersects) {
        if (hit.object.userData && hit.object.userData.id) {
          found = hit.object.userData as { id: string; label: string; type: string };
          break;
        }
      }
      setHoveredObject(found);
    };

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        if (hit.object.userData && hit.object.userData.id) {
          const clickedId = hit.object.userData.id;
          const hotspot = ISOMETRIC_HOTSPOTS.find(h => h.id === clickedId);
          if (hotspot) {
            onSelectHotspot(hotspot);
          }
          if (clickedId === 'V-108A' || clickedId === 'V-108B') {
            onToggleValve(clickedId);
          }
          break;
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousemove', handlePointerMove);
    domElement.addEventListener('click', handleClick);

    // 18. Window Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 19. Animation Loop with Software-WebGL Guard
    const clock = new THREE.Clock();
    const tempMatrix = new THREE.Matrix4();
    const tempPos = new THREE.Vector3();
    const tempScale = new THREE.Vector3(1, 1, 1);
    const tempQuat = new THREE.Quaternion();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          timeoutIdRef.current = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          timeoutIdRef.current = window.setTimeout(cb, 60);
        }
      };
      timeoutIdRef.current = window.setTimeout(poll, 5);
    }

    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsedTime = clock.getElapsedTime();

      // Camera smooth target transitions
      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamPos.current.x, 3.5, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamPos.current.y, 3.5, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamPos.current.z, 3.5, delta);

      controls.target.x = THREE.MathUtils.damp(controls.target.x, targetControlsLookAt.current.x, 3.5, delta);
      controls.target.y = THREE.MathUtils.damp(controls.target.y, targetControlsLookAt.current.y, 3.5, delta);
      controls.target.z = THREE.MathUtils.damp(controls.target.z, targetControlsLookAt.current.z, 3.5, delta);

      // Auto-rotation when toggled
      if (autoRotate) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.5;
      } else {
        controls.autoRotate = false;
      }
      controls.update();

      // Rotate Booster Pump Impeller
      if (pumpImpellerRef.current) {
        pumpImpellerRef.current.rotation.x += delta * 18.0;
      }

      // Animate Rupture Water Spray Particles
      if (sprayParticlesRef.current && sprayVelocitiesRef.current && isSimulating) {
        const positions = sprayParticlesRef.current.geometry.attributes.position.array as Float32Array;
        const velocities = sprayVelocitiesRef.current;
        const isIsolated = isolatedValves.includes('V-108A') && isolatedValves.includes('V-108B');

        sprayParticlesRef.current.visible = !isIsolated;

        if (!isIsolated) {
          for (let i = 0; i < particleCount; i++) {
            // Apply velocities & gravity
            positions[i * 3] += velocities[i * 3] * delta;
            positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
            positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;

            velocities[i * 3 + 1] -= 9.8 * delta; // Gravity

            // Reset particle when it drops to ground or spreads too far
            if (positions[i * 3 + 1] < 0.2 || Math.abs(positions[i * 3] - 16) > 6) {
              positions[i * 3] = 16 + (Math.random() - 0.5) * 0.3;
              positions[i * 3 + 1] = 2.0;
              positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;

              velocities[i * 3] = (Math.random() - 0.5) * 4.5;
              velocities[i * 3 + 1] = 5.0 + Math.random() * 7.0;
              velocities[i * 3 + 2] = (Math.random() - 0.5) * 4.5;
            }
          }
          sprayParticlesRef.current.geometry.attributes.position.needsUpdate = true;
        }
      }

      // Animate Rupture Stress Beacon & Concentric Shockwaves
      if (ruptureBeaconRef.current && isSimulating) {
        const scale = 1.0 + Math.sin(elapsedTime * 6) * 0.25;
        ruptureBeaconRef.current.scale.set(scale, scale, scale);
      }

      shockwaveRingsRef.current.forEach((ring, idx) => {
        if (!isSimulating) {
          ring.visible = false;
        } else {
          ring.visible = true;
          const cycle = (elapsedTime * 1.5 + idx * 0.33) % 1.0;
          ring.scale.set(1.0 + cycle * 2.2, 1.0 + cycle * 2.2, 1.0);
          (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 * (1.0 - cycle));
        }
      });

      // Animate Flow Particles along pipe conduits
      if (flowParticlesRef.current && flowProgressRef.current) {
        const isIsolated = isolatedValves.includes('V-108A') && isolatedValves.includes('V-108B');
        const speed = isSimulating ? 0.38 : 0.22;

        for (let i = 0; i < flowCount; i++) {
          const pipeIdx = i % pipeSegments.length;
          const pipe = pipeSegments[pipeIdx];

          // If pipe is isolated, freeze particles in place
          if (pipe.isIsolatedSection && isIsolated) {
            continue;
          }

          flowProgressRef.current[i] = (flowProgressRef.current[i] + delta * speed) % 1.0;
          const progress = flowProgressRef.current[i];

          const start = new THREE.Vector3(...pipe.from);
          const end = new THREE.Vector3(...pipe.to);
          tempPos.lerpVectors(start, end, progress);

          // Subtle radial jitter within pipe diameter
          tempMatrix.compose(tempPos, tempQuat, tempScale);
          flowParticlesRef.current.setMatrixAt(i, tempMatrix);
        }
        flowParticlesRef.current.instanceMatrix.needsUpdate = true;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl.current) {
        afterDraw(tick);
      } else {
        animFrameIdRef.current = requestAnimationFrame(tick);
      }
    };

    tick();

    // Cleanup on unmount
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('mousemove', handlePointerMove);
      domElement.removeEventListener('click', handleClick);

      renderer.dispose();
      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
    };
  }, [isolatedValves, isSimulating, onSelectHotspot, onToggleValve, autoRotate, getHotspot3DPos]);

  // Sync isolated valve meshes
  useEffect(() => {
    valveMeshesRef.current.forEach((mesh, id) => {
      const isIsolated = isolatedValves.includes(id);
      mesh.traverse(child => {
        if (child instanceof THREE.Mesh && child.geometry instanceof THREE.TorusGeometry) {
          (child.material as THREE.MeshStandardMaterial).color.setHex(isIsolated ? 0xf59e0b : 0xd97706);
          child.rotation.z = isIsolated ? Math.PI / 4 : 0;
        }
      });
    });
  }, [isolatedValves]);

  return (
    <div className={`relative w-full rounded-lg overflow-hidden bg-slate-950 border border-gray-300 shadow-inner flex flex-col ${className}`}>
      {/* 3D WebGL Canvas Container */}
      <div
        ref={mountRef}
        className="relative w-full aspect-16/10 cursor-grab active:cursor-grabbing select-none"
      />

      {/* Top Floating Overlay: View Presets & Zoom Dock */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
        {/* Camera Views Selector */}
        <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/90 backdrop-blur-xs border border-slate-700/80 p-1 rounded-md text-xs shadow-md">
          <button
            onClick={() => handleSetCameraView('isometric')}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
              cameraView === 'isometric' ? 'bg-blue-600 text-white font-bold' : 'text-gray-300 hover:text-white'
            }`}
            title="Isometric 3D Perspective"
          >
            <Compass className="w-3 h-3" />
            <span>ISO 3D</span>
          </button>
          <button
            onClick={() => handleSetCameraView('top')}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
              cameraView === 'top' ? 'bg-blue-600 text-white font-bold' : 'text-gray-300 hover:text-white'
            }`}
            title="Top-Down Plan View"
          >
            <Eye className="w-3 h-3" />
            <span>Top Plan</span>
          </button>
          <button
            onClick={() => handleSetCameraView('leak')}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
              cameraView === 'leak' ? 'bg-red-600 text-white font-bold' : 'text-gray-300 hover:text-white'
            }`}
            title="Focus on Rupture Node J-108"
          >
            <AlertTriangle className="w-3 h-3 text-red-300" />
            <span>Rupture J-108</span>
          </button>
          <button
            onClick={() => handleSetCameraView('pump')}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
              cameraView === 'pump' ? 'bg-blue-600 text-white font-bold' : 'text-gray-300 hover:text-white'
            }`}
            title="Focus on Booster Pump PS-01"
          >
            <Gauge className="w-3 h-3 text-cyan-300" />
            <span>Pump PS-01</span>
          </button>
        </div>

        {/* 3D Navigation & Zoom Dock */}
        <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/90 backdrop-blur-xs border border-slate-700/80 p-1 rounded-md text-xs shadow-md">
          {/* Auto Rotate Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              autoRotate ? 'bg-emerald-600 text-white' : 'text-gray-300 hover:text-white'
            }`}
            title={autoRotate ? 'Stop 360° Rotation' : 'Start 360° Auto-Rotation'}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <div className="w-px h-4 bg-slate-700 mx-0.5" />

          {/* Zoom In */}
          <button
            onClick={() => handleZoom('in')}
            className="p-1.5 text-gray-300 hover:text-white rounded cursor-pointer transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Out */}
          <button
            onClick={() => handleZoom('out')}
            className="p-1.5 text-gray-300 hover:text-white rounded cursor-pointer transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleReset}
            className="p-1.5 text-gray-300 hover:text-white rounded cursor-pointer transition-colors"
            title="Reset 3D Orientation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hover Inspection Tooltip */}
      {hoveredObject && (
        <div className="absolute top-16 left-4 bg-slate-900/95 text-white border border-slate-700 px-3 py-1.5 rounded-md shadow-xl text-xs pointer-events-none flex items-center gap-2 animate-fade-in z-30">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <div>
            <div className="font-bold text-cyan-200">{hoveredObject.label}</div>
            <div className="text-[10px] text-gray-400">{hoveredObject.type} • Click to inspect telemetry</div>
          </div>
        </div>
      )}

      {/* Bottom HUD: 3D Mouse & Touch Interaction Guide */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-gray-400 pointer-events-none">
        <div className="bg-slate-900/85 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-800 text-gray-300 flex items-center gap-3">
          <span><strong className="text-white">Left Drag:</strong> Rotate 360°</span>
          <span><strong className="text-white">Scroll / Pinch:</strong> Zoom In / Out</span>
          <span><strong className="text-white">Right Drag:</strong> Pan</span>
          <span><strong className="text-white">Click Object:</strong> Telemetry</span>
        </div>

        {/* Real-time Dynamic Water Flow Status */}
        <div className="bg-slate-900/85 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-800 flex items-center gap-2">
          {isSimulating ? (
            isolatedValves.includes('V-108A') && isolatedValves.includes('V-108B') ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                VALVES ISOLATED • ZERO OUTFLOW
              </span>
            ) : (
              <span className="text-red-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                ACTIVE WATER SPRAY AT J-108 (85 L/s)
              </span>
            )
          ) : (
            <span className="text-cyan-400 font-medium">
              EPANET HYDRAULIC 3D TWIN • NOMINAL FLOW
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
