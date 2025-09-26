import { classifySkillTags } from "./skillTagFilter";

export type ConstellationsConfig = {
  constellationsDetails: Array<{ definition: { id: number | string; nodes: Array<{
    name?: string; id?: string; sprite?: string;
    affixes?: Array<{
      type?: string; eStatDefinition?: string; eCharacterIncrement?: string; eDevotionCategory?: string;
      statModifierType?: string; value?: number; valuePerLevel?: number;
      description?: string | Array<{langCode:string; langTranslation:string}>;
    }>;
  }> }>;
};

export type ConstellationAffixRow = {
  nodeId: string; icon: string; pattern: string; value: number | null | undefined;
  statKey: string; statModifierType: string; skillTagFilter: string[];
};

const numberRegex = /(?<!\w)(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?/g;
const normalizeNumbers = (s:string)=>s.replace(numberRegex,"#").replace(/#+/g,"#").replace(/\s+/g," ").trim();
const getEn = (d:any)=>typeof d==="string"?d.trim():Array.isArray(d)?(d.find(x=>x?.langCode==="en")?.langTranslation?.trim()??null):null;

export function extractConstellationAffixesWithTags(raw: ConstellationsConfig): ConstellationAffixRow[] {
  const rows: ConstellationAffixRow[] = [];
  for (const c of raw.constellationsDetails ?? []) {
    const def = c?.definition; if (!def?.nodes) continue;
    const constId = def.id;
    for (const node of def.nodes) {
      const nodeName = node?.name ?? node?.id ?? "";
      const nodeId = constId!==undefined?`${constId}:${nodeName}`:String(nodeName);
      const icon = node?.sprite ?? "";
      for (const aff of node?.affixes ?? []) {
        const en = getEn(aff.description); if (!en) continue;
        const pattern = normalizeNumbers(en);
        const statKey = aff.eStatDefinition || aff.eCharacterIncrement || aff.eDevotionCategory || aff.type || "";
        rows.push({
          nodeId, icon, pattern, value: aff.value, statKey,
          statModifierType: aff.statModifierType || "Unknown",
          skillTagFilter: classifySkillTags(statKey),
        });
      }
    }
  }
  return rows;
}
