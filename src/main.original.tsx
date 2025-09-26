import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import FullMap from './components/FullMap';

const qs = new URLSearchParams(window.location.search);
const truthy = (v?: string | null) => ['1', 'true', 'yes'].includes((v || '').toLowerCase());

// Flags (builder / fullmap modes)

const isBuilder = truthy(qs.get('builder')) || qs.get('mode') === 'builder';
const isFullMap = truthy(qs.get('fullmap')) || truthy(qs.get('map')) || qs.get('mode') === 'map';  // ← new

// Pick the root component
const Root = isBuilder
  ? FullMap
  : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
