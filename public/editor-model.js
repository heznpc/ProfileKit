/* Portable editor documents and their shared preview/export SVG renderer. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ProfileKitEditorModel = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const LIMITS = Object.freeze({
    MIN_CANVAS: 64,
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
  });
  const FONT_FAMILIES = Object.freeze({
    sans: "'Helvetica Neue', Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'Courier New', Courier, monospace",
  });
  const COMMON_KEYS = ["id", "type", "x", "y", "width", "height", "rotation", "opacity"];
  const TYPE_KEYS = {
    text: ["text", "fontFamily", "fontSize", "fontWeight", "color", "align"],
    image: ["src", "fit"],
    rect: ["fill", "stroke", "strokeWidth", "radius"],
    ellipse: ["fill", "stroke", "strokeWidth", "radius"],
  };
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
    for (const element of normalized.elements) {
      if (ids.has(element.id)) fail("Element IDs must be unique");
      ids.add(element.id);
    }
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

  function renderSVG(document, { interactive = false } = {}) {
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
      } else {
        const appearance = `fill="${element.fill}" stroke="${element.stroke}" stroke-width="${element.strokeWidth}"`;
        body = type === "rect" ? `<rect ${box} rx="${element.radius}" ${appearance}/>`
          : `<ellipse cx="${svgNumber(x + width / 2)}" cy="${svgNumber(y + height / 2)}" rx="${svgNumber(width / 2)}" ry="${svgNumber(height / 2)}" ${appearance}/>`;
      }
      const hitArea = interactive ? `<rect ${box} fill="transparent" pointer-events="all"/>` : "";
      return `<g${interactive ? ` data-element-id="${id}"` : ""} transform="rotate(${rotation} ${svgNumber(x + width / 2)} ${svgNumber(y + height / 2)})" opacity="${opacity}">${hitArea}${body}</g>`;
    }).join("\n");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}" overflow="hidden" role="img" aria-label="${escape(doc.name || "Profile card")}"><title>${escape(doc.name || "Profile card")}</title><rect width="${doc.width}" height="${doc.height}" fill="${doc.background}"/>\n${elements}\n</svg>`;
  }

  return { LIMITS, FONT_FAMILIES, createDocument, createElement, normalizeDocument, parseDocument, serializeDocument, renderSVG, textLayout, imageInfo };
});
