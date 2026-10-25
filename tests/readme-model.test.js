const test = require("node:test");
const assert = require("node:assert/strict");
const Model = require("../public/readme-model");

const base = "https://profilekit.vercel.app/api/";
const image = (endpoint, query = "", rest = "") => `<img src="${base}${endpoint}${query ? `?${query}` : ""}"${rest}>`;
const update = (source, index, params) => {
  const card = Model.scan(source).cards[index];
  return Model.applyUpdates(source, [{ id: card.id, params: { ...card.params, ...params } }]);
};

// These compact fixtures preserve the structures observed in public READMEs:
// full-width banners, linked repository cards, picture branches, and Markdown.
const examples = [
  '<p align="center">\n  <img width="100%" src="https://profilekit.vercel.app/api/hero?name=Ghiara&amp;subtitle=Teaching+embodied+agents+to+learn%2C+adapt%2C+and+compose+skills&amp;bg=wave&amp;theme=tokyo_night&amp;font=space-grotesk&amp;width=900&amp;height=260" alt="Ghiara — Teaching embodied agents to learn, adapt, and compose skills">\n</p>',
  '<div align="center">\n  <picture>\n    <source media="(prefers-color-scheme: dark)" srcset="https://profilekit.vercel.app/api/stats?username=hellonish&amp;theme=dark" />\n    <img src="https://profilekit.vercel.app/api/stats?username=hellonish&amp;theme=light" alt="GitHub account statistics" width="49%" />\n  </picture>\n</div>',
  '<p align="center">\n  <a href="https://github.com/iam-faiza/Weather-App" target="_blank"><img src="https://profilekit.vercel.app/api/pin?card_width=400&username=iam-faiza&repo=Weather-App&hide_bar=true" /></a>\n</p>',
  '![Languages](https://profilekit.vercel.app/api/languages?username=cooocy&theme=synthwave&layout=compact&hide_border=true&hide_title=true&bg_color=1a1b27&text_color=AFCD53&accent_color=EE819E)\n![AI](https://wormhole.dcyy.cc/token-tide/token-usage/card.svg?period=7d&tool=all&theme=light&timezone=Asia%2FShanghai)',
  '<img src="https://profilekit.vercel.app/api/matrix?color=70A5FD&density=0.6&speed=0.5&width=900&height=220" width="100%"/>',
];

function outsideTargets(source, cards) {
  let value = source;
  for (const card of [...cards].sort((a, b) => b.start - a.start)) value = value.slice(0, card.start) + "[CARD]" + value.slice(card.end);
  return value;
}

test("real README structures round-trip exactly and style edits preserve all surrounding bytes", () => {
  for (const source of examples) {
    const scanned = Model.scan(source);
    assert.ok(scanned.cards.length);
    assert.equal(scanned.source, source);
    assert.equal(Model.applyUpdates(source, []), source);
    assert.equal(Model.applyUpdates(source, scanned.cards.map((card) => ({ id: card.id, params: card.params }))), source);
    const styled = Model.batchUpdate(source, { theme: "nord" });
    assert.equal(styled.changedCards, scanned.cards.length);
    assert.equal(outsideTargets(styled.source, Model.scan(styled.source).cards), outsideTargets(source, scanned.cards));
  }
});

test("picture source and fallback retain their 49% layout, metadata, and distinct branch themes", () => {
  const source = examples[1];
  const cards = Model.scan(source).cards;
  assert.deepEqual(cards.map((card) => card.variant), ["dark", "light"]);
  assert.equal(cards[0].groupId, cards[1].groupId);
  assert.deepEqual(cards.map((card) => card.width), ["49%", "49%"]);
  assert.deepEqual(cards.map((card) => card.alt), ["GitHub account statistics", "GitHub account statistics"]);
  assert.equal(cards[0].attribute, "srcset");
  const result = Model.batchUpdate(source, { fromAccount: "HELLONISH", toAccount: "new-user", darkTheme: "dracula", lightTheme: "catppuccin_latte" });
  assert.equal(result.changedCards, 2);
  assert.deepEqual(Model.scan(result.source).cards.map((card) => card.params.theme), ["dracula", "catppuccin_latte"]);
  assert.equal(result.source, source.replaceAll("username=hellonish", "username=new-user").replace("theme=dark", "theme=dracula").replace("theme=light", "theme=catppuccin_latte"));
});

