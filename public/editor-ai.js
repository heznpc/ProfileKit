/* AI drafts stay proposals until the user reviews and applies them. */
(function () {
  "use strict";
  const I = window.ProfileKitStudioI18n;
  const messages = {
    "AI로 꾸미기": "Design with AI", "갤러리에 등록": "Publish to gallery", "갤러리 둘러보기": "Explore gallery",
    "원하는 변경을 설명하세요": "Describe the change", "요청 만들기": "Prepare request", "외부 AI에서 만들기": "Use an external AI",
    "현재 카드의 배치와 문구를 포함한 요청을 복사합니다. 이미지 원본과 API 키는 포함하지 않습니다.": "Copy a request with this card's layout and text. Image bytes and API keys are excluded.",
    "요청 복사": "Copy request", "수정안 붙여넣기": "Paste the proposal", "수정안 확인": "Review proposal",
    "적용 전": "Before", "수정안": "Proposal", "수정안 적용": "Apply proposal", "닫기": "Close",
    "직접 API 연결": "Connect an API", "OpenAI API 키": "OpenAI API key", "모델 이름": "Model name",
    "키는 저장하지 않습니다. 요청할 때만 이 서버를 거쳐 OpenAI로 전달되며 본인 API 계정에 요금이 발생할 수 있습니다.": "The key is never saved. A request passes through this server to OpenAI and may incur charges on your API account.",
    "AI 수정안 요청": "Request AI proposal", "요청을 준비했습니다. 외부 AI에 붙여넣고 JSON 응답을 가져오세요.": "Request ready. Paste it into your AI and bring back the JSON response.",
    "수정안을 만드는 중…": "Creating a proposal…", "수정안을 확인하는 중…": "Validating the proposal…",
    "적용했습니다. 실행 취소로 되돌릴 수 있습니다.": "Applied. You can undo this change.", "요청을 복사했습니다.": "Request copied.",
    "AI 요청": "AI request", "아직 적용하지 않았습니다. 아래 변경 내용을 확인하세요.": "Nothing has been applied. Review the changes below.",
    "갤러리로 이동하는 중…": "Opening gallery…", "변경 없음": "No changes", "API 키와 모델 이름을 입력하세요.": "Enter an API key and model name.",
    "추가": "Add", "수정": "Update", "삭제": "Remove", "캔버스": "Canvas", "속성": "Properties",
  };
  I?.addMessages(messages);
  const t = (s) => I?.t(s) || s;
  const node = (tag, text, attrs = {}) => { const n = document.createElement(tag); if (text) n.textContent = t(text); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); return n; };
  const action = (id, label, className = "button outline") => node("button", label, { id, type:"button", class:className });
  const tools = node("div", "", { class:"studio-workflow-actions" });
  tools.append(action("ai-open", "AI로 꾸미기"), action("gallery-publish", "갤러리에 등록"), node("a", "갤러리 둘러보기", { href:"/gallery.html", class:"button quiet" }));
  document.querySelector(".preview-toolbar").after(tools);
  const dialog = node("dialog", "", { id:"ai-dialog", class:"ai-dialog", "aria-labelledby":"ai-heading" });
  // This template is authored code; user/model strings are rendered only as text.
  dialog.innerHTML = `<div class="dialog-header"><div><span class="dialog-eyebrow">AI STUDIO</span><h2 id="ai-heading">AI로 꾸미기</h2></div><button type="button" id="ai-close" class="button quiet">닫기</button></div>
    <div class="dialog-body"><label class="field"><span>원하는 변경을 설명하세요</span><textarea id="ai-instruction" rows="3" maxlength="8000"></textarea></label>
    <button type="button" id="ai-prepare" class="button primary">요청 만들기</button>
    <details id="ai-external"><summary>외부 AI에서 만들기</summary><p class="field-hint">현재 카드의 배치와 문구를 포함한 요청을 복사합니다. 이미지 원본과 API 키는 포함하지 않습니다.</p>
    <label class="field"><span>AI 요청</span><textarea id="ai-prompt" rows="5" readonly spellcheck="false"></textarea></label><button type="button" id="ai-copy" class="button outline">요청 복사</button>
    <label class="field"><span>수정안 붙여넣기</span><textarea id="ai-response" rows="5" spellcheck="false"></textarea></label><button type="button" id="ai-review" class="button outline">수정안 확인</button></details>
    <details id="ai-provider"><summary>직접 API 연결</summary><p class="field-hint">키는 저장하지 않습니다. 요청할 때만 이 서버를 거쳐 OpenAI로 전달되며 본인 API 계정에 요금이 발생할 수 있습니다.</p>
    <label class="field"><span>OpenAI API 키</span><input id="ai-key" type="password" autocomplete="off" spellcheck="false"></label>
    <label class="field"><span>모델 이름</span><input id="ai-model" type="text" autocomplete="off" spellcheck="false"></label><button type="button" id="ai-generate" class="button outline">AI 수정안 요청</button></details>
    <p id="ai-status" role="status" aria-live="polite"></p><section id="ai-comparison" hidden><p id="ai-summary"></p><ul id="ai-changes"></ul><div class="ai-preview-grid"><figure><figcaption>적용 전</figcaption><img id="ai-before" alt=""></figure><figure><figcaption>수정안</figcaption><img id="ai-after" alt=""></figure></div><button type="button" id="ai-apply" class="button primary">수정안 적용</button></section></div>`;
  document.body.append(dialog); I?.apply(dialog);
  const $ = (id) => document.getElementById(id);
  let prepared = null, proposal = null, reviewed = null, pending = null, generation = 0;
  const urls = [];
  function note(text) { $("ai-status").textContent = t(text); }
  function revoke() { while (urls.length) URL.revokeObjectURL(urls.pop()); }
  function resetReview() { proposal = reviewed = null; $("ai-comparison").hidden = true; $("ai-apply").disabled = true; revoke(); }
  async function prepare() {
    const epoch = ++generation;
    pending?.abort(); pending = null; resetReview(); prepared = null;
    $("ai-prompt").value = "";
    const instruction = $("ai-instruction").value;
    const selectedIds = window.ProfileKitEditor.selectedIds();
    const document = await window.ProfileKitEditor.snapshot();
    if (epoch !== generation || !dialog.open) return null;
    const prompt = await window.ProfileKitAIDesign.buildPrompt(document, instruction, { selectedIds });
    if (epoch !== generation || !dialog.open) return null;
    prepared = { ...prompt, document, instruction, selectedIds };
    $("ai-prompt").value = prompt.prompt;
    note("요청을 준비했습니다. 외부 AI에 붙여넣고 JSON 응답을 가져오세요.");
    return prepared;
  }
  async function review(raw, epoch = ++generation) {
    const request = prepared;
    if (!request) throw new Error(t("먼저 요청을 만들어 주세요."));
    resetReview(); note("수정안을 확인하는 중…");
    const parsed = window.ProfileKitAIDesign.parseProposal(raw);
    const current = await window.ProfileKitEditor.snapshot();
    if (epoch !== generation || !dialog.open) return;
    const result = await window.ProfileKitAIDesign.applyProposal(current, parsed, request.baseRevision);
    if (epoch !== generation || !dialog.open) return;
    const previews = await Promise.all([window.ProfileKitEditor.preview(current), window.ProfileKitEditor.preview(result.document)]);
    if (epoch !== generation || !dialog.open) return;
    reviewed = result; proposal = parsed;
    $("ai-summary").textContent = result.summary;
    $("ai-changes").replaceChildren(...result.changes.map(change => node("li", "", {})));
    const types = {text:"텍스트",image:"이미지",rect:"사각형",ellipse:"원",card:"카드"};
    const fields = {name:"이름",width:"너비",height:"높이",background:"배경색",x:"위치",y:"위치",rotation:"회전",opacity:"불투명도",text:"내용",fontFamily:"글꼴",fontSize:"크기",fontWeight:"굵기",color:"글자색",align:"정렬",fill:"채움",stroke:"테두리",strokeWidth:"테두리",radius:"모서리",src:"이미지",fit:"이미지",params:"카드 설정",parts:"카드 안 꾸미기",effect:"레이어 효과"};
    [...$("ai-changes").children].forEach((li, i) => {
      const c = result.changes[i];
      const element = result.document.elements.find(item => item.id === c.id) || current.elements.find(item => item.id === c.id);
      const label = element?.type === "text" ? `“${element.text.replace(/\s+/g," ").slice(0,60)}”` : element?.type === "card" ? I?.card(element.endpoint) || element.endpoint : t(types[element?.type] || "캔버스");
      const changed = [...new Set((c.fields || []).map(key => t(fields[key.split(".")[0]] || "속성")))];
      li.textContent = `${t({add:"추가",remove:"삭제",update:"수정",canvas:"수정"}[c.op])}: ${label}${changed.length ? " · " + changed.join(", ") : ""}`;
    });
    if (!result.changes.length) $("ai-changes").append(node("li", "변경 없음"));
    for (let i = 0; i < previews.length; i++) {
      const url = URL.createObjectURL(new Blob([previews[i]], {type:"image/svg+xml"})); urls.push(url);
      $(i ? "ai-after" : "ai-before").src = url;
    }
    $("ai-comparison").hidden = false; $("ai-apply").disabled = !result.changes.length;
    $("ai-external").open = false; $("ai-provider").open = false;
    note("아직 적용하지 않았습니다. 아래 변경 내용을 확인하세요.");
  }
  const guard = (fn) => async () => {
    let epoch = generation;
    try { const task = fn(); epoch = generation; await task; }
    catch (error) { if (epoch === generation && dialog.open && error.name !== "AbortError") note(error.message); }
  };
  $("ai-open").addEventListener("click", () => { dialog.showModal(); $("ai-instruction").focus(); });
  $("ai-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { ++generation; pending?.abort(); pending = null; $("ai-key").value = ""; resetReview(); });
  $("ai-prepare").addEventListener("click", guard(async () => { if (await prepare()) $("ai-external").open = true; }));
  $("ai-copy").addEventListener("click", guard(async () => {
    const request = prepared || await prepare(); if (!request) return;
    await navigator.clipboard.writeText(request.prompt);
    if (prepared === request && dialog.open) note("요청을 복사했습니다.");
  }));
  $("ai-review").addEventListener("click", guard(() => review($("ai-response").value)));
  $("ai-generate").addEventListener("click", guard(async () => {
    if (!$("ai-key").value.trim() || !$("ai-model").value.trim()) throw new Error(t("API 키와 모델 이름을 입력하세요."));
    const key = $("ai-key").value.trim(), model = $("ai-model").value.trim();
    let controller;
    $("ai-generate").disabled = true;
    try {
      const request = await prepare(); if (!request) return;
      const epoch = generation;
      controller = new AbortController(); pending = controller; note("수정안을 만드는 중…");
      const response = await fetch("/api/ai", { method:"POST", headers:{"Content-Type":"application/json", Authorization:"Bearer " + key},
        body:JSON.stringify({document:request.document,instruction:request.instruction,selectedIds:request.selectedIds,model,baseRevision:request.baseRevision}), signal:controller.signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "AI request failed.");
      if (epoch !== generation || pending !== controller || !dialog.open) return;
      $("ai-response").value = JSON.stringify(data.proposal, null, 2);
      await review($("ai-response").value, epoch);
    } finally {
      if (pending === controller) pending = null;
      if (!pending) $("ai-generate").disabled = false;
    }
  }));
  $("ai-apply").addEventListener("click", guard(async () => {
    if (!proposal || !reviewed) return;
    const request = prepared, accepted = proposal, epoch = ++generation;
    const current = await window.ProfileKitEditor.snapshot();
    if (epoch !== generation || !dialog.open) return;
    const expected = window.ProfileKitEditorModel.serializeDocument(current);
    const result = await window.ProfileKitAIDesign.applyProposal(current, accepted, request.baseRevision);
    if (epoch !== generation || !dialog.open) return;
    window.ProfileKitEditor.apply(result.document, expected);
    resetReview(); prepared = null; note("적용했습니다. 실행 취소로 되돌릴 수 있습니다.");
  }));
  $("gallery-publish").addEventListener("click", async () => {
    const button = $("gallery-publish"); button.disabled = true;
    try {
      const editor = window.ProfileKitEditor;
      const document = await editor.snapshot();
      await window.ProfileKitProjectTransfer.set("profilekit.gallery.publish", { document, ...(editor.source() ? {source:editor.source()} : {}) });
      location.href = "/gallery.html#publish";
    } catch (error) { window.ProfileKitEditor.status(error.message, true); }
    finally { button.disabled = false; }
  });
})();
