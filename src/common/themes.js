// Theme palette. Each theme defines its base colors plus an `accentStops`
// array used by `card.js` for the top accent bar gradient. A caller can
// override the gradient with `?accent_color=` (collapses to a single color)
// or override any individual color via `?bg_color=` etc.
//
// To add a new theme: drop a new entry below — every endpoint picks it up
// automatically because they all funnel through `parseCardOptions`.

const themes = {
  dark: {
    bg: "#0d1117",
    title: "#e6edf3",
    text: "#c9d1d9",
    muted: "#8b949e",
    icon: "#8b949e",
    border: "#21262d",
    accentStops: ["#3fb950", "#a371f7", "#f778ba"],
  },
  dark_dimmed: {
    bg: "#22272e",
    title: "#adbac7",
    text: "#768390",
    muted: "#636e7b",
    icon: "#768390",
    border: "#373e47",
    accentStops: ["#54aeff", "#c297ff", "#f47067"],
  },
  light: {
    bg: "#ffffff",
    title: "#1f2328",
    text: "#424a53",
    muted: "#656d76",
    icon: "#656d76",
    border: "#d0d7de",
    accentStops: ["#1f883d", "#8250df", "#cf222e"],
  },
  tokyo_night: {
    bg: "#1a1b26",
    title: "#c0caf5",
    text: "#a9b1d6",
    muted: "#565f89",
    icon: "#7aa2f7",
    border: "#292e42",
    accentStops: ["#7aa2f7", "#bb9af7", "#f7768e"],
  },
  nord: {
    bg: "#2e3440",
    title: "#eceff4",
    text: "#d8dee9",
    muted: "#4c566a",
    icon: "#88c0d0",
    border: "#3b4252",
    accentStops: ["#88c0d0", "#81a1c1", "#5e81ac"],
  },
  gruvbox_dark: {
    bg: "#282828",
    title: "#ebdbb2",
    text: "#d5c4a1",
    muted: "#928374",
    icon: "#fabd2f",
    border: "#3c3836",
    accentStops: ["#fb4934", "#fabd2f", "#b8bb26"],
  },
  catppuccin_mocha: {
    bg: "#1e1e2e",
    title: "#cdd6f4",
    text: "#bac2de",
    muted: "#6c7086",
    icon: "#cba6f7",
    border: "#313244",
    accentStops: ["#f5c2e7", "#cba6f7", "#89b4fa"],
  },
  catppuccin_latte: {
    bg: "#eff1f5",
    title: "#4c4f69",
    text: "#5c5f77",
    muted: "#8c8fa1",
    icon: "#8839ef",
    border: "#ccd0da",
    accentStops: ["#ea76cb", "#8839ef", "#1e66f5"],
  },
  dracula: {
    bg: "#282a36",
    title: "#f8f8f2",
    text: "#f8f8f2",
    muted: "#6272a4",
    icon: "#bd93f9",
    border: "#44475a",
    accentStops: ["#bd93f9", "#ff79c6", "#8be9fd"],
  },
  monokai: {
    bg: "#272822",
    title: "#f8f8f2",
    text: "#f8f8f2",
    muted: "#75715e",
    icon: "#a6e22e",
    border: "#3e3d32",
    accentStops: ["#f92672", "#fd971f", "#e6db74"],
  },
  one_dark: {
    bg: "#282c34",
    title: "#abb2bf",
    text: "#abb2bf",
    muted: "#5c6370",
    icon: "#61afef",
    border: "#3e4451",
    accentStops: ["#61afef", "#c678dd", "#e06c75"],
  },
  kanagawa: {
    bg: "#1f1f28",
    title: "#dcd7ba",
    text: "#dcd7ba",
    muted: "#727169",
    icon: "#7e9cd8",
    border: "#2a2a37",
    accentStops: ["#7e9cd8", "#957fb8", "#ffa066"],
  },
  synthwave: {
    bg: "#241b2f",
    title: "#ffffff",
    text: "#ffffff",
    muted: "#848bbd",
    icon: "#ff7edb",
    border: "#34294f",
    accentStops: ["#ff7edb", "#03edf9", "#fede5d"],
  },
  solarized_dark: {
    bg: "#002b36",
    title: "#93a1a1",
    text: "#839496",
    muted: "#586e75",
    icon: "#2aa198",
    border: "#073642",
    accentStops: ["#268bd2", "#2aa198", "#859900"],
  },
  solarized_light: {
    bg: "#fdf6e3",
    title: "#586e75",
    text: "#657b83",
    muted: "#93a1a1",
    icon: "#2aa198",
    border: "#eee8d5",
    accentStops: ["#268bd2", "#2aa198", "#859900"],
  },
  rose_pine: {
    bg: "#191724",
    title: "#e0def4",
    text: "#e0def4",
    muted: "#6e6a86",
    icon: "#c4a7e7",
    border: "#26233a",
    accentStops: ["#eb6f92", "#c4a7e7", "#9ccfd8"],
  },
  rose_pine_dawn: {
    bg: "#faf4ed",
    title: "#575279",
    text: "#575279",
    muted: "#9893a5",
    icon: "#907aa9",
    border: "#f2e9e1",
    accentStops: ["#b4637a", "#907aa9", "#56949f"],
  },
};

const OVERRIDE_KEYS = ["bg", "title", "text", "muted", "icon", "border", "accent"];

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// Returns the normalized #-prefixed hex value, or `null` if the input is not
// a valid 3/6/8-digit hex color. Previously this function accepted anything
// and just slapped a `#` in front, which let junk like `?bg_color=zzz` land
// in SVG `fill="#zzz"` attributes — browsers ignored them, but it was also a
// stepping-stone for attribute-value escape tricks.
function normalizeColor(v) {
  if (v == null || v === "") return null;
  const hex = String(v).startsWith("#") ? String(v) : `#${v}`;
  return HEX_COLOR_RE.test(hex) ? hex : null;
}

// Layer color overrides on top of a base palette. Used by both `getTheme`
// (built-in theme + ?bg_color= overrides) and `resolveCardOptions` (external
// theme palette + same overrides). Invalid hex values are silently ignored
// so the base palette keeps its value — tolerant UX for typos, strict SVG
// output.
function applyOverrides(base, overrides) {
  const resolved = { ...base };
  for (const key of OVERRIDE_KEYS) {
    const v = overrides[key];
    if (v == null || v === "") continue;
    const normalized = normalizeColor(v);
    if (normalized) resolved[key] = normalized;
  }
  return resolved;
}

function getTheme(name, overrides = {}) {
  return applyOverrides(themes[name] || themes.dark, overrides);
}

module.exports = { themes, getTheme, applyOverrides, normalizeColor, OVERRIDE_KEYS };
