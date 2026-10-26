const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createHash, webcrypto } = require("node:crypto");
const model = require("../public/editor-model");
const ai = require("../public/ai-design");

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFElEQVR4nGN8WObCwMDAxAAGUAoAH3IBoeysng8AAAAASUVORK5CYII=";
const fakeRevision = `sha256:${"0".repeat(64)}`;
const proposal = (baseRevision, operations, summary = "Update requested layers") => ({ version: 1, baseRevision, summary, operations });
const parse = (operations) => ai.parseProposal(JSON.stringify(proposal(fakeRevision, operations)));
function fixture() {
  return model.createDocument({ name: "Manual profile", elements: [
    model.createElement("text", { id: "title", text: "A manually edited title", color: "#aabbcc" }),
    model.createElement("image", { id: "portrait", src: PNG }),
    model.createElement("card", { id: "github", endpoint: "stats", params: { username: "ren", theme: "nord", hide_border: "true" },
      sourceOrigin: "https://cards.example", linkUrl: "https://github.com/ren", alt: "Ren's statistics", displayWidth: "100%",
      nativeWidth: 600, nativeHeight: 280, overflow: "visible",
      parts: { username: { dx: 12, color: "#112233" }, stars: { dy: 4 } },
      effect: { kind: "shadow", color: "#000000", blur: 5, opacity: 0.5, dx: 3, dy: 4 },
    }),
  ] });
}

test("AI updates preserve unrelated manual edits, assets, accounts and card metadata", async () => {
  const original = fixture();
  const snapshot = structuredClone(original);
  const base = await ai.revision(original);
  const request = proposal(base, [
    { op: "update", id: "title", changes: { fontSize: 72 } },
    { op: "update", id: "github", changes: { params: { theme: "dark" }, parts: { username: { dx: 24 } }, effect: { blur: 9 } } },
  ]);
  const requestSnapshot = structuredClone(request);
  const result = await ai.applyProposal(original, request, base);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(request, requestSnapshot);
  assert.deepEqual(result.document.elements[1], original.elements[1]);
  assert.equal(result.document.elements[0].text, original.elements[0].text);
  assert.equal(result.document.elements[0].color, "#aabbcc");
  const updated = result.document.elements[2];
  assert.deepEqual(updated.params, { username: "ren", theme: "dark", hide_border: "true" });
  for (const key of ["linkUrl", "alt", "sourceOrigin", "displayWidth", "nativeWidth", "nativeHeight", "overflow"]) assert.equal(updated[key], original.elements[2][key]);
  assert.deepEqual(updated.parts, { username: { dx: 24, dy: 0, scale: 1, color: "#112233" }, stars: { dx: 0, dy: 4, scale: 1 } });
  assert.deepEqual(updated.effect, { ...original.elements[2].effect, blur: 9 });
  assert.deepEqual(result.changes, [
    { op: "update", id: "title", type: "text", fields: ["fontSize"] },
    { op: "update", id: "github", type: "card", fields: ["effect.blur", "params.theme", "parts.username.dx"] },
  ]);
  assert.notEqual(result.revision, base);
  result.document.elements[2].params.username = "another";
  assert.equal(original.elements[2].params.username, "ren");
});

test("re-request uses the latest manual edits and rejects stale proposals atomically", async () => {
  const document = fixture();
  const firstBase = await ai.revision(document);
  const first = await ai.applyProposal(document, proposal(firstBase, [{ op: "update", id: "title", changes: { fontSize: 80 } }]));
  first.document.elements[0].text = "User edited this after AI";
  const latest = structuredClone(first.document);
  await assert.rejects(ai.applyProposal(first.document, proposal(firstBase, [{ op: "remove", id: "portrait" }]), firstBase), /stale/);
  assert.deepEqual(first.document, latest);
  const nextPrompt = await ai.buildPrompt(first.document, "Change only the background");
  assert.match(nextPrompt.prompt, /User edited this after AI/);
  const next = await ai.applyProposal(first.document, proposal(nextPrompt.baseRevision, [{ op: "canvas", changes: { background: "#ffffff" } }]), nextPrompt.baseRevision);
  assert.deepEqual(next.document.elements, first.document.elements);
  await assert.rejects(ai.applyProposal(first.document, proposal(nextPrompt.baseRevision, []), firstBase), /stale/);
});

