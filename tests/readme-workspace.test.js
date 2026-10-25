const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const DRAFT_KEY = "profilekit.readme-document.v1";
const publicSource = (name) => fs.readFileSync(require.resolve(`../public/${name}.js`), "utf8");

// Exercise the browser event handlers and real models without a browser or network.
// The small DOM records rendered controls; the display-only preview is stubbed.
class Element {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.classList = { toggle() {} };
  }
  append(...children) {
    for (const child of children) { child.parent = this; this.children.push(child); }
  }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type, target = this) {
    return Promise.all((this.listeners.get(type) || []).map((listener) => listener({ type, target, preventDefault() {} })));
  }
  matches(selector) {
    const key = { "[data-param]": "param", "[data-card-id]": "cardId", "[data-check-id]": "checkId" }[selector];
    assert.ok(key, `Unsupported test selector: ${selector}`);
    return Object.hasOwn(this.dataset, key);
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
  focus() {}
}

function workspace(storage = new Map(), session = new Map(), hash = "") {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, new Element(id === "readme-source" ? "textarea" : "div"));
    return elements.get(id);
  };
  element("readme-origin").value = "https://profilekit.vercel.app";
  let nextTimer = 0;
  const timers = new Map();
  const previews = [];
  const sandbox = {
    URL, URLSearchParams, TextEncoder, TextDecoder, btoa, atob,
    crypto: { randomUUID: () => "test-handoff-token" },
    location: { href: "/readme.html" + hash, hash, pathname: "/readme.html", search: "" },
    history: { replaceState() {} },
    ProfileKitProjectTransfer: { async get(key) { if (key === DRAFT_KEY) return storage.has(key) ? vm.runInContext("JSON.parse(" + JSON.stringify(storage.get(key)) + ")", sandbox) : null; return session.has(key) ? vm.runInContext("JSON.parse(" + JSON.stringify(session.get(key)) + ")", sandbox) : null; }, async compareAndSet(key, expected, value) { if ((storage.get(key) ?? "null") !== JSON.stringify(expected)) return false; sandbox.localStorage.setItem(key, JSON.stringify(value)); return true; }, async set(key, value) { session.set(key, JSON.stringify(value)); }, async remove(key) { session.delete(key); } },
    sessionStorage: { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: (key) => session.delete(key) },
    document: { getElementById: element, createElement: (tag) => new Element(tag) },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    setTimeout: (callback) => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: (callback) => callback(),
    addEventListener() {},
    ProfileKitReadmePreview: { render: (source) => { previews.push(source); return "<!doctype html>"; } },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const name of ["card-schema", "card-decoration", "editor-model", "card-design", "readme-model", "readme"]) {
    vm.runInContext(publicSource(name), sandbox, { filename: `public/${name}.js` });
  }
  const click = (id) => element(id).dispatch("click");
  const editSource = (source) => { element("readme-source").value = source; element("readme-source").dispatch("input"); };
  return {
    element, click, editSource, storage, session, previews, transfer: sandbox.ProfileKitProjectTransfer, local: sandbox.localStorage, location: sandbox.location,
    async ready() { for (let i = 0; i < 40; i++) await Promise.resolve(); },
    importSource(source) { editSource(source); click("readme-import"); },
    async flushTimers() {
      for (let turns = 0; timers.size; turns++) {
        assert.ok(turns < 10, "Unexpected recurring workspace timer");
        const pending = [...timers.values()]; timers.clear();
        for (const callback of pending) await callback();
      }
    },
    checkedCards() {
      return element("readme-card-list").querySelectorAll("[data-check-id]").filter((input) => input.checked).map((input) => input.dataset.checkId);
    },
    selectOnly(id) {
      click("select-none");
      const list = element("readme-card-list");
      const checkbox = list.querySelectorAll("[data-check-id]").find((input) => input.dataset.checkId === id);
      assert.ok(checkbox, `Card checkbox ${id} exists`);
      checkbox.checked = true; list.dispatch("change", checkbox);
      const button = list.querySelectorAll("[data-card-id]").find((item) => item.dataset.cardId === id);
      list.dispatch("click", button);
    },
    draft() { return JSON.parse(storage.get(DRAFT_KEY)); },
  };
}

