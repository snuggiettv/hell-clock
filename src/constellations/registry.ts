// src/constellations/registry.ts
export type ConstellationEntry = {
  id: string;
  label: string;
  artBase: string;
  dataUrl: string;
  group: any;
};

export const MASTER_URL =
  "https://raw.githubusercontent.com/snuggiettv/hellclock-data-export/refs/heads/main/data/Constellations.json";

const B = import.meta.env.BASE_URL;

const slugify = (s: string) =>
  String(s || "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ---------- helpers ----------
const get = (o: any, path: string[]) =>
  path.reduce((v, k) => (v != null ? v[k] : undefined), o);

// True only for the constellation objects we care about
function isConstellationEntry(x: any): boolean {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  if (x.type === "ConstellationDetails") return true;
  const d = x.definition;
  return !!(d && typeof d === "object" && !Array.isArray(d));
}

function englishName(def: any, group: any): string {
  const arrs = [
    get(def, ["nameKey"]),
    get(def, ["nameLocalizationKey"]),
    get(group, ["nameKey"]),
    get(group, ["nameLocalizationKey"]),
  ];
  for (const arr of arrs) {
    if (Array.isArray(arr)) {
      const en = arr.find((k: any) => k?.langCode === "en")?.langTranslation;
      if (en) return String(en).trim();
    }
  }
  const s =
    get(def, ["name"]) ||
    get(group, ["name"]) ||
    get(def, ["displayName"]) ||
    get(group, ["displayName"]);
  if (s) return String(s).replace(/\s*-\s*Constellation\s+Definition$/i, "").trim();
  return String(get(def, ["id"]) ?? get(group, ["id"]) ?? "Unnamed");
}

function fileBaseName(def: any, group: any, label: string): string {
  const raw = get(def, ["name"]) || get(group, ["name"]);
  if (raw) return String(raw).replace(/\s*-\s*Constellation\s+Definition$/i, "").trim();
  if (label && label !== "Unnamed") return label;
  const id = get(def, ["id"]) ?? get(group, ["id"]);
  return id ? String(id) : "Unnamed";
}

const buildDataUrl = (baseName: string) =>
  `https://raw.githubusercontent.com/snuggiettv/hellclock-data-export/refs/heads/main/data/${encodeURIComponent(
    baseName
  )}.json`;

// ---------- main ----------
export async function fetchRegistryFromMaster(): Promise<ConstellationEntry[]> {
  const res = await fetch(MASTER_URL);
  if (!res.ok) throw new Error(`Failed to fetch constellations: ${res.status}`);
  const master = await res.json();

  // Flatten to an array, then filter to ONLY constellation objects
  const rawList: any[] = Array.isArray(master)
    ? master
    : Array.isArray(master?.constellations)
    ? master.constellations
    : Object.values(master);

  const groups = rawList.filter(isConstellationEntry);

  const seen = new Map<string, number>();
  const entries = groups.map((g, idx) => {
    const def = g.definition ?? g;

    const label = englishName(def, g);
    const slug = slugify(label) || slugify(String(def?.id ?? "unnamed"));

    // ensure unique id
    const bump = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, bump);
    const id = bump === 1 ? slug : `${slug}-${bump}`;

    const baseName = fileBaseName(def, g, label); // case-preserved for GitHub path
    const dataUrl = buildDataUrl(baseName);

    return {
      id,
      label,
      artBase: `${B}constellations/${slug}/`,
      dataUrl,
      group: g,
    } as ConstellationEntry;
  });

  entries.sort((a, b) => a.label.localeCompare(b.label));
  return entries;
}
