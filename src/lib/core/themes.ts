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

const WHITE = "oklch(1 0 0)";

export const themePresets: ThemePreset[] = [
  {
    name: "mountOS Light",
    family: "",
    mode: "light",
    colors: {
      background: "oklch(0.976 0.012 91.5)",
      cardBg: "oklch(0.958 0.018 92.7)",
      textPrimary: "oklch(0.203 0.010 67.2)",
      textSecondary: "oklch(0.493 0.025 69.4)",
      primary: "oklch(0.573 0.112 39.3)",
      accentBlue: "oklch(0.592 0.124 249.3)",
      accentGreen: "oklch(0.577 0.109 154.8)",
      dangerRed: "oklch(0.505 0.167 30.7)",
      warningYellow: "oklch(0.566 0.106 75.3)",
      border: "oklch(0.883 0.017 88.0)",
    },
  },
  {
    name: "mountOS Dark",
    family: "",
    mode: "dark",
    colors: {
      background: "oklch(0.239 0 89.9)",
      cardBg: "oklch(0.213 0 89.9)",
      textPrimary: "oklch(0.961 0 89.9)",
      textSecondary: "oklch(0.640 0 89.9)",
      primary: "oklch(0.739 0.111 91.7)",
      accentBlue: "oklch(0.728 0.119 233.6)",
      accentGreen: "oklch(0.761 0.135 163.3)",
      dangerRed: "oklch(0.606 0.110 25.1)",
      warningYellow: "oklch(0.818 0.137 90.0)",
      border: "oklch(0.321 0 89.9)",
    },
  },
  {
    name: "Catppuccin Latte",
    family: "Catppuccin",
    mode: "light",
    colors: {
      background: "oklch(0.958 0.006 264.5)",
      cardBg: "oklch(0.933 0.009 264.5)",
      textPrimary: "oklch(0.435 0.043 279.3)",
      textSecondary: "oklch(0.547 0.034 279.1)",
      primary: "oklch(0.555 0.250 297.0)",
      accentBlue: "oklch(0.559 0.226 262.1)",
      accentGreen: "oklch(0.625 0.177 140.4)",
      dangerRed: "oklch(0.5505 0.2155 19.81)",
      warningYellow: "oklch(0.7140 0.1494 67.78)",
      border: "oklch(0.857 0.014 268.5)",
    },
  },
  {
    name: "Catppuccin Mocha",
    family: "Catppuccin",
    mode: "dark",
    colors: {
      background: "oklch(0.243 0.030 283.9)",
      cardBg: "oklch(0.216 0.025 284.1)",
      textPrimary: "oklch(0.879 0.043 272.3)",
      textSecondary: "oklch(0.550 0.034 277.1)",
      primary: "oklch(0.787 0.119 304.8)",
      accentBlue: "oklch(0.766 0.111 259.9)",
      accentGreen: "oklch(0.858 0.109 142.7)",
      dangerRed: "oklch(0.756 0.130 2.8)",
      warningYellow: "oklch(0.919 0.070 86.5)",
      border: "oklch(0.324 0.032 282.0)",
    },
  },
  {
    name: "Dracula",
    family: "",
    mode: "dark",
    colors: {
      background: "oklch(0.288 0.022 277.5)",
      cardBg: "oklch(0.255 0.019 280.5)",
      textPrimary: "oklch(0.977 0.008 106.5)",
      textSecondary: "oklch(0.560 0.080 270.1)",
      primary: "oklch(0.742 0.149 301.9)",
      accentBlue: "oklch(0.883 0.093 212.8)",
      accentGreen: "oklch(0.871 0.220 148.0)",
      dangerRed: "oklch(0.682 0.206 24.4)",
      warningYellow: "oklch(0.955 0.134 112.8)",
      border: "oklch(0.403 0.032 277.8)",
    },
  },
  {
    name: "Gruvbox Dark",
    family: "Gruvbox",
    mode: "dark",
    colors: {
      background: "oklch(0.241 0.005 219.7)",
      cardBg: "oklch(0.277 0 89.9)",
      textPrimary: "oklch(0.894 0.057 89.2)",
      textSecondary: "oklch(0.619 0.029 67.3)",
      primary: "oklch(0.725 0.143 77.7)",
      accentBlue: "oklch(0.576 0.066 199.5)",
      accentGreen: "oklch(0.656 0.135 109.1)",
      dangerRed: "oklch(0.546 0.203 28.7)",
      warningYellow: "oklch(0.622 0.171 45.8)",
      border: "oklch(0.344 0.007 48.5)",
    },
  },
  {
    name: "Gruvbox Light",
    family: "Gruvbox",
    mode: "light",
    colors: {
      background: "oklch(0.956 0.055 96.2)",
      cardBg: "oklch(0.922 0.055 92.5)",
      textPrimary: "oklch(0.344 0.007 48.5)",
      textSecondary: "oklch(0.550 0.023 62.6)",
      primary: "oklch(0.725 0.143 77.7)",
      accentBlue: "oklch(0.576 0.066 199.5)",
      accentGreen: "oklch(0.656 0.135 109.1)",
      dangerRed: "oklch(0.546 0.203 28.7)",
      warningYellow: "oklch(0.622 0.171 45.8)",
      border: "oklch(0.825 0.051 85.1)",
    },
  },
  {
    name: "M365 Princess Dark",
    family: "M365 Princess",
    mode: "dark",
    colors: {
      background: "oklch(0.236 0.034 293.8)",
      cardBg: "oklch(0.284 0.051 291.0)",
      textPrimary: "oklch(0.948 0.011 308.3)",
      textSecondary: "oklch(0.624 0.036 298.7)",
      primary: "oklch(0.506 0.171 332.8)",
      accentBlue: "oklch(0.765 0.069 232.8)",
      accentGreen: "oklch(0.730 0.112 188.3)",
      dangerRed: "oklch(0.650 0.152 8.3)",
      warningYellow: "oklch(0.792 0.119 42.3)",
      border: "oklch(0.354 0.054 293.9)",
    },
  },
  {
    name: "M365 Princess Light",
    family: "M365 Princess",
    mode: "light",
    colors: {
      background: "oklch(0.976 0.008 349.2)",
      cardBg: "oklch(0.941 0.014 343.2)",
      textPrimary: "oklch(0.275 0.059 301.4)",
      textSecondary: "oklch(0.393 0.186 304.8)",
      primary: "oklch(0.506 0.171 332.8)",
      accentBlue: "oklch(0.489 0.080 242.8)",
      accentGreen: "oklch(0.540 0.091 200.7)",
      dangerRed: "oklch(0.561 0.192 35.9)",
      warningYellow: "oklch(0.700 0.108 50.9)",
      border: "oklch(0.855 0.031 339.3)",
    },
  },
  {
    name: "Nord",
    family: "",
    mode: "dark",
    colors: {
      background: "oklch(0.324 0.023 264.2)",
      cardBg: "oklch(0.379 0.029 266.5)",
      textPrimary: "oklch(0.951 0.007 260.7)",
      textSecondary: "oklch(0.686 0.008 268.5)",
      primary: "oklch(0.775 0.062 217.5)",
      accentBlue: "oklch(0.697 0.059 248.7)",
      accentGreen: "oklch(0.768 0.075 131.1)",
      dangerRed: "oklch(0.606 0.121 15.3)",
      warningYellow: "oklch(0.855 0.089 84.1)",
      border: "oklch(0.416 0.032 264.1)",
    },
  },
  {
    name: "Solarized Dark",
    family: "Solarized",
    mode: "dark",
    colors: {
      background: "oklch(0.267 0.049 219.8)",
      cardBg: "oklch(0.309 0.052 219.7)",
      textPrimary: "oklch(0.654 0.020 205.3)",
      textSecondary: "oklch(0.523 0.028 219.1)",
      primary: "oklch(0.654 0.134 85.7)",
      accentBlue: "oklch(0.615 0.139 244.9)",
      accentGreen: "oklch(0.644 0.151 118.6)",
      dangerRed: "oklch(0.586 0.206 27.1)",
      warningYellow: "oklch(0.581 0.173 39.5)",
      border: "oklch(0.372 0.063 217.5)",
    },
  },
  {
    name: "Solarized Light",
    family: "Solarized",
    mode: "light",
    colors: {
      background: "oklch(0.974 0.026 90.1)",
      cardBg: "oklch(0.931 0.026 92.4)",
      textPrimary: "oklch(0.568 0.029 221.9)",
      textSecondary: "oklch(0.698 0.016 196.8)",
      primary: "oklch(0.654 0.134 85.7)",
      accentBlue: "oklch(0.615 0.139 244.9)",
      accentGreen: "oklch(0.644 0.151 118.6)",
      dangerRed: "oklch(0.586 0.206 27.1)",
      warningYellow: "oklch(0.581 0.173 39.5)",
      border: "oklch(0.876 0.029 91.7)",
    },
  },
  {
    name: "Tokyo Night",
    family: "Tokyo Night",
    mode: "dark",
    colors: {
      background: "oklch(0.226 0.021 280.5)",
      cardBg: "oklch(0.282 0.036 274.7)",
      textPrimary: "oklch(0.846 0.061 274.8)",
      textSecondary: "oklch(0.633 0.003 264.5)",
      primary: "oklch(0.719 0.132 264.2)",
      accentBlue: "oklch(0.754 0.124 213.2)",
      accentGreen: "oklch(0.795 0.139 130.1)",
      dangerRed: "oklch(0.723 0.159 10.3)",
      warningYellow: "oklch(0.784 0.106 75.4)",
      border: "oklch(0.387 0.054 273.9)",
    },
  },
  {
    name: "Tokyo Night Light",
    family: "Tokyo Night",
    mode: "light",
    colors: {
      background: "oklch(0.877 0.007 277.2)",
      cardBg: "oklch(0.846 0.007 277.1)",
      textPrimary: "oklch(0.359 0.051 273.2)",
      textSecondary: "oklch(0.649 0.062 275.9)",
      primary: "oklch(0.448 0.097 260.3)",
      accentBlue: "oklch(0.474 0.076 212.3)",
      accentGreen: "oklch(0.452 0.074 129.9)",
      dangerRed: "oklch(0.480 0.100 9.5)",
      warningYellow: "oklch(0.523 0.104 71.0)",
      border: "oklch(0.774 0.006 274.9)",
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
    mode === "dark" ? colors.background : WHITE,
  );
  // Surface elevation ladder, mirrored per mode (lighten in dark, darken in light)
  // so muted < accent < sidebar-accent < secondary stay visually distinct.
  const elevate = (amount: number) =>
    mode === "dark" ? lift(colors.background, amount) : drop(colors.background, amount);
  s.setProperty("--secondary", elevate(0.09));
  s.setProperty("--secondary-foreground", colors.textPrimary);
  s.setProperty("--muted", elevate(0.03));
  s.setProperty("--muted-foreground", colors.textSecondary);
  s.setProperty("--accent", elevate(0.06));
  s.setProperty("--accent-foreground", colors.textPrimary);
  s.setProperty("--destructive", colors.dangerRed);
  s.setProperty(
    "--destructive-foreground",
    mode === "dark" ? colors.textPrimary : WHITE,
  );
  s.setProperty("--warning", colors.warningYellow);
  s.setProperty(
    "--warning-foreground",
    mode === "dark" ? colors.background : colors.textPrimary,
  );
  s.setProperty("--success", colors.accentGreen);
  s.setProperty(
    "--success-foreground",
    mode === "dark" ? colors.background : WHITE,
  );
  s.setProperty("--border", colors.border);
  s.setProperty("--input", mode === "dark" ? colors.background : colors.cardBg);
  s.setProperty("--ring", colors.primary);
  s.setProperty(
    "--sidebar",
    mode === "dark" ? drop(colors.background, 0.02) : colors.background,
  );
  s.setProperty("--sidebar-foreground", colors.textPrimary);
  s.setProperty("--sidebar-primary", colors.textPrimary);
  s.setProperty("--sidebar-primary-foreground", colors.background);
  s.setProperty("--sidebar-accent", elevate(0.075));
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

const OKLCH_RE = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/i;

function adjustL(color: string, delta: number): string {
  const m = color.match(OKLCH_RE);
  if (!m) return color;
  const L = Math.max(0, Math.min(1, parseFloat(m[1]) + delta));
  return `oklch(${L.toFixed(3)} ${m[2]} ${m[3]})`;
}

function lift(color: string, amount: number): string {
  return adjustL(color, amount);
}

function drop(color: string, amount: number): string {
  return adjustL(color, -amount);
}
