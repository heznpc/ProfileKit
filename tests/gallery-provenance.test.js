const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../public/editor-model");
const D = require("../public/card-design");
const AI = require("../public/ai-design");
const origin = "https://cards.example";
const entry = { id: "a".repeat(32), version: 2, title: '<Design "one">', author: "A & B", license: "CC-BY-4.0", attributions: [] };
const project = () => M.createDocument({ background: "transparent", width: 900, height: 220, elements: [
  M.createElement("card", { id: "hero", endpoint: "hero", params: { name: "My profile" }, width: 900, height: 220, nativeWidth: 900, nativeHeight: 220 }),
] });

test("gallery provenance survives project files, URL roundtrip and targeted AI changes", async () => {
  const doc = M.withGallerySource(project(), entry, origin);
  assert.deepEqual(M.parseDocument(M.serializeDocument(doc)), doc);
  assert.deepEqual(D.parseDesignInput(D.designUrl(doc, origin), origin), doc);
  const baseRevision = await AI.revision(doc);
  const changed = await AI.applyProposal(doc, { version: 1, baseRevision, summary: "New background", operations: [{ op: "canvas", changes: { background: "#ffffff" } }] });
  assert.deepEqual(changed.document.provenance, doc.provenance);
  assert.equal(project().provenance, undefined);
});

test("README output credits creators and licenses safely in every output mode", () => {
  const doc = M.withGallerySource(project(), entry, origin);
  for (const output of [D.readme(doc, origin), D.readmeAsset(doc, "assets/card.svg"), D.readmeCards(doc, origin)]) {
    assert.ok(output.includes(`https://cards.example/gallery.html#design=${entry.id}&amp;version=2`));
    assert.ok(output.includes("CC-BY-4.0"));
    assert.ok(output.includes("A &amp; B"));
    assert.ok(output.includes("&lt;Design &quot;one&quot;&gt;"));
    assert.ok(!output.includes(entry.title));
    assert.match(output, /may have been modified/);
  }
  assert.ok(!D.readme(project(), origin).includes("<sub>"));
});

test("untrusted project provenance cannot inject unsupported origins or unbounded metadata", () => {
  const doc = M.withGallerySource(project(), entry, origin);
  for (const changes of [{ origin: "javascript:alert(1)" }, { id: "../bad" }, { version: 0 }, { credits: [] }, { secret: "no" },
    { credits: [{ ...entry, attributions: undefined }] }, { credits: [{ id: entry.id, version: 2, title: "x".repeat(121), author: "A", license: "CC-BY-4.0" }] }]) {
    assert.throws(() => M.normalizeDocument({ ...doc, provenance: { ...doc.provenance, ...changes } }));
  }
});
