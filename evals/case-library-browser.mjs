import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const coverage=JSON.parse(readFileSync('examples/case-library/coverage.json','utf8'));
const base=resolve('outputs/case-library');
const url=file=>pathToFileURL(resolve(base,file+'.html')).href;
const preview=resolve('outputs/previews/case-library');
mkdirSync(preview,{recursive:true});
try {
  const context=await browser.newContext({viewport:{width:1440,height:1040},offline:true});
  const page=await context.newPage();
  const errors=[],remote=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',req=>{if(/^https?:/.test(req.url())) remote.push(req.url());});
  await page.goto(url('index'));
  const links=await page.locator('main article a.catalog-link').evaluateAll(anchors=>anchors.map(a=>a.href));
  assert.equal(links.length,22);
  await page.screenshot({path:resolve(preview,'index.png'),fullPage:true});
  for(const item of coverage.industries){
    await page.goto(url(item.id+'-atlas'));
    const cards=page.locator('[data-scene]');
    assert.equal(await cards.count(),item.scenes);
    assert.match(await page.locator('.total').innerText(),new RegExp(item.cases+' 个案例'));
    const data=await page.locator('#atlas-data').evaluate(node=>JSON.parse(node.textContent));
    const caseIds=new Set(data.scenes.flatMap(scene=>scene.semantic.cases.map(c=>c.id)));
    assert.equal(caseIds.size,item.cases);
    for(const card of await cards.all()) {
      await card.click({force:true});
      await card.locator('img').evaluate(img=>img.decode());
      assert.equal(await card.getAttribute('aria-pressed'),'true');
    }
    const representative=data.scenes.find(scene=>scene.id===data.default_scene_id);
    const searchCase=representative.semantic.cases[0];
    await page.locator('#query').fill(searchCase.title);
    const detail=page.locator('[data-case-id="'+searchCase.id+'"]');
    assert.equal(await detail.count(),1);
    if(await detail.evaluate(element=>element.open)) await detail.locator('summary').click();
    await detail.locator('summary').click();
    assert.equal(await detail.evaluate(element=>element.open),true);
    await page.locator('#query').clear();
    await page.getByRole('button',{name:'典型业务流程'}).click();
    assert.equal(await page.locator('#layer-example-process li').count(),item.handoffs+1);
    await page.locator('button[data-view="map"]').click();
    await page.locator('[data-scene="'+data.default_scene_id+'"]').click();
    if(['logistics','medical-health','consumer-retail'].includes(item.id)){
      await page.screenshot({path:resolve(preview,item.id+'-atlas.png'),fullPage:true});
    }

    await page.goto(url(item.id+'-journey'));
    assert.equal(await page.locator('.scene-handoff').count(),item.handoffs);
    assert.equal(await page.locator('[data-scene]').count(),item.handoffs+1);
    const final=page.locator('[data-scene]').last();
    await final.click({force:true});
    await final.locator('img').evaluate(img=>img.decode());
    assert.equal(await final.getAttribute('aria-pressed'),'true');
    if(item.id==='logistics') await page.screenshot({path:resolve(preview,'logistics-journey.png'),fullPage:true});
    console.log(item.industry+' · '+item.cases+' 案例 · '+item.scenes+' 场景 · '+item.handoffs+' 条流程线');
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(url('consumer-retail-atlas'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'典型业务流程'}).click();
  assert.equal(await page.locator('#layer-example-process li').count(),4);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  assert.deepEqual(remote,[]);
} finally {
  await browser.close();
}