test("changing deployment origin flushes pending README text before rescanning and saving", async () => {
  const app = workspace();
  app.importSource("# Saved README\n");
  await app.flushTimers();
  const edited = "# Saved README\n\nA newly written paragraph with [a link](https://example.com).\n";
  app.editSource(edited);
  app.element("readme-origin").value = "https://cards.example.com";
  app.element("readme-origin").dispatch("change");
  await app.flushTimers();

  assert.equal(app.element("readme-source").value, edited);
  assert.equal(app.previews.at(-1), edited);
  assert.equal(app.draft().source, edited);
  assert.equal(app.draft().origin, "https://cards.example.com");
  app.click("readme-undo");
  assert.equal(app.element("readme-source").value, "# Saved README\n");
  app.click("readme-redo");
  assert.equal(app.element("readme-source").value, edited);
});

test("clearing the README persists an empty draft and reopening cannot resurrect the previous document", async () => {
  const app = workspace();
  app.importSource("# Previous document\n");
  await app.flushTimers();
  assert.equal(app.draft().source, "# Previous document\n");
  app.editSource("");
  app.element("readme-source").dispatch("change");
  await app.flushTimers();
  assert.equal(app.draft().source, "");

  const reopened = workspace(app.storage);
  await reopened.ready(); await reopened.flushTimers();
  assert.equal(reopened.element("readme-source").value, "");
  assert.equal(reopened.previews.at(-1), "");
  assert.equal(reopened.draft().source, "");
  assert.equal(reopened.element("readme-download").disabled, true);
});

for (const reconcileOnBlur of [true, false]) {
  test(`source reconciliation preserves the selected card and account controls ${reconcileOnBlur ? "on blur" : "when applying a batch directly"}`, async () => {
    const app = workspace();
    const stats = "![Stats](https://profilekit.vercel.app/api/stats?username=old)";
    const languages = "![Languages](https://profilekit.vercel.app/api/languages?username=old)";
    const added = "![New card](https://profilekit.vercel.app/api/stats?username=old&theme=light)";
    app.importSource(`${stats}\n${languages}\n`);
    app.selectOnly("card-2");
    app.element("batch-from-account").value = "old";
    app.element("batch-account").value = "new";
    const edited = `# Edited introduction\n\n${languages}\n${added}\n${stats}\n`;
    app.editSource(edited);
    if (reconcileOnBlur) {
      app.element("readme-source").dispatch("change");
      assert.deepEqual(app.checkedCards(), ["card-1"]);
      const active = app.element("readme-card-list").querySelectorAll("[data-card-id]").find((button) => button.getAttribute("aria-pressed") === "true");
      assert.equal(active.dataset.cardId, "card-1");
      assert.equal(app.element("batch-from-account").value, "old");
      assert.equal(app.element("batch-account").value, "new");
    }
    app.click("batch-apply");
    await app.flushTimers();

    const updated = edited.replace("/api/languages?username=old", "/api/languages?username=new");
    assert.equal(app.element("readme-source").value, updated);
    assert.equal(app.draft().source, updated);
    assert.deepEqual(app.checkedCards(), ["card-1"]);
    assert.equal(app.element("batch-from-account").value, "new");
    assert.equal(app.element("batch-account").value, "new");

    app.click("readme-undo");
    assert.equal(app.element("readme-source").value, edited);
    assert.equal(app.element("batch-from-account").value, "old");
    assert.equal(app.element("batch-account").value, "new");
    assert.deepEqual(app.checkedCards(), ["card-1"]);
    app.click("readme-redo");
    assert.equal(app.element("readme-source").value, updated);
    assert.equal(app.element("batch-from-account").value, "new");
  });
}

