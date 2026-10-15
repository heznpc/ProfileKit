/* Pure composition state shared by the browser and regression tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./card-schema"));
  else root.ProfileKitComposition = factory(root.ProfileKitCards);
})(typeof globalThis !== "undefined" ? globalThis : this, (schema) => {
  "use strict";
  const { CARDS } = schema;

  const MAX_BLOCKS = 64;
  const MAX_DOCUMENT_LENGTH = 256 * 1024;
  const MAX_MARKDOWN_LENGTH = MAX_DOCUMENT_LENGTH;
  const MAX_VALUE_LENGTH = 8192;
  const PALETTE_PARAMS = new Set([
    "theme_url", "bg_color", "text_color", "title_color", "icon_color",
    "border_color", "accent_color", "color", "empty_color", "cursor_color",
  ]);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const isCardType = (key) => typeof key === "string" && own(CARDS, key);
  const isEnabled = (value) => value === true || value === "true" || value === "1" || value === "yes";

  function normalizeValues(values) {
    const out = {};
    if (!isObject(values)) return out;
    for (const [key, value] of Object.entries(values).slice(0, 100)) {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(key) || key === "constructor" || key === "prototype") continue;
      if (value == null) continue;
      if (!["string", "number", "boolean"].includes(typeof value)) continue;
      if (typeof value === "number" && !Number.isFinite(value)) continue;
      if (String(value).length > MAX_VALUE_LENGTH) continue;
      out[key] = String(value);
    }
    return out;
  }

  function createCardBlock(cardType, values) {
    if (!isCardType(cardType)) throw new Error("Unknown card type");
    return { type: "card", card_type: cardType, slots: normalizeValues(values), appearance: "selected" };
  }

  function normalizeDocument(document) {
    if (!isObject(document) || (document.v !== undefined && document.v !== 1)) return null;
    if (!Array.isArray(document.blocks) || document.blocks.length > MAX_BLOCKS) return null;
    const blocks = [];
    for (const block of document.blocks) {
      if (!isObject(block)) return null;
      if (block.type === "markdown") {
        if (typeof block.content !== "string" || block.content.length > MAX_MARKDOWN_LENGTH) return null;
        blocks.push({ type: "markdown", content: block.content });
      } else if (block.type === "card" && isCardType(block.card_type) && isObject(block.slots)) {
        const normalized = createCardBlock(block.card_type, block.slots);
        // Legacy drafts have no appearance option. Preserve their selected
        // style; automatic dark/light export must be explicitly requested.
        normalized.appearance = block.appearance === "auto" ? "auto" : "selected";
        blocks.push(normalized);
      } else return null;
    }
    const normalized = { v: 1, blocks };
    return JSON.stringify(normalized).length <= MAX_DOCUMENT_LENGTH ? normalized : null;
  }

  function parseDraft(raw) {
    if (typeof raw !== "string" || raw.length > MAX_DOCUMENT_LENGTH) return null;
    try { return normalizeDocument(JSON.parse(raw)); } catch { return null; }
  }

  function cardUrl(cardType, values) {
    if (!isCardType(cardType)) throw new Error("Unknown card type");
    const params = new URLSearchParams(Object.entries(normalizeValues(values)).filter(([, value]) => value !== ""));
    return `/api/${cardType}${params.size ? `?${params}` : ""}`;
  }

  function escapeAttribute(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
  }

  function serialize(blocks, origin, label = (key) => CARDS[key].label) {
    const document = normalizeDocument({ v: 1, blocks });
    if (!document) throw new Error("Invalid composition");
    const base = new URL(origin);
    if (!["http:", "https:"].includes(base.protocol)) throw new Error("Invalid origin");
    const url = (block, slots) => escapeAttribute(base.origin + cardUrl(block.card_type, slots));
    const parts = document.blocks.map((block) => {
      if (block.type === "markdown") return block.content;
      const alt = escapeAttribute(label(block.card_type));
      const supportsTheme = CARDS[block.card_type].params.some((param) => param.name === "theme");
      if (block.appearance !== "auto" || !supportsTheme) {
        return `<img src="${url(block, block.slots)}" alt="${alt}" />`;
      }
      const slots = Object.fromEntries(Object.entries(block.slots).filter(([key]) => !PALETTE_PARAMS.has(key)));
      return `<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="${url(block, { ...slots, theme: "dark" })}" />\n  <img src="${url(block, { ...slots, theme: "light" })}" alt="${alt}" />\n</picture>`;
    });
    return parts.join("\n\n").trimEnd() + "\n";
  }

  function encode(blocks) {
    const document = normalizeDocument({ v: 1, blocks });
    if (!document) throw new Error("Invalid composition");
    const json = JSON.stringify(document);
    if (json.length > MAX_DOCUMENT_LENGTH) throw new Error("Composition is too large to share");
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decode(encoded) {
    if (typeof encoded !== "string" || encoded.length > MAX_DOCUMENT_LENGTH * 6) return null;
    try {
      // Accept old standard-base64 links too: URLSearchParams turns + into a space.
      const binary = atob(encoded.replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/"));
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return parseDraft(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch { return null; }
  }

  return { MAX_BLOCKS, MAX_DOCUMENT_LENGTH, MAX_MARKDOWN_LENGTH, MAX_VALUE_LENGTH, isCardType, isEnabled, normalizeValues, createCardBlock, normalizeDocument, parseDraft, cardUrl, serialize, encode, decode };
});