test("query patch changes only requested values and retains ordering, encodings, and unknown keys", () => {
  const source = `prefix\r\n<img SRC='${base}hero?name=Hello+world&amp;theme=dark&#38;custom=%2f%7e&flag&unknown=a%20b' WIDTH='100%' />\r\nsuffix`;
  const next = update(source, 0, { theme: "nord", subtitle: 'A & "B" <C> (D)' });
  assert.equal(next, source.replace("theme=dark", "theme=nord").replace("unknown=a%20b", "unknown=a%20b&subtitle=A%20%26%20%22B%22%20%3CC%3E%20%28D%29"));
  const card = Model.scan(next).cards[0];
  const params = { ...card.params }; delete params.theme; delete params.flag;
  const removed = Model.applyUpdates(next, [{ id: card.id, params }]);
  assert.match(removed, /name=Hello\+world&#38;custom=%2f%7e&unknown=a%20b/);
  assert.equal(Model.scan(removed).cards[0].params.subtitle, 'A & "B" <C> (D)');
});

test("parameter removal and addition preserve URL fragments and unchanged percent encodings", () => {
  const source = `![x](${base}stats?username=Old%2DUser&theme=dark#gh-dark-mode-only)`;
  const card = Model.scan(source).cards[0];
  assert.equal(card.variant, "dark");
  const next = Model.applyUpdates(source, [{ id: card.id, params: { username: "Old-User" } }]);
  assert.equal(next, source.replace("&theme=dark", ""));
  assert.equal(Model.applyUpdates(source, [{ id: card.id, params: {} }]), `![x](${base}stats#gh-dark-mode-only)`);
  assert.equal(update(image("hero"), 0, { name: "Ren" }), image("hero", "name=Ren"));
});

test("duplicate URL occurrences are individually selectable and IDs survive parameter-length changes", () => {
  const single = image("stats", "username=old&theme=dark");
  const source = `${single}\n${single}`;
  const cards = Model.scan(source).cards;
  assert.equal(cards.length, 2);
  assert.notEqual(cards[0].id, cards[1].id);
  const result = Model.batchUpdate(source, { theme: "catppuccin_mocha", ids: [cards[1].id] });
  assert.equal(result.source, `${single}\n${single.replace("theme=dark", "theme=catppuccin_mocha")}`);
  assert.deepEqual(Model.scan(result.source).cards.map((card) => card.id), cards.map((card) => card.id));
});

test("repeated query parameters remain byte-exact on no-op and update consistently", () => {
  const source = image("stats", "username=old&theme=dark&theme=light&custom=x");
  const card = Model.scan(source).cards[0];
  assert.equal(card.params.theme, "dark");
  assert.equal(Model.applyUpdates(source, [{ id: card.id, params: card.params }]), source);
  assert.equal(update(source, 0, { theme: "nord" }), source.replace("theme=dark&theme=light", "theme=nord&theme=nord"));
});

test("Markdown image links, escaped labels, angle destinations, titles, and parentheses survive edits", () => {
  const source = `[![Stats \\[old\\]](<${base}hero?name=Hello\\(World\\)&theme=dark> "Profile card")](https://github.com/old?tab=repositories "Visit")`;
  const cards = Model.scan(source).cards;
  assert.equal(cards.length, 1);
  assert.equal(cards[0].alt, "Stats [old]");
  assert.equal(cards[0].linkUrl, "https://github.com/old?tab=repositories");
  assert.equal(update(source, 0, { theme: "nord" }), source.replace("theme=dark", "theme=nord"));
  assert.equal(cards[0].params.name, "Hello(World)");
});

test("shared and shortcut reference images patch their definition once and warn on all affected uses", () => {
  const source = `![First][Card]\n[![Second][card]](https://example.com)\n![Card][]\n![Card]\n\n[Card]: <${base}stats?username=old&theme=dark> "Shared card"\n[unused]: ${base}stats?username=other`;
  const parsed = Model.scan(source);
  assert.equal(parsed.cards.length, 1);
  assert.equal(parsed.cards[0].uses, 4);
  assert.equal(parsed.cards[0].attribute, "reference");
  assert.match(parsed.warnings[0], /shared reference definition \(4 images\)/);
  assert.equal(Model.batchUpdate(source, { theme: "nord" }).source, source.replace("theme=dark", "theme=nord"));
});

test("references shared with ordinary links block URL edits without changing their destinations", () => {
  for (const ordinaryLink of ["[Download original][ASSET]", "[asset][]", "[asset]", "[![Preview][asset]][asset]", "[See **[asset]**]"]) {
    const source = `![Card][asset]\n\n${ordinaryLink}\n\n[asset]: <${base}stats?username=alice&theme=dark> "Original"`;
    const parsed = Model.scan(source);
    assert.equal(parsed.cards.length, 1);
    assert.match(parsed.warnings.join("\n"), /ordinary link; URL edits are blocked.*own reference label/);
    assert.equal(Model.applyUpdates(source, [{ id: "card-1", params: parsed.cards[0].params }]), source);
    assert.throws(() => update(source, 0, { username: "bob" }), /own reference label/);
    const batch = Model.batchUpdate(source, { toAccount: "bob", theme: "nord" });
    assert.equal(batch.source, source);
    assert.equal(batch.changedCards, 0);
    assert.deepEqual(batch.changes, []);
    assert.match(batch.warnings.join("\n"), /URL edits are blocked/);
    assert.equal(Model.applyUpdates(source, [{ id: "card-1", alt: "New label" }]), source.replace("![Card]", "![New label]"));
  }
});

test("batch edits continue for independent cards while a shared ordinary link remains intact", () => {
  const source = `![Card][asset]\n\n[Download][asset]\n\n[asset]: ${base}stats?username=alice&theme=dark\n\n${image("stats", "username=carol&theme=dark")}`;
  const result = Model.batchUpdate(source, { toAccount: "bob", theme: "nord" });
  assert.equal(result.changedCards, 1);
  assert.equal(result.changes[0].id, "card-2");
  assert.equal(result.source, source.replace("username=carol&theme=dark", "username=bob&theme=nord"));
  assert.match(result.warnings.join("\n"), /card-1.*own reference label/);
});

test("reference-looking code, inline links, HTML attributes, and image labels do not block edits", () => {
  const source = [
    "![asset]", "![Second][asset]", "[asset](https://example.com)", "`[asset]`", "\\[asset]",
    '<span title="[asset]">text</span>', "", "    code", "    [asset]", "",
    `[asset]: ${base}stats?username=alice&theme=dark "[asset]"`,
  ].join("\n");
  const parsed = Model.scan(source);
  assert.equal(parsed.cards[0].uses, 2);
  assert.ok(parsed.warnings.every((warning) => !warning.includes("blocked")));
  assert.equal(Model.batchUpdate(source, { theme: "nord" }).source, source.replace("theme=dark", "theme=nord"));
});

test("full indented code blocks preserve Markdown and HTML examples across blank lines", () => {
  for (const indent of ["    ", "\t", "  \t"]) {
    const source = [
      "Example:", "", `${indent}code`, `${indent}![example](${base}stats?username=alice)`, "",
      `${indent}${image("stats", "username=alice")}`, `${indent}<div>`, `${indent}${image("hero", "name=Example")}`, `${indent}</div>`, "",
      image("stats", "username=visible"),
    ].join("\n");
    assert.equal(Model.scan(source).cards.length, 1);
    assert.equal(Model.applyUpdates(source, []), source);
    const result = Model.batchUpdate(source, { toAccount: "new-user" });
    assert.equal(result.changedCards, 1);
    assert.equal(result.source, source.replace("username=visible", "username=new-user"));
  }
  assert.equal(Model.scan(`    ${image("stats", "username=alice")}`).cards.length, 0);
  assert.equal(Model.scan(`Use \`<div>\`:\n\n    ${image("stats", "username=alice")}`).cards.length, 0);
});

test("indented HTML inside exposed layout containers stays editable after blank lines", () => {
  const source = `<div align="center">\n\n    <picture>\n\n        <source media="(prefers-color-scheme: dark)" srcset="${base}stats?username=alice&amp;theme=dark" />\n        ${image("stats", "username=alice&amp;theme=light", ' width="49%"')}\n    </picture>\n</div>\n\n    ${image("stats", "username=example")}`;
  const parsed = Model.scan(source);
  assert.equal(parsed.cards.length, 2);
  assert.deepEqual(parsed.cards.map((card) => card.variant), ["dark", "light"]);
  assert.equal(Model.applyUpdates(source, parsed.cards.map((card) => ({ id: card.id, params: card.params }))), source);
  const result = Model.batchUpdate(source, { toAccount: "bob" });
  assert.equal(result.changedCards, 2);
  assert.equal(result.source, source.replaceAll("username=alice", "username=bob"));
});

test("comments, fenced examples, inline code, raw code tags, and nonimage URLs are excluded", () => {
  const snippet = image("stats", "username=old");
  const source = [
    `<!-- ${snippet} -->`, "```html", snippet, "```", "~~~~", `![Example](${base}stats?username=old)`, "~~~~",
    `Use \`${snippet}\` or \`\`![x](${base}stats?username=old)\`\`.`, `<pre>${snippet}</pre>`,
    `<script>const example = '${snippet}';</script>`, `<a href="${base}stats?username=old">normal link</a>`,
    `[ordinary link](${base}stats?username=old)`, `${base}stats?username=old`, `\\![escaped](${base}stats?username=old)`,
    `<div title="![fake](${base}stats?username=old)">text</div>`, snippet,
  ].join("\n");
  assert.equal(Model.scan(source).cards.length, 1);
  const next = Model.batchUpdate(source, { toAccount: "new" });
  assert.equal(next.source, source.slice(0, -snippet.length) + snippet.replace("username=old", "username=new"));
});

test("multiple srcset candidates and image srcset preserve descriptors and other hosts", () => {
  const source = `<picture><source media='(prefers-color-scheme: light)' srcset='${base}stats?username=old&theme=light 1x, ${base}stats?username=old&theme=light 2x, https://example.com/other.png 3x'><img src='${base}stats?username=old&theme=dark' srcset='${base}stats?username=old&theme=dark 2x' width='49%'></picture>`;
  const parsed = Model.scan(source);
  assert.equal(parsed.cards.length, 4);
  assert.deepEqual(parsed.cards.map((card) => card.variant), ["light", "light", "dark", "dark"]);
  const next = Model.batchUpdate(source, { toAccount: "new" });
  assert.equal(next.source, source.replaceAll("username=old", "username=new"));
  assert.equal(Model.scan(`<video><source srcset="${base}stats?username=old"></video>`).cards.length, 0);
});

test("a literal comma inside a srcset query value is part of the URL", () => {
  const source = `<picture><source srcset="${base}tags?tags=one,two&theme=dark 1x, ${base}tags?tags=three,four&theme=dark 2x"><img src="fallback.png"></picture>`;
  const cards = Model.scan(source).cards;
  assert.deepEqual(cards.map((card) => card.params.tags), ["one,two", "three,four"]);
  assert.equal(Model.batchUpdate(source, { theme: "nord" }).source, source.replaceAll("theme=dark", "theme=nord"));
});

test("account replacement touches GitHub data only and preserves repository owners and destinations by default", () => {
  const source = [
    image("stats", "username=Old"), image("languages", "username=old"), image("reviews", "username=other"),
    image("leetcode", "username=old"), image("posts", "source=devto&username=old"), image("hero", "name=old&text=old&username=old"),
    image("social", "github=old&email=old%40example.com&linkedin=old"), image("snake", "username=old"),
    `<a href="https://github.com/old/project">${image("pin", "username=old&repo=project")}</a>`,
  ].join("\n");
  const result = Model.batchUpdate(source, { fromAccount: "old", toAccount: "new" });
  assert.equal(result.changedCards, 3);
  assert.equal(result.warnings.length, 1);
  const cards = Model.scan(result.source).cards;
  assert.deepEqual(cards.map((card) => card.params.username || card.params.github), ["new", "new", "other", "old", "old", "old", "new", "old", "old"]);
  assert.equal(cards[6].params.email, "old@example.com");
  assert.match(result.source, /href="https:\/\/github.com\/old\/project"/);
  assert.deepEqual(result.changes[0].keys, ["username"]);
  assert.equal(result.changes[0].before.username, "Old");
  assert.equal(result.changes[0].after.username, "new");
});

test("explicit repository owner changes require and update an exact paired repository link", () => {
  const source = `<a href="https://github.com/old/project?tab=readme&#38;ignored=a%2fb#top">${image("pin", "username=old&repo=project")}</a>\n${image("pin", "username=old&repo=other")}\n<a href="https://example.com/old/project">${image("pin", "username=old&repo=project")}</a>`;
  const result = Model.batchUpdate(source, { fromAccount: "old", toAccount: "new", includeRepositories: true });
  assert.equal(result.changedCards, 1);
  assert.equal(result.warnings.length, 2);
  assert.equal(result.source, source.replace("https://github.com/old/project", "https://github.com/new/project").replace("username=old&repo=project", "username=new&repo=project"));
});

test("repository links shared with unselected images or shared definitions remain unchanged", () => {
  const source = `<a href="https://github.com/old/project">${image("pin", "username=old&repo=project")}${image("pin", "username=old&repo=project")}</a>`;
  assert.equal(Model.batchUpdate(source, { toAccount: "new", includeRepositories: true, ids: ["card-1"] }).source, source);
  assert.equal(Model.batchUpdate(source, { toAccount: "new", includeRepositories: true }).changedCards, 2);
  const references = `[![One][repo]](https://github.com/old/project)\n[![Two][repo]](https://github.com/old/project)\n\n[repo]: ${base}pin?username=old&repo=project`;
  assert.equal(Model.batchUpdate(references, { toAccount: "new", includeRepositories: true }).source, references);
});

test("stack account and styling updates respect supported active scopes and leave unrelated identities alone", () => {
  const source = image("stack", "cards=hero,stats,languages,divider&username=old&stats.username=old&languages.username=other&hero.username=old&hero.name=old&leetcode.username=old&theme=dark&stats.theme=dark&font=inter&stats.font=inter&divider.font=legacy&color=FF0000&stats.accent_color=123456");
  const result = Model.batchUpdate(source, { fromAccount: "old", toAccount: "new", theme: "nord", font: "manrope", accentColor: "#abc" });
  const params = Model.scan(result.source).cards[0].params;
  assert.equal(params.username, "new"); assert.equal(params["stats.username"], "new");
  assert.equal(params["languages.username"], "other"); assert.equal(params["hero.username"], "old"); assert.equal(params["leetcode.username"], "old");
  assert.equal(params["hero.name"], "old"); assert.equal(params.color, "FF0000");
  assert.equal(params.theme, "nord"); assert.equal(params["stats.theme"], "nord");
  assert.equal(params.font, "manrope"); assert.equal(params["stats.font"], "manrope"); assert.equal(params["divider.font"], "legacy");
  assert.equal(params.accent_color, "abc"); assert.equal(params["stats.accent_color"], "abc");
  assert.equal(Model.batchUpdate(image("stack", "cards=hero,divider&username=old"), { toAccount: "new" }).changedCards, 0);
});

test("themes retain custom colors unless reset is explicit and font skips schema-incompatible endpoints", () => {
  const source = `${image("matrix", "text=hello&color=70A5FD&bg_color=000000&theme_url=https%3A%2F%2Fexample.com%2Ftheme&theme=dark")}\n${image("divider", "color=abcdef&theme=dark")}`;
  const result = Model.batchUpdate(source, { theme: "nord", font: "inter", accentColor: "#123456" });
  const [matrix, divider] = Model.scan(result.source).cards;
  assert.equal(matrix.params.color, "70A5FD"); assert.equal(matrix.params.bg_color, "000000"); assert.ok(matrix.params.theme_url);
  assert.equal(matrix.params.accent_color, "123456"); assert.equal(matrix.params.font, "inter"); assert.equal(divider.params.font, undefined);
  const reset = Model.batchUpdate(source, { theme: "nord", resetColors: true });
  assert.deepEqual(Model.scan(reset.source).cards.map((card) => Object.keys(card.params).filter((key) => key.includes("color") || key === "theme_url")), [[], []]);
});

test("HTML metadata edits preserve quote style and escape text; Markdown link and alt edits remain valid", () => {
  const source = `<a href='https://example.com/old'>${image("hero", "name=Hi", " alt='Before' width='49%'")}</a>`;
  const result = Model.applyUpdates(source, [{ id: "card-1", alt: 'A "quote" & <tag>', width: "50%", linkUrl: "https://example.com/new?a=1&b=2" }]);
  assert.match(result, /alt='A &quot;quote&quot; &amp; &lt;tag&gt;'/);
  assert.match(result, /width='50%'/);
  assert.match(result, /href='https:\/\/example.com\/new\?a=1&amp;b=2'/);
  assert.equal(Model.scan(result).cards[0].alt, 'A "quote" & <tag>');
  const markdown = `[![old](${base}hero)](https://example.com/old)`;
  const next = Model.applyUpdates(markdown, [{ id: "card-1", alt: "[new]", linkUrl: "https://example.com/a(b)" }]);
  assert.equal(Model.scan(next).cards[0].alt, "[new]");
  assert.equal(Model.scan(next).cards[0].linkUrl, "https://example.com/a(b)");
});

test("HTML source updates can share fallback metadata, and conflicting edits fail atomically", () => {
  const source = examples[1];
  const edits = [{ id: "card-1", width: "50%" }, { id: "card-2", width: "50%" }];
  assert.equal(Model.applyUpdates(source, edits), source.replace('width="49%"', 'width="50%"'));
  assert.throws(() => Model.applyUpdates(source, [{ id: "card-1", width: "50%" }, { id: "card-2", width: "60%" }]), /Conflicting/);
  const plain = image("stats", "username=old");
  const inserted = Model.applyUpdates(plain, [{ id: "card-1", alt: "Stats", width: "49%" }]);
  assert.equal(inserted, plain.replace(">", ' alt="Stats" width="49%">'));
});

test("only official or supplied deployment image URLs are eligible", () => {
  const source = [image("stats", "username=old"), '<img src="http://localhost:3000/api/stats?username=local">', '<img src="/api/stats?username=relative">', '<img src="https://profilekit.vercel.app.evil.test/api/stats?username=wrong">', '<img src="https://evil@profilekit.vercel.app/api/stats?username=wrong">', '<img src="javascript:alert(1)">', '<img src="https://profilekit.vercel.app/api/health">'].join("\n");
  assert.equal(Model.scan(source).cards.length, 2);
  assert.equal(Model.scan(source, { origin: "http://localhost:3000" }).cards.length, 3);
  assert.throws(() => Model.scan(source, { origin: "https://example.com/path" }), /Origin/);
});

test("unsafe keys, invalid batch values, unsafe links, and oversized inputs cannot mutate source", () => {
  const source = image("stats", "username=old");
  const params = JSON.parse('{"__proto__":"bad","username":"new"}');
  assert.throws(() => Model.applyUpdates(source, [{ id: "card-1", params }]), /Unsafe parameter/);
  assert.equal(Model.scan(image("stats", "username=old&__proto__=bad")).cards.length, 0);
  assert.throws(() => Model.batchUpdate(source, { toAccount: "not/a/user" }), /GitHub username/);
  assert.throws(() => Model.batchUpdate(source, { theme: "<script>" }), /Unsupported theme/);
  assert.throws(() => Model.batchUpdate(source, { font: "unknown" }), /Unsupported font/);
  assert.throws(() => Model.batchUpdate(source, { accentColor: "red;evil" }), /hex color/);
  assert.throws(() => Model.batchUpdate(source, { ids: ["card-404"] }), /unknown card/);
  assert.throws(() => Model.applyUpdates(`<a href="https://example.com">${source}</a>`, [{ id: "card-1", linkUrl: "javascript:alert(1)" }]), /unsafe/);
  assert.throws(() => Model.scan("a".repeat(Model.LIMITS.MAX_SOURCE_BYTES + 1)), /oversized/);
  assert.throws(() => Model.scan("界".repeat(400000)), /1 MiB/);
  assert.throws(() => Model.applyUpdates(source, [{ id: "card-1", params: { username: "\ud800" } }]), /invalid character/);
  assert.throws(() => Model.applyUpdates(source, [{ id: "card-1", width: "100.1%" }]), /percentage/);
  assert.throws(() => Model.applyUpdates(source, [{ id: "card-1", alt: {} }]), /text/);
});

test("README card capacity is independent of the eight-card design limit and preserves excess references", () => {
  const source = Array.from({ length: 251 }, (_, index) => image("stats", `username=user${index}&theme=dark`)).join("\n");
  const scan = Model.scan(source);
  assert.equal(scan.cards.length, 250);
  assert.match(scan.warnings[0], /first 250/);
  const result = Model.batchUpdate(source, { theme: "nord" });
  assert.equal(result.changedCards, 250);
  assert.ok(result.source.endsWith(image("stats", "username=user250&theme=dark")));
  assert.equal(Model.applyUpdates(source, []), source);
});

const Editor = require("../public/editor-model");
const Design = require("../public/card-design");
const live = (id, endpoint, params, extra = {}) => Editor.createElement("card", { id, endpoint, params, ...extra });
const designDoc = (...elements) => Editor.createDocument({ elements });
const designImage = (doc, rest = "") => image("design", `d=${Design.encodeDocument(doc)}`, rest);

test("decorated designs expose normalized documents and batch edits retain every non-parameter field", () => {
  const doc = designDoc(live("stats", "stats", { username: "Old", theme: "dark", accent_color: "fff" }, {
    x: 42, y: 19, rotation: 15, opacity: 0.8, sourceOrigin: "https://example.com", alt: "Original", displayWidth: "49%",
    parts: { username: { dx: 8, color: "#fa3" } }, effect: { kind: "shadow", color: "#000", blur: 10, opacity: 0.4, dx: 3, dy: 5 },
  }));
  const source = `<div class='keep'>${designImage(doc, " alt='External' width='49%'")}</div>`;
  assert.deepEqual(Model.scan(source).cards[0].design, doc);
  const result = Model.batchUpdate(source, { fromAccount: "old", toAccount: "new", theme: "nord", font: "inter", resetColors: true });
  assert.equal(result.changedCards, 1);
  const next = Model.scan(result.source).cards[0];
  assert.deepEqual(next.design, { ...doc, elements: [{ ...doc.elements[0], params: { username: "new", theme: "nord", font: "inter" } }] });
  assert.equal(outsideTargets(source, Model.scan(source).cards), outsideTargets(result.source, Model.scan(result.source).cards));
  assert.equal(next.alt, "External");
  assert.equal(next.width, "49%");
});

test("composed designs update matching embedded accounts and styles while preserving unrelated content", () => {
  const doc = designDoc(live("stats", "stats", { username: "old" }), live("langs", "languages", { username: "someone" }),
    live("social", "social", { github: "old", twitter: "old" }), live("stack", "stack", { cards: "stats,hero", "stats.username": "old", "stats.theme": "dark" }),
    Editor.createElement("text", { id: "caption", text: "old" }), Editor.createElement("rect", { id: "frame" }),
    Editor.createElement("image", { id: "photo", src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFElEQVR4nGN8WObCwMDAxAAGUAoAH3IBoeysng8AAAAASUVORK5CYII=" }));
  const source = designImage(doc);
  const result = Model.batchUpdate(source, { fromAccount: "old", toAccount: "new", theme: "nord" });
  const next = Model.scan(result.source).cards[0].design;
  assert.equal(next.elements[0].params.username, "new");
  assert.equal(next.elements[1].params.username, "someone");
  assert.equal(next.elements[2].params.github, "new");
  assert.equal(next.elements[2].params.twitter, "old");
  assert.equal(next.elements[3].params["stats.username"], "new");
  assert.equal(next.elements[3].params["stats.theme"], "nord");
  assert.deepEqual(next.elements.slice(4), doc.elements.slice(4));
});

test("unchanged noncanonical design data and HTML dark/light source layout remain exact", () => {
  const doc = designDoc(live("stats", "stats", { username: "old", theme: "dark" }));
  const encoded = Buffer.from(JSON.stringify(doc, null, 2)).toString("base64url");
  const source = `<picture>\n<source media='(prefers-color-scheme: dark)' srcset='${base}design?d=${encoded} 1x'>\n${designImage(doc, " alt='Stats' width='49%'")}\n</picture>`;
  assert.equal(Model.batchUpdate(source, {}).source, source);
  assert.equal(Model.batchUpdate(source, { fromAccount: "other", toAccount: "new", theme: "dark" }).source, source);
  assert.equal(Model.applyUpdates(source, [{ id: "card-1", params: Model.scan(source).cards[0].params }]), source);
  const next = Model.batchUpdate(source, { darkTheme: "nord", lightTheme: "light" });
  assert.deepEqual(Model.scan(next.source).cards.map((card) => card.design.elements[0].params.theme), ["nord", "light"]);
  assert.equal(outsideTargets(source, Model.scan(source).cards), outsideTargets(next.source, Model.scan(next.source).cards));
});

test("malformed, duplicate, unknown and oversized design parameters stay uneditable", () => {
  const d = Design.encodeDocument(designDoc(live("stats", "stats", { username: "old" })));
  for (const query of ["d=bad!", "d=", `d=${d}&d=${d}`, `d=${d}&extra=1`, `d=${"a".repeat(14001)}`, `d=${Buffer.from('{}').toString('base64url')}`]) {
    const source = image("design", query);
    assert.equal(Model.scan(source).cards.length, 0);
    assert.equal(Model.scan(source).warnings.length, 1);
    assert.equal(Model.batchUpdate(source, { theme: "nord" }).source, source);
  }
  const source = image("design", `d=${d}`);
  assert.throws(() => Model.applyUpdates(source, [{ id: "card-1", params: { d, theme: "nord" } }]), /one/);
});

test("design repository replacement respects embedded and external link protection", () => {
  const doc = designDoc(live("repo", "pin", { username: "old", repo: "project" }, { linkUrl: "https://github.com/old/project" }));
  const source = `<a href='https://github.com/old/project'>${designImage(doc)}</a>`;
  assert.equal(Model.batchUpdate(source, { toAccount: "new" }).source, source);
  const result = Model.batchUpdate(source, { toAccount: "new", includeRepositories: true });
  const card = Model.scan(result.source).cards[0];
  assert.equal(card.linkUrl, "https://github.com/new/project");
  assert.equal(card.design.elements[0].linkUrl, "https://github.com/new/project");
  assert.equal(card.design.elements[0].params.username, "new");
  const unrelated = source.replace("href='https://github.com/old/project'", "href='https://example.com/keep'");
  assert.equal(Model.batchUpdate(unrelated, { toAccount: "new", includeRepositories: true }).source, unrelated);
  const composed = designImage(designDoc(...doc.elements, Editor.createElement("text", { id: "text" })));
  assert.equal(Model.scan(Model.batchUpdate(composed, { toAccount: "new", includeRepositories: true }).source).cards[0].design.elements[0].params.username, "new");
});

test("validated URL replacements close the ordinary-to-design roundtrip while preserving metadata", () => {
  const doc = designDoc(live("stats", "stats", { username: "old" }));
  const url = `${base}design?d=${Design.encodeDocument(doc)}`;
  const source = `<a href='https://example.com/keep'>${image("stats", "username=old", " alt='Kept' width='49%'")}</a>`;
  const next = Model.applyUpdates(source, [{ id: "card-1", url }]);
  assert.deepEqual(Model.scan(next).cards[0].design, doc);
  assert.equal(outsideTargets(next, Model.scan(next).cards), outsideTargets(source, Model.scan(source).cards));
  assert.equal(Model.applyUpdates(next, [{ id: "card-1", url }]), next);
  for (const hostile of ["javascript:alert(1)", "https://evil.test/api/stats", `${base}design?d=invalid`, `${base}health`]) {
    assert.throws(() => Model.applyUpdates(source, [{ id: "card-1", url: hostile }]), /safe ProfileKit/);
  }
  assert.throws(() => Model.applyUpdates(source, [{ id: "card-1", url, params: {} }]), /cannot be combined/);
  const shared = `![image][ref]\n[link][ref]\n\n[ref]: ${base}stats?username=old`;
  assert.throws(() => Model.applyUpdates(shared, [{ id: "card-1", url }]), /shares reference/);
});

test("canonical URL no-ops preserve relative ordinary and design references exactly", () => {
  const encoded = Design.encodeDocument(designDoc(live("stats", "stats", { username: "old" })));
  for (const path of ["/api/hero?name=Hi", `/api/design?d=${encoded}`]) {
    for (const source of [`![x](${path})`, `<img src='${path}' alt='x'>`]) {
      const card = Model.scan(source).cards[0];
      assert.equal(Model.applyUpdates(source, [{ id: card.id, url: card.url }]), source);
    }
  }
});

test("valid design data above ordinary parameter limits remains individually and batch editable", () => {
  const doc = designDoc(live("stats", "stats", { username: "old" }),
    ...Array.from({ length: 3 }, (_, index) => Editor.createElement("text", { id: `text-${index}`, text: "A".repeat(2000) })));
  const encoded = Design.encodeDocument(doc);
  assert.ok(encoded.length > Model.LIMITS.MAX_PARAM_LENGTH);
  assert.ok(encoded.length < Design.MAX_DESIGN_URL_LENGTH - 100);
  const source = designImage(doc);
  const card = Model.scan(source).cards[0];
  assert.equal(Model.applyUpdates(source, [{ id: card.id, params: card.params }]), source);
  const editedDoc = { ...doc, name: "Edited" };
  const edited = Model.applyUpdates(source, [{ id: card.id, params: { d: Design.encodeDocument(editedDoc) } }]);
  assert.deepEqual(Model.scan(edited).cards[0].design, editedDoc);
  const batch = Model.batchUpdate(source, { toAccount: "new", theme: "nord" });
  const result = Model.scan(batch.source).cards[0].design;
  assert.equal(result.elements[0].params.username, "new");
  assert.equal(result.elements[0].params.theme, "nord");
  assert.deepEqual(result.elements.slice(1), doc.elements.slice(1));
});
