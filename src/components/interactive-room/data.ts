/**
 * Mock data for the Luxury Living Room Configurator. Prices are illustrative whole dollars.
 * Each zone offers material options; each option itemizes parts + delivery + install + haulaway.
 */
import type { ComponentType } from "react";
import { Layers, PanelTop, Grid2x2, Sofa } from "lucide-react";

export type ItemType = "parts" | "delivery" | "install" | "haulaway";

export interface RenovationItem {
  id: string;
  name: string;
  type: ItemType;
  price: number;
}

export interface ZoneOption {
  id: string;
  name: string;
  material: string;
  items: RenovationItem[];
}

export type ZoneId = "ceiling" | "wall" | "floor" | "furniture";

export interface Zone {
  id: ZoneId;
  label: string;
  blurb: string;
  icon: ComponentType<{ className?: string }>;
  /** Hotspot position over the room (percent). */
  hotspot: { top: number; left: number };
  /** Highlight region when active (percent). */
  region: { top: number; left: number; width: number; height: number };
  options: ZoneOption[];
}

const items = (
  prefix: string,
  parts: number,
  delivery: number,
  install: number,
  haulaway: number,
): RenovationItem[] => [
  { id: `${prefix}-parts`, name: "Materials", type: "parts", price: parts },
  { id: `${prefix}-delivery`, name: "White-glove delivery", type: "delivery", price: delivery },
  { id: `${prefix}-install`, name: "Master-craftsman install", type: "install", price: install },
  { id: `${prefix}-haulaway`, name: "Old-fixture haulaway", type: "haulaway", price: haulaway },
];

export const ZONES: Zone[] = [
  {
    id: "ceiling",
    label: "Ceiling",
    blurb: "Wood slats & accent panels",
    icon: Layers,
    hotspot: { top: 18, left: 50 },
    region: { top: 0, left: 8, width: 84, height: 26 },
    options: [
      { id: "ceiling-oak", name: "Custom Oak Slats", material: "Solid white-oak battens", items: items("ceiling-oak", 3200, 280, 1900, 350) },
      { id: "ceiling-acoustic", name: "Acoustic Felt Panels", material: "PET acoustic + walnut trim", items: items("ceiling-acoustic", 2400, 240, 1500, 350) },
    ],
  },
  {
    id: "wall",
    label: "Main Wall",
    blurb: "Concrete or Venetian plaster",
    icon: PanelTop,
    hotspot: { top: 40, left: 24 },
    region: { top: 24, left: 6, width: 40, height: 46 },
    options: [
      { id: "wall-concrete", name: "Board-Formed Concrete", material: "Architectural concrete panels", items: items("wall-concrete", 4100, 320, 2600, 400) },
      { id: "wall-plaster", name: "Venetian Plaster", material: "Hand-troweled lime plaster", items: items("wall-plaster", 2900, 180, 2100, 250) },
    ],
  },
  {
    id: "floor",
    label: "Flooring",
    blurb: "Hardwood & premium rug",
    icon: Grid2x2,
    hotspot: { top: 80, left: 42 },
    region: { top: 68, left: 0, width: 100, height: 32 },
    options: [
      { id: "floor-oak", name: "European Oak Plank", material: "Wide-plank engineered oak", items: items("floor-oak", 3800, 300, 2200, 600) },
      { id: "floor-stone", name: "Honed Limestone + Wool Rug", material: "Large-format stone + hand-knotted wool", items: items("floor-stone", 5200, 420, 3100, 600) },
    ],
  },
  {
    id: "furniture",
    label: "Furniture",
    blurb: "Sectional & accent chairs",
    icon: Sofa,
    hotspot: { top: 66, left: 62 },
    region: { top: 52, left: 40, width: 56, height: 36 },
    options: [
      { id: "furn-sectional", name: "Low-Profile Sectional", material: "Boucle + kiln-dried hardwood frame", items: items("furn-sectional", 6400, 450, 600, 350) },
      { id: "furn-lounge", name: "Lounge Chair Pair", material: "Full-grain leather + oak", items: items("furn-lounge", 4200, 380, 400, 250) },
    ],
  },
];

export function optionTotal(option: ZoneOption): number {
  return option.items.reduce((sum, it) => sum + it.price, 0);
}

export function formatUSD(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}
