import { useColorScheme } from "react-native";

/** The web app's palette, so the two do not drift into different products. */
const light = {
  paper: "#faf9f7",
  surface: "#ffffff",
  ink: "#1c1a19",
  muted: "#78716c",
  line: "#e7e2dc",
  accent: "#ef4056",
  accentSoft: "#fdecee",
};

const dark = {
  paper: "#121110",
  surface: "#1c1a19",
  ink: "#f5f3f1",
  muted: "#a8a29e",
  line: "#2e2b29",
  accent: "#ff5a6e",
  accentSoft: "#2a1a1d",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const radius = { card: 14, pill: 999, field: 10 };
