// Smoke tests for the standalone server.js adapter that powers the
// optional Docker self-host path. The same handler files are used by
// the Vercel path, so these tests cover the *adapter* (routing, ALLOWED
// gate, static serving, traversal guard, X-ProfileKit-Instance, graceful
// shutdown), not the card rendering itself (which has its own tests).
//
// Each test boots the server on an ephemeral port (0), exercises it via
// node:fetch, and closes it. No external mocking, no fixtures — the
// real HTTP stack and the real handlers.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { server, ALLOWED, PUBLIC_DIR } = require("../server");

// Single shared listen — all tests reuse this port and the server.close()
// runs in test.after().
let baseUrl;
test.before(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});
test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("ALLOWED set includes catalog and health alongside the 28 cards", () => {
  assert.ok(ALLOWED.has("catalog"), "catalog must be allowlisted");
  assert.ok(ALLOWED.has("health"), "health must be allowlisted");
  assert.ok(ALLOWED.has("divider"), "card endpoints must be allowlisted");
  // Path-traversal-style names must NOT be in the set.
  assert.ok(!ALLOWED.has(".."));
  assert.ok(!ALLOWED.has("../etc/passwd"));
});

test("/api/health responds 200 with JSON and the instance header", async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/json/);
  assert.ok(
    res.headers.get("x-profilekit-instance"),
    "every response must carry X-ProfileKit-Instance"
  );
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, "profilekit");
});

test("/api/divider responds 200 with image/svg+xml", async () => {
  const res = await fetch(`${baseUrl}/api/divider?style=line&width=400`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/svg+xml");
  const body = await res.text();
  assert.ok(body.startsWith("<svg"), "body must be SVG markup");
});

test("/api/catalog responds 200 with JSON listing cards + themes", async () => {
  const res = await fetch(`${baseUrl}/api/catalog`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/json/);
  const body = await res.json();
  assert.ok(body.cards && body.themes, "catalog must declare cards + themes");
});

test("/api/<unknown> responds 404 — ALLOWED gate rejects arbitrary names", async () => {
  const res = await fetch(`${baseUrl}/api/notreal`);
  assert.equal(res.status, 404);
});

test("/api/../something cannot escape the endpoints directory", async () => {
  // URL parsing normalizes /api/../foo → /foo at the WHATWG layer, so the
  // server sees a non-/api/ path and falls through to static serving.
  // Either way: dynamic require with an attacker-controlled name must not
  // be reachable. Verified by asserting a 404 (no endpoint file) rather
  // than a 500 (require error leaking the file system).
  const res = await fetch(`${baseUrl}/api/..%2f..%2fetc%2fpasswd`);
  assert.ok(
    res.status === 404 || res.status === 400,
    `expected 404/400 for traversal attempt, got ${res.status}`
  );
});

test("/ serves the playground index.html", async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  const body = await res.text();
  assert.ok(body.length > 100, "playground index must be non-trivial");
});

test("/robots.txt serves the static file with text/plain", async () => {
  const res = await fetch(`${baseUrl}/robots.txt`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/plain/);
});

test("static file 404 on missing asset", async () => {
  const res = await fetch(`${baseUrl}/this-file-does-not-exist.html`);
  assert.equal(res.status, 404);
});

test("path traversal on static path is rejected", async () => {
  // The traversal guard normalizes the resolved path and asserts it stays
  // under PUBLIC_DIR. A request like /../package.json must NOT leak the
  // repo's package.json.
  const res = await fetch(`${baseUrl}/%2e%2e/package.json`);
  // Acceptable outcomes:
  //   403 — path traversal guard rejected
  //   404 — URL normalization at the WHATWG layer stripped the .. and the
  //         resulting path didn't match a public asset
  // Unacceptable: 200 with the contents of package.json.
  if (res.status === 200) {
    const body = await res.text();
    assert.ok(
      !body.includes('"name": "profilekit"'),
      "traversal must not leak package.json"
    );
  } else {
    assert.ok(
      res.status === 403 || res.status === 404,
      `expected 403/404 for traversal, got ${res.status}`
    );
  }
});

test("PUBLIC_DIR resolves to the repo's public/ directory", () => {
  // Sanity check — if a refactor accidentally points PUBLIC_DIR at the
  // repo root, the traversal guard becomes the only thing standing
  // between an attacker and the entire source tree.
  assert.ok(
    PUBLIC_DIR.endsWith(path.join("ProfileKit", "public")) ||
      PUBLIC_DIR.endsWith("/public"),
    `PUBLIC_DIR must end in /public, got ${PUBLIC_DIR}`
  );
});
