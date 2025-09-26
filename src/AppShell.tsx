
import * as React from "react";
import App from "./App";
import FullMap from "./components/FullMap";
import { Tabs } from "./components/ui/Tabs";
import DebugConstellationAudit from "./components/DebugConstellationAudit";

function useUrlBackedTab(paramKey: string, defaultValue: string) {
  const [state, setState] = React.useState<string>(() => {
    const url = new URL(window.location.href);
    return url.searchParams.get(paramKey) || defaultValue;
  });

  React.useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set(paramKey, state);
    window.history.replaceState({}, "", url.toString());
  }, [paramKey, state]);

  return [state, setState] as const;
}

export default function AppShell() {
  const [tab, setTab] = useUrlBackedTab("tab", "bells_infernal");

  const tabs = React.useMemo(
    () => [
      { id: "bells_infernal", label: "Infernal Bell" },
      { id: "bells_oblivion", label: "Oblivion Bell" },
      { id: "map", label: "Constellation Map (Full)" },
      { id: "qa", label: "QA Compare" },
    ],
    []
  );

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100vh" }}>
      <header style={{ padding: "8px 12px" }}>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </header>

      <main style={{ minHeight: 0, height: '100%', position: "relative", overflow: 'hidden' }}>
        {tab === "bells_infernal" && (
          <App
            initialUrl={"https://raw.githubusercontent.com/snuggiettv/hellclock-data-export/refs/heads/main/data/Infernal%20Bell.json"}
            hideTreeSelector
          />
        )}
        {tab === "bells_oblivion" && (
          <App
            initialUrl={"https://raw.githubusercontent.com/snuggiettv/hellclock-data-export/refs/heads/main/data/Oblivion%20Bell.json"}
            hideTreeSelector
          />
        )}
        {tab === "qa" && (
          <div style={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
            <DebugConstellationAudit />
          </div>
        )}
        {tab === "map" && <FullMap />}
      </main>
    </div>
  );
}
