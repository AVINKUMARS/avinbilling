import type { ModuleKey } from "@avin/shared";

export type PackUnit =
  | "qty"
  | "sqft"
  | "rft"
  | "metre"
  | "kg"
  | "sheet"
  | "bar"
  | "hour"
  | "fixed";

export type IndustryPackDefinition = {
  key: string;
  name: string;
  description: string;
  version: number;
  color: string;
  requiredModules: ModuleKey[];
  categories: Array<{
    key: string;
    name: string;
    itemType: "product" | "material" | "component" | "hardware" | "service";
    defaultUnit: PackUnit;
  }>;
  measurementFields: Array<{
    key: string;
    label: string;
    unit: string;
    required: boolean;
  }>;
  formulas: Array<{ key: string; label: string; expression: string; resultUnit: string }>;
  bomRules: Array<{ categoryKey: string; rule: string }>;
  defaultWorkflow: string[];
  seedItems: Array<{
    code: string;
    name: string;
    categoryKey: string;
    itemType: "product" | "material" | "component" | "hardware" | "service";
    unit: PackUnit;
    purchaseRatePaise: number;
    sellingRatePaise: number;
    wastagePercent: number;
  }>;
};

const operationalModules: ModuleKey[] = [
  "catalog",
  "projects",
  "measurements",
  "quotations",
  "purchasing",
  "inventory",
  "production",
  "delivery",
  "installation",
  "finance",
  "reports",
];

