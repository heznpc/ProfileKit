/* Range controls share the editor's numeric fields, undo and validation. */
(function () {
  "use strict";
  const bounds = {
    "element-opacity":[0,1,.01], "element-rotation":[-360,360,1], "element-font-size":[8,256,1],
    "element-radius":[0,2048,1], "element-stroke-width":[0,64,1],
    "part-scale":[.25,4,.05], "part-dx":[-2048,2048,1], "part-dy":[-2048,2048,1],
    "element-effect-blur":[0,40,1], "element-effect-opacity":[0,1,.01], "element-effect-dx":[-80,80,1], "element-effect-dy":[-80,80,1],
  };
  const controls = new Map();
  function refresh() {
    for (const [id, [min,limit,step]] of Object.entries(bounds)) {
      const field = document.getElementById(id); if (!field) continue;
      const max = id === "element-radius" ? Math.min(limit,
        Math.max(1, Number(document.getElementById("element-width")?.value) || limit * 2) / 2,
        Math.max(1, Number(document.getElementById("element-height")?.value) || limit * 2) / 2) : limit;
      field.min=min; field.max=max; field.step=step;
      let range = controls.get(id);
      if (!range) {
        range = document.createElement("input"); range.type="range"; range.className="studio-range"; range.id=id+"-range";
        range.setAttribute("aria-label", field.closest("label")?.querySelector("span")?.textContent || id);
        range.addEventListener("input", () => { field.value=range.value; field.dispatchEvent(new Event("input",{bubbles:true})); refresh(); });
        range.addEventListener("change", () => { field.dispatchEvent(new Event("change",{bubbles:true})); refresh(); });
        range.addEventListener("blur", () => { field.dispatchEvent(new Event("change",{bubbles:true})); refresh(); });
        field.after(range); controls.set(id,range);
      }
      range.min=min; range.max=max; range.step=step;
      range.disabled=field.disabled;
      range.setAttribute("aria-label",field.closest("label")?.querySelector("span")?.textContent || id);
      range.value=field.value;
    }
  }
  window.addEventListener("profilekit:controls-render",refresh);
  window.addEventListener("profilekit:localechange",refresh);
  document.addEventListener("input",event=>{if(bounds[event.target.id])refresh()});
  refresh();
})();
