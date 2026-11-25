const data=JSON.parse(document.getElementById('map-data').textContent);
const get=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const workplace=data.workplace??'厂内工作区';
const views={journey:'上下游旅程',factory:workplace,roles:'部门协作',objects:'对象追踪',cases:'案例目录'};
const caseById=new Map(data.cases.map(c=>[c.id,c]));
const groupById=new Map(data.groups.map(g=>[g.id,g]));
const personById=new Map(data.participants.map(p=>[p.id,p]));
const svgCache=new Map();
const caseId=id=>typeof id==='number'?'case-'+id:id;
function art(id){
  if(!svgCache.has(id)){
    const svg=data.art[id].replace(/asset-slot:(\d+)/g,(_,i)=>data.media[i]);
    svgCache.set(id,URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})));
  }
  return svgCache.get(id);
}

let flow=data.journeys[0],view='journey',search='',group='',selection={type:'participant',id:'factory'};
let caseOrigin;
const initial=caseById.get(location.hash.slice(1));
if(initial){view='cases';selection={type:'case',id:initial.id};}
const tab=(label,key,value,active)=>'<button type="button" data-'+key+'="'+value+'" aria-pressed="'+active+'">'+esc(label)+'</button>';
const tags=(items)=>'<div class="tags">'+items.join('')+'</div>';
function caseLinks(ids){
  return '<div class="case-links">'+[...new Set(ids)].map(n=>{
    const item=caseById.get(caseId(n));
    return '<button type="button" data-case="'+item.id+'">'+esc(item.title)+'</button>';
  }).join('')+'</div>';
}
const action=(label,name,id)=>'<button type="button" class="quiet" data-'+name+'="'+id+'">'+esc(label)+'</button>';
function renderTabs(){
  get('flow-tabs').innerHTML=data.journeys.map(j=>tab(j.title,'flow',j.id,j.id===flow.id)).join('');
  get('view-tabs').innerHTML=Object.entries(views).map(([id,title])=>tab(title,'view',id,view===id)).join('');
  get('question').textContent=view==='cases'?'浏览 '+data.cases.length+' 个'+(data.industry??'制造业')+'案例':flow.question;
  get('tracked').textContent=view==='cases'?'按名称、场景或岗位搜索。':flow.object;
}
function externalView(){
  const nodes=data.participants.map(p=>p.id);
  const connected=new Set([...flow.external,...flow.feedback].flatMap(([a,b])=>[a,b]));
  const order=Object.fromEntries(nodes.map((id,i)=>[id,i]));
  const edges=[...flow.external.map((row,i)=>['e'+i,row]),...flow.feedback.map((row,i)=>['f'+i,row])];
  const lanes=new Set();
  const graph=edges.map(([id,[from,to,label]],i)=>{
    const a=order[from],b=order[to],feedback=id[0]==='f';
    const direction=a<b?'forward':'backward';
    const pair=Math.min(a,b)+'-'+Math.max(a,b);
    const row=!feedback&&Math.abs(a-b)===1&&!lanes.has(pair)?1:i+2;
    lanes.add(pair);
    return '<button class="outside-edge '+direction+(feedback?' feedback':'')+'" type="button" style="--start:'+
      (Math.min(a,b)+1)+';--end:'+(Math.max(a,b)+2)+';--row:'+row+'" data-edge="'+id+'">'+esc(label)+'</button>';
  }).join('');
  const markup=nodes.map(id=>{
    const p=personById.get(id);
    const on=selection.type==='participant'&&selection.id===id;
    return '<button type="button" class="site'+(connected.has(id)?'':' context')+'" data-participant="'+id+'" aria-pressed="'+on+'">'+
      '<img alt="" src="'+art(id)+'"><span>'+esc(p.title)+'</span></button>';
  }).join('');

  return '<div class="section-title"><div><h3>地点与业务交接</h3><p>点击地点查看该方的工作，点击连线查看交接物。</p></div>'+action('进入'+workplace,'view','factory')+'</div>'+
    '<div class="route-board" style="--places:'+nodes.length+'"><div class="sites">'+markup+'</div>'+
    (edges.length?'<div class="road" aria-label="上下游交接路径">'+graph+'</div><div class="route-key"><span>主线交接</span>'+
      (flow.feedback.length?'<span>反馈与回查</span>':'')+'</div>':'<p class="route-note">这条主线在同址工作区内推进。可进入工作区查看步骤，或切换主题查看外部交接。</p>')+'</div>'+
    '<div class="edge-list">'+edges.map(([id,[from,to,label]])=>'<button type="button" data-edge="'+id+'">'+
      '<span>'+esc(personById.get(from).title)+' → '+esc(personById.get(to).title)+'</span><strong>'+esc(label)+'</strong></button>').join('')+'</div>';
}
function floorView(){
  const [bx,by,w,h]=data.floorBounds;
  const areasUsed=new Set(flow.steps.map(step=>step[3]));
  const points=new Map(data.areas.map(a=>[a.id,a]));
  const route=flow.steps.slice(1).map((step,i)=>{
    const a=points.get(flow.steps[i][3]),b=points.get(step[3]);
    if(a.id===b.id) return '';
    const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);
    const inset=Math.min(distance*.26,120),ux=dx/distance,uy=dy/distance;
    const x1=a.x+ux*inset,y1=a.y+uy*inset,x2=b.x-ux*inset,y2=b.y-uy*inset;
    const d='M'+x1+' '+y1+' Q'+((x1+x2)/2+uy*38)+' '+((y1+y2)/2-ux*38)+' '+x2+' '+y2;
    return '<g><path class="floor-halo" d="'+d+'"/><path d="'+d+'" marker-end="url(#flow-tip)"/></g>';
  }).join('');
  const diagram='<svg class="factory-route" viewBox="'+[bx,by,w,h].join(' ')+'" aria-hidden="true"><defs><marker id="flow-tip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#047e71" stroke="none"/></marker></defs>'+route+'</svg>';

  return '<div class="section-title"><div><h3>一块底板上的相邻工作区</h3><p>点击工区，查看与当前主线相连的场景和案例。</p></div>'+action('返回上下游','view','journey')+'</div>'+
    '<div class="floor-scroll"><div class="floor" style="--ratio:'+w+'/'+h+'"><img alt="拼接在同一等距平面的厂内工作区" src="'+art('factory')+'">'+
    diagram+data.areas.map(a=>{
      const active=selection.type==='area'&&selection.id===a.id;
      const first=flow.steps.findIndex(step=>step[3]===a.id);
      return '<button class="floor-pin'+(areasUsed.has(a.id)?' on':'')+'" type="button" data-area="'+a.id+'" aria-pressed="'+active+'" style="--x:'+((a.x-bx)/w*100)+'%;--y:'+((a.y-by)/h*100)+'%">'+
        (first<0?'':'<span>'+(first+1)+'</span>')+esc(a.label)+'</button>';
    }).join('')+'</div></div>'+
    '<div class="floor-sequence" aria-label="厂内流程">'+flow.steps.map(([label,,transfer,area],i)=>
      '<button type="button" data-step="'+i+'"><b>'+(i+1)+'</b><span>'+esc(label)+'</span><small>'+esc(transfer.split(' → ').at(-1))+'</small></button>').join('')+'</div>';
}
function rolesView(){
  const names=[...new Set(flow.steps.flatMap(step=>step[1].split(' · ')))];
  const grid='--lanes:'+names.length;
  return '<div class="section-title"><div><h3>跨部门泳道</h3><p>从上到下是交接顺序。圆点表示该角色参与此步。</p></div></div>'+
    '<div class="lanes-scroll"><div class="lanes" style="'+grid+'"><div class="lane-head">环节与交接物</div>'+
    names.map(name=>'<div class="lane-head">'+esc(name)+'</div>').join('')+
    flow.steps.map(([label,who,transfer],i)=>'<button class="lane-task" type="button" data-step="'+i+'"><strong>'+(i+1)+'. '+esc(label)+'</strong><small>'+esc(transfer)+'</small></button>'+
      names.map(name=>'<div class="lane-cell">'+(who.split(' · ').includes(name)?'<span aria-label="参与">●</span>':'')+'</div>').join('')).join('')+'</div></div>';
}
function objectsView(){
  return '<div class="section-title"><div><h3>沿业务记录追踪</h3><p>通过对象和关联字段查看可以延伸到哪些工作场景。</p></div></div>'+
    '<div class="object-chain">'+flow.objects.map(([label,key,work],i)=>'<button type="button" data-record="'+i+'"><span class="object-icon">'+(i+1)+'</span><strong>'+esc(label)+'</strong><small>'+esc(key)+'</small><p>'+esc(work)+'</p></button>').join('')+'</div>';
}
function filterCases(){
  const list=data.cases.filter(c=>(!group||c.group===group)&&(!search||
    [c.title,c.roles,c.id,groupById.get(c.group).title,c.description].join(' ').toLowerCase().includes(search.toLowerCase())));
  get('case-results').textContent=list.length+' / '+data.cases.length+' 个案例';
  get('case-list').innerHTML=list.length?list.map(c=>'<button data-case="'+c.id+'" type="button" aria-pressed="'+(selection.id===c.id)+'">'+
    '<strong>'+esc(c.title)+'</strong><span>'+esc(c.roles)+' · '+esc(groupById.get(c.group).title)+'</span></button>').join(''):'<p class="blank">没有匹配的案例。</p>';
}
function catalogView(){
  return '<div class="section-title"><div><h3>案例目录</h3><p>可从任一主题回到完整案例。</p></div></div>'+
    '<div class="filters"><label>搜索<input id="case-query" type="search" placeholder="案例名称、岗位或关键词" value="'+esc(search)+'"></label>'+
    '<label>场景分组<select id="group-filter"><option value="">全部分组</option>'+data.groups.map(g=>'<option value="'+g.id+'"'+(group===g.id?' selected':'')+'>'+esc(g.title)+' · '+g.count+'</option>').join('')+'</select></label></div>'+
    '<p class="result-count" id="case-results"></p><div class="catalog" id="case-list"></div>';
}
function renderView(){
  const markup={journey:externalView,factory:floorView,roles:rolesView,objects:objectsView,cases:catalogView}[view]();
  get('canvas').innerHTML=markup;
  if(view==='cases') filterCases();
  renderTabs();
}
function describe(title,kicker,description,html=''){
  return '<p class="kicker">'+esc(kicker)+'</p><h3>'+esc(title)+'</h3><p class="explain">'+esc(description)+'</p>'+html;
}
function renderDetail(){
  const {type,id}=selection;
  let html;
  if(type==='case'){
    const c=caseById.get(id),g=groupById.get(c.group);
    const related=data.journeys.filter(j=>[...j.steps,...j.objects,...j.external,...j.feedback].some(row=>row.at(-1).some(id=>caseId(id)===c.id)));
    html='<div class="case-nav"><button type="button" class="quiet" data-case-back>返回</button></div>'+
      describe(c.title,g.title,c.description,'<p class="subtle">岗位 · '+esc(c.roles)+'</p>'+
      '<div class="detail-art"><img alt="'+esc(g.title+'场景示意')+'" src="'+art(g.id)+'"><small>用资产组装的分组工作区示意</small></div>'+
      (c.work.length?'<details><summary>原案例的工作步骤</summary><ol>'+c.work.map(s=>'<li><strong>'+esc(s.label)+'</strong>'+
        (s.description?'<p>'+esc(s.description)+'</p>':'')+'</li>').join('')+'</ol></details>':'')+
      '<details><summary>案例编号与原文位置</summary><p>'+esc(c.id+' · '+c.file+'，第 '+c.locator+' 行')+'</p>'+
      (c.outputLine?'<p>原文产出见第 '+c.outputLine+' 行。</p>':'')+'</details>'+
      (related.length?'<h4>出现在哪些主线</h4>'+tags(related.map(j=>action(j.title,'flow',j.id))):''));
  }else if(type==='area'){
    const area=data.areas.find(a=>a.id===id);
    const g=groupById.get(area.scene);
    const touched=flow.steps.filter(row=>row[3]===id);
    const ids=area.cases??data.cases.filter(c=>(area.groups??[area.scene]).includes(c.group)).map(c=>c.id);
    const primary=[...new Set(touched.flatMap(step=>step[4]).map(caseId))];
    const other=ids.map(caseId).filter(id=>!primary.includes(id));
    html=describe(area.label,workplace,area.description??g.description,
      (touched.length?'<h4>这一站在当前主线里做什么</h4><ul>'+touched.map(step=>'<li>'+esc(step[2])+'</li>').join('')+'</ul>':'')+
      (primary.length?'<h4>当前主线案例</h4>'+caseLinks(primary):'')+
      (other.length?'<details><summary>浏览工区其他案例 · '+other.length+'</summary>'+caseLinks(other)+'</details>':''));
  }else if(type==='edge'){
    const [from,to,label,ids]=(id[0]==='e'?flow.external:flow.feedback)[Number(id.slice(1))];
    html=describe(label,'业务交接',personById.get(from).title+' → '+personById.get(to).title,'<h4>案例依据</h4>'+caseLinks(ids));
  }else if(type==='step'){
    const [label,who,transfer,area,ids]=flow.steps[id];
    html=describe(label,who,transfer,action('查看所在工作区','open-area',area)+'<h4>案例依据</h4>'+caseLinks(ids));
  }else if(type==='record'){
    const [label,key,work,ids]=flow.objects[id];
    html=describe(label,key,work,'<h4>相关案例</h4>'+caseLinks(ids));
  }else{
    const p=personById.get(id);
    html=describe(p.title,id==='factory'?'本方工作地点':'协作地点',p.description,
      (id==='factory'?action('走进连续工作区','view','factory'):'')+'<h4>相关案例</h4>'+caseLinks(p.cases));
  }
  get('detail').innerHTML=html;
}
function select(type,id){
  selection={type,id};
  if(type==='case') history.replaceState(null,'','#'+id);
  else if(location.hash) history.replaceState(null,'',location.pathname);
  for(const button of get('canvas').querySelectorAll('[aria-pressed]')){
    button.setAttribute('aria-pressed',String(button.dataset[type]===id));
  }
  renderDetail();
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button) return;
  const d=button.dataset;
  if(d.caseBack!==undefined){
    const origin=caseOrigin;
    caseOrigin=undefined;
    if(!origin){
      view='cases';
      select('participant','factory');
      renderView();
      get('case-query').focus();
      window.scrollTo(0,0);
      return;
    }
    const sameView=view===origin.view && flow===origin.flow && group===origin.group && search===origin.search;
    ({view,flow,group,search}=origin);
    select(origin.selection.type,origin.selection.id);
    if(!sameView) renderView();
    get('detail').querySelectorAll('details').forEach((details,i)=>{details.open=origin.expanded[i];});
    const panel=get(origin.panel);
    const list=get('case-list');
    if(list) list.scrollTop=origin.listScroll;
    panel.querySelector('[data-case="'+origin.caseId+'"]')?.focus({preventScroll:true});
    window.scrollTo(origin.x,origin.y);
  }else if(d.flow){
    flow=data.journeys.find(j=>j.id===d.flow);
    if(view==='cases') view='journey';
    if(selection.type!=='case') select(view==='factory'?'area':'participant',view==='factory'?flow.steps[0][3]:'factory');
    renderView();
  }else if(d.view){
    view=d.view;
    if(view==='factory'&&selection.type!=='case') select('area',flow.steps[0][3]);
    if(view==='journey'&&selection.type!=='case') select('participant','factory');
    renderView();
  }else if(d.openArea){
    view='factory';
    select('area',d.openArea);
    renderView();
  }else{
    const entry=['participant','edge','area','step','record','case'].find(key=>d[key]!==undefined);
    if(entry) {
      if(entry==='case' && (selection.type!=='case' || view!==caseOrigin?.view || flow!==caseOrigin?.flow ||
        group!==caseOrigin?.group || search!==caseOrigin?.search)){
        caseOrigin={view,flow,group,search,selection:selection.type==='case'?{type:'participant',id:'factory'}:selection,
          expanded:[...get('detail').querySelectorAll('details')].map(details=>details.open),
          panel:button.closest('#detail')?'detail':'canvas',caseId:d.case,x:scrollX,y:scrollY,
          listScroll:get('case-list')?.scrollTop??0};
      }
      select(entry,d[entry]);
      if(matchMedia('(max-width:760px)').matches) get('detail').scrollIntoView({block:'start'});
    }
  }
});
document.addEventListener('input',event=>{
  if(event.target.id==='case-query'){search=event.target.value.trim();filterCases();}
  if(event.target.id==='group-filter'){group=event.target.value;filterCases();}
});
renderView();
renderDetail();
