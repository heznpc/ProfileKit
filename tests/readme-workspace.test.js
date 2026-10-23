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
    for (const listener of this.listeners.get(type) || []) listener({ type, target });
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

function workspace(storage = new Map()) {
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
    URL, URLSearchParams, TextEncoder, TextDecoder,
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
  for (const name of ["card-schema", "editor-model", "readme-model", "readme"]) {
    vm.runInContext(publicSource(name), sandbox, { filename: `public/${name}.js` });
  }
  const click = (id) => element(id).dispatch("click");
  const editSource = (source) => { element("readme-source").value = source; element("readme-source").dispatch("input"); };
  return {
    element, click, editSource, storage, previews,
    importSource(source) { editSource(source); click("readme-import"); },
    flushTimers() {
      for (let turns = 0; timers.size; turns++) {
        assert.ok(turns < 10, "Unexpected recurring workspace timer");
        const pending = [...timers.values()]; timers.clear();
        for (const callback of pending) callback();
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

test("changing deployment origin flushes pending README text before rescanning and saving", () => {
  const app = workspace();
  app.importSource("# Saved README\n");
  app.flushTimers();
  const edited = "# Saved README\n\nA newly written paragraph with [a link](https://example.com).\n";
  app.editSource(edited);
  app.element("readme-origin").value = "https://cards.example.com";
  app.element("readme-origin").dispatch("change");
  app.flushTimers();

  assert.equal(app.element("readme-source").value, edited);
  assert.equal(app.previews.at(-1), edited);
  assert.equal(app.draft().source, edited);
  assert.equal(app.draft().origin, "https://cards.example.com");
  app.click("readme-undo");
  assert.equal(app.element("readme-source").value, "# Saved README\n");
  app.click("readme-redo");
  assert.equal(app.element("readme-source").value, edited);
});

test("clearing the README persists an empty draft and reopening cannot resurrect the previous document", () => {
  const app = workspace();
  app.importSource("# Previous document\n");
  app.flushTimers();
  assert.equal(app.draft().source, "# Previous document\n");
  app.editSource("");
  app.element("readme-source").dispatch("change");
  app.flushTimers();
  assert.equal(app.draft().source, "");

  const reopened = workspace(app.storage);
  reopened.flushTimers();
  assert.equal(reopened.element("readme-source").value, "");
  assert.equal(reopened.previews.at(-1), "");
  assert.equal(reopened.draft().source, "");
  assert.equal(reopened.element("readme-download").disabled, true);
});

for (const reconcileOnBlur of [true, false]) {
  test(`source reconciliation preserves the selected card and account controls ${reconcileOnBlur ? "on blur" : "when applying a batch directly"}`, () => {
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
    app.flushTimers();

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

test("inserting a duplicate URL preserves distinct image selection and clears ambiguous duplicates", () => {
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
