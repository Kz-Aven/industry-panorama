import { arrangeAtlas, connectionMarkup, escape } from './svg.mjs';
import { read } from './workspace.mjs';

const css = read('src/viewer.css');
const client = read('src/viewer.js');
const jsonForHTML = value => JSON.stringify(value).replaceAll('<','\\u003c');

export function renderHTML(document, images) {
  const atlas=document.scenes ? document : {
    ...document, scenes:[document], connections:[], annotations:[],
    zones:[{id:'scene',title:'工作场景',scene_ids:[document.id]}],
  };
  const layout=arrangeAtlas(atlas,{featured:!document.scenes});
  const compact=arrangeAtlas(atlas,{compact:true});
  const compactCards=new Map(compact.cards.map(card=>[card.id,card]));
  const scenes=new Map(atlas.scenes.map(s=>[s.id,s]));
  const caseCount=new Set(atlas.scenes.flatMap(s=>s.semantic.cases?.map(c=>c.id) ?? [])).size;
  const layers=atlas.layers ?? [];
  const layerHTML=layers.map(layer=>`<section id="layer-${layer.id}" class="layer" hidden>
    <h2>${escape(layer.heading ?? layer.title)}</h2>
    ${layer.sections.map(section=>`<article><h3>${escape(section.title)}</h3>
      <ol>${section.entries.map(entry=>`<li><strong>${escape(entry.label)}</strong>
        ${entry.participant ? `<small>${escape(entry.participant)}</small>` : ''}
        ${entry.description ? `<p>${escape(entry.description)}</p>` : ''}</li>`).join('')}</ol>
      ${section.note ? `<p class="muted">${escape(section.note)}</p>` : ''}</article>`).join('')}
    ${layer.note ? `<p class="muted">${escape(layer.note)}</p>` : ''}</section>`).join('');
  const media=new Map();
  const art=Object.fromEntries([...images].map(([id,svg])=>[id,svg.replace(
    /xlink:href="(data:image\/[^"]+;base64,[A-Za-z0-9+/=]+)"/g, (_, uri)=>{
      if(!media.has(uri)) media.set(uri,media.size);
      return `xlink:href="scene-media:${media.get(uri)}"`;
    })]));
  const handoffs=new Map();
  if(atlas.type==='process_journey' || atlas.type==='ai_opportunity_map'){
    for(const edge of atlas.connections){
      if(edge.kind!=='flow') continue;
      if(!handoffs.has(edge.source)) handoffs.set(edge.source,[]);
      handoffs.get(edge.source).push(edge.label);
    }
  }
  const cards=layout.cards.map(c=>{
    const s=scenes.get(c.id);
    const total=s.semantic.cases?.length ?? 0;
    const narrow=compactCards.get(c.id);
    const outgoing=handoffs.get(c.id);
    const handoff=outgoing?.length ? `<span class="scene-handoff">交接 · ${escape(outgoing.join('、'))}</span>` : '';
    return `<button class="scene" type="button" aria-pressed="false" data-scene="${c.id}" style="--x:${c.x}px;--y:${c.y}px;--w:${c.w}px;--h:${c.h}px;--mx:${narrow.x}px;--my:${narrow.y}px"><img draggable="false" alt=""><span class="scene-label"><strong>${escape(s.title)}</strong>${total ? `<small>${total} 案例</small>` : ''}${handoff}</span></button>`;
  }).join('');
  const zones=layout.zones.map(({zone,x,y},i)=>`<div class="zone" style="--x:${x}px;--y:${y}px;--mx:${compact.zones[i].x}px;--my:${compact.zones[i].y}px"><h2>${escape(zone.title)}</h2>${zone.description ? `<span>${escape(zone.description)}</span>` : ''}</div>`).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(atlas.title)}</title><style>${css}</style></head>
<body>
<header class="masthead">
  <div><h1>${escape(atlas.title)}</h1><p>${escape(atlas.description)}</p></div>
  <span class="total">${scenes.size} 个场景${caseCount ? ` · ${caseCount} 个案例` : ''}</span>
</header>
${layers.length ? `<nav class="tabs" aria-label="图谱视图"><button type="button" data-view="map" aria-pressed="true">${({industry_atlas:'价值链总图',process_journey:'业务流程图',ai_opportunity_map:'AI 机会图'})[atlas.type] ?? '场景总图'}</button>${layers.map(l=>`<button type="button" data-view="layer-${l.id}" aria-pressed="false">${escape(l.title)}</button>`).join('')}</nav>` : ''}
<main>
  <section id="map" class="atlas">
    <div class="map-column">
      <div class="toolbar">
        <label>查找<input id="query" type="search" placeholder="搜索场景、案例或岗位"></label>
        ${atlas.zones.length>1 ? `<label>分区<select id="zone"><option value="">全部</option>${atlas.zones.map(z=>`<option value="${z.id}">${escape(z.title)}</option>`).join('')}</select></label>` : ''}
        <div class="zoom" aria-label="画布缩放"><button type="button" id="dec" aria-label="缩小">−</button><output id="scale">100%</output><button type="button" id="inc" aria-label="放大">+</button><button type="button" id="fit">适应</button></div>
      </div>
      <div class="viewport" id="viewport" tabindex="0" aria-label="微缩场景画布">
        <div id="surface"><div id="canvas">
          <svg class="links wide" aria-hidden="true" viewBox="0 0 ${layout.width} ${layout.height}">${connectionMarkup(atlas,layout,false,'arrow-wide')}</svg>
          <svg class="links compact" aria-hidden="true" viewBox="0 0 ${compact.width} ${compact.height}">${connectionMarkup(atlas,compact,false,'arrow-compact')}</svg>
          ${zones}${cards}
        </div></div>
      </div>
      <div class="map-footer"><span id="results" aria-live="polite"></span>${atlas.annotations.filter(a=>!a.scene_id).map(a=>`<span>${escape(a.text)}</span>`).join('')}</div>
    </div>
    <aside class="inspector" aria-label="场景知识详情"><div id="detail"></div></aside>
  </section>
  ${layerHTML}
</main>
<script type="application/json" id="atlas-data">${jsonForHTML({
  scenes:atlas.scenes.map(({scene,render,...s})=>({...s,objects:scene.objects.filter(o=>o.interaction)})),
  zones:atlas.zones, annotations:atlas.annotations, source_refs:atlas.source_refs,
  default_scene_id:atlas.interaction?.default_scene_id,
  art, media:[...media.keys()],
  wide:{width:layout.width,height:layout.height},compact:{width:compact.width,height:compact.height},
})}</script>
<script>${client}</script></body></html>\n`;
}
