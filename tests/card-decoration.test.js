const test = require("node:test");
const assert = require("node:assert/strict");
const Decoration = require("../public/card-decoration");

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
