import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const dir=mkdtempSync(join(tmpdir(),'isometric-scale-'));
const old=join(dir,'eager.html'), current=join(dir,'shared.html');
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const asFile=path=>pathToFileURL(resolve(path)).href;
const browser=await chromium.launch({channel:'chrome',headless:true});

try {
  const context=await browser.newContext({offline:true,viewport:{width:1440,height:1060}});
  const page=await context.newPage();
  const errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url())) network.push(r.url());});
  for(const [file,title,layer] of [
    ['customer-service-journey','业务流程图',5],
    ['procurement-ai-opportunity','AI 机会图',3],
  ]){
    await page.goto(asFile('outputs/p1/'+file+'.html'));
    assert.equal(await page.getByRole('button',{name:title,exact:true}).count(),1);
    assert.equal(await page.locator('.links.wide [data-connection-id]').count(),2);
    assert.equal(await page.locator('.scene-handoff').count(),2);
    const cards=page.locator('.scene');
    assert.equal(await cards.count(),3);
    for(let i=0;i<3;i++){
      await cards.nth(i).click();
      await cards.nth(i).locator('img').evaluate(img=>img.decode());
      assert.equal(await page.locator('#detail [data-case-id]').count(),1);
    }
    await page.getByRole('button',{name:'步骤与交接'}).click();
    assert.equal(await page.locator('.layer:visible li').count(),layer);
    await page.getByRole('button',{name:title,exact:true}).click();
    await page.screenshot({path:'outputs/previews/'+file+'.png',fullPage:true});
  }
  for(const [id,heading] of [['medical-intake','医疗问诊 · 主诉与资料记录'],['shipping-verification','出货复核与码头交接']]){
    await page.goto(asFile('outputs/p1/'+id+'.html'));
    assert.equal(await page.locator('#detail h2').innerText(),heading);
    await page.locator('.scene img').evaluate(img=>img.decode());
    await page.screenshot({path:'outputs/previews/'+id+'.png',fullPage:true});
  }

  const examples=[json('examples/manufacturing-atlas/atlas.json'),json('examples/information-technology/atlas.json')];
  const scenes=[],zones=[];
  for(let i=0;i<6;i++){
    const base=examples[i%examples.length];
    const copies=base.scenes.map(scene=>({...scene,id:`run-${i+1}-${scene.id}`}));
    scenes.push(...copies);
    zones.push({id:'test-'+i,title:`压力测试分区 ${i+1}`,scene_ids:copies.map(s=>s.id)});
  }
  const atlas={schema_version:'1.0.0',id:'scale-test',industry:'information-technology',type:'industry_atlas',
    title:'54 场景压力测试',description:'从制造业与信息技术图谱重复抽取场景，仅供压力测试。',
    scenes,zones,connections:[],annotations:[],interaction:{default_scene_id:scenes[0].id}};
  const input=join(dir,'scale.json');
  writeFileSync(input,JSON.stringify(atlas));
  const output=spawnSync(process.execPath,['src/cli.mjs','atlas',input,'-o',current],{encoding:'utf8'});
  assert.equal(output.status,0,output.stderr);
  const html=readFileSync(current,'utf8');
  const payload=/<script type="application\/json" id="atlas-data">([^<]+)<\/script>/;
  const data=JSON.parse(html.match(payload)[1]);
  // Recreate the previous single-file packaging with independently encoded eager scene images.
  const eager=html.replace(/(<button class="scene"[^>]*data-scene="([^"]+)"[^>]*><img draggable="false" alt="")/g,
    (_,tag,id)=>tag+' src="data:image/svg+xml;base64,'+Buffer.from(data.art[id].replace(/xlink:href="scene-media:(\d+)"/g,(_,i)=>`xlink:href="${data.media[i]}"`)).toString('base64')+'"');
  const {art,media,...metadata}=data;
  writeFileSync(old,eager.replace(payload,()=>'<script type="application/json" id="atlas-data">'+
    JSON.stringify(metadata).replaceAll('<','\\u003c')+'</script>'));
  async function measure(path,width,height) {
    await page.setViewportSize({width,height});
    await page.goto(asFile(path),{waitUntil:'domcontentloaded'});
    const start=await page.evaluate(async()=>{
      const el=document.querySelector('[data-scene][aria-pressed=true] img');
      await el.decode();
      return {first_ms:Math.round(performance.now()),loaded:document.querySelectorAll('.scene img[src]').length};
    });
    assert.equal(await page.locator('.scene').count(),54);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const zoom=await page.evaluate(async()=>{
      const begin=performance.now(),before=document.querySelector('#scale').value;
      document.querySelector('#inc').click();
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return {ms:Math.round(performance.now()-begin), changed:before!==document.querySelector('#scale').value};
    });
    assert.ok(zoom.changed);
    const last=page.locator('.scene').last();
    await last.click();
    await last.locator('img').evaluate(img=>img.decode());
    return {...start,zoom_ms:zoom.ms};
  }
  const median=items=>Object.fromEntries(Object.keys(items[0]).map(k=>[k,items.map(i=>i[k]).sort((a,b)=>a-b)[Math.floor(items.length/2)]]));
  const results={browser:browser.version(),scenes:54,unique_media:media.length,old_bytes:statSync(old).size,new_bytes:statSync(current).size,desktop:{},mobile:{}};
  for(const [name,w,h] of [['desktop',1440,1060],['mobile',390,844]]){
    const baseline=[],optimized=[];
    for(let round=0;round<3;round++){
      for(const [path,list] of (round%2?[[current,optimized],[old,baseline]]:[[old,baseline],[current,optimized]])){
        list.push(await measure(path,w,h));
      }
    }
    results[name]={baseline:median(baseline),optimized:median(optimized)};
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(network,[]);
  assert.ok(results.new_bytes<results.old_bytes/2);
  assert.ok(results.desktop.optimized.loaded<54 && results.mobile.optimized.loaded<54);
  writeFileSync('outputs/p1/performance.json',JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
} finally {
  await browser.close();
  rmSync(dir,{recursive:true,force:true});
}
