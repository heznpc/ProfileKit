const { chromium } = require(process.env.PROFILEKIT_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.PROFILEKIT_TEST_ORIGIN;
const output = process.env.PROFILEKIT_TEST_OUTPUT;
const snap = page => page.evaluate(() => ProfileKitEditor.snapshot());
const ready = page => page.waitForFunction(() => window.ProfileKitEditor && !document.body.inert);

(async () => {
  const browser = await chromium.launch({channel: process.env.PROFILEKIT_BROWSER_CHANNEL || 'chrome', headless: true});
  const owner = await browser.newPage({viewport:{width:1512,height:1100}});
  const errors = [], consoleErrors = [];
  const observe = page => {
    page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept());
    page.on('console',message=>{if(['error','warning'].includes(message.type())) consoleErrors.push(message.text());});
  };
  observe(owner);
  let visitor;
  try {
    await owner.goto(base+'/editor.html'); await ready(owner);
    await owner.locator('#studio-locale').selectOption('en');
    await owner.locator('#card-search').fill('활동 통계');
    assert.equal(await owner.locator('.catalog-card').count(),1);
    await owner.locator('#card-search').fill('');
    await owner.locator('#add-text').click();
    await owner.locator('#element-text').fill('Build things worth sharing');
    await owner.locator('#element-text').press('Tab');
    await owner.locator('#decoration-controls > summary').click();
    await owner.locator('#element-effect-kind').selectOption('shadow');
    const slider=owner.locator('#element-effect-opacity-range');
    await slider.fill('0'); await slider.dispatchEvent('change');
    assert.equal((await snap(owner)).elements.at(-1).effect,undefined);
    await owner.locator('#doc-width').fill('980'); await owner.locator('#doc-width').press('Tab');
    await owner.locator('#undo').click();
    assert.equal((await snap(owner)).width,900);
    assert.equal((await snap(owner)).elements.at(-1).effect,undefined);
    await owner.locator('#undo').click(); assert.equal((await snap(owner)).elements.at(-1).effect.kind,'shadow');
    console.log('PASS localized search and independent effect/size undo');

    await owner.locator('#ai-open').click();
    await owner.locator('#ai-instruction').fill('Make the selected title coral and add a pale panel behind all existing layers.');
    await owner.locator('#ai-prepare').click();
    await owner.waitForFunction(()=>document.querySelector('#ai-prompt').value.includes('baseRevision'));
    const before=await snap(owner);
    const proposal=await owner.evaluate(async()=>{
      const d=await ProfileKitEditor.snapshot();
      return {version:1,baseRevision:await ProfileKitAIDesign.revision(d),summary:'Coral title and background panel',operations:[
        {op:'update',id:d.elements.at(-1).id,changes:{color:'#f97360'}},
        {op:'add',beforeId:d.elements[0].id,element:{id:'ai-backdrop',type:'rect',x:0,y:0,width:d.width,height:d.height,fill:'#f7f1e8'}}
      ]};
    });
    await owner.locator('#ai-response').fill(JSON.stringify(proposal)); await owner.locator('#ai-review').click();
    await owner.locator('#ai-apply').waitFor({state:'visible'});
    await owner.waitForFunction(()=>!document.querySelector('#ai-apply').disabled);
    assert.deepEqual(await snap(owner),before);
    await owner.screenshot({path:output+'/ai-review.png'});
    await owner.locator('#ai-apply').click();
    await owner.waitForFunction(async()=> (await ProfileKitEditor.snapshot()).elements[0].id==='ai-backdrop');
    const applied=await snap(owner);
    assert.equal(applied.elements.at(-1).color,'#f97360');
    assert.deepEqual(applied.elements[1],before.elements[0]);
    await owner.locator('#ai-close').click(); await owner.locator('#undo').click(); assert.deepEqual(await snap(owner),before);
    await owner.locator('#redo').click(); assert.deepEqual(await snap(owner),applied);
    const textId=applied.elements.at(-1).id;
    await owner.locator(`#layer-list [data-id="${textId}"]`).click();
    await owner.locator('#element-text').fill('A title edited by a person'); await owner.locator('#element-text').press('Tab');
    const manuallyEdited=await snap(owner);
    await owner.locator('#ai-open').click(); await owner.locator('#ai-instruction').fill('Change only the title color to blue. Keep my words.'); await owner.locator('#ai-prepare').click();
    await owner.waitForFunction(()=>document.querySelector('#ai-prompt').value.includes('A title edited by a person'));
    const nextProposal=await owner.evaluate(async()=>({version:1,summary:'Blue title, preserving the manually edited text',baseRevision:await ProfileKitAIDesign.revision(await ProfileKitEditor.snapshot()),operations:[{op:'update',id:ProfileKitEditor.selectedIds()[0],changes:{color:'#60a5fa'}}]}));
    await owner.locator('#ai-response').fill(JSON.stringify(nextProposal)); await owner.locator('#ai-review').click();
    await owner.waitForFunction(()=>!document.querySelector('#ai-apply').disabled);
    assert.deepEqual(await snap(owner),manuallyEdited);
    await owner.locator('#ai-apply').click();
    await owner.waitForFunction(async()=> (await ProfileKitEditor.snapshot()).elements.at(-1).color==='#60a5fa');
    const reapplied=await snap(owner);
    assert.equal(reapplied.elements.at(-1).text,'A title edited by a person');
    assert.deepEqual(reapplied.elements.slice(0,-1),manuallyEdited.elements.slice(0,-1));
    await owner.locator('#ai-close').click();
    console.log('PASS AI review is non-mutating; apply, paint order, metadata preservation and undo/redo');
    console.log('PASS manual edits survive a fresh AI request and unrequested layers remain unchanged');

    await owner.locator('#gallery-publish').click(); await owner.waitForURL('**/gallery.html#publish');
    await owner.locator('#publish-title').fill('Sharing card '+Date.now());
    await owner.locator('#publish-author').fill('Browser QA Creator');
    await owner.locator('#publish-tags').fill('profile, creative');
    await owner.locator('#publish-consent').check(); await owner.locator('#publish-submit').click();
    await owner.locator('#success-open').waitFor({state:'visible'}); await owner.locator('#success-open').click();
    await owner.locator('#detail-edit').waitFor({state:'visible'});
    const editURL=await owner.locator('#detail-edit').getAttribute('href');
    const sourceId=new URLSearchParams(editURL.split('#')[1]).get('gallery');
    const sourceResponse=await owner.request.get(base+'/api/gallery?id='+sourceId+'&version=1');
    const source=await sourceResponse.json();
    assert.equal(source.document.elements.length,applied.elements.length);
    assert.equal(await owner.locator('#owner-section').isVisible(),true);
    await owner.locator('#detail-dialog [data-close]').click();
    await owner.screenshot({path:output+'/gallery-desktop.png',fullPage:true});

    const context=await browser.newContext({viewport:{width:1512,height:1100}});
    visitor=await context.newPage(); observe(visitor);
    await visitor.goto(base+editURL); await ready(visitor);
    const copy=await snap(visitor);
    assert.equal(copy.provenance.id,sourceId);
    assert.deepEqual(copy.elements,source.document.elements);
    await visitor.locator('#studio-locale').selectOption('en');
    await visitor.locator('#doc-name').fill('My independent remix'); await visitor.locator('#doc-name').press('Tab');
    assert.equal((await (await visitor.request.get(base+'/api/gallery?id='+sourceId+'&version=1')).json()).document.name,source.document.name);
    await visitor.locator('#embed-open').click();
    assert.match(await visitor.locator('#embed-code').inputValue(),/Browser QA Creator/);
    await visitor.locator('.asset-export > summary').click();
    assert.match(await visitor.locator('#asset-readme').inputValue(),/CC-BY-4.0/);
    const saved=visitor.waitForEvent('download'); await visitor.locator('#export-svg').click();
    const svgFile=await saved; const svgText=await fs.readFile(await svgFile.path(),'utf8'); assert.match(svgText,/<svg/);
    await visitor.locator('#embed-close').click();
    const projectDownload=visitor.waitForEvent('download'); await visitor.locator('#project-save').click();
    const project=await projectDownload; const serialized=await fs.readFile(await project.path(),'utf8');
    assert.equal(JSON.parse(serialized).provenance.id,sourceId);
    assert.equal(JSON.parse(serialized).name,'My independent remix');
    await visitor.waitForFunction(async () => {
      const p=new URLSearchParams(location.hash.slice(1));
      const draft=await ProfileKitProjectTransfer.get(`profilekit.readme-studio.v2.gallery-${p.get('gallery')}-${p.get('version')}`);
      return draft?.name==='My independent remix';
    });
    await visitor.reload(); await ready(visitor); assert.equal((await snap(visitor)).name,'My independent remix');
    await visitor.locator('#gallery-publish').click(); await visitor.waitForURL('**/gallery.html#publish');
    await visitor.locator('#publish-author').fill('Remix Creator'); await visitor.locator('#publish-consent').check(); await visitor.locator('#publish-submit').click();
    await visitor.locator('#success-open').waitFor({state:'visible'}); await visitor.locator('#success-open').click();
    await visitor.locator('#detail-edit').waitFor({state:'visible'});
    assert.match(await visitor.locator('#detail-attributions').innerText(),/Browser QA Creator/);
    assert.equal(await visitor.locator('#detail-version option').count(),1);
    console.log('PASS public publish, separate-browser copy, source unchanged, credits, SVG/project export, reload and attributed remix');

    await owner.goto(base+'/gallery.html#design='+sourceId+'&version=1'); await owner.locator('#owner-update').waitFor({state:'visible'}); await owner.locator('#owner-update').click();
    await owner.locator('#publish-description').fill('Version two description'); await owner.locator('#publish-consent').check(); await owner.locator('#publish-submit').click();
    await owner.locator('#success-open').waitFor({state:'visible'}); await owner.locator('#success-open').click();
    await owner.waitForFunction(()=>document.querySelector('#detail-version').options.length===2);
    assert.deepEqual((await (await owner.request.get(base+'/api/gallery?id='+sourceId+'&version=1')).json()).document,source.document);
    await owner.locator('#owner-withdraw').click();
    await owner.waitForFunction(()=>document.querySelector('#owner-withdraw').disabled);
    assert.equal((await owner.request.get(base+'/api/gallery?id='+sourceId+'&version=1')).status(),200);
    console.log('PASS owner immutable versioning and withdrawal preserves published versions');

    await visitor.locator('#detail-dialog [data-close]').click(); await visitor.locator('#gallery-locale').selectOption('ko');
    await visitor.setViewportSize({width:390,height:844});
    assert.ok(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await visitor.screenshot({path:output+'/gallery-mobile-ko.png',fullPage:true});
    await visitor.goto(base+'/editor.html'); await ready(visitor);
    for (const locale of ['ko','en']) {
      await visitor.locator('#studio-locale').selectOption(locale);
      for (const width of [320,390,768]) {
        await visitor.setViewportSize({width,height:844});
        assert.ok(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), `${locale} studio overflows at ${width}px`);
      }
    }
    await visitor.setViewportSize({width:390,height:844});
    for(const theme of ['light','dark']) {await visitor.locator('#preview-'+theme).click();await visitor.screenshot({path:output+'/studio-mobile-'+theme+'.png'});}
    await visitor.close();
    visitor=await browser.newPage({viewport:{width:1512,height:1100}});
    observe(visitor);
    await visitor.goto(base+'/editor.html'); await ready(visitor);
    assert.equal((await snap(visitor)).provenance,undefined);
    await visitor.locator('#project-file').setInputFiles({name:'downloaded.json',mimeType:'application/json',buffer:Buffer.from(serialized)});
    await visitor.waitForFunction(async()=> (await ProfileKitEditor.snapshot()).name==='My independent remix');
    assert.equal((await snap(visitor)).provenance.id,sourceId);
    await visitor.screenshot({path:output+'/studio-desktop-restored.png'});
    await visitor.locator('[data-preset="blank"]').click();
    assert.equal((await snap(visitor)).provenance,undefined);
    assert.equal(await visitor.evaluate(()=>ProfileKitEditor.source()),null);
    assert.deepEqual(errors,[]);
    assert.deepEqual(consoleErrors,[]);
    console.log('PASS KO/EN, light/dark/mobile, source file recovery, replacement clears provenance, zero runtime errors');
  } catch(error) {
    await owner.screenshot({path:output+'/community-owner-failure.png',fullPage:true});
    if(visitor) await visitor.screenshot({path:output+'/community-visitor-failure.png',fullPage:true});
    throw error;
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
