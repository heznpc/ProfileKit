const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { deflateSync } = require("node:zlib");
const model = require("../public/editor-model");

// Actual 2 × 3 pixel raster images, encoded without relying on a browser or a
// third-party image package at test time.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFElEQVR4nGN8WObCwMDAxAAGUAoAH3IBoeysng8AAAAASUVORK5CYII=";
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAADAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDQooor5k+0P//Z";
const WEBP = "data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAADQAQCdASoCAAMAAUAmJaACdLoB+AADsAD+4ka/82BXNc+/3/6gz5aHy0P1uAAA";

function documentWith(...elements) {
  return model.createDocument({ elements });
}

function pngChunk(type, data) {
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length);
  chunk.write(type, 4);
  data.copy(chunk, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, chunk.length - 4);
  return chunk;
}

function pngWithComment(byteLength) {
  const png = Buffer.from(PNG.split(",")[1], "base64");
  const data = Buffer.alloc(byteLength - png.length - 12, "a");
  data.write("Note\0");
  const chunk = pngChunk("tEXt", data);
  return "data:image/png;base64," + Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]).toString("base64");
}

test("new documents and elements have independent, complete defaults", () => {
  const first = model.createDocument();
  const second = model.createDocument();
  assert.deepEqual(first, { kind: "profilekit-card", version: 1, name: "Untitled card", width: 960, height: 540, background: "#f4f0e8", elements: [] });
  first.elements.push(model.createElement("text"));
  assert.equal(second.elements.length, 0);
  assert.notEqual(model.createElement("rect").id, model.createElement("rect").id);
  assert.match(model.createElement("rect", { id: undefined }).id, /^el-/);
  assert.equal(model.createElement("ellipse").type, "ellipse");
  assert.throws(() => model.createElement("image"), /embedded/);
});

test("IDs remain unique when a saved draft is reopened without randomUUID", () => {
  const source = fs.readFileSync(require.resolve("../public/editor-model"), "utf8");
  function browserSession(seed, withCrypto) {
    const sandbox = { TextEncoder, atob, btoa };
    if (withCrypto) sandbox.crypto = { getRandomValues(values) { values.fill(seed); return values; } };
    vm.createContext(sandbox);
    // The no-crypto fallback must work across reloads in the same millisecond.
    vm.runInContext(`Date.now = () => 123456789; Math.random = () => ${seed / 256};`, sandbox);
    vm.runInContext(source, sandbox);
    return sandbox;
  }
  for (const withCrypto of [true, false]) {
    const first = browserSession(17, withCrypto);
    const saved = vm.runInContext(`
      const doc = ProfileKitEditorModel.createDocument();
      doc.elements.push(ProfileKitEditorModel.createElement("rect"));
      doc.elements.push(ProfileKitEditorModel.createElement("text"));
      ProfileKitEditorModel.serializeDocument(doc);
    `, first);
    const second = browserSession(93, withCrypto);
    second.saved = saved;
    const reopened = vm.runInContext(`
      const doc = ProfileKitEditorModel.parseDocument(saved);
      doc.elements.push(ProfileKitEditorModel.createElement("ellipse"));
      ProfileKitEditorModel.serializeDocument(doc);
    `, second);
    const ids = JSON.parse(reopened).elements.map((element) => element.id);
    assert.equal(new Set(ids).size, 3);
    assert.doesNotThrow(() => model.parseDocument(reopened));
  }
});

test("portable files preserve embedded image bytes, Unicode, layers and geometry", () => {
  const doc = model.createDocument({ name: "렌의 카드 👩‍💻", background: "transparent", elements: [
    model.createElement("rect", { id: "paper", x: -20, y: 30.125, width: 920, height: 460, fill: "#ABC", opacity: 0.75, rotation: -12 }),
    model.createElement("image", { id: "photo", src: PNG, x: 500, y: 100, width: 200, height: 300, fit: "contain", rotation: 24 }),
    model.createElement("text", { id: "heading", text: "안녕하세요\n日本語 & café 👩‍💻", fontFamily: "serif", fontSize: 40, align: "right" }),
    model.createElement("ellipse", { id: "dot", fill: "none", stroke: "#345678", strokeWidth: 4 }),
  ] });
  const saved = model.serializeDocument(doc);
  const restored = model.parseDocument(saved);
  assert.deepEqual(restored, doc);
  assert.equal(restored.elements[1].src, PNG);
  assert.equal(model.renderSVG(restored), model.renderSVG(doc));
  assert.equal(model.serializeDocument(restored), saved);
  restored.elements[0].x = 100;
  assert.equal(doc.elements[0].x, -20);
});

