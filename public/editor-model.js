/* Portable editor documents and their shared preview/export SVG renderer. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./card-schema"), require("./card-decoration"));
  else root.ProfileKitEditorModel = factory(root.ProfileKitCards, root.ProfileKitCardDecoration);
})(typeof globalThis !== "undefined" ? globalThis : this, (schema, decoration) => {
  "use strict";

  const LIMITS = Object.freeze({
    MIN_CANVAS: 1,
    MAX_CANVAS: 2048,
    MAX_ELEMENTS: 64,
    MAX_FILE_BYTES: 8 * 1024 * 1024,
    MAX_IMAGE_BYTES: 3 * 1024 * 1024,
    MAX_IMPORT_IMAGE_BYTES: 12 * 1024 * 1024,
    MAX_IMAGE_PIXELS: 16 * 1024 * 1024,
    MAX_TOTAL_IMAGE_PIXELS: 32 * 1024 * 1024,
    MAX_COORDINATE: 4096,
    MAX_ELEMENT_SIZE: 4096,
    MAX_TEXT_LENGTH: 32768,
    MAX_CARD_PARAMS: 64,
    MAX_CARD_PARAM_LENGTH: 8192,
    MAX_CARD_PARAM_BYTES: 12288,
    MAX_CARD_CALLS: 8,
  });
  const FONT_FAMILIES = Object.freeze({
    sans: "'Helvetica Neue', Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'Courier New', Courier, monospace",
  });
  const COMMON_KEYS = ["id", "type", "x", "y", "width", "height", "rotation", "opacity", "effect"];
  const TYPE_KEYS = {
    text: ["text", "fontFamily", "fontSize", "fontWeight", "color", "align"],
    image: ["src", "fit"],
    rect: ["fill", "stroke", "strokeWidth", "radius"],
    ellipse: ["fill", "stroke", "strokeWidth", "radius"],
    card: ["endpoint", "params", "sourceOrigin", "nativeWidth", "nativeHeight", "linkUrl", "alt", "displayWidth", "parts"],
  };
  const CARD_ENDPOINTS = Object.freeze([...Object.keys(schema?.CARDS || {}), "stack"]);
  const STACK_ENDPOINTS = Object.freeze(["hero", "section", "divider", "now", "timeline", "tags", "toc", "stats", "languages"]);
  const DOCUMENT_KEYS = ["kind", "version", "name", "width", "height", "background", "elements"];
  const IMAGE_PREFIX = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
  const imageCache = new Map();
  let imageCacheBytes = 0;
  let nextId = 0;
  let localIdPrefix;

  function fail(message) { throw new Error(message); }
  function record(value, label) {
    if (value === null || typeof value !== "object" || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      fail(`${label} must be an object`);
    }
    return value;
  }
  function keys(value, allowed, label) {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) fail(`${label} has an unsupported field: ${key}`);
    }
  }
  function number(value, min, max, label) {
    if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label} must be a finite number`);
    return Math.round(Math.min(max, Math.max(min, value)) * 1000) / 1000;
  }
  function choice(value, allowed, label) {
    if (!allowed.includes(value)) fail(`${label} is not supported`);
    return value;
  }
  function string(value, max, label) {
    if (typeof value !== "string" || value.length > max) fail(`${label} must be text of at most ${max} characters`);
    // XML 1.0 cannot contain control characters or unpaired UTF-16 surrogates.
    for (const char of value) {
      const code = char.codePointAt(0);
      if ((code < 32 && ![9, 10, 13].includes(code)) || (code >= 0xd800 && code <= 0xdfff)
        || code === 0xfffe || code === 0xffff) fail(`${label} contains an unsupported character`);
    }
    return value;
  }
  function color(value, label, special = []) {
    if (special.includes(value)) return value;
    if (typeof value !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) {
      fail(`${label} must be a hex color`);
    }
    return value.toLowerCase();
  }
  function escape(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function normalizeOrigin(value) {
    if (typeof value !== "string" || value.length > 512) fail("Card origin is invalid");
    let url;
    try { url = new URL(value); } catch { fail("Card origin is invalid"); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
      || url.pathname !== "/" || url.search || url.hash) fail("Card origin must be an HTTP(S) origin without credentials or a path");
    return url.origin;
  }
  function normalizeCard(raw) {
    record(raw, "Card");
    const endpoint = choice(raw.endpoint, CARD_ENDPOINTS, "Card endpoint");
    const values = record(raw.params, "Card parameters");
    if (Object.keys(values).length > LIMITS.MAX_CARD_PARAMS) fail("Card has too many parameters");
    const params = {};
    for (const [key, value] of Object.entries(values)) {
      if (key.length > 80 || !/^[a-z][a-z0-9_.-]*$/i.test(key)
        || key.split(/[.-]/).some((part) => ["prototype", ...Object.getOwnPropertyNames(Object.prototype)].some((name) => name.toLowerCase() === part.toLowerCase()))) {
        fail("Card parameter name is invalid");
      }
      if (/(?:token|secret|password|credential|authorization|api[_-]?key|access[_-]?key)/i.test(key)) {
        fail("Secret or token parameters cannot be included in a public card URL");
      }
      params[key] = string(value, LIMITS.MAX_CARD_PARAM_LENGTH, `Card parameter ${key}`);
    }
    if (jsonBytes(params) > LIMITS.MAX_CARD_PARAM_BYTES) fail("Card parameters are too large");
    const card = { endpoint, params };
    if (raw.parts !== undefined) {
      if (!decoration) fail("Card decoration module is required");
      const parts = decoration.normalizeParts(endpoint, raw.parts);
      if (parts) card.parts = parts;
    }
    if (raw.sourceOrigin !== undefined) card.sourceOrigin = normalizeOrigin(raw.sourceOrigin);
    if (raw.nativeWidth !== undefined || raw.nativeHeight !== undefined) {
      for (const key of ["nativeWidth", "nativeHeight"]) {
        const value = raw[key];
        if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 16384) {
          fail("Native card dimensions must both be positive numbers of at most 16384");
        }
        card[key] = value;
      }
    }
    if (raw.linkUrl !== undefined) {
      const value = string(raw.linkUrl, 2048, "Card link");
      const controls = /[\u0000-\u001f\u007f-\u009f]/;
      if (controls.test(value)) fail("Card link cannot contain control characters");
      let url;
      try { url = new URL(value); } catch { fail("Card link must be an HTTP(S) or mailto URL"); }
      if (!["http:", "https:", "mailto:"].includes(url.protocol) || url.username || url.password) {
        fail("Card link must be an HTTP(S) or mailto URL without credentials");
      }
      if (url.protocol === "mailto:") {
        let recipients;
        try {
          recipients = decodeURIComponent(url.pathname);
          if (controls.test(recipients) || controls.test(decodeURIComponent(url.search))) fail("Invalid email link");
        } catch { fail("Card link contains invalid email encoding or control characters"); }
        if (url.host || url.hash || recipients.startsWith("//")) fail("Card link must use mailto recipients without an authority or fragment");
        const checkRecipients = (list) => {
          if (!list) return;
          for (const address of list.split(",").map((item) => item.trim())) {
            const parts = address.split("@");
            if (parts.length !== 2 || !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i.test(parts[0])
              || !parts[1].split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) {
              fail("Card link contains an invalid email recipient");
            }
          }
        };
        checkRecipients(recipients);
        const fields = new Set();
        // Mailto query fields use URI encoding; a literal + is part of an
        // address or message, unlike application/x-www-form-urlencoded data.
        for (const pair of url.search.slice(1).split("&").filter(Boolean)) {
          const separator = pair.indexOf("=");
          if (separator < 1) fail("Card link contains an invalid email field");
          const key = decodeURIComponent(pair.slice(0, separator));
          const field = decodeURIComponent(pair.slice(separator + 1));
          const name = key.toLowerCase();
          if (!["to", "cc", "bcc", "subject", "body"].includes(name) || fields.has(name) || controls.test(field)) {
            fail("Card link contains an unsupported or repeated email field");
          }
          fields.add(name);
          if (["to", "cc", "bcc"].includes(name)) checkRecipients(field);
        }
      }
      card.linkUrl = url.href;
    }
    if (raw.alt !== undefined) card.alt = string(raw.alt, 1024, "Card alternative text");
    if (raw.displayWidth !== undefined) {
      const value = string(raw.displayWidth, 32, "Card display width").trim();
      const match = value.match(/^(\d+(?:\.\d+)?|\.\d+)(%)?$/);
      const width = match && Number(match[1]);
      if (!match || !Number.isFinite(width) || (match[2] ? width < 1 : width <= 0) || width > (match[2] ? 100 : 16384)) {
        fail("Card display width must be positive pixels up to 16384 or a percentage from 1% to 100%");
      }
      card.displayWidth = String(width) + (match[2] || "");
    }
    cardCallCount(card);
    return card;
  }
  function cardCallCount(card) {
    if (card.endpoint !== "stack") return 1;
    const children = (card.params.cards || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (!children.length) fail("Stack requires at least one card");
    if (children.some((name) => !STACK_ENDPOINTS.includes(name))) fail("Stack contains an unsupported or recursive card endpoint");
    const calls = 1 + children.length;
    if (calls > LIMITS.MAX_CARD_CALLS) fail("A design can invoke at most 8 card endpoints, including stack children");
    return calls;
  }
  function cardPath(card) {
    // Encode keys and values independently; never interpolate raw query text into SVG.
    const query = Object.entries(card.params).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
    return `/api/${card.endpoint}${query ? `?${query}` : ""}`;
  }

  function imageDimensions(binary, format) {
    const byte = (at) => binary.charCodeAt(at);
    const u16 = (at) => byte(at) * 256 + byte(at + 1);
    const le16 = (at) => byte(at) + byte(at + 1) * 256;
    const u32 = (at) => byte(at) * 16777216 + byte(at + 1) * 65536 + byte(at + 2) * 256 + byte(at + 3);
    const le32 = (at) => byte(at) + byte(at + 1) * 256 + byte(at + 2) * 65536 + byte(at + 3) * 16777216;
    if (format === "png") {
      if (binary.length < 45 || binary.slice(0, 8) !== "\x89PNG\r\n\x1a\n"
        || u32(8) !== 13 || binary.slice(12, 16) !== "IHDR"
        || u32(binary.length - 12) !== 0 || binary.slice(-8, -4) !== "IEND") fail("Image is not a PNG file");
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!depths[byte(25)]?.includes(byte(24)) || byte(26) !== 0 || byte(27) !== 0 || byte(28) > 1) {
        fail("PNG image header is invalid");
      }
      return { width: u32(16), height: u32(20) };
    }
    if (format === "jpeg") {
      if (binary.length < 12 || binary.slice(0, 3) !== "\xff\xd8\xff"
        || binary.slice(-2) !== "\xff\xd9") fail("Image is not a JPEG file");
      let cursor = 2;
      while (cursor < binary.length - 2) {
        if (byte(cursor) !== 0xff) break;
        while (byte(cursor) === 0xff) cursor++;
        const marker = byte(cursor++);
        if (marker === 0xda || marker === 0xd9) break;
        const length = u16(cursor);
        if (length < 2 || cursor + length > binary.length) break;
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          const components = byte(cursor + 7);
          if (length < 8 || components < 1 || components > 4 || length !== 8 + 3 * components) break;
          return { width: u16(cursor + 5), height: u16(cursor + 3) };
        }
        cursor += length;
      }
      fail("JPEG image dimensions are missing");
    }
    if (binary.length < 26 || binary.slice(0, 4) !== "RIFF" || binary.slice(8, 12) !== "WEBP"
      || le32(4) + 8 !== binary.length) fail("Image is not a WebP file");
    let cursor = 12;
    while (cursor + 8 <= binary.length) {
      const tag = binary.slice(cursor, cursor + 4);
      const length = le32(cursor + 4);
      const data = cursor + 8;
      if (data + length > binary.length) break;
      if (tag === "VP8X" && length >= 10) {
        if (length !== 10 || (byte(data) & 0xc1) || byte(data + 1) || byte(data + 2) || byte(data + 3)) {
          fail("WebP image header is invalid");
        }
        return { width: 1 + byte(data + 4) + byte(data + 5) * 256 + byte(data + 6) * 65536,
          height: 1 + byte(data + 7) + byte(data + 8) * 256 + byte(data + 9) * 65536 };
      }
      if (tag === "VP8L" && length >= 5 && byte(data) === 0x2f) {
        const bits = le32(data + 1);
        if (bits >>> 29) fail("WebP image header is invalid");
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      }
      if (tag === "VP8 " && length >= 10 && binary.slice(data + 3, data + 6) === "\x9d\x01\x2a") {
        return { width: le16(data + 6) & 0x3fff, height: le16(data + 8) & 0x3fff };
      }
      cursor = data + length + (length % 2);
    }
    fail("WebP image dimensions are missing");
  }

  function checkedImageDimensions(binary, format) {
    const dimensions = imageDimensions(binary, format);
    if (!dimensions.width || !dimensions.height || dimensions.width > 16384 || dimensions.height > 16384
      || dimensions.width * dimensions.height > LIMITS.MAX_IMAGE_PIXELS) {
      fail("Image exceeds the 16 megapixel limit");
    }
    return dimensions;
  }

  function imageInfo(bytes, mime) {
    if (!ArrayBuffer.isView(bytes) || Object.prototype.toString.call(bytes) !== "[object Uint8Array]") {
      fail("Image bytes must be a Uint8Array");
    }
    if (bytes.byteLength > LIMITS.MAX_IMPORT_IMAGE_BYTES) fail("Image exceeds the 12 MiB import limit");
    const format = choice(mime, ["image/png", "image/jpeg", "image/webp"], "Image MIME type").slice(6);
    // Spreading a whole upload into fromCharCode can overflow the call stack.
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
    }
    return checkedImageDimensions(chunks.join(""), format);
  }

  function embeddedImage(value) {
    if (typeof value !== "string") fail("Image source must be an embedded PNG, JPEG or WebP");
    if (imageCache.has(value)) {
      const dimensions = imageCache.get(value);
      imageCache.delete(value);
      imageCache.set(value, dimensions);
      return value;
    }
    if (value.length > Math.ceil(LIMITS.MAX_IMAGE_BYTES / 3) * 4 + 32) fail("Image exceeds the 3 MiB limit");
    const match = IMAGE_PREFIX.exec(value);
    if (!match || match[2].length % 4 !== 0) fail("Image source must be an embedded PNG, JPEG or WebP");
    const byteLength = match[2].length * 3 / 4 - (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0);
    if (byteLength > LIMITS.MAX_IMAGE_BYTES) fail("Image exceeds the 3 MiB limit");
    let binary;
    try { binary = atob(match[2]); } catch { fail("Image data is not valid base64"); }
    const dimensions = checkedImageDimensions(binary, match[1]);
    // Avoid decoding embedded image bytes again on every drag frame. The cache
    // is bounded and never changes the document or its rendering.
    while (imageCache.size >= 64 || imageCacheBytes + value.length > LIMITS.MAX_FILE_BYTES * 2) {
      const oldest = imageCache.keys().next().value;
      imageCacheBytes -= oldest.length;
      imageCache.delete(oldest);
    }
    imageCache.set(value, dimensions);
    imageCacheBytes += value.length;
    return value;
  }

  function normalizeElement(raw) {
    record(raw, "Element");
    const type = choice(raw.type, Object.keys(TYPE_KEYS), "Element type");
    keys(raw, [...COMMON_KEYS, ...TYPE_KEYS[type]], "Element");
    if (typeof raw.id !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/i.test(raw.id)) fail("Element ID is invalid");
    const normalized = {
      id: raw.id, type,
      x: number(raw.x, -LIMITS.MAX_COORDINATE, LIMITS.MAX_COORDINATE, "Element x"),
      y: number(raw.y, -LIMITS.MAX_COORDINATE, LIMITS.MAX_COORDINATE, "Element y"),
      width: number(raw.width, 1, LIMITS.MAX_ELEMENT_SIZE, "Element width"),
      height: number(raw.height, 1, LIMITS.MAX_ELEMENT_SIZE, "Element height"),
      rotation: number(raw.rotation, -360, 360, "Element rotation"),
      opacity: number(raw.opacity, 0, 1, "Element opacity"),
    };
    if (raw.effect !== undefined) {
      if (!decoration) fail("Card decoration module is required");
      const effect = decoration.normalizeEffect(raw.effect);
      if (effect) normalized.effect = effect;
    }
    if (type === "text") Object.assign(normalized, {
      text: string(raw.text, LIMITS.MAX_TEXT_LENGTH, "Text").replace(/\r\n?/g, "\n"),
      fontFamily: choice(raw.fontFamily, Object.keys(FONT_FAMILIES), "Font family"),
      fontSize: number(raw.fontSize, 8, 256, "Font size"),
      fontWeight: choice(raw.fontWeight, [400, 700], "Font weight"),
      color: color(raw.color, "Text color"),
      align: choice(raw.align, ["left", "center", "right"], "Text alignment"),
    });
    else if (type === "image") Object.assign(normalized, {
      src: embeddedImage(raw.src), fit: choice(raw.fit, ["cover", "contain"], "Image fit"),
    });
    else if (type === "card") Object.assign(normalized, normalizeCard(raw));
    else Object.assign(normalized, {
      fill: color(raw.fill, "Shape fill", ["none"]),
      stroke: color(raw.stroke, "Shape stroke", ["none"]),
      strokeWidth: number(raw.strokeWidth, 0, 64, "Stroke width"),
      radius: number(raw.radius, 0, Math.min(normalized.width, normalized.height) / 2, "Corner radius"),
    });
    return normalized;
  }

  function jsonBytes(value) {
    if (typeof value === "string") {
      // Validated data URIs are ASCII and contain no JSON escapes.
      if (imageCache.has(value)) return value.length + 2;
      return new TextEncoder().encode(JSON.stringify(value)).length;
    }
    if (typeof value === "number") return String(value).length;
    if (Array.isArray(value)) return 2 + Math.max(0, value.length - 1) + value.reduce((sum, item) => sum + jsonBytes(item), 0);
    const entries = Object.entries(value);
    return 2 + Math.max(0, entries.length - 1) + entries.reduce((sum, [key, item]) => sum + jsonBytes(key) + 1 + jsonBytes(item), 0);
  }

  function normalizeDocument(raw) {
    record(raw, "Document");
    keys(raw, DOCUMENT_KEYS, "Document");
    if (raw.kind !== "profilekit-card" || raw.version !== 1) fail("Unsupported ProfileKit document format or version");
    if (!Array.isArray(raw.elements) || raw.elements.length > LIMITS.MAX_ELEMENTS) fail("A card can contain at most 64 elements");
    const normalized = {
      kind: "profilekit-card", version: 1,
      name: string(raw.name, 256, "Document name"),
      width: number(raw.width, LIMITS.MIN_CANVAS, LIMITS.MAX_CANVAS, "Canvas width"),
      height: number(raw.height, LIMITS.MIN_CANVAS, LIMITS.MAX_CANVAS, "Canvas height"),
      background: color(raw.background, "Background", ["transparent"]),
      elements: raw.elements.map(normalizeElement),
    };
    const ids = new Set();
    let cardCalls = 0;
    for (const element of normalized.elements) {
      if (ids.has(element.id)) fail("Element IDs must be unique");
      ids.add(element.id);
      if (element.type === "card") cardCalls += cardCallCount(element);
    }
    if (cardCalls > LIMITS.MAX_CARD_CALLS) fail("A design can invoke at most 8 card endpoints, including stack children");
    if (jsonBytes(normalized) > LIMITS.MAX_FILE_BYTES) fail("Document exceeds the 8 MiB file limit");
    const imageSources = new Set();
    let totalPixels = 0;
    for (const element of normalized.elements) {
      if (element.type !== "image" || imageSources.has(element.src)) continue;
      imageSources.add(element.src);
      embeddedImage(element.src);
      const dimensions = imageCache.get(element.src);
      totalPixels += dimensions.width * dimensions.height;
      if (totalPixels > LIMITS.MAX_TOTAL_IMAGE_PIXELS) fail("Document images exceed the 32 megapixel total limit");
    }
    return normalized;
  }

  function createDocument(overrides = {}) {
    record(overrides, "Document overrides");
    return normalizeDocument({ kind: "profilekit-card", version: 1, name: "Untitled card", width: 960, height: 540,
      background: "#f4f0e8", elements: [], ...overrides });
  }
  function newElementId() {
    if (typeof globalThis.crypto?.randomUUID === "function") return `el-${globalThis.crypto.randomUUID()}`;
    if (!localIdPrefix) {
      if (typeof globalThis.crypto?.getRandomValues === "function") {
        const random = globalThis.crypto.getRandomValues(new Uint32Array(4));
        localIdPrefix = Array.from(random, (value) => value.toString(16).padStart(8, "0")).join("");
      } else {
        localIdPrefix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}-${Math.random().toString(36).slice(2, 14)}`;
      }
    }
    return `el-${localIdPrefix}-${++nextId}`;
  }
  function createElement(type, overrides = {}) {
    choice(type, Object.keys(TYPE_KEYS), "Element type");
    record(overrides, "Element overrides");
    const defaults = {
      text: { width: 480, height: 160, text: "Your text", fontFamily: "sans", fontSize: 64, fontWeight: 700, color: "#242424", align: "left" },
      image: { width: 320, height: 240, fit: "cover" },
      rect: { width: 240, height: 160, fill: "#d55c3c", stroke: "none", strokeWidth: 0, radius: 0 },
      ellipse: { width: 180, height: 180, fill: "#d55c3c", stroke: "none", strokeWidth: 0, radius: 0 },
      card: { width: 600, height: 280, endpoint: "hero", params: {} },
    };
    return normalizeElement({ type, x: 80, y: 80, rotation: 0, opacity: 1,
      ...defaults[type], ...overrides, id: overrides.id ?? newElementId(), type });
  }
  function parseDocument(json) {
    if (typeof json !== "string") fail("Document file must contain JSON text");
    if (json.length > LIMITS.MAX_FILE_BYTES || new TextEncoder().encode(json).length > LIMITS.MAX_FILE_BYTES) {
      fail("Document exceeds the 8 MiB file limit");
    }
    let raw;
    try { raw = JSON.parse(json); } catch { fail("Document file is not valid JSON"); }
    return normalizeDocument(raw);
  }
  function serializeDocument(document) {
    return JSON.stringify(normalizeDocument(document));
  }

  function graphemes(text) {
    const groups = [];
    let joinNext = false;
    let regionalCount = 0;
    for (const char of text) {
      const code = char.codePointAt(0);
      const regional = code >= 0x1f1e6 && code <= 0x1f1ff;
      const extension = /\p{Mark}/u.test(char) || code === 0xfe0e || code === 0xfe0f
        || (code >= 0x1f3fb && code <= 0x1f3ff) || code === 0x200d;
      if (groups.length && (joinNext || extension || (regional && regionalCount % 2 === 1))) groups[groups.length - 1] += char;
      else groups.push(char);
      joinNext = code === 0x200d;
      regionalCount = regional ? regionalCount + 1 : 0;
    }
    return groups;
  }
  function estimatedAdvance(cluster, element) {
    if (/^[\p{Mark}\u200b-\u200f\u2060\ufe0e\ufe0f]+$/u.test(cluster)) return 0;
    if (/[\p{Extended_Pictographic}\p{Regional_Indicator}\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7af\uf900-\ufaff\uff01-\uff60]/u.test(cluster)) return element.fontSize;
    if (element.fontFamily === "mono") return element.fontSize * 0.61;
    if (cluster === " ") return element.fontSize * 0.3;
    if (/^[ilI.,!:'`|;]$/u.test(cluster)) return element.fontSize * 0.3;
    if (/^[MW@#%&]$/u.test(cluster)) return element.fontSize * 0.92;
    if (/^[A-Z]$/u.test(cluster)) return element.fontSize * 0.69;
    return element.fontSize * (element.fontWeight === 700 ? 0.58 : 0.55);
  }
  function layout(element) {
    const lineHeight = element.fontSize * 1.2;
    const maxLines = Math.floor((element.height + 0.000001) / lineHeight);
    if (element.text === "") return { lines: [], totalLines: 0, maxLines, lineHeight,
      baseline: element.fontSize * 0.95, overflow: false };
    const lines = [];
    let tooWide = false;
    for (const paragraph of element.text.split("\n")) {
      let current = [];
      let width = 0;
      let lastSpace = -1;
      for (const cluster of graphemes(paragraph.replace(/\t/g, "    "))) {
        const advance = estimatedAdvance(cluster, element);
        if (advance > element.width) tooWide = true;
        while (current.length && width + advance > element.width) {
          if (lastSpace > 0) {
            lines.push(current.slice(0, lastSpace).join("").replace(/ +$/, ""));
            current = current.slice(lastSpace + 1);
          } else {
            lines.push(current.join(""));
            current = [];
          }
          width = current.reduce((sum, char) => sum + estimatedAdvance(char, element), 0);
          lastSpace = current.lastIndexOf(" ");
        }
        current.push(cluster);
        width += advance;
        if (cluster === " ") lastSpace = current.length - 1;
      }
      lines.push(current.join("").replace(/ +$/, ""));
    }
    return { lines: lines.slice(0, maxLines), totalLines: lines.length, maxLines, lineHeight,
      baseline: element.fontSize * 0.95, overflow: tooWide || lines.length > maxLines };
  }
  function textLayout(element) {
    const normalized = normalizeElement(element);
    if (normalized.type !== "text") fail("Text layout requires a text element");
    return layout(normalized);
  }
  function svgNumber(value) { return String(Math.round(value * 1000) / 1000); }

  function regexEscape(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // These helpers accept only renderer output, never a document field or imported SVG.
  // Nested SVG viewports do not isolate styles: scope selectors, IDs, animations and
  // embedded font families separately so repeated cards can use different themes.
  function scopeCSS(css, scope) {
    let output = "";
    let cursor = 0;
    while (cursor < css.length) {
      const open = css.indexOf("{", cursor);
      if (open < 0) return output + css.slice(cursor);
      const selector = css.slice(cursor, open).trim();
      let depth = 1;
      let quote = "";
      let end = open + 1;
      for (; end < css.length && depth; end++) {
        const char = css[end];
        if (quote) {
          if (char === "\\") end++;
          else if (char === quote) quote = "";
        } else if (char === "'" || char === '"') quote = char;
        else if (char === "{") depth++;
        else if (char === "}") depth--;
      }
      if (depth) fail("Card renderer returned invalid CSS");
      const body = css.slice(open + 1, end - 1);
      if (/^@(?:media|supports|layer)\b/.test(selector)) output += `${selector}{${scopeCSS(body, scope)}}`;
      else if (selector.startsWith("@")) output += `${selector}{${body}}`;
      else output += `${selector.split(",").map((part) => `#${scope} ${part.trim()}`).join(",")}{${body}}`;
      cursor = end;
    }
    return output;
  }

  function isolateSVG(svg, prefix) {
    if (typeof svg !== "string" || !/^\s*<svg\b/.test(svg) || !/^[a-z][a-z0-9_-]*$/i.test(prefix)) {
      fail("Card renderer must return a complete SVG");
    }
    const ids = new Set(Array.from(svg.matchAll(/\bid="([^"]+)"/g), (match) => match[1]));
    const animations = new Set();
    const families = new Set();
    for (const [, css] of svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
      for (const match of css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/g)) animations.add(match[1]);
      for (const match of css.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*['"]([^'"]+)['"]/g)) families.add(match[1]);
    }
    let result = svg.replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`)
      .replace(/((?:xlink:)?href=")#([^"]+)(")/g, (_, start, id, end) => `${start}#${ids.has(id) ? prefix : ""}${id}${end}`)
      .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${ids.has(id) ? prefix : ""}${id})`);
    function rewriteStyles(css) {
      for (const id of ids) css = css.replace(new RegExp(`#${regexEscape(id)}(?=[^\\w-]|$)`, "g"), `#${prefix}${id}`);
      for (const name of animations) {
        const token = new RegExp(`(?<![\\w-])${regexEscape(name)}(?![\\w-])`, "g");
        css = css.replace(/(@(?:-webkit-)?keyframes\s+)([\w-]+)/g, (match, start, value) => start + (value === name ? prefix + value : value));
        css = css.replace(/(\banimation(?:-name)?\s*:\s*)([^;}]+)/g, (_, start, value) => start + value.replace(token, `${prefix}${name}`));
      }
      for (const family of families) css = css.replace(new RegExp(`(['"])${regexEscape(family)}\\1`, "g"), `'${prefix}${family}'`);
      return css;
    }
    result = result.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/g, (_, css) => `<style>${scopeCSS(rewriteStyles(css), `${prefix}scope`)}</style>`)
      .replace(/\bstyle="([^"]*)"/g, (_, css) => `style="${rewriteStyles(css)}"`)
      .replace(/\bfont-family="([^"]*)"/g, (_, family) => `font-family="${rewriteStyles(family)}"`);
    return result.replace(/^(\s*<svg\b[^>]*>)/, `$1<g id="${prefix}scope">`).replace(/<\/svg>\s*$/, "</g></svg>");
  }

  function positionedCard(svg, element, prefix) {
    const tag = svg.match(/^\s*<svg\b([^>]*)>/);
    if (!tag) fail("Card renderer must return a complete SVG");
    let attrs = tag[1];
    if (!/\bviewBox=/.test(attrs)) {
      const w = attrs.match(/\bwidth="([\d.]+)"/);
      const h = attrs.match(/\bheight="([\d.]+)"/);
      if (!w || !h) fail("Card renderer SVG has no dimensions");
      attrs += ` viewBox="0 0 ${w[1]} ${h[1]}"`;
    }
    attrs = attrs.replace(/\s+(?:x|y|width|height|preserveAspectRatio|overflow)="[^"]*"/g, "");
    const placed = svg.replace(tag[0], `<svg x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" preserveAspectRatio="none" overflow="hidden"${attrs}>`);
    return isolateSVG(placed, prefix);
  }

  function renderSVG(document, { interactive = false, cardMarkup } = {}) {
    const doc = normalizeDocument(document);
    const elements = doc.elements.map((element, index) => {
      const { id, type, x, y, width, height, rotation, opacity } = element;
      const box = `x="${x}" y="${y}" width="${width}" height="${height}"`;
      const clipId = `pk-clip-${index}-${id}`;
      const clip = `<defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect ${box}/></clipPath></defs>`;
      let body;
      if (type === "text") {
        const text = layout(element);
        const anchor = element.align === "center" ? "middle" : element.align === "right" ? "end" : "start";
        const textX = svgNumber(x + (element.align === "center" ? width / 2 : element.align === "right" ? width : 0));
        const spans = text.lines.map((line, row) => `<tspan x="${textX}" y="${svgNumber(y + text.baseline + row * text.lineHeight)}">${escape(line)}</tspan>`).join("");
        body = `${clip}<text xml:space="preserve" font-family="${escape(FONT_FAMILIES[element.fontFamily])}" font-size="${element.fontSize}" font-weight="${element.fontWeight}" fill="${element.color}" text-anchor="${anchor}" clip-path="url(#${clipId})">${spans}</text>`;
      } else if (type === "image") {
        body = `${clip}<image ${box} href="${element.src}" preserveAspectRatio="xMidYMid ${element.fit === "cover" ? "slice" : "meet"}" clip-path="url(#${clipId})"/>`;
      } else if (type === "card") {
        if (element.parts && (!cardMarkup || !Object.hasOwn(cardMarkup, id))) fail("Decorated cards require their rendered card markup");
        body = cardMarkup && Object.hasOwn(cardMarkup, id)
          ? positionedCard(element.parts ? decoration.applyParts(cardMarkup[id], element.parts) : cardMarkup[id], element, `pk-card-${index}-${id}-`)
          : `<image ${box} href="${escape((element.sourceOrigin || "") + cardPath(element))}" preserveAspectRatio="none"/>`;
      } else {
        const appearance = `fill="${element.fill}" stroke="${element.stroke}" stroke-width="${element.strokeWidth}"`;
        body = type === "rect" ? `<rect ${box} rx="${element.radius}" ${appearance}/>`
          : `<ellipse cx="${svgNumber(x + width / 2)}" cy="${svgNumber(y + height / 2)}" rx="${svgNumber(width / 2)}" ry="${svgNumber(height / 2)}" ${appearance}/>`;
      }
      const hitArea = interactive ? `<rect ${box} fill="transparent" pointer-events="all"/>` : "";
      if (element.effect) {
        const effect = element.effect;
        const filterId = `pk-effect-${index}-${id}`;
        // Explicit user-space bounds include the painted stroke before adding
        // blur/offset space. The final canvas remains the document's crop.
        const strokePadding = ["rect", "ellipse"].includes(type) && element.stroke !== "none" ? element.strokeWidth / 2 : 0;
        const padding = strokePadding + effect.blur * 3 + Math.max(Math.abs(effect.dx), Math.abs(effect.dy)) + 1;
        const dx = effect.dx;
        const dy = effect.dy;
        const filter = `<defs><filter id="${filterId}" filterUnits="userSpaceOnUse" x="${svgNumber(x - padding)}" y="${svgNumber(y - padding)}" width="${svgNumber(width + padding * 2)}" height="${svgNumber(height + padding * 2)}" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="${effect.blur}"/><feOffset dx="${dx}" dy="${dy}" result="${filterId}-offset"/><feFlood flood-color="${effect.color}" flood-opacity="${effect.opacity}"/><feComposite in2="${filterId}-offset" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
        body = `${filter}<g filter="url(#${filterId})">${body}</g>`;
      }
      return `<g${interactive ? ` data-element-id="${id}"` : ""} transform="rotate(${rotation} ${svgNumber(x + width / 2)} ${svgNumber(y + height / 2)})" opacity="${opacity}">${hitArea}${body}</g>`;
    }).join("\n");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}" overflow="hidden" role="img" aria-label="${escape(doc.name || "Profile card")}"><title>${escape(doc.name || "Profile card")}</title><rect width="${doc.width}" height="${doc.height}" fill="${doc.background}"/>\n${elements}\n</svg>`;
  }

  return { LIMITS, FONT_FAMILIES, CARD_ENDPOINTS, STACK_ENDPOINTS, PARTS: decoration?.PARTS || Object.freeze({}), createDocument, createElement, normalizeDocument, normalizeCard,
    normalizeOrigin, cardCallCount, cardPath, parseDocument, serializeDocument, renderSVG, textLayout, imageInfo, isolateSVG };
});
