import { jsx as _jsx } from "react/jsx-runtime";
export function Tabs({ tabs, value, onChange }) {
    return (_jsx("div", { children: _jsx("div", { style: { display: "flex", gap: 8, borderBottom: "1px solid #333" }, children: tabs.map((t) => {
                const active = t.id === value;
                return (_jsx("button", { onClick: () => onChange(t.id), style: {
                        padding: "8px 12px",
                        border: "none",
                        background: "transparent",
                        borderBottom: active
                            ? "2px solid #9b87f5"
                            : "2px solid transparent",
                        color: active ? "#fff" : "#bbb",
                        cursor: "pointer",
                        fontWeight: active ? 600 : 500,
                    }, "aria-current": active ? "page" : undefined, children: t.label }, t.id));
            }) }) }));
}
