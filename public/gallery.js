(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.ProfileKitGallery = api; api.start(root); }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";
  const ID = /^[a-f0-9]{32}$/;
  const TOKEN = /^[A-Za-z0-9_-]{43}$/;
  const KEY_STORE = "profilekit.gallery.edit-keys.v1";
  const TRANSFER_KEY = "profilekit.gallery.publish";
  const LICENSES = Object.freeze({
    "CC-BY-4.0": { label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    "CC0-1.0": { label: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  });
  function validId(id) { if (typeof id !== "string" || !ID.test(id)) throw new Error("Invalid gallery design ID"); return id; }
  function validVersion(version) { if (!Number.isInteger(version) || version < 1 || version > 100) throw new Error("Invalid gallery version"); return version; }
  function designURL(id, version, format) {
    const query = new URLSearchParams({ id: validId(id) });
    if (version !== undefined) query.set("version", String(validVersion(version)));
    if (format === "svg") query.set("format", "svg");
    return `/api/gallery?${query}`;
  }
  function editorURL(id, version) { return `/editor.html#gallery=${validId(id)}&version=${validVersion(version)}`; }
  function metadata(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid gallery response");
    validId(raw.id); validVersion(raw.version);
    if (typeof raw.title !== "string" || typeof raw.author !== "string" || typeof raw.description !== "string"
      || !Object.hasOwn(LICENSES, raw.license) || !Array.isArray(raw.tags) || raw.tags.some((tag) => typeof tag !== "string")) throw new Error("Invalid gallery metadata");
    return raw;
  }
  function publishSource(document, origin, fallback = null) {
    const source = document?.provenance || fallback;
    if (!source) return null;
    validId(source.id); validVersion(source.version);
    if (source.origin && source.origin !== new URL(origin).origin) {
      const error = new Error("This project's original design belongs to another gallery");
      error.code = "foreign_source"; error.origin = source.origin;
      throw error;
    }
    return { id: source.id, version: source.version };
  }
  function licenseGuidance(item) {
    if (item.license === "CC-BY-4.0") return "attributionRequired";
    const ancestors = Array.isArray(item.attributions) ? item.attributions : item.source ? [item.source] : [];
    return ancestors.some((source) => source.license === "CC-BY-4.0") ? "ancestorAttributionRequired" : "publicDomain";
  }
  function recoveryFile(id, editToken, title = "") {
    validId(id);
    if (typeof editToken !== "string" || !TOKEN.test(editToken)) throw new Error("Invalid gallery editing key");
    if (typeof title !== "string" || title.length > 200) throw new Error("Invalid design title");
    return { kind: "profilekit-gallery-edit-key", version: 1, id, editToken, title };
  }
  function parseRecoveryFile(source) {
    if (typeof source !== "string" || source.length > 8192) throw new Error("Editing key file must be JSON text under 8 KB");
    let value;
    try { value = JSON.parse(source); } catch { throw new Error("Editing key file is not valid JSON"); }
    if (!value || typeof value !== "object" || Array.isArray(value) || value.kind !== "profilekit-gallery-edit-key" || value.version !== 1
      || Object.keys(value).some((key) => !["kind", "version", "id", "editToken", "title"].includes(key))) throw new Error("Unsupported gallery editing key file");
    return recoveryFile(value.id, value.editToken, value.title || "");
  }

  const messages = {
    ancestorAttributionRequired: ["This creator's contribution is under CC0. Earlier designs still require attribution: credit their creators, link their CC BY 4.0 licenses, and indicate your changes when sharing this design.", "이 제작자의 기여분은 CC0으로 공개되었습니다. 바탕이 된 작품의 출처 표시 의무는 유지됩니다. 공유할 때 원작자와 CC BY 4.0 라이선스를 표시하고 변경 사실을 밝혀 주세요."],
    foreignSource: ["This project comes from another gallery ({origin}). Publish your adaptation there to preserve its original attribution.", "다른 갤러리({origin})에서 가져온 프로젝트입니다. 원작의 출처를 유지할 수 있도록 해당 갤러리에서 수정한 작품을 게시해 주세요."],
    skip: ["Skip to designs", "작품 목록으로 이동"], navigation: ["Main navigation", "주요 메뉴"], gallery: ["Gallery", "갤러리"], cards: ["Cards", "카드"], studio: ["Studio ↗", "제작기 ↗"], language: ["Language", "언어"], share: ["Share a design", "내 작품 게시"],
    eyebrow: ["THE COMMUNITY COLLECTION", "COMMUNITY COLLECTION"], headline: ["A little you.\nA whole lot of possibility.", "마음에 드는 디자인,\n나만의 프로필로."], description: ["Discover a design. Open every layer. Make your profile feel like yours.", "누군가의 아이디어에서 시작해 보세요. 모든 레이어를 열고, 내 취향으로 바꿀 수 있어요."], openSourceNote: ["Every design comes\nwith its editable source.", "모든 작품에\n편집 가능한 원본을 담아요."], startBlank: ["Start with a blank canvas →", "빈 캔버스에서 시작하기 →"], collection: ["Explore the collection", "함께 만든 디자인"], search: ["Search designs, creators, or tags", "작품, 만든 사람, 태그 검색"], searchAction: ["Search", "검색"], filterTags: ["Filter by tag", "태그로 찾기"], sort: ["Recently shared", "최근 게시한 순서"], all: ["All designs", "모든 작품"], loadMore: ["Load more designs", "작품 더 보기"], footer: ["Built to be made your own.", "당신의 방식으로, 당신의 프로필에."], recover: ["Restore publishing key", "편집 키 복원"], retry: ["Try again", "다시 시도"], close: ["Close", "닫기"],
    unavailable: ["Public gallery storage is not connected.", "공개 갤러리 저장소가 연결되지 않았어요."], unavailableDescription: ["This deployment has no configured public gallery. You can still create and save project files in Studio; publishing becomes available when the server operator connects storage.", "현재 서버에는 공개 작품 저장소가 설정되어 있지 않습니다. 제작기에서 작품을 만들고 파일로 저장할 수 있으며, 서버 운영자가 저장소를 연결하면 공개 게시를 이용할 수 있습니다."], connectionError: ["The gallery could not be reached.", "갤러리에 연결할 수 없어요."], connectionDescription: ["Check your connection and try again. Your local projects and editing keys are still available.", "연결을 확인한 뒤 다시 시도해 주세요. 로컬 프로젝트와 편집 키는 그대로 남아 있습니다."], loading: ["Loading designs…", "작품을 불러오는 중…"], noDesigns: ["A new collection starts here.", "첫 작품을 기다리고 있어요."], noDesignsDescription: ["Share a design from Studio and give someone a starting point for their next profile.", "제작기에서 만든 디자인을 게시하고, 다른 사람의 다음 프로필에 영감을 더해 주세요."], noResults: ["No designs found this time.", "조건에 맞는 작품이 없어요."], noResultsDescription: ["Try another search or choose a different tag.", "다른 검색어나 태그로 찾아보세요."], createDesign: ["Create a design →", "디자인 만들기 →"], previewError: ["Preview unavailable", "미리보기를 불러오지 못했어요"], previewRetry: ["Try loading again", "다시 불러오기"],
    livePreview: ["LIVE CARD PREVIEW", "LIVE CARD PREVIEW"], unverified: ["Creator names are self-declared.", "제작자 이름은 본인이 입력한 표시 이름입니다."], editDesign: ["Make it yours in Studio ↗", "제작기에서 내 디자인으로 ↗"], downloadSource: ["Editable source ↓", "편집 원본 ↓"], downloadSVG: ["SVG image ↓", "SVG 이미지 ↓"], license: ["License", "라이선스"], published: ["Published", "게시 날짜"], version: ["Version history", "버전 기록"], attribution: ["Made with these designs", "이 디자인의 바탕이 된 작품"], yourDesign: ["YOUR DESIGN", "내가 게시한 작품"], update: ["Publish a new version", "새 버전 게시"], saveKey: ["Save editing key", "편집 키 저장"], withdraw: ["Withdraw from gallery", "갤러리에서 내리기"], attributionRequired: ["You may adapt this design. Credit its creator, link the CC BY 4.0 license, and indicate your changes when sharing it.", "수정하고 재사용할 수 있습니다. 공유할 때 원작자와 CC BY 4.0 라이선스를 표시하고 변경 사실을 밝혀 주세요."], publicDomain: ["The creator dedicated this design under CC0. You can reuse and adapt it without an attribution requirement.", "제작자가 CC0으로 공개한 디자인입니다. 출처 표시 의무 없이 재사용하고 수정할 수 있습니다."], historicalOwner: ["This is an earlier version. Select the latest version before publishing an update.", "이전 버전입니다. 업데이트하려면 최신 버전을 선택하세요."], withdrawn: ["This design is no longer listed. Its published versions remain available.", "목록에서 내려간 작품입니다. 이미 게시한 버전은 계속 열 수 있습니다."], ownerHint: ["Your editing key is available in this browser.", "이 브라우저에 작품의 편집 키가 있습니다."], withdrawConfirm: ["Remove this design from the public gallery? Published versions and their sources will remain accessible through their existing links.", "공개 갤러리 목록에서 이 작품을 내릴까요? 이미 게시한 버전과 원본은 기존 링크로 계속 열 수 있습니다."],
    shareEyebrow: ["PASS THE INSPIRATION ON", "SHARE YOUR DESIGN"], publishHeading: ["Share something you made.", "당신의 디자인을 나눠 보세요."], publishIntro: ["Your design and its editable source will be public. Choose a license so others know how to use it.", "작품과 편집 가능한 원본이 함께 공개됩니다. 다른 사람이 활용할 수 있도록 라이선스를 선택해 주세요."], chooseProject: ["Choose an editable project", "편집 가능한 원본 선택"], noProject: ["No project selected", "선택한 프로젝트가 없어요"], chooseFile: ["Choose project JSON", "프로젝트 JSON 선택"], publishAs: ["Publish as", "게시 방식"], newDesign: ["A new design", "새 작품으로 게시"], newVersion: ["A new version of my design", "내 작품의 새 버전으로 게시"], title: ["Design title", "작품 제목"], creator: ["Creator name", "제작자 이름"], designDescription: ["Tell us about the design", "작품 소개"], tags: ["Tags", "태그"], tagsHint: ["Separate tags with commas.", "쉼표로 태그를 구분해 주세요."], publishKey: ["Server publishing key", "서버 게시 키"], publishKeyHint: ["This server requires a publishing key from its operator.", "이 서버는 운영자가 발급한 게시 키가 필요합니다."], consent: ["I can share this design and its included assets under the selected license. I understand that published versions remain available even if I withdraw the gallery listing.", "이 디자인과 포함된 자산을 선택한 라이선스로 공유할 권한이 있습니다. 갤러리 목록에서 내려도 게시한 버전은 계속 제공된다는 점을 이해합니다."], publish: ["Publish design ↗", "작품 공개하기 ↗"], publishUpdate: ["Publish new version ↗", "새 버전 공개하기 ↗"], publishing: ["Publishing your design…", "작품을 게시하는 중…"], success: ["Your design is out in the world.", "당신의 디자인이 공개됐어요."], keyNotice: ["Save your editing key. It lets you publish updates or withdraw your listing, even in another browser. Keep it private.", "편집 키를 저장해 주세요. 다른 브라우저에서도 새 버전을 게시하거나 목록에서 내릴 수 있습니다. 키는 다른 사람에게 공개하지 마세요."], downloadKey: ["Download editing key ↓", "편집 키 파일 저장 ↓"], viewDesign: ["View your design →", "게시한 작품 보기 →"], storedKey: ["The key is also saved in this browser. Keep a downloaded copy before clearing browser data.", "이 브라우저에도 키를 저장했습니다. 브라우저 데이터를 지우기 전에 파일을 보관하세요."], unstoredKey: ["Browser storage is unavailable. Download the key now to keep access to your design.", "브라우저에 키를 저장할 수 없습니다. 지금 키 파일을 내려받아 작품 관리 권한을 보관하세요."], restoredKey: ["Editing key restored. Open your design to manage it.", "편집 키를 복원했습니다. 작품을 열어 관리할 수 있어요."], downloadStarted: ["Download started.", "다운로드를 시작했습니다."], selectProjectError: ["Choose an editable project JSON file first.", "먼저 편집 가능한 프로젝트 JSON을 선택해 주세요."], projectTooLarge: ["Project files must be 8 MiB or smaller.", "프로젝트 파일은 8 MiB 이하여야 합니다."], sourceAttribution: ["The original design and its attribution will be included when you publish this adaptation.", "이 작품을 바탕으로 만든 디자인임을 원작 정보와 함께 표시합니다."], layerCount: ["{count} editable layers · {width} × {height}", "편집 가능한 레이어 {count}개 · {width} × {height}"], latest: ["latest", "최신"], by: ["by {author}", "{author} 님의 작품"], edition: ["COMMUNITY DESIGN / V{version}", "COMMUNITY DESIGN / V{version}"], error: ["Something went wrong. Please try again.", "요청을 처리하지 못했습니다. 다시 시도해 주세요."], failedDownload: ["The image could not be downloaded.", "이미지를 내려받지 못했습니다."], invalidKey: ["This is not a valid ProfileKit editing key file.", "올바른 ProfileKit 편집 키 파일이 아닙니다."], emptyTransfer: ["Choose a saved project, or open Studio and use Share in gallery.", "저장한 프로젝트를 선택하거나, 제작기에서 갤러리 게시를 눌러 주세요."],
  };

  function start(host) {
    const D = host.document, M = host.ProfileKitEditorModel;
    if (!D || !M) return;
    const $ = (id) => D.getElementById(id);
    let locale = host.ProfileKitStudioI18n?.locale || (String(host.navigator?.language || "en").toLowerCase().startsWith("ko") ? "ko" : "en");
    try { if (["ko", "en"].includes(host.localStorage.getItem("profilekit.locale"))) locale = host.localStorage.getItem("profilekit.locale"); } catch { /* Optional browser preference. */ }
    const state = { enabled: false, config: null, items: [], cursor: null, tag: "", query: "", listGeneration: 0, detailGeneration: 0, detail: null, latestVersion: null, latestAvailable: false, latestWithdrawn: false,
      draft: null, source: null, sourceError: null, update: null, publishMode: "new", published: null, previewGeneration: 0, previewURL: null, busy: false, keys: new Map() };
    const t = (key, values = {}) => (messages[key]?.[locale === "ko" ? 1 : 0] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
    function node(tag, className, content) { const value = D.createElement(tag); if (className) value.className = className; if (content !== undefined) value.textContent = content; return value; }
    function status(id, message, error = false) { $(id).textContent = message || ""; $(id).classList.toggle("error", error); }
    function localize() {
      D.documentElement.lang = locale; D.title = `${t("gallery")} · ProfileKit`; $("gallery-locale").value = locale;
      for (const element of D.querySelectorAll("[data-i18n]")) element.textContent = t(element.dataset.i18n);
      for (const element of D.querySelectorAll("[data-i18n-placeholder]")) element.placeholder = t(element.dataset.i18nPlaceholder);
      for (const element of D.querySelectorAll("[data-i18n-aria]")) element.setAttribute("aria-label", t(element.dataset.i18nAria));
      renderTags(); renderList();
      if (state.detail) renderDetail();
      if (state.draft) renderDraftLabels();
      $("publish-submit").textContent = t(state.publishMode === "update" ? "publishUpdate" : "publish");
      if (!state.enabled && state.config) serviceMessage(state.config.enabled === false);
    }
    async function request(url, options = {}) {
      const controller = new AbortController();
      const timeout = host.setTimeout(() => controller.abort(), 30000);
      try {
        const response = await host.fetch(url, { ...options, signal: controller.signal, credentials: "same-origin" });
        const data = await response.json();
        if (!response.ok) { const error = new Error(data.error?.message || t("error")); error.status = response.status; error.data = data; throw error; }
        return data;
      } finally { host.clearTimeout(timeout); }
    }
    function imagePreview(id, version, alt, className) {
      const wrap = node("div", className || "");
      const image = node("img"); image.alt = alt; image.loading = "lazy"; image.decoding = "async";
      image.src = designURL(id, version, "svg");
      image.addEventListener("error", () => {
        const message = node("span", "preview-error", t("previewError"));
        wrap.replaceChildren(message);
      }, { once: true });
      wrap.append(image); return wrap;
    }
    function serviceMessage(unconfigured) {
      $("service-state").hidden = false;
      $("service-heading").textContent = t(unconfigured ? "unavailable" : "connectionError");
      $("service-description").textContent = t(unconfigured ? "unavailableDescription" : "connectionDescription");
      $("gallery-results").setAttribute("aria-busy", "false");
      $("empty-state").hidden = true;
    }
    async function configure() {
      $("service-retry").disabled = true;
      try {
        state.config = await request("/api/gallery?config=1");
        state.enabled = state.config.enabled === true;
        $("publish-open").disabled = !state.enabled; $("service-state").hidden = state.enabled;
        if (!state.enabled) { serviceMessage(true); return; }
        $("publish-key-label").hidden = !state.config.publishKeyRequired;
        await loadList();
        await readHash();
      } catch (error) {
        state.enabled = false; state.config = error.data || {};
        $("publish-open").disabled = true;
        serviceMessage(error.data?.enabled === false);
      } finally { $("service-retry").disabled = false; }
    }
    async function loadList(append = false) {
      const generation = ++state.listGeneration;
      $("gallery-results").setAttribute("aria-busy", "true"); $("load-more").disabled = true;
      status("page-status", t("loading"));
      const query = new URLSearchParams({ limit: "12" });
      if (state.query) query.set("q", state.query);
      if (state.tag) query.set("tag", state.tag);
      if (append && state.cursor) query.set("cursor", state.cursor);
      try {
        const result = await request(`/api/gallery?${query}`);
        if (generation !== state.listGeneration) return;
        if (!Array.isArray(result.items)) throw new Error(t("error"));
        const items = result.items.map(metadata);
        state.items = append ? [...state.items, ...items.filter((item) => !state.items.some((old) => old.id === item.id))] : items;
        state.cursor = typeof result.nextCursor === "string" ? result.nextCursor : null;
        renderTags(); renderList(); status("page-status", "");
      } catch (error) { if (generation === state.listGeneration) status("page-status", error.message, true); }
      finally { if (generation === state.listGeneration) { $("gallery-results").setAttribute("aria-busy", "false"); $("load-more").disabled = false; } }
    }
    function renderTags() {
      const tags = [...new Set([state.tag, ...state.items.flatMap((item) => item.tags)].filter(Boolean))].slice(0, 10);
      $("tag-filters").replaceChildren();
      for (const tag of ["", ...tags]) {
        const button = node("button", "tag-filter", tag || t("all")); button.type = "button"; button.setAttribute("aria-pressed", String(tag === state.tag));
        button.addEventListener("click", () => { state.tag = tag; void loadList(); }); $("tag-filters").append(button);
      }
    }
    function renderList() {
      $("gallery-results").replaceChildren();
      for (const item of state.items) {
        const article = node("article", "gallery-card");
        const preview = node("button", "card-preview"); preview.type = "button"; preview.setAttribute("aria-label", item.title);
        const image = imagePreview(item.id, item.version, item.title);
        preview.append(image); image.style.display = "contents";
        preview.addEventListener("click", () => void openDetail(item.id, item.version));
        const information = node("div", "card-information"), titleGroup = node("div");
        const title = node("button", "card-title", item.title); title.type = "button"; title.addEventListener("click", () => void openDetail(item.id, item.version));
        titleGroup.append(title, node("p", "card-byline", t("by", { author: item.author })));
        information.append(titleGroup, node("span", "card-license", LICENSES[item.license].label));
        const tags = node("div", "card-tags"); for (const tag of item.tags.slice(0, 3)) tags.append(node("span", "tag", tag));
        article.append(preview, information, tags); $("gallery-results").append(article);
      }
      $("result-count").textContent = state.items.length ? String(state.items.length) + (state.cursor ? "+" : "") : "";
      $("load-more").hidden = !state.cursor;
      $("empty-state").hidden = !state.enabled || state.items.length > 0;
      $("empty-heading").textContent = t(state.query || state.tag ? "noResults" : "noDesigns");
      $("empty-description").textContent = t(state.query || state.tag ? "noResultsDescription" : "noDesignsDescription");
    }
    async function openDetail(id, version) {
      try { validId(id); if (version !== undefined) validVersion(version); } catch (error) { status("page-status", error.message, true); return; }
      const generation = ++state.detailGeneration;
      state.detail = null; $("detail-title").textContent = t("loading"); $("detail-image-host").replaceChildren();
      $("detail-edit").hidden = true; $("owner-section").hidden = true; status("detail-status", "");
      if (!$("detail-dialog").open) $("detail-dialog").showModal();
      try {
        const [selected, latest] = await Promise.allSettled([request(designURL(id, version)), version === undefined ? Promise.resolve(null) : request(designURL(id))]);
        if (generation !== state.detailGeneration) return;
        if (selected.status === "rejected") throw selected.reason;
        state.detail = metadata(selected.value); state.detail.document = M.normalizeDocument(state.detail.document);
        state.latestAvailable = version === undefined || latest.status === "fulfilled";
        state.latestWithdrawn = latest.status === "rejected" && [404, 410].includes(latest.reason.status);
        state.latestVersion = version === undefined ? state.detail.version : latest.status === "fulfilled" ? metadata(latest.value).version : state.detail.version;
        host.history.replaceState(null, "", `#design=${id}&version=${state.detail.version}`);
        renderDetail();
      } catch (error) { $("detail-title").textContent = t("error"); status("detail-status", error.message, true); }
    }
    function renderDetail() {
      const item = state.detail; if (!item) return;
      $("detail-title").textContent = item.title; $("detail-author").textContent = t("by", { author: item.author });
      $("detail-description").textContent = item.description; $("detail-edition").textContent = t("edition", { version: item.version });
      $("detail-image-host").replaceChildren(imagePreview(item.id, item.version, item.title));
      $("detail-dimensions").textContent = `${item.document.width} × ${item.document.height}`;
      $("detail-tags").replaceChildren(...item.tags.map((tag) => node("span", "tag", tag)));
      $("detail-edit").hidden = false; $("detail-edit").href = editorURL(item.id, item.version);
      $("detail-license").textContent = LICENSES[item.license].label; $("detail-license").href = LICENSES[item.license].url;
      const date = new Date(item.updatedAt || item.createdAt); $("detail-date").textContent = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date) : "—";
      $("detail-license-note").textContent = t(licenseGuidance(item));
      $("detail-version").replaceChildren();
      for (let value = Math.max(item.version, state.latestVersion || 1); value >= 1; value--) { const option = node("option", "", `v${value}${state.latestAvailable && value === state.latestVersion ? ` · ${t("latest")}` : ""}`); option.value = String(value); $("detail-version").append(option); }
      $("detail-version").value = String(item.version);
      const attributions = Array.isArray(item.attributions) ? item.attributions : item.source ? [item.source] : [];
      $("attribution-section").hidden = !attributions.length; $("detail-attributions").replaceChildren();
      for (const attribution of attributions) {
        if (!ID.test(attribution.id) || !Number.isInteger(attribution.version)) continue;
        const li = node("li"), link = node("a", "", `${attribution.title || attribution.id} · ${attribution.author || ""} · v${attribution.version}`);
        link.href = `/gallery.html#design=${attribution.id}&version=${attribution.version}`;
        link.addEventListener("click", (event) => { event.preventDefault(); void openDetail(attribution.id, attribution.version); });
        li.append(link); $("detail-attributions").append(li);
      }
      const owned = state.keys.has(item.id); $("owner-section").hidden = !owned;
      $("owner-update").disabled = !state.latestAvailable || item.version !== state.latestVersion;
      $("owner-withdraw").disabled = !state.latestAvailable;
      $("owner-note").textContent = t(!state.latestAvailable ? state.latestWithdrawn ? "withdrawn" : "connectionError" : item.version !== state.latestVersion ? "historicalOwner" : "ownerHint");
    }
    function download(content, filename, type = "application/json") {
      const url = host.URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
      const link = node("a"); link.href = url; link.download = filename; D.body.append(link); link.click(); link.remove(); host.setTimeout(() => host.URL.revokeObjectURL(url), 10000);
    }
    function saveKey(entry) { download(JSON.stringify(recoveryFile(entry.id, entry.editToken, entry.title), null, 2), `profilekit-${entry.id}-editing-key.json`); }
    function storeKey(entry) {
      state.keys.set(entry.id, recoveryFile(entry.id, entry.editToken, entry.title));
      try { host.localStorage.setItem(KEY_STORE, JSON.stringify([...state.keys.values()])); return true; } catch { return false; }
    }
    try {
      const saved = JSON.parse(host.localStorage.getItem(KEY_STORE) || "[]");
      if (Array.isArray(saved)) for (const value of saved.slice(0, 500)) { try { const entry = parseRecoveryFile(JSON.stringify(value)); state.keys.set(entry.id, entry); } catch { /* Ignore malformed local keys. */ } }
    } catch { /* The gallery can browse without local storage. */ }

    function setDraftSource(fallback) {
      state.source = null; state.sourceError = null;
      try { state.source = publishSource(state.draft, host.location.origin, fallback); }
      catch (error) { state.sourceError = error; }
      $("publish-submit").disabled = state.busy || Boolean(state.sourceError);
    }
    function sourceErrorMessage() {
      return state.sourceError?.code === "foreign_source" ? t("foreignSource", { origin: state.sourceError.origin }) : state.sourceError?.message || "";
    }
    async function offerSourceUpdate() {
      const source = state.source, draft = state.draft;
      if (state.update || !source || !state.keys.has(source.id)) return;
      try {
        const latest = metadata(await request(designURL(source.id)));
        if (state.draft !== draft || state.source !== source || !$("publish-dialog").open) return;
        if (latest.version === source.version) { state.update = latest; $("publish-target-label").hidden = false; }
      } catch { /* Adaptation still works when the original listing is withdrawn. */ }
    }
    function renderDraftLabels() {
      if (!state.draft) return;
      $("publish-document-name").textContent = state.draft.name;
      $("publish-document-meta").textContent = t("layerCount", { count: state.draft.elements.length, width: state.draft.width, height: state.draft.height });
      $("publish-attribution").hidden = !state.sourceError && (!state.source || state.publishMode === "update");
      $("publish-attribution").textContent = state.sourceError ? sourceErrorMessage() : t("sourceAttribution");
    }
    async function renderDraft() {
      renderDraftLabels(); const generation = ++state.previewGeneration;
      if (state.previewURL) { host.URL.revokeObjectURL(state.previewURL); state.previewURL = null; }
      $("publish-preview").replaceChildren(node("span", "", t("loading")));
      try {
        const snapshot = M.normalizeDocument(state.draft), cardMarkup = Object.create(null);
        await Promise.all(snapshot.elements.filter((element) => element.type === "card").map(async (element) => {
          const response = await host.fetch(M.cardPath(element), { credentials: "same-origin" });
          if (!response.ok || !response.headers.get("content-type")?.includes("image/svg+xml")) throw new Error(t("previewError"));
          cardMarkup[element.id] = await response.text();
        }));
        if (generation !== state.previewGeneration) return;
        const svg = M.renderSVG(snapshot, { cardMarkup }); state.previewURL = host.URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        const image = node("img"); image.alt = snapshot.name; image.src = state.previewURL; $("publish-preview").replaceChildren(image);
      } catch { if (generation === state.previewGeneration) $("publish-preview").replaceChildren(node("span", "", t("previewError"))); }
    }
    function setPublishMode(mode) {
      state.publishMode = mode === "update" && state.update ? "update" : "new";
      $("publish-target").value = state.publishMode;
      $("publish-author").readOnly = state.publishMode === "update";
      if (state.publishMode === "update") $("publish-author").value = state.update.author;
      $("publish-key-label").hidden = !state.config?.publishKeyRequired || state.publishMode === "update";
      $("publish-submit").textContent = t(state.publishMode === "update" ? "publishUpdate" : "publish"); renderDraftLabels();
    }
    async function openPublish(document, source, update) {
      if (!state.enabled) return;
      state.previewGeneration++;
      if (state.previewURL) { host.URL.revokeObjectURL(state.previewURL); state.previewURL = null; }
      state.draft = document ? M.normalizeDocument(document) : null; state.update = update || null; state.published = null;
      setDraftSource(source);
      $("publish-form").reset(); $("publish-form").hidden = false; $("publish-success").hidden = true;
      $("publish-title").value = update?.title || state.draft?.name || "";
      $("publish-author").value = update?.author || ""; $("publish-description").value = update?.description || "";
      $("publish-tags").value = update?.tags.join(", ") || ""; $("publish-license").value = update?.license || "CC-BY-4.0";
      $("publish-target-label").hidden = !update;
      setPublishMode(update ? "update" : "new"); status("publish-status", "");
      $("publish-document-name").textContent = t("noProject"); $("publish-document-meta").textContent = ""; $("publish-preview").replaceChildren(node("span", "", t("chooseProject")));
      if (!$("publish-dialog").open) $("publish-dialog").showModal();
      if (state.draft) void renderDraft(); else status("publish-status", t("emptyTransfer"));
      if (!update) await offerSourceUpdate();
    }
    async function submitPublish(event) {
      event.preventDefault(); if (state.busy || !state.enabled) return;
      if (!state.draft) { status("publish-status", t("selectProjectError"), true); return; }
      if (state.sourceError) { status("publish-status", sourceErrorMessage(), true); return; }
      const updating = state.publishMode === "update";
      const body = { title: $("publish-title").value.trim(), description: $("publish-description").value.trim(), author: $("publish-author").value.trim(),
        tags: [...new Set($("publish-tags").value.split(",").map((value) => value.trim()).filter(Boolean))], license: $("publish-license").value, document: M.normalizeDocument(state.draft) };
      const headers = { "Content-Type": "application/json" };
      if (updating) { body.expectedVersion = state.update.version; headers.Authorization = `Bearer ${state.keys.get(state.update.id).editToken}`; }
      else {
        if (state.source) body.source = { id: state.source.id, version: state.source.version };
        if (state.config.publishKeyRequired) headers["X-ProfileKit-Publish-Key"] = $("publish-server-key").value.trim();
      }
      state.busy = true; $("publish-submit").disabled = true; status("publish-status", t("publishing"));
      try {
        const result = metadata(await request(updating ? designURL(state.update.id) : "/api/gallery", { method: updating ? "PATCH" : "POST", headers, body: JSON.stringify(body) }));
        const entry = recoveryFile(result.id, updating ? state.keys.get(result.id).editToken : result.editToken, result.title);
        const persisted = storeKey(entry); state.published = { ...result, editToken: entry.editToken };
        $("publish-form").hidden = true; $("publish-success").hidden = false; $("key-storage-status").textContent = t(persisted ? "storedKey" : "unstoredKey");
        $("publish-server-key").value = "";
        try { await host.ProfileKitProjectTransfer?.remove(TRANSFER_KEY); } catch { /* Published work is already durable on the server. */ }
        void loadList();
      } catch (error) { status("publish-status", error.message, true); }
      finally { state.busy = false; $("publish-submit").disabled = Boolean(state.sourceError); }
    }

    $("gallery-locale").addEventListener("change", () => { locale = $("gallery-locale").value; try { host.localStorage.setItem("profilekit.locale", locale); } catch { /* Optional setting. */ } localize(); host.dispatchEvent(new CustomEvent("profilekit:localechange", { detail: { locale } })); });
    host.addEventListener("storage", (event) => { if (event.key === "profilekit.locale" && ["en", "ko"].includes(event.newValue)) { locale = event.newValue; localize(); } });
    $("search-form").addEventListener("submit", (event) => { event.preventDefault(); state.query = $("gallery-search").value.trim(); void loadList(); });
    $("gallery-search").addEventListener("search", () => { state.query = $("gallery-search").value.trim(); void loadList(); });
    $("load-more").addEventListener("click", () => void loadList(true)); $("service-retry").addEventListener("click", () => void configure());
    for (const button of D.querySelectorAll("[data-close]")) button.addEventListener("click", () => { if (!state.busy) $(button.dataset.close).close(); });
    $("publish-dialog").addEventListener("cancel", (event) => { if (state.busy) event.preventDefault(); });
    $("detail-dialog").addEventListener("close", () => { state.detailGeneration++; if (host.location.hash.startsWith("#design=")) host.history.replaceState(null, "", host.location.pathname + host.location.search); });
    $("detail-version").addEventListener("change", () => { if (state.detail) void openDetail(state.detail.id, Number($("detail-version").value)); });
    $("download-project").addEventListener("click", () => {
      if (!state.detail) return;
      try {
        const document = M.withGallerySource(state.detail.document, state.detail, host.location.origin);
        download(M.serializeDocument(document), `profilekit-${state.detail.id}-v${state.detail.version}.json`);
        status("detail-status", t("downloadStarted"));
      } catch (error) { status("detail-status", error.message, true); }
    });
    $("download-svg").addEventListener("click", async () => {
      if (!state.detail) return; const item = state.detail; $("download-svg").disabled = true;
      try { const response = await host.fetch(designURL(item.id, item.version, "svg"), { credentials: "same-origin" }); if (!response.ok || !response.headers.get("content-type")?.includes("image/svg+xml")) throw new Error(t("failedDownload")); download(await response.blob(), `profilekit-${item.id}-v${item.version}.svg`, "image/svg+xml"); status("detail-status", t("downloadStarted")); }
      catch (error) { status("detail-status", error.message, true); } finally { $("download-svg").disabled = false; }
    });
    $("owner-key").addEventListener("click", () => { if (state.detail && state.keys.has(state.detail.id)) saveKey(state.keys.get(state.detail.id)); });
    $("owner-update").addEventListener("click", () => { if (state.detail && state.keys.has(state.detail.id)) { const item = state.detail; $("detail-dialog").close(); void openPublish(item.document, item.source, item); } });
    $("owner-withdraw").addEventListener("click", async () => {
      const item = state.detail; if (!item || !state.keys.has(item.id) || !host.confirm(t("withdrawConfirm"))) return;
      $("owner-withdraw").disabled = true;
      try { await request(designURL(item.id), { method: "DELETE", headers: { Authorization: `Bearer ${state.keys.get(item.id).editToken}` } }); state.latestAvailable = false; state.latestWithdrawn = true; renderDetail(); status("detail-status", t("withdrawn")); void loadList(); }
      catch (error) { status("detail-status", error.message, true); $("owner-withdraw").disabled = false; }
    });
    $("recover-open").addEventListener("click", () => $("recover-file").click());
    $("recover-file").addEventListener("change", async (event) => {
      const file = event.target.files[0]; event.target.value = ""; if (!file) return;
      try { if (file.size > 8192) throw new Error(t("invalidKey")); const entry = parseRecoveryFile(await file.text()); const persisted = storeKey(entry); status("page-status", t(persisted ? "restoredKey" : "unstoredKey")); if (state.detail?.id === entry.id) renderDetail(); else if (state.enabled) void openDetail(entry.id); }
      catch { status("page-status", t("invalidKey"), true); }
    });
    $("publish-open").addEventListener("click", () => void openPublish()); $("publish-target").addEventListener("change", () => setPublishMode($("publish-target").value));
    $("publish-file").addEventListener("change", async (event) => {
      const file = event.target.files[0]; event.target.value = ""; if (!file) return;
      try {
        if (file.size > M.LIMITS.MAX_FILE_BYTES) throw new Error(t("projectTooLarge"));
        state.draft = M.parseDocument(await file.text()); setDraftSource();
        if (state.publishMode !== "update") { state.update = null; $("publish-target-label").hidden = true; }
        if (!$("publish-title").value) $("publish-title").value = state.draft.name;
        status("publish-status", ""); void renderDraft(); void offerSourceUpdate();
      }
      catch (error) { status("publish-status", error.message, true); }
    });
    $("publish-form").addEventListener("submit", (event) => void submitPublish(event));
    $("success-save-key").addEventListener("click", () => { if (state.published) saveKey(state.published); });
    $("success-open").addEventListener("click", () => { if (state.published) { const item = state.published; $("publish-dialog").close(); void openDetail(item.id, item.version); } });
    async function readHash() {
      if (!state.enabled) return;
      const hash = new URLSearchParams(host.location.hash.slice(1));
      if (hash.has("design")) { await openDetail(hash.get("design"), hash.has("version") ? Number(hash.get("version")) : undefined); }
      else if (host.location.hash === "#publish") {
        try { const transfer = await host.ProfileKitProjectTransfer?.get(TRANSFER_KEY); await openPublish(transfer?.document || (transfer?.kind === "profilekit-card" ? transfer : null), transfer?.source); }
        catch (error) { await openPublish(); status("publish-status", error.message, true); }
      }
    }
    host.addEventListener("hashchange", () => void readHash());
    localize(); void configure();
  }
  return { designURL, editorURL, metadata, publishSource, licenseGuidance, recoveryFile, parseRecoveryFile, start };
});
