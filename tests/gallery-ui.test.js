const test = require("node:test");
const assert = require("node:assert/strict");
const gallery = require("../public/gallery");

const id = "0123456789abcdef0123456789abcdef";
const editToken = "a".repeat(43);

test("gallery source, preview and editor links address immutable local versions", () => {
  assert.equal(gallery.designURL(id, 4), `/api/gallery?id=${id}&version=4`);
  assert.equal(gallery.designURL(id, 4, "svg"), `/api/gallery?id=${id}&version=4&format=svg`);
  assert.equal(gallery.editorURL(id, 4), `/editor.html#gallery=${id}&version=4`);
  assert.equal(gallery.designURL(id), `/api/gallery?id=${id}`);
  for (const bad of ["https://evil.test", `${id}&format=html`, "../secret", "__proto__", "A".repeat(32)]) {
    assert.throws(() => gallery.designURL(bad, 1));
    assert.throws(() => gallery.editorURL(bad, 1));
  }
  for (const bad of [0, -1, 1.1, "1", NaN, Infinity, 101]) assert.throws(() => gallery.designURL(id, bad));
});

test("editing recovery files round-trip without admitting unexpected authorization fields", () => {
  const entry = gallery.recoveryFile(id, editToken, "My design");
  assert.deepEqual(gallery.parseRecoveryFile(JSON.stringify(entry)), entry);
  for (const value of [
    { ...entry, version: 2 }, { ...entry, kind: "another-format" }, { ...entry, endpoint: "https://evil.test" },
    { ...entry, id: "../../" }, { ...entry, editToken: "short" }, { ...entry, editToken: `Bearer ${editToken}` },
    { ...entry, editToken: "a".repeat(42) + "\n" }, { ...entry, title: "x".repeat(201) },
  ]) assert.throws(() => gallery.parseRecoveryFile(JSON.stringify(value)));
  assert.throws(() => gallery.parseRecoveryFile('{"__proto__":{"polluted":true}}'));
  assert.throws(() => gallery.parseRecoveryFile("x".repeat(8193)));
  assert.throws(() => gallery.parseRecoveryFile("not JSON"));
  assert.equal({}.polluted, undefined);
});

test("gallery metadata requires supported licenses and text tags before rendering", () => {
  const value = { id, version: 1, title: "<script>as plain text</script>", author: "Creator", description: "", tags: ["minimal"], license: "CC-BY-4.0" };
  assert.equal(gallery.metadata(value), value);
  for (const changes of [{ license: "javascript:alert(1)" }, { tags: [null] }, { author: {} }, { title: [] }, { version: 0 }]) {
    assert.throws(() => gallery.metadata({ ...value, ...changes }));
  }
});

test("publishing a saved project follows its own provenance instead of a previous transfer", () => {
  const origin = "https://profilekit.example";
  const previous = { id: "f".repeat(32), version: 1 };
  const document = { provenance: { origin, id, version: 4 } };
  assert.deepEqual(gallery.publishSource(document, origin, previous), { id, version: 4 });
  assert.deepEqual(gallery.publishSource({}, origin, previous), previous);
  assert.equal(gallery.publishSource({}, origin), null);
  for (const source of [{ origin, id: "../entry", version: 1 }, { origin, id, version: 101 }]) {
    assert.throws(() => gallery.publishSource({ provenance: source }, origin));
  }
});

test("foreign gallery provenance cannot resolve to a colliding local design ID", () => {
  const foreign = { origin: "https://original.example", id, version: 2 };
  const local = { origin: "https://profilekit.example", id, version: 2 };
  const isForeignSource = (error) => error.code === "foreign_source" && error.origin === foreign.origin;
  assert.throws(() => gallery.publishSource({ provenance: foreign }, local.origin, local), isForeignSource);
  assert.throws(() => gallery.publishSource({}, local.origin, foreign), isForeignSource);
  assert.deepEqual(gallery.publishSource({ provenance: foreign }, foreign.origin), { id, version: 2 });
});

test("reuse guidance retains CC BY obligations through CC0 remix ancestors", () => {
  const cc0 = { license: "CC0-1.0" }, ccBy = { license: "CC-BY-4.0" };
  assert.equal(gallery.licenseGuidance(ccBy), "attributionRequired");
  assert.equal(gallery.licenseGuidance(cc0), "publicDomain");
  assert.equal(gallery.licenseGuidance({ ...cc0, attributions: [cc0] }), "publicDomain");
  assert.equal(gallery.licenseGuidance({ ...cc0, attributions: [ccBy, cc0], source: cc0 }), "ancestorAttributionRequired");
  assert.equal(gallery.licenseGuidance({ ...cc0, source: ccBy }), "ancestorAttributionRequired");
});
