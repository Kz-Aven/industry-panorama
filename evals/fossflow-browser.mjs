import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

const build=resolve(process.argv[2]);
const out=resolve(process.argv[3] ?? 'outputs/previews');
const readJSON=async path=>JSON.parse(await readFile(path,'utf8'));
await readFile(join(build,'index.html'));
await mkdir(out,{recursive:true});

const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
const server=createServer(async (request,response)=>{
  const path=resolve(build,'.'+new URL(request.url,'http://localhost').pathname);
  try {
    const file=path===build?join(build,'index.html'):path;
    if(!file.startsWith(build+sep)) throw new Error('Outside application root');
    const content=await readFile(file);
    response.writeHead(200,{'Content-Type':mime[extname(file)] ?? 'application/octet-stream'});
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
});
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const temp=await mkdtemp(join(tmpdir(),'composer-fossflow-'));
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url='http://127.0.0.1:'+server.address().port;

function checkFields(actual,expected,path) {
  if(Array.isArray(expected)){
    assert.equal(actual?.length,expected.length,path);
    expected.forEach((value,i)=>checkFields(actual[i],value,path+'['+i+']'));
  } else if(expected && typeof expected==='object'){
    for(const [key,value] of Object.entries(expected)) checkFields(actual?.[key],value,path+'.'+key);
  } else if(typeof expected==='string' && expected.startsWith('data:image/')){
    assert.ok(actual===expected,path+' image changed');
  } else {
    assert.equal(actual,expected,path);
  }
}

try {
  for(const sample of ['manufacturing-atlas','information-technology-atlas','customer-service-journey']){
    const original=resolve('outputs',sample+'.fossflow.json');
    const expected=await readJSON(original);
    const map=await readJSON(resolve('outputs',sample+'.fossflow.mapping.json'));
    const [view]=expected.views;
    const icons=expected.icons;
    const downloaded=join(temp,sample+'.json');
    for(const [pass,input] of [original,downloaded].entries()){
      const context=await browser.newContext({locale:'en-US',viewport:{width:1536,height:1024},serviceWorkers:'block'});
      try {
        await context.route('**/*',route=>route.request().url().startsWith(url+'/')?route.continue():route.abort());
        await context.addInitScript(()=>{
          localStorage.setItem('fossflow-lazy-loading-welcome-dismissed','true');
          localStorage.setItem('fossflow_import_hint_dismissed','true');
          localStorage.setItem('fossflow_connector_hint_dismissed','true');
        });
        const page=await context.newPage();
        const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        page.on('dialog',async dialog=>{errors.push(dialog.message());await dialog.dismiss();});
        await page.goto(url);
        await page.getByRole('button',{name:'Main menu',exact:true}).click({timeout:8000});
        const [chooser]=await Promise.all([
          page.waitForEvent('filechooser',{timeout:8000}),
          page.getByRole('menuitem',{name:'Open',exact:true}).click({timeout:8000}),
        ]);
        await chooser.setFiles(input);
        const sprites=page.locator('img[src^="data:image/png;base64,"]');
        await page.waitForFunction(({count,size})=>{
          const imgs=[...document.querySelectorAll('img[src^="data:image/png;base64,"]')];
          return imgs.length>=count && imgs.every(img=>img.complete && img.naturalWidth===size && img.naturalHeight===size);
        },{count:icons.length,size:map.sprite.size});
        for(const item of expected.items) await page.getByText(item.name,{exact:true}).first().waitFor({state:'visible'});
        for(const zone of view.textBoxes) await page.getByText(zone.content,{exact:true}).first().waitFor({state:'visible'});
        for(const edge of view.connectors) await page.getByText(edge.labels[0].text,{exact:true}).first().waitFor({state:'visible'});
        await page.getByRole('button',{name:'Fit to screen',exact:true}).click();
        const positions=await sprites.evaluateAll((imgs,urls)=>imgs.filter(img=>urls.includes(img.src)).map(img=>{
          const box=img.getBoundingClientRect();
          return [urls.indexOf(img.src),{x:box.x+box.width/2,y:box.y+box.height/2,
            width:parseFloat(getComputedStyle(img).width),screenWidth:box.width}];
        }),icons.map(icon=>icon.url));
        const positionsByIcon=new Map(positions);
        assert.equal(positionsByIcon.size,icons.length);
        const nodePlacements=view.items.map(node=>{
          const item=expected.items.find(item=>item.id===node.id);
          return {tile:node.tile,box:positionsByIcon.get(icons.findIndex(icon=>icon.id===item.icon))};
        });
        const [first]=nodePlacements;
        const zoom=first.box.screenWidth / first.box.width;
        for(const {box,tile} of nodePlacements) {
          const dx=tile.x-first.tile.x,dy=tile.y-first.tile.y;
          assert.ok(Math.abs(box.width-141.5*.8*map.sprite.scale)<1,sample+' image scale');
          assert.ok(Math.abs(box.x-first.box.x-(dx-dy)*70.75*zoom)<1,sample+' horizontal anchor');
          assert.ok(Math.abs(box.y-first.box.y+(dx+dy)*40.95*zoom)<1,sample+' vertical anchor');
        }
        if(pass===1) await page.screenshot({path:join(out,'fossflow-'+sample+'.png')});

        await page.getByRole('button',{name:'Main menu',exact:true}).click();
        const [download]=await Promise.all([
          page.waitForEvent('download',{timeout:8000}),
          page.getByRole('menuitem',{name:'Export as JSON',exact:true}).click({timeout:8000}),
        ]);
        const filename=pass===0?downloaded:join(temp,sample+'-again.json');
        await download.saveAs(filename);
        const actual=await readJSON(filename);
        const {title,colors,items,views}=expected;
        checkFields(actual,{title,icons,colors,items,views},sample+' pass '+(pass+1));
        assert.deepEqual(errors,[]);
      } catch(error) {
        console.error(sample, 'pass', pass+1);
        throw error;
      } finally {
        await context.close();
      }
    }
    assert.equal(map.view_id,view.id);
    for(const scene of map.scenes) {
      assert.ok(view.items.some(item=>item.id===scene.fossflow_item_id));
      assert.ok(icons.some(icon=>icon.id===scene.fossflow_icon_id));
    }
    for(const zone of map.zones) assert.ok(view.rectangles.some(region=>region.id===zone.fossflow_region_id));
    for(const edge of map.connections) assert.ok(view.connectors.some(connector=>connector.id===edge.fossflow_connector_id));
    console.log(sample+': '+view.items.length+' nodes, '+view.rectangles.length+' regions, '+view.connectors.length+' connectors');
  }
} finally {
  await browser.close();
  await new Promise(done=>server.close(done));
  await rm(temp,{recursive:true,force:true});
}