test("inserting a duplicate URL preserves distinct image selection and clears ambiguous duplicates", async () => {
  const url = "https://profilekit.vercel.app/api/stats?username=alice&theme=dark";
  const original = `![Original](${url})`;
  const added = `![New](${url})`;
  const app = workspace();
  app.importSource(original);
  app.editSource(`${added}\n\n${original}`);
  app.element("readme-source").dispatch("change");
  assert.deepEqual(app.checkedCards(), ["card-2"]);
  app.element("batch-theme").value = "light";
  app.click("batch-apply");
  assert.equal(app.element("readme-source").value, `${added}\n\n${original.replace("theme=dark", "theme=light")}`);

  app.importSource(original);
  app.editSource(`${original}\n\n${original}`);
  app.element("readme-source").dispatch("change");
  assert.deepEqual(app.checkedCards(), []);
  assert.equal(app.element("batch-apply").disabled, true);
  assert.match(app.element("readme-status").textContent, /중복 카드/);
});

const EditorModel = require("../public/editor-model");
const CardDesign = require("../public/card-design");
const ReadmeModel = require("../public/readme-model");
const HANDOFF_KEY = "profilekit.readme-handoff.test-handoff-token";
function designFixture() {
  return EditorModel.createDocument({ name: "My composed profile", elements: [
    EditorModel.createElement("rect", { id: "decoration", x: 10, y: 20, width: 700, height: 450 }),
    EditorModel.createElement("card", { id: "stats", endpoint: "stats", params: { username: "alice" }, x: 30, y: 40, rotation: 7 }),
    EditorModel.createElement("card", { id: "languages", endpoint: "languages", params: { username: "alice" }, x: 50, y: 330, opacity: 0.8 }),
  ] });
}

test("design inspector edits a chosen embedded card while preserving geometry and sibling elements", async () => {
  const doc = designFixture(), app = workspace();
  app.importSource(`![Profile](${CardDesign.designUrl(doc)})`);
  assert.equal(app.element("batch-from-account").value, "alice");
  assert.equal(app.element("readme-design-card").children.length, 2);
  assert.equal(app.element("readme-extra-params").value, "");
  assert.match(app.element("readme-card-title").textContent, /My composed profile/);
  const picker = app.element("readme-design-card"); picker.value = "languages"; picker.dispatch("change");
  const account = app.element("readme-params").querySelectorAll("[data-param]").find((field) => field.dataset.param === "username");
  account.value = "bob"; app.click("readme-card-apply");
  const actual = ReadmeModel.scan(app.element("readme-source").value).cards[0].design;
  const expected = structuredClone(doc); expected.elements[2].params.username = "bob";
  assert.deepEqual(actual, expected);
});

test("creator handoff flushes pending source and returns a validated URL with undo", async () => {
  const app = workspace();
  const url = "https://profilekit.vercel.app/api/stats?username=alice";
  app.importSource(`![Stats](${url})`);
  const pending = `# New introduction\n\n<a href="https://example.com"><img src="${url}" alt="Kept" width="450"></a>`;
  app.editSource(pending); await app.click("readme-open-editor");
  assert.equal(app.location.href, "/editor.html#readme-edit=test-handoff-token");
  const record = JSON.parse(app.session.get(HANDOFF_KEY));
  assert.equal(record.project.source, pending);
  assert.equal(record.savedDraft, app.storage.get(DRAFT_KEY));
  record.resultUrl = CardDesign.designUrl(designFixture());
  app.session.set(HANDOFF_KEY, JSON.stringify(record));
  app.session.set("profilekit.readme-studio.v2.test-handoff-token", "isolated creator draft");
  const returned = workspace(app.storage, app.session, "#design-return=test-handoff-token"); await returned.ready();
  assert.equal(app.session.has("profilekit.readme-studio.v2.test-handoff-token"), false);
  assert.equal(returned.element("readme-source").value, pending.replace(url, record.resultUrl));
  assert.equal(app.session.has(HANDOFF_KEY), false);
  returned.click("readme-undo");
  assert.equal(returned.element("readme-source").value, pending);
});