export const industryPackCatalog: IndustryPackDefinition[] = [
  {
    key: "upvc",
    name: "UPVC Windows and Doors",
    description: "Profiles, glass, hardware, fabrication and installation for UPVC systems.",
    version: 2,
    color: "#0f766e",
    requiredModules: operationalModules,
    categories: [
      { key: "upvc-window", name: "UPVC Window", itemType: "product", defaultUnit: "sqft" },
      { key: "upvc-door", name: "UPVC Door", itemType: "product", defaultUnit: "sqft" },
      { key: "upvc-profile", name: "UPVC Profile", itemType: "material", defaultUnit: "rft" },
      { key: "upvc-glass", name: "Glass", itemType: "material", defaultUnit: "sqft" },
      { key: "upvc-hardware", name: "Window Hardware", itemType: "hardware", defaultUnit: "qty" },
    ],
    measurementFields: [
      { key: "widthMm", label: "Width", unit: "mm", required: true },
      { key: "heightMm", label: "Height", unit: "mm", required: true },
      { key: "quantity", label: "Quantity", unit: "qty", required: true },
      { key: "track", label: "Track / shutter type", unit: "text", required: true },
      { key: "glassType", label: "Glass type", unit: "text", required: true },
    ],
    formulas: [
      { key: "areaSqft", label: "Window area", expression: "widthMm * heightMm / 92903.04", resultUnit: "sqft" },
      { key: "perimeterRft", label: "Profile perimeter", expression: "2 * (widthMm + heightMm) / 304.8", resultUnit: "rft" },
    ],
    bomRules: [
      { categoryKey: "upvc-profile", rule: "perimeterRft with configured wastage" },
      { categoryKey: "upvc-glass", rule: "areaSqft multiplied by quantity" },
    ],
    defaultWorkflow: ["approved", "material-check", "cutting", "reinforcement", "welding", "assembly", "glazing", "quality-check", "ready", "dispatched", "installed"],
    seedItems: [
      { code: "UPVC-WIN", name: "Standard UPVC Window", categoryKey: "upvc-window", itemType: "product", unit: "sqft", purchaseRatePaise: 32000, sellingRatePaise: 52000, wastagePercent: 12 },
      { code: "UPVC-DOOR", name: "Standard UPVC Door", categoryKey: "upvc-door", itemType: "product", unit: "sqft", purchaseRatePaise: 39000, sellingRatePaise: 62000, wastagePercent: 12 },
      { code: "UPVC-GLASS", name: "5mm Clear Glass", categoryKey: "upvc-glass", itemType: "material", unit: "sqft", purchaseRatePaise: 9000, sellingRatePaise: 14000, wastagePercent: 8 },
    ],
  },
  {
    key: "kitchen",
    name: "Kitchen Cabinets",
    description: "Base units, wall units, shutters, countertops, hardware and installation.",
    version: 1,
    color: "#ea580c",
    requiredModules: operationalModules,
    categories: [
      { key: "kitchen-base-unit", name: "Base Cabinet", itemType: "product", defaultUnit: "rft" },
      { key: "kitchen-wall-unit", name: "Wall Cabinet", itemType: "product", defaultUnit: "rft" },
      { key: "kitchen-shutter", name: "Kitchen Shutter", itemType: "component", defaultUnit: "sqft" },
      { key: "kitchen-hardware", name: "Kitchen Hardware", itemType: "hardware", defaultUnit: "qty" },
      { key: "countertop", name: "Countertop", itemType: "material", defaultUnit: "rft" },
    ],
    measurementFields: [
      { key: "lengthMm", label: "Run length", unit: "mm", required: true },
      { key: "heightMm", label: "Unit height", unit: "mm", required: true },
      { key: "depthMm", label: "Unit depth", unit: "mm", required: true },
      { key: "shutterFinish", label: "Shutter finish", unit: "text", required: true },
    ],
    formulas: [
      { key: "runningFeet", label: "Cabinet running feet", expression: "lengthMm / 304.8", resultUnit: "rft" },
      { key: "shutterArea", label: "Shutter area", expression: "lengthMm * heightMm / 92903.04", resultUnit: "sqft" },
    ],
    bomRules: [{ categoryKey: "kitchen-shutter", rule: "shutterArea plus finish wastage" }],
    defaultWorkflow: ["design", "approved", "material-order", "carcass", "shutters", "assembly", "quality-check", "delivery", "installation"],
    seedItems: [
      { code: "KIT-BASE", name: "Base Cabinet", categoryKey: "kitchen-base-unit", itemType: "product", unit: "rft", purchaseRatePaise: 55000, sellingRatePaise: 85000, wastagePercent: 12 },
      { code: "KIT-WALL", name: "Wall Cabinet", categoryKey: "kitchen-wall-unit", itemType: "product", unit: "rft", purchaseRatePaise: 45000, sellingRatePaise: 70000, wastagePercent: 12 },
      { code: "KIT-HINGE", name: "Soft-close Hinge", categoryKey: "kitchen-hardware", itemType: "hardware", unit: "qty", purchaseRatePaise: 45000, sellingRatePaise: 65000, wastagePercent: 0 },
    ],
  },
  {
    key: "wardrobe",
    name: "Wardrobes",
    description: "Sliding and hinged wardrobes, lofts, internals, shutters and accessories.",
    version: 1,
    color: "#7c3aed",
    requiredModules: operationalModules,
    categories: [
      { key: "wardrobe-hinged", name: "Hinged Wardrobe", itemType: "product", defaultUnit: "sqft" },
      { key: "wardrobe-sliding", name: "Sliding Wardrobe", itemType: "product", defaultUnit: "sqft" },
      { key: "wardrobe-loft", name: "Loft", itemType: "product", defaultUnit: "sqft" },
      { key: "wardrobe-internal", name: "Wardrobe Internal", itemType: "component", defaultUnit: "sqft" },
      { key: "wardrobe-hardware", name: "Wardrobe Hardware", itemType: "hardware", defaultUnit: "qty" },
    ],
    measurementFields: [
      { key: "widthMm", label: "Width", unit: "mm", required: true },
      { key: "heightMm", label: "Height", unit: "mm", required: true },
      { key: "depthMm", label: "Depth", unit: "mm", required: true },
      { key: "shutters", label: "Number of shutters", unit: "qty", required: true },
    ],
    formulas: [{ key: "frontArea", label: "Wardrobe front area", expression: "widthMm * heightMm / 92903.04", resultUnit: "sqft" }],
    bomRules: [{ categoryKey: "wardrobe-internal", rule: "frontArea adjusted for shelves and partitions" }],
    defaultWorkflow: ["design", "approved", "cutting", "edge-banding", "assembly", "shutters", "quality-check", "installation"],
    seedItems: [
      { code: "WAR-HINGED", name: "Hinged Wardrobe", categoryKey: "wardrobe-hinged", itemType: "product", unit: "sqft", purchaseRatePaise: 95000, sellingRatePaise: 145000, wastagePercent: 15 },
      { code: "WAR-SLIDE", name: "Sliding Wardrobe", categoryKey: "wardrobe-sliding", itemType: "product", unit: "sqft", purchaseRatePaise: 115000, sellingRatePaise: 175000, wastagePercent: 15 },
    ],
  },
  {
    key: "interiors",
    name: "Interior Works",
    description: "False ceilings, wall panels, partitions, painting and turnkey interior work.",
    version: 1,
    color: "#db2777",
    requiredModules: operationalModules,
    categories: [
      { key: "false-ceiling", name: "False Ceiling", itemType: "service", defaultUnit: "sqft" },
      { key: "wall-panel", name: "Wall Panel", itemType: "product", defaultUnit: "sqft" },
      { key: "partition", name: "Partition", itemType: "product", defaultUnit: "sqft" },
      { key: "painting", name: "Painting", itemType: "service", defaultUnit: "sqft" },
      { key: "interior-labour", name: "Interior Labour", itemType: "service", defaultUnit: "hour" },
    ],
    measurementFields: [
      { key: "lengthMm", label: "Length", unit: "mm", required: true },
      { key: "widthMm", label: "Width", unit: "mm", required: true },
      { key: "quantity", label: "Quantity", unit: "qty", required: true },
    ],
    formulas: [{ key: "surfaceArea", label: "Surface area", expression: "lengthMm * widthMm / 92903.04", resultUnit: "sqft" }],
    bomRules: [{ categoryKey: "wall-panel", rule: "surfaceArea plus configured wastage" }],
    defaultWorkflow: ["survey", "design", "approved", "procurement", "civil-work", "finishing", "quality-check", "handover"],
    seedItems: [
      { code: "INT-CEILING", name: "Gypsum False Ceiling", categoryKey: "false-ceiling", itemType: "service", unit: "sqft", purchaseRatePaise: 8000, sellingRatePaise: 13000, wastagePercent: 10 },
      { code: "INT-PAINT", name: "Interior Painting", categoryKey: "painting", itemType: "service", unit: "sqft", purchaseRatePaise: 2500, sellingRatePaise: 4500, wastagePercent: 5 },
    ],
  },
  {
    key: "aluminium",
    name: "Aluminium Windows and Doors",
    description: "Aluminium profiles, glazing, hardware, fabrication and installation.",
    version: 1,
    color: "#475569",
    requiredModules: operationalModules,
    categories: [
      { key: "aluminium-window", name: "Aluminium Window", itemType: "product", defaultUnit: "sqft" },
      { key: "aluminium-door", name: "Aluminium Door", itemType: "product", defaultUnit: "sqft" },
      { key: "aluminium-profile", name: "Aluminium Profile", itemType: "material", defaultUnit: "kg" },
      { key: "aluminium-hardware", name: "Aluminium Hardware", itemType: "hardware", defaultUnit: "qty" },
    ],
    measurementFields: [
      { key: "widthMm", label: "Width", unit: "mm", required: true },
      { key: "heightMm", label: "Height", unit: "mm", required: true },
      { key: "sections", label: "Number of sections", unit: "qty", required: true },
    ],
    formulas: [
      { key: "areaSqft", label: "Opening area", expression: "widthMm * heightMm / 92903.04", resultUnit: "sqft" },
      { key: "perimeterRft", label: "Frame perimeter", expression: "2 * (widthMm + heightMm) / 304.8", resultUnit: "rft" },
    ],
    bomRules: [{ categoryKey: "aluminium-profile", rule: "perimeter and internal sections converted using profile weight" }],
    defaultWorkflow: ["approved", "profile-order", "cutting", "machining", "assembly", "glazing", "quality-check", "installation"],
    seedItems: [
      { code: "ALU-WIN", name: "Aluminium Sliding Window", categoryKey: "aluminium-window", itemType: "product", unit: "sqft", purchaseRatePaise: 28000, sellingRatePaise: 45000, wastagePercent: 10 },
      { code: "ALU-DOOR", name: "Aluminium Door", categoryKey: "aluminium-door", itemType: "product", unit: "sqft", purchaseRatePaise: 35000, sellingRatePaise: 55000, wastagePercent: 10 },
    ],
  },
  {
    key: "glass-mirror",
    name: "Glass and Mirror Work",
    description: "Mirrors, shower partitions, glass doors, shelves, railings and glazing services.",
    version: 1,
    color: "#0891b2",
    requiredModules: operationalModules,
    categories: [
      { key: "mirror", name: "Mirror", itemType: "product", defaultUnit: "sqft" },
      { key: "toughened-glass", name: "Toughened Glass", itemType: "material", defaultUnit: "sqft" },
      { key: "shower-partition", name: "Shower Partition", itemType: "product", defaultUnit: "sqft" },
      { key: "glass-hardware", name: "Glass Hardware", itemType: "hardware", defaultUnit: "qty" },
      { key: "glass-polishing", name: "Edge Polishing", itemType: "service", defaultUnit: "rft" },
    ],
    measurementFields: [
      { key: "widthMm", label: "Width", unit: "mm", required: true },
      { key: "heightMm", label: "Height", unit: "mm", required: true },
      { key: "thicknessMm", label: "Thickness", unit: "mm", required: true },
      { key: "edgeFinish", label: "Edge finish", unit: "text", required: false },
    ],
    formulas: [
      { key: "glassArea", label: "Glass area", expression: "widthMm * heightMm / 92903.04", resultUnit: "sqft" },
      { key: "edgeLength", label: "Edge length", expression: "2 * (widthMm + heightMm) / 304.8", resultUnit: "rft" },
    ],
    bomRules: [{ categoryKey: "toughened-glass", rule: "glassArea plus breakage allowance" }],
    defaultWorkflow: ["survey", "template", "approved", "glass-order", "processing", "quality-check", "installation"],
    seedItems: [
      { code: "GLS-MIRROR", name: "5mm Mirror", categoryKey: "mirror", itemType: "product", unit: "sqft", purchaseRatePaise: 11000, sellingRatePaise: 18000, wastagePercent: 12 },
      { code: "GLS-TOUGH", name: "10mm Toughened Glass", categoryKey: "toughened-glass", itemType: "material", unit: "sqft", purchaseRatePaise: 19000, sellingRatePaise: 29000, wastagePercent: 12 },
    ],
  },
  {
    key: "contractor",
    name: "Civil Contractor",
    description: "Civil work, labour, concrete, masonry, plastering and project BOQs.",
    version: 1,
    color: "#a16207",
    requiredModules: operationalModules,
    categories: [
      { key: "civil-labour", name: "Civil Labour", itemType: "service", defaultUnit: "hour" },
      { key: "masonry", name: "Masonry", itemType: "service", defaultUnit: "sqft" },
      { key: "plastering", name: "Plastering", itemType: "service", defaultUnit: "sqft" },
      { key: "concrete", name: "Concrete", itemType: "material", defaultUnit: "fixed" },
      { key: "civil-material", name: "Civil Material", itemType: "material", defaultUnit: "kg" },
    ],
    measurementFields: [
      { key: "lengthMm", label: "Length", unit: "mm", required: true },
      { key: "widthMm", label: "Width", unit: "mm", required: true },
      { key: "heightMm", label: "Height / depth", unit: "mm", required: true },
    ],
    formulas: [
      { key: "areaSqft", label: "Work area", expression: "lengthMm * widthMm / 92903.04", resultUnit: "sqft" },
      { key: "volumeM3", label: "Concrete volume", expression: "lengthMm * widthMm * heightMm / 1000000000", resultUnit: "m3" },
    ],
    bomRules: [{ categoryKey: "concrete", rule: "volumeM3 multiplied by selected concrete mix" }],
    defaultWorkflow: ["estimate", "approved", "mobilization", "execution", "inspection", "billing", "handover"],
    seedItems: [
      { code: "CIV-MASON", name: "Block Masonry", categoryKey: "masonry", itemType: "service", unit: "sqft", purchaseRatePaise: 5000, sellingRatePaise: 8500, wastagePercent: 8 },
      { code: "CIV-PLAST", name: "Wall Plastering", categoryKey: "plastering", itemType: "service", unit: "sqft", purchaseRatePaise: 2800, sellingRatePaise: 5000, wastagePercent: 8 },
    ],
  },
  {
    key: "general-business",
    name: "General Trading and Services",
    description: "Flexible products, services, quantities, fixed charges and standard invoicing.",
    version: 1,
    color: "#2563eb",
    requiredModules: ["crm", "catalog", "projects", "quotations", "purchasing", "inventory", "finance", "reports"],
    categories: [
      { key: "trading-product", name: "Trading Product", itemType: "product", defaultUnit: "qty" },
      { key: "general-material", name: "General Material", itemType: "material", defaultUnit: "qty" },
      { key: "professional-service", name: "Professional Service", itemType: "service", defaultUnit: "hour" },
      { key: "fixed-service", name: "Fixed Service", itemType: "service", defaultUnit: "fixed" },
    ],
    measurementFields: [
      { key: "quantity", label: "Quantity", unit: "qty", required: true },
      { key: "description", label: "Description", unit: "text", required: true },
    ],
    formulas: [{ key: "lineAmount", label: "Line amount", expression: "quantity * unitRate", resultUnit: "currency" }],
    bomRules: [{ categoryKey: "trading-product", rule: "ordered quantity" }],
    defaultWorkflow: ["enquiry", "quoted", "approved", "ordered", "delivered", "invoiced", "paid"],
    seedItems: [
      { code: "GEN-PRODUCT", name: "Example Trading Product", categoryKey: "trading-product", itemType: "product", unit: "qty", purchaseRatePaise: 10000, sellingRatePaise: 15000, wastagePercent: 0 },
      { code: "GEN-SERVICE", name: "Example Professional Service", categoryKey: "professional-service", itemType: "service", unit: "hour", purchaseRatePaise: 30000, sellingRatePaise: 50000, wastagePercent: 0 },
    ],
  },
];

export function getIndustryPack(key: string) {
  return industryPackCatalog.find((pack) => pack.key === key);
}

export function validateIndustryPacks(packs = industryPackCatalog) {
  const keys = new Set<string>();
  const codes = new Set<string>();
  for (const pack of packs) {
    if (keys.has(pack.key)) throw new Error(`Duplicate industry pack key: ${pack.key}`);
    keys.add(pack.key);
    if (!pack.categories.length || !pack.measurementFields.length || !pack.defaultWorkflow.length) {
      throw new Error(`Industry pack ${pack.key} is incomplete`);
    }
    for (const item of pack.seedItems) {
      if (codes.has(item.code)) throw new Error(`Duplicate seed item code: ${item.code}`);
      codes.add(item.code);
      if (!pack.categories.some((category) => category.key === item.categoryKey)) {
        throw new Error(`Unknown category ${item.categoryKey} in ${pack.key}`);
      }
    }
  }
  return true;
}
