const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { Readable } = require("node:stream");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const Model = require("../public/editor-model");
const { FileGalleryStore } = require("../src/gallery/file-store");
const { GalleryService, LIMITS } = require("../src/gallery/service");
const { createGalleryHandler } = require("../src/endpoints/gallery");

const execute = promisify(execFile);
function document(label = "A shared design") {
  return Model.createDocument({ width: 640, height: 240, elements: [Model.createElement("text", { id: "heading", text: label, fontSize: 28 })] });
}
function draft(overrides = {}) {
  return { title: "Quiet garden", description: "A composable profile", author: "Garden author", tags: ["Minimal", "Botanical"],
    license: "CC-BY-4.0", document: document(), ...overrides };
}
async function fixture(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "profilekit-gallery-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const storage = new FileGalleryStore(directory);
  return { directory, storage, handler: createGalleryHandler({ storage, publicOrigin: "https://gallery.example", publishKey: "", ...options }) };
}
async function request(handler, url = "/api/gallery", { method = "GET", body, headers = {}, chunks } = {}) {
  const req = chunks ? Readable.from(chunks) : { body };
  Object.assign(req, { url, method, headers: { ...(body !== undefined || chunks ? { "content-type": "application/json" } : {}), ...headers } });
  const response = { statusCode: 200, headers: {}, body: "",
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    send(value) { this.body = String(value); return this; } };
  await handler(req, response);
  if (response.headers["content-type"].startsWith("application/json")) response.json = JSON.parse(response.body);
  return response;
}
function owner(editToken) { return { authorization: `Bearer ${editToken}` }; }