test("return conflict preserves the current draft and retains a recoverable creator result", async () => {
  const app = workspace();
  app.importSource("![Stats](https://profilekit.vercel.app/api/stats?username=alice)");
  await app.click("readme-open-editor");
  const record = JSON.parse(app.session.get(HANDOFF_KEY));
  record.resultUrl = CardDesign.designUrl(designFixture());
  app.session.set(HANDOFF_KEY, JSON.stringify(record));
  const changed = { ...app.draft(), source: "# Work from another tab" };
  app.storage.set(DRAFT_KEY, JSON.stringify(changed));
  const returned = workspace(app.storage, app.session, "#design-return=test-handoff-token"); await returned.ready();
  assert.equal(returned.element("readme-source").value, changed.source);
  assert.equal(returned.element("readme-return-recover").hidden, false);
  assert.match(returned.element("readme-status").textContent, /현재 초안/);
  assert.equal(app.session.has(HANDOFF_KEY), true);
  await returned.flushTimers();
  assert.equal(returned.draft().source, changed.source);
});

test("invalid returned URLs leave the README and handoff record intact", async () => {
  const app = workspace();
  app.importSource("![Stats](https://profilekit.vercel.app/api/stats?username=alice)");
  await app.click("readme-open-editor");
  const record = JSON.parse(app.session.get(HANDOFF_KEY));
  record.resultUrl = "javascript:alert(1)";
  app.session.set(HANDOFF_KEY, JSON.stringify(record));
  const returned = workspace(app.storage, app.session, "#design-return=test-handoff-token"); await returned.ready();
  assert.equal(returned.element("readme-source").value, record.project.source);
  assert.equal(app.session.has(HANDOFF_KEY), true);
});

test("decorative designs show no raw document field and still open in the creator", async () => {
  const doc = EditorModel.createDocument({ elements: [EditorModel.createElement("text", { text: "Hello" })] });
  const app = workspace();
  app.importSource(`![Design](${CardDesign.designUrl(doc)})`);
  assert.equal(app.element("readme-card-apply").disabled, true);
  assert.equal(app.element("readme-extra-settings").hidden, true);
  assert.equal(app.element("readme-extra-params").value, "");
  assert.equal(app.element("readme-open-editor").hidden, false);
  await app.click("readme-open-editor");
  assert.ok(app.session.has(HANDOFF_KEY));
});

test("creator cancel keeps the README source byte for byte", async () => {
  const app = workspace();
  const source = '<picture>\r\n  <img src="https://profilekit.vercel.app/api/stats?username=alice&amp;theme=dark" alt="Stats" width="450">\r\n</picture>';
  app.importSource(source); await app.click("readme-open-editor");
  const record = JSON.parse(app.session.get(HANDOFF_KEY));
  record.resultUrl = record.originalUrl; app.session.set(HANDOFF_KEY, JSON.stringify(record));
  const returned = workspace(app.storage, app.session, "#design-return=test-handoff-token"); await returned.ready();
  assert.equal(returned.element("readme-source").value, source);
  assert.equal(app.session.has(HANDOFF_KEY), false);
});

