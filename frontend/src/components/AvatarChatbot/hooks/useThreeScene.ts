import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DeviceCapabilities } from '../types';

interface UseThreeSceneProps {
  containerRef: React.RefObject<HTMLDivElement>;
  avatarUrl: string;
  deviceCapabilities: DeviceCapabilities;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

interface SceneRefs {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  controls: OrbitControls | null;
  avatar: THREE.Object3D | null;
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
}

export function useThreeScene({
  containerRef,
  avatarUrl,
  deviceCapabilities,
  onLoad,
  onError,
}: UseThreeSceneProps) {
  // Use refs to avoid recreating callbacks
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);

  // Update refs when props change
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  const sceneRefs = useRef<SceneRefs>({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    avatar: null,
    mixer: null,
    animationId: null,
    clock: new THREE.Clock(),
    actions: {
      waving: null,
      idle: null,
      talking: null,
      thinking: null,
    },
    currentAction: null,
    hasPlayedWaving: false,
    isInitialized: false,
  });

  // Extract animation clip from FBX
  const extractAnimationClip = (fbx: THREE.Group): THREE.AnimationClip | null => {
    if (fbx.animations && fbx.animations.length > 0) {
      return fbx.animations[0];
    }

    if ((fbx as any).userData?.animations?.length > 0) {
      return (fbx as any).userData.animations[0];
    }

    let foundClip: THREE.AnimationClip | null = null;
    fbx.traverse((child: any) => {
      if (!foundClip && child.animations && child.animations.length > 0) {
        foundClip = child.animations[0];
      }
    });

    return foundClip;
  };

  // Load a single animation
  const loadAnimation = (
    fbxLoader: FBXLoader,
    path: string,
    mixer: THREE.AnimationMixer,
    options: { loop?: THREE.AnimationActionLoopStyles; clampWhenFinished?: boolean } = {}
  ): Promise<THREE.AnimationAction | null> => {
    return new Promise((resolve) => {
      fbxLoader.load(
        path,
        (fbx) => {
          const clip = extractAnimationClip(fbx);
          if (clip) {
            const action = mixer.clipAction(clip);
            if (options.loop !== undefined) {
              action.setLoop(options.loop, 1);
            }
            if (options.clampWhenFinished) {
              action.clampWhenFinished = true;
            }
            resolve(action);
          } else {
            console.warn(`No animations found in ${path}`);
            resolve(null);
          }
        },
        undefined,
        (error) => {
          console.error(`Error loading animation ${path}:`, error);
          resolve(null);
        }
      );
    });
  };

  // Cross-fade between animations
  const crossFadeTo = useCallback((toAction: THREE.AnimationAction | null, duration = 0.3) => {
    if (!toAction) return;

    const fromAction = sceneRefs.current.currentAction;

    toAction.reset();
    toAction.setEffectiveTimeScale(1);
    toAction.setEffectiveWeight(1);
    toAction.play();

    if (fromAction && fromAction !== toAction) {
      fromAction.crossFadeTo(toAction, duration, true);
    }

    sceneRefs.current.currentAction = toAction;
  }, []);

  // Reset camera to default position
  const resetCamera = useCallback(() => {
    const { camera, controls } = sceneRefs.current;
    if (!camera || !controls) return;

    camera.position.set(0, 1.3, 1.6);
    controls.target.set(0, 1.25, 0);
    controls.update();
  }, []);

  // Animation control functions - stable references
  const playTalking = useCallback(() => {
    const { actions, hasPlayedWaving } = sceneRefs.current;
    // Only play talking after waving has finished
    if (actions.talking && hasPlayedWaving) {
      console.log('Playing talking animation');
      crossFadeTo(actions.talking, 0.3);
    }
  }, [crossFadeTo]);

  const playIdle = useCallback(() => {
    const { actions, hasPlayedWaving } = sceneRefs.current;
    // Only play idle after waving has finished
    if (actions.idle && hasPlayedWaving) {
      console.log('Playing idle animation');
      crossFadeTo(actions.idle, 0.5);
    }
  }, [crossFadeTo]);

  const playWaving = useCallback(() => {
    const { actions } = sceneRefs.current;
    if (actions.waving) {
      console.log('Playing waving animation');
      actions.waving.reset();
      crossFadeTo(actions.waving, 0.3);
    }
  }, [crossFadeTo]);

  const playThinking = useCallback(() => {
    const { actions, hasPlayedWaving } = sceneRefs.current;
    // Only play thinking after waving has finished
    if (actions.thinking && hasPlayedWaving) {
      console.log('Playing thinking animation');
      crossFadeTo(actions.thinking, 0.3);
    }
  }, [crossFadeTo]);

