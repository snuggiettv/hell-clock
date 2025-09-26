export type ConstellationsConfig = {
  constellationsDetails: Array<{
    definition: {
      id: number | string;
      nodes: Array<{
        name?: string;
        id?: string;
        sprite?: string;
        affixes?: Array<{
          type?: string;
          eStatDefinition?: string;
          eCharacterIncrement?: string;
          eDevotionCategory?: string;
          statModifierType?: string;
          value?: number;
          valuePerLevel?: number;
          description?:
            | string
            | Array<{ langCode: string; langTranslation: string }>;
        }>;
      }>;
    };
  }>;
};

const REMOTE_URL =
  "https://raw.githubusercontent.com/RogueSnail/hellclock-data-export/refs/heads/main/data/Constellations.json";
const LOCAL_URL = "/data/Constellations.json"; // your existing copy in /public/data

export async function loadConstellations(): Promise<ConstellationsConfig> {
  // Try remote (fresh), then local (fallback)
  try {
    const r = await fetch(REMOTE_URL, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
    const r = await fetch(LOCAL_URL, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} (local)`);
    return await r.json();
  }
}
