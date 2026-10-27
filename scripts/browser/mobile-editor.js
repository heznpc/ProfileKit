const { chromium } = require(process.env.PROFILEKIT_PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: process.env.PROFILEKIT_BROWSER_CHANNEL || undefined, headless: true });
  const base = process.env.PROFILEKIT_TEST_ORIGIN;
  const output = process.env.PROFILEKIT_TEST_OUTPUT;
  const errors = [];
  let page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(base + "/editor.html");
    await page.locator("#import-card-input").fill(base + "/api/hero?name=Touch&theme=dark&width=900&height=300");
    await page.locator("#import-card-button").click();
    await page.waitForFunction(() => document.querySelector("#card-endpoint-label").textContent === "/hero");
    let cdp = await page.context().newCDPSession(page);
    async function drag(x, y, dx, dy) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx, y: y + dy }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await page.locator("#canvas-host").scrollIntoViewIfNeeded();
    const handle = await page.locator('[data-handle="resize"]').boundingBox();
    const hit = await page.locator('[data-handle-hit="resize"]').boundingBox();
    assert.ok(hit.width >= 43 && hit.height >= 43, "resize touch target must be 44 CSS pixels");
    // Start beyond the 10px visible handle to exercise the actual hit area.
    await drag(hit.x + hit.width / 2, hit.y + hit.height / 2, -20, -2);
    const width = Number(await page.locator("#element-width").inputValue());
    const height = Number(await page.locator("#element-height").inputValue());
    assert.ok(width < 900, "touch must resize the card");
    assert.ok(Math.abs(width / height - 3) < 0.02, "touch resize must preserve card aspect ratio");
    await page.locator("#undo").click();
    assert.equal(Number(await page.locator("#element-width").inputValue()), 900);

    await page.locator("#card-parts-controls > summary").click();
    await page.locator("#card-part-edit").click();
    await page.locator('#canvas-host [data-cas-target="name"]').waitFor();
    const canvas = await page.locator("#canvas-host").boundingBox();
    assert.ok(canvas.y >= 40 && canvas.y + canvas.height <= 844, "entering part edit from inspector must reveal canvas");
    const name = await page.locator('#canvas-host [data-cas-target="name"]').boundingBox();
    await drag(name.x + 8, name.y + name.height / 2, 20, 5);
    const dx = Number(await page.locator("#part-dx").inputValue());
    assert.ok(dx > 0, "touch must move an internal card part");
    const partHandle = await page.locator('[data-handle="part-scale"]').boundingBox();
    await drag(partHandle.x + partHandle.width / 2 + 12, partHandle.y + partHandle.height / 2 + 12, 10, 5);
    const scale = Number(await page.locator("#part-scale").inputValue());
    assert.ok(scale > 1, "expanded part handle must support touch scaling");
    await page.screenshot({ path: path.join(output, "mobile-touch-edit.png") });

    const saved = page.waitForEvent("download");
    await page.locator("#project-save").click();
    const project = path.join(output, "mobile-project.json");
    await (await saved).saveAs(project);
    await page.close();
    page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/editor.html");
    await page.locator("#project-file").setInputFiles(project);
    await page.locator("#canvas-host [data-element-id]").first().tap();
    await page.locator("#edit-card-parts-tool").click();
    await page.locator('#canvas-host [data-cas-target="name"]').waitFor();
    assert.equal(Number(await page.locator("#part-dx").inputValue()), dx);
    assert.equal(Number(await page.locator("#part-scale").inputValue()), scale);
    await page.locator("#embed-open").click();
    await page.waitForFunction(() => document.querySelector("#embed-code").value.includes("/api/design?d="));
    await page.locator("#embed-close").click();
    await page.locator("#import-card-input").fill(base + "/api/divider?width=800&height=8");
    await page.locator("#import-card-button").click();
    await page.waitForFunction(() => document.querySelector("#card-endpoint-label").textContent === "/divider");
    await page.locator("#element-height").fill("1");
    await page.locator("#element-height").press("Tab");
    await page.locator("#canvas-host").scrollIntoViewIfNeeded();
    cdp = await page.context().newCDPSession(page);
    const thinHit = await page.locator('[data-handle-hit="resize"]').boundingBox();
    await drag(thinHit.x + thinHit.width / 2, thinHit.y + thinHit.height / 2, 1, 0);
    const thinWidth = Number(await page.locator("#element-width").inputValue());
    assert.ok(thinWidth >= 800 && thinWidth < 820, "thin divider must not jump to maximum width");
    assert.equal(Number(await page.locator("#element-height").inputValue()), 1);
    for (const [id, value] of [["doc-width", "900"], ["doc-height", "900"], ["element-width", "1"], ["element-height", "800"]]) {
      await page.locator("#" + id).fill(value);
      await page.locator("#" + id).press("Tab");
    }
    await page.locator("#canvas-host").scrollIntoViewIfNeeded();
    const verticalHit = await page.locator('[data-handle-hit="resize"]').boundingBox();
    await drag(verticalHit.x + verticalHit.width / 2, verticalHit.y + verticalHit.height / 2, 0, 1);
    assert.equal(Number(await page.locator("#element-width").inputValue()), 1);
    assert.equal(Number(await page.locator("#element-height").inputValue()), 800);
    assert.deepEqual(errors, []);
    console.log("PASS mobile touch resize, aspect ratio, part move/scale, inspector navigation, fresh project reopen and README export");
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
