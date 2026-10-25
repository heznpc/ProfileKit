const test = require("node:test");
const assert = require("node:assert/strict");
const Decoration = require("../public/card-decoration");

test("heartbeat referenced geometry inherits original paint and supports per-instance overrides", () => {
  const { renderHeartbeatCard } = require("../src/cards/heartbeat");
  const svg = renderHeartbeatCard({ colors: require("../src/common/themes").getTheme("dark"), width: 700, height: 220, bpm: 72 });
  const path = svg.match(/<path id="hb-path"[^>]*>/)[0];
  assert.doesNotMatch(path, /\s(?:fill|stroke)=/);
  assert.equal((svg.match(/<use href="#hb-path" fill="none" stroke="#[a-fA-F0-9]+"/g) || []).length, 2);
  const painted = Decoration.applyParts(svg, { waveform: { fill: "#1234fa", stroke: "#12ab34" } }, { endpoint: "heartbeat" });
  assert.equal((painted.match(/style="fill:#1234fa!important;stroke:#12ab34!important"/g) || []).length, 2);
  assert.ok(painted.includes(path));
});

test("shape paint is opt-in, rejects CSS injection and leaves clipping resources and text alone", () => {
  const card = { endpoint: "equalizer" };
  const svg = '<svg><g data-cas-target="bars"><defs><clipPath id="clip"><rect width="10"/></clipPath></defs><rect style="animation:pulse 1s" fill="#123"/><path fill="none"/><text>Keep</text></g><rect fill="#456"/></svg>';
  assert.equal(Decoration.applyParts(svg, undefined, card), svg);
  const output = Decoration.applyParts(svg, { bars: { fill: "#ABC", stroke: "none" } }, card);
  assert.ok(output.includes('<clipPath id="clip"><rect width="10"/></clipPath>'));
  assert.ok(output.includes('style="animation:pulse 1s;fill:#abc!important;stroke:none!important"'));
  assert.ok(output.includes('<text>Keep</text>'));
  assert.ok(output.endsWith('<rect fill="#456"/></svg>'));
  for (const fill of ['url(https://bad.test)', '#fff;opacity:0', 'red', 123]) {
    assert.throws(() => Decoration.normalizeParts(card, { bars: { fill } }));
  }
  assert.throws(() => Decoration.normalizeParts("hero", { name: { fill: "#fff" } }));
});

test("part registry, strict values and no-op normalization bound the decoration surface", () => {
  assert.deepEqual(Object.keys(Decoration.PARTS.hero), ["name", "subtitle", "bg", "accent"]);
  assert.equal(Decoration.PARTS.hero.bg.color, false);
  assert.equal(Decoration.normalizeParts("hero", { name: { dx: 0, dy: 0, scale: 1, hidden: false } }), undefined);
  assert.deepEqual(Decoration.normalizeParts("hero", { name: { dx: 1e6, dy: -1e6, scale: 8, color: "#ABC" } }), {
    name: { dx: 2048, dy: -2048, scale: 4, color: "#abc" },
  });
  for (const parts of [JSON.parse('{"__proto__":{}}'), { constructor: {} }, { name: { onclick: "bad" } },
    { name: { dx: NaN } }, { name: { dy: Infinity } }, { name: { scale: "2" } }, { name: { hidden: "false" } },
    { name: { color: "red;opacity:0" } }, { bg: { color: "#fff" } }]) {
    assert.throws(() => Decoration.normalizeParts("hero", parts));
  }
  assert.throws(() => Decoration.normalizeParts("stats", { name: { dx: 1 } }));
  assert.throws(() => Decoration.normalizeParts("section", { username: { dx: 1 } }));
  assert.throws(() => Decoration.applyParts("<svg/>", { "name] *": { color: "#fff" } }));
});

test("balanced target scanning retains nested groups, comments, quoted attributes and CSS", () => {
  const style = '<style>/* <g data-cas-target="repo"> */ .x { content: "<g>"; }</style>';
  const target = '<g data-cas-target="repo" transform="translate(25, 35)"><g><path d="M0 0"/></g><text data-note="a > b" style="font-weight:700">Repo<tspan fill="#123">name</tspan></text></g>';
  const outside = '<text class="outside">Untouched</text>';
  const svg = `<svg>${style}<!-- <g data-cas-target="repo"> -->${target}${outside}</svg>`;
  const result = Decoration.applyParts(svg, { repo: { dx: 10, dy: -4, scale: 2, color: "#ABC" } });
  assert.ok(result.includes(style));
  assert.ok(result.includes('<!-- <g data-cas-target="repo"> -->'));
  assert.ok(result.includes('<g transform="translate(10 -4) translate(25 35) scale(2) translate(-25 -35)">' + target.slice(0, target.indexOf("<text"))));
  assert.match(result, /style="font-weight:700;fill:#abc!important"/);
  assert.match(result, /<tspan fill="#123" style="fill:#abc!important">name<\/tspan>/);
  assert.ok(result.endsWith(`</text></g></g>${outside}</svg>`));
  assert.equal(Decoration.applyParts(svg, {}), svg);
  assert.throws(() => Decoration.applyParts('<svg><g data-cas-target="repo"><text>x</g></svg>', { repo: { dx: 1 } }), /unbalanced/);
});

