const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RADIUS,
  LAYOUT,
  parseToken,
  parseRadius,
  bodyStartY,
} = require("../src/common/tokens");

test("RADIUS scale matches Tailwind / shadcn names", () => {
  assert.equal(RADIUS.none, 0);
  assert.equal(RADIUS.sm, 2);
  assert.equal(RADIUS.md, 4);
  assert.equal(RADIUS.lg, 6);
  assert.equal(RADIUS.xl, 12);
  assert.equal(RADIUS["2xl"], 16);
  assert.equal(RADIUS["3xl"], 24);
  assert.equal(RADIUS.full, 9999);
});

test("parseToken returns scale value for known token", () => {
  assert.equal(parseToken(RADIUS, "lg", 0), 6);
  assert.equal(parseToken(RADIUS, "full", 0), 9999);
});

test("parseToken returns parsed number for raw px", () => {
  assert.equal(parseToken(RADIUS, "12", 0), 12);
  assert.equal(parseToken(RADIUS, "0", 99), 0);
});

test("parseToken returns default for empty / nullish", () => {
  assert.equal(parseToken(RADIUS, undefined, 6), 6);
  assert.equal(parseToken(RADIUS, null, 6), 6);
  assert.equal(parseToken(RADIUS, "", 6), 6);
});

test("parseToken returns default for unknown non-numeric", () => {
  assert.equal(parseToken(RADIUS, "rounded", 6), 6);
});

test("parseRadius is parseToken bound to RADIUS", () => {
  assert.equal(parseRadius("lg", 0), 6);
  assert.equal(parseRadius("none", 0), 0);
});

test("bodyStartY uses LAYOUT constants", () => {
  assert.equal(bodyStartY(false), LAYOUT.BODY_TOP_WITH_TITLE);
  assert.equal(bodyStartY(true), LAYOUT.BODY_TOP_NO_TITLE);
  assert.ok(LAYOUT.BODY_TOP_WITH_TITLE > LAYOUT.BODY_TOP_NO_TITLE);
});