test("empty documents can become editable drafts with deterministic defaults", async () => {
  const original = model.createDocument();
  const { baseRevision } = await ai.buildPrompt(original, "A simple profile with a heading and background block");
  const result = await ai.applyProposal(original, proposal(baseRevision, [
    { op: "canvas", changes: { name: "My profile", width: 800, height: 400 } },
    { op: "add", element: { id: "block", type: "rect", x: 10, y: 10, width: 780, height: 380, fill: "#123456" } },
    { op: "add", element: { id: "heading", type: "text", text: "Hello", x: 40, y: 40 } },
  ]));
  assert.equal(result.document.elements[1].fontFamily, "sans");
  assert.equal(result.document.elements[1].text, "Hello");
  assert.deepEqual(model.parseDocument(model.serializeDocument(result.document)), result.document);
  assert.equal(original.elements.length, 0);
  assert.deepEqual(result.changes.map((change) => change.op), ["canvas", "add", "add"]);
});

test("explicit deletions affect only named properties or layers", async () => {
  const original = fixture();
  const result = await ai.applyProposal(original, proposal(await ai.revision(original), [
    { op: "update", id: "github", changes: { params: { hide_border: null }, linkUrl: null, parts: { username: { color: null } }, effect: null } },
    { op: "remove", id: "title" },
  ]));
  assert.deepEqual(result.document.elements.map((element) => element.id), ["portrait", "github"]);
  assert.deepEqual(result.document.elements[1].params, { username: "ren", theme: "nord" });
  assert.equal(result.document.elements[1].linkUrl, undefined);
  assert.equal(result.document.elements[1].effect, undefined);
  assert.equal(result.document.elements[1].parts.username.color, undefined);
  assert.deepEqual(result.document.elements[1].parts.stars, original.elements[2].parts.stars);
});

test("malformed operations, unsafe fields and prototype keys cannot enter the contract", () => {
  const valid = proposal(fakeRevision, []);
  assert.deepEqual(ai.parseProposal(`\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\`\n`), valid);
  for (const raw of ["not json", `Here is a result: ${JSON.stringify(valid)}`, "```json\n{}\n```\n```json\n{}\n```", "[]", "null",
    JSON.stringify({ ...valid, version: 2 }), JSON.stringify({ ...valid, script: "alert(1)" }),
    JSON.stringify({ ...valid, operations: Array(65).fill({ op: "remove", id: "title" }) }),
    '{"version":1,"baseRevision":"' + fakeRevision + '","summary":"","operations":[],"__proto__":{"polluted":true}}']) assert.throws(() => ai.parseProposal(raw));
  for (const operation of [
    { op: "replace", document: {} }, { op: "add", element: { type: "script", id: "bad" } },
    { op: "add", element: { type: "rect", id: "bad", svg: "<svg/>" } },
    { op: "add", element: { type: "rect", id: "backdrop" }, beforeId: null },
    { op: "add", element: { type: "rect", id: "backdrop" }, beforeId: "bad target" },
    { op: "update", id: "title", changes: { id: "new" } }, { op: "update", id: "title", changes: { type: "image" } },
    { op: "update", id: "title", changes: { onload: "alert(1)" } },
    { op: "canvas", changes: { elements: [] } }, { op: "remove", id: "title", ignore: true },
  ]) assert.throws(() => parse([operation]));
  assert.equal({}.polluted, undefined);
});