test("part scaling preserves native text and group anchors without overwriting animation transforms", () => {
  const name = '<text x="300" y="98" class="hero-name" data-cas-target="name">Ren</text>';
  assert.equal(Decoration.applyParts(`<svg>${name}</svg>`, { name: { scale: 1.5 } }),
    `<svg><g transform="translate(0 0) translate(300 98) scale(1.5) translate(-300 -98)">${name}</g></svg>`);
  const desc = '<g data-cas-target="description"><text x="25" y="58">One</text><text x="25" y="76">Two</text></g>';
  assert.ok(Decoration.applyParts(`<svg>${desc}</svg>`, { description: { scale: 2 } }).includes('translate(25 58) scale(2) translate(-25 -58)'));
  const bg = '<g data-cas-target="bg"><rect x="50" y="40"/></g>';
  assert.ok(Decoration.applyParts(`<svg>${bg}</svg>`, { bg: { scale: 2 } }).includes('translate(0 0) scale(2) translate(0 0)'));
});

test("adjacent and nested targets close their wrappers in valid XML order and hiding retains content", () => {
  const svg = '<svg><text data-cas-target="name">One</text><g data-cas-target="subtitle"><text data-cas-target="username">Two</text></g></svg>';
  const result = Decoration.applyParts(svg, { name: { hidden: true }, subtitle: { hidden: true }, username: { color: "#fff" } });
  assert.equal(result, '<svg><g visibility="hidden"><text data-cas-target="name">One</text></g><g visibility="hidden"><g data-cas-target="subtitle"><g><text data-cas-target="username" style="fill:#fff!important">Two</text></g></g></g></svg>');
  // A second scanner pass rejects incorrect balancing instead of accepting a
  // superficially matching substring; the wrapper order above remains valid.
  assert.doesNotThrow(() => Decoration.applyParts(result, { name: { dx: 1 } }));
  assert.equal(Decoration.partMarkup('<text x="5" y="8">Text</text>', { hidden: true }), '<g visibility="hidden"><text x="5" y="8">Text</text></g>');
  assert.throws(() => Decoration.partMarkup('<text/><text/>', { hidden: true }), /one complete element/);
});

test("effects use a closed, bounded structure and canonicalize fully transparent effects away", () => {
  const effect = { kind: "shadow", color: "#ABC", blur: 99, opacity: 2, dx: 100, dy: -100 };
  assert.deepEqual(Decoration.normalizeEffect(effect), { kind: "shadow", color: "#abc", blur: 40, opacity: 1, dx: 80, dy: -80 });
  assert.equal(Decoration.normalizeEffect({ ...effect, opacity: 0 }), undefined);
  for (const overrides of [{ kind: "url(bad)" }, { color: "url(bad)" }, { blur: NaN }, { dy: Infinity }, { opacity: "1" }, { filter: "bad" }]) {
    assert.throws(() => Decoration.normalizeEffect({ ...effect, ...overrides }));
  }
});

test("stack targets distinguish duplicate children and shared part names without rewriting source markup", () => {
  const card = { endpoint: "stack", params: { cards: "hero,hero,section" } };
  const definitions = Decoration.partDefinitions(card);
  assert.ok(definitions["stack-0-hero-name"]);
  assert.ok(definitions["stack-1-hero-name"]);
  assert.ok(definitions["stack-2-section-subtitle"]);
  assert.throws(() => Decoration.normalizeParts(card, { "stack-2-hero-name": { dx: 4 } }));
  assert.throws(() => Decoration.normalizeParts(card, { "stack-0-hero-bg": { color: "#fff" } }));
  const child = '<svg><g data-cas-target="subtitle"><text>Intro</text></g></svg>';
  const svg = '<svg><!-- <svg/> -->' + child.repeat(3) + '</svg>';
  const parts = { "stack-1-hero-subtitle": { dx: 12, color: "#abc" }, "stack-2-section-subtitle": { hidden: true } };
  const output = Decoration.applyParts(svg, parts, card);
  assert.equal((output.match(/translate\(12 0\)/g) || []).length, 1);
  assert.equal((output.match(/fill:#abc!important/g) || []).length, 1);
  assert.match(output, /<g visibility="hidden"><g data-cas-target="stack-2-section-subtitle"/);
  assert.ok(svg.includes('data-cas-target="subtitle"'));
  assert.ok(!svg.includes('stack-'));
  const changed = { ...card, params: { cards: "section,hero" } };
  assert.equal(Decoration.partDefinitions(changed)["stack-0-hero-name"], undefined);
  assert.throws(() => Decoration.normalizeParts(changed, { "stack-2-section-subtitle": { dx: 1 } }));
  const scoped = Decoration.scopeStackTargets(svg, card);
  assert.equal(Decoration.scopeStackTargets(scoped, card), scoped);
});
