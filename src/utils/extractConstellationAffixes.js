/**
 * extractConstellationAffixes.tsx — COMMENTED
 *
 * Purpose
 *  Flatten the large Constellations.json export into small, uniform "affix rows"
 *  that the UI can consume for tooltips and the Stat Summary.
 *
 * What this file guarantees
 *  - Each affix row has:
 *      • nodeId: stable key for grouping (e.g., "<constellationId>:<node name>")
 *      • icon:   sprite key (UI decides how to resolve to an image URL)
 *      • pattern: EN text with digits replaced by '#' tokens (materializer fills them)
 *      • value:   structured numeric value when present (preferred source for math)
 *      • statKey: best-effort key for bucketing/labels (e.g., 'PhysicalDamage')
 *      • statModifierType: 'Additive' | 'Multiplicative' | 'MultiplicativeAdditive' | 'Unknown'
 *      • rawNumbers: fallback digits parsed from EN (do not use when structured values exist)
 *      • type?:  optional raw type from export (useful for QA/debug)
 *
 * Important conventions
 *  - We normalize numbers out of EN lines into a '#' token so later stages can
 *    inject the *structured* numbers consistently (materializeAffixLine).
 *  - We do NOT decide categories/sections here; that's a separate concern
 *    handled in MapStatSummary via statKey + rules.
 *  - This module should NOT perform math; it only extracts and normalizes.
 */
// src/utils/extractConstellationAffixes.tsx
// --- Helpers ---------------------------------------------------------------
// Extracts numbers from a string in the order they appear.
// Used only as a thin fallback/reference; do NOT use these for math
// when structured values (value, value2...) are available.
/** Matches numbers like 30, 1,200, 0.15, 15.0 etc. Used for simple EN parsing. */
const numberRegex = /(?<!\w)(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?/g;
/**
 * parseNumbersInOrder(s)
 *  Return digits in their textual order. This is ONLY a fallback for display
 *  and debugging; materialization & math should prefer structured fields.
 */
function parseNumbersInOrder(s) {
    return (s.match(numberRegex) || []).map(n => Number(n.replace(/,/g, "")));
}
// Replace all numbers in EN text with `#` tokens (collapsing repeats).
// Example: "Damage +30%[x]" -> "Damage +#%[x]"
// We keep `%[x]` / `%[+]` and other tokens untouched.
/**
 * normalizeNumbers(s)
 *  Replace every number with a single '#' token, collapsing repeats.
 *  This gives the 'pattern' consumed by the materializer.
 */
function normalizeNumbers(s) {
    return s.replace(numberRegex, "#").replace(/#+/g, "#").replace(/\s+/g, " ").trim();
}
// Pull the EN translation from either a string or an array of {langCode, langTranslation}.
/**
 * getEnDescription(desc)
 *  Robustly pull the English text from either a string or an array of translations.
 *  Returns `null` when missing; callers skip rows without EN text.
 */
function getEnDescription(desc) {
    if (!desc)
        return null;
    if (typeof desc === "string")
        return desc.trim();
    if (Array.isArray(desc)) {
        const en = desc.find((d) => d?.langCode === "en");
        return en?.langTranslation?.trim() ?? null;
    }
    return null;
}
// --- Extractor -------------------------------------------------------------
/**
 * Extract all affixes across all constellation nodes into a flat list.
 *
 * Why we normalize:
 *  - `pattern` is the human text with numbers replaced by `#` so a later
 *    "materializer" can inject structured numbers consistently and format them
 *    (e.g., factors -> % for %[x]).
 *  - `value` is the structured numeric input when present; prefer this over
 *    `rawNumbers` for any math/formatting.
 *  - `rawNumbers` exists only so we can *display* EN-derived digits if needed,
 *    but **do not** build game math from it.
 */
/**
 * extractConstellationAffixes(raw)
 *  Walk the constellations → nodes → affixes and emit one row per affix.
 *  - pattern uses normalizeNumbers(EN)
 *  - value pulls the structured numeric when present (preferred)
 *  - statKey picks the best available key for bucketing (definition → increment → devotion → type)
 *  - rawNumbers parsed from EN serve as a visual fallback ONLY
 */
export function extractConstellationAffixes(raw) {
    const rows = [];
    for (const c of raw.constellationsDetails ?? []) {
        const def = c?.definition;
        if (!def?.nodes)
            continue;
        const constId = def.id;
        for (const node of def.nodes) {
            // nodeId becomes "<constellationId>:<node name>" for easy grouping
            const nodeName = node?.name ?? node?.id ?? "";
            const nodeId = constId !== undefined ? `${constId}:${nodeName}` : String(nodeName);
            const icon = node?.sprite ?? ""; // UI decides how to resolve into URL
            for (const aff of node?.affixes ?? []) {
                const enText = getEnDescription(aff.description);
                if (!enText)
                    continue; // skip non-EN / empty lines
                // "pattern" is the EN line with numbers replaced by "#"
                const pattern = normalizeNumbers(enText);
                // statKey is our best handle for bucketing/labels:
                // prefer explicit keys, then fall back to the generic "type" string.
                const statKey = aff.eStatDefinition ||
                    aff.eCharacterIncrement ||
                    aff.eDevotionCategory ||
                    aff.type ||
                    "";
                rows.push({
                    nodeId,
                    icon,
                    pattern,
                    value: aff.value,
                    statKey,
                    statModifierType: aff.statModifierType || "Unknown",
                    rawNumbers: parseNumbersInOrder(enText),
                    // Keep the raw "type" available for callers that need it (optional)
                    type: aff.type,
                });
            }
        }
    }
    return rows;
}
