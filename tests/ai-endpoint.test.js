const test = require("node:test");
const assert = require("node:assert/strict");
const { createAIHandler } = require("../src/endpoints/ai");
const AI = require("../public/ai-design");
const Model = require("../public/editor-model");

const key = "test-key-never-persist-this";
async function fixture() {
  const document = Model.createDocument({ elements: [Model.createElement("text", { id: "title", text: "Manual title" })] });
  return { document, instruction: "Make the title larger", model: "test-model", baseRevision: await AI.revision(document) };
}
async function invoke(handler, body, changes = {}) {
  const headers = { "content-type": "application/json", authorization: `Bearer ${key}`, "sec-fetch-site": "same-origin", ...changes.headers };
  const req = { method: "POST", body, ...changes, headers };
  const result = { status: 200, headers: {} };
  const res = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.status = code; return this; },
    send(value) { result.body = JSON.parse(value); return this; },
  };
  await handler(req, res);
  return result;
}
const response = (proposal) => ({ ok: true, json: async () => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(proposal) }] }] }) });

test("AI endpoint sends an explicit transient request and returns only a validated proposal", async () => {
  const input = await fixture();
  const original = structuredClone(input);
  const proposal = { version: 1, baseRevision: input.baseRevision, summary: "Larger title", operations: [{ op: "update", id: "title", changes: { fontSize: 72 } }] };
  let sent;
  const handler = createAIHandler({ fetchImpl: async (url, options) => { sent = { url, options, body: JSON.parse(options.body) }; return response(proposal); } });
  const result = await invoke(handler, input);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.proposal, proposal);
  assert.deepEqual(input, original);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.equal(sent.url, "https://api.openai.com/v1/responses");
  assert.equal(sent.options.redirect, "error");
  assert.equal(sent.options.headers.Authorization, `Bearer ${key}`);
  assert.equal(sent.body.store, false);
  assert.equal(sent.body.model, input.model);
  assert.ok(!JSON.stringify(sent.body).includes(key));
  assert.ok(!JSON.stringify(result).includes(key));
});

test("invalid, cross-site and stale requests never reach the provider", async () => {
  const input = await fixture();
  const handler = createAIHandler({ fetchImpl: async () => { assert.fail("provider must not be called"); } });
  for (const [body, changes, status] of [
    [input, { method: "GET" }, 405],
    [input, { headers: { authorization: "" } }, 401],
    [input, { headers: { "sec-fetch-site": "cross-site" } }, 403],
    [input, { headers: { "content-type": "text/plain" } }, 415],
    ["not JSON", {}, 400],
    [{ ...input, model: "bad model" }, {}, 400],
    [{ ...input, selectedIds: "title" }, {}, 400],
    [{ ...input, selectedIds: ["missing"] }, {}, 400],
    [{ ...input, selectedIds: ["title", "title"] }, {}, 400],
    [{ ...input, baseRevision: "stale" }, {}, 409],
    [input, { headers: { "content-length": "999999999" } }, 413],
  ]) assert.equal((await invoke(handler, body, changes)).status, status);
});

test("direct API prompts preserve the validated selection from the editor", async () => {
  const input = await fixture();
  input.document.elements.push(Model.createElement("text", { id: "caption", text: "Keep this caption" }));
  input.baseRevision = await AI.revision(input.document);
  input.instruction = "Make the selected text blue";
  input.selectedIds = ["title"];
  let sentPrompt;
  const proposal = { version: 1, baseRevision: input.baseRevision, summary: "Blue title", operations: [{ op: "update", id: "title", changes: { color: "#0000ff" } }] };
  const handler = createAIHandler({ fetchImpl: async (_, options) => {
    sentPrompt = JSON.parse(options.body).input[1].content;
    return response(proposal);
  } });
  const result = await invoke(handler, input);
  assert.equal(result.status, 200);
  const external = await AI.buildPrompt(input.document, input.instruction, { selectedIds: input.selectedIds });
  assert.equal(sentPrompt, external.prompt);
  assert.deepEqual(JSON.parse(sentPrompt.split("\n\n").at(-1)).selectedIds, ["title"]);
});

test("provider failures and invalid output leave the original intact and redact provider secrets", async () => {
  const input = await fixture();
  const snapshot = structuredClone(input);
  const invalid = { version: 1, baseRevision: input.baseRevision, summary: "Unsafe", operations: [{ op: "update", id: "title", changes: { invented: "field" } }] };
  for (const [fetchImpl, status] of [
    [async () => ({ ok: false, status: 401 }), 401],
    [async () => ({ ok: false, status: 429 }), 429],
    [async () => ({ ok: false, status: 500 }), 502],
    [async () => { throw new Error(key); }, 502],
    [async () => ({ ok: true, json: async () => ({ status: "incomplete", error: key }) }), 502],
    [async () => ({ ok: true, json: async () => ({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] }) }), 422],
    [async () => response(invalid), 502],
  ]) {
    const result = await invoke(createAIHandler({ fetchImpl }), input);
    assert.equal(result.status, status);
    assert.ok(!JSON.stringify(result).includes(key));
    assert.deepEqual(input, snapshot);
  }
});
