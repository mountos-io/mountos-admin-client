export type SkinMode = "light" | "dark";

export interface SkinColors {
  background: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  accentBlue: string;
  accentGreen: string;
  dangerRed: string;
  warningYellow: string;
  border: string;
}

export interface ThemePreset {
  name: string;
  family: string;
  mode: SkinMode;
  colors: SkinColors;
}

export const themePresets: ThemePreset[] = [
  {
    name: "mountOS Dark",
    family: "",
    mode: "dark",
    colors: {
      background: "#1F1F1F",
      cardBg: "#191919",
      textPrimary: "#F2F2F2",
      textSecondary: "#8C8C8C",
      primary: "#C4A851",
      accentBlue: "#4DB3E6",
      accentGreen: "#4DCC99",
      dangerRed: "#BB6660",
      warningYellow: "#E6BF4D",
      border: "#333333",
    },
  },
  {
    name: "Catppuccin Latte",
    family: "Catppuccin",
    mode: "light",
    colors: {
      background: "#eff1f5",
      cardBg: "#e6e9ef",
      textPrimary: "#4c4f69",
      textSecondary: "#1c1c2b",
      primary: "#8839ef",
      accentBlue: "#1e66f5",
      accentGreen: "#40a02b",
      dangerRed: "#d20f39",
      warningYellow: "#fe640b",
      border: "#ccd0da",
    },
  },
  {
    name: "Catppuccin Mocha",
    family: "Catppuccin",
    mode: "dark",
    colors: {
      background: "#1e1e2e",
      cardBg: "#181825",
      textPrimary: "#cdd6f4",
      textSecondary: "#6c7086",
      primary: "#cba6f7",
      accentBlue: "#89b4fa",
      accentGreen: "#a6e3a1",
      dangerRed: "#f38ba8",
      warningYellow: "#fab387",
      border: "#313244",
    },
  },
  {
    name: "Dracula",
    family: "",
    mode: "dark",
    colors: {
      background: "#282a36",
      cardBg: "#21222c",
      textPrimary: "#f8f8f2",
      textSecondary: "#6272a4",
      primary: "#bd93f9",
      accentBlue: "#8be9fd",
      accentGreen: "#50fa7b",
      dangerRed: "#ff5555",
      warningYellow: "#ffb86c",
      border: "#44475a",
    },
  },
  {
    name: "Gruvbox Dark",
    family: "Gruvbox",
    mode: "dark",
    colors: {
      background: "#1d2021",
      cardBg: "#282828",
      textPrimary: "#ebdbb2",
      textSecondary: "#928374",
      primary: "#d79921",
      accentBlue: "#458588",
      accentGreen: "#98971a",
      dangerRed: "#cc241d",
      warningYellow: "#d65d0e",
      border: "#3c3836",
    },
  },
  {
    name: "Gruvbox Light",
    family: "Gruvbox",
    mode: "light",
    colors: {
      background: "#fbf1c7",
      cardBg: "#f2e5bc",
      textPrimary: "#3c3836",
      textSecondary: "#7f4710",
      primary: "#d79921",
      accentBlue: "#458588",
      accentGreen: "#98971a",
      dangerRed: "#cc241d",
      warningYellow: "#d65d0e",
      border: "#d5c4a1",
    },
  },
  {
    name: "M365 Princess Dark",
    family: "M365 Princess",
    mode: "dark",
    colors: {
      background: "#1F1B2D",
      cardBg: "#2A2541",
      textPrimary: "#F0ECF4",
      textSecondary: "#8A839B",
      primary: "#9A348E",
      accentBlue: "#86BBD8",
      accentGreen: "#3BBEB5",
      dangerRed: "#DA627D",
      warningYellow: "#FCA17D",
      border: "#3D3655",
    },
  },
  {
    name: "M365 Princess Light",
    family: "M365 Princess",
    mode: "light",
    colors: {
      background: "#FCF5F8",
      cardBg: "#F3E8EE",
      textPrimary: "#2D2040",
      textSecondary: "#5e1593",
      primary: "#9A348E",
      accentBlue: "#33658A",
      accentGreen: "#047E84",
      dangerRed: "#CC3802",
      warningYellow: "#D48A5E",
      border: "#DEC8D6",
    },
  },
  {
    name: "Nord",
    family: "",
    mode: "dark",
    colors: {
      background: "#2e3440",
      cardBg: "#3b4252",
      textPrimary: "#eceff4",
      textSecondary: "#7b88a1",
      primary: "#88c0d0",
      accentBlue: "#81a1c1",
      accentGreen: "#a3be8c",
      dangerRed: "#bf616a",
      warningYellow: "#ebcb8b",
      border: "#434c5e",
    },
  },
  {
    name: "Tokyo Night",
    family: "Tokyo Night",
    mode: "dark",
    colors: {
      background: "#1a1b26",
      cardBg: "#24283b",
      textPrimary: "#c0caf5",
      textSecondary: "#565f89",
      primary: "#7aa2f7",
      accentBlue: "#2ac3de",
      accentGreen: "#9ece6a",
      dangerRed: "#f7768e",
      warningYellow: "#e0af68",
      border: "#3b4261",
    },
  },
  {
    name: "Tokyo Night Light",
    family: "Tokyo Night",
    mode: "light",
    colors: {
      background: "#d5d6db",
      cardBg: "#cbccd1",
      textPrimary: "#343b58",
      textSecondary: "#233a87",
      primary: "#34548a",
      accentBlue: "#166775",
      accentGreen: "#485e30",
      dangerRed: "#8c4351",
      warningYellow: "#8f5e15",
      border: "#b4b5b9",
    },
  },
];

