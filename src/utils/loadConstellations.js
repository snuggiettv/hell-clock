const REMOTE_URL = "https://raw.githubusercontent.com/RogueSnail/hellclock-data-export/refs/heads/main/data/Constellations.json";
const LOCAL_URL = "/data/Constellations.json"; // your existing copy in /public/data
export async function loadConstellations() {
    // Try remote (fresh), then local (fallback)
    try {
        const r = await fetch(REMOTE_URL, { cache: "no-store" });
        if (!r.ok)
            throw new Error(`HTTP ${r.status}`);
        return await r.json();
    }
    catch {
        const r = await fetch(LOCAL_URL, { cache: "no-store" });
        if (!r.ok)
            throw new Error(`HTTP ${r.status} (local)`);
        return await r.json();
    }
}
