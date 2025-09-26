const TOKEN_RX = /_+HIDE_+/; // match anywhere (__, ___, etc.)

function escapeRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function installHideScrubber() {
  let phraseRegexes: RegExp[] = [];

  async function loadOverrides() {
    try {
      const url = `${import.meta.env.BASE_URL}data/affix-overrides.json?v=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const json: Record<string, string> = await res.json();

      phraseRegexes = [];
      for (const [k, v] of Object.entries(json)) {
        if (v !== "__HIDE__") continue;
        if (k.includes("#")) {
          phraseRegexes.push(new RegExp("\\b" + escapeRx(k).replace(/#/g, "[-+]?\\d+(?:\\.\\d+)?") + "\\b"));
        } else {
          phraseRegexes.push(new RegExp("\\b" + escapeRx(k) + "\\b"));
        }
      }
    } catch {}
  }

  function shouldHideText(s: string) {
    if (!s) return false;
    const t = s.trim();
    if (TOKEN_RX.test(t)) return true;
    for (const rx of phraseRegexes) if (rx.test(t)) return true;
    return false;
  }

  function sweepNode(root: Node) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const toRemove: Element[] = [];
    while (walker.nextNode()) {
      const tn = walker.currentNode as Text;
      const txt = tn.nodeValue || "";
      if (shouldHideText(txt)) {
        const el = tn.parentElement;
        if (el) toRemove.push(el);
      }
    }
    toRemove.forEach(el => el.remove());
  }

  function sweepAll() {
    const letterbox = document.getElementById("letterbox-root");
    if (letterbox) sweepNode(letterbox);
    sweepNode(document.body);
  }

  // initial
  loadOverrides().then(sweepAll);

  // observe DOM
  const obs = new MutationObserver(() => sweepAll());
  obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  // rAF loop to catch rapid portal updates
  let running = true;
  function loop() {
    if (!running) return;
    sweepAll();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // (optionally expose a stop if needed)
  (window as any).__stopHideScrubber = () => { running = false; obs.disconnect(); };
}
