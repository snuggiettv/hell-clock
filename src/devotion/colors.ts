// src/devotion/colors.ts

// Basic RGB totals shape used by DevotionBadge and friends
export type RGB = { Red: number; Green: number; Blue: number };

// Human-readable labels shown in the UI
export const COLOR_LABEL = {
  Red: "Red",
  Green: "Green",
  Blue: "Blue",
} as const;

// (Optional) If you ever need color values elsewhere, keep these handy:
export const COLOR_HEX = {
  Red: "#ff4d4d",
  Green: "#6df2a3",
  Blue: "#7abfff",
} as const;
