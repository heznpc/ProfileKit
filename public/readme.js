/* Edit URL spans in the original README; the preview never becomes export data. */
(function () {
  "use strict";
  const Model = window.ProfileKitReadmeModel;
  const Preview = window.ProfileKitReadmePreview;
  const Schema = window.ProfileKitCards;
  const $ = (id) => document.getElementById(id);
  const DRAFT_KEY = "profilekit.readme-document.v1";
  const MAX_BYTES = 1024 * 1024;
  let source = "", sourceViewValue = "", name = "README.md", parsed = { cards: [], warnings: [] };
  let selectedId = null, checked = new Set(), past = [], future = [];
  let theme = "dark", device = "desktop", view = "preview", dirty = false;
  let savedDraft = null, storageConflict = false, persisted = true, saveTimer, previewTimer;
  let lastSummary = "";
  const labels = {
    username: "GitHub 계정", github: "GitHub 계정", repo: "저장소", name: "이름",
    title: "제목", subtitle: "소개", text: "문구", theme: "테마", font: "글꼴",
    color: "색상", accent_color: "강조색", bg_color: "배경색", text_color: "글자색",
    width: "카드 너비", height: "카드 높이", card_width: "카드 너비", layout: "구성",
    density: "밀도", speed: "속도", seed: "효과 시드", bg: "배경 효과", align: "정렬",
    border_radius: "모서리", hide_border: "테두리 숨김", hide_title: "제목 숨김",
    hide_bar: "상단 바 숨김", items: "항목", tags: "태그", lines: "줄 내용",
    description: "설명", email: "이메일", website: "웹사이트", animate: "애니메이션",
  };
  function status(message, error) {
    $("readme-status").textContent = message;
    $("readme-status").classList.toggle("is-error", !!error);
  }
  function options() { return { origin: $("readme-origin").value.trim() || "https://profilekit.vercel.app" }; }
  function selected() { return parsed.cards.find((card) => card.id === selectedId); }
  function assertSource(value) {
    if (typeof value !== "string" || new TextEncoder().encode(value).length > MAX_BYTES) throw new Error("README는 1MB 이하의 텍스트여야 합니다.");
    return value;
  }
  function label(card) { return Schema.CARDS[card.endpoint]?.label || card.endpoint; }
  function branchLabel(card) { return ({ dark: "어두운 화면", light: "밝은 화면", default: "공통" })[card.variant] || "공통"; }
  function snapshot() {
    return { source, selectedId, checked: Array.from(checked), fromAccount: $("batch-from-account").value, toAccount: $("batch-account").value };
  }
  function pushHistory() {
    past.push(snapshot());
    let bytes = 0;
    past = past.reverse().filter((item, index) => { bytes += item.source.length * 2; return index < 40 && bytes <= 12 * MAX_BYTES; }).reverse();
    future = [];
  }
  function scan(value) { return Model.scan(assertSource(value), options()); }
  function reconcileSelection(cards) {
    const identity = (card) => JSON.stringify([card.raw, card.endpoint, card.syntax, card.attribute, card.variant, card.alt, card.width]);
    const available = new Map(), previousCounts = new Map();
    for (const card of parsed.cards) {
      const key = identity(card);
      previousCounts.set(key, (previousCounts.get(key) || 0) + 1);
    }
    for (const card of cards) {
      const key = identity(card);
      if (!available.has(key)) available.set(key, []);
      available.get(key).push(card.id);
    }
    const nextChecked = new Set();
    let nextSelected = null, ambiguous = false;
    for (const card of parsed.cards) {
      const key = identity(card), matches = available.get(key);
      if (previousCounts.get(key) > 1 || matches?.length > 1) {
        if (checked.has(card.id)) ambiguous = true;
        continue;
      }
      const id = matches?.[0];
      if (!id) continue;
      if (checked.has(card.id)) nextChecked.add(id);
      if (selectedId === card.id) nextSelected = id;
    }
    checked = nextChecked; selectedId = nextSelected;
    return ambiguous;
  }
  function commit(value, message, resetSelection, reconcile) {
    try {
      const next = scan(value);
      if (value !== source) { pushHistory(); source = value; dirty = true; persisted = false; }
      if (reconcile && reconcileSelection(next.cards)) message += " 중복 카드의 선택은 해제했으니 변경할 카드를 다시 선택하세요.";
      parsed = next;
      const ids = new Set(parsed.cards.map((card) => card.id));
      checked = resetSelection ? ids : new Set(Array.from(checked).filter((id) => ids.has(id)));
      if (!ids.has(selectedId) || resetSelection) selectedId = parsed.cards[0]?.id || null;
      $("readme-source").value = source;
      sourceViewValue = $("readme-source").value;
      if (resetSelection) {
        inferAccount();
        if ($("readme-card-details")) $("readme-card-details").open = false;
      }
      if (message) lastSummary = message;
      render();
      queueSave();
      status(message || (parsed.cards.length + "개 카드 주소를 찾았습니다. 원문과 배치는 유지됩니다."));
      return true;
    } catch (error) { status(error.message, true); return false; }
  }
  function flushSource() {
    return $("readme-source").value === sourceViewValue || commit($("readme-source").value, "README 원문을 반영했습니다. 기존 카드 선택을 유지하고 새 카드는 선택하지 않았습니다.", false, true);
  }
  function inferAccount() {
    const counts = new Map();
    for (const card of parsed.cards) {
      if (["stats", "languages", "reviews"].includes(card.endpoint) && card.params.username) counts.set(card.params.username, (counts.get(card.params.username) || 0) + 1);
      if (card.endpoint === "social" && card.params.github) counts.set(card.params.github, (counts.get(card.params.github) || 0) + 1);
    }
    $("batch-from-account").value = Array.from(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    $("batch-account").value = "";
  }
  function render() {
    renderCards(); renderInspector(); renderSummary(); renderPreview();
    $("readme-name").value = name;
    $("readme-undo").disabled = !past.length;
    $("readme-redo").disabled = !future.length;
    for (const id of ["readme-copy", "readme-download", "readme-project-save"]) $(id).disabled = !source;
    $("batch-apply").disabled = !checked.size;
    $("readme-empty").hidden = !!source;
  }
  function renderCards() {
    const container = $("readme-card-list"); container.replaceChildren();
    $("card-count").textContent = String(parsed.cards.length);
    if (!parsed.cards.length) {
      const hint = document.createElement("p"); hint.className = "field-hint";
      hint.textContent = source ? "편집 가능한 ProfileKit 이미지가 없습니다. 원문은 그대로 내보낼 수 있습니다." : "README를 불러오면 사용 중인 카드가 여기에 표시됩니다.";
      container.append(hint);
    }
    let groupId = null, groupContainer = container, groupNumber = 0;
    for (const card of parsed.cards) {
      const picture = card.groupId?.startsWith("picture") ? card.groupId : null;
      if (picture && picture !== groupId) {
        groupContainer = document.createElement("div"); groupContainer.className = "readme-card-group";
        const caption = document.createElement("p"); caption.className = "readme-group-label";
        caption.textContent = "화면별 이미지 " + (++groupNumber); groupContainer.append(caption); container.append(groupContainer);
      } else if (!picture) groupContainer = container;
      groupId = picture;
      const item = document.createElement("div"); item.className = "readme-card-item";
      item.classList.toggle("is-selected", card.id === selectedId);
      const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.className = "readme-card-select";
      checkbox.checked = checked.has(card.id); checkbox.dataset.checkId = card.id;
      checkbox.setAttribute("aria-label", label(card) + " " + branchLabel(card) + " 일괄 변경 선택");
      const button = document.createElement("button"); button.type = "button"; button.className = "readme-card-button"; button.dataset.cardId = card.id;
      button.setAttribute("aria-pressed", String(card.id === selectedId));
      const title = document.createElement("strong"); title.className = "readme-card-name"; title.textContent = label(card);
      const branch = document.createElement("span"); branch.className = "readme-card-branch"; branch.dataset.branch = card.variant; branch.textContent = branchLabel(card);
      const meta = document.createElement("span"); meta.className = "readme-card-meta";
      meta.textContent = card.params.username || card.params.github || card.params.name || card.params.title || card.params.text || "/" + card.endpoint;
      const layout = document.createElement("span"); layout.className = "readme-card-meta";
      layout.textContent = [card.width ? "표시 너비 " + card.width : "", card.uses > 1 ? card.uses + "곳에서 사용" : "", card.groupId?.startsWith("picture") ? "테마별 이미지" : ""].filter(Boolean).join(" · ");
      button.append(title, branch, meta); if (layout.textContent) button.append(layout);
      item.append(checkbox, button); groupContainer.append(item);
    }
    $("select-all").disabled = !parsed.cards.length; $("select-none").disabled = !checked.size;
  }
  function renderInspector() {
    const card = selected(), container = $("readme-params"); container.replaceChildren();
    $("readme-card-title").textContent = card ? label(card) + " · " + branchLabel(card) : "카드를 선택하세요";
    $("readme-card-apply").disabled = !card;
    $("readme-extra-params").disabled = !card;
    $("readme-extra-params").value = "";
    if (!card) return;
    const fields = Schema.CARDS[card.endpoint]?.params || [];
    for (const spec of fields) {
      const fieldLabel = document.createElement("label"); fieldLabel.className = "field";
      const caption = document.createElement("span"); caption.textContent = (card.endpoint === "leetcode" && spec.name === "username") ? "LeetCode 계정" : labels[spec.name] || spec.name;
      const select = ["select", "boolean"].includes(spec.type);
      const field = document.createElement(select ? "select" : "input");
      field.id = "readme-param-" + spec.name; field.dataset.param = spec.name; field.dataset.paramType = spec.type;
      if (select) {
        const values = [...new Set(["", ...(spec.type === "boolean" ? ["true", "false"] : spec.options), card.params[spec.name] ?? ""])];
        for (const value of values) {
          const option = document.createElement("option"); option.value = value;
          option.textContent = value === "" ? "기본값" : value === "true" ? "켜기" : value === "false" ? "끄기" : value;
          field.append(option);
        }
      } else {
        field.type = spec.type === "number" ? "number" : "text";
        if (spec.type === "number") field.step = "any";
        field.spellcheck = false; field.placeholder = spec.placeholder || (spec.default !== undefined ? String(spec.default) : "기본값");
      }
      field.value = card.params[spec.name] ?? ""; field.dataset.original = field.value;
      fieldLabel.append(caption, field); container.append(fieldLabel);
    }
    const known = new Set(fields.map((spec) => spec.name));
    $("readme-extra-params").value = new URLSearchParams(Object.entries(card.params).filter(([key]) => !known.has(key))).toString();
    $("readme-extra-params").dataset.original = $("readme-extra-params").value;
  }
  function renderSummary() {
    const container = $("change-summary"); container.replaceChildren();
    if (lastSummary) { const p = document.createElement("p"); p.textContent = lastSummary; container.append(p); }
    for (const warning of parsed.warnings || []) {
      const p = document.createElement("p"); p.className = "field-hint"; p.textContent = typeof warning === "string" ? warning : warning.message; container.append(p);
    }
  }
  function renderPreview() {
    clearTimeout(previewTimer);
    $("readme-preview-frame").dataset.device = device;
    $("readme-preview-frame").dataset.theme = theme;
    $("readme-preview").style.colorScheme = theme;
    for (const value of ["dark", "light"]) $("readme-preview-" + value).setAttribute("aria-pressed", String(value === theme));
    for (const value of ["desktop", "mobile"]) $("readme-preview-" + value).setAttribute("aria-pressed", String(value === device));
    if (view !== "preview") return;
    try {
      $("readme-preview").srcdoc = Preview.render(source, { theme, repository: $("readme-repository").value.trim(), ...options() });
    } catch (error) { status("미리보기를 만들지 못했습니다: " + error.message, true); }
  }
  function setView(next) {
    if (next === "preview" && !flushSource()) return;
    view = next;
    $("readme-preview-pane").hidden = view !== "preview"; $("readme-source-pane").hidden = view !== "source";
    for (const value of ["preview", "source"]) $("readme-view-" + value).setAttribute("aria-selected", String(value === view));
    if (view === "source") $("readme-source").focus();
    else requestAnimationFrame(() => { if (view === "preview") renderPreview(); });
  }
  $("readme-view-preview").addEventListener("click", () => setView("preview"));
  $("readme-view-source").addEventListener("click", () => setView("source"));
  for (const id of ["readme-show-import", "readme-empty-import"]) $(id)?.addEventListener("click", () => setView("source"));
  $("readme-source").addEventListener("input", () => {
    dirty = true;
    status("원문을 편집 중입니다. ‘README 불러오기’ 또는 미리보기에서 반영합니다.");
    for (const id of ["readme-copy", "readme-download", "readme-project-save"]) $(id).disabled = !$("readme-source").value;
  });
  $("readme-source").addEventListener("change", flushSource);
  $("readme-import").addEventListener("click", () => {
    const value = $("readme-source").value === sourceViewValue ? source : $("readme-source").value;
    if (commit(value, null, true)) setView("preview");
  });
  $("readme-open").addEventListener("click", () => $("readme-file").click());
  async function readFile(file) {
    if (!file || file.size > MAX_BYTES) throw new Error("파일은 1MB 이하여야 합니다.");
    try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer()); }
    catch { throw new Error("UTF-8로 저장한 README 파일을 사용해 주세요."); }
  }
  $("readme-file").addEventListener("change", async (event) => {
    const file = event.target.files[0]; event.target.value = ""; if (!file) return;
    try {
      const value = await readFile(file);
      if (commit(value, file.name + "을 불러왔습니다. 수정하지 않은 내용과 배치는 그대로 유지됩니다.", true)) {
        name = file.name.slice(0, 120); $("readme-name").value = name; setView("preview"); queueSave();
      }
    } catch (error) { status(error.message, true); }
  });
  $("readme-card-list").addEventListener("change", (event) => {
    const id = event.target.dataset.checkId; if (!id) return;
    if (event.target.checked) checked.add(id); else checked.delete(id);
    $("batch-apply").disabled = !checked.size; $("select-none").disabled = !checked.size;
  });
  $("readme-card-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-card-id]"); if (!button || !flushSource()) return;
    selectedId = button.dataset.cardId; renderCards(); renderInspector();
    if ($("readme-card-details")) $("readme-card-details").open = true;
  });
  $("select-all").addEventListener("click", () => { checked = new Set(parsed.cards.map((card) => card.id)); renderCards(); $("batch-apply").disabled = !checked.size; });
  $("select-none").addEventListener("click", () => { checked.clear(); renderCards(); $("batch-apply").disabled = true; });
  $("readme-card-apply").addEventListener("click", () => {
    if (!flushSource()) return;
    const card = selected(); if (!card) return;
    try {
      const params = { ...card.params };
      for (const field of $("readme-params").querySelectorAll("[data-param]")) {
        if (field.value === field.dataset.original) continue;
        if (field.value === "" && field.dataset.paramType !== "text") delete params[field.dataset.param];
        else params[field.dataset.param] = field.value;
      }
      const extra = $("readme-extra-params");
      if (extra.value !== extra.dataset.original) {
        const known = new Set((Schema.CARDS[card.endpoint]?.params || []).map((spec) => spec.name));
        for (const key of Object.keys(params)) if (!known.has(key)) delete params[key];
        const seen = new Set();
        for (const [key, value] of new URLSearchParams(extra.value.trim().replace(/^\?/, ""))) {
          if (known.has(key) || seen.has(key)) throw new Error("중복 매개변수입니다: " + key);
          seen.add(key); params[key] = value;
        }
      }
      const next = Model.applyUpdates(source, [{ id: card.id, params }], options());
      commit(next, label(card) + " 설정을 반영했습니다. 주변 글·링크·배치는 그대로 유지됩니다.");
    } catch (error) { status(error.message, true); }
  });
  function fillSelect(id, values) {
    const select = $(id); select.replaceChildren();
    for (const value of ["", ...values]) {
      const option = document.createElement("option"); option.value = value; option.textContent = value || "변경하지 않음"; select.append(option);
    }
  }
  for (const id of ["batch-theme", "batch-dark-theme", "batch-light-theme"]) fillSelect(id, Schema.THEMES);
  fillSelect("batch-font", ["inter", "space-grotesk", "jetbrains-mono", "ibm-plex-sans", "manrope"]);
  $("batch-apply").addEventListener("click", () => {
    if (!flushSource() || !checked.size) return;
    try {
      const config = {
        ids: Array.from(checked), fromAccount: $("batch-from-account").value.trim(), toAccount: $("batch-account").value.trim(),
        theme: $("batch-theme").value, darkTheme: $("batch-dark-theme").value, lightTheme: $("batch-light-theme").value,
        font: $("batch-font").value, accentColor: $("batch-accent").value.trim(),
        resetColors: $("batch-reset-colors").checked, includeRepositories: $("batch-include-repos").checked,
      };
      for (const key of ["fromAccount", "toAccount", "theme", "darkTheme", "lightTheme", "font", "accentColor"]) if (!config[key]) delete config[key];
      const result = Model.batchUpdate(source, config, options());
      const keys = [...new Set(result.changes.flatMap((change) => change.keys || []))];
      const message = result.changedCards ? result.changedCards + "개 카드 변경 · " + keys.map((key) => labels[key] || key).join(", ") : "변경된 카드가 없습니다. 대상 카드와 계정·스타일 설정을 확인하세요.";
      if (commit(result.source, message)) {
        const container = $("change-summary");
        for (const warning of result.warnings || []) { const p = document.createElement("p"); p.className = "field-hint"; p.textContent = typeof warning === "string" ? warning : warning.message; container.append(p); }
        if (config.toAccount && result.changedCards) $("batch-from-account").value = config.toAccount;
      }
    } catch (error) { status(error.message, true); }
  });
  function travel(backward) {
    if (!flushSource()) return;
    const from = backward ? past : future, to = backward ? future : past;
    if (!from.length) return;
    const next = from.pop(); to.push(snapshot());
    source = next.source; selectedId = next.selectedId; checked = new Set(next.checked); parsed = scan(source);
    $("batch-from-account").value = next.fromAccount;
    $("batch-account").value = next.toAccount;
    $("readme-source").value = source; sourceViewValue = $("readme-source").value; dirty = true; persisted = false;
    lastSummary = backward ? "마지막 변경을 되돌렸습니다." : "변경을 다시 적용했습니다.";
    render(); queueSave(); status(lastSummary);
  }
  $("readme-undo").addEventListener("click", () => travel(true));
  $("readme-redo").addEventListener("click", () => travel(false));
  for (const value of ["dark", "light"]) $("readme-preview-" + value).addEventListener("click", () => { theme = value; renderPreview(); queueSave(); });
  for (const value of ["desktop", "mobile"]) $("readme-preview-" + value).addEventListener("click", () => { device = value; renderPreview(); queueSave(); });
  $("readme-repository").addEventListener("change", () => { renderPreview(); queueSave(); });
  $("readme-origin").addEventListener("change", () => {
    if (flushSource()) commit(source, "이 배포의 카드 주소를 다시 확인했습니다.", true);
  });
  $("readme-name").addEventListener("change", () => { name = $("readme-name").value.trim().slice(0, 120) || "README.md"; queueSave(); });
  function project() { return { kind: "profilekit-readme", version: 1, name, source, repository: $("readme-repository").value.trim(), origin: options().origin, theme, device }; }
  function parseProject(raw) {
    if (raw?.kind !== "profilekit-readme" || raw.version !== 1) throw new Error("ProfileKit README 프로젝트 파일이 아닙니다.");
    assertSource(raw.source);
    if (typeof raw.name !== "string" || raw.name.length > 120 || typeof raw.repository !== "string" || raw.repository.length > 200 || typeof raw.origin !== "string") throw new Error("프로젝트 설정이 올바르지 않습니다.");
    window.ProfileKitEditorModel.normalizeOrigin(raw.origin);
    return raw;
  }
  function loadProject(raw) {
    const value = parseProject(raw);
    Model.scan(value.source, { origin: value.origin });
    $("readme-origin").value = value.origin; $("readme-repository").value = value.repository;
    name = value.name; theme = value.theme === "light" ? "light" : "dark"; device = value.device === "mobile" ? "mobile" : "desktop";
    commit(value.source, "README 프로젝트를 열었습니다.", true); setView("preview");
  }
  function filename(value) { return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 120).trim() || "README.md"; }
  function download(text, file, type) {
    const url = URL.createObjectURL(new Blob([text], { type })), link = document.createElement("a");
    link.href = url; link.download = file; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  $("readme-download").addEventListener("click", () => {
    if (!flushSource()) return;
    const file = filename(name);
    download(source, /\.md$/i.test(file) ? file : file + ".md", "text/markdown;charset=utf-8");
    status("README 파일을 저장했습니다. 저장소의 README.md에 반영하면 됩니다.");
  });
  $("readme-copy").addEventListener("click", async () => {
    if (!flushSource()) return;
    try { await navigator.clipboard.writeText(source); status("README 전체를 복사했습니다."); }
    catch { setView("source"); $("readme-source").select(); status("클립보드가 제한되어 원문을 선택했습니다. 직접 복사하세요."); }
  });
  $("readme-project-save").addEventListener("click", () => {
    if (!flushSource()) return;
    download(JSON.stringify(project(), null, 2), filename(name.replace(/\.md$/i, "")) + ".profilekit-readme.json", "application/json");
    dirty = false; status("README와 편집 설정을 프로젝트 파일로 저장했습니다.");
  });
  $("readme-project-open").addEventListener("click", () => $("readme-project-file").click());
  $("readme-project-file").addEventListener("change", async (event) => {
    const file = event.target.files[0]; event.target.value = ""; if (!file) return;
    try {
      if (file.size > MAX_BYTES * 3) throw new Error("프로젝트 파일은 3MB 이하여야 합니다.");
      loadProject(JSON.parse(await file.text()));
    } catch (error) { status(error.message, true); }
  });
  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 400); }
  function saveDraft() {
    clearTimeout(saveTimer);
    try {
      if (storageConflict || localStorage.getItem(DRAFT_KEY) !== savedDraft) {
        storageConflict = true; status("다른 탭에서 초안이 바뀌었습니다. 이 탭의 작업은 프로젝트 파일로 저장하세요.", true); return;
      }
      const value = JSON.stringify(project()); localStorage.setItem(DRAFT_KEY, value); savedDraft = value; persisted = true;
    } catch { persisted = false; status("브라우저 저장 공간이 부족합니다. 프로젝트 파일로 작업을 보관하세요.", true); }
  }
  window.addEventListener("storage", (event) => {
    if (event.key === DRAFT_KEY && event.newValue !== savedDraft) {
      storageConflict = true; status("다른 탭에서 초안이 변경됐습니다. 작업을 덮어쓰지 않도록 이 탭의 자동 저장을 멈췄습니다.", true);
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if ($("readme-source").value !== sourceViewValue || (dirty && (storageConflict || !persisted))) { event.preventDefault(); event.returnValue = ""; }
    else saveDraft();
  });
  try {
    savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) { loadProject(JSON.parse(savedDraft)); past = []; future = []; dirty = false; }
  } catch { status("이전 초안을 열 수 없습니다. 파일을 불러오거나 README 원문을 붙여넣어 주세요.", true); }
  render();
})();
