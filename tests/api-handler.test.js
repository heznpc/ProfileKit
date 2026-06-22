const test = require("node:test");
const assert = require("node:assert/strict");

const handler = require("../api/[endpoint].js");

function makeReq(endpoint, params = {}) {
  const search = new URLSearchParams(params);
  return {
    url: search.size ? `/api/${endpoint}?${search}` : `/api/${endpoint}`,
    query: { ...params, endpoint },
    method: "GET",
    headers: { host: "profilekit.local" },
  };
}

function makeRes() {
  const headers = {};
  let body = "";
  let statusCode = 200;
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers[name] = value;
      return this;
    },
    send(payload) {
      body = payload;
      return this;
    },
    inspect() {
      return { body, headers, statusCode };
    },
  };
}

test("Vercel dynamic handler serves /api/health", async () => {
  const res = makeRes();
  await handler(makeReq("health"), res);
  const { body, headers, statusCode } = res.inspect();

  assert.equal(statusCode, 200);
  assert.match(headers["Content-Type"], /application\/json/);
  assert.match(headers["Cache-Control"], /no-store/);
  assert.equal(JSON.parse(body).service, "profilekit");
});

test("Vercel dynamic handler preserves user ?name= for cards", async () => {
  const res = makeRes();
  await handler(makeReq("hero", { name: "ProfileKit" }), res);
  const { body, headers, statusCode } = res.inspect();

  assert.equal(statusCode, 200);
  assert.equal(headers["Content-Type"], "image/svg+xml");
  assert.match(body, /ProfileKit/);
});

test("Vercel dynamic handler rejects unknown endpoints", async () => {
  const res = makeRes();
  await handler(makeReq("notreal"), res);
  const { body, headers, statusCode } = res.inspect();

  assert.equal(statusCode, 404);
  assert.equal(headers["Content-Type"], "text/plain");
  assert.match(body, /Unknown endpoint/);
});

test("Vercel dynamic handler returns a controlled 500 when a card throws", async () => {
  const dividerPath = require.resolve("../src/endpoints/divider");
  const original = require(dividerPath);
  require.cache[dividerPath].exports = async () => {
    throw new Error("synthetic failure");
  };

  const res = makeRes();
  try {
    await handler(makeReq("divider"), res);
  } finally {
    require.cache[dividerPath].exports = original;
  }

  const { body, headers, statusCode } = res.inspect();
  assert.equal(statusCode, 500);
  assert.equal(headers["Content-Type"], "text/plain; charset=utf-8");
  assert.match(body, /Internal error: synthetic failure/);
});
