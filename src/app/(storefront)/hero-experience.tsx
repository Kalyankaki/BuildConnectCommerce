"use client";
/**
 * Interactive 3D room hero. A furnished living space behind the title; click "Explore the
 * room" (or any piece) to fade the title and zoom inside, then click furniture for a
 * price/model card. "Back" restores the hero view.
 *
 * Robustness: the room + lights render immediately (never blocked). The studio HDRI loads in
 * its own Suspense + error boundary, so a slow/missing/large HDRI can't blank or crash the scene.
 */
import { Component, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, ContactShadows, Environment, Float } from "@react-three/drei";
import { ArrowRight, Hammer, Move3d, X } from "lucide-react";

type ItemKey = "floor" | "island" | "sofa" | "panel" | "blinds";
type Showcase = { name: string; price: string; model: string; blurb: string };

const ITEMS: Record<ItemKey, Showcase> = {
  floor: { name: "Engineered Oak Flooring", price: "$7.50 / sq ft", model: "TimberCo · Natural Oak", blurb: "Wide-plank engineered hardwood, installed over your old carpet — haulaway included." },
  island: { name: "Quartz Kitchen Island", price: "from $2,400", model: "Bianco · Waterfall edge", blurb: "Custom island with a quartz waterfall countertop, delivered and fitted." },
  sofa: { name: "Lounge Sofa", price: "staging", model: "—", blurb: "Staging only — we handle the materials and the install; you bring the comfort." },
  panel: { name: "Acoustic Slat Panel", price: "from $38 / panel", model: "Slat Oak · Walnut", blurb: "Warm acoustic accent wall, measured and mounted by our crew." },
  blinds: { name: "Motorized Blinds", price: "from $180 / window", model: "Lumina · Smart roller", blurb: "Made-to-measure roller blinds with a quiet motor and app control." },
};

const HERO_CAM: [number, number, number, number, number, number] = [7.5, 5.2, 8.5, 0, 1, 0];
const INSIDE_CAM: [number, number, number, number, number, number] = [2.6, 2.3, 3.8, 0, 1, -0.6];
const FOCUS: Record<ItemKey, [number, number, number, number, number, number]> = {
  floor: [1.5, 2.2, 3.2, 0, 0, 0],
  island: [-0.4, 2.2, 2.4, -1.9, 0.9, -0.6],
  sofa: [1.4, 1.8, 2.6, 0.6, 0.6, 0.4],
  panel: [0.4, 2.2, 2.2, -0.2, 1.5, -2.7],
  blinds: [-0.6, 2.2, 2.4, 2.1, 1.6, -2.6],
};

/** Swallows errors from the optional HDRI so it can never crash the scene. */
class SafeBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Clickable({ onPick, children }: { onPick: () => void; children: React.ReactNode }) {
  return (
    <group
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onPick();
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {children}
    </group>
  );
}

