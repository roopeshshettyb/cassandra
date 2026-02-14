import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DeviceCapabilities } from '../types';

interface UseThreeSceneProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  avatarUrl: string;
  animationPaths?: {
    idle: string;
    talking: string;
    waving: string;
    thinking: string;
  };
  deviceCapabilities: DeviceCapabilities;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  backgroundColor?: string;
}

interface SceneRefs {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  controls: OrbitControls | null;
  avatar: THREE.Object3D | null;
  meshes: {
    visemeMeshes: THREE.Mesh[];
    blinkMeshes: THREE.Mesh[];
    teeth: THREE.Mesh | null;
    eyeLeft: THREE.Mesh | null;
    eyeRight: THREE.Mesh | null;
  };
  bones: {
    leftEye: THREE.Bone | null;
    rightEye: THREE.Bone | null;
    neck: THREE.Bone | null;
    head: THREE.Bone | null;
    spine: THREE.Bone | null;
  };
  mixer: THREE.AnimationMixer | null;
  animationId: number | null;
  clock: THREE.Clock;
  actions: {
    waving: THREE.AnimationAction | null;
    idle: THREE.AnimationAction | null;
    talking: THREE.AnimationAction | null;
    thinking: THREE.AnimationAction | null;
  };
  currentAction: THREE.AnimationAction | null;
  hasPlayedWaving: boolean;
  isInitialized: boolean;
  initialRotations: {
    head: THREE.Euler | null;
    neck: THREE.Euler | null;
    leftEye: THREE.Euler | null;
    rightEye: THREE.Euler | null;
  };
  blinkState: {
    isBlinking: boolean;
    blinkStartTime: number;
    nextBlinkTime: number;
    duration: number;
  };
  mouse: THREE.Vector2;
}