test("AI can insert decorations behind existing content without rebuilding its layers", async () => {
  const original = fixture();
  const snapshot = structuredClone(original);
  const baseRevision = await ai.revision(original);
  const result = await ai.applyProposal(original, proposal(baseRevision, [
    { op: "add", beforeId: "title", element: { id: "backdrop", type: "rect", fill: "#112233" } },
    { op: "add", beforeId: "github", element: { id: "panel", type: "rect", fill: "#223344" } },
    { op: "add", beforeId: "backdrop", element: { id: "glow", type: "ellipse", fill: "#334455" } },
  ]));
  assert.deepEqual(result.document.elements.map(({ id }) => id), ["glow", "backdrop", "title", "portrait", "panel", "github"]);
  for (const element of original.elements) assert.deepEqual(result.document.elements.find(({ id }) => id === element.id), element);
  assert.deepEqual(original, snapshot);
  const prompt = await ai.buildPrompt(original, "Put a panel behind the title");
  assert.match(prompt.prompt, /beforeId/);
  assert.match(prompt.prompt, /back to front/);
  for (const beforeId of ["missing", "backdrop"]) {
    await assert.rejects(ai.applyProposal(original, proposal(baseRevision, [
      { op: "update", id: "title", changes: { x: 100 } },
      { op: "add", beforeId, element: { id: "backdrop", type: "rect" } },
    ])), /Unknown insertion target/);
    assert.deepEqual(original, snapshot);
  }
  await assert.rejects(ai.applyProposal(original, proposal(baseRevision, [
    { op: "remove", id: "title" },
    { op: "add", beforeId: "title", element: { id: "backdrop", type: "rect" } },
  ])), /Unknown insertion target/);
});

test("a failed later operation never partially applies earlier operations", async () => {
  const original = fixture();
  const snapshot = structuredClone(original);
  const base = await ai.revision(original);
  for (const operation of [
    { op: "remove", id: "missing" },
    { op: "update", id: "missing", changes: { x: 20 } },
    { op: "update", id: "title", changes: { fill: "#ffffff" } },
    { op: "update", id: "title", changes: { text: null } },
    { op: "update", id: "github", changes: { params: null } },
    { op: "update", id: "github", changes: { parts: { unsafe: null } } },
    { op: "update", id: "github", changes: { parts: { username: { onload: null } } } },
    { op: "update", id: "github", changes: { effect: { onload: null } } },
    { op: "add", element: { id: "title", type: "rect" } },
    { op: "update", id: "github", changes: { linkUrl: "javascript:alert(1)" } },
  ]) {
    await assert.rejects(ai.applyProposal(original, proposal(base, [{ op: "update", id: "title", changes: { x: 100 } }, operation])));
    assert.deepEqual(original, snapshot);
  }
  await assert.rejects(ai.applyProposal(original, proposal(base, [{ op: "remove", id: "github" }, { op: "add", element: { id: "github", type: "rect" } }])), /Duplicate/);
});

test("unsafe numeric input is rejected instead of silently clamped", async () => {
  const document = fixture();
  const base = await ai.revision(document);
  for (const changes of [{ x: 4097 }, { width: 0 }, { opacity: 2 }, { fontSize: 9999 }, { x: 1.2345 }, { effect: { blur: 99 } },
    { effect: { opacity: -1 } }, { effect: { opacity: 0, dx: 900 } }]) {
    const id = changes.effect ? "github" : "title";
    await assert.rejects(ai.applyProposal(document, proposal(base, [{ op: "update", id, changes }])), /bounds|decimal/);
  }
  await assert.rejects(ai.applyProposal(document, proposal(base, [{ op: "canvas", changes: { width: 99999 } }])), /bounds/);
  await assert.rejects(ai.applyProposal(document, proposal(base, [{ op: "add", element: { id: "bad", type: "rect", radius: 1000 } }])), /bounds/);
  await assert.rejects(ai.applyProposal(document, proposal(base, [{ op: "update", id: "github", changes: { parts: { username: { scale: 200 } } } }])), /bounds/);
  await assert.rejects(ai.applyProposal(document, proposal(base, [{ op: "update", id: "github", changes: { parts: { commits: { dx: 0.0001 } } } }])), /decimal/);
});

