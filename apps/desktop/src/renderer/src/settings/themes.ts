/**
 * The Theme Press — six themes, each a different print process.
 *
 * Every theme is a full token set PLUS a type cast (which font plays
 * which role: display / UI / mono) and an ASCII specimen — the theme's
 * signature rendered in the glyph ramp, shown in the picker. Themes are
 * pure data: `applyTheme` writes `data-theme` and the CSS does the rest.
 *
 * Fonts stay the Signal cast (Instrument Serif, Space Grotesk, JetBrains
 * Mono — all SIL OFL, self-hosted); the THEME decides the casting, so a
 * theme can hand the display role to the serif OR keep it grotesk. No
 * theme retires the mono: labels/eyebrows stay mono everywhere.
 */

export interface ThemeTokens {
  bg: string;
  paper: string;
  paper2: string;
  paper3: string;
  ink: string;
  inkDim: string;
  inkFaint: string;
  line: string;
  lineSoft: string;
  lineStrong: string;
  /** the ONE accent — the live signal */
  accent: string;
  /** semantic hues (kept scarce; live=accent, busy/ai/error/info) */
  busy: string;
  ai: string;
  error: string;
  info: string;
}

/** Which font plays which role in this theme. */
export interface FontCast {
  display: string;
  ui: string;
  mono: string;
}

export interface Theme {
  id: string;
  label: string;
  /** one line: the print process this theme is */
  blurb: string;
  dark: boolean;
  tokens: ThemeTokens;
  cast: FontCast;
  /** ASCII specimen — the theme's mark, shown in the picker (≤5 lines) */
  specimen: string[];
}

const GROTESK = '"Space Grotesk Variable", "Space Grotesk", ui-sans-serif, sans-serif';
const SERIF = '"Instrument Serif", Georgia, serif';
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';

/**
 * Six themes — three dark prints, three light prints. Every hex authored
 * for this project; the print triad (cobalt/vermilion/ochre) and press
 * green come from SPEC.md's press-room direction, the dark ramps follow
 * the v0.1.44 luminance discipline (2-4% steps, hierarchy from luminance).
 */
