"use client";
/**
 * Small rotating 3D preview shown in a zone's price card. A lightweight primitive scene per
 * zone (oak slats / concrete panel / floor planks / sectional). Client-only (rendered after a
 * click), warm lighting, no external assets.
 */
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { ZoneId } from "./data";

function Slats() {
  return (
    <group rotation={[0.35, 0, 0]}>
      {[-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].map((x) => (
        <mesh key={x} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[0.12, 0.08, 1.6]} />
          <meshStandardMaterial color="#9a6b3c" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Panel({ color }: { color: string }) {
  return (
    <mesh castShadow>
      <boxGeometry args={[1.5, 1, 0.16]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function Planks({ color }: { color: string }) {
  return (
    <group rotation={[-0.9, 0, 0]}>
      {[-0.45, -0.15, 0.15, 0.45].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.28, 1.6, 0.06]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Sofa() {
  return (
    <group position={[0, -0.1, 0]}>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[1.7, 0.3, 0.7]} />
        <meshStandardMaterial color="#e6dccb" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.28, -0.28]} castShadow>
        <boxGeometry args={[1.7, 0.42, 0.16]} />
        <meshStandardMaterial color="#ded3c0" roughness={0.9} />
      </mesh>
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 0.16, 0]} castShadow>
          <boxGeometry args={[0.18, 0.36, 0.7]} />
          <meshStandardMaterial color="#ded3c0" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Model({ zone, optionId }: { zone: ZoneId; optionId: string }) {
  const ref = useRef<Group>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.5;
  });
  let content: React.ReactNode = null;
  if (zone === "ceiling") content = <Slats />;
  else if (zone === "wall") content = <Panel color={optionId.includes("plaster") ? "#d8cfc1" : "#9c9286"} />;
  else if (zone === "floor") content = <Planks color={optionId.includes("stone") ? "#cfc6ba" : "#b07d4a"} />;
  else content = <Sofa />;
  return <group ref={ref}>{content}</group>;
}

export function ZoneModel({ zone, optionId }: { zone: ZoneId; optionId: string }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.6, 2.6], fov: 42 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 3]} intensity={2.2} color="#fff3da" />
      <pointLight position={[-3, 1, 2]} intensity={12} color="#f59e0b" />
      <Model zone={zone} optionId={optionId} />
    </Canvas>
  );
}
