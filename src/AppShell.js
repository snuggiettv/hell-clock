import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import App from "./App";
import FullMap from "./components/FullMap";
import { Tabs } from "./components/ui/Tabs";
import DebugConstellationAudit from "./components/DebugConstellationAudit";
function useUrlBackedTab(paramKey, defaultValue) {
    const [state, setState] = React.useState(() => {
        const url = new URL(window.location.href);
        return url.searchParams.get(paramKey) || defaultValue;
    });
    React.useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set(paramKey, state);
        window.history.replaceState({}, "", url.toString());
    }, [paramKey, state]);
    return [state, setState];
}
export default function AppShell() {
    const [tab, setTab] = useUrlBackedTab("tab", "bells_infernal");
    const tabs = React.useMemo(() => [
        { id: "bells_infernal", label: "Infernal Bell" },
        { id: "bells_oblivion", label: "Oblivion Bell" },
        { id: "map", label: "Constellation Map (Full)" },
        { id: "qa", label: "QA Compare" },
    ], []);
    return (_jsxs("div", { style: { display: "grid", gridTemplateRows: "auto 1fr", height: "100vh" }, children: [_jsx("header", { style: { padding: "8px 12px" }, children: _jsx(Tabs, { tabs: tabs, value: tab, onChange: setTab }) }), _jsxs("main", { style: { minHeight: 0, height: '100%', position: "relative", overflow: 'hidden' }, children: [tab === "bells_infernal" && (_jsx(App, { initialUrl: "https://raw.githubusercontent.com/snuggiettv/hellclock-data-export/refs/heads/main/data/Infernal%20Bell.json", hideTreeSelector: true })), tab === "bells_oblivion" && (_jsx(App, { initialUrl: "https://raw.githubusercontent.com/snuggiettv/hellclock-data-export/refs/heads/main/data/Oblivion%20Bell.json", hideTreeSelector: true })), tab === "qa" && (_jsx("div", { style: { height: '100%', minHeight: 0, overflowY: 'auto' }, children: _jsx(DebugConstellationAudit, {}) })), tab === "map" && _jsx(FullMap, {})] })] }));
}
