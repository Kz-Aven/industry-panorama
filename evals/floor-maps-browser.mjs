import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const designs=JSON.parse(readFileSync('examples/case-library/floor-maps.json','utf8'));
const output=resolve('outputs/case-library');
const preview=resolve('outputs/previews/floor-maps');
mkdirSync(preview,{recursive:true});
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},offline:true,reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[],remote=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^https?:/.test(request.url())) remote.push(request.url());});
  if(process.argv.length===2) {
    await page.goto(pathToFileURL(resolve(output,'index.html')).href);
    const links=await page.locator('main a.floor-link').evaluateAll(anchors=>anchors.map(a=>a.href));
    assert.equal(links.length,Object.keys(designs).length+1);
    for(const href of links) readFileSync(fileURLToPath(href));
  }
  for(const id of process.argv.length>2?process.argv.slice(2):Object.keys(designs)) {
    await page.goto(pathToFileURL(resolve(output,id+'-floor-map.html')).href);
    await page.locator('.map img').evaluate(img=>img.decode());
    assert.equal(await page.locator('main h1').innerText(),designs[id].title);
    assert.equal(await page.locator('.pin').count(),4);
    assert.equal(await page.locator('.route.material').count(),3);
    assert.equal(await page.locator('#trace-key').isVisible(),false);
    for(const [i,place] of designs[id].places.entries()){
      const pin=page.locator('.pin').nth(i);
      assert.equal(await pin.innerText(),place);
      await pin.click();
      assert.equal(await page.locator('.step').nth(i).getAttribute('aria-pressed'),'true');
      assert.ok(await page.locator('#scene-output').innerText());
      assert.ok(await page.locator('.route.material.active').count());
    }
    await page.locator('button.branch').click();
    assert.equal(await page.locator('.route.reverse.active').count(),1);
    assert.equal(await page.locator('#trace-key').isVisible(),true);
    assert.equal(await page.locator('#scene-title').innerText(),designs[id].branch[0]);
    await page.locator('.step').first().click();
    assert.equal(await page.locator('.route.reverse.active').count(),0);
    await page.locator('summary').click();
    assert.ok(await page.locator('details.source p').isVisible());
    await page.locator('summary').click();
    await page.reload();
    await page.locator('.map img').evaluate(img=>img.decode());
    if(['logistics','medical-health','digital-creative','information-technology'].includes(id)) {
      await page.screenshot({path:resolve(preview,id+'.png'),fullPage:true});
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('.pin').last().click();
    assert.equal(await page.locator('.step').last().getAttribute('aria-pressed'),'true');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.setViewportSize({width:1440,height:1000});
    console.log(id+' · 4 hotspots, 3 handoffs, branch, 390 px');
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(remote,[]);
} finally {
  await browser.close();
}