test("prompts redact raster bytes and permit only protected local asset references", async () => {
  const document = fixture();
  const prompt = await ai.buildPrompt(document, "Move the portrait to the left", { selectedIds: ["portrait"] });
  assert.doesNotMatch(prompt.prompt, /data:image|iVBORw0KGgo/);
  assert.match(prompt.prompt, /"src":"asset:portrait"/);
  assert.match(prompt.prompt, /"protectedAssets":\["portrait"\]/);
  assert.match(prompt.prompt, /"selectedIds":\["portrait"\]/);
  const result = await ai.applyProposal(document, proposal(prompt.baseRevision, [
    { op: "update", id: "portrait", changes: { x: 0 } },
    { op: "add", element: { id: "copy", type: "image", src: "asset:portrait", width: 32, height: 48 } },
  ]));
  assert.equal(result.document.elements[1].src, PNG);
  assert.equal(result.document.elements.at(-1).src, PNG);
  for (const src of ["https://example.test/photo.png", "data:image/svg+xml,<svg/>", PNG, "asset:missing", "asset:title"]) {
    await assert.rejects(ai.applyProposal(document, proposal(prompt.baseRevision, [{ op: "update", id: "portrait", changes: { src } }])), /protected asset/);
  }
});

test("revisions are canonical SHA-256 digests and include protected image bytes", async () => {
  const original = fixture();
  const reordered = structuredClone(original);
  reordered.elements[2].params = { hide_border: "true", theme: "nord", username: "ren" };
  assert.equal(await ai.revision(original), await ai.revision(reordered));
  const first = await ai.revision(original);
  const hash = createHash("sha256");
  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }
  assert.equal(first, `sha256:${hash.update(stable(original)).digest("hex")}`);
  original.elements[1].fit = "contain";
  assert.notEqual(await ai.revision(original), first);
});

test("async validation snapshots proposals and rejects document edits while hashing", async () => {
  const document = fixture();
  const base = await ai.revision(document);
  const request = proposal(base, [{ op: "update", id: "title", changes: { x: 123 } }]);
  const pending = ai.applyProposal(document, request);
  request.operations[0].changes.x = 900;
  const result = await pending;
  assert.equal(result.document.elements[0].x, 123);
  const changing = ai.applyProposal(document, request);
  document.elements[0].text = "new mutation";
  await assert.rejects(changing, /stale/);
  assert.equal(document.elements[0].text, "new mutation");
});

test("browser UMD contract uses Web Crypto without browser or network state", async () => {
  const sandbox = { TextEncoder, atob, btoa, URL, crypto: webcrypto };
  vm.createContext(sandbox);
  for (const file of ["card-schema", "card-decoration", "editor-model", "ai-design"]) vm.runInContext(fs.readFileSync(require.resolve(`../public/${file}`), "utf8"), sandbox);
  const result = await vm.runInContext(`(async () => {
    const document = ProfileKitEditorModel.createDocument();
    const { baseRevision } = await ProfileKitAIDesign.buildPrompt(document, "Add a heading");
    return ProfileKitAIDesign.applyProposal(document, {version:1,baseRevision,summary:"Heading",operations:[{op:"add",element:{id:"heading",type:"text",text:"Hello"}}]});
  })()`, sandbox);
  assert.equal(result.document.elements[0].text, "Hello");
  assert.match(result.revision, /^sha256:[a-f0-9]{64}$/);
});

