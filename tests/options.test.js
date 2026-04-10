const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCardOptions, parseSearchParams } = require("../src/common/options");

const p = (q) => new URLSearchParams(q);

test("defaults to dark theme with no params", () => {
  const opts = parseCardOptions(p(""));
  assert.equal(opts.theme, "dark");
  assert.equal(opts.colors.bg, "#0d1117");
  assert.equal(opts.colors.title, "#e6edf3");
});

test("theme name is honored", () => {
  const opts = parseCardOptions(p("theme=light"));
  assert.equal(opts.theme, "light");
  assert.equal(opts.colors.bg, "#ffffff");
});

test("color overrides win over theme palette", () => {
  const opts = parseCardOptions(
    p("bg_color=ff0000&text_color=00ff00&title_color=0000ff&accent_color=ffff00&border_color=abcdef&icon_color=fedcba")
  );
  assert.equal(opts.colors.bg, "#ff0000");
  assert.equal(opts.colors.text, "#00ff00");
  assert.equal(opts.colors.title, "#0000ff");
  assert.equal(opts.colors.accent, "#ffff00");
  assert.equal(opts.colors.border, "#abcdef");
  assert.equal(opts.colors.icon, "#fedcba");
});

test("hide_* booleans accept true / 1 / yes", () => {
  const a = parseCardOptions(p("hide_border=true&hide_title=1&hide_bar=yes"));
  assert.equal(a.hideBorder, true);
  assert.equal(a.hideTitle, true);
  assert.equal(a.hideBar, true);
});

test("hide_* default to false", () => {
  const opts = parseCardOptions(p(""));
  assert.equal(opts.hideBorder, false);
  assert.equal(opts.hideTitle, false);
  assert.equal(opts.hideBar, false);
});

test("border_radius accepts both tokens and px", () => {
  assert.equal(parseCardOptions(p("border_radius=lg")).borderRadius, 6);
  assert.equal(parseCardOptions(p("border_radius=full")).borderRadius, 9999);
  assert.equal(parseCardOptions(p("border_radius=none")).borderRadius, 0);
  assert.equal(parseCardOptions(p("border_radius=20")).borderRadius, 20);
});

test("border_radius is undefined when missing (so cards apply their own default)", () => {
  assert.equal(parseCardOptions(p("")).borderRadius, undefined);
});

test("card_width is undefined when missing, parsed when present", () => {
  assert.equal(parseCardOptions(p("")).cardWidth, undefined);
  assert.equal(parseCardOptions(p("card_width=600")).cardWidth, 600);
  assert.equal(parseCardOptions(p("card_width=not-a-number")).cardWidth, 495);
});

test("font and title are exposed (null when missing)", () => {
  const empty = parseCardOptions(p(""));
  assert.equal(empty.font, null);
  assert.equal(empty.title, null);
  const present = parseCardOptions(p("font=inter&title=Hi"));
  assert.equal(present.font, "inter");
  assert.equal(present.title, "Hi");
});

test("parseSearchParams reads URL search params from a fake req", () => {
  const params = parseSearchParams({
    url: "/api/stats?username=foo&theme=light",
    headers: { host: "example.com" },
  });
  assert.equal(params.get("username"), "foo");
  assert.equal(params.get("theme"), "light");
});

test("parseSearchParams handles req without query string", () => {
  const params = parseSearchParams({
    url: "/api/stats",
    headers: { host: "example.com" },
  });
  assert.equal(params.get("anything"), null);
});