test("normalization clamps finite geometry without mutating the source", () => {
  const doc = documentWith(model.createElement("rect", { id: "bounds" }));
  doc.width = 99999;
  doc.height = -3;
  Object.assign(doc.elements[0], { x: -99999, y: 99999, width: 0, height: 99999, rotation: 900, opacity: -1, strokeWidth: 100, radius: 800 });
  const normalized = model.normalizeDocument(doc);
  assert.equal(normalized.width, 2048);
  assert.equal(normalized.height, 1);
  assert.deepEqual(normalized.elements[0], { id: "bounds", type: "rect", x: -4096, y: 4096, width: 1, height: 4096, rotation: 360, opacity: 0,
    fill: "#d55c3c", stroke: "none", strokeWidth: 64, radius: 0.5 });
  assert.equal(doc.elements[0].x, -99999);
  for (const invalid of [NaN, Infinity, -Infinity, "200", null, {}, []]) {
    assert.throws(() => model.normalizeDocument({ ...doc, width: invalid }), /finite number/);
  }
});

test("strict file structure rejects malformed state, unknown fields and duplicate IDs", () => {
  const valid = model.createDocument();
  for (const raw of [null, [], {}, { ...valid, kind: "svg" }, { ...valid, version: 2 }, { ...valid, extra: true },
    { ...valid, elements: "text" }, { ...valid, elements: [null] }, { ...valid, elements: [{ type: "script" }] },
    { ...valid, name: 42 }, { ...valid, elements: Array(65).fill(model.createElement("rect")) }]) {
    assert.throws(() => model.normalizeDocument(raw));
  }
  const element = model.createElement("text", { id: "duplicate" });
  assert.throws(() => documentWith(element, element), /unique/);
  assert.throws(() => documentWith({ ...element, id: 'x\" onclick=\"alert(1)' }), /ID/);
  assert.throws(() => documentWith({ ...element, onload: "alert(1)" }), /unsupported field/);
  assert.throws(() => model.parseDocument('{"__proto__":{}}'), /unsupported field/);
  assert.throws(() => model.parseDocument("not JSON"), /valid JSON/);
  assert.throws(() => model.parseDocument(valid), /JSON text/);
});

test("text and attributes cannot inject markup, CSS or external resources", () => {
  const text = `<script>alert('x')</script> & \" onclick=\"evil()`;
  const doc = model.createDocument({ name: '\"/><script>bad</script>', elements: [
    model.createElement("text", { id: "hostile", text, width: 2048, height: 300, fontSize: 20 }),
  ] });
  const svg = model.renderSVG(doc, { interactive: true });
  assert.doesNotMatch(svg, /<script>|<foreignObject|<style|\sonclick="|\sonload="/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /&amp;/);
  assert.match(svg, /&quot;/);
  for (const value of ['red;stroke:url(https://evil.test)', 'url(https://evil.test)', '#fff\" onload=\"evil()', 'red']) {
    assert.throws(() => model.createDocument({ background: value }), /hex color/);
    assert.throws(() => model.createElement("text", { color: value }), /hex color/);
  }
  for (const overrides of [{ fontFamily: 'serif\" onload=\"evil()' }, { align: "justify" }, { fontWeight: "700" }, { text: "a\0b" }, { text: "\ud800" }]) {
    assert.throws(() => model.createElement("text", overrides));
  }
});

