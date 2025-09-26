// * /components/TreeSelector.tsx * //
import React from 'react';

interface TreeSelectorProps {
  selected: string;
  onChange: (value: string) => void;
}

const options = [
  {
    label: 'Infernal Bell',
    url: 'https://raw.githubusercontent.com/snuggiettv/hellclock-data-export/refs/heads/main/data/Infernal%20Bell.json',
  },
  {
    label: 'Oblivion Bell',
    url: 'https://raw.githubusercontent.com/snuggiettv/hellclock-data-export/refs/heads/main/data/Oblivion%20Bell.json',
  },
  {
    label: 'Constellation Map',
    url: 'https://raw.githubusercontent.com/snuggiettv/hellclock-data-export/refs/heads/main/data/Constellations.json',
  },
];

const TreeSelector: React.FC<TreeSelectorProps> = ({ selected, onChange }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 25,
        left: 75,
        zIndex: 25,
        backgroundColor: '#0b0b0f',
        color: '#fff',
        borderRadius: '10px',
        padding: '12px 16px',
        border: '2px solid #800080',
        boxShadow: '0 0 10px #800080',
        fontFamily: 'monospace',
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 6 }}>
        Select Tree
      </div>
      <select
        id="treeSelect"
        aria-label="Select skill tree"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 10px',
          backgroundColor: '#15101d',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: 6,
          fontSize: 14,
          fontFamily: 'monospace',
        }}
      >
        {options.map((opt) => (
          <option key={opt.label} value={opt.url}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TreeSelector;
