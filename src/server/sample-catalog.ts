/**
 * Sample master catalog — realistic placeholder inventory (~10 items per category, with
 * wholesale + list pricing in cents). Shared by the seed and the auto-bootstrap so the
 * platform always has inventory the reseller can pick from. Not live data; illustrative.
 */
export type Cfg = "unit" | "area" | "linear" | "custom";
type Model = "flat" | "per_unit" | "per_area" | "quote";

export interface SampleItem {
  product: string;
  brand: string;
  sku: string;
  attrs?: Record<string, string>;
  wholesaleCents: number;
  platformListCents: number;
}

export interface SampleCategory {
  slug: string;
  name: string;
  icon: string;
  cfg: Cfg;
  uom: string;
  delivery: { model: Model; cents: number };
  labor: { model: Model; cents: number };
  haulaway: { model: Model; cents: number };
  items: SampleItem[];
}

export const SAMPLE_CATALOG: SampleCategory[] = [
  {
    slug: "flooring",
    name: "Flooring (Carpet → Hardwood)",
    icon: "🪵",
    cfg: "area",
    uom: "sqft",
    delivery: { model: "flat", cents: 0 },
    labor: { model: "per_area", cents: 350 },
    haulaway: { model: "per_area", cents: 100 },
    items: [
      { product: "Natural Oak Plank", brand: "TimberCo", sku: "FLR-01", wholesaleCents: 400, platformListCents: 600 },
      { product: "Espresso Oak Plank", brand: "TimberCo", sku: "FLR-02", wholesaleCents: 450, platformListCents: 680 },
      { product: "Natural Maple Plank", brand: "TimberCo", sku: "FLR-03", wholesaleCents: 500, platformListCents: 760 },
      { product: "Hickory Wide Plank", brand: "Heartland", sku: "FLR-04", wholesaleCents: 540, platformListCents: 820 },
      { product: "American Walnut", brand: "Heartland", sku: "FLR-05", wholesaleCents: 700, platformListCents: 1050 },
      { product: "Strand Bamboo", brand: "EcoFloor", sku: "FLR-06", wholesaleCents: 360, platformListCents: 560 },
      { product: "Hand-Scraped Acacia", brand: "Artisan", sku: "FLR-07", wholesaleCents: 620, platformListCents: 940 },
      { product: "Whitewashed Oak", brand: "TimberCo", sku: "FLR-08", wholesaleCents: 520, platformListCents: 790 },
      { product: "Gray Ash Plank", brand: "Heartland", sku: "FLR-09", wholesaleCents: 480, platformListCents: 730 },
      { product: "Brazilian Cherry", brand: "Artisan", sku: "FLR-10", wholesaleCents: 760, platformListCents: 1140 },
    ],
  },
  {
    slug: "tiles",
    name: "Tile Flooring",
    icon: "◻️",
    cfg: "area",
    uom: "sqft",
    delivery: { model: "flat", cents: 0 },
    labor: { model: "per_area", cents: 450 },
    haulaway: { model: "per_area", cents: 120 },
    items: [
      { product: "Matte White Porcelain", brand: "StoneWorks", sku: "TILE-01", wholesaleCents: 300, platformListCents: 520 },
      { product: "Carrara Marble-Look", brand: "StoneWorks", sku: "TILE-02", wholesaleCents: 420, platformListCents: 680 },
      { product: "Slate Gray Stone", brand: "StoneWorks", sku: "TILE-03", wholesaleCents: 380, platformListCents: 610 },
      { product: "White Subway Ceramic", brand: "Metro", sku: "TILE-04", wholesaleCents: 220, platformListCents: 390 },
      { product: "Hexagon Mosaic", brand: "Metro", sku: "TILE-05", wholesaleCents: 460, platformListCents: 740 },
      { product: "Wood-Look Plank Tile", brand: "StoneWorks", sku: "TILE-06", wholesaleCents: 360, platformListCents: 580 },
      { product: "Terrazzo Speckle", brand: "Artisan", sku: "TILE-07", wholesaleCents: 540, platformListCents: 860 },
      { product: "Travertine Natural", brand: "Quarry", sku: "TILE-08", wholesaleCents: 500, platformListCents: 800 },
      { product: "Large-Format Concrete", brand: "Urban", sku: "TILE-09", wholesaleCents: 480, platformListCents: 770 },
      { product: "Encaustic Patterned", brand: "Artisan", sku: "TILE-10", wholesaleCents: 620, platformListCents: 980 },
    ],
  },
  {
    slug: "toilets",
    name: "Toilets / Commodes",
    icon: "🚽",
    cfg: "unit",
    uom: "each",
    delivery: { model: "flat", cents: 4900 },
    labor: { model: "per_unit", cents: 18000 },
    haulaway: { model: "per_unit", cents: 3500 },
    items: [
      { product: "AquaSave Two-Piece", brand: "PlumbPro", sku: "TLT-01", wholesaleCents: 18000, platformListCents: 25000 },
      { product: "AquaSave Comfort/ADA", brand: "PlumbPro", sku: "TLT-02", wholesaleCents: 22000, platformListCents: 30000 },
      { product: "OneFlush One-Piece", brand: "PlumbPro", sku: "TLT-03", wholesaleCents: 26000, platformListCents: 36000 },
      { product: "Skirted Elongated", brand: "Lumen", sku: "TLT-04", wholesaleCents: 30000, platformListCents: 42000 },
      { product: "Smart Bidet Toilet", brand: "Lumen", sku: "TLT-05", wholesaleCents: 68000, platformListCents: 95000 },
      { product: "Wall-Hung + Tank", brand: "Lumen", sku: "TLT-06", wholesaleCents: 52000, platformListCents: 72000 },
      { product: "Round Compact", brand: "PlumbPro", sku: "TLT-07", wholesaleCents: 14000, platformListCents: 20000 },
      { product: "Dual-Flush Hi-Eff", brand: "EcoFlush", sku: "TLT-08", wholesaleCents: 21000, platformListCents: 29000 },
      { product: "Black Matte Two-Piece", brand: "Lumen", sku: "TLT-09", wholesaleCents: 34000, platformListCents: 47000 },
      { product: "Heavy-Duty Commercial", brand: "PlumbPro", sku: "TLT-10", wholesaleCents: 40000, platformListCents: 55000 },
    ],
  },
  {
    slug: "sinks",
    name: "Sinks",
    icon: "🚰",
    cfg: "unit",
    uom: "each",
    delivery: { model: "flat", cents: 3900 },
    labor: { model: "per_unit", cents: 16000 },
    haulaway: { model: "per_unit", cents: 3000 },
    items: [
      { product: "Undermount Single Bowl", brand: "BasinWorks", sku: "SNK-01", wholesaleCents: 9000, platformListCents: 14000 },
      { product: "Undermount Double Bowl", brand: "BasinWorks", sku: "SNK-02", wholesaleCents: 13000, platformListCents: 19000 },
      { product: "Farmhouse Apron", brand: "BasinWorks", sku: "SNK-03", wholesaleCents: 22000, platformListCents: 31000 },
      { product: "Stainless Workstation", brand: "ProKitchen", sku: "SNK-04", wholesaleCents: 26000, platformListCents: 37000 },
      { product: "Granite Composite", brand: "StoneWorks", sku: "SNK-05", wholesaleCents: 18000, platformListCents: 26000 },
      { product: "Vessel Glass Basin", brand: "Lumen", sku: "SNK-06", wholesaleCents: 11000, platformListCents: 17000 },
      { product: "Pedestal Bathroom", brand: "PlumbPro", sku: "SNK-07", wholesaleCents: 9000, platformListCents: 14000 },
      { product: "Wall-Mount Bathroom", brand: "PlumbPro", sku: "SNK-08", wholesaleCents: 8000, platformListCents: 12500 },
      { product: "Bar / Prep Sink", brand: "ProKitchen", sku: "SNK-09", wholesaleCents: 7000, platformListCents: 11000 },
      { product: "Copper Hammered", brand: "Artisan", sku: "SNK-10", wholesaleCents: 30000, platformListCents: 43000 },
    ],
  },
  {
    slug: "windows",
    name: "Windows",
    icon: "🪟",
    cfg: "unit",
    uom: "each",
    delivery: { model: "flat", cents: 5900 },
    labor: { model: "per_unit", cents: 22000 },
    haulaway: { model: "per_unit", cents: 4000 },
    items: [
      { product: "Double-Hung Vinyl", brand: "ClearView", sku: "WIN-01", wholesaleCents: 22000, platformListCents: 32000 },
      { product: "Casement Vinyl", brand: "ClearView", sku: "WIN-02", wholesaleCents: 24000, platformListCents: 35000 },
      { product: "Picture Window", brand: "ClearView", sku: "WIN-03", wholesaleCents: 28000, platformListCents: 40000 },
      { product: "Sliding Window", brand: "ClearView", sku: "WIN-04", wholesaleCents: 20000, platformListCents: 29000 },
      { product: "Awning Window", brand: "Vista", sku: "WIN-05", wholesaleCents: 23000, platformListCents: 33000 },
      { product: "Bay Window", brand: "Vista", sku: "WIN-06", wholesaleCents: 60000, platformListCents: 85000 },
      { product: "Bow Window", brand: "Vista", sku: "WIN-07", wholesaleCents: 72000, platformListCents: 100000 },
      { product: "Fiberglass Double-Hung", brand: "Apex", sku: "WIN-08", wholesaleCents: 34000, platformListCents: 48000 },
      { product: "Wood-Clad Casement", brand: "Apex", sku: "WIN-09", wholesaleCents: 46000, platformListCents: 65000 },
      { product: "Egress Basement", brand: "ClearView", sku: "WIN-10", wholesaleCents: 30000, platformListCents: 43000 },
    ],
  },
  {
    slug: "kitchen-island",
    name: "Kitchen Island",
    icon: "🍽️",
    cfg: "unit",
    uom: "each",
    delivery: { model: "flat", cents: 14900 },
    labor: { model: "quote", cents: 0 },
    haulaway: { model: "flat", cents: 0 },
    items: [
      { product: "Quartz Waterfall Island", brand: "BuildCo", sku: "ISL-01", wholesaleCents: 160000, platformListCents: 240000 },
      { product: "Butcher-Block Island", brand: "BuildCo", sku: "ISL-02", wholesaleCents: 110000, platformListCents: 165000 },
      { product: "Granite-Top Island", brand: "StoneWorks", sku: "ISL-03", wholesaleCents: 140000, platformListCents: 210000 },
      { product: "Rolling Cart Island", brand: "Compact", sku: "ISL-04", wholesaleCents: 38000, platformListCents: 58000 },
      { product: "Two-Tier Breakfast Bar", brand: "BuildCo", sku: "ISL-05", wholesaleCents: 175000, platformListCents: 260000 },
      { product: "Farmhouse Island", brand: "Heartland", sku: "ISL-06", wholesaleCents: 130000, platformListCents: 195000 },
      { product: "Marble-Top Island", brand: "StoneWorks", sku: "ISL-07", wholesaleCents: 200000, platformListCents: 300000 },
      { product: "Industrial Steel Island", brand: "Urban", sku: "ISL-08", wholesaleCents: 95000, platformListCents: 145000 },
      { product: "Compact Apartment Island", brand: "Compact", sku: "ISL-09", wholesaleCents: 52000, platformListCents: 80000 },
      { product: "Double-Waterfall Island", brand: "BuildCo", sku: "ISL-10", wholesaleCents: 240000, platformListCents: 360000 },
    ],
  },
];
