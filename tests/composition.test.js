const test = require("node:test");
const assert = require("node:assert/strict");
const { CARDS, THEMES } = require("../public/card-schema");
const composition = require("../public/composition");
const { CARDS: routes } = require("../src/endpoints/catalog");
const { themes } = require("../src/common/themes");

function imageUrls(markup) {
  return [...markup.matchAll(/(?:src|srcset)="([^"]+)"/g)]
    .map((match) => new URL(match[1].replace(/&amp;/g, "&")));
}

test("both editors have all 26 renderable cards and the server's themes", () => {
  assert.deepEqual(Object.keys(CARDS).sort(), Object.keys(routes).filter((key) => !["health", "stack"].includes(key)).sort());
  assert.deepEqual(THEMES.slice().sort(), Object.keys(themes).sort());
  assert.ok(!CARDS.posts.params.find((param) => param.name === "source").options.includes("hashnode"));
});

test("edited settings survive transfer, saving, sharing, and README export", () => {
  const values = { name: "렌 ✨ & <hello>", subtitle: "a+b / c", theme: "tokyo_night", font: "manrope", width: 1100, height: 320, color: "f0abcd", hide_border: false, border_radius: "lg" };
  const block = composition.createCardBlock("hero", values);
  values.name = "another edit";
  const restored = composition.parseDraft(JSON.stringify({ v: 1, blocks: [block] }));
  const encoded = composition.encode(restored.blocks);
  assert.doesNotMatch(encoded, /[+/=]/);
  const shared = composition.decode(new URLSearchParams(`c=${encoded}`).get("c"));
  assert.deepEqual(shared, restored);
  assert.equal(shared.blocks[0].slots.name, "렌 ✨ & <hello>");
  const output = composition.serialize(shared.blocks, "https://profilekit.example");
  assert.doesNotMatch(output, /<picture>/);
  assert.equal(imageUrls(output)[0].pathname + imageUrls(output)[0].search, composition.cardUrl("hero", block.slots));
  assert.equal(imageUrls(output)[0].searchParams.get("hide_border"), "false");
});

test("every card can be transferred and exported without dropping its parameters", () => {
  for (const key of Object.keys(CARDS)) {
    const values = Object.fromEntries(CARDS[key].params.filter((p) => p.default != null).map((p) => [p.name, p.default]));
    values.theme = "rose_pine";
    const block = composition.createCardBlock(key, values);
    const [url] = imageUrls(composition.serialize([block], "https://example.com"));
    assert.equal(url.pathname + url.search, composition.cardUrl(key, values), key);
  }
});

test("automatic appearance is opt-in and keeps the saved design intact", () => {
  const block = composition.createCardBlock("hero", { name: "Ren", theme: "nord", font: "inter", bg_color: "123456", color: "aabbcc", theme_url: "https://gist.githubusercontent.com/a" });
  block.appearance = "auto";
  const before = JSON.stringify(block);
  const [dark, light] = imageUrls(composition.serialize([block], "https://example.com"));
  assert.equal(dark.searchParams.get("theme"), "dark");
  assert.equal(light.searchParams.get("theme"), "light");
  for (const url of [dark, light]) {
    assert.equal(url.searchParams.get("name"), "Ren");
    assert.equal(url.searchParams.get("font"), "inter");
    for (const key of ["theme_url", "bg_color", "color"]) assert.equal(url.searchParams.has(key), false);
  }
  assert.equal(JSON.stringify(block), before);
  assert.equal(composition.decode(composition.encode([block])).blocks[0].appearance, "auto");
});

test("legacy drafts and standard-base64 links preserve the original slots", () => {
  const legacy = { blocks: [{ type: "card", card_type: "snake", slots: { cols: 53, rows: 7, hide_border: true } }, { type: "markdown", content: "## 日本語 한글 😀" }] };
  const raw = JSON.stringify(legacy);
  const encoded = Buffer.from(raw).toString("base64");
  const parsed = composition.decode(encoded.replace(/\+/g, " "));
  assert.equal(parsed.blocks[0].slots.cols, "53");
  assert.equal(parsed.blocks[0].appearance, "selected");
  assert.equal(parsed.blocks[1].content, legacy.blocks[1].content);
});

test("false settings and zero values stay explicit in URLs", () => {
  const params = new URL(composition.cardUrl("typing", { loop: false, cursor: "false", pause: 0 }), "https://example.com").searchParams;
  assert.equal(params.get("loop"), "false");
  assert.equal(params.get("cursor"), "false");
  assert.equal(params.get("pause"), "0");
  for (const value of [false, "false", "0", "", undefined]) assert.equal(composition.isEnabled(value), false);
  for (const value of [true, "true", "yes", "1"]) assert.equal(composition.isEnabled(value), true);
});

test("explicitly cleared text survives draft and share restoration", () => {
  const block = composition.createCardBlock("hero", { name: "Ren", subtitle: "" });
  const restored = composition.decode(composition.encode([block]));
  assert.equal(restored.blocks[0].slots.subtitle, "");
  assert.equal(Object.hasOwn(restored.blocks[0].slots, "subtitle"), true);
  assert.equal(new URL(composition.cardUrl("hero", restored.blocks[0].slots), "https://example.com").searchParams.has("subtitle"), false);
});

test("long Markdown and aggregate document limits agree across save, share and export", () => {
  const blocks = [{ type: "markdown", content: "a".repeat(32769) }];
  const draft = JSON.stringify({ v: 1, blocks });
  assert.deepEqual(composition.parseDraft(draft).blocks, blocks);
  assert.deepEqual(composition.decode(composition.encode(blocks)).blocks, blocks);
  assert.equal(composition.serialize(blocks, "https://example.com"), blocks[0].content + "\n");

  const tooLarge = Array(9).fill(blocks[0]);
  assert.equal(composition.normalizeDocument({ v: 1, blocks: tooLarge }), null);
  assert.equal(composition.parseDraft(JSON.stringify({ v: 1, blocks: tooLarge })), null);
  assert.throws(() => composition.encode(tooLarge));
  assert.throws(() => composition.serialize(tooLarge, "https://example.com"));
});

test("invalid or oversized shared documents are rejected before rendering", () => {
  for (const value of [null, [], {}, { v: 2, blocks: [] }, { blocks: [null] }, { blocks: [{ type: "card", card_type: "constructor", slots: {} }] }, { blocks: [{ type: "markdown", content: {} }] }, { blocks: [{ type: "card", card_type: "hero", slots: [] }] }, { blocks: Array(65).fill({ type: "markdown", content: "a" }) }]) {
    assert.equal(composition.parseDraft(JSON.stringify(value)), null);
  }
  assert.equal(composition.parseDraft(" ".repeat(300000)), null);
  assert.equal(composition.decode("invalid!!"), null);
  assert.throws(() => composition.cardUrl("../../private", {}));
});

test("untrusted values cannot inject HTML, paths or prototype properties", () => {
  const values = JSON.parse('{"__proto__":{"polluted":true},"constructor":"bad","name":"\\\" /><script>alert(1)</script>","nested":{},"bg_color":"fff"}');
  const block = composition.createCardBlock("hero", values);
  assert.equal(Object.hasOwn(block.slots, "__proto__"), false);
  assert.equal(Object.hasOwn(block.slots, "constructor"), false);
  assert.equal(block.slots.nested, undefined);
  const output = composition.serialize([block], "https://example.com", () => '\" /><script>');
  assert.doesNotMatch(output, /<script>/);
  assert.equal(imageUrls(output)[0].searchParams.get("name"), values.name);
  assert.throws(() => composition.serialize([block], "javascript:alert(1)"));
});
