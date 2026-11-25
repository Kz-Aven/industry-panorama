import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const atlas=JSON.parse(readFileSync('examples/information-technology/atlas.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const context=await browser.newContext({offline:true,viewport:{width:1440,height:1060}});
  const page=await context.newPage();
  const errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url())) network.push(r.url());});
  const file=pathToFileURL(resolve('outputs/information-technology-atlas.html')).href;
  await page.goto(file);
  assert.equal(await page.locator('.scene').count(),9);
  assert.equal(await page.locator('#detail h2').innerText(),'机房与算力运营');
  const seen=new Set();
  for(const scene of atlas.scenes){
    await page.locator(`[data-scene="${scene.id}"]`).click();
    assert.equal(await page.locator('#detail h2').innerText(),scene.title);
    assert.equal(await page.locator(`[data-scene="${scene.id}"]`).getAttribute('aria-pressed'),'true');
    const actual=await page.locator('#detail [data-case-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.caseId));
    assert.deepEqual(actual,scene.interaction.case_ids);
    for(const id of actual) seen.add(id);
    await page.locator(`[data-scene="${scene.id}"] img`).evaluate(img=>img.decode());
  }
  assert.equal(seen.size,50);
  const query=page.locator('#query');
  await query.fill('GPU 故障换卡台账');
  assert.equal(await page.locator('.scene:not(:disabled)').count(),1);
  assert.equal(await page.locator('#detail details[data-case-id][open]').count(),1);
  await query.fill('');
  await page.locator('#zone').selectOption('run-service');
  assert.equal(await page.locator('.scene:not(:disabled)').count(),3);
  await page.locator('#zone').selectOption('');
  await page.locator('[data-scene="datacenter"]').click();
  await page.getByRole('button',{name:'服务器机柜',exact:true}).click();
  assert.match(await page.locator('details[data-case-id][open] summary').innerText(),/机房巡检记录结构化/);
  await page.getByText('业务对象与资料来源',{exact:true}).click();
  assert.match(await page.locator('#detail').innerText(),/【信息技术·生产】机房巡检记录结构化/);
  await page.getByRole('button',{name:'机房巡检流程',exact:true}).click();
  assert.equal(await page.locator('.layer:visible li').count(),5);
  await page.getByRole('button',{name:'价值链总图',exact:true}).click();
  await page.locator('#viewport').evaluate(node=>{node.scrollTop=0;});
  await page.screenshot({path:'outputs/previews/information-technology-browser.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.goto(file);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('[data-scene="service"]').click();
  assert.equal(await page.locator('#detail [data-case-id]').count(),8);
  assert.deepEqual(errors,[]);
  assert.deepEqual(network,[]);
  console.log('信息技术离线 Chrome：9 场景与 50 个案例、搜索、分区、物件案例入口、来源定位、流程标签和移动端通过。');
} finally {
  await browser.close();
}