test("only actual raster signatures are accepted for embedded image sources", () => {
  for (const src of [PNG, JPEG, WEBP]) {
    const image = model.createElement("image", { id: "raster", src });
    assert.equal(model.parseDocument(model.serializeDocument(documentWith(image))).elements[0].src, src);
    assert.ok(model.renderSVG(documentWith(image)).includes(`href="${src}"`));
  }
  const svgPayload = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>').toString("base64");
  for (const src of ["https://example.com/image.png", "blob:https://example.com/id", "javascript:alert(1)", "data:image/svg+xml;base64," + svgPayload,
    "data:image/png;base64," + svgPayload, "data:image/jpeg;base64," + svgPayload, "data:image/webp;base64," + svgPayload,
    PNG.replace("image/png", "image/jpeg"), "data:image/png;base64,@@@@", "data:image/png;base64,AAAAA"]) {
    assert.throws(() => model.createElement("image", { src }), undefined, src.slice(0, 60));
  }
});

test("image byte and decoded pixel limits reject oversized sources", () => {
  const tooLarge = "data:image/png;base64," + Buffer.alloc(model.LIMITS.MAX_IMAGE_BYTES + 1).toString("base64");
  assert.throws(() => model.createElement("image", { src: tooLarge }), /3 MiB/);
  const oversizedDimensions = Buffer.from(PNG.split(",")[1], "base64");
  oversizedDimensions.writeUInt32BE(10000, 16);
  oversizedDimensions.writeUInt32BE(10000, 20);
  assert.throws(() => model.createElement("image", { src: "data:image/png;base64," + oversizedDimensions.toString("base64") }), /megapixel/);
});

test("image preflight validates raster headers and pixel limits before browser decoding", () => {
  for (const src of [PNG, JPEG, WEBP]) {
    const mime = src.slice(5, src.indexOf(";"));
    const bytes = Buffer.from(src.split(",")[1], "base64");
    assert.deepEqual(model.imageInfo(bytes, mime), { width: 2, height: 3 });
    assert.throws(() => model.imageInfo(bytes.subarray(0, 20), mime));
  }
  const png = Buffer.from(PNG.split(",")[1], "base64");
  const invalidHeader = Buffer.from(png);
  invalidHeader[25] = 5;
  assert.throws(() => model.imageInfo(invalidHeader, "image/png"), /header/);
  const hugePng = Buffer.from(png);
  hugePng.writeUInt32BE(10000, 16);
  hugePng.writeUInt32BE(10000, 20);
  assert.throws(() => model.imageInfo(hugePng, "image/png"), /megapixel/);
  const jpeg = Buffer.from(JPEG.split(",")[1], "base64");
  const frame = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
  assert.ok(frame >= 0);
  const hugeJpeg = Buffer.from(jpeg);
  hugeJpeg.writeUInt16BE(10000, frame + 5);
  hugeJpeg.writeUInt16BE(10000, frame + 7);
  assert.throws(() => model.imageInfo(hugeJpeg, "image/jpeg"), /megapixel/);
  jpeg[frame + 9] = 0;
  assert.throws(() => model.imageInfo(jpeg, "image/jpeg"), /dimensions/);
  const webp = Buffer.from(WEBP.split(",")[1], "base64");
  webp.writeUInt16LE(10000, 26);
  webp.writeUInt16LE(10000, 28);
  assert.throws(() => model.imageInfo(webp, "image/webp"), /megapixel/);
  assert.throws(() => model.imageInfo(png, "image/jpeg"), /JPEG/);
  assert.throws(() => model.imageInfo(png, "image/svg+xml"), /MIME/);
  assert.throws(() => model.imageInfo(png.buffer, "image/png"), /Uint8Array/);
  assert.throws(() => model.imageInfo(new Uint16Array(10), "image/png"), /Uint8Array/);
  assert.throws(() => model.imageInfo(Buffer.from("<svg/>"), "image/png"), /PNG/);
});

test("image preflight accepts large source uploads while preserving the embedded byte limit", () => {
  const src = pngWithComment(model.LIMITS.MAX_IMAGE_BYTES + 64);
  const bytes = Buffer.from(src.split(",")[1], "base64");
  assert.deepEqual(model.imageInfo(bytes, "image/png"), { width: 2, height: 3 });
  assert.throws(() => model.createElement("image", { src }), /3 MiB/);
  const tooLarge = Buffer.alloc(model.LIMITS.MAX_IMPORT_IMAGE_BYTES + 1);
  assert.throws(() => model.imageInfo(tooLarge, "image/png"), /12 MiB import/);
});