test("shared gallery persists publish, search, forks, owner revisions and withdrawal across independent clients", async (t) => {
  const { directory, handler, storage } = await fixture(t);
  const created = await request(handler, "/api/gallery", { method: "POST", body: draft() });
  assert.equal(created.statusCode, 201);
  const first = created.json;
  assert.match(first.id, /^[a-f0-9]{32}$/);
  assert.match(first.editToken, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(first.tags, ["minimal", "botanical"]);
  assert.equal(created.headers["cache-control"], "no-store, max-age=0");
  const onDisk = await storage.get(first.id);
  assert.notEqual(onDisk.ownerHash, first.editToken);
  assert.equal(JSON.stringify(onDisk).includes(first.editToken), false);

  // Each factory has independent state: persisted records, not browser state,
  // are the source of truth for another browser or a restarted server.
  const restarted = createGalleryHandler({ storage: new FileGalleryStore(directory), publishKey: "" });
  const found = await request(restarted, "/api/gallery?q=GARDEN&tag=minimal");
  assert.equal(found.json.items.length, 1);
  assert.equal(found.body.includes("ownerHash"), false);
  assert.equal(found.body.includes("editToken"), false);
  const original = await request(restarted, first.projectUrl);
  assert.deepEqual(original.json.document, draft().document);
  const originalSVG = await request(restarted, first.svgUrl);
  assert.equal(originalSVG.statusCode, 200);
  assert.match(originalSVG.body, /^<svg/);
  assert.match(originalSVG.body, /A shared design/);

  const source = { id: first.id, version: first.version };
  const forks = await Promise.all(["Client A", "Client B"].map((author) => request(restarted, "/api/gallery", {
    method: "POST", body: draft({ author, title: `${author} fork`, source, document: document(author) }),
  })));
  assert.equal(forks.every((fork) => fork.statusCode === 201), true);
  assert.notEqual(forks[0].json.id, forks[1].json.id);
  assert.equal(forks[0].json.source.author, "Garden author");
  assert.equal(forks[0].json.attributions[0].id, first.id);
  assert.equal((await request(restarted, first.projectUrl)).json.document.elements[0].text, "A shared design");

  const update = draft({ expectedVersion: 1, title: "Garden at night", document: document("Revision two") });
  assert.equal((await request(handler, `/api/gallery?id=${first.id}`, { method: "PATCH", body: update, headers: owner(forks[0].json.editToken) })).statusCode, 403);
  const revised = await request(handler, `/api/gallery?id=${first.id}`, { method: "PATCH", body: update, headers: owner(first.editToken) });
  assert.equal(revised.statusCode, 200);
  assert.equal(revised.json.version, 2);
  assert.equal(revised.json.editToken, undefined);
  assert.equal((await request(restarted, `/api/gallery?id=${first.id}`, { method: "PATCH", body: update, headers: owner(first.editToken) })).statusCode, 409);
  assert.equal((await request(restarted, first.projectUrl)).body, original.body);
  assert.equal((await request(restarted, first.svgUrl)).body, originalSVG.body);
  assert.equal((await request(restarted, revised.json.projectUrl)).json.document.elements[0].text, "Revision two");

  assert.equal((await request(handler, `/api/gallery?id=${first.id}`, { method: "DELETE", headers: owner(forks[0].json.editToken) })).statusCode, 403);
  const withdrawn = await request(handler, `/api/gallery?id=${first.id}`, { method: "DELETE", headers: owner(first.editToken) });
  assert.deepEqual(withdrawn.json, { id: first.id, version: 2, withdrawn: true });
  assert.equal((await request(restarted, "/api/gallery")).json.items.some((item) => item.id === first.id), false);
  assert.equal((await request(restarted, `/api/gallery?id=${first.id}`)).statusCode, 404);
  assert.equal((await request(restarted, first.svgUrl)).body, originalSVG.body);
  assert.equal((await request(restarted, revised.json.projectUrl)).statusCode, 200);
  assert.equal((await request(handler, `/api/gallery?id=${first.id}`, { method: "PATCH", body: { ...update, expectedVersion: 2 }, headers: owner(first.editToken) })).statusCode, 410);
});

test("multi-process updates serialize and a stale version cannot replace another revision", async (t) => {
  const { directory, storage } = await fixture(t);
  const created = await new GalleryService(storage).publish(draft());
  const script = `
    const { FileGalleryStore } = require('./src/gallery/file-store');
    const { GalleryService } = require('./src/gallery/service');
    const input = JSON.parse(Buffer.from(process.argv[1], 'base64url'));
    new GalleryService(new FileGalleryStore(input.directory)).update(input.id, input.token, input.body)
      .then(result => process.stdout.write(JSON.stringify({version:result.version})))
      .catch(error => process.stdout.write(JSON.stringify({status:error.status,code:error.code})));
  `;
  const inputs = ["Writer one", "Writer two"].map((title) => Buffer.from(JSON.stringify({ directory, id: created.id,
    token: created.editToken, body: draft({ title, expectedVersion: 1 }) })).toString("base64url"));
  const outputs = await Promise.all(inputs.map((input) => execute(process.execPath, ["-e", script, input], { cwd: path.join(__dirname, "..") })));
  const outcomes = outputs.map((output) => JSON.parse(output.stdout));
  assert.equal(outcomes.filter((item) => item.version === 2).length, 1);
  assert.equal(outcomes.filter((item) => item.status === 409).length, 1);
  assert.equal((await storage.get(created.id)).metadata.version, 2);
  assert.equal((await storage.readRevision(created.id, 1)).metadata.title, "Quiet garden");
});

test("declared remix attribution is resolved from the source and cannot be replaced on update", async (t) => {
  const { storage } = await fixture(t);
  const service = new GalleryService(storage);
  const original = await service.publish(draft());
  const fork = await service.publish(draft({ author: "Remixer", source: { id: original.id, version: 1 }, license: "CC0-1.0" }));
  await assert.rejects(service.publish(draft({ source: { id: original.id, version: 1, author: "Forged" } })), /unsupported field/);
  await assert.rejects(service.update(fork.id, fork.editToken, draft({ author: "Remixer", source: null, expectedVersion: 1 })), /attribution cannot be replaced/);
  const revised = await service.update(fork.id, fork.editToken, draft({ author: "Remixer", expectedVersion: 1 }));
  assert.deepEqual(revised.source, fork.source);
  assert.deepEqual(revised.attributions, fork.attributions);
  const secondFork = await service.publish(draft({ source: { id: fork.id, version: 2 } }));
  assert.deepEqual(secondFork.attributions.map((item) => item.id), [original.id, fork.id]);
});

test("write requests reject forged origins, unsupported methods, types, secrets and unsafe project data", async (t) => {
  const { handler } = await fixture(t, { publishKey: "private-deployment-key" });
  const publishHeaders = { "x-profilekit-publish-key": "private-deployment-key" };
  assert.equal((await request(handler, "/api/gallery", { method: "OPTIONS" })).statusCode, 405);
  assert.equal((await request(handler, "/api/gallery", { method: "POST", body: draft() })).json.error.code, "publish_key_required");
  const invalidRequests = [
    { headers: { origin: "https://evil.example", host: "evil.example" }, code: "cross_origin" },
    { headers: { origin: "https://gallery.example", "sec-fetch-site": "cross-site" }, code: "cross_origin" },
    { headers: { "content-type": "text/plain" }, code: "json_required" },
    { headers: { "content-encoding": "gzip" }, code: "encoding_not_supported" },
    { headers: { "content-length": String(LIMITS.maxBodyBytes + 1) }, code: "body_too_large" },
    { body: draft({ license: "MIT" }), code: "invalid_license" },
    { body: draft({ document: { ...document(), svg: "<svg onload='bad'/>" } }), code: "invalid_document" },
    { body: draft({ description: `ghp_${"a".repeat(36)}` }), code: "public_secret" },
    { body: draft({ description: "https://example.com/theme.json?token=private" }), code: "public_secret" },
  ];
  for (const invalid of invalidRequests) {
    const result = await request(handler, "/api/gallery", { method: "POST", body: invalid.body || draft(), headers: { ...publishHeaders, ...invalid.headers } });
    assert.equal(result.json.error.code, invalid.code);
  }
  const card = Model.createElement("card", { id: "unsafe", endpoint: "hero", params: {} });
  card.params.api_key = "private";
  assert.equal((await request(handler, "/api/gallery", { method: "POST", headers: publishHeaders, body: draft({ document: { ...document(), elements: [card] } }) })).json.error.code, "invalid_document");
  const image = { ...Model.createElement("rect", { id: "unsafe" }), type: "image", src: "data:image/svg+xml;base64,PHN2Zz4=", fit: "cover" };
  delete image.fill; delete image.stroke; delete image.strokeWidth; delete image.radius;
  assert.equal((await request(handler, "/api/gallery", { method: "POST", headers: publishHeaders, body: draft({ document: { ...document(), elements: [image] } }) })).json.error.code, "invalid_document");
  const okay = await request(handler, "/api/gallery", { method: "POST", body: draft({ title: "<b>Plain metadata</b>" }), headers: { ...publishHeaders, origin: "https://gallery.example", "sec-fetch-site": "same-origin" } });
  assert.equal(okay.statusCode, 201);
  assert.equal(okay.json.title, "<b>Plain metadata</b>");
  assert.equal(okay.headers["x-content-type-options"], "nosniff");
});

test("unconfigured galleries explain durable storage and never silently create an ephemeral database", async () => {
  const handler = createGalleryHandler({ directory: "", publicOrigin: "", publishKey: "" });
  const result = await request(handler, "/api/gallery?config=1");
  assert.equal(result.statusCode, 503);
  assert.equal(result.json.enabled, false);
  assert.match(result.json.error.message, /PROFILEKIT_GALLERY_DIR/);
  const badOrigin = await request(createGalleryHandler({ publicOrigin: "https://example.com/path" }), "/api/gallery");
  assert.equal(badOrigin.statusCode, 503);
  assert.equal(badOrigin.json.error.code, "gallery_configuration");
  assert.throws(() => new FileGalleryStore("./relative"), /absolute path/);
});

test("body streaming is bounded and origin fallback never trusts Host", async (t) => {
  const { storage } = await fixture(t);
  const handler = createGalleryHandler({ storage, publicOrigin: "", publishKey: "" });
  const payload = JSON.stringify(draft());
  assert.equal((await request(handler, "/api/gallery", { method: "POST", chunks: [payload.slice(0, 12), payload.slice(12)], headers: { "sec-fetch-site": "same-origin", origin: "https://configured-by-browser.example" } })).statusCode, 201);
  assert.equal((await request(handler, "/api/gallery", { method: "POST", body: draft(), headers: { host: "evil.example", origin: "https://evil.example" } })).statusCode, 403);
  assert.equal((await request(handler, "/api/gallery", { method: "POST", chunks: [Buffer.alloc(LIMITS.maxBodyBytes + 1)] })).statusCode, 413);
  assert.equal((await request(handler, "/api/gallery", { method: "POST", chunks: ["{not json"] })).statusCode, 400);
});

test("pagination is stable and query validation rejects ambiguous revisions", async (t) => {
  const { handler } = await fixture(t, { now: () => "2026-10-26T00:00:00.000Z" });
  for (let index = 0; index < 3; index++) await request(handler, "/api/gallery", { method: "POST", body: draft({ title: `Page ${index}` }) });
  const first = (await request(handler, "/api/gallery?limit=2")).json;
  const second = (await request(handler, `/api/gallery?limit=2&cursor=${first.nextCursor}`)).json;
  assert.equal(first.items.length, 2);
  assert.equal(second.items.length, 1);
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 3);
  assert.equal(second.nextCursor, null);
  for (const query of ["q=a&q=b", "version=1", "format=svg", "limit=99", "cursor=bad", "config=1&q=a", `id=${first.items[0].id}&format=svg`, `id=${first.items[0].id}&version=0`, "id=../secret"]) {
    assert.equal((await request(handler, `/api/gallery?${query}`)).statusCode, 400, query);
  }
});

test("crash leftovers are private and dead locks are retained for non-destructive recovery", async (t) => {
  const { storage, directory } = await fixture(t);
  const created = await new GalleryService(storage).publish(draft());
  const entry = path.join(directory, created.id);
  await fs.writeFile(path.join(entry, "revisions", "a".repeat(32) + ".json"), JSON.stringify({ version: 2, document: { private: true } }));
  assert.equal(await storage.readRevision(created.id, 2), null);
  await fs.writeFile(path.join(entry, ".write-lock"), JSON.stringify({ token: "stopped-writer", pid: 2147483647, host: os.hostname() }));
  await assert.rejects(storage.transaction(created.id, async (manifest) => ({ manifest })), (error) => error.code === "gallery_stale_lock");
  assert.equal(JSON.parse(await fs.readFile(path.join(entry, ".write-lock"), "utf8")).token, "stopped-writer");
  assert.equal((await storage.readRevision(created.id, 1)).metadata.title, "Quiet garden");
});
