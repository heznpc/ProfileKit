/* Live card imports and portable, stateless design links. Shared by Node and the editor. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./editor-model"), require("./card-schema"));
  else root.ProfileKitCardDesign = factory(root.ProfileKitEditorModel, root.ProfileKitCards);
})(typeof globalThis !== "undefined" ? globalThis : this, (Model, schema) => {
  "use strict";

  const DEFAULT_ORIGIN = "https://profilekit.vercel.app";
  const MAX_DESIGN_URL_LENGTH = 14000;
  const ENDPOINTS = Object.freeze([...Object.keys(schema.CARDS), "stack"]);
  const tooLarge = () => { throw new Error("This design URL is too large (maximum 14,000 characters). Use the static SVG file workflow or reduce the design size."); };
  const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  function htmlEntities(text) {
    return text.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, (entity) => {
      const name = entity.slice(1, -1).toLowerCase();
      if (name[0] !== "#") return { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" }[name];
      const code = name[1] === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      if (!Number.isInteger(code) || code > 0x10ffff || code === 0) throw new Error("Invalid character in card snippet");
      return String.fromCodePoint(code);
    });
  }

  function attributes(text) {
    const result = Object.create(null);
    const attribute = /\s+([^\s=<>/'"]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gy;
    let cursor = 0;
    while (text.slice(cursor).trim()) {
      attribute.lastIndex = cursor;
      const match = attribute.exec(text);
      if (!match) throw new Error("Image snippet has invalid HTML attributes");
      const name = match[1].toLowerCase();
      if (Object.hasOwn(result, name)) throw new Error(`Repeated HTML attribute: ${name}`);
      result[name] = htmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
      cursor = attribute.lastIndex;
    }
    return result;
  }

  function extractInput(input) {
    if (typeof input !== "string" || !input.trim()) throw new Error("Paste one ProfileKit card URL, Markdown image, or img snippet");
    if (input.length > MAX_DESIGN_URL_LENGTH) tooLarge();
    let value = input.trim();
    const metadata = {};
    const linkedMarkdown = value.match(/^\[(!\[[^\]\r\n]*\]\([\s\S]+\))\]\((?:<([^>]+)>|([^\s]+))\)$/);
    if (linkedMarkdown) {
      value = linkedMarkdown[1];
      metadata.linkUrl = htmlEntities(linkedMarkdown[2] ?? linkedMarkdown[3]);
    }
    const linkedHTML = value.match(/^<a\b((?:[^>"']|"[^"]*"|'[^']*')*)>\s*(<img\b(?:[^>"']|"[^"]*"|'[^']*')*>)\s*<\/a>$/i);
    if (linkedHTML) {
      const link = attributes(linkedHTML[1]);
      if (link.href !== undefined) metadata.linkUrl = link.href;
      value = linkedHTML[2];
    }
    if (/^<img\s/i.test(value)) {
      const image = value.match(/^<img(\s(?:[^>"']|"[^"]*"|'[^']*')*?)\/?\s*>$/i);
      if (!image) throw new Error("Paste a single img snippet");
      const fields = attributes(image[1]);
      if (fields.src === undefined) throw new Error("Image snippet must contain exactly one src URL");
      value = fields.src;
      if (fields.alt !== undefined) metadata.alt = fields.alt;
      if (fields.width !== undefined) metadata.displayWidth = fields.width;
    } else if (value.startsWith("![")) {
      const markdown = value.match(/^!\[([^\]\r\n]*)\]\(\s*(?:<([^>]+)>|(\S+?))(?:\s+["'][^"']*["'])?\s*\)$/);
      if (!markdown) throw new Error("Paste a single Markdown image");
      metadata.alt = htmlEntities(markdown[1]);
      value = htmlEntities(markdown[2] ?? markdown[3]);
    }
    return { value, metadata };
  }

  function inputURL(value, origin) {
    const editorOrigin = Model.normalizeOrigin(origin);
    if (!/^https?:\/\//i.test(value) && !/^\/api\//.test(value)) throw new Error("Use a ProfileKit /api/ card URL");
    let url;
    try { url = new URL(value, editorOrigin); } catch { throw new Error("Card URL is invalid"); }
    if (url.username || url.password || url.hash || ![DEFAULT_ORIGIN, editorOrigin].includes(url.origin)) {
      throw new Error("Card URL must use this deployment or https://profilekit.vercel.app, without credentials or a fragment");
    }
    return url;
  }

  function parseCardInput(input, origin = DEFAULT_ORIGIN) {
    const { value, metadata } = extractInput(input);
    const url = inputURL(value, origin);
    const match = url.pathname.match(/^\/api\/([a-z]+)$/);
    if (!match || !ENDPOINTS.includes(match[1])) throw new Error("This ProfileKit card endpoint is not supported");
    const params = Object.create(null);
    for (const [key, value] of url.searchParams) {
      if (Object.hasOwn(params, key)) throw new Error(`Repeated query parameter cannot be imported: ${key}`);
      params[key] = value;
    }
    return Model.normalizeCard({ endpoint: match[1], params, sourceOrigin: url.origin, ...metadata });
  }

  function parseDesignInput(input, origin = DEFAULT_ORIGIN) {
    const { value } = extractInput(input);
    const url = inputURL(value, origin);
    if (url.pathname !== "/api/design") return null;
    if (url.searchParams.getAll("d").length !== 1 || Array.from(url.searchParams.keys()).some((key) => key !== "d")) {
      throw new Error("Provide one ?d= encoded design document");
    }
    return decodeDocument(url.searchParams.get("d"));
  }

  function boundedUrl(url) {
    if (url.length > MAX_DESIGN_URL_LENGTH) tooLarge();
    return url;
  }
  function cardUrl(card, origin) {
    const normalized = Model.normalizeCard(card);
    return boundedUrl(Model.normalizeOrigin(origin ?? normalized.sourceOrigin ?? DEFAULT_ORIGIN) + Model.cardPath(normalized));
  }
  function encodeDocument(doc) {
    const bytes = new TextEncoder().encode(Model.serializeDocument(doc));
    if (Math.ceil(bytes.length * 4 / 3) > MAX_DESIGN_URL_LENGTH) tooLarge();
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodeDocument(encoded) {
    if (typeof encoded !== "string" || encoded.length > MAX_DESIGN_URL_LENGTH) tooLarge();
    if (!encoded || !/^[a-z0-9_-]+$/i.test(encoded) || encoded.length % 4 === 1) throw new Error("Design data is not valid base64url");
    let json;
    try {
      const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
      json = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
    } catch { throw new Error("Design data is not valid UTF-8 base64url"); }
    return Model.parseDocument(json);
  }
  function directCard(doc) {
    const card = doc.elements[0];
    return doc.background === "transparent" && doc.elements.length === 1 && card.type === "card"
      && card.x === 0 && card.y === 0 && card.width === doc.width && card.height === doc.height
      && card.rotation === 0 && card.opacity === 1
      && !card.parts && !card.effect
      && card.nativeWidth !== undefined && card.nativeHeight !== undefined
      && Math.abs(card.width * card.nativeHeight - card.height * card.nativeWidth) <= Math.max(card.nativeWidth, card.nativeHeight) * 0.001
      ? card : null;
  }
  function designUrl(document, origin) {
    const doc = Model.normalizeDocument(document);
    const card = directCard(doc);
    return card ? cardUrl(card, origin)
      : boundedUrl(`${Model.normalizeOrigin(origin ?? DEFAULT_ORIGIN)}/api/design?d=${encodeDocument(doc)}`);
  }
  function linkedImage(img, card) {
    if (card?.linkUrl) return `<a href="${escape(card.linkUrl)}">${img}</a>`;
    if (card?.endpoint === "pin" && /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(card.params.username || "")
      && /^[a-z\d_.-]{1,100}$/i.test(card.params.repo || "") && ![".", ".."].includes(card.params.repo)) {
      return `<a href="https://github.com/${encodeURIComponent(card.params.username)}/${encodeURIComponent(card.params.repo)}">${img}</a>`;
    }
    return img;
  }
  function composedImage(doc, src) {
    const cards = doc.elements.filter((element) => element.type === "card");
    const only = cards.length === 1 ? cards[0] : null;
    // A single card owns the embed metadata even when other layers decorate it.
    // Multiple cards have no unambiguous destination or display metadata.
    const card = directCard(doc) || (only && (doc.elements.length > 1 || only.parts || only.effect) ? only : null);
    const img = `<img src="${escape(src)}" alt="${escape(card?.alt ?? (doc.name || "Profile card"))}" width="${escape(card?.displayWidth ?? doc.width)}" />`;
    return linkedImage(img, card);
  }
  function readme(document, origin) {
    const doc = Model.normalizeDocument(document);
    return composedImage(doc, designUrl(doc, origin));
  }
  function readmeAsset(document, path) {
    if (typeof path !== "string") throw new Error("Use a repository-relative asset path");
    path = path.trim();
    if (!path || /^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(path) || /[\u0000-\u001f\\?#]/.test(path) || path.split("/").includes("..")) throw new Error("Use a repository-relative asset path");
    return composedImage(Model.normalizeDocument(document), path);
  }
  function readmeCards(document, origin) {
    const doc = Model.normalizeDocument(document);
    if (!doc.elements.length || doc.elements.some((element) => element.type !== "card" || element.rotation !== 0 || element.opacity !== 1 || element.parts || element.effect)) {
      throw new Error("Separate card embeds require only unrotated, fully opaque live cards without part edits or layer effects. Use the composed design for this document.");
    }
    return doc.elements.map((card) => linkedImage(`<img src="${escape(cardUrl(card, origin))}" alt="${escape(card.alt ?? (doc.name || "Profile card"))}" width="${escape(card.displayWidth ?? card.width)}" />`, card)).join("\n");
  }

  return { DEFAULT_ORIGIN, MAX_DESIGN_URL_LENGTH, ENDPOINTS, parseCardInput, parseDesignInput, cardUrl, encodeDocument, decodeDocument, designUrl, readme, readmeAsset, readmeCards };
});
