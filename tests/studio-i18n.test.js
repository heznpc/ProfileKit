"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const I18n = require("../public/studio-i18n.js");
const Schema = require("../public/card-schema.js");
const Decoration = require("../public/card-decoration.js");

class TextNode {
  constructor(value) { this.nodeType = 3; this.nodeValue = value; this.parentElement = null; }
  get textContent() { return this.nodeValue; }
}
class Element {
  constructor(tag, attributes = {}, children = []) {
    this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attributes = { ...attributes };
    this.parentElement = null; this.childNodes = []; this.listeners = {}; this.value = "";
    this.append(...children);
  }
  append(...children) {
    for (let child of children) {
      if (typeof child === "string") child = new TextNode(child);
      child.parentElement = this; this.childNodes.push(child);
    }
  }
  get textContent() { return this.childNodes.map((child) => child.textContent).join(""); }
  set textContent(value) { this.childNodes = []; this.append(String(value)); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  matches(selector) {
    if (selector.startsWith("#")) return this.attributes.id === selector.slice(1);
    if (selector.startsWith(".")) return (this.attributes.class || "").split(/\s+/).includes(selector.slice(1));
    if (selector === '[contenteditable]:not([contenteditable="false"])') return this.attributes.contenteditable !== undefined && this.attributes.contenteditable !== "false";
    const attribute = selector.match(/^(\w+)?\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (attribute) return (!attribute[1] || this.tagName === attribute[1].toUpperCase()) && this.attributes[attribute[2]] !== undefined && (attribute[3] === undefined || this.attributes[attribute[2]] === attribute[3]);
    return this.tagName === selector.toUpperCase();
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      for (const part of selector.split(/,\s*/)) {
        const ancestry = part.split(" ");
        if (ancestry.length === 2) {
          if (node.matches(ancestry[1]) && node.parentElement?.closest(ancestry[0])) return node;
        } else if (node.matches(part)) return node;
      }
    }
    return null;
  }
}
function browser(children = [], stored = "en", languages = ["ko-KR"]) {
  const events = {}, storage = new Map(stored ? [[I18n.STORAGE_KEY, stored]] : []);
  const select = new Element("select", { id: "studio-locale", "aria-label": "언어" });
  const body = new Element("body", {}, [select, ...children]);
  const html = new Element("html", {}, [new Element("head"), body]);
  let callback;
  const host = {
    document: { documentElement: html, body, getElementById(id) {
      const walk = (node) => node.attributes?.id === id ? node : (node.childNodes || []).map(walk).find(Boolean);
      return walk(html) || null;
    } },
    navigator: { languages },
    localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    ProfileKitCards: Schema,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    addEventListener(name, listener) { (events[name] ||= []).push(listener); },
    dispatchEvent(event) { for (const listener of events[event.type] || []) listener(event); },
    MutationObserver: class {
      constructor(listener) { callback = listener; }
      observe() {}
      disconnect() {}
    },
    mutate(mutations) { callback(mutations); },
  };
  return { host, select, storage, body, html };
}

test("translates UI messages in both directions without rewriting interpolation values", () => {
  assert.equal(I18n.translate("카드 추가", "en"), "Add a card");
  assert.equal(I18n.translate("Add a card", "ko"), "카드 추가");
  assert.equal(I18n.translate("{name} 선택", "en", { name: "제목 <img> & 카드" }), "Select 제목 <img> & 카드");
  assert.equal(I18n.translate("3개 카드 주소를 찾았습니다. 원문과 배치는 유지됩니다.", "en"), "Found 3 card URLs. The original source and layout are preserved.");
  assert.equal(I18n.translate("Found 3 card URLs. The original source and layout are preserved.", "ko"), "3개 카드 주소를 찾았습니다. 원문과 배치는 유지됩니다.");
  assert.equal(I18n.translate("An unrecognized user title", "ko"), "An unrecognized user title");
});

test("every Korean static UI label and attribute has an English translation", () => {
  for (const page of ["editor", "readme"]) {
    const html = fs.readFileSync(path.join(__dirname, "../public", page + ".html"), "utf8");
    const labels = [...html.matchAll(/>([^<]+)</g)].map((match) => match[1]);
    const attributes = [...html.matchAll(/(?:placeholder|aria-label|title|content)="([^"]+)"/g)].map((match) => match[1]);
    for (let value of [...labels, ...attributes]) {
      value = value.trim().replace(/&#10;/g, "\n").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      if (/[가-힣]/.test(value) && value !== "한국어") assert.notEqual(I18n.translate(value, "en"), value, page + ": " + value);
    }
    assert.match(html, /id="studio-locale"/);
    assert.ok(html.indexOf('/studio-i18n.js') < html.indexOf('/' + page + '.js'));
  }
});

test("uses the shared saved language before browser preference and tolerates storage errors", () => {
  assert.equal(I18n.detectLocale(browser([], "en", ["ko-KR"]).host), "en");
  assert.equal(I18n.detectLocale(browser([], null, ["fr-FR", "ko-KR"]).host), "ko");
  assert.equal(I18n.detectLocale(browser([], "invalid", ["fr-FR"]).host), "en");
  const { host } = browser();
  host.localStorage = { getItem() { throw new Error("disabled"); }, setItem() { throw new Error("disabled"); } };
  const runtime = I18n.createRuntime(host);
  assert.equal(runtime.locale, "ko");
  assert.doesNotThrow(() => runtime.setLocale("en"));
  assert.equal(host.document.documentElement.lang, "en");
});

test("translates text and accessible labels while preserving inputs, SVG, user labels, and embeds", () => {
  const icon = new Element("svg", {}, [new Element("text", {}, ["카드 추가"])]);
  const button = new Element("button", { title: "카드 추가", "aria-label": "카드 추가" }, [icon, " 카드 추가 "]);
  const input = new Element("input", { placeholder: "카드와 효과 검색" }); input.value = "카드 추가";
  const textarea = new Element("textarea", { placeholder: "추가할 텍스트를 입력하세요." }, ["카드 추가"]); textarea.value = "# 카드 추가";
  const source = new Element("code", {}, ["카드 추가"]);
  const canvas = new Element("div", { id: "canvas-host" }, [new Element("span", {}, ["카드 추가"])]);
  const cardName = new Element("strong", { class: "readme-card-name" }, ["카드 추가"]);
  const iframe = new Element("iframe", { title: "README 전체 미리보기", srcdoc: "<p>카드 추가</p>" }, ["카드 추가"]);
  const readOnly = new Element("input", { readonly: "" }); readOnly.value = "https://example.com/api/hero?name=카드%20추가";
  const { host } = browser([button, input, textarea, source, canvas, cardName, iframe, readOnly]);
  const runtime = I18n.createRuntime(host);
  assert.equal(button.childNodes[1].nodeValue, " Add a card ");
  assert.equal(button.getAttribute("title"), "Add a card");
  assert.equal(button.getAttribute("aria-label"), "Add a card");
  assert.equal(input.getAttribute("placeholder"), "Search cards and effects");
  assert.equal(input.value, "카드 추가");
  assert.equal(textarea.value, "# 카드 추가");
  assert.equal(textarea.textContent, "카드 추가");
  for (const node of [icon, source, canvas, cardName, iframe]) assert.equal(node.textContent, "카드 추가");
  assert.equal(iframe.getAttribute("srcdoc"), "<p>카드 추가</p>");
  assert.equal(iframe.getAttribute("title"), "Full README preview");
  assert.equal(readOnly.value, "https://example.com/api/hero?name=카드%20추가");
  runtime.setLocale("ko");
  assert.equal(button.childNodes[1].nodeValue, " 카드 추가 ");
});

test("observes fresh UI messages and attributes, including nodes added under protected SVG", () => {
  const status = new Element("p");
  const svg = new Element("svg");
  const { host } = browser([status, svg]);
  const runtime = I18n.createRuntime(host);
  status.textContent = "README 전체를 복사했습니다.";
  host.mutate([{ type: "childList", addedNodes: status.childNodes, target: status }]);
  assert.equal(status.textContent, "Full README copied.");
  status.setAttribute("title", "실행 취소");
  host.mutate([{ type: "attributes", target: status }]);
  assert.equal(status.getAttribute("title"), "Undo");
  const userText = new Element("text", {}, ["카드 추가"]); svg.append(userText);
  host.mutate([{ type: "childList", addedNodes: [userText], target: svg }]);
  assert.equal(userText.textContent, "카드 추가");
  runtime.setLocale("ko");
  assert.equal(status.textContent, "README 전체를 복사했습니다.");
  status.textContent = "실행 취소";
  host.mutate([{ type: "childList", addedNodes: status.childNodes, target: status }]);
  runtime.setLocale("en");
  assert.equal(status.textContent, "Undo");
});

test("shared locale changes persist between pages and synchronize an open page", () => {
  const { host, storage, select } = browser([new Element("button", {}, ["카드 추가"])]);
  const runtime = I18n.createRuntime(host);
  select.value = "ko"; select.listeners.change();
  assert.equal(runtime.locale, "ko");
  assert.equal(storage.get(I18n.STORAGE_KEY), "ko");
  const nextPage = browser(); nextPage.host.localStorage = host.localStorage;
  assert.equal(I18n.createRuntime(nextPage.host).locale, "ko");
  host.dispatchEvent({ type: "storage", key: I18n.STORAGE_KEY, newValue: "en" });
  assert.equal(runtime.locale, "en"); assert.equal(select.value, "en");
  runtime.setLocale("fr"); assert.equal(runtime.locale, "en");
});

test("new modules register UI copy and bind user values without changing their language", () => {
  const title = new Element("h2", { id: "readme-card-title" });
  const layerTitle = new Element("span");
  const layer = new Element("div", { id: "layer-list" }, [new Element("button", { class: "layer-item" }, [layerTitle])]);
  const button = new Element("button", {}, ["꾸미기 제안"]);
  const { host } = browser([title, button, layer]);
  const runtime = I18n.createRuntime(host);
  runtime.addMessages({ "꾸미기 제안": "Suggest a design" });
  assert.equal(button.textContent, "Suggest a design");
  runtime.text(title, "{name} 선택", { name: "카드 추가" });
  runtime.text(layerTitle, "{name} 선택", { name: "카드 추가" });
  assert.equal(title.textContent, "Select 카드 추가");
  runtime.setLocale("ko");
  assert.equal(title.textContent, "카드 추가 선택");
  assert.equal(layerTitle.textContent, "카드 추가 선택");
  assert.equal(button.textContent, "꾸미기 제안");
  assert.equal(runtime.card("stats"), "활동 통계");
});

test("bound README metadata and accessibility labels follow locale without translating user values", () => {
  const title = new Element("h2", { id: "readme-card-title" });
  const meta = new Element("span", { class: "readme-card-meta" });
  const layout = new Element("span", { class: "readme-card-meta" });
  const checkbox = new Element("input");
  const userMeta = new Element("span", { class: "readme-card-meta" }, ["카드 추가"]);
  const explicitName = new Element("strong");
  const { host } = browser([title, meta, layout, checkbox, userMeta, explicitName]);
  const runtime = I18n.createRuntime(host);
  const userName = "카드 추가";
  runtime.text(title, "{name} · {branch}", () => ({ name: userName, branch: runtime.t("어두운 화면") }));
  runtime.text(meta, "합성 디자인 · 포함 카드 {count}개", { count: 2 });
  runtime.text(layout, "{details}", () => ({ details: [runtime.t("표시 너비 {width}", { width: 500 }), runtime.t("{count}곳에서 사용", { count: 2 })].join(" · ") }));
  runtime.attribute(checkbox, "aria-label", "{name} 일괄 변경 선택", () => ({ name: userName + " " + runtime.t("어두운 화면") }));
  runtime.text(explicitName, "{name}", { name: userName });
  host.mutate([{ type: "childList", target: explicitName, addedNodes: explicitName.childNodes }, { type: "attributes", target: checkbox }]);
  assert.equal(title.textContent, "카드 추가 · Dark appearance");
  assert.equal(meta.textContent, "Combined design · 2 embedded cards");
  assert.equal(layout.textContent, "Display width 500 · Used in 2 locations");
  assert.equal(checkbox.getAttribute("aria-label"), "Select 카드 추가 Dark appearance for batch changes");
  assert.equal(explicitName.textContent, userName);
  runtime.setLocale("ko");
  assert.equal(title.textContent, "카드 추가 · 어두운 화면");
  assert.equal(meta.textContent, "합성 디자인 · 포함 카드 2개");
  assert.equal(layout.textContent, "표시 너비 500 · 2곳에서 사용");
  assert.equal(checkbox.getAttribute("aria-label"), "카드 추가 어두운 화면 일괄 변경 선택");
  runtime.setLocale("en");
  assert.equal(title.textContent, "카드 추가 · Dark appearance");
  assert.equal(userMeta.textContent, userName);
  assert.equal(explicitName.textContent, userName);
  runtime.text(title, "카드를 선택하세요");
  assert.equal(title.textContent, "Select a card");
});

test("catalog search includes both languages and group names regardless of selected locale", () => {
  const { host } = browser();
  const runtime = I18n.createRuntime(host);
  const before = runtime.cardSearchText("stats");
  for (const value of ["stats", "Stats", "활동 통계", "Data", "GitHub 데이터", "커밋"]) assert.ok(before.includes(value), value);
  runtime.setLocale("ko");
  assert.equal(runtime.cardSearchText("stats"), before);
  assert.ok(runtime.cardSearchText("languages").includes("사용 언어"));
});

test("range controls match model bounds and synchronize active sliders after normalization or part selection", () => {
  class Control extends EventTarget {
    constructor(id, value = "") { super(); this.id = id; this.value = String(value); this.disabled = false; this.attributes = {}; }
    closest() { return { querySelector: () => ({ textContent: this.id }) }; }
    setAttribute(name, value) { this.attributes[name] = value; }
    after(range) { fields.set(range.id, range); }
  }
  const fields = new Map(Object.entries({
    "element-width": 200, "element-height": 80, "element-radius": 12,
    "element-rotation": 300, "element-font-size": 220, "element-stroke-width": 60,
    "part-dx": 1500, "part-dy": -1500, "part-scale": 1,
    "element-effect-blur": 12, "element-effect-dx": 0, "element-effect-dy": 8,
  }).map(([id, value]) => [id, new Control(id, value)]));
  const host = new EventTarget(), document = new EventTarget();
  document.getElementById = (id) => fields.get(id);
  document.createElement = () => new Control("");
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/editor-controls.js"), "utf8"), { window: host, document, Event });
  const expected = { "element-rotation": [-360,360], "element-font-size": [8,256], "element-stroke-width": [0,64], "part-dx": [-2048,2048], "part-dy": [-2048,2048], "element-effect-blur": [0,40], "element-effect-dx": [-80,80], "element-effect-dy": [-80,80], "element-radius": [0,40] };
  for (const [id, [min,max]] of Object.entries(expected)) {
    for (const field of [fields.get(id), fields.get(id + "-range")]) {
      assert.equal(Number(field.min), min, id); assert.equal(Number(field.max), max, id);
    }
  }
  assert.equal(fields.get("element-font-size-range").value, "220");
  const scale = fields.get("part-scale"), range = fields.get("part-scale-range");
  scale.addEventListener("input", () => { scale.value = String(Decoration.normalizeParts("hero", { name: { scale: Number(scale.value) } }).name.scale); });
  document.activeElement = range;
  range.value = "1.2346"; range.dispatchEvent(new Event("input"));
  assert.equal(scale.value, "1.235"); assert.equal(range.value, "1.235");
  fields.get("part-dx").value = "0";
  fields.get("element-height").value = "20";
  host.dispatchEvent(new Event("profilekit:controls-render"));
  assert.equal(fields.get("part-dx-range").value, "0");
  assert.equal(Number(fields.get("element-radius-range").max), 10);
});
