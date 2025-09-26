
import * as React from "react";

export type TabItem = { id: string; label: string };

type TabsProps = {
  tabs: TabItem[];
  value: string;
  onChange: (next: string) => void;
};

export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #333" }}>
        {tabs.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              style={{
                padding: "8px 12px",
                border: "none",
                background: "transparent",
                borderBottom: active
                  ? "2px solid #9b87f5"
                  : "2px solid transparent",
                color: active ? "#fff" : "#bbb",
                cursor: "pointer",
                fontWeight: active ? 600 : 500,
              }}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
