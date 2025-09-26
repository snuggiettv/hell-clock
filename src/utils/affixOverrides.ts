import { useEffect, useState } from "react";

export function useAffixOverrides(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = `${import.meta.env.BASE_URL}data/affix-overrides.json?v=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (alive) setMap(json || {});
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  return map;
}

// Replace all '#' with the numeric value. Empty string for any HIDE token.
export function materializeOverride(pattern: string | undefined, value: number | null | undefined): string | null {
  if (!pattern) return null;
  if (isHideToken(pattern)) return "";
  const v = Number(value ?? 0);
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
  return pattern.replace(/#/g, s);
}

// ---- helpers ----

// Accepts "__HIDE__", "___HIDE___", "_HIDE_", etc.
export function isHideToken(s?: string | null): boolean {
  if (!s) return false;
  return /^_+HIDE_+$/.test(s.trim());
}

// Find a phrase override with '#' wildcards.
// Example key: "Discipline Devotion +#"  → matches "Discipline Devotion +1"
export function findPhraseOverride(label: string, overrides: Record<string, string>): string | undefined {
  const direct = overrides[label];
  if (direct !== undefined) return direct;

  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const [k, v] of Object.entries(overrides)) {
    if (!k.includes("#")) continue;
    const rx = new RegExp("^" + esc(k).replace(/#/g, "[-+]?\\d+(?:\\.\\d+)?") + "$");
    if (rx.test(label)) return v;
  }
  return undefined;
}
