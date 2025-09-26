// src/utils/safeJson.ts
export async function safeJson(urlOrPath) {
    const isAbsolute = /^https?:\/\//i.test(urlOrPath);
    const normalized = urlOrPath.replace(/^\/+/, '');
    const url = isAbsolute ? urlOrPath : `${import.meta.env.BASE_URL}${normalized}`;
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`[registry] HTTP ${res.status} at ${res.url}\n${text.slice(0, 200)}…`);
    }
    const trimmed = text.trim();
    if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
        throw new Error(`[registry] Expected JSON but got HTML from ${res.url}. Check BASE_URL or path/casing.`);
    }
    return JSON.parse(text);
}
