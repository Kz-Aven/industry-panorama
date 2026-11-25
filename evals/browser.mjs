import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const { chromium }=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const out=resolve(process.argv[2] ?? 'outputs');
mkdirSync(out,{recursive:true});

try {
  const context=await browser.newContext({viewport:{width:1440,height:1060},offline:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const remote=[];
  page.on('request',request=>{if(/^https?:/.test(request.url())) remote.push(request.url());});
  const open=async name=>page.goto(pathToFileURL(resolve('outputs/'+name+'.html')).href);

  await open('production-quality');
  assert.equal(await page.locator('#detail [data-case-id]').count(),10);
  await page.locator('[data-scene="production-quality"]').click();
  await page.locator('[data-case-id="case-14"] summary').click();
  assert.match(await page.locator('[data-case-id="case-14"]').innerText(),/三周前的基线/);
  await page.getByRole('button',{name:'加工与开工核查'}).click();
  assert.equal(await page.locator('details[open][data-case-id]').count(),3);
  assert.equal(await page.locator('img').evaluate(img=>img.complete && img.naturalWidth>0),true);
  await page.screenshot({path:resolve(out,'production-browser.png'),fullPage:true});

  await open('manufacturing-atlas');
  assert.equal(await page.locator('.scene:not(:disabled)').count(),9);
  assert.equal(await page.locator('#detail h2').innerText(),'计划与供应');
  await page.locator('[data-scene="production-quality"]').click();
  assert.equal(await page.locator('#detail h2').innerText(),'生产与质检');
  await page.locator('#query').fill('低良批次初判快报');
  assert.equal(await page.locator('.scene:not(:disabled)').count(),1);
  assert.equal(await page.locator('#detail [data-case-id]').count(),1);
  assert.equal(await page.locator('[data-case-id="case-19"]').getAttribute('open'),'');
  await page.locator('#query').fill('');
  await page.locator('#zone').selectOption('cross-functional');
  assert.equal(await page.locator('.scene:not(:disabled)').count(),3);
  await page.locator('#zone').selectOption('');
  for(const [tab,count] of [['岗位协作图',7],['场景逻辑链',5],['业务对象关系图',9]]) {
    await page.getByRole('button',{name:tab,exact:true}).click();
    assert.equal(await page.locator('.layer:visible li').count(),count);
  }
  await page.getByRole('button',{name:'价值链总图',exact:true}).click();
  const getScale=()=>page.locator('#scale').innerText();
  const before=await getScale();
  await page.locator('#inc').click();
  await page.locator('#inc').click();
  assert.notEqual(await getScale(),before);
  const canvas=page.locator('#viewport');
  await canvas.evaluate(node=>{node.scrollLeft=0;node.scrollTop=0;});
  const box=await canvas.boundingBox();
  await page.mouse.move(box.x+140,box.y+105);
  await page.mouse.down();
  await page.mouse.move(box.x+55,box.y+35,{steps:6});
  await page.mouse.up();
  assert.ok(await canvas.evaluate(node=>node.scrollLeft>0 && node.scrollTop>0));
  await page.locator('#fit').click();
  assert.equal(await getScale(),before);
  await page.locator('[data-scene="production-quality"]').click();
  await page.locator('#viewport').evaluate(node=>{node.scrollTop=0;});
  await page.screenshot({path:resolve(out,'atlas-browser.png'),fullPage:true});

  await page.setViewportSize({width:390,height:844});
  await open('pmc-role');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('[data-scene="pmc-material"]').click();
  assert.equal(await page.locator('#detail h2').innerText(),'齐套核查与来料跟催');
  await page.screenshot({path:resolve(out,'pmc-mobile.png'),fullPage:true});

  await open('finance-review');
  assert.equal(await page.locator('#detail [data-case-id]').count(),1);
  await page.setViewportSize({width:1440,height:1060});
  await open('asset-library');
  assert.equal(await page.locator('.sprite a:visible').count(),47);
  const sprite=page.getByRole('img',{name:'数控机床 0°'});
  await sprite.scrollIntoViewIfNeeded();
  assert.ok(await sprite.evaluate(img=>img.complete && img.naturalWidth>0));
  await page.locator('#angle').selectOption('90°');
  const rotated=page.getByRole('img',{name:'数控机床 90°'});
  await rotated.scrollIntoViewIfNeeded();
  await rotated.evaluate(img=>img.decode());
  assert.match(await rotated.getAttribute('src'),/cnc-90[.]png$/);
  assert.deepEqual(errors,[]);
  assert.deepEqual(remote,[]);
  console.log('Chrome 离线验收通过：案例展开、物件绑定、搜索、分区筛选、知识视图、缩放、拖拽、移动端、财务示例和资产库四向切换。');
} finally {
  await browser.close();
}
