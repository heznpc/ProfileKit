const {chromium}=require(process.env.PROFILEKIT_PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs/promises');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:process.env.PROFILEKIT_BROWSER_CHANNEL || undefined,headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {await page.goto(process.env.PROFILEKIT_TEST_ORIGIN+'/editor.html');
await page.locator('#import-card-input').fill(process.env.PROFILEKIT_TEST_ORIGIN+'/api/typing?lines=Hello&width=700&height=120&frame=true');await page.locator('#import-card-button').click();await page.waitForFunction(()=>document.querySelector('#card-endpoint-label').textContent==='/typing');
await page.locator('#embed-open').click();await page.locator('.asset-export summary').click();
for(const [format,height] of [['svg',240],['png',360]]) {
let release;const gate=new Promise(r=>release=r);let measured;const seen=new Promise(r=>measured=r);
await page.route('**/api/typing?**',async route=>{if(route.request().resourceType()==='image' && new URL(route.request().url()).searchParams.get('height')===String(height)){measured();await gate;}await route.continue();});
let downloaded=false;const ready=page.waitForEvent('download').then(d=>{downloaded=true;return d});
await page.evaluate(({format,height})=>{const f=document.querySelector('#card-param-height');f.value=String(height);f.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#export-'+format).click();},{format,height});
await seen;await new Promise(r=>setTimeout(r,400));assert.equal(downloaded,false,'export must wait for measurement');release();
const download=await ready;const path=process.env.PROFILEKIT_TEST_OUTPUT+'/race.'+format;await download.saveAs(path);
const canvas=await page.locator('#canvas-host > svg.editor-artboard').evaluate(s=>({width:Number(s.getAttribute('width')),height:Number(s.getAttribute('height'))}));
const bytes=await fs.readFile(path);let output;
if(format==='svg'){const text=bytes.toString();output={width:Number(text.match(/<svg[^>]*\bwidth="([^"]+)"/)[1]),height:Number(text.match(/<svg[^>]*\bheight="([^"]+)"/)[1])};assert.deepEqual(output,canvas);}else {output={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};assert.deepEqual(output,{width:canvas.width*2,height:canvas.height*2});}
assert.equal(canvas.height,height);console.log(JSON.stringify({format,blockedWhileMeasurementPending:true,canvas,output}));await page.unroute('**/api/typing?**');
}assert.deepEqual(errors,[]);console.log('No page errors');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
