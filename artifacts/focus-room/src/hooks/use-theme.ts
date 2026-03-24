import { create } from "zustand";

export type AmbientTheme = "none" | "library" | "rain" | "night" | "coffee";
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
    if (colorTheme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
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
  if (color === "light") document.documentElement.classList.add("light");
  document.documentElement.setAttribute("data-ambient", ambient);
}

export const AMBIENT_THEMES: { id: AmbientTheme; label: string; emoji: string; description: string }[] = [
  { id: "none", label: "Default", emoji: "🌑", description: "Classic dark space" },
  { id: "library", label: "Library", emoji: "📚", description: "Warm wood & books" },
  { id: "rain", label: "Rain", emoji: "🌧️", description: "Rainy window vibes" },
  { id: "night", label: "Night Desk", emoji: "🌙", description: "Late night focus" },
  { id: "coffee", label: "Coffee Shop", emoji: "☕", description: "Cozy café energy" },
];
