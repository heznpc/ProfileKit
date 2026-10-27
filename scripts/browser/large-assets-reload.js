const {chromium}=require(process.env.PROFILEKIT_PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:process.env.PROFILEKIT_BROWSER_CHANNEL || undefined,headless:true});let page=await browser.newPage({viewport:{width:1512,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const base=process.env.PROFILEKIT_TEST_ORIGIN,original='# Profile\n\n<a href="https://example.com"><img src="'+base+'/api/hero?name=Ren" alt="Keep" width="49%" /></a>\n\nKeep this.';
 try{
 await page.goto(base+'/readme.html');await page.locator('.advanced-options > summary').click();await page.locator('#readme-origin').fill(base);await page.locator('#readme-origin').press('Tab');await page.locator('#readme-show-import').click();await page.locator('#readme-source').fill(original);await page.locator('#readme-import').click();
 async function open(){await page.locator('#readme-open-editor').click();await page.waitForURL('**/editor.html#readme-edit=*');await page.waitForFunction(()=>!document.querySelector('#readme-return').disabled)}
 await open();
 const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=1200;const x=c.getContext('2d'),i=x.createImageData(1200,1200);let seed=1;for(let n=0;n<i.data.length;n++){seed=(seed*16807)%2147483647;i.data[n]=n%4===3?255:seed%256}x.putImageData(i,0,0);return c.toDataURL('image/png').split(',')[1]});
 await page.locator('#image-file').setInputFiles({name:'texture.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
 await page.waitForFunction(()=>document.querySelectorAll('#canvas-host [data-element-id]').length===2);
 await page.locator('#image-file').setInputFiles({name:'second-texture.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
 await page.waitForFunction(()=>document.querySelectorAll('#canvas-host [data-element-id]').length===3);
 await page.waitForFunction(()=>document.querySelector('#status-message').textContent.includes('저장됨'));
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#readme-return').disabled);
 assert.equal(await page.locator('#canvas-host [data-element-id]').count(),3);
 await page.locator('#readme-return').click();await page.locator('#asset-return').waitFor({state:'visible'});await page.locator('#asset-path').fill('assets/custom-profile.svg');
 const dl=page.waitForEvent('download');await page.locator('#asset-return').click();await (await dl).saveAs(process.env.PROFILEKIT_TEST_OUTPUT+'/custom-profile.svg');await page.waitForURL(u=>u.pathname==='/readme.html');await page.waitForFunction(()=>!location.hash);
 await page.locator('#readme-view-source').click();assert.equal(await page.locator('#readme-source').inputValue(),original.replace(base+'/api/hero?name=Ren','assets/custom-profile.svg'));
 assert.ok(await page.locator('#readme-card-apply').isDisabled());
 await page.locator('#readme-view-preview').click();
 const preview=page.frameLocator('#readme-preview');
 await preview.locator('img').waitFor();
 await page.waitForFunction(()=>{const f=document.querySelector('#readme-preview');return f.srcdoc.includes('data:image/svg+xml')});
 await page.screenshot({path:process.env.PROFILEKIT_TEST_OUTPUT+'/asset-readme-preview.png'});
 await page.reload();await page.locator('#readme-open-editor').waitFor();
 await open();assert.equal(await page.locator('#canvas-host [data-element-id]').count(),3);await page.locator('#readme-return-cancel').click();await page.waitForURL(u=>u.pathname==='/readme.html');await page.waitForFunction(()=>!location.hash);
 console.log('PASS multi-megabyte raster drafts reload via IndexedDB; large raster -> downloaded standalone SVG -> original README slot, re-open retains 3 layers and cancel preserves asset');
 await open();await page.locator('#add-text').click();await page.locator('#readme-return').click();await page.locator('#asset-return').waitFor({state:'visible'});assert.equal(await page.locator('#asset-path').inputValue(),'assets/custom-profile.svg');
 const dl2=page.waitForEvent('download');await page.locator('#asset-return').click();await dl2;await page.waitForURL(u=>u.pathname==='/readme.html');await page.waitForFunction(()=>!location.hash);
 const projectDownload=page.waitForEvent('download');await page.locator('#readme-project-save').click();await (await projectDownload).saveAs(process.env.PROFILEKIT_TEST_OUTPUT+'/readme-project.json');
 await page.close();
 page=await browser.newPage({viewport:{width:1512,height:1100}});
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(base+'/readme.html');await page.locator('#readme-project-file').setInputFiles(process.env.PROFILEKIT_TEST_OUTPUT+'/readme-project.json');
 await page.waitForFunction(()=>document.querySelector('#readme-source').value.includes('assets/custom-profile.svg'));
 await open();assert.equal(await page.locator('#canvas-host [data-element-id]').count(),4);
 await page.screenshot({path:process.env.PROFILEKIT_TEST_OUTPUT+'/asset-reopened.png'});
 assert.deepEqual(errors,[]);console.log('PASS saved project restores 4 layers in a fresh browser context without previous IndexedDB; zero runtime errors');
 }catch(e){await page.screenshot({path:process.env.PROFILEKIT_TEST_OUTPUT+'/asset-failure.png',fullPage:true});throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
