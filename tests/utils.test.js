const test = require("node:test");
const assert = require("node:assert/strict");
const {
  formatNumber,
  escapeHtml,
  parseBoolean,
  parseArray,
  parseIntSafe,
  parseFloatSafe,
  parseColor,
  parseRadius,
  makeRng,
  truncate,
  cacheHeaders,
  errorCacheHeaders,
} = require("../src/common/utils");

test("formatNumber compacts large numbers", () => {
  assert.equal(formatNumber(0), "0");
  assert.equal(formatNumber(999), "999");
  assert.equal(formatNumber(1000), "1K");
  assert.equal(formatNumber(1500), "1.5K");
  assert.equal(formatNumber(1_000_000), "1M");
});

test("escapeHtml escapes the five XML-significant characters", () => {
  assert.equal(escapeHtml("<a&b>"), "&lt;a&amp;b&gt;");
  assert.equal(escapeHtml(`"hi"`), "&quot;hi&quot;");
  assert.equal(escapeHtml("it's"), "it&#39;s");
});

test("escapeHtml coerces non-strings", () => {
  assert.equal(escapeHtml(42), "42");
  assert.equal(escapeHtml(null), "null");
});

test("parseBoolean accepts true / 1 / yes only", () => {
  assert.equal(parseBoolean("true"), true);
  assert.equal(parseBoolean("1"), true);
  assert.equal(parseBoolean("yes"), true);
  assert.equal(parseBoolean("false"), false);
  assert.equal(parseBoolean(""), false);
  assert.equal(parseBoolean(null), false);
  assert.equal(parseBoolean(undefined), false);
});

test("parseArray splits, trims, and drops empties", () => {
  assert.deepEqual(parseArray("a, b ,c"), ["a", "b", "c"]);
  assert.deepEqual(parseArray(""), []);
  assert.deepEqual(parseArray(null), []);
  assert.deepEqual(parseArray("a,,b"), ["a", "b"]);
});

test("parseIntSafe falls back on NaN", () => {
  assert.equal(parseIntSafe("42", 0), 42);
  assert.equal(parseIntSafe("not-a-number", 7), 7);
  assert.equal(parseIntSafe(undefined, 9), 9);
});

test("parseFloatSafe falls back on NaN", () => {
  assert.equal(parseFloatSafe("3.14", 0), 3.14);
  assert.equal(parseFloatSafe("nope", 1), 1);
});

test("parseColor prepends # if missing", () => {
  assert.equal(parseColor("ff0000"), "#ff0000");
  assert.equal(parseColor("#ff0000"), "#ff0000");
  assert.equal(parseColor(""), undefined);
  assert.equal(parseColor(null), undefined);
});

test("parseRadius accepts tokens and raw px", () => {
  assert.equal(parseRadius("lg", 0), 6);
  assert.equal(parseRadius("full", 0), 9999);
  assert.equal(parseRadius("none", 0), 0);
  assert.equal(parseRadius("20", 0), 20);
  assert.equal(parseRadius(undefined, 6), 6);
  assert.equal(parseRadius("", 6), 6);
});

test("makeRng is deterministic for the same seed", () => {
  const a = makeRng(42);
  const b = makeRng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test("makeRng produces values in [0, 1)", () => {
  const rng = makeRng(1);
  for (let i = 0; i < 100; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1);
  }
});

test("truncate adds ellipsis when over limit", () => {
  assert.equal(truncate("hello", 10), "hello");
  assert.equal(truncate("hello world", 8), "hello w\u2026");
  assert.equal(truncate("", 5), "");
  assert.equal(truncate(null, 5), "");
});

test("cache headers include max-age and stale-while-revalidate", () => {
  assert.match(cacheHeaders(), /max-age=1800/);
  assert.match(cacheHeaders(), /stale-while-revalidate/);
  assert.match(errorCacheHeaders(), /max-age=120/);
});
