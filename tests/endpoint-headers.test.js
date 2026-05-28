const test = require("node:test");
const assert = require("node:assert/strict");

// Regression test for response headers ProfileKit relies on for correct
// rendering through GitHub's Camo proxy and other image proxies.
//
// Why this exists: market-pulse 2026-05 surfaced that GitHub's Camo cache
// behavior depends on a stable Content-Type and Cache-Control header. A
// silent change (someone "tidies up" an endpoint and drops `image/svg+xml`,
// or replaces `cacheHeaders()` with `no-store`) would result in Camo
// re-fetching every request and animations stuttering for embedders. None
// of the existing tests check the wire-level response headers.

function makeMockReq(query = {}) {
  // Vercel-style req: url + parsed query. parseSearchParams in options.js
  // only reads `req.url`, so the query object isn't strictly needed, but we
  // include it for handlers that hit `req.query` directly.
  const qs = new URLSearchParams(query).toString();
  return {
    url: qs ? `/api/_test?${qs}` : "/api/_test",
    query,
    method: "GET",
    headers: { host: "profilekit.local" },
  };
}

function makeMockRes() {
  const headers = {};
  let body;
  let statusCode = 200;
  return {
    setHeader(name, value) {
      headers[name] = value;
    },
    getHeader(name) {
      return headers[name];
    },
    status(code) {
      statusCode = code;
      return this;
    },
    send(payload) {
      body = payload;
      return this;
    },
    _inspect() {
      return { headers, body, statusCode };
    },
  };
}

test("/api/divider emits Content-Type: image/svg+xml + cached", async () => {
  // SVG endpoints must declare image/svg+xml so Camo accepts and caches
  // them. A regression to text/html or application/octet-stream causes
  // GitHub READMEs to render a broken-image icon.
  const handler = require("../src/endpoints/divider");
  const req = makeMockReq({ style: "line", width: "400" });
  const res = makeMockRes();
  await handler(req, res);
  const { headers, body } = res._inspect();
  assert.equal(headers["Content-Type"], "image/svg+xml", "Content-Type must be image/svg+xml");
  assert.match(
    headers["Cache-Control"] || "",
    /max-age=\d+/,
    "Cache-Control must include a max-age so Camo caches and re-fetches deterministically"
  );
  assert.ok(typeof body === "string" && body.startsWith("<svg"), "body must be SVG markup");
});

test("/api/health emits no-store cache so probes always observe current state", async () => {
  // Probes (Pingdom, statuspage) and uptime monitors must observe the
  // current pool state, not a cached snapshot. A regression to a long
  // max-age would mask token-pool drainage incidents.
  const handler = require("../src/endpoints/health");
  const res = makeMockRes();
  await handler(makeMockReq(), res);
  const { headers, body } = res._inspect();
  assert.match(headers["Content-Type"], /application\/json/, "/api/health must return JSON");
  assert.match(
    headers["Cache-Control"] || "",
    /no-store/,
    "/api/health must never be cached"
  );
  const parsed = JSON.parse(body);
  assert.equal(parsed.ok, true);
  assert.ok(parsed.allowlists, "/api/health must surface allowlists for visibility");
});

test("/api/catalog emits JSON + cached", async () => {
  // Discovery endpoint consumed by @heznpc/profilekit-mcp. A regression
  // to text/plain would break the wrapper's JSON.parse, and missing
  // Cache-Control would hammer the function on every MCP discover call.
  const handler = require("../src/endpoints/catalog");
  const res = makeMockRes();
  await handler(makeMockReq(), res);
  const { headers, body } = res._inspect();
  assert.match(headers["Content-Type"], /application\/json/, "/api/catalog must return JSON");
  assert.match(
    headers["Cache-Control"] || "",
    /max-age=\d+/,
    "/api/catalog must be cached so MCP discovery doesn't re-execute the handler per request"
  );
  const parsed = JSON.parse(body);
  assert.ok(parsed.cards && parsed.themes, "catalog must declare cards + themes");
  // Cross-check with the market-pulse-driven contract: theme_url must be
  // advertised on every card endpoint, not just stats/stack.
  assert.ok(
    parsed.cards.hero.common_params.includes("theme_url"),
    "hero must list theme_url in common_params (matches README claim)"
  );
});
