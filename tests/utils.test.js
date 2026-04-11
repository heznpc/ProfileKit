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
  sanitizeUrl,
  makeRng,
  truncate,
  cacheHeaders,
  errorCacheHeaders,
  classifyError,
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

test("parseIntSafe falls back when value is outside [min, max] bounds", () => {
  assert.equal(parseIntSafe("100", 495, 200, 1600), 495);
  assert.equal(parseIntSafe("99999", 495, 200, 1600), 495);
  assert.equal(parseIntSafe("-50", 495, 200, 1600), 495);
  // In-range values pass through.
  assert.equal(parseIntSafe("600", 495, 200, 1600), 600);
  // Boundaries are inclusive.
  assert.equal(parseIntSafe("200", 495, 200, 1600), 200);
  assert.equal(parseIntSafe("1600", 495, 200, 1600), 1600);
});

test("parseFloatSafe falls back on NaN", () => {
  assert.equal(parseFloatSafe("3.14", 0), 3.14);
  assert.equal(parseFloatSafe("nope", 1), 1);
});

test("parseFloatSafe also honors optional bounds", () => {
  assert.equal(parseFloatSafe("0.5", 1, 0, 1), 0.5);
  assert.equal(parseFloatSafe("2.5", 1, 0, 1), 1);
  assert.equal(parseFloatSafe("-0.1", 1, 0, 1), 1);
});

test("parseColor prepends # if missing", () => {
  assert.equal(parseColor("ff0000"), "#ff0000");
  assert.equal(parseColor("#ff0000"), "#ff0000");
  assert.equal(parseColor(""), undefined);
  assert.equal(parseColor(null), undefined);
});

test("parseColor accepts 3-digit, 6-digit, and 8-digit hex", () => {
  assert.equal(parseColor("f00"), "#f00");
  assert.equal(parseColor("#f00"), "#f00");
  assert.equal(parseColor("ff0000"), "#ff0000");
  assert.equal(parseColor("ff0000aa"), "#ff0000aa"); // with alpha
});

test("parseColor rejects non-hex values", () => {
  assert.equal(parseColor("zzz"), undefined);
  assert.equal(parseColor("red"), undefined);
  assert.equal(parseColor("#xyz"), undefined);
  assert.equal(parseColor("#ff00"), undefined); // 4 digits, not a valid length
  assert.equal(parseColor("#fffffffff"), undefined); // 9 digits
  assert.equal(parseColor('" onload="alert(1)'), undefined);
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

test("errorCacheHeaders branches by kind", () => {
  assert.match(errorCacheHeaders("default"), /max-age=120/);
  assert.match(errorCacheHeaders("network"), /max-age=60/);
  assert.match(errorCacheHeaders("ratelimit"), /max-age=600/);
  assert.match(errorCacheHeaders("bad_input"), /max-age=300/);
  assert.match(errorCacheHeaders("not_found"), /max-age=300/);
});

test("errorCacheHeaders falls back to default for unknown kinds", () => {
  assert.match(errorCacheHeaders("totally-unknown"), /max-age=120/);
});

test("classifyError routes by HTTP status code", () => {
  assert.equal(classifyError(Object.assign(new Error("x"), { status: 429 })), "ratelimit");
  assert.equal(classifyError(Object.assign(new Error("x"), { status: 401 })), "ratelimit");
  assert.equal(classifyError(Object.assign(new Error("x"), { status: 403 })), "ratelimit");
  assert.equal(classifyError(Object.assign(new Error("x"), { status: 404 })), "not_found");
});

test("classifyError routes by message substring when status is missing", () => {
  assert.equal(classifyError(new Error("User not found: ghost")), "not_found");
  assert.equal(classifyError(new Error("Fetch timed out after 5000ms")), "network");
  assert.equal(classifyError(new Error("GITHUB_TOKEN not configured")), "bad_input");
  assert.equal(classifyError(new Error("API rate limit exceeded")), "ratelimit");
  assert.equal(classifyError(new Error("something weird")), "default");
});

test("sanitizeUrl accepts https / http / mailto", () => {
  assert.equal(sanitizeUrl("https://example.com/"), "https://example.com/");
  assert.equal(sanitizeUrl("http://example.com/x"), "http://example.com/x");
  assert.equal(sanitizeUrl("mailto:me@example.com"), "mailto:me@example.com");
});

test("sanitizeUrl rejects javascript / data / vbscript schemes", () => {
  assert.equal(sanitizeUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(sanitizeUrl("vbscript:msgbox(1)"), null);
});

test("sanitizeUrl rejects unparseable and empty input", () => {
  assert.equal(sanitizeUrl(""), null);
  assert.equal(sanitizeUrl(null), null);
  assert.equal(sanitizeUrl(undefined), null);
  assert.equal(sanitizeUrl("not a url"), null);
});
