const themes = {
  dark: {
    bg: "#0d1117",
    title: "#58a6ff",
    text: "#e6edf3",
    muted: "#8b949e",
    icon: "#58a6ff",
    border: "#30363d",
  },
  dark_dimmed: {
    bg: "#22272e",
    title: "#539bf5",
    text: "#adbac7",
    muted: "#768390",
    icon: "#539bf5",
    border: "#444c56",
  },
  light: {
    bg: "#ffffff",
    title: "#0969da",
    text: "#1f2328",
    muted: "#656d76",
    icon: "#0969da",
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
  return resolved;
}

module.exports = { themes, getTheme };
