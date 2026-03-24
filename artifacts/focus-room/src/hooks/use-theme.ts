import { create } from "zustand";

export type AmbientTheme = "none" | "library" | "rain" | "night" | "coffee" | "home";
export type ColorTheme = "dark" | "light";

interface ThemeState {
  colorTheme: ColorTheme;
  ambientTheme: AmbientTheme;
  setColorTheme: (t: ColorTheme) => void;
  setAmbientTheme: (t: AmbientTheme) => void;
}

const savedColor = (localStorage.getItem("focus_color_theme") as ColorTheme) || "dark";
const savedAmbient = (localStorage.getItem("focus_ambient_theme") as AmbientTheme) || "none";

export const useThemeStore = create<ThemeState>((set) => ({
  colorTheme: savedColor,
  ambientTheme: savedAmbient,
  setColorTheme: (colorTheme) => {
    localStorage.setItem("focus_color_theme", colorTheme);
    document.documentElement.classList.toggle("light", colorTheme === "light");
    set({ colorTheme });
  },
  setAmbientTheme: (ambientTheme) => {
    localStorage.setItem("focus_ambient_theme", ambientTheme);
    document.documentElement.setAttribute("data-ambient", ambientTheme);
    set({ ambientTheme });
  },
}));

export function initTheme() {
  const color = (localStorage.getItem("focus_color_theme") as ColorTheme) || "dark";
  const ambient = (localStorage.getItem("focus_ambient_theme") as AmbientTheme) || "none";
  document.documentElement.classList.toggle("light", color === "light");
  document.documentElement.setAttribute("data-ambient", ambient);
}

export const AMBIENT_THEMES: {
  id: AmbientTheme;
  label: string;
  emoji: string;
  description: string;
  iconColor: string;
}[] = [
  { id: "none",    label: "Default",     emoji: "🌌", description: "Classic dark space",       iconColor: "#8B7CF6" },
  { id: "library", label: "Library",     emoji: "📚", description: "Warm wood & bookshelves",  iconColor: "#F59E0B" },
  { id: "rain",    label: "Rain",        emoji: "🌧️", description: "Stormy window vibes",       iconColor: "#60A5FA" },
  { id: "night",   label: "Night Desk",  emoji: "🌙", description: "Late-night lamp glow",      iconColor: "#FBBF24" },
  { id: "coffee",  label: "Coffee Shop", emoji: "☕", description: "Cozy café energy",          iconColor: "#F97316" },
  { id: "home",    label: "Home",        emoji: "🏠", description: "Cozy study room at home",   iconColor: "#4ADE80" },
];

export function getIconColor(theme: AmbientTheme): string {
  return AMBIENT_THEMES.find((t) => t.id === theme)?.iconColor ?? "#8B7CF6";
}
