// src/devotion/requirements.ts
export type RGB = { Red: number; Green: number; Blue: number };
export type RequirementsMap = Record<string, { name: string; requirements: Partial<RGB> }>;

export async function loadRequirements(): Promise<RequirementsMap> {
  const res = await fetch('/data/constellation-requirements.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load requirements: ${res.status}`);
  return res.json() as Promise<RequirementsMap>;
}

export function meets(have: RGB, need?: Partial<RGB>) {
  if (!need) return true;
  return (have.Red   >= (need.Red   ?? 0)) &&
         (have.Green >= (need.Green ?? 0)) &&
         (have.Blue  >= (need.Blue  ?? 0));
}

export function missingText(have: RGB, need?: Partial<RGB>) {
  if (!need) return '';
  const miss: string[] = [];
  const delta = (h: number, n?: number) => Math.max(0, (n ?? 0) - h);
  const r = delta(have.Red,   need.Red);
  const g = delta(have.Green, need.Green);
  const b = delta(have.Blue,  need.Blue);
  if (r) miss.push(`Fury +${r}`);
  if (g) miss.push(`Discipline +${g}`);
  if (b) miss.push(`Faith +${b}`);
  return miss.join(' • ');
}