function controllerFixture({ preview = async () => "<svg/>", fetch } = {}) {
  const nodes = new Map();
  class Node {
    constructor() { this.listeners = {}; this.children = []; this.value = ""; this.open = false; this.hidden = false; }
    setAttribute(key, value) { this[key] = value; if (key === "id") nodes.set(value, this); }
    append(...children) { this.children.push(...children); }
    after() {}
    replaceChildren(...children) { this.children = children; }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    focus() {}
    showModal() { this.open = true; }
    close() { this.open = false; this.listeners.close?.(); }
  }
  const get = (id) => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
  const document = { createElement: () => new Node(), getElementById: get, querySelector: () => new Node(), body: new Node() };
  let applied = 0;
  const sandbox = { TextEncoder, atob, btoa, URL, Blob, AbortController, crypto: webcrypto, document, fetch,
    preview, applied: () => { applied++; } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ["card-schema", "card-decoration", "editor-model", "ai-design"]) {
    vm.runInContext(fs.readFileSync(require.resolve(`../public/${file}`), "utf8"), sandbox);
  }
  vm.runInContext(`
    const current = ProfileKitEditorModel.createDocument({elements: [
      ProfileKitEditorModel.createElement("text", {id: "title", text: "Title"}),
      ProfileKitEditorModel.createElement("text", {id: "caption", text: "Caption"})
    ]});
    window.ProfileKitEditor = {
      snapshot: async () => JSON.parse(JSON.stringify(current)),
      selectedIds: () => ["caption"],
      preview,
      apply: applied
    };
  `, sandbox);
  vm.runInContext(fs.readFileSync(require.resolve("../public/editor-ai"), "utf8"), sandbox);
  get("ai-open").listeners.click();
  return { get, click: (id) => get(id).listeners.click(), applied: () => applied };
}

test("a new request invalidates an older review still waiting for its previews", { timeout: 3000 }, async () => {
  const resolvers = [];
  let ready;
  const previewsStarted = new Promise((resolve) => { ready = resolve; });
  const controller = controllerFixture({ preview: () => new Promise((resolve) => {
    resolvers.push(resolve); if (resolvers.length === 2) ready();
  }) });
  controller.get("ai-instruction").value = "Make the selected text red";
  await controller.click("ai-prepare");
  const oldContext = JSON.parse(controller.get("ai-prompt").value.split("\n\n").at(-1));
  controller.get("ai-response").value = JSON.stringify(proposal(oldContext.baseRevision,
    [{ op: "update", id: "caption", changes: { color: "#ff0000" } }], "Old red proposal"));
  const review = controller.click("ai-review");
  await previewsStarted;
  controller.get("ai-instruction").value = "Make the selected text green";
  await controller.click("ai-prepare");
  assert.equal(controller.get("ai-comparison").hidden, true);
  resolvers.forEach((resolve) => resolve("<svg/>"));
  await review;
  assert.equal(controller.get("ai-comparison").hidden, true);
  assert.notEqual(controller.get("ai-summary").textContent, "Old red proposal");
  await controller.click("ai-apply");
  assert.equal(controller.applied(), 0);
  const newContext = JSON.parse(controller.get("ai-prompt").value.split("\n\n").at(-1));
  assert.equal(newContext.designRequest, "Make the selected text green");
});

test("the controller sends its captured selection and ignores superseded API results", { timeout: 3000 }, async () => {
  let sent, respond, fetched;
  const requestStarted = new Promise((resolve) => { fetched = resolve; });
  const controller = controllerFixture({ fetch: async (_, options) => {
    sent = { body: JSON.parse(options.body), signal: options.signal }; fetched();
    return new Promise((resolve) => { respond = resolve; });
  } });
  controller.get("ai-key").value = "test-key";
  controller.get("ai-model").value = "test-model";
  controller.get("ai-instruction").value = "Make the selected text red";
  const generate = controller.click("ai-generate");
  await requestStarted;
  assert.deepEqual(sent.body.selectedIds, ["caption"]);
  assert.equal(sent.body.instruction, "Make the selected text red");
  controller.get("ai-instruction").value = "Make the selected text green";
  await controller.click("ai-prepare");
  assert.equal(sent.signal.aborted, true);
  respond({ ok: true, json: async () => ({ proposal: proposal(sent.body.baseRevision,
    [{ op: "update", id: "caption", changes: { color: "#ff0000" } }], "Superseded result") }) });
  await generate;
  assert.equal(controller.get("ai-comparison").hidden, true);
  assert.equal(controller.get("ai-response").value, "");
  assert.equal(controller.get("ai-generate").disabled, false);
});