test("total image pixels are bounded even when solid PNGs compress to small files", () => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(4096, 0);
  header.writeUInt32BE(4096, 4);
  header[8] = 8;
  header[9] = 2;
  const compressed = deflateSync(Buffer.alloc((4096 * 3 + 1) * 4096));
  const source = (name) => "data:image/png;base64," + Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"), pngChunk("IHDR", header),
    pngChunk("tEXt", Buffer.from(`Name\0${name}`)), pngChunk("IDAT", compressed), pngChunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
  const images = ["first", "second", "third"].map((name) => model.createElement("image", { id: name, src: source(name) }));
  assert.doesNotThrow(() => documentWith(...images.slice(0, 2)));
  const tooManyPixels = { ...model.createDocument(), elements: images };
  assert.ok(Buffer.byteLength(JSON.stringify(tooManyPixels)) < model.LIMITS.MAX_FILE_BYTES);
  assert.throws(() => model.normalizeDocument(tooManyPixels), /32 megapixel total/);
  assert.throws(() => model.parseDocument(JSON.stringify(tooManyPixels)), /32 megapixel total/);
  assert.doesNotThrow(() => documentWith(...Array.from({ length: 64 }, (_, index) => ({ ...images[0], id: `copy-${index}` }))));
});

test("the 8 MiB limit agrees for UTF-8 files, normalization and serialization", () => {
  const src = pngWithComment(1024 * 1024);
  const images = Array.from({ length: 5 }, (_, index) => model.createElement("image", { id: `image-${index}`, src }));
  const below = documentWith(...images);
  const saved = model.serializeDocument(below);
  assert.ok(Buffer.byteLength(saved) < model.LIMITS.MAX_FILE_BYTES);
  assert.deepEqual(model.parseDocument(saved), below);
  const texts = Array.from({ length: 15 }, (_, index) => model.createElement("text", { id: `text-${index}`, text: "한".repeat(32768) }));
  const oversized = { ...below, elements: [...images, ...texts] };
  const raw = JSON.stringify(oversized);
  assert.ok(raw.length < model.LIMITS.MAX_FILE_BYTES, "character count alone would accept this file");
  assert.ok(Buffer.byteLength(raw) > model.LIMITS.MAX_FILE_BYTES);
  assert.throws(() => model.normalizeDocument(oversized), /8 MiB/);
  assert.throws(() => model.serializeDocument(oversized), /8 MiB/);
  assert.throws(() => model.parseDocument(raw), /8 MiB/);
});