test("asset returns persist editable documents, disable misleading inline editing, and support undo and creator reopening", async () => {
  const app = workspace();
  const url = "https://profilekit.vercel.app/api/stats?username=alice";
  const source = `<a href="https://example.com"><img src="${url}" width="450" alt="Profile"></a>`;
  app.importSource(source); await app.click("readme-open-editor");
  const record = JSON.parse(app.session.get(HANDOFF_KEY));
  record.resultAsset = { path: "assets/profile.svg", document: designFixture() };
  app.session.set(HANDOFF_KEY, JSON.stringify(record));
  const returned = workspace(app.storage, app.session, "#design-return=test-handoff-token"); await returned.ready();
  await returned.flushTimers();
  assert.equal(returned.draft().source, source.replace(url, "assets/profile.svg"));
  assert.deepEqual(returned.draft().assetDesigns["assets/profile.svg"], record.resultAsset.document);
  assert.equal(returned.element("readme-card-apply").disabled, true);
  assert.equal(returned.element("batch-apply").disabled, true);
  assert.match(returned.element("readme-design-hint").textContent, /교체할 SVG/);
  returned.click("readme-undo"); await returned.flushTimers();
  assert.equal(returned.draft().source, source);
  assert.deepEqual(returned.draft().assetDesigns, {});
  returned.click("readme-redo"); await returned.flushTimers();
  const reopened = workspace(app.storage, app.session); await reopened.ready();
  await reopened.click("readme-open-editor");
  const next = JSON.parse(app.session.get(HANDOFF_KEY));
  assert.equal(next.originalUrl, "assets/profile.svg");
  assert.equal(next.assetPath, "assets/profile.svg");
  assert.deepEqual(JSON.parse(next.assetDocument), record.resultAsset.document);
  next.resultUrl = next.originalUrl; app.session.set(HANDOFF_KEY, JSON.stringify(next));
  const canceled = workspace(app.storage, app.session, "#design-return=test-handoff-token"); await canceled.ready();
  assert.equal(canceled.element("readme-source").value, source.replace(url, "assets/profile.svg"));
});

test("replacing an asset at the same path changes its editable document and undo restores it", async () => {
  const app = workspace();
  const original = { kind: "profilekit-readme", version: 1, name: "README.md", source: "![Profile](assets/profile.svg)", repository: "", origin: "https://profilekit.vercel.app", theme: "dark", device: "desktop", assetDesigns: { "assets/profile.svg": designFixture() } };
  app.storage.set(DRAFT_KEY, JSON.stringify(original));
  const opened = workspace(app.storage, app.session); await opened.ready(); await opened.click("readme-open-editor");
  const record = JSON.parse(app.session.get(HANDOFF_KEY));
  record.resultAsset = { path: "assets/profile.svg", document: { ...designFixture(), name: "Revised asset" } };
  app.session.set(HANDOFF_KEY, JSON.stringify(record));
  const returned = workspace(app.storage, app.session, "#design-return=test-handoff-token"); await returned.ready(); await returned.flushTimers();
  assert.equal(returned.draft().source, original.source);
  assert.equal(returned.draft().assetDesigns["assets/profile.svg"].name, "Revised asset");
  returned.click("readme-undo"); await returned.flushTimers();
  assert.deepEqual(returned.draft().assetDesigns, original.assetDesigns);
});

test("new asset registration cannot shift the return edit onto an earlier image", async () => {
  const app = workspace();
  const url = "https://profilekit.vercel.app/api/stats?username=alice";
  const source = `![Existing file](assets/profile.svg)\n![Edit this](${url})`;
  app.importSource(source); await app.click("readme-open-editor");
  const record = JSON.parse(app.session.get(HANDOFF_KEY));
  record.resultAsset = { path: "assets/profile.svg", document: designFixture() };
  app.session.set(HANDOFF_KEY, JSON.stringify(record));
  const returned = workspace(app.storage, app.session, "#design-return=test-handoff-token"); await returned.ready();
  assert.equal(returned.element("readme-source").value, source.replace(url, "assets/profile.svg"));
});

