import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { batches } from '../examples/case-library/industry-journeys.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000}});
const page=await context.newPage();
const errors=[],remote=[];
page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
page.setDefaultTimeout(8000);
page.on('request',request=>{if(/^https?:/.test(request.url())) remote.push(request.url());});
const open=file=>page.goto(pathToFileURL(resolve('outputs/case-library',file)).href);
let checked=0;
try{
  await open('index.html');
  assert.equal(await page.locator('a.journey-link').count(),12);
  for(const id of batches.flat()){
    const filename=id+'-business-journey.html';
    assert.equal(await page.locator('a.journey-link[href="'+filename+'"]').count(),1);
  }
  for(const [index,batch] of batches.entries()){
    for(const id of batch){
      const sourceFolder=id==='information-technology'?'examples/information-technology':'examples/case-library/'+id;
      const snapshot=JSON.parse(readFileSync(sourceFolder+'/source-data.json','utf8'));
      await open(id+'-business-journey.html');
      const map=await page.locator('#map-data').evaluate(node=>JSON.parse(node.textContent));
      assert.deepEqual(map.cases.map(c=>c.id).sort(),(snapshot.cases??snapshot).map(c=>c.id).sort());
      assert.equal(new Set(map.cases.map(c=>c.file)).size,map.cases.length);
      assert.equal(await page.locator('.site').count(),map.participants.length);
      await page.locator('.site img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
      for(const flow of map.journeys){
        await page.locator('#flow-tabs [data-flow='+flow.id+']').click();
        const routes=page.locator('.road button');
        assert.equal(await routes.count(),flow.external.length+flow.feedback.length);
        if(await routes.count()){
          await routes.first().click();
          assert.match(await page.locator('#detail').innerText(),/业务交接/);
        } else {
          assert.ok(await page.locator('.route-note').isVisible());
        }
      }
      await page.locator('#flow-tabs [data-flow=main]').click();
      if(['consumer-retail','medical-health','digital-creative'].includes(id)){
        await page.screenshot({path:'outputs/previews/'+id+'-business-journey.png',fullPage:true});
      }
      await page.locator('.section-title [data-view=factory]').click();
      await page.locator('.floor img').evaluate(img=>img.decode());
      assert.equal(await page.locator('.floor-pin').count(),4);
      const current=map.journeys[0].steps[0][3];
      await page.locator('[data-area='+current+']').click();
      const before=await page.locator('#detail h3').innerText();
      await page.locator('#detail [data-case]').first().click();
      await page.locator('#detail [data-case-back]').click();
      assert.equal(await page.locator('#detail h3').innerText(),before);
      if(['logistics','information-technology'].includes(id)){
        await page.screenshot({path:'outputs/previews/'+id+'-connected-workspaces.png',fullPage:true});
      }
      await page.locator('#view-tabs [data-view=roles]').click();
      assert.equal(await page.locator('.lane-task').count(),map.journeys[0].steps.length);
      await page.locator('#view-tabs [data-view=objects]').click();
      await page.locator('[data-record="0"]').click();
      assert.ok(await page.locator('#detail [data-case]').count());
      await page.locator('header [data-view=cases]').click();
      assert.equal(await page.locator('#case-list [data-case]').count(),map.cases.length);
      const actual=await page.locator('#case-list').evaluate(list=>[...list.querySelectorAll('[data-case]')].map(button=>{
        button.click();
        return [button.dataset.case,document.querySelector('#detail h3').textContent,location.hash];
      }));
      assert.deepEqual(actual,map.cases.map(c=>[c.id,c.title,'#'+c.id]));
      await page.locator('#detail [data-case-back]').click();
      assert.equal(await page.locator('#case-list [data-case]').count(),map.cases.length);
      await page.setViewportSize({width:390,height:844});
      await page.locator('#view-tabs [data-view=journey]').click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.setViewportSize({width:1440,height:1000});
      checked+=map.cases.length;
      console.log('批次 '+(index+1)+' · '+id+' · '+map.cases.length+' 案例');
    }
  }
  assert.equal(checked,640);
  assert.deepEqual(errors,[]);
  assert.deepEqual(remote,[]);
}finally{await browser.close();}
