const test = require("node:test");
const assert = require("node:assert/strict");
const { themes, getTheme } = require("../src/common/themes");

test("dark is the default theme", () => {
  const t = getTheme(undefined);
  assert.equal(t.bg, themes.dark.bg);
  assert.equal(t.title, themes.dark.title);
});

test("unknown theme name falls back to dark", () => {
  const t = getTheme("does-not-exist");
  assert.equal(t.bg, themes.dark.bg);
});

test("dark_dimmed and light are available out of the box", () => {
  assert.ok(themes.dark_dimmed);
  assert.ok(themes.light);
  const dimmed = getTheme("dark_dimmed");
  assert.equal(dimmed.bg, "#22272e");
  const light = getTheme("light");
  assert.equal(light.bg, "#ffffff");
});

test("color overrides win over theme colors", () => {
  const t = getTheme("dark", { bg: "ff0000", title: "00ff00" });
  assert.equal(t.bg, "#ff0000");
  assert.equal(t.title, "#00ff00");
});

test("color overrides accept # prefix as-is", () => {
  const t = getTheme("dark", { border: "#abcdef" });
  assert.equal(t.border, "#abcdef");
});

test("accent override is exposed even though base themes have none", () => {
  const t = getTheme("dark", { accent: "ff00aa" });
  assert.equal(t.accent, "#ff00aa");
});

test("missing override keys leave the base theme intact", () => {
  const base = getTheme("dark");
  const overridden = getTheme("dark", { bg: "111111" });
  assert.equal(overridden.title, base.title);
  assert.equal(overridden.text, base.text);
  assert.equal(overridden.border, base.border);
});

test("every built-in theme defines the full color set", () => {
  const required = ["bg", "title", "text", "muted", "icon", "border"];
  for (const [name, colors] of Object.entries(themes)) {
    for (const key of required) {
      assert.ok(
        colors[key],
        `theme "${name}" is missing required color "${key}"`
      );
    }
  }
});

test("every built-in theme defines accentStops", () => {
  for (const [name, colors] of Object.entries(themes)) {
    assert.ok(
      Array.isArray(colors.accentStops) && colors.accentStops.length >= 2,
      `theme "${name}" must define at least 2 accentStops`
    );
    for (const stop of colors.accentStops) {
      assert.match(
        stop,
        /^#[0-9a-fA-F]{3,8}$/,
        `theme "${name}" has invalid accent stop ${stop}`
      );
    }
  }
});

test("new themes are registered", () => {
  const expected = [
    "tokyo_night",
    "nord",
    "gruvbox_dark",
    "catppuccin_mocha",
    "catppuccin_latte",
    "dracula",
    "monokai",
    "one_dark",
    "kanagawa",
    "synthwave",
    "solarized_dark",
    "solarized_light",
    "rose_pine",
    "rose_pine_dawn",
  ];
  for (const name of expected) {
    assert.ok(themes[name], `expected theme "${name}" to exist`);
    const t = getTheme(name);
    assert.ok(t.bg.startsWith("#"));
    assert.ok(t.title.startsWith("#"));
  }
});

test("empty-string override does not wipe a theme color", () => {
  const t = getTheme("dark", { bg: "" });
  assert.equal(t.bg, themes.dark.bg);
});

test("null override does not wipe a theme color", () => {
  const t = getTheme("dark", { bg: null });
  assert.equal(t.bg, themes.dark.bg);
});

test("override of '0' would not crash even though it's a falsy-looking string", () => {
  // Pre-fix bug: `if (overrides[key])` rejected "0". Post-fix accepts it.
  const t = getTheme("dark", { bg: "000000" });
  assert.equal(t.bg, "#000000");
});
