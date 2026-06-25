"use client";
/**
 * Interactive 3D house hero. A stylized home (warm walls, charcoal hip roof, glowing windows)
 * on a plinth — drag to rotate, gentle auto-spin. Browser-only mount with a radial-glow
 * fallback so there's no SSR/WebGL issue.
 */
import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls } from "@react-three/drei";

function House() {
  return (
    <group position={[0, -0.2, 0]}>
      {/* Plinth */}
      <mesh position={[0, -0.95, 0]} receiveShadow>
        <cylinderGeometry args={[2.1, 2.1, 0.16, 64]} />
        <meshStandardMaterial color="#1b2230" roughness={0.6} metalness={0.2} />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[2, 1.4, 2]} />
        <meshStandardMaterial color="#efe7d6" roughness={0.75} />
      </mesh>

      {/* Hip roof (4-sided pyramid) */}
      <mesh position={[0, 1.25, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.78, 1.1, 4]} />
        <meshStandardMaterial color="#2a2f37" roughness={0.5} metalness={0.15} />
      </mesh>

      {/* Door */}
      <mesh position={[0, -0.35, 1.01]}>
        <boxGeometry args={[0.42, 0.7, 0.06]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.6} />
      </mesh>

      {/* Front windows (glowing) */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.2, 1.01]}>
          <boxGeometry args={[0.36, 0.36, 0.06]} />
          <meshStandardMaterial color="#ffd27a" emissive="#ffb347" emissiveIntensity={1.4} />
        </mesh>
      ))}
      {/* Side windows */}
      {[-1.01, 1.01].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.5, 0.36, 0.06]} />
          <meshStandardMaterial color="#ffd27a" emissive="#ffb347" emissiveIntensity={1.2} />
        </mesh>
      ))}

      {/* Chimney */}
      <mesh position={[0.55, 1.35, 0.35]}>
        <boxGeometry args={[0.22, 0.6, 0.22]} />
        <meshStandardMaterial color="#3a3f47" roughness={0.6} />
      </mesh>
    </group>
  );
}

export function Hero3D() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const glow = (
    <div
      className="absolute inset-0"
      style={{ background: "radial-gradient(45% 45% at 50% 45%, #f59e0b55 0%, transparent 70%)" }}
    />
  );

  if (!mounted) return <div className="relative h-full w-full">{glow}</div>;

  return (
    <div className="relative h-full w-full">
      {glow}
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [4.2, 2.6, 5], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 6, 4]} intensity={2.2} color="#fff4dc" castShadow />
        <pointLight position={[-5, 1, -3]} intensity={45} color="#f59e0b" />
        <pointLight position={[3, -1, 4]} intensity={18} color="#fb7185" />
        <Float speed={1.1} rotationIntensity={0.15} floatIntensity={0.8}>
          <House />
        </Float>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.9}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 0.1, 0]}
        />
      </Canvas>
    </div>
  );
}
