const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Model = require("../public/editor-model");
const Design = require("../public/card-design");
const { CARDS } = require("../public/card-schema");
const endpoint = require("../src/endpoints/design");
const { SUPPORTED_CARDS } = require("../src/endpoints/stack");
const tokenPool = require("../src/common/github-token");
const { cacheHeaders, errorCacheHeaders } = require("../src/common/utils");

const ORIGIN = "http://localhost:3000";
function card(overrides = {}) { return Model.createElement("card", { id: "live", x: 0, y: 0, width: 600, height: 280, ...overrides }); }
function document(...elements) { return Model.createDocument({ width: 600, height: 280, background: "transparent", elements }); }
function requestUrl(doc) { return `/api/design?d=${Design.encodeDocument(doc)}`; }
async function request(url) {
  const result = { headers: {}, statusCode: 200 };
  await endpoint({ url }, {
    setHeader(key, value) { result.headers[key] = value; return this; },
    status(code) { result.statusCode = code; return this; },
    send(svg) { result.svg = svg; return this; },
  });
  return result;
}
function tokens(t, value) {
  const keys = ["GITHUB_TOKEN", "GITHUB_TOKENS", ...Array.from({ length: 31 }, (_, i) => `GITHUB_TOKEN_${i + 1}`)];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  if (value) process.env.GITHUB_TOKEN = value;
  tokenPool._resetForTests();
  t.after(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    tokenPool._resetForTests();
  });
}

test("card URL and snippet imports retain identity, empty values, false, zero and unknown parameters", () => {
  const query = "username=ren&repo=ProfileKit&description=&hide_title=false&border_radius=0&custom=%ED%95%9C%EA%B8%80&stats.theme_url=https%3A%2F%2Fgist.githubusercontent.com%2Fx%2Fraw%2Ftheme.json";
  const url = `https://profilekit.vercel.app/api/pin?${query}`;
  const imported = Design.parseCardInput(url, ORIGIN);
  assert.deepEqual(imported, { endpoint: "pin", sourceOrigin: Design.DEFAULT_ORIGIN, params: {
    username: "ren", repo: "ProfileKit", description: "", hide_title: "false", border_radius: "0", custom: "한글", "stats.theme_url": "https://gist.githubusercontent.com/x/raw/theme.json",
  } });
  for (const [input, metadata] of [
    [`![Profile](${url})`, { alt: "Profile" }],
    [`<img alt="repo" src="${url.replace(/&/g, "&amp;")}" width="400" />`, { alt: "repo", displayWidth: "400" }],
    [`[![repo](${url})](https://github.com/ren/ProfileKit)`, { alt: "repo", linkUrl: "https://github.com/ren/ProfileKit" }],
  ]) {
    assert.deepEqual(Design.parseCardInput(input, ORIGIN), { ...imported, ...metadata });
  }
  assert.deepEqual(Object.fromEntries(new URL(Design.cardUrl(imported)).searchParams), imported.params);
  assert.equal(new URL(Design.cardUrl(imported)).origin, Design.DEFAULT_ORIGIN);
  assert.equal(new URL(Design.cardUrl(imported, ORIGIN)).origin, ORIGIN);
  assert.equal(Design.parseCardInput("/api/hero?name=Self", ORIGIN).sourceOrigin, ORIGIN);
});

test("imports support the full published card set and reject unsupported URL or query forms", () => {
  assert.equal(Object.keys(CARDS).length, 26);
  assert.deepEqual(Model.STACK_ENDPOINTS, SUPPORTED_CARDS);
  for (const name of Object.keys(CARDS)) assert.equal(Design.parseCardInput(`/api/${name}`, ORIGIN).endpoint, name);
  assert.equal(Design.parseCardInput("/api/stack?cards=hero,stats&stats.username=ren", ORIGIN).endpoint, "stack");
  for (const input of [
    "https://other.example/api/hero", "https://profilekit.vercel.app.evil.test/api/hero", "http://profilekit.vercel.app/api/hero",
    "https://user:password@profilekit.vercel.app/api/hero", "//evil.test/api/hero", "javascript:alert(1)",
    "/api/design?d=abc", "/api/health", "/api/hero#fragment", "/api/hero?name=one&name=two",
    "/api/hero?__proto__=x", "/api/hero?hero.constructor=x", "/api/stats?token=secret", "/api/stats?api_key=secret",
    '<img src="/api/hero"><script>alert(1)</script>',
  ]) assert.throws(() => Design.parseCardInput(input, ORIGIN), undefined, input);
});

