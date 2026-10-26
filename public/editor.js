/* Card editor controller. Project files own their image bytes. Publishing is explicit. */
(async function () {
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
  const Design = window.ProfileKitCardDesign;
  const Decoration = window.ProfileKitCardDecoration;
  const I = window.ProfileKitStudioI18n;
  const t = (text) => I?.t(text) || text;
  const catalog = window.ProfileKitCards.CARDS;
  const presets = window.ProfileKitEditorPresets;
  const $ = (id) => document.getElementById(id);
  const host = $("canvas-host");
  const requestedHandoff = new URLSearchParams(location.hash.slice(1)).get("readme-edit");
  const galleryParams = new URLSearchParams(location.hash.slice(1));
  const galleryId = /^[a-f0-9]{32}$/.test(galleryParams.get("gallery") || "") ? galleryParams.get("gallery") : null;
  const galleryVersion = /^[1-9][0-9]{0,6}$/.test(galleryParams.get("version") || "") ? Number(galleryParams.get("version")) : null;
  const handoffToken = /^[a-z0-9-]{36}$/i.test(requestedHandoff || "") ? requestedHandoff : null;
  const handoffKey = handoffToken ? "profilekit.readme-handoff." + handoffToken : null;
  const DRAFT_KEY = "profilekit.readme-studio.v2" + (handoffToken ? "." + handoffToken : galleryId && galleryVersion ? ".gallery-" + galleryId + "-" + galleryVersion : "");
  const Transfer = window.ProfileKitProjectTransfer;
  async function readDraft() {
    const value = await Transfer.get(DRAFT_KEY);
    return value ? M.serializeDocument(value) : null;
  }
  async function writeDraft(serialized) {
    return Transfer.compareAndSet(DRAFT_KEY, lastStoredDraft ? JSON.parse(lastStoredDraft) : null, JSON.parse(serialized));
  }
  let savingDraft = false, leavingEditor = false;
  let readmeHandoff = null;
  let handoffReady = false;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const clone = (value) => ({ ...value, elements: value.elements.map((element) => ({ ...element,
    ...(element.params ? { params: { ...element.params } } : {}),
    ...(element.parts ? { parts: Object.fromEntries(Object.entries(element.parts).map(([key, part]) => [key, { ...part }])) } : {}),
    ...(element.effect ? { effect: { ...element.effect } } : {}),
  })) });
  let doc = presets.header.make();
  let selectedId = doc.elements[0]?.id || null;
  let past = [], future = [], pendingEdit = null, gesture = null;
  let dirty = false, persisted = true, revision = 0, saveTimer, frame;
  let draftError = false, imageTargetId = null;
  let lastStoredDraft = null, storageConflict = false;
  const nativeMeasurements = new Map();
  const cardPreviews = new Map();
  let partMode = false, partName = "", partOwner = null;
  let gallerySource = galleryId && galleryVersion ? { id: galleryId, version: galleryVersion } : null;

  function partDefinitions(element = selected()) { return element?.type === "card" ? Decoration.partDefinitions(element) : {}; }
  function previewEntry(card) {
    const key = M.cardPath(card);
    let entry = cardPreviews.get(key);
    if (!entry) {
      entry = { svg: null, error: null };
      cardPreviews.set(key, entry);
      entry.promise = fetchCardSVG(card).then((svg) => { entry.svg = svg; }).catch((error) => { entry.error = error.message; }).finally(() => {
        if (doc.elements.some((element) => element.type === "card" && M.cardPath(element) === key)) {
          renderCanvas(); renderDecorationInspector();
        }
      });
      if (cardPreviews.size > 24) cardPreviews.delete(cardPreviews.keys().next().value);
    }
    return entry;
  }
  function visiblePartNode() {
    if (!partMode || !selected() || !partName) return null;
    return host.querySelector(`[data-element-id="${selectedId}"] [data-cas-target="${partName}"]`);
  }
  function partBounds() {
    const node = visiblePartNode();
    if (!node || selected().parts?.[partName]?.hidden) return null;
    const box = node.getBoundingClientRect(), canvas = host.getBoundingClientRect();
    const card = selected().overflow === "visible" ? canvas : node.closest("[data-element-id]").getBoundingClientRect();
    const minX = Math.max(canvas.left, card.left), maxX = Math.min(canvas.right, card.right);
    const minY = Math.max(canvas.top, card.top), maxY = Math.min(canvas.bottom, card.bottom);
    const left = Math.max(minX, box.left - (box.width < 6 ? 3 : 0));
    const right = Math.min(maxX, box.right + (box.width < 6 ? 3 : 0));
    const top = Math.max(minY, box.top - (box.height < 6 ? 3 : 0));
    const bottom = Math.min(maxY, box.bottom + (box.height < 6 ? 3 : 0));
    if (right <= left || bottom <= top) return null;
    return { x: (left - canvas.left) * doc.width / canvas.width, y: (top - canvas.top) * doc.height / canvas.height,
      width: (right - left) * doc.width / canvas.width, height: (bottom - top) * doc.height / canvas.height };
  }

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
  async function saveDraft() {
    clearTimeout(saveTimer);
    if (leavingEditor) return;
    if (gesture || nativeMeasurements.size || savingDraft) { saveTimer = setTimeout(saveDraft, 400); return; }
    savingDraft = true;
    try {
      if (storageConflict || await readDraft() !== lastStoredDraft) {
        storageConflict = true; persisted = false;
        status("다른 탭에서 초안이 변경됐습니다. 덮어쓰기를 멈췄으니 이 탭의 작업은 ‘프로젝트 저장’으로 보관하세요.", true);
        return;
      }
      const serialized = M.serializeDocument(doc);
      const savedRevision = revision;
      if (!await writeDraft(serialized)) {
        storageConflict = true; persisted = false;
        status("다른 탭에서 초안이 변경됐습니다. 이 탭의 작업은 프로젝트 파일로 저장하세요.", true);
        return;
      }
      lastStoredDraft = serialized;
      persisted = revision === savedRevision;
      status("이 브라우저에 저장됨 · 다른 기기에서는 프로젝트 파일을 열어주세요.");
    } catch {
      persisted = false;
      status("브라우저에 저장하지 못했습니다. ‘프로젝트 저장’으로 파일을 보관하세요.", true);
    } finally { savingDraft = false; }
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
  function previewChange(change) {
    const candidate = clone(doc);
    try {
      change(candidate);
      const next = M.normalizeDocument(candidate);
      if (!pendingEdit) pendingEdit = clone(doc);
      doc = next; markChanged(); renderCanvas(); renderLayers(); renderMeta(); renderInspector();
    } catch (error) { status(error.message, true); }
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
    nativeMeasurements.clear();
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
    if (element.type === "card") return `${cardLabel(element.endpoint)} · ${element.params.username || element.params.name || element.params.title || element.endpoint}`;
    return element.type === "text" ? element.text.split("\n")[0] || t("빈 텍스트") : t(({ image: "이미지", rect: "사각형", ellipse: "타원" })[element.type]);
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
      icon.textContent = ({ card: "◈", text: "T", image: "▧", rect: "□", ellipse: "○" })[element.type];
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
    const cardMarkup = Object.create(null);
    for (const element of doc.elements) {
      if (element.type !== "card") continue;
      const entry = previewEntry(element);
      cardMarkup[element.id] = entry.svg || `<svg xmlns="${SVG_NS}" width="${element.nativeWidth || element.width}" height="${element.nativeHeight || element.height}"><rect width="100%" height="100%" fill="#171b27"/><text x="20" y="36" fill="#c4b5fd" font-size="16">${entry.error ? "미리보기를 불러오지 못했습니다" : "꾸미기 미리보기를 불러오는 중…"}</text></svg>`;
    }
    host.innerHTML = M.renderSVG(doc, { interactive: true, cardMarkup });
    host.classList.toggle("is-editing-parts", partMode);
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
    if (partMode) {
      for (const node of svg.querySelectorAll(`[data-element-id="${selectedId}"] [data-cas-target]`)) {
        if (Object.hasOwn(partDefinitions(), node.getAttribute("data-cas-target"))) node.style.cursor = "move";
      }
    }
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
    const touchHandle = (parent, action, x, y, outward = false) => {
      if (!matchMedia("(any-pointer: coarse)").matches) return;
      // Keep most of a resize target outside the selection so small text
      // remains draggable. The visible handle stays at the actual corner.
      const offset = (outward ? 8 : 22) * scale;
      const hitX = Math.max(0, Math.min(x - offset, doc.width - 44 * scale));
      parent.append(svgNode("rect", { x: hitX, y: y - offset, width: 44 * scale, height: 44 * scale,
        fill: "transparent", "data-handle-hit": action }));
    };
    if (partMode && element.type === "card") {
      const box = partBounds();
      if (!box) return;
      overlay.append(svgNode("rect", { ...box, fill: "none", stroke: "#a78bfa", "stroke-dasharray": "4 3", "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" }));
      touchHandle(overlay, "part-scale", box.x + box.width, box.y + box.height, true);
      overlay.append(svgNode("rect", { x: box.x + box.width - size / 2, y: box.y + box.height - size / 2,
        width: size, height: size, fill: "#fff", stroke: "#a78bfa", "data-handle": "part-scale", "vector-effect": "non-scaling-stroke" }));
      host.append(overlay); return;
    }
    const cx = element.x + element.width / 2, cy = element.y + element.height / 2;
    const group = svgNode("g", { transform: `rotate(${element.rotation} ${cx} ${cy})` });
    group.append(svgNode("rect", { x: element.x, y: element.y, width: element.width, height: element.height, fill: "none", stroke: "#818cf8", "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" }));
    group.append(svgNode("line", { x1: cx, y1: element.y, x2: cx, y2: element.y - rotationOffset, stroke: "#818cf8", "vector-effect": "non-scaling-stroke" }));
    touchHandle(group, "rotate", cx, element.y - rotationOffset);
    group.append(svgNode("circle", { cx, cy: element.y - rotationOffset, r: size / 2, fill: "#fff", stroke: "#818cf8", "data-handle": "rotate", "vector-effect": "non-scaling-stroke" }));
    touchHandle(group, "resize", element.x + element.width, element.y + element.height, true);
    group.append(svgNode("rect", { x: element.x + element.width - size / 2, y: element.y + element.height - size / 2, width: size, height: size, rx: size / 6, fill: "#fff", stroke: "#818cf8", "data-handle": "resize", "vector-effect": "non-scaling-stroke" }));
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
  const cardLabel = (endpoint) => I?.card(endpoint) || catalog[endpoint]?.label || (endpoint === "stack" ? "Stack" : endpoint);
  const paramLabels = { bg: "배경 효과", align: "정렬", density: "밀도", style: "스타일", username: "사용자명", name: "이름", title: "제목", subtitle: "소개", text: "문구", theme: "테마", font: "글꼴", color: "색상", accent_color: "강조색", bg_color: "배경색", text_color: "글자색", width: "카드 너비", height: "카드 높이", layout: "레이아웃", repo: "저장소", description: "설명", speed: "속도", border_radius: "모서리", hide_border: "테두리 숨김", hide_bar: "상단 바 숨김", lines: "줄 내용", items: "항목", tags: "태그", animate: "애니메이션" };
  let cardInspectorKey = "";
  function cardFields(endpoint) { return catalog[endpoint]?.params || []; }
  function renderCardInspector(element) {
    $("card-endpoint-label").textContent = "/" + element.endpoint;
    for (const [id, key] of [["card-meta-alt", "alt"], ["card-meta-width", "displayWidth"], ["card-meta-link", "linkUrl"]]) if (document.activeElement !== $(id)) $(id).value = element[key] || "";
    const container = $("card-params"), fields = cardFields(element.endpoint);
    const key = `${element.id}:${element.endpoint}`;
    if (cardInspectorKey !== key) {
      cardInspectorKey = key; container.replaceChildren();
      for (const param of fields) {
        const label = document.createElement("label"); label.className = "field";
        const caption = document.createElement("span"); caption.textContent = paramLabels[param.name] || param.name;
        const field = document.createElement(["select", "boolean"].includes(param.type) ? "select" : "input");
        field.id = "card-param-" + param.name; field.dataset.param = param.name; field.spellcheck = false;
        if (param.type === "select" || param.type === "boolean") {
          const values = param.type === "boolean" ? ["", "true", "false"] : [...new Set(["", ...param.options])];
          for (const value of values) {
            const option = document.createElement("option"); option.value = value;
            option.textContent = value === "" ? "기본값" : value === "true" ? "켜기" : value === "false" ? "끄기" : value;
            field.append(option);
          }
        } else {
          field.type = param.type === "number" ? "number" : "text";
          field.placeholder = param.placeholder || (param.default !== undefined ? String(param.default) : param.type === "color" ? "기본색 · 예: 7aa2f7" : "기본값");
          if (param.type === "number") field.step = "any";
        }
        field.addEventListener("change", () => {
          if (selected()?.type !== "card") return;
          const previous = beforeCardChange(selected());
          const changed = transact((next) => {
            const card = next.elements.find((item) => item.id === selectedId);
            if (field.value === "" && ["select", "boolean", "number", "color"].includes(param.type)) delete card.params[param.name];
            else card.params[param.name] = field.value;
            if (param.name === "cards" && card.parts) {
              const definitions = partDefinitions(card);
              card.parts = Object.fromEntries(Object.entries(card.parts).filter(([name]) => Object.hasOwn(definitions, name)));
            }
            delete card.nativeWidth; delete card.nativeHeight;
          });
          if (changed) refreshNativeSize(previous);
        });
        label.append(caption, field); container.append(label);
      }
    }
    for (const field of container.querySelectorAll("[data-param]")) {
      const value = element.params[field.dataset.param] ?? "";
      if (field.tagName === "SELECT" && !Array.from(field.options).some((option) => option.value === value)) {
        const option = document.createElement("option"); option.value = value; option.textContent = value; field.append(option);
      }
      if (document.activeElement !== field) field.value = value;
    }
    if (document.activeElement !== $("card-extra-params")) {
      const known = new Set(fields.map((field) => field.name));
      $("card-extra-params").value = new URLSearchParams(Object.entries(element.params).filter(([name]) => !known.has(name))).toString();
    }
  }
  $("card-apply-params").addEventListener("click", () => {
    if (selected()?.type !== "card") return;
    try {
      const element = selected(), known = new Set(cardFields(element.endpoint).map((field) => field.name));
      const params = Object.fromEntries(Object.entries(element.params).filter(([key]) => known.has(key)));
      for (const [key, value] of new URLSearchParams($("card-extra-params").value.trim().replace(/^\?/, ""))) {
        if (Object.hasOwn(params, key)) throw new Error("중복된 매개변수입니다. 위 카드 설정에서 바꿔주세요: " + key);
        params[key] = value;
      }
      const previous = beforeCardChange(element);
      if (transact((next) => { const card = next.elements.find((item) => item.id === selectedId); card.params = params;
        if (card.parts) {
          const definitions = partDefinitions(card);
          card.parts = Object.fromEntries(Object.entries(card.parts).filter(([name]) => Object.hasOwn(definitions, name)));
        }
        delete card.nativeWidth; delete card.nativeHeight; })) refreshNativeSize(previous);
    } catch (error) { status(error.message, true); }
  });
  for (const [id, key] of [["card-meta-alt", "alt"], ["card-meta-width", "displayWidth"], ["card-meta-link", "linkUrl"]]) $(id).addEventListener("change", () => {
    if (selected()?.type !== "card") return;
    transact((next) => { const card = next.elements.find((item) => item.id === selectedId); if ($(id).value) card[key] = $(id).value; else delete card[key]; });
  });
  function beforeCardChange(card) {
    const baseline = nativeMeasurements.get(card.id)?.previous;
    return { ...card, nativeWidth: card.nativeWidth ?? baseline?.nativeWidth, nativeHeight: card.nativeHeight ?? baseline?.nativeHeight };
  }
  async function waitForCardSizes() {
    while (nativeMeasurements.size) await Promise.all(Array.from(nativeMeasurements.values(), (entry) => entry.promise));
  }
  function refreshNativeSize(previous) {
    const current = doc.elements.find((element) => element.id === previous.id);
    if (!current) return;
    const signature = JSON.stringify(current.params), sizeBefore = { width: current.width, height: current.height };
    const ticket = { previous };
    nativeMeasurements.set(previous.id, ticket);
    ticket.promise = (async () => {
      try {
        const size = await measureCard(current);
        const card = doc.elements.find((element) => element.id === previous.id);
        if (nativeMeasurements.get(previous.id) !== ticket || !card || JSON.stringify(card.params) !== signature) return;
        const fitted = doc.elements.length === 1 && card.x === 0 && card.y === 0 && card.width === doc.width && card.height === doc.height;
        const keptAspect = previous.nativeWidth && previous.nativeHeight && Math.abs(previous.width / previous.height - previous.nativeWidth / previous.nativeHeight) < 0.001;
        if (keptAspect && card.width === sizeBefore.width && card.height === sizeBefore.height) {
          const scale = Math.min(previous.width / previous.nativeWidth, (2048 - Math.max(0, card.x)) / size.nativeWidth, (2048 - Math.max(0, card.y)) / size.nativeHeight);
          card.width = Math.max(1, Math.round(size.nativeWidth * scale));
          card.height = Math.max(1, Math.round(size.nativeHeight * scale));
          if (fitted) { doc.width = card.width; doc.height = card.height; }
          else {
            doc.width = Math.min(2048, Math.max(doc.width, Math.ceil(card.x + card.width)));
            doc.height = Math.min(2048, Math.max(doc.height, Math.ceil(card.y + card.height)));
          }
        }
        card.nativeWidth = size.nativeWidth; card.nativeHeight = size.nativeHeight;
        markChanged(); render();
      } catch { if (nativeMeasurements.get(previous.id) === ticket) status("카드 크기를 갱신하지 못했습니다. 연결을 확인한 뒤 다시 변경해 주세요.", true); }
      finally { if (nativeMeasurements.get(previous.id) === ticket) nativeMeasurements.delete(previous.id); }
    })();
    return ticket.promise;
  }
  async function fetchCardSVG(card) {
    const response = await fetch(M.cardPath(card), { signal: AbortSignal.timeout(20000) });
    if (!response.ok || !response.headers.get("content-type")?.includes("image/svg+xml")) throw new Error(`${cardLabel(card.endpoint)} 카드를 불러오지 못했습니다. 계정·저장소·내용을 확인하세요.`);
    const svg = await response.text();
    if (!/^\s*<svg\b/.test(svg)) throw new Error("카드 응답이 SVG가 아닙니다.");
    const parsed = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
    const error = parsed.getAttribute("aria-label") || "";
    if (error.startsWith("Error:")) throw new Error(`${cardLabel(card.endpoint)}: ${error.slice(6).trim()}. URL 임베드를 사용하거나 이 배포의 연결 설정을 확인하세요.`);
    return svg;
  }
  async function measureCard(card) {
    const image = new Image();
    const timer = setTimeout(() => { image.src = ""; }, 20000);
    try {
      image.src = Design.cardUrl(card, card.sourceOrigin || location.origin);
      await image.decode();
      const scale = Math.min(1, 2048 / image.naturalWidth, 2048 / image.naturalHeight);
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("카드 크기를 확인할 수 없습니다.");
      return { width: Math.max(1, Math.round(image.naturalWidth * scale)), height: Math.max(1, Math.round(image.naturalHeight * scale)), nativeWidth: image.naturalWidth, nativeHeight: image.naturalHeight };
    } finally { clearTimeout(timer); }
  }
  $("import-card-button").addEventListener("click", async () => {
    const button = $("import-card-button"); button.disabled = true;
    const startRevision = revision;
    try {
      const importOrigin = readmeHandoff ? new URL(readmeHandoff.originalUrl, readmeHandoff.project.origin || location.origin).origin : location.origin;
      const importedDesign = Design.parseDesignInput($("import-card-input").value, importOrigin);
      if (importedDesign) {
        if (dirty && !confirmReplace()) return;
        replaceDocument(importedDesign); select(doc.elements[0]?.id || null);
        await rememberHandoffDocument();
        handoffReady = true; $("readme-return").disabled = false;
        status("조합한 카드를 불러왔습니다. 카드와 요소를 다시 편집할 수 있습니다."); return;
      }
      const card = Design.parseCardInput($("import-card-input").value, importOrigin);
      status("기존 카드와 크기를 불러오는 중…");
      const size = await measureCard(card);
      if ((dirty || revision !== startRevision) && !confirmReplace()) return;
      const element = M.createElement("card", { ...card, ...size, x: 0, y: 0 });
      replaceDocument(M.createDocument({ name: `${cardLabel(card.endpoint)} · ${card.params.username || card.params.title || card.params.name || "My README"}`, width: size.width, height: size.height, background: "transparent", elements: [element] }));
      select(element.id);
      await rememberHandoffDocument();
      handoffReady = true; $("readme-return").disabled = false;
      status("카드를 불러왔습니다. 기존 옵션은 그대로 유지됩니다. 오른쪽에서 편집하세요.");
    } catch (error) { status(error.message, true); }
    finally { button.disabled = false; }
  });
  async function rememberHandoffDocument() {
    if (!readmeHandoff || readmeHandoff.originalDocument) return;
    readmeHandoff.originalDocument = M.serializeDocument(doc);
    await Transfer.set(handoffKey, readmeHandoff);
  }
  async function returnToReadme(cancel) {
    if (!readmeHandoff || (!cancel && !handoffReady)) return;
    finishEdit();
    $("readme-return").disabled = true;
    $("readme-return-cancel").disabled = true;
    try {
      if (!cancel) await waitForCardSizes();
      const current = await Transfer.get(handoffKey);
      if (!current || current.originalUrl !== readmeHandoff.originalUrl || current.cardId !== readmeHandoff.cardId) throw new Error("원래 README 연결을 찾지 못했습니다. 프로젝트를 저장해 주세요.");
      const transferRevision = revision;
      const original = new URL(current.originalUrl, current.project.origin || location.origin);
      const unchanged = M.serializeDocument(doc) === current.originalDocument;
      delete current.resultAsset;
      if (!cancel && !unchanged && current.assetDocument) { showAssetReturn(); return; }
      try { current.resultUrl = cancel || unchanged ? current.originalUrl : Design.designUrl(doc, original.origin) + original.hash; }
      catch (error) {
        if (error.message.includes("design URL is too large")) { showAssetReturn(); return; }
        throw error;
      }
      await Transfer.set(handoffKey, current);
      if (revision !== transferRevision) throw new Error("전달 중 디자인이 변경됐습니다. 다시 반영해 주세요.");
      clearTimeout(saveTimer);
      leavingEditor = true; persisted = true;
      location.assign("/readme.html#design-return=" + handoffToken);
    } catch (error) {
      $("readme-return").disabled = !handoffReady;
      $("readme-return-cancel").disabled = false;
      status(error.message, true);
    }
  }
  function showAssetReturn() {
    $("readme-return").disabled = false;
    $("readme-return-cancel").disabled = false;
    $("asset-return").hidden = false;
    $("asset-path").value = readmeHandoff.assetPath || "assets/profilekit-" + handoffToken.slice(0, 8) + ".svg";
    document.querySelector(".asset-export").open = true;
    refreshEmbed();
    $("embed-message").textContent = "이 디자인은 SVG 파일로 README에 넣습니다. 파일을 내려받고 지정한 저장소 경로에 추가하세요. 편집 원본은 README 프로젝트에도 보관됩니다.";
    $("embed-dialog").showModal();
  }
  $("asset-return").addEventListener("click", async () => {
    const button = $("asset-return"); button.disabled = true;
    try {
      finishEdit(); await waitForCardSizes();
      const path = $("asset-path").value.trim();
      if (!/^(?:\.\/)?[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\.svg$/.test(path) || path.split("/").includes("..")) throw new Error("SVG 상대 경로를 입력하세요. 예: assets/profilekit.svg");
      const transferRevision = revision;
      const snapshot = M.normalizeDocument(doc);
      const svg = await standaloneSVG(snapshot);
      const current = await Transfer.get(handoffKey);
      if (!current || current.originalUrl !== readmeHandoff.originalUrl || current.cardId !== readmeHandoff.cardId) throw new Error("README 연결을 찾지 못했습니다. 프로젝트를 저장해 주세요.");
      const canonicalPath = path.replace(/^\.\//, "");
      const originalPath = (current.assetPath || "").replace(/^\.\//, "");
      if (Object.keys(current.project.assetDesigns || {}).some((key) => key.replace(/^\.\//, "") === canonicalPath) && originalPath !== canonicalPath) throw new Error("이 SVG 경로는 다른 디자인에서 사용 중입니다. 다른 파일 이름을 선택하세요.");
      delete current.resultUrl;
      current.resultAsset = { path: canonicalPath, document: snapshot };
      if (revision !== transferRevision || $("asset-path").value.trim() !== path) throw new Error("전달 중 디자인이나 경로가 변경됐습니다. 다시 반영해 주세요.");
      await Transfer.set(handoffKey, current);
      if (revision !== transferRevision || $("asset-path").value.trim() !== path) throw new Error("전달 중 디자인이나 경로가 변경됐습니다. 다시 반영해 주세요.");
      download(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), path.split("/").pop());
      clearTimeout(saveTimer); leavingEditor = true; persisted = true;
      location.assign("/readme.html#design-return=" + handoffToken);
    } catch (error) { $("embed-message").textContent = error.message; }
    finally { button.disabled = false; }
  });
  $("readme-return").addEventListener("click", () => returnToReadme(false));
  $("readme-return-cancel").addEventListener("click", () => returnToReadme(true));
  function newCardParams(endpoint) {
    const params = {};
    for (const field of cardFields(endpoint)) if (field.default !== undefined) params[field.name] = String(field.default);
    const username = $("profile-username").value.trim() || "octocat";
    if (Object.hasOwn(params, "username")) params.username = username;
    if (endpoint === "social") params.github = username;
    if (endpoint === "pin") params.repo = username === "octocat" ? "Hello-World" : username;
    if (endpoint === "hero") { params.name = username; params.subtitle = "Building, learning, sharing."; params.width = "900"; params.height = "220"; }
    if (cardFields(endpoint).some((field) => field.name === "theme")) params.theme = $("theme-apply").value;
    return params;
  }
  function renderCatalog() {
    const query = $("card-search").value.trim().toLowerCase(), container = $("card-catalog"); container.replaceChildren();
    for (const [endpoint, entry] of Object.entries(catalog)) {
      if (!`${endpoint} ${entry.label} ${entry.group} ${entry.desc} ${I?.cardSearchText?.(endpoint) || cardLabel(endpoint)}`.toLowerCase().includes(query)) continue;
      const button = document.createElement("button"); button.type = "button"; button.className = "catalog-card"; button.dataset.endpoint = endpoint; button.dataset.card = endpoint;
      const label = document.createElement("strong"); label.className = "catalog-card-name"; label.textContent = entry.label;
      const group = document.createElement("span"); group.className = "catalog-card-detail"; group.textContent = entry.group;
      const preview = document.createElement("img"); preview.className = "catalog-preview"; preview.alt = "";
      preview.loading = "lazy"; preview.decoding = "async"; preview.referrerPolicy = "no-referrer";
      preview.src = M.cardPath({ endpoint, params: newCardParams(endpoint) });
      button.append(preview, label, group); button.title = entry.desc; container.append(button);
    }
    if (!container.children.length) { const hint = document.createElement("p"); hint.className = "field-hint"; hint.textContent = "일치하는 카드가 없습니다."; container.append(hint); }
  }
  $("card-search").addEventListener("input", renderCatalog);
  window.addEventListener("profilekit:localechange", () => { renderCatalog(); renderLayers(); });
  $("profile-username").addEventListener("change", renderCatalog);
  $("card-catalog").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-endpoint]"); if (!button) return;
    button.disabled = true;
    const card = { endpoint: button.dataset.endpoint, params: newCardParams(button.dataset.endpoint), sourceOrigin: Design.DEFAULT_ORIGIN };
    try {
      status(`${cardLabel(card.endpoint)} 카드를 불러오는 중…`);
      const size = await measureCard(card);
      const y = doc.elements.length ? Math.max(...doc.elements.map((element) => element.y + element.height)) + 16 : 0;
      if (y + size.height > 2048) throw new Error("캔버스 최대 높이(2048px)를 넘습니다. 카드를 줄이거나 옆으로 배치해 공간을 만든 뒤 추가하세요.");
      const element = M.createElement("card", { ...card, ...size, x: 0, y });
      if (transact((next) => { next.width = Math.max(next.width, size.width); next.height = Math.max(next.height, y + size.height); next.elements.push(element); }, element.id)) status("카드를 추가했습니다. 같은 테마를 적용하거나 자유롭게 배치하세요.");
    } catch (error) { status(error.message, true); }
    finally { button.disabled = false; }
  });
  $("fit-card-canvas").addEventListener("click", () => {
    if (selected()?.type !== "card") return;
    transact((next) => { const card = next.elements.find((item) => item.id === selectedId); next.width = Math.min(2048, card.width); next.height = Math.min(2048, card.height); card.x = 0; card.y = 0; next.background = "transparent"; });
  });
  $("theme-apply").replaceChildren(...window.ProfileKitCards.THEMES.map((theme) => { const option = document.createElement("option"); option.value = theme; option.textContent = theme.replace(/_/g, " "); return option; }));
  $("theme-apply").value = "tokyo_night";
  $("apply-theme").addEventListener("click", () => {
    if (!doc.elements.some((element) => element.type === "card")) { status("먼저 카드를 추가하세요.", true); return; }
    transact((next) => { for (const element of next.elements) if (element.type === "card") element.params.theme = $("theme-apply").value; });
  });
  for (const theme of ["dark", "light"]) $("preview-" + theme).addEventListener("click", () => {
    document.querySelector(".canvas-viewport").classList.toggle("preview-light", theme === "light");
    document.body.dataset.preview = theme;
    for (const value of ["dark", "light"]) $("preview-" + value).setAttribute("aria-pressed", String(value === theme));
  });
  const htmlEscape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function assetReadme() {
    const path = $("asset-path").value.trim();
    if (!path || /^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(path) || /[\u0000-\u001f\\?#]/.test(path) || path.split("/").includes("..")) throw new Error("저장소 안의 상대 경로를 사용하세요. 예: assets/profilekit.svg");
    return Design.readmeAsset(doc, path);
  }
  let verifiedDesignUrl = null;
  function canExportCards() {
    return !doc.provenance && doc.elements.length > 1 && doc.elements.every((element) => element.type === "card" && element.rotation === 0 && element.opacity === 1
      && !element.parts && !element.effect && !element.overflow && element.nativeWidth && element.nativeHeight && Math.abs(element.width / element.height - element.nativeWidth / element.nativeHeight) < 0.001);
  }
  function refreshEmbed() {
    $("embed-code").value = ""; $("embed-url").value = "";
    $("embed-copy").disabled = true; $("embed-download").disabled = true; $("verify-deployment").hidden = true;
    const cards = canExportCards() && $("export-mode").value === "cards";
    $("embed-url").closest("label").hidden = cards;
    $("export-mode-hint").textContent = cards ? "각 카드의 링크와 README 표시 너비를 유지합니다. 위에서 아래 순서로 넣으며, 캔버스의 간격과 겹침은 합친 이미지 방식에서 유지됩니다." : "현재 배치를 하나의 이미지로 만듭니다. 합친 이미지 안의 개별 카드는 따로 클릭할 수 없습니다.";
    try {
      const origin = M.normalizeOrigin($("deployment-origin").value.trim());
      const url = cards ? origin : Design.designUrl(doc, origin);
      $("embed-code").value = cards ? Design.readmeCards(doc, origin) : Design.readme(doc, origin);
      $("embed-url").value = cards ? "" : url;
      const address = new URL(url), local = ["localhost", "127.0.0.1", "[::1]"].includes(address.hostname);
      const composed = !cards && address.pathname === "/api/design";
      const needsVerification = composed && !local && verifiedDesignUrl !== url;
      $("verify-deployment").hidden = !needsVerification;
      $("embed-message").textContent = local ? "이 주소는 로컬 미리보기용입니다. README에서는 공개 배포 주소를 입력하거나 SVG 파일을 저장소에 넣으세요." : needsVerification ? "합친 이미지는 새 /api/design 기능이 배포된 주소가 필요합니다. 먼저 배포에서 이미지를 확인하세요." : composed ? "배포된 이미지가 열리는 것을 확인했습니다. 이 코드를 README에 넣으면 됩니다." : "기존 카드 URL을 사용합니다. 코드를 README에 붙여넣으면 됩니다. GitHub 이미지 캐시에 따라 변경 반영에 시간이 걸릴 수 있습니다.";
      $("embed-copy").disabled = local || needsVerification; $("embed-download").disabled = local || needsVerification;
    } catch (error) { $("embed-message").textContent = error.message; }
    try { $("asset-readme").value = assetReadme(); $("asset-copy").disabled = false; }
    catch (error) { $("asset-readme").value = error.message; $("asset-copy").disabled = true; }
  }
  $("verify-deployment").addEventListener("click", async () => {
    const button = $("verify-deployment"), url = $("embed-url").value; button.disabled = true;
    const image = new Image(); image.referrerPolicy = "no-referrer";
    const timer = setTimeout(() => { image.src = ""; }, 20000);
    try {
      image.src = url; await image.decode();
      if (url === $("embed-url").value) { verifiedDesignUrl = url; refreshEmbed(); }
    } catch { $("embed-message").textContent = "이미지를 확인하지 못했습니다. 이 주소에 새 버전이 배포되어 있는지 확인하거나 SVG 파일 방식을 사용하세요."; }
    finally { clearTimeout(timer); button.disabled = false; }
  });
  $("export-mode").addEventListener("change", refreshEmbed);
  $("deployment-origin").value = location.origin;
  $("embed-open").addEventListener("click", async () => {
    finishEdit();
    const button = $("embed-open"); button.disabled = true;
    if (nativeMeasurements.size) status("카드 크기를 확인한 뒤 README 코드를 준비합니다…");
    await waitForCardSizes(); button.disabled = false;
    const canSplit = canExportCards();
    $("export-mode-field").hidden = !canSplit;
    $("export-mode").value = canSplit ? "cards" : "design";
    if (!$("deployment-origin").dataset.edited) {
      try { $("deployment-origin").value = canSplit ? (doc.elements[0].sourceOrigin || location.origin) : new URL(Design.designUrl(doc)).origin; }
      catch { $("deployment-origin").value = location.origin; }
      // New multi-element designs need this deployment's newly implemented route.
      if (!canSplit && (doc.elements.length !== 1 || doc.elements[0].type !== "card" || doc.elements[0].parts || doc.elements[0].effect || doc.elements[0].overflow)) $("deployment-origin").value = location.origin;
    }
    refreshEmbed(); $("embed-dialog").showModal();
  });
  $("embed-close").addEventListener("click", () => $("embed-dialog").close());
  $("deployment-origin").addEventListener("input", () => { $("deployment-origin").dataset.edited = "true"; refreshEmbed(); });
  $("asset-path").addEventListener("input", refreshEmbed);
  async function copyCode(field) {
    try { await navigator.clipboard.writeText($(field).value); $("embed-message").textContent = "README 코드를 복사했습니다."; }
    catch { $(field).focus(); $(field).select(); $("embed-message").textContent = "복사가 제한됐습니다. 선택된 코드를 직접 복사하세요."; }
  }
  $("embed-copy").addEventListener("click", () => copyCode("embed-code"));
  $("asset-copy").addEventListener("click", () => copyCode("asset-readme"));
  $("embed-download").addEventListener("click", () => download(new Blob([$("embed-code").value + "\n"], { type: "text/markdown;charset=utf-8" }), "README.md"));
  renderCatalog();

  function renderInspector() {
    const element = selected();
    $("selection-empty").hidden = !!element; $("selection-panel").hidden = !element;
    $("edit-card-parts-tool").hidden = !Object.keys(partDefinitions(element)).length;
    if (!element) { partMode = false; return; }
    $("selection-type").textContent = ({ card: "ProfileKit 카드", text: "텍스트", image: "이미지", rect: "사각형", ellipse: "타원" })[element.type];
    $("card-controls").hidden = element.type !== "card";
    if (element.type === "card") renderCardInspector(element);
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
    renderDecorationInspector();
    window.dispatchEvent(new Event("profilekit:controls-render"));
  }
  function renderDecorationInspector() {
    const element = selected(); if (!element) return;
    $("card-overflow").checked = element.overflow === "visible";
    const definitions = partDefinitions(element), names = Object.keys(definitions);
    $("card-parts-controls").hidden = !names.length;
    if (partOwner !== element.id || $("card-part-select").dataset.definitions !== names.join(",")) {
      $("card-part-select").dataset.definitions = names.join(",");
      partOwner = element.id; partMode = false; partName = names[0] || "";
      $("card-part-select").replaceChildren(...names.map((name) => {
        const option = document.createElement("option"); option.value = name;
        option.textContent = ({ name: "이름", subtitle: "소개 문구", bg: "배경 효과", username: "카드 제목", repo: "저장소 이름", description: "저장소 설명" })[name] || definitions[name].label;
        return option;
      }));
    }
    if (!Object.hasOwn(definitions, partName)) { partName = names[0] || ""; partMode = false; }
    $("card-part-select").value = partName;
    $("card-part-edit").setAttribute("aria-pressed", String(partMode));
    $("edit-card-parts-tool").setAttribute("aria-pressed", String(partMode));
    $("card-part-edit").textContent = partMode ? "내부 편집 마치기" : "캔버스에서 직접 편집";
    if (partName) {
      const part = element.parts?.[partName] || { dx: 0, dy: 0, scale: 1 };
      for (const [id, key] of [["part-dx", "dx"], ["part-dy", "dy"], ["part-scale", "scale"], ["part-color", "color"], ["part-fill", "fill"], ["part-stroke", "stroke"]]) {
        if (document.activeElement !== $(id)) $(id).value = part[key] ?? (key === "scale" ? 1 : ["color", "fill", "stroke"].includes(key) ? "" : 0);
      }
      $("part-hidden").checked = !!part.hidden;
      $("part-color").disabled = !definitions[partName].color;
      $("part-color").closest("label").hidden = !definitions[partName].color;
      $("part-color-hint").hidden = !definitions[partName].color;
      $("part-paint-controls").hidden = !definitions[partName].paint;
      const entry = cardPreviews.get(M.cardPath(element));
      $("card-part-retry").hidden = !entry?.error;
      $("card-part-hint").textContent = entry?.error ? "미리보기를 불러오지 못했습니다. " + entry.error
        : partMode && !entry?.svg ? "카드 내부 요소를 불러오는 중…"
        : partMode && !visiblePartNode() ? "현재 카드에 이 요소가 없습니다. 카드 설정에서 내용을 넣거나 다른 요소를 선택하세요."
        : part.hidden ? "이 요소를 숨겼습니다. 체크를 해제하면 다시 표시됩니다."
        : partMode ? "선택한 요소를 직접 끌어 이동하세요. 모서리 핸들로 크기를 조절할 수 있습니다."
        : "카드 안의 요소를 꾸며도 계정 정보와 애니메이션은 유지됩니다.";
    }
    const previousEffect = pendingEdit?.elements.find((item) => item.id === element.id)?.effect;
    const effect = element.effect || (previousEffect ? { ...previousEffect, opacity: 0 } : { kind: "none", color: "#8b5cf6", blur: 12, opacity: .6, dx: 0, dy: 8 });
    $("element-effect-kind").value = effect.kind;
    $("effect-fields").hidden = effect.kind === "none";
    for (const key of ["color", "blur", "opacity", "dx", "dy"]) {
      const field = $("element-effect-" + key);
      if (document.activeElement !== field) field.value = effect[key];
    }
    window.dispatchEvent(new Event("profilekit:controls-render"));
  }
  function changePart(change) {
    if (!selected() || !partName) return;
    transact((next) => {
      const card = next.elements.find((element) => element.id === selectedId);
      card.parts = { ...card.parts };
      const part = { dx: 0, dy: 0, scale: 1, ...card.parts[partName] };
      change(part); card.parts[partName] = part;
    });
  }
  $("card-part-select").addEventListener("change", () => { finishGesture(); partName = $("card-part-select").value; renderSelection(); renderDecorationInspector(); });
  $("card-part-edit").addEventListener("click", () => {
    finishGesture(); finishEdit(); partMode = !partMode;
    if (partMode && cardPreviews.get(M.cardPath(selected()))?.error) cardPreviews.delete(M.cardPath(selected()));
    renderCanvas(); renderDecorationInspector();
    if (partMode) {
      host.focus({ preventScroll: true });
      if (matchMedia("(max-width: 700px)").matches) host.scrollIntoView({ block: "center" });
    }
  });
  $("edit-card-parts-tool").addEventListener("click", () => {
    $("card-parts-controls").open = true;
    $("card-part-edit").click();
  });
  $("card-part-retry").addEventListener("click", () => {
    if (selected()?.type !== "card") return;
    cardPreviews.delete(M.cardPath(selected())); partMode = true;
    renderCanvas(); renderDecorationInspector();
  });
  for (const key of ["dx", "dy", "scale", "color", "fill", "stroke"]) $("part-" + key).addEventListener("change", () => {
    const value = $("part-" + key).value;
    changePart((part) => { if (["color", "fill", "stroke"].includes(key)) { if (value.trim()) part[key] = value.trim(); else delete part[key]; } else part[key] = Number(value); });
  });
  for (const key of ["dx", "dy", "scale"]) $("part-" + key).addEventListener("input", () => {
    if (!selected() || !partName || $("part-" + key).value === "") return;
    const value = Number($("part-" + key).value);
    previewChange((next) => {
      const card = next.elements.find((item) => item.id === selectedId);
      card.parts = { ...card.parts, [partName]: { dx: 0, dy: 0, scale: 1, ...card.parts?.[partName], [key]: value } };
    });
  });
  $("card-overflow").addEventListener("change", () => {
    const visible = $("card-overflow").checked;
    transact((next) => {
      const card = next.elements.find((element) => element.id === selectedId);
      if (visible) card.overflow = "visible"; else delete card.overflow;
    });
  });
  $("part-hidden").addEventListener("change", () => changePart((part) => { part.hidden = $("part-hidden").checked; }));
  $("part-reset").addEventListener("click", () => {
    if (!selected() || !partName) return;
    transact((next) => { const card = next.elements.find((element) => element.id === selectedId); if (card.parts) delete card.parts[partName]; });
  });
  $("element-effect-kind").addEventListener("change", () => {
    if (!selected()) return;
    const kind = $("element-effect-kind").value;
    transact((next) => {
      const element = next.elements.find((item) => item.id === selectedId);
      if (kind === "none") delete element.effect;
      else element.effect = { kind, color: kind === "glow" ? "#8b5cf6" : "#000000", blur: 12, opacity: kind === "glow" ? .7 : .35, dx: 0, dy: kind === "glow" ? 0 : 8 };
    });
  });
  for (const key of ["color", "blur", "opacity", "dx", "dy"]) $("element-effect-" + key).addEventListener("change", () => {
    finishEdit();
    if (!selected()?.effect) { renderDecorationInspector(); return; }
    const value = $("element-effect-" + key).value;
    transact((next) => { next.elements.find((item) => item.id === selectedId).effect[key] = key === "color" ? value.trim() : Number(value); });
  });
  for (const key of ["blur", "opacity", "dx", "dy"]) $("element-effect-" + key).addEventListener("input", () => {
    const effect = selected()?.effect || pendingEdit?.elements.find((item) => item.id === selectedId)?.effect;
    if (!effect || $("element-effect-" + key).value === "") return;
    const value = Number($("element-effect-" + key).value);
    previewChange((next) => { const item = next.elements.find((item) => item.id === selectedId); item.effect = { ...effect, [key]: value }; });
  });
  $("effect-reset").addEventListener("click", () => {
    if (selected()?.effect) transact((next) => { delete next.elements.find((item) => item.id === selectedId).effect; });
  });
  $("effect-add-space").addEventListener("click", () => {
    const element = selected(); if (!element?.effect) return;
    const effect = element.effect;
    const padding = Math.max(16, Math.ceil(effect.blur * 3 + Math.max(Math.abs(effect.dx), Math.abs(effect.dy)) + (element.strokeWidth || 0) / 2 + 2));
    if (doc.width + padding * 2 > M.LIMITS.MAX_CANVAS || doc.height + padding * 2 > M.LIMITS.MAX_CANVAS) {
      status("캔버스 최대 크기를 넘습니다. 카드나 효과 크기를 줄인 뒤 여백을 추가하세요.", true); return;
    }
    if (transact((next) => {
      next.width += padding * 2; next.height += padding * 2;
      for (const item of next.elements) { item.x += padding; item.y += padding; }
    })) status("기존 배치를 유지하며 사방에 " + padding + "px 여백을 추가했습니다. 실행 취소로 되돌릴 수 있습니다.");
  });
  function render() {
    if (selectedId !== partOwner || !Object.keys(partDefinitions()).length) partMode = false;
    renderMeta(); renderCanvas(); renderLayers(); renderInspector();
  }
  function select(id) {
    finishEdit(); const wasEditing = partMode;
    if (selectedId !== id) partMode = false;
    selectedId = id;
    if (wasEditing && !partMode) renderCanvas(); else renderSelection();
    renderLayers(); renderInspector();
  }

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
  $("add-text").addEventListener("click", () => { add("text", { text: "Build something meaningful.", width: 460, height: 100, fontSize: 32, color: "#e6edf3" }); $("element-text").focus(); $("element-text").select(); });
  $("add-rect").addEventListener("click", () => add("rect", { width: 220, height: 140, fill: "#6366f1", radius: 12 }));
  $("add-ellipse").addEventListener("click", () => add("ellipse", { width: 160, height: 160, fill: "#22d3ee" }));
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
    const handleNode = event.target.closest("[data-handle], [data-handle-hit]");
    const handle = handleNode?.dataset.handle || handleNode?.dataset.handleHit;
    const target = event.target.closest("[data-element-id]");
    if (!handle && !target) { select(null); return; }
    event.preventDefault(); host.focus({ preventScroll: true }); finishEdit();
    if (target) select(target.dataset.elementId);
    const element = selected(); if (!element) return;
    let action = handle || "move";
    if (partMode && element.type === "card") {
      const partTarget = event.target.closest("[data-cas-target]")?.getAttribute("data-cas-target");
      if (partTarget && Object.hasOwn(partDefinitions(element), partTarget)) partName = partTarget;
      else if (handle !== "part-scale") return;
      if (element.parts?.[partName]?.hidden) return;
      action = handle === "part-scale" ? handle : "part-move";
      renderSelection(); renderDecorationInspector();
    }
    gesture = { pointerId: event.pointerId, before: clone(doc), original: clone({ elements: [element] }).elements[0], origin: point(event), action,
      part: partName, bounds: partBounds(), native: { width: element.nativeWidth || element.width, height: element.nativeHeight || element.height } };
    if (action === "part-move" || action === "part-scale") {
      const node = visiblePartNode();
      if (!node) { gesture = null; return; }
      let wrapper = node.parentElement;
      if (!element.parts?.[partName]) {
        wrapper = svgNode("g", {}); node.before(wrapper); wrapper.append(node);
      }
      gesture.partNode = node; gesture.partWrapper = wrapper;
    }
    clearTimeout(saveTimer);
    host.setPointerCapture(event.pointerId);
  });
  host.addEventListener("pointermove", (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const current = point(event), { original: original, origin, action } = gesture;
    const element = selected(); if (!element) return;
    const dx = current.x - origin.x, dy = current.y - origin.y;
    if (action === "part-move" || action === "part-scale") {
      const part = { dx: 0, dy: 0, scale: 1, ...original.parts?.[gesture.part] };
      const delta = rotated(dx, dy, -original.rotation * Math.PI / 180);
      if (action === "part-move") {
        part.dx = Math.max(-2048, Math.min(2048, part.dx + delta.x * gesture.native.width / original.width));
        part.dy = Math.max(-2048, Math.min(2048, part.dy + delta.y * gesture.native.height / original.height));
        if (event.shiftKey) {
          if (Math.abs(delta.x) >= Math.abs(delta.y)) part.dy = original.parts?.[gesture.part]?.dy || 0;
          else part.dx = original.parts?.[gesture.part]?.dx || 0;
        }
      } else {
        const extent = Math.max(24, gesture.bounds?.width || 100, gesture.bounds?.height || 30);
        part.scale = Math.max(.25, Math.min(4, part.scale * (1 + (dx + dy) / extent)));
      }
      element.parts = { ...element.parts, [gesture.part]: part };
    } else if (action === "move") {
      element.x = Math.round(original.x + dx); element.y = Math.round(original.y + dy);
      if (event.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) element.y = original.y; else element.x = original.x; }
    } else if (action === "resize") {
      const angle = original.rotation * Math.PI / 180;
      const delta = rotated(dx, dy, -angle);
      let width = Math.max(12, original.width + delta.x), height = Math.max(12, original.height + delta.y);
      if (event.shiftKey || (event.pointerType === "touch" && ["card", "image"].includes(original.type))) {
        const ratio = Math.max(1 / original.width, 1 / original.height,
          Math.min((original.width + delta.x) / original.width, 4096 / original.width, 4096 / original.height));
        width = original.width * ratio; height = original.height * ratio;
      }
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
    if (!frame) frame = requestAnimationFrame(() => {
      frame = null;
      if (gesture?.partNode?.isConnected) {
        // Change only the outer decoration transform: animated descendants keep
        // their DOM identity and animation clock throughout the gesture.
        const markup = Decoration.partMarkup(gesture.partNode.outerHTML, selected().parts[gesture.part]);
        const root = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}">${markup}</svg>`, "image/svg+xml").documentElement.firstElementChild;
        if (root !== null) {
          const transform = root.hasAttribute("data-cas-target") ? null : root.getAttribute("transform");
          if (transform) gesture.partWrapper.setAttribute("transform", transform);
          else gesture.partWrapper.removeAttribute("transform");
        }
        renderSelection();
      } else renderCanvas();
      renderInspector();
    });
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
    else if (Object.keys(partDefinitions()).length && !partMode) { $("card-parts-controls").open = true; $("card-part-edit").click(); }
  });
  host.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const target = event.target.closest("[data-element-id]");
      if (target) { event.preventDefault(); select(target.dataset.elementId); }
    }
  });
  new ResizeObserver(() => renderSelection()).observe(host);
  document.fonts?.addEventListener("loadingdone", () => { if (partMode) renderSelection(); });

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
  function confirmReplace() { return !dirty || confirm("다른 카드를 열까요? 현재 작업을 보관하려면 취소 후 ‘프로젝트 저장’을 눌러주세요. 변경 직후에는 실행 취소로 돌아갈 수 있습니다."); }
  function replaceDocument(next) {
    finishGesture();
    nativeMeasurements.clear();
    finishEdit(); pushHistory(clone(doc)); doc = M.normalizeDocument(next); selectedId = null;
    markChanged(); render();
  }
  $("template-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-preset]"); if (!button || !presets[button.dataset.preset]) return;
    if (!confirmReplace()) return;
    try {
      replaceDocument(presets[button.dataset.preset].make({ username: $("profile-username").value.trim() || "octocat" }));
      select(doc.elements[0]?.id || null);
      for (const item of $("template-list").querySelectorAll("[data-preset]")) {
        item.classList.toggle("is-selected", item === button); item.setAttribute("aria-pressed", String(item === button));
      }
    } catch (error) { status(error.message, true); }
  });
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const filename = (name) => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 80).trim() || "profilekit-card";
  async function saveProject() {
    finishEdit();
    await waitForCardSizes();
    try {
      download(new Blob([M.serializeDocument(doc)], { type: "application/json" }), filename(doc.name) + ".profilekit.json");
      dirty = false; status("원본 파일을 내보냈습니다. ‘열기’에서 이어서 편집할 수 있어요.");
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
  // Resolve only this deployment's allowlisted renderers; do not embed remote SVG
  // supplied by an imported document. Uploaded rasters remain in the local file.
  async function standaloneSVG(snapshot) {
    const cardMarkup = Object.create(null);
    await Promise.all(snapshot.elements.filter((element) => element.type === "card").map(async (element) => {
      cardMarkup[element.id] = await fetchCardSVG(element);
    }));
    return M.renderSVG(snapshot, { cardMarkup });
  }
  $("export-svg").addEventListener("click", async () => {
    finishEdit(); const button = $("export-svg"); button.disabled = true;
    try {
      await waitForCardSizes();
      const snapshot = clone(doc);
      const svg = await standaloneSVG(snapshot);
      download(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), filename(snapshot.name) + ".svg");
      status("SVG를 저장했습니다. 애니메이션은 유지되며 통계는 저장 시점의 값입니다.");
      $("embed-message").textContent = "SVG를 저장소에 올리고 파일용 README 코드를 사용하세요. 통계는 저장 시점의 값이며 URL 방식은 계속 갱신됩니다.";
    } catch (error) { status(error.message, true); $("embed-message").textContent = error.message; }
    finally { button.disabled = false; }
  });
  $("export-png").addEventListener("click", async () => {
    finishEdit(); const button = $("export-png"); button.disabled = true;
    let url;
    try {
      await waitForCardSizes();
      const snapshot = clone(doc);
      url = URL.createObjectURL(new Blob([await standaloneSVG(snapshot)], { type: "image/svg+xml;charset=utf-8" }));
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = snapshot.width * 2; canvas.height = snapshot.height * 2;
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("PNG 변환에 실패했습니다.");
      download(blob, filename(snapshot.name) + ".png"); status("정지 이미지 PNG를 2배 해상도로 저장했습니다.");
    } catch (error) { status(error.message, true); $("embed-message").textContent = error.message; }
    finally { if (url) URL.revokeObjectURL(url); button.disabled = false; }
  });
  window.addEventListener("keydown", (event) => {
    const mod = event.metaKey || event.ctrlKey;
    const editing = event.target.closest("input,textarea,select,[contenteditable]");
    if (mod && event.key.toLowerCase() === "s") { event.preventDefault(); saveProject(); return; }
    if (event.key === "Escape") {
      if (gesture) finishGesture(true);
      else if (partMode) { partMode = false; renderCanvas(); renderDecorationInspector(); }
      else { document.activeElement.blur(); select(null); }
      return;
    }
    if (editing && !(event.target.matches('input[type="range"]') && mod && ["z", "y"].includes(event.key.toLowerCase()))) return;
    if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); travel(!event.shiftKey); }
    else if (mod && event.key.toLowerCase() === "y") { event.preventDefault(); travel(false); }
    else if (mod && event.key.toLowerCase() === "d") {
      event.preventDefault();
      if (partMode) status("내부 편집을 마친 뒤 카드를 복제할 수 있습니다."); else duplicateSelected();
    }
    else if (["Delete", "Backspace"].includes(event.key) && selected()) {
      event.preventDefault();
      if (partMode) changePart((part) => { part.hidden = true; }); else removeSelected();
    }
    else if (event.key.startsWith("Arrow") && selected()) {
      event.preventDefault(); const amount = event.shiftKey ? 10 : 1;
      if (partMode) {
        changePart((part) => {
          if (event.key === "ArrowLeft") part.dx -= amount;
          if (event.key === "ArrowRight") part.dx += amount;
          if (event.key === "ArrowUp") part.dy -= amount;
          if (event.key === "ArrowDown") part.dy += amount;
        });
        return;
      }
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
      status("다른 탭에서 초안이 변경됐습니다. 이 탭의 작업은 ‘프로젝트 저장’으로 보관하세요.", true);
    }
  });
  let legacyDraft = null;
  try { legacyDraft = localStorage.getItem("profilekit.editor.v1"); $("legacy-recover").hidden = !legacyDraft; }
  catch { /* Storage can be unavailable in private browsing. */ }
  $("legacy-recover").addEventListener("click", () => {
    try {
      if (!confirmReplace()) return;
      replaceDocument(M.parseDocument(legacyDraft)); select(doc.elements[0]?.id || null);
      status("이전 버전의 초안을 복원했습니다. 프로젝트로 저장해 계속 편집할 수 있습니다.");
    } catch (error) { status(error.message, true); }
  });
  window.ProfileKitEditor = Object.freeze({
    async snapshot() {
      finishGesture(); finishEdit(); await waitForCardSizes();
      return M.parseDocument(M.serializeDocument(doc));
    },
    source() { return doc.provenance ? { id: doc.provenance.id, version: doc.provenance.version } : null; },
    selectedIds() { return selectedId ? [selectedId] : []; },
    apply(next, expected) {
      finishGesture(); finishEdit();
      if (M.serializeDocument(doc) !== expected) throw new Error("The project changed. Review a fresh proposal before applying it.");
      replaceDocument(next); select(doc.elements[0]?.id || null);
    },
    preview: standaloneSVG,
    status,
  });
  document.body.inert = true;
  try {
  try { lastStoredDraft = await readDraft(); if (lastStoredDraft) { doc = M.parseDocument(lastStoredDraft); dirty = true; selectedId = doc.elements[0]?.id || null; } }
  catch { draftError = true; }
  render();
  if (gallerySource && !handoffToken) {
    try {
      const response = await fetch(`/api/gallery?id=${galleryId}&version=${galleryVersion}`);
      const record = await response.json();
      if (!response.ok) throw new Error(record.error?.message || record.error || "Gallery card could not be opened.");
      if (!lastStoredDraft || draftError) replaceDocument(M.withGallerySource(record.document, record, location.origin));
      select(doc.elements[0]?.id || null);
      status("갤러리 카드의 독립적인 사본을 열었습니다. 원본은 바뀌지 않습니다.");
    } catch (error) { status(error.message, true); }
    return;
  }
  if (handoffToken) {
    $("readme-return").hidden = false;
    $("readme-return-cancel").hidden = false;
    $("readme-return").disabled = true;
    try {
      const record = await Transfer.get(handoffKey);
      if (!record || record.version !== 1 || typeof record.originalUrl !== "string" || typeof record.cardId !== "string" || !record.project) throw new Error("README 연결이 만료됐습니다. README에서 카드를 다시 열어 주세요.");
      readmeHandoff = record;
      if (record.assetDocument) {
        const assetDoc = M.parseDocument(record.assetDocument);
        if (!lastStoredDraft || draftError) replaceDocument(assetDoc);
        select(doc.elements[0]?.id || null); await rememberHandoffDocument();
        handoffReady = true; $("readme-return").disabled = false;
        status("저장한 SVG의 편집 원본을 열었습니다. 변경 후 SVG를 다시 저장해 README에 반영하세요.");
        return;
      }
      const url = new URL(record.originalUrl);
      const importUrl = new URL(url); importUrl.hash = "";
      const imported = Design.parseDesignInput(importUrl.href, url.origin);
      if (!imported) Design.parseCardInput(importUrl.href, url.origin);
      readmeHandoff = record;
      $("import-card-input").value = importUrl.href;
      if (lastStoredDraft && !draftError) {
        handoffReady = true; $("readme-return").disabled = false;
        status("README에서 꾸미던 카드를 복원했습니다. 반영하면 원래 자리의 카드만 바뀝니다.");
      } else $("import-card-button").click();
    } catch (error) { status(error.message, true); }
    return;
  }
  if (draftError) status("이전 임시 저장을 열지 못했습니다. 저장해 둔 원본 파일을 열어주세요.", true);
  else status("기존 카드 URL을 불러오거나 카드를 골라 편집한 뒤, README에 넣기를 누르세요.");
  } finally { document.body.inert = false; window.dispatchEvent(new Event("profilekit:editor-ready")); }
})();
