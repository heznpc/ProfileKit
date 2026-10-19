/* Card editor controller. Project files own their image bytes; no server writes. */
(function () {
  "use strict";
  // Keep previously shared root URLs opening the original card/README tools.
  function openLegacyLink() {
    const legacy = new URLSearchParams(window.location.hash.slice(1));
    if (window.location.pathname === "/" && (legacy.has("card") || legacy.has("c") || legacy.get("view") === "compose")) {
      window.location.replace("/index.html" + window.location.search + window.location.hash);
      return true;
    }
    return false;
  }
  if (openLegacyLink()) return;
  window.addEventListener("hashchange", openLegacyLink);
  const M = window.ProfileKitEditorModel;
  const presets = window.ProfileKitEditorPresets;
  const $ = (id) => document.getElementById(id);
  const host = $("canvas-host");
  const DRAFT_KEY = "profilekit.editor.v1";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const clone = (value) => ({ ...value, elements: value.elements.map((element) => ({ ...element })) });
  let doc = presets.editorial.make();
  let selectedId = null;
  let past = [], future = [], pendingEdit = null, gesture = null;
  let dirty = false, persisted = true, revision = 0, saveTimer, frame;
  let draftError = false, photoPromise, imageTargetId = null;
  let lastStoredDraft = null, storageConflict = false;

  function status(message, error = false) {
    $("status-message").textContent = message;
    $("status-message").classList.toggle("is-error", error);
  }
  function selected() { return doc.elements.find((element) => element.id === selectedId); }
  function pushHistory(before) {
    past.push({ doc: before, selectedId });
    if (past.length > 40) past.shift();
    // Many large images are shared between snapshots, but imported projects are not.
    let bytes = 0;
    const sources = new Set();
    for (let index = past.length - 1; index >= 0; index--) {
      for (const element of past[index].doc.elements) {
        if (element.src && !sources.has(element.src)) { sources.add(element.src); bytes += element.src.length; }
      }
      if (bytes > 24 * 1024 * 1024) { past.splice(0, index + 1); break; }
    }
    future = [];
  }
  function markChanged() {
    dirty = true; persisted = false; revision++;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 400);
  }
  function saveDraft() {
    clearTimeout(saveTimer);
    if (gesture) { saveTimer = setTimeout(saveDraft, 400); return; }
    try {
      if (storageConflict || localStorage.getItem(DRAFT_KEY) !== lastStoredDraft) {
        storageConflict = true; persisted = false;
        status("다른 탭에서 초안이 변경됐습니다. 덮어쓰기를 멈췄으니 이 탭의 작업은 ‘원본 저장’으로 보관하세요.", true);
        return;
      }
      const serialized = M.serializeDocument(doc);
      localStorage.setItem(DRAFT_KEY, serialized);
      lastStoredDraft = serialized;
      persisted = true;
      status("이 브라우저에 저장됨 · 다른 기기에서는 원본 파일을 열어주세요.");
    } catch {
      persisted = false;
      status("브라우저에 저장하지 못했습니다. ‘원본 저장’으로 파일을 보관하세요.", true);
    }
  }
  function finishEdit() {
    if (!pendingEdit) return;
    if (JSON.stringify(pendingEdit) !== JSON.stringify(doc)) pushHistory(pendingEdit);
    pendingEdit = null;
    updateHistory();
  }
  function transact(change, selection) {
    finishGesture();
    finishEdit();
    const before = clone(doc), candidate = clone(doc);
    try {
      change(candidate);
      const normalized = M.normalizeDocument(candidate);
      if (JSON.stringify(before) === JSON.stringify(normalized)) return false;
      pushHistory(before);
      doc = normalized;
      if (selection !== undefined) selectedId = selection;
      markChanged(); render();
      return true;
    } catch (error) { status(error.message, true); return false; }
  }
  function updateHistory() {
    $("undo").disabled = !past.length && !pendingEdit;
    $("redo").disabled = !future.length;
  }
  function travel(backward) {
    finishGesture();
    finishEdit();
    const from = backward ? past : future, to = backward ? future : past;
    if (!from.length) return;
    to.push({ doc: clone(doc), selectedId });
    const snapshot = from.pop(); doc = snapshot.doc; selectedId = snapshot.selectedId;
    if (!selected()) selectedId = null;
    markChanged(); render();
  }
  function renderMeta() {
    $("canvas-size-label").textContent = `${doc.width} × ${doc.height}`;
    for (const [id, value] of [["doc-name", doc.name], ["doc-width", doc.width], ["doc-height", doc.height], ["doc-background", doc.background]]) {
      if (document.activeElement !== $(id)) $(id).value = value;
    }
    updateHistory();
  }
  function elementLabel(element) {
    return element.type === "text" ? element.text.split("\n")[0] || "빈 텍스트" : ({ image: "이미지", rect: "사각형", ellipse: "타원" })[element.type];
  }
  function renderLayers() {
    const list = $("layer-list");
    const focusedId = document.activeElement?.closest("#layer-list [data-id]")?.dataset.id;
    list.replaceChildren();
    [...doc.elements].reverse().forEach((element) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "layer-item";
      button.classList.toggle("is-selected", element.id === selectedId);
      button.dataset.id = element.id;
      button.setAttribute("aria-pressed", String(element.id === selectedId));
      const icon = document.createElement("span");
      icon.className = "layer-icon"; icon.setAttribute("aria-hidden", "true");
      icon.textContent = ({ text: "T", image: "▧", rect: "□", ellipse: "○" })[element.type];
      const label = document.createElement("span"); label.textContent = elementLabel(element);
      button.append(icon, label); list.append(button);
    });
    if (!doc.elements.length) {
      const message = document.createElement("p"); message.className = "layer-empty";
      message.textContent = "아직 비어 있어요. 위 도구에서 첫 요소를 추가하세요."; list.append(message);
    }
    if (focusedId) list.querySelector(`[data-id="${focusedId}"]`)?.focus({ preventScroll: true });
  }
  function renderCanvas() {
    const focusedId = document.activeElement?.closest("#canvas-host [data-element-id]")?.dataset.elementId;
    host.innerHTML = M.renderSVG(doc, { interactive: true });
    host.style.aspectRatio = `${doc.width} / ${doc.height}`;
    host.parentElement.style.setProperty("--card-ratio", doc.width / doc.height);
    const svg = host.firstElementChild;
    svg.classList.add("editor-artboard");
    svg.setAttribute("aria-label", `${doc.name} 편집 영역`);
    svg.querySelectorAll("[data-element-id]").forEach((node) => {
      const element = doc.elements.find((item) => item.id === node.dataset.elementId);
      node.setAttribute("tabindex", "0"); node.setAttribute("role", "button");
      node.setAttribute("aria-label", `${elementLabel(element)} 선택`);
      node.style.cursor = "move";
    });
    renderSelection();
    if (focusedId) host.querySelector(`[data-element-id="${focusedId}"]`)?.focus({ preventScroll: true });
  }
  function svgNode(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }
  function renderSelection() {
    host.querySelector(".selection-overlay")?.remove();
    const element = selected(); if (!element) return;
    const scale = doc.width / Math.max(1, host.getBoundingClientRect().width);
    const size = 10 * scale, rotationOffset = 28 * scale;
    const overlay = svgNode("svg", { class: "selection-overlay", viewBox: `0 0 ${doc.width} ${doc.height}`, "aria-hidden": "true" });
    const cx = element.x + element.width / 2, cy = element.y + element.height / 2;
    const group = svgNode("g", { transform: `rotate(${element.rotation} ${cx} ${cy})` });
    group.append(svgNode("rect", { x: element.x, y: element.y, width: element.width, height: element.height, fill: "none", stroke: "#c94d35", "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" }));
    group.append(svgNode("line", { x1: cx, y1: element.y, x2: cx, y2: element.y - rotationOffset, stroke: "#c94d35", "vector-effect": "non-scaling-stroke" }));
    group.append(svgNode("circle", { cx, cy: element.y - rotationOffset, r: size / 2, fill: "#fff", stroke: "#c94d35", "data-handle": "rotate", "vector-effect": "non-scaling-stroke" }));
    group.append(svgNode("rect", { x: element.x + element.width - size / 2, y: element.y + element.height - size / 2, width: size, height: size, rx: size / 6, fill: "#fff", stroke: "#c94d35", "data-handle": "resize", "vector-effect": "non-scaling-stroke" }));
    overlay.append(group); host.append(overlay);
  }
  const elementFields = {
    "element-x": "x", "element-y": "y", "element-width": "width", "element-height": "height",
    "element-rotation": "rotation", "element-opacity": "opacity", "element-text": "text",
    "element-font-family": "fontFamily", "element-font-size": "fontSize", "element-font-weight": "fontWeight",
    "element-color": "color", "element-align": "align", "element-fill": "fill", "element-stroke": "stroke",
    "element-stroke-width": "strokeWidth", "element-radius": "radius", "element-fit": "fit",
  };
  const numeric = new Set(["x", "y", "width", "height", "rotation", "opacity", "fontSize", "fontWeight", "strokeWidth", "radius"]);
  function renderInspector() {
    const element = selected();
    $("selection-empty").hidden = !!element; $("selection-panel").hidden = !element;
    if (!element) return;
    $("selection-type").textContent = ({ text: "텍스트", image: "이미지", rect: "사각형", ellipse: "타원" })[element.type];
    $("text-controls").hidden = element.type !== "text";
    $("shape-controls").hidden = !["rect", "ellipse"].includes(element.type);
    $("image-controls").hidden = element.type !== "image";
    for (const [id, key] of Object.entries(elementFields)) {
      const field = $(id);
      if (element[key] !== undefined && document.activeElement !== field) field.value = element[key];
    }
    $("element-radius").disabled = element.type !== "rect";
    for (const key of ["fill", "stroke"]) {
      const picker = $("element-" + key + "-picker");
      if (/^#[0-9a-f]{6}$/i.test(element[key] || "") && document.activeElement !== picker) picker.value = element[key];
    }
    let warning = $("text-overflow-warning");
    if (!warning) {
      warning = document.createElement("p"); warning.id = "text-overflow-warning"; warning.className = "field-warning";
      warning.textContent = "텍스트가 상자 밖으로 잘립니다. 높이·너비를 늘리거나 글자 크기를 줄여주세요.";
      $("text-controls").append(warning);
    }
    warning.hidden = element.type !== "text" || !M.textLayout(element).overflow;
    const index = doc.elements.indexOf(element);
    $("bring-forward").disabled = index === doc.elements.length - 1;
    $("send-backward").disabled = index === 0;
  }
  function render() { renderMeta(); renderCanvas(); renderLayers(); renderInspector(); }
  function select(id) { finishEdit(); selectedId = id; renderSelection(); renderLayers(); renderInspector(); }

  function bindField(id, key, documentField = false) {
    const field = $(id);
    field.addEventListener("input", () => {
      if (!documentField && !selected()) return;
      if (numeric.has(key) && field.value === "") return;
      const value = numeric.has(key) ? Number(field.value) : field.value;
      const candidate = clone(doc);
      const target = documentField ? candidate : candidate.elements.find((element) => element.id === selectedId);
      target[key] = value;
      try {
        const next = M.normalizeDocument(candidate);
        if (!pendingEdit) pendingEdit = clone(doc);
        doc = next; markChanged(); renderCanvas(); renderLayers(); renderMeta(); renderInspector();
      } catch (error) { status(error.message, true); }
    });
    field.addEventListener("change", () => { finishEdit(); });
    field.addEventListener("blur", () => { finishEdit(); renderMeta(); renderInspector(); });
  }
  Object.entries(elementFields).forEach(([id, key]) => bindField(id, key));
  for (const key of ["fill", "stroke"]) {
    const picker = $("element-" + key + "-picker"), field = $("element-" + key);
    picker.addEventListener("input", () => { field.value = picker.value; field.dispatchEvent(new Event("input", { bubbles: true })); });
    picker.addEventListener("change", finishEdit);
    picker.addEventListener("blur", finishEdit);
  }
  for (const [id, key] of [["doc-name", "name"], ["doc-width", "width"], ["doc-height", "height"], ["doc-background", "background"]]) bindField(id, key, true);
  $("layer-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]"); if (button) select(button.dataset.id);
  });
  function add(type, overrides = {}) {
    const base = { x: Math.round(doc.width * .18), y: Math.round(doc.height * .22) };
    const element = M.createElement(type, { ...base, ...overrides });
    return transact((next) => next.elements.push(element), element.id);
  }
  $("add-text").addEventListener("click", () => { add("text", { text: "나를 소개하는 한 문장", width: 460, height: 120, fontSize: 40 }); $("element-text").focus(); $("element-text").select(); });
  $("add-rect").addEventListener("click", () => add("rect", { width: 220, height: 140, fill: "#d45d40", radius: 12 }));
  $("add-ellipse").addEventListener("click", () => add("ellipse", { width: 160, height: 160, fill: "#b9c5a7" }));
  function removeSelected() {
    if (!selected()) return;
    transact((next) => { next.elements = next.elements.filter((element) => element.id !== selectedId); }, null);
  }
  function duplicateSelected() {
    const element = selected(); if (!element) return;
    const { id, ...values } = element;
    const copy = M.createElement(element.type, { ...values, x: element.x + 20, y: element.y + 20 });
    transact((next) => next.elements.push(copy), copy.id);
  }
  $("duplicate-element").addEventListener("click", duplicateSelected);
  $("delete-element").addEventListener("click", removeSelected);
  function reorder(delta) {
    if (!selected()) return;
    transact((next) => {
      const index = next.elements.findIndex((element) => element.id === selectedId);
      const target = Math.max(0, Math.min(next.elements.length - 1, index + delta));
      const [element] = next.elements.splice(index, 1); next.elements.splice(target, 0, element);
    });
  }
  $("bring-forward").addEventListener("click", () => reorder(1));
  $("send-backward").addEventListener("click", () => reorder(-1));
  ["horizontal", "vertical"].forEach((direction) => $("align-" + direction).addEventListener("click", () => {
    if (!selected()) return;
    transact((next) => {
      const element = next.elements.find((item) => item.id === selectedId);
      if (direction === "horizontal") element.x = (next.width - element.width) / 2;
      else element.y = (next.height - element.height) / 2;
    });
  }));
  $("undo").addEventListener("click", () => travel(true));
  $("redo").addEventListener("click", () => travel(false));

  function point(event) {
    const rect = host.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * doc.width / rect.width, y: (event.clientY - rect.top) * doc.height / rect.height };
  }
  const rotated = (x, y, radians) => ({ x: x * Math.cos(radians) - y * Math.sin(radians), y: x * Math.sin(radians) + y * Math.cos(radians) });
  host.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const handle = event.target.closest("[data-handle]")?.dataset.handle;
    const target = event.target.closest("[data-element-id]");
    if (!handle && !target) { select(null); return; }
    event.preventDefault(); host.focus({ preventScroll: true }); finishEdit();
    if (target) select(target.dataset.elementId);
    const element = selected(); if (!element) return;
    gesture = { pointerId: event.pointerId, before: clone(doc), original: { ...element }, origin: point(event), action: handle || "move" };
    clearTimeout(saveTimer);
    host.setPointerCapture(event.pointerId);
  });
  host.addEventListener("pointermove", (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const current = point(event), { original: original, origin, action } = gesture;
    const element = selected(); if (!element) return;
    const dx = current.x - origin.x, dy = current.y - origin.y;
    if (action === "move") {
      element.x = Math.round(original.x + dx); element.y = Math.round(original.y + dy);
      if (event.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) element.y = original.y; else element.x = original.x; }
    } else if (action === "resize") {
      const angle = original.rotation * Math.PI / 180;
      const delta = rotated(dx, dy, -angle);
      let width = Math.max(12, original.width + delta.x), height = Math.max(12, original.height + delta.y);
      if (event.shiftKey) height = width * original.height / original.width;
      width = Math.min(4096, width); height = Math.min(4096, height);
      const offset = rotated((width - original.width) / 2, (height - original.height) / 2, angle);
      element.x = Math.round(original.x + offset.x - (width - original.width) / 2);
      element.y = Math.round(original.y + offset.y - (height - original.height) / 2);
      element.width = Math.round(width); element.height = Math.round(height);
    } else {
      const cx = original.x + original.width / 2, cy = original.y + original.height / 2;
      const start = Math.atan2(origin.y - cy, origin.x - cx), end = Math.atan2(current.y - cy, current.x - cx);
      let angle = original.rotation + (end - start) * 180 / Math.PI;
      if (event.shiftKey) angle = Math.round(angle / 15) * 15;
      element.rotation = Math.round(((angle + 540) % 360) - 180);
    }
    element.x = Math.max(-4096, Math.min(4096, element.x)); element.y = Math.max(-4096, Math.min(4096, element.y));
    if (!frame) frame = requestAnimationFrame(() => { frame = null; renderCanvas(); renderInspector(); });
  });
  function finishGesture(cancel = false) {
    if (!gesture) return;
    const { before, pointerId } = gesture; gesture = null;
    if (frame) { cancelAnimationFrame(frame); frame = null; }
    if (host.hasPointerCapture(pointerId)) host.releasePointerCapture(pointerId);
    if (cancel) doc = before;
    else {
      try {
        doc = M.normalizeDocument(doc);
        if (JSON.stringify(before) !== JSON.stringify(doc)) { pushHistory(before); markChanged(); }
      } catch (error) { doc = before; status(error.message, true); }
    }
    if (!persisted) { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 400); }
    render();
  }
  host.addEventListener("pointerup", () => finishGesture());
  host.addEventListener("pointercancel", () => finishGesture(true));
  host.addEventListener("lostpointercapture", () => finishGesture(true));
  host.addEventListener("dblclick", (event) => {
    const target = event.target.closest("[data-element-id]");
    if (target) select(target.dataset.elementId);
    if (selected()?.type === "text") { $("element-text").focus(); $("element-text").select(); }
  });
  host.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const target = event.target.closest("[data-element-id]");
      if (target) { event.preventDefault(); select(target.dataset.elementId); }
    }
  });
  new ResizeObserver(() => renderSelection()).observe(host);

  async function readImage(file) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("PNG, JPG, WebP 이미지를 선택하세요.");
    if (file.size > 12 * 1024 * 1024) throw new Error("이미지는 12MB 이하로 선택하세요.");
    // Inspect raster headers before asking a browser decoder to allocate pixels.
    M.imageInfo(new Uint8Array(await file.arrayBuffer()), file.type);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url;
      await image.decode();
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > M.LIMITS.MAX_IMAGE_PIXELS) throw new Error("이미지가 너무 큽니다. 1600만 화소 이하로 줄여주세요.");
      const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      return { src: canvas.toDataURL("image/webp", .9), width: canvas.width, height: canvas.height };
    } finally { URL.revokeObjectURL(url); }
  }
  async function coastPhoto() {
    if (!photoPromise) photoPromise = fetch("/editor-assets/coast.png").then((response) => {
      if (!response.ok) throw new Error("시작 카드 이미지를 불러오지 못했습니다.");
      return response.blob();
    }).then(readImage).then((result) => result.src).catch((error) => { photoPromise = null; throw error; });
    return photoPromise;
  }
  $("add-image").addEventListener("click", () => { imageTargetId = null; $("image-file").click(); });
  $("replace-image").addEventListener("click", () => { imageTargetId = selectedId; $("image-file").click(); });
  $("image-file").addEventListener("change", async (event) => {
    const file = event.target.files[0]; event.target.value = ""; if (!file) return;
    const targetId = imageTargetId; imageTargetId = null;
    const startRevision = revision;
    try {
      const image = await readImage(file);
      finishGesture();
      if (revision !== startRevision && !confirm("이미지를 추가하는 동안 카드가 변경됐습니다. 현재 카드에 추가할까요?")) return;
      if (targetId) {
        if (!doc.elements.some((element) => element.id === targetId && element.type === "image")) throw new Error("교체할 이미지가 없어졌습니다. 다시 선택해 주세요.");
        if (transact((next) => { next.elements.find((element) => element.id === targetId).src = image.src; }, targetId)) status("위치와 크기를 유지하고 이미지를 교체했습니다.");
        return;
      }
      const width = Math.min(doc.width * .48, image.width, doc.height * .65 * image.width / image.height);
      if (add("image", { src: image.src, width: Math.round(width), height: Math.round(width * image.height / image.width), fit: "cover" })) {
        status("이미지를 추가했습니다. 모서리로 크기를 조절하세요.");
      }
    } catch (error) { status(error.message, true); }
  });
  function confirmReplace() { return !dirty || confirm("다른 카드를 열까요? 현재 작업을 보관하려면 취소 후 ‘원본 저장’을 눌러주세요. 변경 직후에는 실행 취소로 돌아갈 수 있습니다."); }
  function replaceDocument(next) {
    finishGesture();
    finishEdit(); pushHistory(clone(doc)); doc = M.normalizeDocument(next); selectedId = null;
    markChanged(); render();
  }
  $("template-list").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-preset]"); if (!button || !presets[button.dataset.preset]) return;
    if (!confirmReplace()) return;
    const startRevision = revision;
    button.disabled = true;
    try {
      const imageSrc = button.dataset.preset === "collage" ? await coastPhoto() : undefined;
      finishGesture();
      if (revision !== startRevision && !confirmReplace()) return;
      replaceDocument(presets[button.dataset.preset].make({ imageSrc }));
    } catch (error) { status(error.message, true); }
    finally { button.disabled = false; }
  });
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const filename = (name) => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 80).trim() || "profilekit-card";
  function saveProject() {
    finishEdit();
    try {
      download(new Blob([M.serializeDocument(doc)], { type: "application/json" }), filename(doc.name) + ".profilekit.json");
      dirty = false; status("원본 파일을 내보냈습니다. ‘원본 열기’에서 이어서 편집할 수 있어요.");
    } catch (error) { status(error.message, true); }
  }
  $("project-save").addEventListener("click", saveProject);
  $("project-open").addEventListener("click", () => $("project-file").click());
  $("project-file").addEventListener("change", async (event) => {
    const file = event.target.files[0]; event.target.value = ""; if (!file) return;
    const startRevision = revision;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("원본 파일은 8MB 이하여야 합니다.");
      const next = M.parseDocument(await file.text());
      for (const src of new Set(next.elements.filter((item) => item.type === "image").map((item) => item.src))) {
        const image = new Image(); image.src = src;
        try { await image.decode(); } catch { throw new Error("원본 안의 이미지가 손상되었습니다. 현재 카드는 유지됩니다."); }
      }
      finishGesture();
      if ((dirty || revision !== startRevision) && !confirmReplace()) return;
      replaceDocument(next); dirty = false; status("원본을 열었습니다. 모든 요소를 다시 편집할 수 있어요.");
    } catch (error) { status(error.message, true); }
  });
  $("export-svg").addEventListener("click", () => {
    finishEdit();
    try { download(new Blob([M.renderSVG(doc)], { type: "image/svg+xml;charset=utf-8" }), filename(doc.name) + ".svg"); status("SVG를 내보냈습니다. 이미지를 포함한 독립 파일입니다."); }
    catch (error) { status(error.message, true); }
  });
  $("export-png").addEventListener("click", async () => {
    finishEdit(); const snapshot = clone(doc), button = $("export-png"); button.disabled = true;
    let url;
    try {
      url = URL.createObjectURL(new Blob([M.renderSVG(snapshot)], { type: "image/svg+xml;charset=utf-8" }));
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = snapshot.width * 2; canvas.height = snapshot.height * 2;
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("PNG 변환에 실패했습니다.");
      download(blob, filename(snapshot.name) + ".png"); status("PNG를 2배 해상도로 내보냈습니다.");
    } catch (error) { status(error.message, true); }
    finally { if (url) URL.revokeObjectURL(url); button.disabled = false; }
  });
  window.addEventListener("keydown", (event) => {
    const mod = event.metaKey || event.ctrlKey;
    const editing = event.target.closest("input,textarea,select,[contenteditable]");
    if (mod && event.key.toLowerCase() === "s") { event.preventDefault(); saveProject(); return; }
    if (event.key === "Escape") { if (gesture) finishGesture(true); else { document.activeElement.blur(); select(null); } return; }
    if (editing) return;
    if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); travel(!event.shiftKey); }
    else if (mod && event.key.toLowerCase() === "y") { event.preventDefault(); travel(false); }
    else if (mod && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); }
    else if (["Delete", "Backspace"].includes(event.key) && selected()) { event.preventDefault(); removeSelected(); }
    else if (event.key.startsWith("Arrow") && selected()) {
      event.preventDefault(); const amount = event.shiftKey ? 10 : 1;
      transact((next) => {
        const element = next.elements.find((item) => item.id === selectedId);
        if (event.key === "ArrowLeft") element.x -= amount;
        if (event.key === "ArrowRight") element.x += amount;
        if (event.key === "ArrowUp") element.y -= amount;
        if (event.key === "ArrowDown") element.y += amount;
      });
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (!persisted) { saveDraft(); if (!persisted && dirty) { event.preventDefault(); event.returnValue = ""; } }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && !persisted) saveDraft(); });
  window.addEventListener("storage", (event) => {
    if ((event.key === DRAFT_KEY || event.key === null) && event.newValue !== lastStoredDraft) {
      storageConflict = true; persisted = false; clearTimeout(saveTimer);
      status("다른 탭에서 초안이 변경됐습니다. 이 탭의 작업은 ‘원본 저장’으로 보관하세요.", true);
    }
  });
  // Thumbnails use the actual document renderer, in isolated SVG images so
  // their clip IDs cannot interfere with the editable canvas.
  for (const button of $("template-list").querySelectorAll("[data-preset]")) {
    button.classList.remove("is-selected"); button.removeAttribute("aria-pressed");
    const thumb = button.querySelector(".template-thumb");
    if (!thumb) continue;
    const fillThumbnail = (imageSrc) => {
      const image = document.createElement("img"); image.alt = "";
      image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(M.renderSVG(presets[button.dataset.preset].make({ imageSrc })));
      Object.assign(image.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "contain", transform: "none" });
      thumb.replaceChildren(image);
    };
    if (button.dataset.preset === "collage") coastPhoto().then(fillThumbnail).catch(() => {});
    else fillThumbnail();
  }
  try { lastStoredDraft = localStorage.getItem(DRAFT_KEY); if (lastStoredDraft) { doc = M.parseDocument(lastStoredDraft); dirty = true; } }
  catch { draftError = true; }
  render();
  if (draftError) status("이전 임시 저장을 열지 못했습니다. 저장해 둔 원본 파일을 열어주세요.", true);
  else status("카드를 골라 시작하거나, 텍스트·이미지·도형을 자유롭게 추가하세요.");
})();