export function presetsForMode(mode: SkinMode): ThemePreset[] {
  return themePresets.filter((p) => p.mode === mode);
}

export function defaultSkin(mode: SkinMode): string {
  return mode === "dark" ? "mountOS Dark" : "mountOS Light";
}

export function findPreset(name: string): ThemePreset | undefined {
  return themePresets.find((p) => p.name === name);
}

export function familyVariant(
  name: string,
  targetMode: SkinMode,
): ThemePreset | undefined {
  const current = findPreset(name);
  if (!current || !current.family) return undefined;
  return themePresets.find(
    (p) => p.family === current.family && p.mode === targetMode,
  );
}

export function applySkin(colors: SkinColors, mode: SkinMode) {
  const el = document.documentElement;
  const s = el.style;
  s.setProperty("--background", colors.background);
  s.setProperty("--foreground", colors.textPrimary);
  s.setProperty("--card", colors.cardBg);
  s.setProperty("--card-foreground", colors.textPrimary);
  s.setProperty("--popover", colors.cardBg);
  s.setProperty("--popover-foreground", colors.textPrimary);
  s.setProperty("--primary", colors.primary);
  s.setProperty(
    "--primary-foreground",
    mode === "dark" ? colors.background : "#ffffff",
  );
  s.setProperty(
    "--secondary",
    mode === "dark"
      ? lighten(colors.background, 0.08)
      : darken(colors.background, 0.06),
  );
  s.setProperty("--secondary-foreground", colors.textPrimary);
  s.setProperty(
    "--muted",
    mode === "dark"
      ? lighten(colors.background, 0.02)
      : darken(colors.background, 0.03),
  );
  s.setProperty("--muted-foreground", colors.textSecondary);
  s.setProperty(
    "--accent",
    mode === "dark"
      ? lighten(colors.background, 0.09)
      : darken(colors.background, 0.03),
  );
  s.setProperty("--accent-foreground", colors.textPrimary);
  s.setProperty("--destructive", colors.dangerRed);
  s.setProperty(
    "--destructive-foreground",
    mode === "dark" ? colors.textPrimary : "#ffffff",
  );
  s.setProperty("--warning", colors.warningYellow);
  s.setProperty(
    "--warning-foreground",
    mode === "dark" ? colors.background : colors.textPrimary,
  );
  s.setProperty("--success", colors.accentGreen);
  s.setProperty(
    "--success-foreground",
    mode === "dark" ? colors.background : "#ffffff",
  );
  s.setProperty("--border", colors.border);
  s.setProperty("--input", mode === "dark" ? colors.background : colors.cardBg);
  s.setProperty("--ring", colors.primary);
  s.setProperty(
    "--sidebar",
    mode === "dark" ? darken(colors.background, 0.02) : colors.background,
  );
  s.setProperty("--sidebar-foreground", colors.textPrimary);
  s.setProperty("--sidebar-primary", colors.textPrimary);
  s.setProperty("--sidebar-primary-foreground", colors.background);
  s.setProperty(
    "--sidebar-accent",
    mode === "dark"
      ? lighten(colors.background, 0.09)
      : darken(colors.background, 0.05),
  );
  s.setProperty("--sidebar-accent-foreground", colors.textPrimary);
  s.setProperty("--sidebar-border", colors.border);
  s.setProperty("--sidebar-ring", colors.textPrimary);
  s.setProperty("--scrollbar-thumb", colors.primary);
  s.setProperty("--scrollbar-track", colors.background);
}

export function clearSkin() {
  const el = document.documentElement;
  const props = [
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--secondary-foreground",
    "--muted",
    "--muted-foreground",
    "--accent",
    "--accent-foreground",
    "--destructive",
    "--destructive-foreground",
    "--warning",
    "--warning-foreground",
    "--success",
    "--success-foreground",
    "--border",
    "--input",
    "--ring",
    "--sidebar",
    "--sidebar-foreground",
    "--sidebar-primary",
    "--sidebar-primary-foreground",
    "--sidebar-accent",
    "--sidebar-accent-foreground",
    "--sidebar-border",
    "--sidebar-ring",
    "--scrollbar-thumb",
    "--scrollbar-track",
  ];
  props.forEach((p) => el.style.removeProperty(p));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.round(Math.max(0, Math.min(255, v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + 255 * amount, g + 255 * amount, b + 255 * amount);
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r - 255 * amount, g - 255 * amount, b - 255 * amount);
}
