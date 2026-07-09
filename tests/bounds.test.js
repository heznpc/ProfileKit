const test = require("node:test");
const assert = require("node:assert/strict");

const wave = require("../src/endpoints/wave");
const matrix = require("../src/endpoints/matrix");
const snake = require("../src/endpoints/snake");

async function invoke(handler, url) {
  const res = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
  await handler({ url }, res);
  return res;
}

test("wave endpoint falls back on out-of-bounds dimensions", async () => {
  const res = await invoke(wave, "/api/wave?width=100000&height=100000&waves=99");
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /^<svg[^>]*width="800"[^>]*height="160"/);
  assert.ok(Buffer.byteLength(res.body) < 20_000);
});

test("matrix endpoint falls back on out-of-bounds dimensions and speed", async () => {
  const res = await invoke(matrix, "/api/matrix?width=100000&height=100000&speed=0");
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /^<svg[^>]*width="600"[^>]*height="200"/);
  assert.ok(!res.body.includes("Infinity"));
});

test("snake endpoint caps grid size before rendering", async () => {
  const res = await invoke(snake, "/api/snake?cols=300&rows=300&cell_size=999&duration=999");
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /^<svg[^>]*width="778"[^>]*height="134"/);
  assert.ok(Buffer.byteLength(res.body) < 100_000);
});