test("preview and export use the same geometry, clipping and rotated centers", () => {
  const doc = documentWith(
    model.createElement("image", { id: "photo", src: PNG, x: -20, y: 10, width: 120, height: 80, rotation: 35, fit: "cover" }),
    model.createElement("text", { id: "copy", text: "Heading", width: 250, height: 80, fontSize: 32, align: "center" }),
    model.createElement("ellipse", { id: "circle", x: 10, y: 10, width: 80, height: 40 }),
  );
  const exported = model.renderSVG(doc);
  const interactive = model.renderSVG(doc, { interactive: true });
  assert.equal(interactive.replace(/ data-element-id="[^"]+"/g, "").replace(/<rect [^>]* fill="transparent" pointer-events="all"\/>/g, ""), exported);
  assert.match(exported, /transform="rotate\(35 40 50\)"/);
  assert.match(exported, /preserveAspectRatio="xMidYMid slice"/);
  assert.match(exported, /clip-path="url\(#pk-clip-0-photo\)"/);
  assert.match(exported, /text-anchor="middle"/);
  assert.match(exported, /<ellipse cx="50" cy="30" rx="40" ry="20"/);
  assert.match(exported, /overflow="hidden"/);
  assert.doesNotMatch(exported, /data-element-id|pointer-events|foreignObject/);
  const contained = documentWith(model.createElement("image", { src: PNG, fit: "contain" }));
  assert.match(model.renderSVG(contained), /preserveAspectRatio="xMidYMid meet"/);
});

test("text layout wraps words and Unicode clusters deterministically within its box", () => {
  const element = model.createElement("text", { id: "multiline", text: "Hello world hello\n👩‍💻 é 🇰🇷\n한글", fontSize: 20, width: 100, height: 144 });
  const layout = model.textLayout(element);
  assert.deepEqual(layout.lines, ["Hello", "world", "hello", "👩‍💻 é 🇰🇷", "한글"]);
  assert.equal(layout.overflow, false);
  assert.equal(model.renderSVG(documentWith(element)), model.renderSVG(documentWith(element)));
  const short = { ...element, height: 48 };
  assert.deepEqual(model.textLayout(short).lines, ["Hello", "world"]);
  assert.equal(model.textLayout(short).overflow, true);
  assert.equal((model.renderSVG(documentWith(short)).match(/<tspan /g) || []).length, 2);
  assert.match(model.renderSVG(documentWith(short)), /<rect x="80" y="80" width="100" height="48"/);
  assert.equal(model.textLayout({ ...element, text: "WW", width: 1 }).overflow, true);
  assert.deepEqual(model.textLayout({ ...element, height: 1 }).lines, []);
  assert.equal(model.textLayout({ ...element, text: "", height: 1 }).overflow, false);
  assert.throws(() => model.textLayout(model.createElement("rect")), /text element/);
});

test("the browser UMD build renders the same SVG as the Node export", () => {
  const sandbox = { TextEncoder, atob, btoa };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require.resolve("../public/editor-model"), "utf8"), sandbox);
  const json = model.serializeDocument(documentWith(model.createElement("text", { id: "portable", text: "렌 & Ren", fontFamily: "mono" })));
  sandbox.json = json;
  const rendered = vm.runInContext("ProfileKitEditorModel.renderSVG(ProfileKitEditorModel.parseDocument(json))", sandbox);
  assert.equal(rendered, model.renderSVG(model.parseDocument(json)));
});

