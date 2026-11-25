import { readFileSync, writeFileSync } from 'node:fs';
import { escape } from '../../src/svg.mjs';

const root=new URL('../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const data=path=>JSON.parse(read('examples/case-library/'+path));
const designs=data('floor-maps.json');
const layouts=data('floor-layouts.json');
const flows=data('flows.json');
const industries=new Map(data('industries.json').map(item=>[item.id,item]));
const css=read('src/floor-map.css');

for(const id of process.argv.length>2 ? process.argv.slice(2) : Object.keys(designs)){
  const design=designs[id];
  const name=design.name ?? industries.get(id).name;
  const caseTitle=design.caseTitle ?? industries.get(id).flow;
  const sourceAtlas=id==='information-technology'?'examples/information-technology':'examples/case-library/'+id;
  const cases=JSON.parse(read(sourceAtlas+'/source-data.json'));
  const record=(cases.cases ?? cases).find(item=>item.title.startsWith(caseTitle));
  if(!record) throw new Error(id+' 缺少主线案例记录');
  const scope=design.scope ?? name;
  const reference=record.path ?? record.relative;
  const sequence=design.steps ?? flows[id];
  const stops=sequence.map(([title,who,action,input,output],i)=>({
    id:'step-'+(i+1),title,place:design.places[i],who,action,input,output,
    next:sequence[i+1]?'进入「'+sequence[i+1][0]+'」，下一环节以「'+sequence[i+1][3]+'」为输入。':'流程在「'+output+'」交付后收束。',
  }));
  const [title,from,to,who,input,action,output,next]=design.branch;
  const branch={id:'branch',title,place:design.places[from]+' → '+design.places[to],who,input,action,output,next};
  const [positions,...paths]=layouts[id];
  const pins=stops.map((item,i)=>{
    const [x,y]=positions[i];
    return `<button type="button" class="pin" data-select="${item.id}" style="--x:${x/15.36}%;--y:${y/10.24}%" aria-pressed="false">${escape(item.place)}</button>`;
  }).join('');
  const tabs=stops.map((item,i)=>`<button type="button" class="step" data-select="${item.id}" aria-pressed="false"><span>${i+1}</span>${escape(item.title)}</button>`).join('');
  const route=(i,track)=>{
    const branch=i===3, shape='route-'+i, marker=branch?'feedback':'forward';
    return `<g class="route ${branch?'reverse':'material'}" data-track="${track}">
      <use href="#${shape}" class="halo"/><use href="#${shape}" class="line" marker-end="url(#${marker})"/>
    </g>`;
  };
  const shapes=paths.map((path,i)=>`<path id="route-${i}" d="${path}"/>`).join('');
  const routes=paths.map((_,i)=>route(i,i===3?'branch':stops[i].id+' '+stops[i+1].id)).join('');
  const png=readFileSync(new URL('assets/illustrations/'+id+'-continuous-floor.png',root));
  const width=png.readUInt32BE(16), height=png.readUInt32BE(20);
  const image='data:image/png;base64,'+png.toString('base64');
  const atlasPath=id==='information-technology'?'../information-technology-atlas.html':id+'-atlas.html';
  const sourceText=caseTitle+' · '+reference+(record.flowLine?':'+record.flowLine:'');
  const json=JSON.stringify([...stops,branch]).replaceAll('<','\\u003c');
  const html=`<!doctype html><html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(design.title)}</title>
<style>${css}
.map{aspect-ratio:${width}/${height}}.crumbs{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;margin-bottom:10px;font-size:13px}.crumbs a{color:#23685d;text-underline-offset:3px}
.detail [hidden]{display:none}.detail .source summary{cursor:pointer}.detail .source p{font-size:12px;margin:6px 0 0;overflow-wrap:anywhere}
@media(max-width:480px){.pin{font-size:9px}}
</style></head>
<body><main>
<div class="crumbs"><a href="index.html">行业场景入口</a><a href="${atlasPath}">浏览${escape(name)}全部案例</a></div>
<header><h1>${escape(design.title)}</h1><p><span class="case">${escape(scope)}</span> · 点击场景中的工作区，沿箭头查看每一站的输入和交接物。</p></header>
<nav aria-label="流程步骤">${tabs}</nav>
<div class="layout"><div class="map-shell"><div class="map">
<img src="${image}" width="${width}" height="${height}" alt="${escape(name+'连续等距场景，包括'+design.places.join('、'))}">
<svg viewBox="0 0 1536 1024" preserveAspectRatio="none" aria-hidden="true"><defs>
<marker id="forward" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="3.8" markerHeight="3.8" orient="auto">
<path d="M1 1 11 6 1 11Z" fill="#008372" stroke="white" stroke-width="1"/></marker>
<marker id="feedback" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="3.8" markerHeight="3.8" orient="auto">
<path d="M1 1 11 6 1 11Z" fill="#a45525" stroke="white" stroke-width="1"/></marker>
${shapes}</defs>${routes}</svg>${pins}
</div><div class="key"><span><i></i>业务交接</span><span id="trace-key" hidden><i class="trace"></i>异常、复核或反馈路径</span></div></div>
<aside class="detail" aria-live="polite" aria-labelledby="scene-title">
<h2 id="scene-title"></h2><div id="scene-who"></div><p id="scene-action"></p>
<dl><dt>收到什么</dt><dd id="scene-input"></dd><dt>交出什么</dt><dd id="scene-output"></dd><dt>流向哪里</dt><dd id="scene-next"></dd></dl>
<details class="source"><summary>案例依据</summary><p>${escape(sourceText)}</p></details>
</aside></div>
<div class="branches"><button class="branch" type="button" data-select="branch" aria-pressed="false">${escape(branch.title)}</button></div>
<p class="foot">主线依据《${escape(caseTitle)}》整理。箭头表示业务交接，等距空间为工作场景示意。</p>
</main>
<script>
const steps=${json};
const buttons=[...document.querySelectorAll('[data-select]')];
const paths=[...document.querySelectorAll('[data-track]')];
function select(id,overview=false){
  const step=steps.find(item=>item.id===id);
  const values={title:step.title,who:step.place+' · '+step.who,action:step.action,input:step.input,output:step.output,next:step.next};
  for(const [key,value] of Object.entries(values)) document.getElementById('scene-'+key).textContent=value;
  for(const button of buttons) button.setAttribute('aria-pressed',String(button.dataset.select===id));
  for(const path of paths){
    const matches=path.dataset.track.split(' ').includes(id);
    path.classList.toggle('active',matches && !overview);
    path.classList.toggle('dim',!overview && !matches && !path.classList.contains('reverse'));
  }
  document.getElementById('trace-key').hidden=id!=='branch';
}
for(const button of buttons) button.addEventListener('click',()=>select(button.dataset.select));
select('step-1',true);
</script></body></html>\n`;
  writeFileSync(new URL('outputs/case-library/'+id+'-floor-map.html',root),html);
  console.log(name+' · '+caseTitle);
}