  // Initialize scene - only runs once
  useEffect(() => {
    // Prevent double initialization
    if (sceneRefs.current.isInitialized) return;

    const container = containerRef.current;
    if (!container) return;

    sceneRefs.current.isInitialized = true;

    const { isMobile, pixelRatio, targetFPS } = deviceCapabilities;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null;

    // Camera - positioned for a waist-up "Medium Shot"
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    // Y=1.3 (Chest/Torso level), Z=1.6 (Distance for waist-up)
    camera.position.set(0, 1.3, 1.6);
    camera.lookAt(0, 1.25, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: true,
      powerPreference: isMobile ? 'low-power' : 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    container.appendChild(renderer.domElement);

    // OrbitControls for camera rotation only
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.25, 0);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI / 6;
    controls.maxPolarAngle = Math.PI / 2;
    controls.update();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(2, 3, 2);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-2, 1, -1);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);

    sceneRefs.current.scene = scene;
    sceneRefs.current.controls = controls;
    sceneRefs.current.camera = camera;
    sceneRefs.current.renderer = renderer;

    // Load avatar
    const gltfLoader = new GLTFLoader();
    const fbxLoader = new FBXLoader();

    gltfLoader.load(
      avatarUrl,
      async (gltf: GLTF) => {
        const avatar = gltf.scene;
        avatar.position.set(0, 0, 0);

        // Optimize materials for mobile
        avatar.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const material = child.material as THREE.MeshStandardMaterial;
            if (isMobile) {
              material.envMapIntensity = 0.5;
            }
          }
        });

        scene.add(avatar);
        sceneRefs.current.avatar = avatar;

        // Create animation mixer
        const mixer = new THREE.AnimationMixer(avatar);
        sceneRefs.current.mixer = mixer;

        // Load all animations
        const [wavingAction, idleAction, talkingAction, thinkingAction] = await Promise.all([
          loadAnimation(fbxLoader, '/animations/waving.fbx', mixer, {
            loop: THREE.LoopOnce,
            clampWhenFinished: true,
          }),
          loadAnimation(fbxLoader, '/animations/idle.fbx', mixer),
          loadAnimation(fbxLoader, '/animations/talking.fbx', mixer),
          loadAnimation(fbxLoader, '/animations/thinking.fbx', mixer),
        ]);

        sceneRefs.current.actions = {
          waving: wavingAction,
          idle: idleAction,
          talking: talkingAction,
          thinking: thinkingAction,
        };

        console.log('Animations loaded:', {
          waving: !!wavingAction,
          idle: !!idleAction,
          talking: !!talkingAction,
          thinking: !!thinkingAction,
        });

        // Set up waving finish listener
        mixer.addEventListener('finished', (e) => {
          if (e.action === wavingAction && idleAction) {
            console.log('Waving finished, transitioning to idle');
            sceneRefs.current.hasPlayedWaving = true;

            idleAction.reset();
            idleAction.setEffectiveTimeScale(1);
            idleAction.setEffectiveWeight(1);
            idleAction.play();

            if (wavingAction) {
              wavingAction.crossFadeTo(idleAction, 0.5, true);
            }

            sceneRefs.current.currentAction = idleAction;
          }
        });

        // Play waving animation once on load
        if (wavingAction) {
          wavingAction.reset();
          wavingAction.play();
          sceneRefs.current.currentAction = wavingAction;
        } else if (idleAction) {
          // Fallback to idle if no waving
          sceneRefs.current.hasPlayedWaving = true;
          idleAction.play();
          sceneRefs.current.currentAction = idleAction;
        }

        onLoadRef.current?.();
      },
      undefined,
      (error) => {
        console.error('Error loading avatar:', error);
        onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to load avatar'));
      }
    );

    // Animation loop
    const frameInterval = 1000 / targetFPS;
    let lastFrameTime = 0;

    const animate = (currentTime: number) => {
      sceneRefs.current.animationId = requestAnimationFrame(animate);

      const elapsed = currentTime - lastFrameTime;
      if (elapsed < frameInterval) return;
      lastFrameTime = currentTime - (elapsed % frameInterval);

      const delta = sceneRefs.current.clock.getDelta();
      sceneRefs.current.mixer?.update(delta);
      sceneRefs.current.controls?.update();
      renderer.render(scene, camera);
    };

    animate(0);

    // Cleanup
    return () => {
      const { scene: s, renderer: r, controls: c, animationId, mixer: m } = sceneRefs.current;

      if (animationId) {
        cancelAnimationFrame(animationId);
      }

      if (m) {
        m.stopAllAction();
      }

      if (c) {
        c.dispose();
      }

      if (s) {
        s.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry?.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach((mat) => mat.dispose());
            } else {
              object.material?.dispose();
            }
          }
        });
        s.clear();
      }

      if (r) {
        r.dispose();
        r.domElement.remove();
      }

      // Reset refs
      sceneRefs.current = {
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        avatar: null,
        mixer: null,
        animationId: null,
        clock: new THREE.Clock(),
        actions: { waving: null, idle: null, talking: null, thinking: null },
        currentAction: null,
        hasPlayedWaving: false,
        isInitialized: false,
      };
    };
  }, [containerRef, avatarUrl, deviceCapabilities]); // Stable dependencies only

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const { camera, renderer } = sceneRefs.current;
      if (!container || !camera || !renderer) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [containerRef]);

  return {
    playWaving,
    playTalking,
    playIdle,
    playThinking,
    resetCamera,
  };
}
