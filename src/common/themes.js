const themes = {
  dark: {
    bg: "#0d1117",
    title: "#e6edf3",
    text: "#c9d1d9",
    muted: "#8b949e",
    icon: "#8b949e",
    border: "#21262d",
  },
  dark_dimmed: {
    bg: "#22272e",
    title: "#adbac7",
    text: "#768390",
    muted: "#636e7b",
    icon: "#768390",
    border: "#373e47",
  },
  light: {
    bg: "#ffffff",
    title: "#1f2328",
    text: "#424a53",
    muted: "#656d76",
    icon: "#656d76",
    border: "#d0d7de",
  },
};

function getTheme(name, overrides = {}) {
  const base = themes[name] || themes.dark;
  const resolved = { ...base };
  for (const key of Object.keys(resolved)) {
    if (overrides[key]) {
      const v = overrides[key];
      resolved[key] = v.startsWith("#") ? v : `#${v}`;
    }
  }
  if (overrides.accent) {
    const v = overrides.accent;
    resolved.accent = v.startsWith("#") ? v : `#${v}`;
  }
  return resolved;
}

module.exports = { themes, getTheme };