test("documents round trip across Node and browser without depending on compression packages", () => {
  const doc = document(card({ params: { name: "렌 👩‍💻", hide_border: "false", subtitle: "" } }), Model.createElement("text", { id: "copy", text: "한글 & SVG" }));
  const encoded = Design.encodeDocument(doc);
  assert.match(encoded, /^[a-z0-9_-]+$/i);
  assert.deepEqual(Design.decodeDocument(encoded), doc);
  const sandbox = { URL, TextEncoder, TextDecoder, atob, btoa, encoded };
  vm.createContext(sandbox);
  for (const path of ["card-schema", "editor-model", "card-design"]) vm.runInContext(fs.readFileSync(require.resolve(`../public/${path}`), "utf8"), sandbox);
  assert.equal(vm.runInContext("ProfileKitCardDesign.encodeDocument(ProfileKitCardDesign.decodeDocument(encoded))", sandbox), encoded);
  assert.equal(vm.runInContext("ProfileKitEditorModel.renderSVG(ProfileKitCardDesign.decodeDocument(encoded))", sandbox), Model.renderSVG(doc));
  for (const bad of ["", "a", "???", "////", Buffer.from([0xff]).toString("base64url")]) assert.throws(() => Design.decodeDocument(bad), /valid|large/);
});

test("single full-bleed live cards preserve known native geometry and honor explicit deployments", () => {
  const imported = Design.parseCardInput("https://profilekit.vercel.app/api/pin?username=ren&repo=ProfileKit&hide_title=false", ORIGIN);
  const doc = document(card({ ...imported, nativeWidth: 600, nativeHeight: 280 }));
  const direct = new URL(Design.designUrl(doc));
  assert.equal(direct.origin, Design.DEFAULT_ORIGIN);
  assert.equal(direct.pathname, "/api/pin");
  assert.equal(direct.searchParams.get("hide_title"), "false");
  assert.equal(new URL(Design.designUrl(doc, ORIGIN)).origin, ORIGIN);
  const snippet = Design.readme({ ...doc, name: 'A "repo" & <tag>' }, ORIGIN);
  assert.match(snippet, /^<a href="https:\/\/github.com\/ren\/ProfileKit"><img /);
  assert.match(snippet, /alt="A &quot;repo&quot; &amp; &lt;tag&gt;" width="600"/);
  assert.match(snippet, /src="http:\/\/localhost:3000\/api\/pin/);
  for (const change of [{ x: 1 }, { y: 1 }, { width: 599 }, { height: 279 }, { rotation: 1 }, { opacity: 0.9 }]) {
    assert.equal(new URL(Design.designUrl(document({ ...doc.elements[0], ...change }), ORIGIN)).pathname, "/api/design");
  }
  assert.equal(new URL(Design.designUrl({ ...doc, background: "#000" }, ORIGIN)).pathname, "/api/design");
  assert.equal(new URL(Design.designUrl(document(card(), Model.createElement("rect")), ORIGIN)).pathname, "/api/design");
  const divider = Model.createDocument({ width: 800, height: 30, background: "transparent", elements: [card({ endpoint: "divider", width: 800, height: 30, nativeWidth: 800, nativeHeight: 30 })] });
  assert.equal(new URL(Design.designUrl(divider, ORIGIN)).pathname, "/api/divider");
  const proportional = { ...doc, width: 300, height: 140, elements: [{ ...doc.elements[0], width: 300, height: 140 }] };
  assert.equal(new URL(Design.designUrl(proportional)).pathname, "/api/pin");
  const stretched = { ...doc, height: 600, elements: [{ ...doc.elements[0], height: 600 }] };
  assert.equal(new URL(Design.designUrl(stretched)).pathname, "/api/design");
  assert.equal(new URL(Design.designUrl(document(card(imported)))).pathname, "/api/design");
});

test("linked snippets preserve destination, alternative text and independent display width", () => {
  const imported = Design.parseCardInput('<a href="https://www.linkedin.com/in/ren/?ref=readme&amp;lang=en"><img src="/api/social?github=ren" alt="Ren &amp; friends > work" width="49%" /></a>', ORIGIN);
  assert.equal(imported.linkUrl, "https://www.linkedin.com/in/ren/?ref=readme&lang=en");
  assert.equal(imported.alt, "Ren & friends > work");
  assert.equal(imported.displayWidth, "49%");
  const doc = document(card({ ...imported, nativeWidth: 600, nativeHeight: 280 }));
  const snippet = Design.readme(doc);
  assert.match(snippet, /^<a href="https:\/\/www\.linkedin\.com\/in\/ren\/\?ref=readme&amp;lang=en">/);
  assert.match(snippet, /alt="Ren &amp; friends &gt; work" width="49%"/);
  assert.doesNotMatch(snippet, / height=/);
  const markdown = Design.parseCardInput('[![Follow Ren](/api/social?github=ren)](https://example.com/ren)', ORIGIN);
  assert.equal(markdown.linkUrl, "https://example.com/ren");
  assert.equal(markdown.alt, "Follow Ren");
  assert.throws(() => Design.parseCardInput('<a href="javascript:alert(1)"><img src="/api/hero"></a>', ORIGIN), /HTTP/);
  assert.throws(() => Design.parseCardInput('<img src="/api/hero" src="/api/stats">', ORIGIN), /Repeated/);
});

test("email-linked Social snippets retain safe mailto recipients and message fields", () => {
  const destination = "mailto:faiza@example.com?cc=team%40example.com&subject=Hello%20Faiza&body=Thanks%20for%20sharing!";
  const input = `<a href="${destination.replace(/&/g, "&amp;")}"><img src="/api/social?email=faiza%40example.com" alt="Email Faiza" width="49%" /></a>`;
  const imported = Design.parseCardInput(input, ORIGIN);
  assert.equal(imported.linkUrl, destination);
  assert.equal(imported.params.email, "faiza@example.com");
  const doc = document(card({ ...imported, nativeWidth: 600, nativeHeight: 280 }));
  assert.deepEqual(Model.parseDocument(Model.serializeDocument(doc)), doc);
  for (const snippet of [Design.readme(doc), Design.readmeCards(doc)]) {
    assert.ok(snippet.startsWith(`<a href="${destination.replace(/&/g, "&amp;")}">`));
    assert.match(snippet, /alt="Email Faiza" width="49%"/);
  }
  const markdown = Design.parseCardInput("[![Email](/api/social?email=faiza%40example.com)](mailto:faiza@example.com)", ORIGIN);
  assert.equal(markdown.linkUrl, "mailto:faiza@example.com");
  for (const linkUrl of ["mailto:faiza+profile@example.com,team@example.com", "mailto:?to=faiza%40example.com&bcc=copy%40example.com&subject=Hello", "mailto:faiza@example.com?cc=team+profile@example.com&subject=C++"]) {
    assert.equal(Model.normalizeCard({ endpoint: "social", params: {}, linkUrl }).linkUrl, linkUrl);
  }
});

test("email-linked snippets reject executable schemes, credentials and header injection", () => {
  for (const linkUrl of [
    "javascript:alert(1)", "data:text/html,bad", "mailto://user:password@example.com", "mailto:user:password@example.com",
    "mailto://example.com/faiza@example.com", "mailto:faiza@example.com#fragment", "mailto:faiza@@example.com",
    "mailto:faiza@example.com\r\nBcc:other@example.com", "mailto:faiza%0d%0aBcc:other@example.com",
    "mailto:faiza@example.com?subject=Hello%0d%0aBcc%3Aother%40example.com", "mailto:faiza@example.com?body=Line%0aBreak",
    "mailto:faiza@example.com?subject=%C2%85", "mailto:faiza@example.com?subject=%ZZ",
    "mailto:faiza@example.com?attachment=file:///secret", "mailto:faiza@example.com?subject=One&Subject=Two",
    "https://user:password@example.com", "https://example.com/\npath",
  ]) {
    const input = `<a href="${linkUrl.replace(/&/g, "&amp;")}"><img src="/api/social?email=faiza%40example.com"></a>`;
    assert.throws(() => Design.parseCardInput(input, ORIGIN), /Card link/, linkUrl);
  }
});

test("design URL and snippet imports restore normalized documents only from trusted deployments", () => {
  const doc = document(card({ params: { name: "Imported design" } }), Model.createElement("text", { id: "caption", text: "Preserved" }));
  const url = Design.designUrl(doc, ORIGIN);
  for (const input of [url, `![Design](${url})`, `<img src="${url}" alt="Design" width="49%" />`, `<a href="https://example.com"><img src="${url}"></a>`]) {
    assert.deepEqual(Design.parseDesignInput(input, ORIGIN), doc);
  }
  assert.equal(Design.parseDesignInput("/api/hero?name=Card", ORIGIN), null);
  for (const input of [url.replace(ORIGIN, "https://untrusted.example"), `${url}&d=again`, `${url}&extra=1`, "/api/design?d=bad"]) {
    assert.throws(() => Design.parseDesignInput(input, ORIGIN));
  }
});

test("separate card README embeds preserve individual links and origins", () => {
  const doc = document(
    card({ id: "repo", endpoint: "pin", sourceOrigin: ORIGIN, params: { username: "ren", repo: "ProfileKit" }, alt: "Repository", displayWidth: "49%" }),
    card({ id: "follow", endpoint: "social", sourceOrigin: Design.DEFAULT_ORIGIN, params: { github: "ren" }, linkUrl: "https://example.com/follow", alt: "Follow", displayWidth: "49%" }),
  );
  const snippet = Design.readmeCards(doc);
  assert.match(snippet, /href="https:\/\/github\.com\/ren\/ProfileKit"><img src="http:\/\/localhost:3000\/api\/pin/);
  assert.match(snippet, /href="https:\/\/example\.com\/follow"><img src="https:\/\/profilekit\.vercel\.app\/api\/social/);
  assert.equal((snippet.match(/width="49%"/g) || []).length, 2);
  assert.equal((Design.readmeCards(doc, "https://deployed.example").match(/src="https:\/\/deployed\.example/g) || []).length, 2);
  for (const invalid of [document(), document(card(), Model.createElement("rect")), document(card({ rotation: 1 })), document(card({ opacity: 0.5 }))]) {
    assert.throws(() => Design.readmeCards(invalid), /composed design/);
  }
});

test("URI limits fail explicitly without truncating content or preventing project files", async () => {
  const large = document(card(), Model.createElement("text", { text: "한".repeat(7000) }));
  assert.doesNotThrow(() => Model.serializeDocument(large));
  assert.throws(() => Design.encodeDocument(large), /too large.*static SVG/i);
  assert.throws(() => Design.designUrl(large, ORIGIN), /too large.*static SVG/i);
  assert.throws(() => Design.decodeDocument("a".repeat(Design.MAX_DESIGN_URL_LENGTH + 1)), /too large/);
  const response = await request("/api/design?d=" + "a".repeat(Design.MAX_DESIGN_URL_LENGTH));
  assert.equal(response.statusCode, 400);
  assert.match(response.svg, /too large/);
  assert.equal(response.headers["Cache-Control"], errorCacheHeaders("bad_input"));
});

test("live design rendering positions cards with decorations and preserves scoped themes, fonts and animation", async () => {
  const doc = document(
    card({ id: "dark", x: 12, y: 14, width: 250, height: 140, rotation: 7, opacity: 0.8, params: { name: "Dark", subtitle: "Subtitle", theme: "dark", font: "inter" } }),
    card({ id: "light", x: 300, y: 80, width: 240, height: 120, params: { name: "Light", subtitle: "Different", theme: "light", font: "inter" } }),
    Model.createElement("text", { id: "caption", text: "Authored & intact", x: 20, y: 200, width: 500, height: 50, fontSize: 24 }),
  );
  const result = await request(requestUrl(doc));
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["Content-Type"], "image/svg+xml");
  assert.equal(result.headers["Cache-Control"], cacheHeaders());
  const svg = result.svg.replace(/data:font\/[^,]+;base64,[a-z0-9+/=]+/gi, "data:font/woff2;base64,font-bytes");
  assert.doesNotMatch(svg, /<image|<foreignObject/);
  assert.match(svg, /<svg x="12" y="14" width="250" height="140" preserveAspectRatio="none" overflow="hidden"/);
  assert.match(svg, /transform="rotate\(7 137 84\)" opacity="0.8"/);
  assert.match(svg, /Authored &amp; intact/);
  assert.match(svg, /#pk-card-0-dark-scope \.hero-name\{[^}]*fill: #e6edf3/);
  assert.match(svg, /#pk-card-1-light-scope \.hero-name\{[^}]*fill: #1f2328/);
  for (const prefix of ["pk-card-0-dark-", "pk-card-1-light-"]) {
    assert.ok(svg.includes(`@keyframes ${prefix}heroIn`));
    assert.ok(svg.includes(`animation: ${prefix}heroIn`));
    assert.ok(svg.includes(`font-family:'${prefix}Inter'`));
    assert.ok(svg.includes(`id="${prefix}hero-grad"`));
    assert.ok(svg.includes(`url(#${prefix}hero-grad)`));
    assert.ok(svg.includes(`#${prefix}scope animate`));
  }
  const ids = Array.from(svg.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(svg, /<animate /);
  assert.equal((await request(requestUrl(doc))).svg, result.svg);
});

test("card params cannot become executable markup and sourceOrigin is never a server fetch target", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network request"); });
  const doc = document(card({ sourceOrigin: "https://untrusted.example", params: { name: '<script>alert("x")</script>', subtitle: '" onload="alert(1)', custom: '<svg onload="bad" />' } }));
  const response = await request(requestUrl(doc));
  assert.equal(fetch.mock.callCount(), 0);
  assert.match(response.svg, /&lt;script&gt;/);
  assert.doesNotMatch(response.svg, /<script|onload="|untrusted\.example/);
  const raw = { ...doc, elements: [{ ...doc.elements[0], svg: '<svg onload="bad" />' }] };
  assert.equal((await request("/api/design?d=" + Buffer.from(JSON.stringify(raw)).toString("base64url"))).statusCode, 400);
});

test("designs count stack children before making calls and isolate repeated child cards", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network request"); });
  const stack = card({ endpoint: "stack", params: { cards: "hero,hero,section", "hero.name": "Repeated", "hero.theme": "light", "section.title": "Scoped", theme: "dark" } });
  const result = await request(requestUrl(document(stack)));
  assert.match(result.svg, /#pk-card-0-live-scope #pk-card-0-live-stack-0-scope \.hero-name/);
  assert.match(result.svg, /#pk-card-0-live-scope #pk-card-0-live-stack-1-scope \.hero-name/);
  assert.match(result.svg, /pk-card-0-live-stack-0-heroIn/);
  assert.match(result.svg, /pk-card-0-live-stack-1-heroIn/);
  assert.doesNotMatch(result.svg, /<image/);
  for (const children of ["hero,design", "hero,stack", Array(8).fill("stats").join(",")]) {
    const raw = { ...document(), elements: [{ ...stack, params: { cards: children, username: "ren" } }] };
    const response = await request("/api/design?d=" + Buffer.from(JSON.stringify(raw)).toString("base64url"));
    assert.equal(response.statusCode, 400);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("GitHub cards retain live fetches on each design request and use the supplied identity", async (t) => {
  tokens(t, "test-token");
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.github.com/graphql");
    assert.equal(JSON.parse(options.body).variables.login, "actual-user");
    calls++;
    return { ok: true, json: async () => ({ data: { user: {
      name: `Live result ${calls}`, login: "actual-user",
      contributionsCollection: { totalCommitContributions: calls, restrictedContributionsCount: 0 },
      repositoriesContributedTo: { totalCount: 1 }, pullRequests: { totalCount: 2 }, openIssues: { totalCount: 1 }, closedIssues: { totalCount: 2 },
      repositories: { totalCount: 1, nodes: [{ stargazerCount: 10 }], pageInfo: { hasNextPage: false } },
    } } }) };
  });
  const url = requestUrl(document(card({ endpoint: "stats", params: { username: "actual-user" } })));
  assert.match((await request(url)).svg, /Live result 1/);
  assert.match((await request(url)).svg, /Live result 2/);
  assert.equal(calls, 2);
});

test("missing GitHub tokens and stack child failures retain their endpoint error cache policy", async (t) => {
  tokens(t);
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network request"); });
  for (const live of [card({ endpoint: "stats", params: { username: "ren" } }), card({ endpoint: "stack", params: { cards: "hero,stats", username: "ren" } })]) {
    const result = await request(requestUrl(document(live, card({ id: "decor", endpoint: "hero" }))));
    assert.match(result.svg, /GITHUB_TOKEN not configured/);
    assert.equal(result.headers["Cache-Control"], errorCacheHeaders("bad_input"));
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("theme errors remain observable and cache aggregation keeps the shortest child policy", async () => {
  const doc = document(card({ id: "one", params: { theme_url: "https://example.com/theme.json" } }), card({ id: "two", params: { theme: "light" } }));
  const response = await request(requestUrl(doc));
  assert.match(response.headers["X-Theme-Error"], /^one: .*not allowed/);
  assert.equal(response.headers["Cache-Control"], cacheHeaders());
  assert.equal(endpoint.aggregateCache([cacheHeaders(), errorCacheHeaders("network")]), errorCacheHeaders("network"));
  assert.equal(endpoint.aggregateCache([cacheHeaders(), "private, max-age=999"]), "no-store, max-age=0");
  assert.equal(endpoint.aggregateCache(["public, max-age=43200, s-maxage=43200"]), "public, max-age=43200, s-maxage=43200, stale-while-revalidate=0");
});
