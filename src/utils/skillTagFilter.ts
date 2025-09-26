export function classifySkillTags(statKeyRaw: string): string[] {
  const k = String(statKeyRaw || ""); const tags = new Set<string>();
  if (k.endsWith("Resistance") || k.includes("Resistance")) {
    tags.add("Resistance"); ["Physical","Magic","Plague","Shock","Fire","Poison","Bleed","Blight"].forEach(e=>k.includes(e)&&tags.add(e));
  }
  if (k.includes("Damage") || k==="BaseDamage") {
    tags.add("Damage"); ["Physical","Magic","Plague","Bleed","Ignite","Poison","Shock","Summon","Spell","Melee"].forEach(kind=>k.includes(kind)&&tags.add(kind));
  }
  if (k.includes("Critical")) tags.add("Critical");
  if (k.includes("CooldownSpeed") || (k.includes("Cooldown") && k.includes("Speed"))) { tags.add("Cooldown"); tags.add("Cooldown Speed"); }
  if (k.includes("AttackSpeed") || (k.includes("Attack") && k.includes("Speed"))) tags.add("Attack Speed");
  if (k.includes("CastSpeed") || k.includes("CastingSpeed") || k.includes("SpellCast") || ((k.includes("Cast")||k.includes("Casting"))&&k.includes("Speed"))) tags.add("Cast Speed");
  if (k.includes("MovementSpeed") || (k.includes("Move") && k.includes("Speed"))) { tags.add("Movement"); tags.add("Movement Speed"); }
  if (k.includes("Speed") && !["Attack Speed","Cast Speed","Movement Speed","Cooldown Speed"].some(t=>tags.has(t))) tags.add("Speed (Other)");
  if (k.includes("Mana")) { tags.add("Mana"); tags.add("Resource"); }
  if (k.includes("Life") || k.includes("Barrier")) tags.add("Survivability");
  if (k.includes("Potion")) { tags.add("Potion"); tags.add("Survivability"); }
  if (k.includes("Gold") || k.includes("Soul")) tags.add("Economy");
  if (k.includes("Ailment")||k.includes("Buildup")||k.includes("Duration")||k.includes("Intensity")) {
    tags.add("Ailment"); ["Bleed","Ignite","Plague","Shock","Blight","Stun","Poison"].forEach(a=>k.includes(a)&&tags.add(a));
  }
  if (k.includes("Skill")) {
    tags.add("Skill");
    ({Area:"Area",Projectile:"Projectile",Melee:"Melee",Spell:"Spell",ManaCost:"Mana Cost"} as const);
    Object.entries({Area:"Area",Projectile:"Projectile",Melee:"Melee",Spell:"Spell",ManaCost:"Mana Cost"}).forEach(([needle,label])=>k.includes(needle)&&tags.add(label));
  }
  if (k.includes("Summon")) { tags.add("Summon"); tags.add("Companion"); }
  const tidy = (t:string)=>t.toUpperCase()===t?t:t.replace(/\b[a-z]/g,m=>m.toUpperCase());
  return Array.from(tags).sort().map(tidy);
}