export function useThreeScene({ containerRef, avatarUrl, animationPaths, deviceCapabilities, onLoad, onError, backgroundColor }: UseThreeSceneProps) {
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);

  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  const sceneRefs = useRef<SceneRefs>({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    avatar: null,
    meshes: { visemeMeshes: [], blinkMeshes: [], teeth: null, eyeLeft: null, eyeRight: null },
    bones: { leftEye: null, rightEye: null, neck: null, head: null, spine: null },
    mixer: null,
    animationId: null,
    clock: new THREE.Clock(),
    actions: { waving: null, idle: null, talking: null, thinking: null },
    currentAction: null,
    hasPlayedWaving: false,
    isInitialized: false,
    initialRotations: { head: null, neck: null, leftEye: null, rightEye: null },
    blinkState: { isBlinking: false, blinkStartTime: 0, nextBlinkTime: 0, duration: 200 },
    mouse: new THREE.Vector2(),
  });

  const extractAnimationClip = useCallback((fbx: THREE.Group): THREE.AnimationClip | null => {
    if (fbx.animations && fbx.animations.length > 0) return fbx.animations[0];
    let foundClip: THREE.AnimationClip | null = null;
    fbx.traverse((child: any) => {
      if (!foundClip && child.animations && child.animations.length > 0) foundClip = child.animations[0];
    });
    return foundClip;
  }, []);

  const crossFadeTo = useCallback((toAction: THREE.AnimationAction | null, duration = 0.3) => {
    if (!toAction) return;
    const fromAction = sceneRefs.current.currentAction;
    toAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (fromAction && fromAction !== toAction) fromAction.crossFadeTo(toAction, duration, true);
    sceneRefs.current.currentAction = toAction;
  }, []);

  const playTalking = useCallback(() => {
    if (sceneRefs.current.actions.talking) {
      crossFadeTo(sceneRefs.current.actions.talking, 0.4);
    }
  }, [crossFadeTo]);

  const playIdle = useCallback(() => {
    if (sceneRefs.current.actions.idle) {
      crossFadeTo(sceneRefs.current.actions.idle, 0.6);
    }
  }, [crossFadeTo]);

  const playWaving = useCallback(() => {
    if (sceneRefs.current.actions.waving) {
      crossFadeTo(sceneRefs.current.actions.waving, 0.4);
    }
  }, [crossFadeTo]);

  const playThinking = useCallback(() => {
    if (sceneRefs.current.actions.thinking) {
      crossFadeTo(sceneRefs.current.actions.thinking, 0.5);
    }
  }, [crossFadeTo]);

  const setLipSync = useCallback((value: number) => {
    const { visemeMeshes } = sceneRefs.current.meshes;
    visemeMeshes.forEach((mesh) => {
      if (mesh.morphTargetInfluences && mesh.morphTargetDictionary) {
        // Try standard RPM visemes first, then fallbacks
        const candidates = ['viseme_aa', 'mouthOpen', 'jawOpen', 'A'];
        for (const name of candidates) {
          const idx = mesh.morphTargetDictionary[name];
          if (idx !== undefined) {
            mesh.morphTargetInfluences[idx] = value;
            break; // Use the first valid target found
          }
        }
      }
    });
  }, []);

  const resetCamera = useCallback(() => {
    const { camera, controls } = sceneRefs.current;
    if (!camera || !controls) return;

    const { isMobile, isTablet } = deviceCapabilities;
    let cameraZ = 1.2;
    if (isMobile) cameraZ = 1.6;
    else if (isTablet) cameraZ = 1.4;

    camera.position.set(0, 0, cameraZ);
    controls.target.set(0, 0, 0);
    controls.update();
  }, [deviceCapabilities]);

  useEffect(() => {
    if (sceneRefs.current.isInitialized) return;
    const container = containerRef.current;
    if (!container) return;
    sceneRefs.current.isInitialized = true;

    const { isMobile, pixelRatio, targetFPS } = deviceCapabilities;
    const scene = new THREE.Scene();

    if (backgroundColor) {
      scene.background = new THREE.Color(backgroundColor);
    }
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    // Dynamic camera positioning
    const { isTablet } = deviceCapabilities;
    let cameraZ = 1.2; // Desktop default
    if (isMobile) cameraZ = 1.6;
    else if (isTablet) cameraZ = 1.4;

    camera.position.set(0, 0.4, cameraZ);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true, powerPreference: isMobile ? 'low-power' : 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableRotate = false;
    controls.target.set(0, 0, 0);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(2, 3, 2);
    scene.add(mainLight);

    sceneRefs.current.scene = scene;
    sceneRefs.current.controls = controls;
    sceneRefs.current.camera = camera;
    sceneRefs.current.renderer = renderer;

    const gltfLoader = new GLTFLoader();
    const fbxLoader = new FBXLoader();

    gltfLoader.load(
      avatarUrl,
      async (gltf: GLTF) => {
        const avatar = gltf.scene;
        // Head centered at origin (approx height adjustment)
        avatar.position.set(0, -1.4, 0);
        avatar.scale.set(1.1, 1.1, 1.1);

        const { meshes, bones } = sceneRefs.current;
        console.group('Avatar Bone Structure');
        avatar.traverse((child) => {
          if (child instanceof THREE.Bone) {
            console.log('Bone:', child.name);
            const name = child.name;
            if (name === 'LeftEye') bones.leftEye = child;
            if (name === 'RightEye') bones.rightEye = child;
            if (name === 'Neck') bones.neck = child;
            if (name === 'Head') bones.head = child;
            if (name === 'Hips' || name === 'Spine') bones.spine = child;
          } else if (child instanceof THREE.Mesh) {
            const name = child.name;
            const lowerName = name.toLowerCase();

            if (child.morphTargetDictionary) {
              // Check for visemes (talking)
              const hasVisemes = ['viseme_aa', 'mouthOpen', 'jawOpen'].some((v) => child.morphTargetDictionary![v] !== undefined);
              if (hasVisemes) {
                sceneRefs.current.meshes.visemeMeshes.push(child);
                console.log(`Found viseme mesh: ${name}`);
              }

              // Check for blinks
              const hasBlinks = ['eyeBlinkLeft', 'eyeBlinkRight'].some((b) => child.morphTargetDictionary![b] !== undefined);
              if (hasBlinks) {
                sceneRefs.current.meshes.blinkMeshes.push(child);
                console.log(`Found blink mesh: ${name}`);
              }
            }

            if (name === 'Wolf3D_Teeth') meshes.teeth = child;

            if (name === 'Wolf3D_Outfit_Bottom' || name === 'Wolf3D_Outfit_Footwear' || name === 'Wolf3D_Outfit_Top') {
              child.castShadow = true;
              child.receiveShadow = true;
            }
            if (child.material) {
              const material = child.material as THREE.MeshStandardMaterial;
              if (material.map) {
                material.map.colorSpace = THREE.SRGBColorSpace;
                material.map.flipY = false;
              }
              if (lowerName.includes('eye') || lowerName.includes('lash') || lowerName.includes('brow')) {
                material.transparent = true;
                material.alphaTest = 0.5;
                material.depthWrite = true;
                material.side = THREE.DoubleSide;
              }
            }
          }
        });
        console.groupEnd();

        scene.add(avatar);
        sceneRefs.current.avatar = avatar;

        const mixer = new THREE.AnimationMixer(avatar);
        sceneRefs.current.mixer = mixer;

        const validBoneNames = new Set<string>();
        console.groupCollapsed('Avatar Bones (RPM)');
        avatar.traverse((child) => {
          if (child instanceof THREE.Bone) {
            validBoneNames.add(child.name);
            console.log(child.name);
          }
        });
        console.groupEnd();

        // Capture initial rotations for tracking offsets
        if (bones.head) sceneRefs.current.initialRotations.head = bones.head.rotation.clone();
        if (bones.neck) sceneRefs.current.initialRotations.neck = bones.neck.rotation.clone();
        if (bones.leftEye) sceneRefs.current.initialRotations.leftEye = bones.leftEye.rotation.clone();
        if (bones.rightEye) sceneRefs.current.initialRotations.rightEye = bones.rightEye.rotation.clone();

        const retargetClip = (clip: THREE.AnimationClip) => {
          const tracks: THREE.KeyframeTrack[] = [];
          console.groupCollapsed(`Retargeting Clip: ${clip.name}`);

          // Map Mixamo bones to Ready Player Me bones
          const boneMap: { [key: string]: string } = {
            mixamorigHips: 'Hips',
            mixamorigSpine: 'Spine',
            mixamorigSpine1: 'Spine1',
            mixamorigSpine2: 'Spine2',
            mixamorigNeck: 'Neck',
            mixamorigHead: 'Head',
            mixamorigLeftShoulder: 'LeftShoulder',
            mixamorigLeftArm: 'LeftArm',
            mixamorigLeftForeArm: 'LeftForeArm',
            mixamorigLeftHand: 'LeftHand',
            mixamorigRightShoulder: 'RightShoulder',
            mixamorigRightArm: 'RightArm',
            mixamorigRightForeArm: 'RightForeArm',
            mixamorigRightHand: 'RightHand',
            mixamorigLeftUpLeg: 'LeftUpLeg',
            mixamorigLeftLeg: 'LeftLeg',
            mixamorigLeftFoot: 'LeftFoot',
            mixamorigRightUpLeg: 'RightUpLeg',
            mixamorigRightLeg: 'RightLeg',
            mixamorigRightFoot: 'RightFoot',
            mixamorigLeftHandThumb1: 'LeftHandThumb1',
            mixamorigLeftHandThumb2: 'LeftHandThumb2',
            mixamorigLeftHandThumb3: 'LeftHandThumb3',
            mixamorigLeftHandIndex1: 'LeftHandIndex1',
            mixamorigLeftHandIndex2: 'LeftHandIndex2',
            mixamorigLeftHandIndex3: 'LeftHandIndex3',
            mixamorigLeftHandMiddle1: 'LeftHandMiddle1',
            mixamorigLeftHandMiddle2: 'LeftHandMiddle2',
            mixamorigLeftHandMiddle3: 'LeftHandMiddle3',
            mixamorigLeftHandRing1: 'LeftHandRing1',
            mixamorigLeftHandRing2: 'LeftHandRing2',
            mixamorigLeftHandRing3: 'LeftHandRing3',
            mixamorigLeftHandPinky1: 'LeftHandPinky1',
            mixamorigLeftHandPinky2: 'LeftHandPinky2',
            mixamorigLeftHandPinky3: 'LeftHandPinky3',
            mixamorigRightHandThumb1: 'RightHandThumb1',
            mixamorigRightHandThumb2: 'RightHandThumb2',
            mixamorigRightHandThumb3: 'RightHandThumb3',
            mixamorigRightHandIndex1: 'RightHandIndex1',
            mixamorigRightHandIndex2: 'RightHandIndex2',
            mixamorigRightHandIndex3: 'RightHandIndex3',
            mixamorigRightHandMiddle1: 'RightHandMiddle1',
            mixamorigRightHandMiddle2: 'RightHandMiddle2',
            mixamorigRightHandMiddle3: 'RightHandMiddle3',
            mixamorigRightHandRing1: 'RightHandRing1',
            mixamorigRightHandRing2: 'RightHandRing2',
            mixamorigRightHandRing3: 'RightHandRing3',
            mixamorigRightHandPinky1: 'RightHandPinky1',
            mixamorigRightHandPinky2: 'RightHandPinky2',
            mixamorigRightHandPinky3: 'RightHandPinky3',
          };

          clip.tracks.forEach((track) => {
            const [rawBoneName, property] = track.name.split('.');
            if (property === 'scale') return;

            // Strip prefixes (e.g. "Mixamorig:Hips" -> "Hips")
            // Also handle spaces or other garbage
            const strippedName = rawBoneName.split(':').pop()?.replace('Mixamorig', 'mixamorig') || rawBoneName;

            let targetBoneName = boneMap[strippedName] || boneMap[rawBoneName];

            // Fallback: Check if stripped name matches RPM bone
            if (!targetBoneName && validBoneNames.has(strippedName)) {
              targetBoneName = strippedName;
            }
            // Fallback: Check if raw name matches (e.g. "Hips")
            if (!targetBoneName && validBoneNames.has(rawBoneName)) {
              targetBoneName = rawBoneName;
            }

            if (targetBoneName) {
              // For non-root bones, IGNORE position tracks to prevent stretching/distortion
              if (property === 'position' && targetBoneName !== 'Hips') return;

              const newTrack = track.clone();
              newTrack.name = `${targetBoneName}.${property}`;

              // Scale position only for Hips (root motion)
              if (property === 'position' && targetBoneName === 'Hips') {
                const sample = newTrack.values[0];
                // Auto-detect cm vs m. If > 5 units, likely cm.
                if (Math.abs(sample) > 5) {
                  for (let i = 0; i < newTrack.values.length; i++) newTrack.values[i] *= 0.01;
                }
              }
              tracks.push(newTrack);
            } else {
              console.warn(`Unmapped bone: ${rawBoneName} (stripped: ${strippedName})`);
            }
          });
          console.groupEnd();
          return new THREE.AnimationClip(clip.name, clip.duration, tracks);
        };

        const loadAnimationRetargeted = (path: string, opts: any = {}) => {
          return new Promise<THREE.AnimationAction | null>((resolve) => {
            fbxLoader.load(
              path,
              (fbx) => {
                const clip = extractAnimationClip(fbx);
                if (clip) {
                  const action = mixer.clipAction(retargetClip(clip));
                  if (opts.loop !== undefined) action.setLoop(opts.loop, 1);
                  if (opts.clampWhenFinished) action.clampWhenFinished = true;
                  resolve(action);
                } else resolve(null);
              },
              undefined,
              () => resolve(null),
            );
          });
        };

        const paths = animationPaths || {
          idle: '/animations/idle.fbx',
          talking: '/animations/talking.fbx',
          waving: '/animations/waving.fbx',
          thinking: '/animations/thinking.fbx',
        };

        const [waving, idle, talking, thinking] = await Promise.all([
          loadAnimationRetargeted(paths.waving, { loop: THREE.LoopOnce, clampWhenFinished: true }),
          loadAnimationRetargeted(paths.idle),
          loadAnimationRetargeted(paths.talking),
          loadAnimationRetargeted(paths.thinking),
        ]);

        sceneRefs.current.actions = { waving, idle, talking, thinking };

        // Ensure specific animations loop correctly
        if (idle) idle.setLoop(THREE.LoopRepeat, Infinity);
        if (talking) talking.setLoop(THREE.LoopRepeat, Infinity);
        if (thinking) thinking.setLoop(THREE.LoopRepeat, Infinity);

        mixer.addEventListener('finished', (e) => {
          if (e.action === waving && idle) {
            sceneRefs.current.hasPlayedWaving = true;
            crossFadeTo(idle, 0.5);
          }
        });

        if (waving) waving.play();
        else if (idle) {
          sceneRefs.current.hasPlayedWaving = true;
          idle.play();
        }
        onLoadRef.current?.();
      },
      undefined,
      (err) => {
        console.error(err);
        onErrorRef.current?.(new Error('Load failed'));
      },
    );

    const clock = new THREE.Clock();
    const avatarRenderLoop = (timestamp: number) => {
      sceneRefs.current.animationId = requestAnimationFrame(avatarRenderLoop);
      const delta = clock.getDelta();
      if (sceneRefs.current.mixer) sceneRefs.current.mixer.update(delta);
      sceneRefs.current.controls?.update();

      const { blinkState, meshes, bones, mouse, initialRotations } = sceneRefs.current;

      // Eye and Head Tracking
      if (bones.head && bones.leftEye && bones.rightEye && initialRotations.head && initialRotations.leftEye && initialRotations.rightEye) {
        // Target look position (invert mouse Y for 3D space)
        const targetX = mouse.x * 0.5;
        const targetY = mouse.y * 0.5;

        // Smoothly interpolate current rotation to target
        // Head follows mouse slightly (neck/head rotation)
        const verticalGazeOffset = 0.05; // Reduced offset
        const headRotationX = -targetY * 0.1 + verticalGazeOffset * 0.5; // Reduced tracking range
        const headRotationY = -targetX * 0.2; // Reduced tracking range

        // Apply relative rotation (Initial + Offset)
        const currentHeadX = bones.head.rotation.x;
        const currentHeadY = bones.head.rotation.y;

        // Calculate target total rotation
        const targetHeadRotX = initialRotations.head.x + headRotationX;
        const targetHeadRotY = initialRotations.head.y + headRotationY;

        bones.head.rotation.x = THREE.MathUtils.lerp(currentHeadX, targetHeadRotX, 0.1);
        bones.head.rotation.y = THREE.MathUtils.lerp(currentHeadY, targetHeadRotY, 0.1);

        if (bones.neck && initialRotations.neck) {
          const targetNeckRotX = initialRotations.neck.x + headRotationX * 0.5;
          const targetNeckRotY = initialRotations.neck.y + headRotationY * 0.5;

          bones.neck.rotation.x = THREE.MathUtils.lerp(bones.neck.rotation.x, targetNeckRotX, 0.1);
          bones.neck.rotation.y = THREE.MathUtils.lerp(bones.neck.rotation.y, targetNeckRotY, 0.1);
        }

        // Eyes follow more aggressively
        const eyeRotationX = -targetY * 0.2 + verticalGazeOffset; // Reduced tracking range
        const eyeRotationY = -targetX * 0.4;

        // Apply to initial rotation
        bones.leftEye.rotation.x = initialRotations.leftEye.x + eyeRotationX;
        bones.leftEye.rotation.y = initialRotations.leftEye.y + eyeRotationY;

        bones.rightEye.rotation.x = initialRotations.rightEye.x + eyeRotationX;
        bones.rightEye.rotation.y = initialRotations.rightEye.y + eyeRotationY;
      }

      if (meshes.blinkMeshes.length > 0) {
        if (!blinkState.isBlinking) {
          if (timestamp > blinkState.nextBlinkTime) {
            console.log('Blink triggered at:', timestamp);
            blinkState.isBlinking = true;
            blinkState.blinkStartTime = timestamp;
            blinkState.nextBlinkTime = timestamp + 3000 + Math.random() * 5000;
          }
        } else {
          const progress = (timestamp - blinkState.blinkStartTime) / blinkState.duration;
          if (progress >= 1) {
            blinkState.isBlinking = false;
            meshes.blinkMeshes.forEach((mesh) => {
              const leftIdx = mesh.morphTargetDictionary!['eyeBlinkLeft'];
              const rightIdx = mesh.morphTargetDictionary!['eyeBlinkRight'];
              if (leftIdx !== undefined) mesh.morphTargetInfluences![leftIdx] = 0;
              if (rightIdx !== undefined) mesh.morphTargetInfluences![rightIdx] = 0;
            });
          } else {
            const value = Math.sin(progress * Math.PI);
            meshes.blinkMeshes.forEach((mesh) => {
              const leftIdx = mesh.morphTargetDictionary!['eyeBlinkLeft'];
              const rightIdx = mesh.morphTargetDictionary!['eyeBlinkRight'];
              if (leftIdx !== undefined) mesh.morphTargetInfluences![leftIdx] = value;
              if (rightIdx !== undefined) mesh.morphTargetInfluences![rightIdx] = value;
            });
          }
        }
      }
      renderer.render(scene, camera);
    };
    avatarRenderLoop(0);

    return () => {
      const { scene: s, renderer: r, controls: c, animationId } = sceneRefs.current;
      if (animationId) cancelAnimationFrame(animationId);
      if (c) c.dispose();
      if (s) s.clear();
      if (r) {
        r.dispose();
        r.domElement.remove();
      }
      sceneRefs.current.isInitialized = false;
    };
  }, [containerRef, avatarUrl, deviceCapabilities]);

  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const { camera, renderer } = sceneRefs.current;
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const { mouse } = sceneRefs.current;
      // Normalize mouse coordinates (-1 to +1)
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [containerRef]);

  return { playWaving, playTalking, playIdle, playThinking, resetCamera, setLipSync };
}
