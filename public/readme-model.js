/* Source-preserving README image references. No DOM, network, or persistence. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./card-schema"), require("./card-design"), require("./editor-model"));
  else root.ProfileKitReadmeModel = factory(root.ProfileKitCards, root.ProfileKitCardDesign, root.ProfileKitEditorModel);
})(typeof globalThis !== "undefined" ? globalThis : this, (schema, Design, Editor) => {
  "use strict";

  const DEFAULT_ORIGIN = "https://profilekit.vercel.app";
  const LIMITS = Object.freeze({ MAX_SOURCE_BYTES: 1024 * 1024, MAX_CARDS: 250, MAX_URL_LENGTH: 32768, MAX_PARAMS: 128, MAX_PARAM_LENGTH: 8192 });
  const ENDPOINTS = new Set([...Object.keys(schema.CARDS), "stack", "design"]);
  const STACK_CARDS = new Set(["hero", "section", "divider", "now", "timeline", "tags", "toc", "stats", "languages"]);
  const GITHUB_CARDS = new Set(["stats", "languages", "reviews"]);
  const COLORS = new Set(["color", "bg_color", "text_color", "title_color", "icon_color", "border_color", "accent_color", "theme_url"]);
  const FONTS = schema.CARDS.stats.params.find((param) => param.name === "font").options;
  const has = (record, key) => Object.prototype.hasOwnProperty.call(record, key);
  const error = (message) => { throw new Error(message); };
  const encode = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  const html = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const escaped = (source, index) => { let count = 0; while (source[--index] === "\\") count++; return count % 2 === 1; };

  function record(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) error(`${label} must be an object`);
    return value;
  }

  function text(value, length, label) {
    if (typeof value !== "string" || value.length > length || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) error(`${label} contains invalid or oversized text`);
    // encodeURIComponent rejects lone surrogates; reject them before any edit starts.
    try { encodeURIComponent(value); } catch { error(`${label} contains an invalid character`); }
    return value;
  }

  function sourceText(source) {
    text(source, LIMITS.MAX_SOURCE_BYTES, "README");
    const bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(source).length : unescape(encodeURIComponent(source)).length;
    if (bytes > LIMITS.MAX_SOURCE_BYTES) error("README exceeds the 1 MiB limit");
    return source;
  }

  function assetPath(value) {
    text(value, 512, "Asset path");
    if (!/^(?:\.\/)?[a-z0-9_-][a-z0-9._-]*(?:\/[a-z0-9_-][a-z0-9._-]*)*\.svg$/i.test(value) || value.split("/").some((part) => part === "..")) error("Asset path must be a repository-relative SVG path without traversal");
    return value.replace(/^\.\//, "");
  }
  function normalizeAssetDesigns(value = {}) {
    record(value, "Asset designs");
    if (Object.keys(value).length > LIMITS.MAX_CARDS || new TextEncoder().encode(JSON.stringify(value)).length > 32 * 1024 * 1024) error("Asset designs exceed the project limit");
    const result = Object.create(null);
    for (const [path, document] of Object.entries(value)) {
      const canonical = assetPath(path);
      if (has(result, canonical)) error("Duplicate asset path aliases are not allowed");
      result[canonical] = Editor.normalizeDocument(document);
    }
    return result;
  }

  function originOption(options) {
    record(options, "Options");
    const value = options.origin ?? DEFAULT_ORIGIN;
    let url;
    try { url = new URL(text(value, 512, "Origin")); } catch { error("Origin must be an HTTP(S) origin"); }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) error("Origin must be an HTTP(S) origin without credentials or a path");
    return url.origin;
  }

  function safeKey(key) {
    return key.length > 0 && key.length <= 128 && !/[\s\u0000-\u001f\u007f]/.test(key)
      && !key.split(/[.\[\]]/).some((part) => ["__proto__", "prototype", "constructor"].includes(part));
  }

  function paramsRecord(params, endpoint) {
    record(params, "Parameters");
    if (Object.keys(params).length > LIMITS.MAX_PARAMS) error("Too many card parameters");
    const result = Object.create(null);
    for (const [key, value] of Object.entries(params)) {
      if (!safeKey(key)) error(`Unsafe parameter name: ${key}`);
      result[key] = text(value, endpoint === "design" ? Design.MAX_DESIGN_URL_LENGTH : LIMITS.MAX_PARAM_LENGTH, `Parameter ${key}`);
    }
    if (endpoint === "design") validateDesign(result);
    return result;
  }

  function validateDesign(params) {
    if (!Design || Object.keys(params).length !== 1 || !has(params, "d")) error("Provide one ?d= encoded design document");
    return Design.decodeDocument(params.d);
  }

  // Boundary maps let an edit retain the original spelling of HTML entities,
  // Markdown escapes, percent escapes, separators, and every untouched value.
  function decode(raw, syntax) {
    let value = "";
    const map = [0];
    for (let index = 0; index < raw.length;) {
      let decoded = raw[index];
      let length = 1;
      if (raw[index] === "&") {
        const entity = raw.slice(index).match(/^&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/i);
        if (entity) {
          const name = entity[0].slice(1, -1).toLowerCase();
          const code = name[0] === "#" ? (name[1] === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1))) : null;
          if (code === null) decoded = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" }[name];
          else if (code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) decoded = String.fromCodePoint(code);
          else error("Invalid HTML entity in image URL");
          length = entity[0].length;
        }
      } else if (syntax === "markdown" && raw[index] === "\\" && /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(raw[index + 1] || "")) {
        decoded = raw[index + 1];
        length = 2;
      }
      value += decoded;
      for (let part = 0; part < decoded.length; part++) map.push(part === decoded.length - 1 ? index + length : index);
      index += length;
    }
    return { value, map };
  }

  function maskedSource(source) {
    const hidden = new Uint8Array(source.length);
    const hide = (start, end) => hidden.fill(1, start, end);
    for (const match of source.matchAll(/<!--[\s\S]*?(?:-->|$)|<(pre|code|script|style|textarea)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi)) hide(match.index, match.index + match[0].length);
    let fence = null;
    let indentedCode = false;
    let previousLine = "";
    const containers = [];
    const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
    const tags = source.matchAll(/<\/?([a-z][\w:-]*)(?=\s|\/?>)(?:[^>"']|"[^"]*"|'[^']*')*>/gi);
    let nextTag = tags.next();
    for (const match of source.matchAll(/[^\n]*(?:\n|$)/g)) {
      if (!match[0]) continue;
      const line = match[0];
      const indented = /^(?: {4}| {0,3}\t)/.test(line);
      if (indentedCode && line.trim() && !indented) indentedCode = false;
      const marker = line.match(/^(?: {0,3}> ?)* {0,3}(`{3,}|~{3,})(.*?)(?:\r?\n)?$/);
      if (fence) {
        hide(match.index, match.index + line.length);
        if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      } else if (marker && !hidden[match.index] && !(marker[1][0] === "`" && marker[2].includes("`"))) {
        fence = { char: marker[1][0], length: marker[1].length };
        hide(match.index, match.index + line.length);
      } else if (indentedCode || (indented && !previousLine.trim() && !containers.length)) {
        indentedCode = true;
        hide(match.index, match.index + line.length);
      }
      // Only exposed tags establish HTML layout context. An indented <img>
      // example cannot exempt itself (or later lines) from its code block.
      while (!nextTag.done && nextTag.value.index < match.index + line.length) {
        const tag = nextTag.value;
        if (!hidden[tag.index] && (containers.length || /^ {0,3}$/.test(source.slice(match.index, tag.index)))) {
          const name = tag[1].toLowerCase();
          if (/^<\//.test(tag[0])) {
            const open = containers.lastIndexOf(name);
            if (open >= 0) containers.length = open;
          } else if (!voidTags.has(name) && !/\/\s*>$/.test(tag[0])) containers.push(name);
        }
        nextTag = tags.next();
      }
      previousLine = line;
    }
    const ticks = /`+/g;
    let match;
    while ((match = ticks.exec(source))) {
      if (hidden[match.index] || escaped(source, match.index)) continue;
      const closing = new RegExp(`(?<!\x60)\x60{${match[0].length}}(?!\x60)`, "g");
      closing.lastIndex = ticks.lastIndex;
      let end;
      while ((end = closing.exec(source)) && hidden[end.index]) { /* Find an exposed closing run. */ }
      if (end) { hide(match.index, end.index + end[0].length); ticks.lastIndex = end.index + end[0].length; }
    }
    return source.replace(/[^\n\r]/g, (char, offset) => hidden[offset] ? " " : char);
  }

  function attributes(tag, start) {
    const result = Object.create(null);
    const prefix = tag.match(/^<\/?[\w:-]+/)[0].length;
    const regex = /\s+([^\s=<>/'"]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    regex.lastIndex = prefix;
    let match;
    while ((match = regex.exec(tag))) {
      const name = match[1].toLowerCase();
      if (has(result, name)) continue;
      const raw = match[2] ?? match[3] ?? match[4];
      if (raw === undefined) continue;
      const quote = match[2] !== undefined ? '"' : match[3] !== undefined ? "'" : "";
      const valueOffset = match.index + match[0].indexOf("=") + 1;
      const valueStart = valueOffset + tag.slice(valueOffset).match(/^\s*/)[0].length + quote.length;
      result[name] = { value: decode(raw, "html").value, raw, start: start + valueStart, end: start + valueStart + raw.length, quote, fullStart: start + match.index, fullEnd: start + regex.lastIndex };
    }
    return result;
  }

  function srcset(attribute) {
    const refs = [];
    let cursor = 0;
    while (cursor < attribute.raw.length) {
      while (/[\s,]/.test(attribute.raw[cursor] || "") && cursor < attribute.raw.length) cursor++;
      const start = cursor;
      while (cursor < attribute.raw.length && !/\s/.test(attribute.raw[cursor])) cursor++;
      let end = cursor;
      while (attribute.raw[end - 1] === ",") end--;
      if (end > start) refs.push({ start: attribute.start + start, end: attribute.start + end });
      if (end !== cursor) continue;
      while (cursor < attribute.raw.length && attribute.raw[cursor] !== ",") cursor++;
      if (cursor < attribute.raw.length) cursor++;
    }
    return refs;
  }

  function bracketEnd(source, start) {
    let depth = 0;
    for (let index = start; index < source.length; index++) {
      if (escaped(source, index)) continue;
      if (source[index] === "[") depth++;
      if (source[index] === "]" && --depth === 0) return index;
      if (depth > 32) return -1;
    }
    return -1;
  }

  function destination(source, start, inline) {
    let cursor = start;
    while (/[ \t\r\n]/.test(source[cursor] || "") && cursor < source.length) cursor++;
    const angled = source[cursor] === "<";
    if (angled) cursor++;
    const first = cursor;
    let depth = 0;
    while (cursor < source.length) {
      const char = source[cursor];
      if (char === "\\" && cursor + 1 < source.length) { cursor += 2; continue; }
      if (angled ? char === ">" : (/\s/.test(char) || (char === ")" && depth === 0))) break;
      if (!angled && char === "(") depth++;
      if (!angled && char === ")") depth--;
      if (depth > 32 || /[\r\n<>]/.test(char)) return null;
      cursor++;
    }
    if (cursor === first || (angled && source[cursor] !== ">")) return null;
    const end = cursor;
    if (angled) cursor++;
    if (inline) {
      const rest = source.slice(cursor).match(/^(?:\s+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?\s*\)/);
      if (!rest) return null;
      cursor += rest[0].length;
    }
    return { start: first, end, after: cursor, angled };
  }

  const referenceLabel = (value) => decode(value, "markdown").value.replace(/\s+/g, " ").trim().toLowerCase();

  function inspect(source, options = {}) {
    const assets = normalizeAssetDesigns(options.assetDesigns);
    sourceText(source);
    const origin = originOption(options);
    const warnings = [];
    const candidates = [];
    const visible = maskedSource(source);
    const tagRanges = [];
    const pictureStack = [];
    const links = [];
    const pictures = [];
    const tagPattern = /<\/?([a-z][\w:-]*)(?=\s|\/?>)(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
    let tag;
    while ((tag = tagPattern.exec(visible))) {
      tagRanges.push([tag.index, tag.index + tag[0].length]);
      const name = tag[1].toLowerCase();
      const closing = /^<\//.test(tag[0]);
      if (closing) {
        if (name === "picture") pictureStack.pop();
        if (name === "a") links.pop();
        continue;
      }
      let attrs;
      try { attrs = attributes(source.slice(tag.index, tag.index + tag[0].length), tag.index); }
      catch { warnings.push("Skipped an HTML tag with an invalid character entity; its source is preserved."); continue; }
      const node = { attrs, insert: tag.index + tag[0].length - (tag[0].endsWith("/>") ? 2 : 1) };
      if (name === "a") links.push(attrs.href || null);
      if (name === "picture") {
        const picture = { id: `picture-${pictures.length + 1}`, candidates: [], variants: new Set(), image: null };
        pictures.push(picture); pictureStack.push(picture);
      }
      const picture = pictureStack[pictureStack.length - 1];
      if (name !== "img" && !(name === "source" && picture)) continue;
      if (name === "img" && picture) picture.image = node;
      const variant = attrs.media?.value.match(/prefers-color-scheme\s*:\s*(dark|light)/i)?.[1].toLowerCase() || "default";
      if (name === "source" && variant !== "default") picture.variants.add(variant);
      const refs = [];
      if (name === "img" && attrs.src) refs.push({ start: attrs.src.start, end: attrs.src.end, attribute: "src" });
      if (attrs.srcset) refs.push(...srcset(attrs.srcset).map((ref) => ({ ...ref, attribute: "srcset" })));
      for (const ref of refs) {
        const candidate = { ...ref, syntax: "html", variant, groupId: picture?.id || null, node, link: links[links.length - 1] || null, isSource: name === "source" };
        candidates.push(candidate);
        if (picture) picture.candidates.push(candidate);
      }
    }
    for (const picture of pictures) {
      for (const candidate of picture.candidates) {
        if (candidate.isSource && picture.image) candidate.metadataNode = picture.image;
        if (!candidate.isSource && picture.variants.size === 1) candidate.variant = picture.variants.has("dark") ? "light" : "dark";
      }
    }
    const markdownChars = visible.split("");
    for (const [start, end] of tagRanges) for (let index = start; index < end; index++) if (markdownChars[index] !== "\n") markdownChars[index] = " ";
    const markdown = markdownChars.join("");
    const definitions = new Map();
    const imageRanges = [];
    const definitionRanges = [];
    for (const match of markdown.matchAll(/^(?: {0,3}> ?)* {0,3}\[([^\]\n]+)\]:/gm)) {
      const label = referenceLabel(match[1]);
      const ref = destination(source, match.index + match[0].length, false);
      if (ref) {
        const lineEnd = markdown.indexOf("\n", ref.after);
        definitionRanges.push([match.index, lineEnd < 0 ? markdown.length : lineEnd]);
        if (!definitions.has(label)) definitions.set(label, { ...ref, label, uses: [], linkUses: 0 });
      }
    }
    const imagePattern = /!\[/g;
    let image;
    while ((image = imagePattern.exec(markdown))) {
      if (escaped(source, image.index)) continue;
      const close = bracketEnd(markdown, image.index + 1);
      if (close < 0) continue;
      const altSpan = { start: image.index + 2, end: close };
      let ref;
      let definition;
      let after = close + 1;
      if (markdown[after] === "(") {
        ref = destination(source, after + 1, true);
        if (!ref) continue;
        after = ref.after;
      } else {
        let label = source.slice(altSpan.start, altSpan.end);
        if (markdown[after] === "[") {
          const refEnd = bracketEnd(markdown, after);
          if (refEnd < 0) continue;
          label = source.slice(after + 1, refEnd) || label;
          after = refEnd + 1;
        }
        definition = definitions.get(referenceLabel(label));
        if (!definition) continue;
        ref = definition;
      }
      let link = null;
      if (markdown[image.index - 1] === "[" && !escaped(source, image.index - 1) && markdown.slice(after, after + 2) === "](") {
        const wrapper = destination(source, after + 2, true);
        if (wrapper) link = { ...wrapper, value: decode(source.slice(wrapper.start, wrapper.end), "markdown").value };
      }
      if (!link && markdown[image.index - 1] === "[" && !escaped(source, image.index - 1) && markdown[after] === "]") {
        let label = source.slice(image.index, after);
        if (markdown[after + 1] === "[") {
          const end = bracketEnd(markdown, after + 1);
          if (end >= 0) label = source.slice(after + 2, end) || label;
        }
        const wrapper = definitions.get(referenceLabel(label));
        if (wrapper) link = { ...wrapper, definition: wrapper, value: decode(source.slice(wrapper.start, wrapper.end), "markdown").value };
      }
      const candidate = { start: ref.start, end: ref.end, syntax: "markdown", attribute: definition ? "reference" : "destination", variant: "default", groupId: definition ? `reference:${definition.label}` : null, altSpan, link };
      if (definition) {
        definition.uses.push(candidate);
        if (definition.uses.length === 1) candidates.push(candidate);
        candidate.definition = definition;
      } else candidates.push(candidate);
      imageRanges.push([image.index, after]);
      imagePattern.lastIndex = after;
    }
    // A reference definition can also be a normal link's destination. Mask
    // image syntax and definitions before finding full, collapsed, and shortcut
    // link uses, including wrappers around images.
    const linkChars = markdown.split("");
    for (const [start, end] of [...imageRanges, ...definitionRanges]) {
      for (let index = start; index < end; index++) if (linkChars[index] !== "\n") linkChars[index] = " ";
    }
    const linkMarkdown = linkChars.join("");
    const linkPattern = /\[/g;
    let reference;
    while ((reference = linkPattern.exec(linkMarkdown))) {
      if (escaped(source, reference.index)) continue;
      const close = bracketEnd(linkMarkdown, reference.index);
      if (close < 0) continue;
      let after = close + 1;
      if (linkMarkdown[after] === "(") {
        const inline = destination(source, after + 1, true);
        if (inline) { linkPattern.lastIndex = inline.after; continue; }
      }
      let label = source.slice(reference.index + 1, close);
      if (linkMarkdown[after] === "[") {
        const refEnd = bracketEnd(linkMarkdown, after);
        if (refEnd < 0) continue;
        label = source.slice(after + 1, refEnd) || label;
        after = refEnd + 1;
      }
      const definition = definitions.get(referenceLabel(label));
      if (definition) {
        definition.linkUses++;
        linkPattern.lastIndex = after;
      }
    }
    const cards = [];
    const internals = new Map();
    for (const candidate of candidates.sort((a, b) => a.start - b.start)) {
      const raw = source.slice(candidate.start, candidate.end);
      let decoded;
      let url, savedAsset;
      try {
        decoded = decode(raw, candidate.syntax);
        let candidateAsset;
        try { candidateAsset = assetPath(decoded.value); } catch { /* Only validated paths can refer to saved assets. */ }
        savedAsset = candidateAsset && has(assets, candidateAsset) ? candidateAsset : null;
        if (!savedAsset && !/^(?:https?:\/\/|\/\/|\/api\/)/i.test(decoded.value)) continue;
        url = new URL(decoded.value, origin);
      } catch { continue; }
      if (![DEFAULT_ORIGIN, origin].includes(url.origin) || url.username || url.password || !/^https?:$/.test(url.protocol)) continue;
      const endpoint = savedAsset ? "design" : url.pathname.match(/^\/api\/([a-z]+)$/)?.[1];
      if (!ENDPOINTS.has(endpoint)) continue;
      if (cards.length === LIMITS.MAX_CARDS) { warnings.push(`Only the first ${LIMITS.MAX_CARDS} ProfileKit image references are editable; remaining source is preserved.`); break; }
      const params = Object.create(null);
      let invalid = raw.length > LIMITS.MAX_URL_LENGTH;
      for (const [key, value] of url.searchParams) {
        if (!safeKey(key) || value.length > (endpoint === "design" ? Design?.MAX_DESIGN_URL_LENGTH || 0 : LIMITS.MAX_PARAM_LENGTH)) invalid = true;
        if (endpoint === "design" && has(params, key)) invalid = true;
        if (!has(params, key)) params[key] = value;
      }
      if (Object.keys(params).length > LIMITS.MAX_PARAMS) invalid = true;
      if (invalid) { warnings.push(`Skipped an unsafe or oversized ${endpoint} image URL.`); continue; }
      let design = savedAsset ? assets[savedAsset] : undefined;
      if (endpoint === "design" && !savedAsset) {
        try {
          if (decoded.value.length > Design.MAX_DESIGN_URL_LENGTH) error("Design URL is too large");
          design = validateDesign(params);
        } catch { warnings.push("Skipped an invalid or oversized design image URL."); continue; }
      }
      const node = candidate.metadataNode || candidate.node;
      const alt = node?.attrs.alt?.value ?? (candidate.altSpan ? decode(source.slice(candidate.altSpan.start, candidate.altSpan.end), "markdown").value : "");
      const fragmentVariant = url.hash.match(/^#gh-(dark|light)-mode-only$/)?.[1];
      const card = { id: `card-${cards.length + 1}`, start: candidate.start, end: candidate.end, raw, url: savedAsset ? decoded.value : url.href, endpoint, params, syntax: candidate.syntax, attribute: candidate.attribute, variant: fragmentVariant || candidate.variant, groupId: candidate.groupId, alt, width: node?.attrs.width?.value ?? "" };
      if (design) card.design = design;
      if (savedAsset) card.assetPath = savedAsset;
      if (candidate.link) card.linkUrl = candidate.link.value;
      let urlEditWarning;
      if (candidate.link?.definition && (candidate.link.definition.linkUses > 1 || candidate.link.definition.uses.length)) {
        candidate.link.sharedReference = true;
        warnings.push(`${card.id} has a shared link reference; link edits are blocked to preserve other uses. Give the wrapper its own reference label first.`);
      }
      if (candidate.definition) {
        card.uses = candidate.definition.uses.length;
        if (candidate.definition.linkUses) {
          urlEditWarning = `${card.id} shares reference [${candidate.definition.label}] with an ordinary link; URL edits are blocked. Give the image its own reference label in the source editor first.`;
          warnings.push(urlEditWarning);
        } else if (card.uses > 1) warnings.push(`${card.id} uses a shared reference definition (${card.uses} images); editing its URL updates all of them.`);
      }
      internals.set(card.id, { ...candidate, decoded, card, urlEditWarning });
      cards.push(card);
    }
    return { source, cards, warnings, internals };
  }

  function scan(source, options = {}) {
    const { cards, warnings } = inspect(source, options);
    return { source, cards, warnings };
  }

  function queryUpdate(internal, desired) {
    const { card, decoded } = internal;
    const changed = new Set([...Object.keys(card.params), ...Object.keys(desired)].filter((key) => has(card.params, key) !== has(desired, key) || card.params[key] !== desired[key]));
    if (!changed.size) return card.raw;
    const hash = decoded.value.indexOf("#");
    const boundary = hash < 0 ? decoded.value.length : hash;
    const question = decoded.value.indexOf("?");
    const hasQuery = question >= 0 && question < boundary;
    const start = hasQuery ? question + 1 : boundary;
    const query = hasQuery ? decoded.value.slice(start, boundary) : "";
    const tokens = [];
    let index = 0;
    let separator = "";
    let joiner = card.syntax === "html" && /&(?:amp|#0*38|#x0*26);/i.test(card.raw) ? "&amp;" : "&";
    for (const token of query.split("&")) {
      const rawStart = decoded.map[start + index];
      const rawEnd = decoded.map[start + index + token.length];
      const key = new URLSearchParams(token).keys().next().value;
      let raw = card.raw.slice(rawStart, rawEnd);
      if (changed.has(key) && has(desired, key)) {
        const equals = token.indexOf("=");
        raw = equals < 0 ? `${raw}=${encode(desired[key])}` : `${card.raw.slice(rawStart, decoded.map[start + index + equals + 1])}${encode(desired[key])}`;
      }
      if (!changed.has(key) || has(desired, key)) tokens.push({ raw, separator });
      index += token.length;
      if (index < query.length) {
        separator = card.raw.slice(decoded.map[start + index], decoded.map[start + index + 1]);
        joiner = separator; index++;
      }
    }
    if (!hasQuery || !query) tokens.length = 0;
    for (const key of Object.keys(desired)) if (!has(card.params, key)) tokens.push({ raw: `${encode(key)}=${encode(desired[key])}`, separator: joiner });
    const newQuery = tokens.map((token, index) => (index ? token.separator || joiner : "") + token.raw).join("");
    const prefix = card.raw.slice(0, decoded.map[hasQuery ? question : boundary]);
    const suffix = card.raw.slice(decoded.map[boundary]);
    return `${prefix}${newQuery ? `?${newQuery}` : ""}${suffix}`;
  }

  function safeLink(value) {
    text(value, 4096, "Link URL");
    let parsed;
    try { parsed = new URL(value); } catch { error("Link must be an absolute HTTP(S) or mailto URL"); }
    if (!["https:", "http:", "mailto:"].includes(parsed.protocol) || parsed.username || parsed.password || /[\s<>"']/.test(value)) error("Link URL is unsafe");
    return value;
  }

  function patchSource(source, patches) {
    const unique = new Map();
    for (const patch of patches) {
      const key = `${patch.start}:${patch.end}`;
      if (unique.has(key) && unique.get(key).value !== patch.value) error("Conflicting edits to a shared image or link; edit the shared reference once");
      unique.set(key, patch);
    }
    const ordered = [...unique.values()].sort((a, b) => b.start - a.start || b.end - a.end);
    let boundary = source.length;
    let result = source;
    for (const patch of ordered) {
      if (patch.end > boundary) error("Overlapping image edits are not supported");
      result = result.slice(0, patch.start) + patch.value + result.slice(patch.end);
      boundary = patch.start;
    }
    sourceText(result);
    return result;
  }

  function applyUpdates(source, updates, options = {}) {
    if (!Array.isArray(updates) || updates.length > LIMITS.MAX_CARDS) error("Updates must be an array of at most 250 card edits");
    const parsed = inspect(source, options);
    const patches = [];
    const insertions = new Map();
    const seen = new Set();
    for (const update of updates) {
      record(update, "Update");
      if (Object.keys(update).some((key) => !["id", "params", "url", "assetPath", "alt", "width", "linkUrl"].includes(key))) error("Unsupported update field");
      const internal = parsed.internals.get(update.id);
      if (!internal || seen.has(update.id)) error("Update contains an unknown or repeated card ID");
      seen.add(update.id);
      const { card } = internal;
      if (has(update, "assetPath")) {
        if (has(update, "url") || has(update, "params")) error("Asset path cannot be combined with URL or parameter updates");
        const path = assetPath(update.assetPath);
        if (!has(normalizeAssetDesigns(options.assetDesigns), path)) error("Asset design must be registered before changing its path");
        if (path !== internal.decoded.value) {
          if (internal.urlEditWarning) error(internal.urlEditWarning);
          patches.push({ start: card.start, end: card.end, value: path });
        }
      }
      if (has(update, "url")) {
        if (has(update, "params")) error("URL and parameter updates cannot be combined");
        const url = text(update.url, LIMITS.MAX_URL_LENGTH, "Image URL");
        if (/\s/.test(url)) error("Replacement must be a safe ProfileKit image URL without whitespace");
        const eligible = scan(`<img src="${html(url)}">`, options);
        if (eligible.cards.length !== 1 || eligible.warnings.length || (eligible.cards[0].assetPath && eligible.cards[0].url !== card.url)) error("Replacement must be a safe ProfileKit image URL");
        if (url !== internal.decoded.value && eligible.cards[0].url !== card.url) {
          if (internal.urlEditWarning) error(internal.urlEditWarning);
          const value = card.syntax === "html" ? html(url) : url.replace(/[()<>\\]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
          patches.push({ start: card.start, end: card.end, value });
        }
      }
      if (has(update, "params")) {
        if (card.assetPath) error("Download a replacement SVG in the creator to edit a saved asset");
        const value = queryUpdate(internal, paramsRecord(update.params, card.endpoint));
        if (card.endpoint === "design" && decode(value, card.syntax).value.length > Design.MAX_DESIGN_URL_LENGTH) error("Updated design URL is too large");
        if (value.length > LIMITS.MAX_URL_LENGTH) error("Updated image URL is too large");
        if (value !== card.raw) {
          if (internal.urlEditWarning) error(internal.urlEditWarning);
          patches.push({ start: card.start, end: card.end, value });
        }
      }
      for (const name of ["alt", "width"]) {
        if (!has(update, name)) continue;
        if (update[name] !== null && typeof update[name] !== "string" && !(name === "width" && typeof update[name] === "number" && Number.isFinite(update[name]))) error(`${name} must be text`);
        const value = update[name] === null ? null : text(String(update[name]), 2048, name);
        if (value !== null && /[\r\n]/.test(value)) error(`${name} must fit on one line`);
        if (name === "width" && value !== null && value !== "" && (!/^(?:[1-9]\d{0,3}|(?:100|[1-9]\d?)(?:\.\d+)?%)$/.test(value) || (value.endsWith("%") && parseFloat(value) > 100))) error("Width must be a positive number or percentage up to 100%");
        if ((value ?? "") === card[name]) continue;
        if (card.syntax === "markdown") {
          if (name === "width") error("Markdown image widths must be edited in the source layout");
          patches.push({ ...internal.altSpan, value: (value || "").replace(/\\/g, "\\\\").replace(/[\[\]]/g, "\\$&").replace(/</g, "&lt;").replace(/>/g, "&gt;") });
          continue;
        }
        const node = internal.metadataNode || internal.node;
        const attr = node.attrs[name];
        if (attr) patches.push(value === null || (name === "width" && value === "")
          ? { start: attr.fullStart, end: attr.fullEnd, value: "" }
          : { start: attr.start, end: attr.end, value: attr.quote ? html(value) : `"${html(value)}"` });
        else if (value !== null && value !== "") {
          const fields = insertions.get(node.insert) || new Map();
          if (fields.has(name) && fields.get(name) !== value) error("Conflicting edits to shared image metadata");
          fields.set(name, value); insertions.set(node.insert, fields);
        }
      }
      if (has(update, "linkUrl") && update.linkUrl !== card.linkUrl) {
        if (!internal.link || update.linkUrl === null || update.linkUrl === "") error("Add or remove image link wrappers in the source editor");
        if (internal.link.sharedReference) error("Cannot edit a shared link reference; give the image wrapper its own reference label");
        const link = safeLink(update.linkUrl);
        const oldRaw = source.slice(internal.link.start, internal.link.end);
        const old = decode(oldRaw, card.syntax);
        let first = 0;
        let last = 0;
        while (first < old.value.length && first < link.length && old.value[first] === link[first]) first++;
        while (last < old.value.length - first && last < link.length - first && old.value[old.value.length - 1 - last] === link[link.length - 1 - last]) last++;
        const middle = link.slice(first, link.length - last);
        const encoded = card.syntax === "html" ? html(middle) : middle.replace(/[()]/g, (char) => `\\${char}`);
        let value = oldRaw.slice(0, old.map[first]) + encoded + oldRaw.slice(old.map[old.value.length - last]);
        if (card.syntax === "html" && !internal.link.quote) value = `"${html(link)}"`;
        patches.push({ start: internal.link.start, end: internal.link.end, value });
      }
    }
    for (const [offset, fields] of insertions) patches.push({ start: offset, end: offset, value: [...fields].map(([name, value]) => ` ${name}="${html(value)}"`).join("") });
    return patchSource(source, patches);
  }

  function account(value, label) {
    if (typeof value !== "string" || !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value)) error(`${label} must be a GitHub username`);
    return value;
  }

  function batchUpdate(source, operation, options = {}) {
    record(operation, "Batch operation");
    const allowed = ["fromAccount", "toAccount", "theme", "darkTheme", "lightTheme", "font", "accentColor", "resetColors", "ids", "includeRepositories"];
    if (Object.keys(operation).some((key) => !allowed.includes(key))) error("Unsupported batch option");
    for (const name of ["theme", "darkTheme", "lightTheme"]) if (has(operation, name) && operation[name] !== "" && !schema.THEMES.includes(operation[name])) error(`Unsupported ${name}`);
    if (has(operation, "font") && !FONTS.includes(operation.font)) error("Unsupported font");
    if (has(operation, "accentColor") && !/^#?(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(operation.accentColor)) error("Accent color must be a hex color");
    for (const key of ["resetColors", "includeRepositories"]) if (has(operation, key) && typeof operation[key] !== "boolean") error(`${key} must be a boolean`);
    const changingAccount = has(operation, "toAccount") && operation.toAccount !== "";
    if (changingAccount) { account(operation.toAccount, "New account"); if (operation.fromAccount) account(operation.fromAccount, "Current account"); }
    const parsed = inspect(source, options);
    let selected = null;
    if (has(operation, "ids")) {
      if (!Array.isArray(operation.ids) || operation.ids.some((id) => !parsed.internals.has(id))) error("Selection contains an unknown card ID");
      selected = new Set(operation.ids);
    }
    const warnings = [...parsed.warnings];
    const changes = [];
    const updates = [];
    const matches = (value) => typeof value === "string" && (operation.fromAccount ? value.toLowerCase() === operation.fromAccount.toLowerCase() : /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value));
    for (const card of parsed.cards) {
      if (selected && !selected.has(card.id)) continue;
      if (card.assetPath) { warnings.push("Saved SVG assets require editing in the creator and downloading a replacement SVG: " + card.assetPath); continue; }
      if (card.endpoint === "design") {
        if (parsed.internals.get(card.id).urlEditWarning) continue;
        const doc = card.design;
        let linkUrl = card.linkUrl;
        const internal = parsed.internals.get(card.id);
        const sharedOuter = internal.link && parsed.cards.some((other) => other.id !== card.id && parsed.internals.get(other.id).link?.start === internal.link.start);
        const nestedOperation = { ...operation };
        delete nestedOperation.ids;
        nestedOperation.theme = card.variant === "dark" ? operation.darkTheme || operation.theme : card.variant === "light" ? operation.lightTheme || operation.theme : operation.theme;
        if (nestedOperation.theme === undefined) delete nestedOperation.theme;
        // Reuse ordinary account/style and paired-repository rules on each live
        // element. Copy only changed params/links back into the normalized design.
        const only = doc.elements.filter((item) => item.type === "card").length === 1;
        const elements = doc.elements.map((element) => {
          if (element.type !== "card") return element;
          const pairedLink = element.linkUrl || (only ? card.linkUrl : undefined);
          const outerConflict = card.linkUrl && (internal.link?.sharedReference || !only || (element.linkUrl && element.linkUrl !== card.linkUrl) || sharedOuter || (card.uses || 1) !== 1);
          const localOperation = outerConflict ? { ...nestedOperation, includeRepositories: false } : nestedOperation;
          const query = new URLSearchParams(element.params).toString();
          const img = `<img src="${html(`${DEFAULT_ORIGIN}/api/${element.endpoint}?${query}`)}">`;
          const nestedSource = pairedLink ? `<a href="${html(pairedLink)}">${img}</a>` : img;
          const result = batchUpdate(nestedSource, localOperation);
          warnings.push(...result.warnings.map((warning) => `${card.id}/${element.id}: ${warning}`));
          if (!result.changedCards) return element;
          const next = scan(result.source).cards[0];
          const changed = { ...element, params: { ...next.params } };
          if (element.linkUrl !== undefined) changed.linkUrl = next.linkUrl;
          if (only && card.linkUrl && next.linkUrl !== pairedLink) linkUrl = next.linkUrl;
          return changed;
        });
        if (elements.every((element, index) => element === doc.elements[index])) continue;
        const params = { d: Design.encodeDocument({ ...doc, elements }) };
        const update = { id: card.id, params };
        if (linkUrl !== card.linkUrl) update.linkUrl = linkUrl;
        updates.push(update);
        changes.push({ id: card.id, endpoint: card.endpoint, variant: card.variant, keys: ["d", ...(linkUrl !== card.linkUrl ? ["linkUrl"] : [])], before: { d: card.params.d, linkUrl: card.linkUrl }, after: { d: params.d, linkUrl } });
        continue;
      }
      const params = { ...card.params };
      const update = { id: card.id, params };
      const stack = card.endpoint === "stack";
      const stackNames = new Set((params.cards || "hero,section,divider,now").split(",").map((name) => name.trim()).filter((name) => STACK_CARDS.has(name)));
      if (changingAccount) {
        const keys = GITHUB_CARDS.has(card.endpoint) ? ["username"] : card.endpoint === "social" ? ["github"] : [];
        if (stack) {
          if ([...stackNames].some((name) => GITHUB_CARDS.has(name))) keys.push("username");
          for (const name of stackNames) if (GITHUB_CARDS.has(name)) keys.push(`${name}.username`);
        }
        if (card.endpoint === "pin" && matches(params.username)) {
          let paired = null;
          try { paired = new URL(card.linkUrl); } catch { /* The original owner stays unchanged without a paired repository link. */ }
          const exactPair = paired && paired.origin === "https://github.com" && paired.pathname.replace(/\/$/, "").toLowerCase() === `/${params.username}/${params.repo}`.toLowerCase() && !paired.username && !paired.password;
          const internal = parsed.internals.get(card.id);
          const sharedLink = internal.link && parsed.cards.filter((other) => {
            const otherLink = parsed.internals.get(other.id).link;
            return otherLink && otherLink.start === internal.link.start && otherLink.end === internal.link.end;
          });
          const safeGroup = !internal.link?.sharedReference && sharedLink && sharedLink.every((other) => (!selected || selected.has(other.id)) && other.endpoint === "pin"
            && other.params.username?.toLowerCase() === params.username.toLowerCase() && other.params.repo?.toLowerCase() === params.repo?.toLowerCase()
            && (other.uses || 1) === 1);
          if (operation.includeRepositories && exactPair && safeGroup && (card.uses || 1) === 1) {
            keys.push("username");
            // URL parsing confirms the destination; change just its owner segment.
            update.linkUrl = card.linkUrl.replace(/^(https:\/\/github\.com\/)[^/]+/i, `$1${operation.toAccount}`);
          } else warnings.push(`${card.id}: repository owner ${params.username}/${params.repo || ""} was preserved${operation.includeRepositories ? " because its repository link could not be updated consistently with every shared image" : " (repository cards are excluded from account replacement)"}.`);
        }
        for (const key of keys) if (matches(params[key])) params[key] = operation.toAccount;
      }
      const theme = card.variant === "dark" ? operation.darkTheme || operation.theme : card.variant === "light" ? operation.lightTheme || operation.theme : operation.theme;
      const fieldNames = new Set(schema.CARDS[card.endpoint]?.params.map((param) => param.name) || ["theme", "font"]);
      const setStyle = (name, value) => {
        if (value === undefined || !fieldNames.has(name)) return;
        if (value === "") delete params[name]; else params[name] = value;
        if (stack) for (const child of stackNames) {
          const key = `${child}.${name}`;
          if (has(params, key) && schema.CARDS[child].params.some((param) => param.name === name)) {
            if (value === "") delete params[key]; else params[key] = value;
          }
        }
      };
      if (theme) setStyle("theme", theme);
      setStyle("font", operation.font);
      if (operation.resetColors) for (const key of Object.keys(params)) {
        const parts = key.split(".");
        if (COLORS.has(key) || (stack && parts.length === 2 && stackNames.has(parts[0]) && COLORS.has(parts[1]))) delete params[key];
      }
      // accent_color is accepted by the shared options resolver on all card
      // endpoints, including effects whose separate `color` stays untouched.
      if (has(operation, "accentColor")) {
        params.accent_color = operation.accentColor.replace(/^#/, "");
        if (stack) for (const child of stackNames) if (has(params, `${child}.accent_color`)) params[`${child}.accent_color`] = params.accent_color;
      }
      const changedKeys = [...new Set([...Object.keys(card.params), ...Object.keys(params)])].filter((key) => has(card.params, key) !== has(params, key) || card.params[key] !== params[key]);
      if (update.linkUrl && update.linkUrl !== card.linkUrl) changedKeys.push("linkUrl");
      if (!changedKeys.length) continue;
      if (parsed.internals.get(card.id).urlEditWarning) continue;
      const before = Object.create(null);
      const after = Object.create(null);
      for (const key of changedKeys) { before[key] = key === "linkUrl" ? card.linkUrl : card.params[key] ?? null; after[key] = key === "linkUrl" ? update.linkUrl : params[key] ?? null; }
      changes.push({ id: card.id, endpoint: card.endpoint, variant: card.variant, keys: changedKeys, before, after });
      updates.push(update);
    }
    return { source: applyUpdates(source, updates, options), changedCards: changes.length, changes, warnings };
  }

  return { DEFAULT_ORIGIN, LIMITS, normalizeAssetDesigns, normalizeAssetPath: assetPath, scan, applyUpdates, batchUpdate };
});
