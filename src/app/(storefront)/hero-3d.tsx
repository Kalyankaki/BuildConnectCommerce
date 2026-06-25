"use client";
/**
 * Luxe WebGL hero object: a slowly rotating, gently distorting molten-gold form, lit with a
 * warm key + amber/rose rim lights. Renders only after mount (browser-only) so there's no SSR
 * WebGL issue; until then a soft radial glow stands in.
 */
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import type { Mesh } from "three";

function Blob() {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.25;
  });
  return (
    <Float speed={1.2} rotationIntensity={0.45} floatIntensity={1.0}>
      <mesh ref={ref} scale={1.7}>
        <icosahedronGeometry args={[1, 12]} />
        <MeshDistortMaterial
          color="#e8b21f"
          metalness={0.85}
          roughness={0.12}
          distort={0.3}
          speed={1.3}
          emissive="#6b4200"
          emissiveIntensity={0.3}
        />
      </mesh>
    </Float>
  );
}

export function Hero3D() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Fallback glow (also shows behind/while the canvas initializes).
  const glow = (
    <div
      className="absolute inset-0"
      style={{ background: "radial-gradient(50% 50% at 50% 50%, #f59e0b66 0%, transparent 70%)" }}
    />
  );

  if (!mounted) return <div className="relative h-full w-full">{glow}</div>;

  return (
    <div className="relative h-full w-full">
      {glow}
      <Canvas dpr={[1, 1.6]} camera={{ position: [0, 0, 4.2], fov: 45 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 5]} intensity={2.4} color="#fff4dc" />
        <pointLight position={[-4, -2, -3]} intensity={40} color="#f59e0b" />
        <pointLight position={[3, -3, 2]} intensity={22} color="#fb7185" />
        <Blob />
      </Canvas>
    </div>
  );
}
