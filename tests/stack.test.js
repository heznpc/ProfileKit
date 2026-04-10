const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getOuterAttrs,
  namespaceIds,
  positionSvg,
  stackVertical,
} = require("../src/common/stack");

const { buildStack, scopeParams, SUPPORTED_CARDS } = require("../api/stack");

const SAMPLE_SVG_A = `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="200" viewBox="0 0 495 200">
  <defs>
    <linearGradient id="accent-grad"><stop offset="0%" stop-color="#000"/></linearGradient>
    <clipPath id="card-clip"><rect width="494" height="199" rx="6"/></clipPath>
  </defs>
  <rect width="495" height="200" fill="url(#accent-grad)" clip-path="url(#card-clip)"/>
</svg>`;

const SAMPLE_SVG_B = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="100" viewBox="0 0 800 100">
  <defs>
    <linearGradient id="accent-grad"><stop offset="0%" stop-color="#fff"/></linearGradient>
  </defs>
  <rect width="800" height="100" fill="url(#accent-grad)"/>
</svg>`;

test("getOuterAttrs reads width and height", () => {
  const { width, height } = getOuterAttrs(SAMPLE_SVG_A);
  assert.equal(width, 495);
  assert.equal(height, 200);
});

test("namespaceIds prefixes id declarations", () => {
  const out = namespaceIds(SAMPLE_SVG_A, "p_");
  assert.ok(out.includes(`id="p_accent-grad"`));
  assert.ok(out.includes(`id="p_card-clip"`));
  assert.ok(!out.includes(`id="accent-grad"`));
});

test("namespaceIds rewrites url(#X) references", () => {
  const out = namespaceIds(SAMPLE_SVG_A, "p_");
  assert.ok(out.includes("url(#p_accent-grad)"));
  assert.ok(out.includes("url(#p_card-clip)"));
  assert.ok(!out.includes("url(#accent-grad)"));
});

test("positionSvg adds x and y to outer svg tag", () => {
  const out = positionSvg(SAMPLE_SVG_A, 10, 20);
  assert.match(out, /^<svg x="10" y="20"/);
});

test("positionSvg overwrites pre-existing x and y", () => {
  const positioned = positionSvg(SAMPLE_SVG_A, 5, 5);
  const repositioned = positionSvg(positioned, 50, 60);
  assert.match(repositioned, /^<svg x="50" y="60"/);
  // No leftover from the first positioning.
  const xMatches = repositioned.match(/x="\d+"/g) || [];
  // The first card body has rect x= attributes too — but those are inside.
  // The outer <svg ...> tag should have exactly one x="...".
  const outerTag = repositioned.match(/^<svg[^>]*>/)[0];
  assert.equal((outerTag.match(/\sx="/g) || []).length, 1);
  assert.equal((outerTag.match(/\sy="/g) || []).length, 1);
});

test("stackVertical produces a single outer svg with summed height", () => {
  const out = stackVertical([SAMPLE_SVG_A, SAMPLE_SVG_B], { gap: 16 });
  const { width, height } = getOuterAttrs(out);
  assert.equal(width, 800); // max
  assert.equal(height, 200 + 16 + 100);
  assert.ok(out.startsWith("<svg"));
  assert.ok(out.endsWith("</svg>"));
});

test("stackVertical namespaces ids per child to avoid clashes", () => {
  // Both samples define id="accent-grad". After stacking, both should still
  // exist (with different prefixes) so each child still resolves its own
  // gradient.
  const out = stackVertical([SAMPLE_SVG_A, SAMPLE_SVG_B], { gap: 16 });
  assert.ok(out.includes(`id="s0_accent-grad"`));
  assert.ok(out.includes(`id="s1_accent-grad"`));
  assert.ok(out.includes("url(#s0_accent-grad)"));
  assert.ok(out.includes("url(#s1_accent-grad)"));
});

test("stackVertical centers narrower children horizontally", () => {
  const out = stackVertical([SAMPLE_SVG_A, SAMPLE_SVG_B], { gap: 0 });
  // SAMPLE_SVG_A is 495 wide inside an 800-wide container — should be
  // centered at x = round((800 - 495) / 2) = 153.
  assert.match(out, /<svg x="153" y="0"[^>]*width="495"/);
  // The wider child (800) sits flush left at x=0.
  assert.match(out, /<svg x="0" y="200"[^>]*width="800"/);
});

test("stackVertical handles a single card (no gap)", () => {
  const out = stackVertical([SAMPLE_SVG_A], { gap: 16 });
  const { width, height } = getOuterAttrs(out);
  assert.equal(width, 495);
  assert.equal(height, 200);
});

test("stackVertical handles empty list", () => {
  const out = stackVertical([], { gap: 16 });
  assert.match(out, /^<svg[^>]*width="1"[^>]*height="1"/);
});

test("scopeParams routes top-level params to every card", () => {
  const params = new URLSearchParams("cards=hero,section&theme=tokyo_night&font=inter");
  const heroScoped = scopeParams(params, "hero");
  assert.equal(heroScoped.get("theme"), "tokyo_night");
  assert.equal(heroScoped.get("font"), "inter");
  // `cards` reserved key never propagates.
  assert.equal(heroScoped.get("cards"), null);
});

test("scopeParams applies per-card overrides", () => {
  const params = new URLSearchParams(
    "cards=hero,section&theme=dark&hero.theme=light&hero.name=Hi"
  );
  const heroScoped = scopeParams(params, "hero");
  const sectionScoped = scopeParams(params, "section");
  assert.equal(heroScoped.get("theme"), "light");
  assert.equal(heroScoped.get("name"), "Hi");
  assert.equal(sectionScoped.get("theme"), "dark");
  assert.equal(sectionScoped.get("name"), null);
});

test("scopeParams strips other cards' prefixed keys", () => {
  const params = new URLSearchParams(
    "cards=hero,section&hero.name=Hi&section.title=About"
  );
  const heroScoped = scopeParams(params, "hero");
  // Hero should NOT see `section.title` flattened to `title`.
  assert.equal(heroScoped.get("title"), null);
});

test("SUPPORTED_CARDS includes the v1 set", () => {
  for (const name of [
    "hero",
    "section",
    "divider",
    "now",
    "timeline",
    "tags",
    "toc",
    "stats",
    "languages",
  ]) {
    assert.ok(SUPPORTED_CARDS.includes(name), `expected ${name} supported`);
  }
});

test("buildStack returns error svg when ?cards is missing", async () => {
  const params = new URLSearchParams("");
  const { svg, ok } = await buildStack(params);
  assert.equal(ok, false);
  assert.ok(svg.includes("Missing ?cards"));
});

test("buildStack composes pure cards end-to-end", async () => {
  const params = new URLSearchParams(
    "cards=hero,section,divider&theme=tokyo_night&hero.name=Test&hero.width=800&hero.height=200&section.title=About&section.width=800&divider.width=800"
  );
  const { svg, ok } = await buildStack(params);
  assert.equal(ok, true);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.endsWith("</svg>"));
  assert.ok(!svg.includes("undefined"));
  assert.ok(!svg.includes("NaN"));
  // All three child viewports should be present.
  const childCount = (svg.match(/<svg x="\d+" y="\d+"/g) || []).length;
  assert.equal(childCount, 3);
});

test("buildStack renders an error card slot when an unknown card is requested", async () => {
  const params = new URLSearchParams("cards=hero,nonsense&hero.name=Hi");
  const { svg, ok } = await buildStack(params);
  assert.equal(ok, true);
  assert.ok(svg.includes("Unknown card"));
});

test("buildStack renders inline error when stats requires a token that's missing", async () => {
  const params = new URLSearchParams("cards=stats&stats.username=foo");
  const prevToken = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  try {
    const { svg, ok } = await buildStack(params);
    assert.equal(ok, true); // Outer request still succeeds; only the slot errors.
    assert.ok(svg.includes("GITHUB_TOKEN"));
  } finally {
    if (prevToken !== undefined) process.env.GITHUB_TOKEN = prevToken;
  }
});
