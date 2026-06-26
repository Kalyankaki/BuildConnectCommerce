/** Preset storefront themes resellers pick from (instead of raw color pickers). Pure data. */
export interface Theme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
}

export const THEMES: Theme[] = [
  { id: "midnight", name: "Midnight", primary: "#0f172a", secondary: "#64748b" },
  { id: "amber", name: "Amber Forge", primary: "#b45309", secondary: "#fcd34d" },
  { id: "forest", name: "Forest", primary: "#166534", secondary: "#86efac" },
  { id: "ocean", name: "Ocean", primary: "#1d4ed8", secondary: "#93c5fd" },
  { id: "crimson", name: "Crimson", primary: "#b91c1c", secondary: "#fca5a5" },
  { id: "plum", name: "Plum", primary: "#6d28d9", secondary: "#c4b5fd" },
];

export const DEFAULT_THEME = THEMES[0];

export function getTheme(id?: string | null): Theme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}

/** Best-effort: find the theme whose primary matches a stored color (for preselecting). */
export function themeForPrimary(primary?: string | null): Theme {
  return THEMES.find((t) => t.primary.toLowerCase() === (primary ?? "").toLowerCase()) ?? DEFAULT_THEME;
}