test("live card layers preserve all string parameters and use escaped image URLs in previews", () => {
  const card = model.createElement("card", { id: "live", endpoint: "hero", x: 12, y: 20, width: 300, height: 100,
    params: { name: '<script>"&', custom: "", hide_border: "false", border_radius: "0", "hero.theme_url": "https://gist.githubusercontent.com/test/theme" } });
  const doc = documentWith(card);
  assert.deepEqual(model.parseDocument(model.serializeDocument(doc)), doc);
  const svg = model.renderSVG(doc);
  assert.match(svg, /<image x="12" y="20" width="300" height="100" href="\/api\/hero\?name=%3Cscript%3E%22%26&amp;custom=&amp;hide_border=false&amp;border_radius=0/);
  assert.match(svg, /preserveAspectRatio="none"/);
  assert.doesNotMatch(svg, /<script/);
  assert.match(model.renderSVG(documentWith({ ...card, sourceOrigin: "https://profilekit.vercel.app" })), /href="https:\/\/profilekit\.vercel\.app\/api\/hero/);
});

test("card input limits reject raw markup, prototype keys, secrets and excess endpoint fanout", () => {
  for (const endpoint of ["design", "health", "../stats", "https://example.com"]) {
    assert.throws(() => model.createElement("card", { endpoint }), /endpoint/);
  }
  for (const key of ["constructor", "__proto__", "hero.prototype", "hero.__defineGetter__", "access_token", "apiKey"]) {
    assert.throws(() => model.createElement("card", { params: JSON.parse(`{"${key}":"value"}`) }), /parameter/i);
  }
  assert.throws(() => model.createElement("card", { params: { width: 200 } }), /must be text/);
  assert.throws(() => model.createElement("card", { params: { content: "a".repeat(model.LIMITS.MAX_CARD_PARAM_LENGTH + 1) } }), /at most/);
  assert.throws(() => model.createElement("card", { markup: "<svg/>" }), /unsupported field/);
  assert.throws(() => documentWith(...Array.from({ length: 9 }, (_, i) => model.createElement("card", { id: `card-${i}` }))), /at most 8/);
  const stack = model.createElement("card", { endpoint: "stack", params: { cards: "hero,section,now" } });
  assert.equal(model.cardCallCount(stack), 3);
  assert.doesNotThrow(() => documentWith(stack, ...Array.from({ length: 4 }, (_, i) => model.createElement("card", { id: `card-${i}` }))));
  assert.throws(() => model.createElement("card", { endpoint: "stack", params: { cards: "hero,stack" } }), /recursive/);
  assert.throws(() => model.createElement("card", { endpoint: "stack", params: { cards: Array(9).fill("hero").join(",") } }), /at most 8/);
});

test("live card native dimensions and README metadata survive portable documents", () => {
  const card = model.createElement("card", { id: "live", nativeWidth: 1200, nativeHeight: 280,
    linkUrl: "https://example.com/profile?name=ren&from=readme", alt: 'Ren & <friends> "profile"', displayWidth: "49%" });
  const doc = documentWith(card);
  assert.deepEqual(model.parseDocument(model.serializeDocument(doc)), doc);
  const resized = model.normalizeDocument({ ...doc, elements: [{ ...card, width: 600, height: 600 }] }).elements[0];
  assert.equal(resized.nativeWidth, 1200);
  assert.equal(resized.nativeHeight, 280);
  assert.equal(model.normalizeCard({ endpoint: "hero", params: {}, displayWidth: "400.5" }).displayWidth, "400.5");
  assert.equal(model.normalizeCard({ endpoint: "hero", params: {}, alt: "" }).alt, "");
  assert.doesNotMatch(model.renderSVG(doc), /example\.com|<friends>/);
});

test("live card metadata rejects unsafe links, unbounded sizes and incomplete native geometry", () => {
  for (const metadata of [
    { nativeWidth: 1200 }, { nativeHeight: 280 }, { nativeWidth: 0, nativeHeight: 280 },
    { nativeWidth: 1200, nativeHeight: -1 }, { nativeWidth: Infinity, nativeHeight: 280 },
    { nativeWidth: 16385, nativeHeight: 280 }, { nativeWidth: "1200", nativeHeight: 280 },
  ]) assert.throws(() => model.createElement("card", metadata), /Native card dimensions/);
  for (const linkUrl of ["javascript:alert(1)", "data:text/html,bad", "/relative", "https://user:password@example.com", "https://example.com/" + "a".repeat(2048)]) {
    assert.throws(() => model.createElement("card", { linkUrl }), /Card link/);
  }
  for (const displayWidth of ["0", "-1", "0%", "101%", "16385", "100px", '49%" onload="bad', 400]) {
    assert.throws(() => model.createElement("card", { displayWidth }), /Card display width/);
  }
  assert.throws(() => model.createElement("card", { alt: "a".repeat(1025) }), /alternative text/);
});

test("trusted card markup is positioned and isolated without altering authored decorations", () => {
  const svg = '<svg width="400" height="100"><defs><linearGradient id="gradient"/></defs><style>@keyframes pulse{from{opacity:0}to{opacity:1}}.text{fill:red;animation:pulse 2s infinite}@media (prefers-reduced-motion:reduce){.text{animation:none}}</style><text class="text" fill="url(#gradient)">Card</text></svg>';
  const card = model.createElement("card", { id: "live", x: 30, y: 40, width: 500, height: 80, rotation: 20, opacity: 0.6 });
  const doc = documentWith(card, model.createElement("text", { id: "title", text: "Decoration" }));
  const rendered = model.renderSVG(doc, { cardMarkup: { live: svg } });
  assert.match(rendered, /<svg x="30" y="40" width="500" height="80" preserveAspectRatio="none" overflow="hidden" viewBox="0 0 400 100"/);
  assert.match(rendered, /transform="rotate\(20 280 80\)" opacity="0.6"/);
  assert.match(rendered, /id="pk-card-0-live-gradient"/);
  assert.match(rendered, /#pk-card-0-live-scope \.text\{fill:red;animation:pk-card-0-live-pulse/);
  assert.match(rendered, /@media[^}]+#pk-card-0-live-scope \.text/);
  assert.match(rendered, />Decoration<\/tspan>/);
  assert.doesNotMatch(rendered, /<image/);
});

test("thin live cards retain their actual canvas height", () => {
  const doc = model.createDocument({ width: 800, height: 1, background: "transparent",
    elements: [model.createElement("card", { endpoint: "divider", x: 0, y: 0, width: 800, height: 1, params: { height: "1" } })] });
  assert.equal(model.parseDocument(model.serializeDocument(doc)).height, 1);
});

test("unadorned document JSON and both SVG paths remain byte-identical to the legacy fixture", () => {
  const { createHash } = require("node:crypto");
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const doc = model.createDocument({ width: 600, height: 280, background: "transparent", name: "Legacy & layout", elements: [
    model.createElement("card", { id: "live", x: 0, y: 0, width: 600, height: 280, nativeWidth: 600, nativeHeight: 280, params: { name: "Ren", subtitle: "", hide_border: "false" } }),
    model.createElement("text", { id: "copy", text: "Legacy & text", rotation: 12 }),
    model.createElement("rect", { id: "box", opacity: 0.5 }),
  ] });
  assert.equal(digest(model.serializeDocument(doc)), "4f9cce484308bb4c3e8878ee2a751e71706c894b8ee054a6f4a0e313237429cf");
  assert.equal(digest(model.renderSVG(doc)), "8db903bf35fc7f99d5a3e614db67daa40635ad2948eb69219f6f86b60cba3f7e");
  assert.equal(digest(model.renderSVG(doc, { cardMarkup: { live: '<svg width="600" height="280"><text x="20" y="30" data-cas-target="name">Ren</text></svg>' } })), "04c59bb6f4acf1031be88b10fc00a03ba5f7e82c42bf9103e7a6e5b87ddb1b43");
});

test("parts and layer effects survive files with strict validation and no-op removal", () => {
  const effect = { kind: "glow", color: "#ABC", blur: 12, opacity: 0.6, dx: 4, dy: -3 };
  const doc = documentWith(model.createElement("card", { id: "live", parts: { name: { dx: 12, scale: 1.5, color: "#ABC" } }, effect }),
    model.createElement("text", { id: "copy", effect }));
  assert.deepEqual(model.parseDocument(model.serializeDocument(doc)), doc);
  assert.deepEqual(doc.elements[0].parts.name, { dx: 12, dy: 0, scale: 1.5, color: "#abc" });
  assert.equal(doc.elements[1].effect.color, "#abc");
  const plain = model.createElement("card", { id: "same" });
  assert.deepEqual(model.createElement("card", { id: "same", parts: { name: { dx: 0, dy: 0, scale: 1, hidden: false } }, effect: { ...effect, opacity: 0 } }), plain);
  for (const part of [{ dx: NaN }, { color: '" onload="bad' }, { scale: Infinity }, { css: "bad" }]) {
    assert.throws(() => model.createElement("card", { parts: { name: part } }));
  }
  assert.throws(() => model.createElement("card", { endpoint: "stats", parts: { name: { dx: 1 } } }));
  assert.throws(() => model.createElement("text", { parts: { name: { dx: 1 } } }));
  assert.throws(() => model.renderSVG(doc), /rendered card markup/);
});

test("layer effects have unique bounded filters and work with every existing layer type", () => {
  const effect = { kind: "shadow", color: "#123456", blur: 8, opacity: 0.7, dx: 6, dy: -4 };
  const elements = ["text", "rect", "ellipse", "image", "card"].map((type, index) => model.createElement(type, { id: `layer-${index}`, effect: index === 0 ? { ...effect, kind: "glow" } : effect, ...(type === "image" ? { src: PNG } : {}) }));
  const output = model.renderSVG(documentWith(...elements));
  const ids = Array.from(output.matchAll(/<filter id="([^"]+)"/g), (match) => match[1]);
  assert.equal(ids.length, elements.length);
  assert.equal(new Set(ids).size, elements.length);
  for (const id of ids) {
    assert.ok(output.includes(`filter="url(#${id})"`));
    assert.ok(output.includes(`in2="${id}-offset"`));
    assert.ok(output.includes(`<feOffset dx="6" dy="-4" result="${id}-offset"/>`));
  }
  assert.match(output, /filterUnits="userSpaceOnUse" x="49" y="49"/);
  assert.equal(model.renderSVG(documentWith(...elements)), output);
});

test("effect bounds preserve the complete shape stroke before expanding blur and offsets", () => {
  for (const type of ["rect", "ellipse"]) {
    for (const [blur, dx, dy, padding] of [[0, 0, 0, 33], [4, 6, -3, 51]]) {
      const shape = model.createElement(type, { id: "shape", x: 100, y: 120, width: 240, height: 160,
        stroke: "#123456", strokeWidth: 64,
        effect: { kind: "shadow", color: "#000", blur, opacity: 1, dx, dy } });
      const output = model.renderSVG(documentWith(shape));
      assert.ok(output.includes(`filterUnits="userSpaceOnUse" x="${100 - padding}" y="${120 - padding}" width="${240 + padding * 2}" height="${160 + padding * 2}"`));
      assert.ok(output.includes('stroke="#123456" stroke-width="64"'));
      assert.ok(output.includes('<feMergeNode in="SourceGraphic"/>'));
      assert.ok(output.includes(type === "rect" ? '<rect x="100" y="120" width="240" height="160"' : '<ellipse cx="220" cy="200" rx="120" ry="80"'));
    }
  }
});

test("decorated card preview and export retain trusted markup and wrap animations outside their target", () => {
  const card = model.createElement("card", { id: "live", parts: { name: { dx: 10, scale: 2, color: "#abc" } } });
  const markup = '<svg width="600" height="280"><style>.name {fill:#000;animation:in 1s} @keyframes in {from {transform:translateY(8px)} to {transform:translateY(0)}}</style><text x="20" y="30" class="name" data-cas-target="name">Live value</text></svg>';
  const doc = documentWith(card);
  const exported = model.renderSVG(doc, { cardMarkup: { live: markup } });
  const preview = model.renderSVG(doc, { cardMarkup: { live: markup }, interactive: true });
  assert.ok(exported.includes('<g transform="translate(10 0) translate(20 30) scale(2) translate(-20 -30)"><text'));
  assert.match(exported, /style="fill:#abc!important">Live value<\/text><\/g>/);
  assert.match(exported, /animation:pk-card-0-live-in 1s/);
  assert.ok(preview.includes('<g transform="translate(10 0) translate(20 30) scale(2) translate(-20 -30)"><text'));
});

test("decorated browser documents and SVG output match Node without runtime dependencies", () => {
  const card = model.createElement("card", { id: "live", parts: { name: { scale: 1.5, color: "#abc" } },
    effect: { kind: "glow", color: "#123456", blur: 4, opacity: 0.6, dx: 2, dy: 3 } });
  const markup = '<svg width="600" height="280"><text x="20" y="30" data-cas-target="name">Same value</text></svg>';
  const doc = documentWith(card);
  const sandbox = { URL, TextEncoder, TextDecoder, atob, btoa, json: model.serializeDocument(doc), markup };
  vm.createContext(sandbox);
  for (const source of ["card-schema", "card-decoration", "editor-model"]) {
    vm.runInContext(fs.readFileSync(require.resolve(`../public/${source}`), "utf8"), sandbox);
  }
  const browserSVG = vm.runInContext("ProfileKitEditorModel.renderSVG(ProfileKitEditorModel.parseDocument(json), {cardMarkup: {live: markup}})", sandbox);
  assert.equal(browserSVG, model.renderSVG(doc, { cardMarkup: { live: markup } }));
  assert.equal(vm.runInContext("ProfileKitEditorModel.serializeDocument(ProfileKitEditorModel.parseDocument(json))", sandbox), model.serializeDocument(doc));
});
