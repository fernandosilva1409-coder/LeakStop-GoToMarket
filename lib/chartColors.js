// Shared categorical palette for charts showing independent entities
// (ingredients, dishes, categories, weather conditions, suppliers…) where
// color helps tell bars/slices apart. Picked to harmonize with the warm
// cream/brass theme (tailwind.config.js) rather than a generic rainbow.
export const CHART_PALETTE = [
  "#C99A3D", // brass
  "#3D8C82", // teal
  "#8C5383", // plum
  "#3D6E8C", // slate blue
  "#B5432E", // rust
  "#4F7A3D", // olive
  "#D97B3D", // amber
  "#6E5A9C", // muted violet
];

export const paletteColor = (i) => CHART_PALETTE[i % CHART_PALETTE.length];