function Room({ onSelect }: { onSelect: (k: ItemKey) => void }) {
  return (
    <group>
      {/* Floor (clickable = hardwood) */}
      <Clickable onPick={() => onSelect("floor")}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[8, 8]} />
          <meshStandardMaterial color="#b98a52" roughness={0.45} metalness={0.1} />
        </mesh>
      </Clickable>

      {/* Rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.4, 0.01, 0.6]} receiveShadow>
        <planeGeometry args={[3.4, 2.4]} />
        <meshStandardMaterial color="#efe7d6" roughness={0.9} />
      </mesh>

      {/* Back + side walls */}
      <mesh position={[0, 2, -3]} receiveShadow>
        <boxGeometry args={[8, 4, 0.15]} />
        <meshStandardMaterial color="#262b33" roughness={0.95} />
      </mesh>
      <mesh position={[-3, 2, 0]} receiveShadow>
        <boxGeometry args={[0.15, 4, 8]} />
        <meshStandardMaterial color="#2d333c" roughness={0.95} />
      </mesh>

      {/* Wall panel (clickable) */}
      <Clickable onPick={() => onSelect("panel")}>
        <mesh position={[-0.2, 1.5, -2.9]}>
          <boxGeometry args={[2.6, 2, 0.12]} />
          <meshStandardMaterial color="#6b4a2f" roughness={0.6} />
        </mesh>
        {[-0.9, -0.5, -0.1, 0.3, 0.7].map((x) => (
          <mesh key={x} position={[x, 1.5, -2.82]}>
            <boxGeometry args={[0.12, 1.9, 0.06]} />
            <meshStandardMaterial color="#7d5836" roughness={0.5} />
          </mesh>
        ))}
      </Clickable>

      {/* Window + blinds (clickable) */}
      <Clickable onPick={() => onSelect("blinds")}>
        <mesh position={[2.1, 1.7, -2.9]}>
          <boxGeometry args={[1.6, 1.8, 0.1]} />
          <meshStandardMaterial color="#cfe8ff" emissive="#bcdcff" emissiveIntensity={0.6} />
        </mesh>
        {[2.3, 2.0, 1.7, 1.4, 1.1].map((y, i) => (
          <mesh key={i} position={[2.1, y, -2.84]}>
            <boxGeometry args={[1.55, 0.12, 0.04]} />
            <meshStandardMaterial color="#e7ded0" roughness={0.7} />
          </mesh>
        ))}
      </Clickable>

      {/* Sofa (clickable) */}
      <Clickable onPick={() => onSelect("sofa")}>
        <group position={[0.6, 0, 1.4]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[2.2, 0.4, 0.95]} />
            <meshStandardMaterial color="#3f4a5a" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.75, -0.42]} castShadow>
            <boxGeometry args={[2.2, 0.7, 0.18]} />
            <meshStandardMaterial color="#465064" roughness={0.85} />
          </mesh>
          {[-0.95, 0.95].map((x) => (
            <mesh key={x} position={[x, 0.6, 0]} castShadow>
              <boxGeometry args={[0.22, 0.5, 0.95]} />
              <meshStandardMaterial color="#465064" roughness={0.85} />
            </mesh>
          ))}
        </group>
      </Clickable>

      {/* Coffee table (decor) */}
      <group position={[0.5, 0, 0.5]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[1.3, 0.08, 0.7]} />
          <meshStandardMaterial color="#caa46a" roughness={0.4} metalness={0.1} />
        </mesh>
        {[[-0.55, -0.28], [0.55, -0.28], [-0.55, 0.28], [0.55, 0.28]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.17, z]}>
            <boxGeometry args={[0.07, 0.35, 0.07]} />
            <meshStandardMaterial color="#5a4632" />
          </mesh>
        ))}
      </group>

      {/* Floor lamp (decor, glow) */}
      <group position={[-1.9, 0, 1.6]}>
        <mesh position={[0, 1, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 2, 12]} />
          <meshStandardMaterial color="#2b2f37" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 2.05, 0]}>
          <coneGeometry args={[0.28, 0.4, 24, 1, true]} />
          <meshStandardMaterial color="#ffd27a" emissive="#ffb347" emissiveIntensity={1.6} side={2} />
        </mesh>
      </group>

      {/* Kitchen island (clickable) */}
      <Clickable onPick={() => onSelect("island")}>
        <group position={[-1.9, 0, -0.6]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[1.1, 1, 1.8]} />
            <meshStandardMaterial color="#1f2733" roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.03, 0]} castShadow>
            <boxGeometry args={[1.25, 0.1, 1.95]} />
            <meshStandardMaterial color="#f3f1ec" roughness={0.22} metalness={0.35} />
          </mesh>
        </group>
      </Clickable>
    </group>
  );
}

