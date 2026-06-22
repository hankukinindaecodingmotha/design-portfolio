import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import './HeroScene3D.css';

function resolveModelUrl(file) {
  return `${import.meta.env.BASE_URL}models/${file}`.replace(/([^:]\/)\/+/g, '$1');
}

function WatchPart({ url, scale, position, rotation, parallax, pointer, scrollBoost = 0 }) {
  const { scene } = useGLTF(url);
  const group = useRef();

  const normalized = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fit = (scale ?? 1) / maxDim;

    clone.position.sub(center);
    clone.scale.setScalar(fit);

    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          if ('metalness' in child.material) child.material.metalness = Math.min(child.material.metalness ?? 0.5, 0.85);
          if ('roughness' in child.material) child.material.roughness = Math.max(child.material.roughness ?? 0.5, 0.25);
        }
      }
    });

    return clone;
  }, [scene, scale]);

  const basePosition = useMemo(() => new THREE.Vector3(...position), [position]);
  const baseRotation = useMemo(() => new THREE.Euler(...rotation), [rotation]);
  const targetRot = useRef({ x: baseRotation.x, y: baseRotation.y });
  const targetPos = useRef({ x: basePosition.x, y: basePosition.y });

  useFrame(() => {
    if (!group.current) return;

    const { x, y, progress } = pointer.current;
    const rot = parallax?.rotate ?? 0.3;
    const float = parallax?.float ?? 0.12;

    targetRot.current.y = baseRotation.y + x * rot;
    targetRot.current.x = baseRotation.x + y * rot * 0.55;
    targetPos.current.x = basePosition.x + x * float;
    targetPos.current.y = basePosition.y + y * float - progress * scrollBoost;

    group.current.rotation.x += (targetRot.current.x - group.current.rotation.x) * 0.07;
    group.current.rotation.y += (targetRot.current.y - group.current.rotation.y) * 0.07;
    group.current.position.x += (targetPos.current.x - group.current.position.x) * 0.07;
    group.current.position.y += (targetPos.current.y - group.current.position.y) * 0.07;
  });

  return (
    <group ref={group} position={basePosition}>
      <primitive object={normalized} />
    </group>
  );
}

function LoadingBridge({ onReady }) {
  const { active } = useProgress();

  useEffect(() => {
    if (!active) onReady?.();
  }, [active, onReady]);

  return null;
}

function Scene({ models, pointer, onReady }) {
  useEffect(() => {
    models.forEach((model) => useGLTF.preload(resolveModelUrl(model.file)));
  }, [models]);

  return (
    <>
      <color attach="background" args={['#050506']} />
      <fog attach="fog" args={['#050506', 6, 14]} />

      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} color="#f8f2ea" />
      <directionalLight position={[-5, 2, -3]} intensity={0.75} color="#3d7fff" />
      <pointLight position={[2, 1, 3]} intensity={1.1} color="#ffd9a0" distance={10} />

      <group position={[0.85, 0, 0]}>
        <Suspense fallback={null}>
          <LoadingBridge onReady={onReady} />
          {models.map((model) => (
            <WatchPart
              key={model.file}
              url={resolveModelUrl(model.file)}
              scale={model.scale}
              position={model.position}
              rotation={model.rotation}
              parallax={model.parallax}
              scrollBoost={model.scrollBoost ?? 0.35}
              pointer={pointer}
            />
          ))}
        </Suspense>
      </group>
    </>
  );
}

export default function HeroScene3D({ models, pointer, onReady }) {
  const isCoarse =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  return (
    <div className="hero-scene-3d">
      <Canvas
        className="hero-scene-3d__canvas"
        camera={{ position: [0, 0.1, 4.4], fov: 48, near: 0.1, far: 100 }}
        dpr={isCoarse ? [1, 1.25] : [1, 1.75]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.setClearColor(0x050506, 0);
        }}
      >
        <Scene models={models} pointer={pointer} onReady={onReady} />
      </Canvas>
    </div>
  );
}