test("returning to another card's asset path rejects aliases without changing the saved project", async () => {
  const app = workspace();
  const original = { kind: "profilekit-readme", version: 1, name: "README.md", source: "![Owned](assets/profile.svg)\n![New](https://profilekit.vercel.app/api/stats?username=alice)", repository: "", origin: "https://profilekit.vercel.app", theme: "dark", device: "desktop", assetDesigns: { "assets/profile.svg": designFixture() } };
  app.storage.set(DRAFT_KEY, JSON.stringify(original));
  const opened = workspace(app.storage, app.session); await opened.ready(); opened.selectOnly("card-2"); await opened.click("readme-open-editor");
  const record = JSON.parse(app.session.get(HANDOFF_KEY));
  record.resultAsset = { path: "./assets/profile.svg", document: { ...designFixture(), name: "Overwrite attempt" } };
  app.session.set(HANDOFF_KEY, JSON.stringify(record));
  const returned = workspace(app.storage, app.session, "#design-return=test-handoff-token"); await returned.ready(); await returned.flushTimers();
  assert.deepEqual(returned.draft().assetDesigns, original.assetDesigns);
  assert.equal(returned.draft().source, original.source);
  assert.match(returned.element("readme-status").textContent, /다른 디자인/);
  assert.ok(app.session.has(HANDOFF_KEY));
});


test("edits during asynchronous creator handoff prevent navigation and preserve source", async () => {
  const app = workspace();
  app.importSource("![Stats](https://profilekit.vercel.app/api/stats?username=alice)");
  const originalSet = app.transfer.set;
  let release;
  app.transfer.set = async (...args) => { await new Promise((resolve) => { release = resolve; }); await originalSet(...args); };
  const pending = app.click("readme-open-editor");
  await app.ready();
  const changed = "# Keep this edit\n\n![Stats](https://profilekit.vercel.app/api/stats?username=alice)";
  app.editSource(changed);
  await app.ready(); release(); await pending;
  assert.equal(app.location.href, "/readme.html");
  assert.equal(app.element("readme-source").value, changed);
  assert.equal(app.session.has(HANDOFF_KEY), false);
});


test("failed README persistence retains the returned design and recovery draft", async () => {
  const app = workspace();
  app.importSource("![Stats](https://profilekit.vercel.app/api/stats?username=alice)");
  await app.click("readme-open-editor");
  const record = JSON.parse(app.session.get(HANDOFF_KEY));
  record.resultUrl = "https://profilekit.vercel.app/api/stats?username=bob";
  app.session.set(HANDOFF_KEY, JSON.stringify(record));
  const draftKey = "profilekit.readme-studio.v2.test-handoff-token";
  app.session.set(draftKey, "recoverable draft");
  const returned = workspace(app.storage, app.session, "#design-return=test-handoff-token");
  returned.local.setItem = () => { throw new Error("QuotaExceededError"); };
  await returned.ready();
  assert.equal(app.session.has(HANDOFF_KEY), true);
  assert.equal(app.session.has(draftKey), true);
  assert.match(returned.element("readme-source").value, /username=bob/);
});

test("initial draft loading preserves edits made before the asynchronous read completes", async () => {
  const old = workspace(); old.importSource('old draft'); await old.flushTimers();
  const app = workspace(old.storage);
  app.importSource('new text entered while loading');
  await app.ready(); await app.flushTimers();
  assert.equal(app.element('readme-source').value, 'new text entered while loading');
  assert.equal(app.draft().source, 'new text entered while loading');
});

test("a save completing after another edit does not drop the queued newer draft", async () => {
  const app = workspace(); await app.ready();
  const original = app.transfer.compareAndSet;
  let release;
  app.transfer.compareAndSet = async (...args) => { await new Promise(resolve => { release = resolve; }); return original(...args); };
  app.importSource('first'); const pending = app.flushTimers(); await app.ready();
  app.importSource('second');
  app.transfer.compareAndSet = original;
  release(); await pending;
  assert.equal(app.draft().source, 'second');
});

test("two initialized README tabs cannot overwrite a newer saved draft", async () => {
  const first = workspace(); await first.ready();
  const second = workspace(first.storage); await second.ready();
  first.importSource('first wins'); await first.flushTimers();
  second.importSource('second kept in memory'); await second.flushTimers();
  assert.equal(second.draft().source, 'first wins');
  assert.equal(second.element('readme-source').value, 'second kept in memory');
  assert.match(second.element('readme-status').textContent, /다른 탭/);
});