export function HeroExperience() {
  const [mounted, setMounted] = useState(false);
  const [explore, setExplore] = useState(false);
  const [selected, setSelected] = useState<ItemKey | null>(null);
  const camRef = useRef<CameraControls | null>(null);

  useEffect(() => setMounted(true), []);

  function setCam(c: [number, number, number, number, number, number]) {
    camRef.current?.setLookAt(c[0], c[1], c[2], c[3], c[4], c[5], true);
  }
  function enterExplore() {
    setExplore(true);
    setCam(INSIDE_CAM);
  }
  function pick(k: ItemKey) {
    setExplore(true);
    setSelected(k);
    setCam(FOCUS[k]);
  }
  function back() {
    setSelected(null);
    setExplore(false);
    setCam(HERO_CAM);
    document.body.style.cursor = "auto";
  }

  return (
    <div className="relative min-h-[100svh] w-full">
      {/* Ambient glow (always visible, also the load fallback) */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(50% 55% at 50% 45%, #f59e0b40 0%, transparent 70%)" }} />

      {/* 3D canvas fills the hero */}
      <div className="absolute inset-0">
        {mounted && (
          <Canvas shadows dpr={[1, 1.6]} camera={{ position: [HERO_CAM[0], HERO_CAM[1], HERO_CAM[2]], fov: 40 }} gl={{ antialias: true, alpha: true }}>
            {/* Reliable lighting — never depends on the HDRI */}
            <ambientLight intensity={0.55} />
            <directionalLight position={[6, 8, 5]} intensity={2.1} color="#fff4dc" castShadow shadow-mapSize={[1024, 1024]} />
            <pointLight position={[-4, 3, 2]} intensity={28} color="#f59e0b" />
            <pointLight position={[3, 2, 3]} intensity={12} color="#fb7185" />

            {/* Optional HDRI reflections — isolated so it can't block or crash the room */}
            <SafeBoundary>
              <Suspense fallback={null}>
                <Environment files="/hdri/studio.exr" environmentIntensity={0.5} />
              </Suspense>
            </SafeBoundary>

            <Float speed={0.6} rotationIntensity={0} floatIntensity={0.25} enabled={!explore}>
              <Room onSelect={pick} />
            </Float>
            <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={12} blur={2.4} far={4} />
            <CameraControls ref={camRef} enabled={explore} minPolarAngle={0.4} maxPolarAngle={Math.PI / 2.05} />
          </Canvas>
        )}
      </div>

      {/* Hero title overlay */}
      {!explore && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-24 text-center">
          <div className="pointer-events-auto px-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-amber-300">
              <Hammer className="h-3.5 w-3.5" /> White-label renovation commerce
            </span>
            <h1 className="font-serif mt-7 text-5xl font-semibold leading-[0.98] text-white sm:text-7xl lg:text-8xl">
              Renovation materials,
              <span className="mt-1 block italic">
                <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                  fully installed.
                </span>
              </span>
            </h1>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={enterExplore}
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-8 py-3.5 font-semibold text-slate-950 shadow-xl shadow-amber-500/25 transition hover:bg-amber-400"
              >
                <Move3d className="h-4 w-4" /> Explore the room
              </button>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-8 py-3.5 font-semibold text-white transition hover:bg-white/10"
              >
                Start your storefront <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Explore controls */}
      {explore && (
        <button
          onClick={back}
          className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-slate-950/60 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-slate-950/80"
        >
          <X className="h-4 w-4" /> Back
        </button>
      )}
      {explore && !selected && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm text-white/70">
          Tap any piece to see details · drag to look around
        </div>
      )}

      {/* Furniture detail card */}
      {selected && (
        <div className="absolute bottom-6 left-1/2 w-[22rem] max-w-[90vw] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-900/90 p-5 text-white shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">{ITEMS[selected].name}</h3>
              <p className="text-xs uppercase tracking-wide text-slate-400">{ITEMS[selected].model}</p>
            </div>
            <span className="rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-slate-950">{ITEMS[selected].price}</span>
          </div>
          <p className="mt-3 text-sm text-slate-300">{ITEMS[selected].blurb}</p>
          <button onClick={() => setSelected(null)} className="mt-4 text-xs text-slate-400 underline hover:text-white">
            Close
          </button>
        </div>
      )}
    </div>
  );
}