export const THEMES: readonly [Theme, ...Theme[]] = [
  {
    id: "lab",
    label: "Lab",
    blurb: "the instrument — dark, stepped neutrals, phosphor signal",
    dark: true,
    tokens: {
      bg: "#07080A", paper: "#0C0D0F", paper2: "#111214", paper3: "#1B1C1E",
      ink: "#F2F1EE", inkDim: "#9C9C9D", inkFaint: "#6A6B6C",
      line: "rgba(255,255,255,0.07)", lineSoft: "rgba(255,255,255,0.04)", lineStrong: "rgba(255,255,255,0.12)",
      accent: "#5CE1A9", busy: "#E8B84B", ai: "#8F7BE8", error: "#E86A5E", info: "#56C2FF",
    },
    cast: { display: GROTESK, ui: GROTESK, mono: MONO },
    specimen: ["      .·∙        ", "   ·:∙•⦁∙:·       ", "  :∙●⦁⦁●∙:   live ", "   ·:∙•⦁∙:·       ", "      ·:·         "],
  },
  {
    id: "pressroom",
    label: "Press Room",
    blurb: "the print shop — warm cream, ink, print green",
    dark: false,
    tokens: {
      bg: "#F7F4EE", paper: "#FFFEFA", paper2: "#F1EDE3", paper3: "#E7E2D4",
      ink: "#1A1916", inkDim: "#5C584E", inkFaint: "#8D887B",
      line: "rgba(26,25,22,0.10)", lineSoft: "rgba(26,25,22,0.05)", lineStrong: "rgba(26,25,22,0.18)",
      accent: "#0E7A55", busy: "#9A6B14", ai: "#5B49B8", error: "#C2452D", info: "#2D4B8E",
    },
    cast: { display: SERIF, ui: GROTESK, mono: MONO },
    specimen: ["  ∙⦁●⦁∙          ", " ∙●⦁⦁⦁●∙  press  ", "  ∙⦁●⦁∙          ", "    ·∙·           ", "  ·:· ·:·  green  "],
  },
  {
    id: "nightink",
    label: "Night Ink",
    blurb: "the second print — deep ink-blue sheet, cream ink, cobalt",
    dark: true,
    tokens: {
      bg: "#0E1118", paper: "#14171D", paper2: "#191D25", paper3: "#232833",
      ink: "#EFEBE0", inkDim: "#9BA0AC", inkFaint: "#69707E",
      line: "rgba(239,235,224,0.08)", lineSoft: "rgba(239,235,224,0.04)", lineStrong: "rgba(239,235,224,0.14)",
      accent: "#6FA8FF", busy: "#E8B84B", ai: "#B39DFF", error: "#E86A5E", info: "#56C2FF",
    },
    cast: { display: SERIF, ui: GROTESK, mono: MONO },
    specimen: ["   ·:·            ", "  :∙•⦁∙:  night  ", " ∙●⦁⦁⦁●∙  ink    ", "  :∙•⦁∙:          ", "   ·:·            "],
  },
  {
    id: "letterpress",
    label: "Letterpress",
    blurb: "the bite — cold press, deep relief, vermilion ink",
    dark: true,
    tokens: {
      bg: "#101113", paper: "#16181B", paper2: "#1C1F23", paper3: "#272B30",
      ink: "#EFEAE2", inkDim: "#9A968E", inkFaint: "#6B6862",
      line: "rgba(239,234,226,0.08)", lineSoft: "rgba(239,234,226,0.04)", lineStrong: "rgba(239,234,226,0.14)",
      accent: "#E8563F", busy: "#E8B84B", ai: "#8F7BE8", error: "#E86A5E", info: "#56C2FF",
    },
    cast: { display: GROTESK, ui: GROTESK, mono: MONO },
    specimen: [" ##  ##  ##      ", " ##  ##  ##  bite", " ##  ##  ##      ", "                 ", "  #  #  #   ink  "],
  },
  {
    id: "lino",
    label: "Lino",
    blurb: "the proof — ochre sun on proofing white",
    dark: false,
    tokens: {
      bg: "#FAF6ED", paper: "#FFFFFF", paper2: "#F3EDDD", paper3: "#EAE2CC",
      ink: "#201C14", inkDim: "#5E564A", inkFaint: "#8F8678",
      line: "rgba(32,28,20,0.10)", lineSoft: "rgba(32,28,20,0.05)", lineStrong: "rgba(32,28,20,0.18)",
      accent: "#B56A0F", busy: "#9A6B14", ai: "#5B49B8", error: "#C2452D", info: "#2D4B8E",
    },
    cast: { display: SERIF, ui: GROTESK, mono: MONO },
    specimen: ["    ☀            ", "   ·∙•  lino     ", "  :∙•⦁  proof    ", "   ·∙•           ", "    ·            "],
  },
  {
    id: "daylight",
    label: "Daylight",
    blurb: "the studio at noon — clean white, LED green",
    dark: false,
    tokens: {
      bg: "#F2F0EA", paper: "#FFFFFF", paper2: "#F6F4EF", paper3: "#ECE9E0",
      ink: "#16181D", inkDim: "#565759", inkFaint: "#8A8B8D",
      line: "rgba(22,24,29,0.09)", lineSoft: "rgba(22,24,29,0.05)", lineStrong: "rgba(22,24,29,0.16)",
      accent: "#0E8A62", busy: "#9A6B14", ai: "#5B49B8", error: "#C23A2E", info: "#0B6B9E",
    },
    cast: { display: GROTESK, ui: GROTESK, mono: MONO },
    specimen: ["  ·∙•⦁∙·         ", "  ∙●⦁⦁⦁●∙  noon  ", "  ·∙•⦁∙·         ", "                 ", "  : : :  led     "],
  },
];

export const THEME_IDS = THEMES.map((t) => t.id) as readonly string[];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

const LS_KEY = "wf-theme";

/** Old skin flags migrate: lab→lab, daylight→daylight (same ids, lucky). */
export function readThemeId(): string {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && THEME_IDS.includes(saved)) return saved;
    // migrate the v0.1.44 skin keys
    const skin = localStorage.getItem("wf-skin");
    if (skin === "lab" || skin === "daylight") return skin;
  } catch {
    /* private mode */
  }
  return "lab";
}

/** Applies a theme by writing data-theme + the font-role custom properties.
 *  Pure DOM, safe to call from anywhere (used by App, picker, palette). */
export function applyTheme(id: string): void {
  const t = getTheme(id);
  const root = document.documentElement;
  root.dataset.theme = t.id;
  root.style.setProperty("--wf-display", t.cast.display);
  root.style.setProperty("--wf-ui", t.cast.ui);
  root.style.setProperty("--wf-mono", t.cast.mono);
  try {
    localStorage.setItem(LS_KEY, t.id);
  } catch {
    /* private mode */
  }
}
