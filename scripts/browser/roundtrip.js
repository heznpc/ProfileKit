const {chromium}=require(process.env.PROFILEKIT_PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const base=process.env.PROFILEKIT_TEST_ORIGIN;
(async()=>{
 const browser=await chromium.launch({channel:process.env.PROFILEKIT_BROWSER_CHANNEL || 'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1512,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const prefix='# My existing profile\n\n<a href="https://github.com/octocat"><img width="49%" alt="Keep my label" src="';
 const suffix='" /></a>\n\n[Keep this link](https://example.com)\n';
 const original=prefix+base+'/api/hero?name=Ren&amp;subtitle=My%20work&amp;bg=grid&amp;width=900&amp;height=300'+suffix;
 async function source(){await page.locator('#readme-view-source').click();return page.locator('#readme-source').inputValue()}
 async function open(){await page.locator('#readme-open-editor').click();await page.waitForURL('**/editor.html#readme-edit=*');await page.waitForFunction(()=>!document.querySelector('#readme-return').disabled)}
 async function back(id){await page.locator(id).click();await page.waitForURL(u=>u.pathname==='/readme.html');await page.waitForFunction(()=>!location.hash)}
 try{
 await page.goto(base+'/readme.html');
 await page.evaluate(()=>localStorage.setItem('profilekit.readme-studio.v2','{"sentinel":"existing creator draft"}'));
 await page.locator('.advanced-options > summary').click();await page.locator('#readme-origin').fill(base);await page.locator('#readme-origin').press('Tab');await page.locator('#readme-show-import').click();await page.locator('#readme-source').fill(original);await page.locator('#readme-import').click();
 await open();
 for (const width of [320, 390, 768]) {
  await page.setViewportSize({width,height:844});
  const buttons=page.locator('.document-actions button:visible');
  for (const button of await buttons.all()) {
   const box=await button.boundingBox();
   assert.ok(box && box.x>=0 && box.x+box.width<=width+1, `header action outside ${width}px viewport: ${await button.textContent()}`);
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:process.env.PROFILEKIT_TEST_OUTPUT+'/editor-mobile-return.png'});
 await page.locator('#readme-return-cancel').click();
 await page.waitForURL(u=>u.pathname==='/readme.html');await page.waitForFunction(()=>!location.hash);
 assert.equal(await source(),original);
 console.log('PASS all return/save/export actions visible at 320/390/768px; mobile cancel preserves original README');
 await page.setViewportSize({width:1512,height:1100});
 await open();await back('#readme-return');assert.equal(await source(),original);
 console.log('PASS unchanged ordinary card roundtrip byte-for-byte');
 await open();await page.locator('#edit-card-parts-tool').click();
 await page.locator('#canvas-host [data-cas-target="name"]').waitFor();
 await page.locator('#part-dx').fill('45');await page.locator('#part-dx').press('Tab');
 await page.locator('#part-color').fill('#22d3ee');await page.locator('#part-color').press('Tab');
 await page.screenshot({path:process.env.PROFILEKIT_TEST_OUTPUT+'/editor.png'});
 await back('#readme-return');
 const changed=await source();assert.ok(changed.startsWith(prefix));assert.ok(changed.endsWith(suffix));assert.match(changed,/\/api\/design\?d=/);
 let state=await page.evaluate(()=>ProfileKitReadmeModel.scan(document.querySelector('#readme-source').value,{origin:location.origin}));
 assert.equal(state.cards.length,1);assert.equal(state.cards[0].design.elements[0].parts.name.dx,45);
 assert.equal(await page.evaluate(()=>localStorage.getItem('profilekit.readme-studio.v2')),'{"sentinel":"existing creator draft"}');
 console.log('PASS card decoration returns to original README slot, metadata and creator draft preserved');
 await page.locator('#batch-theme').selectOption('light');await page.locator('#batch-apply').click();
 state=await page.evaluate(()=>ProfileKitReadmeModel.scan(document.querySelector('#readme-source').value,{origin:location.origin}));
 assert.equal(state.cards[0].design.elements[0].params.theme,'light');assert.equal(state.cards[0].design.elements[0].parts.name.dx,45);
 await page.locator('#readme-card-details').evaluate(n=>n.open=true);
 await page.locator('#readme-param-subtitle').fill('Edited from README');await page.locator('#readme-card-apply').click();
 const beforeCancel=await source();
 await open();assert.equal(await page.locator('#doc-width').inputValue(),'900');
 await page.locator('#edit-card-parts-tool').click();await page.locator('#canvas-host [data-cas-target="name"]').waitFor();
 assert.equal(await page.locator('#part-dx').inputValue(),'45');
 await page.locator('#part-dx').fill('80');await page.locator('#part-dx').press('Tab');
 await back('#readme-return-cancel');assert.equal(await source(),beforeCancel);
 console.log('PASS batch style and nested field edit preserve decoration; re-open and cancel preserve README');
 await page.locator('#readme-view-preview').click();await page.locator('#readme-preview-dark').click();
 await page.screenshot({path:process.env.PROFILEKIT_TEST_OUTPUT+'/readme-dark.png'});
 await page.locator('#readme-preview-light').click();await page.setViewportSize({width:390,height:844});
 await page.locator('#readme-preview-mobile').click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:process.env.PROFILEKIT_TEST_OUTPUT+'/readme-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS dark/light/mobile, no overflow, zero runtime errors');
 await fs.writeFile(process.env.PROFILEKIT_TEST_OUTPUT+'/result.md',beforeCancel);
 }catch(e){await page.screenshot({path:process.env.PROFILEKIT_TEST_OUTPUT+'/failure.png',fullPage:true});throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
