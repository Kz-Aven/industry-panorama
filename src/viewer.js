(() => {
  const data=JSON.parse(document.getElementById('atlas-data').textContent);
  const viewport=document.getElementById('viewport'), surface=document.getElementById('surface');
  const canvas=document.getElementById('canvas'), detail=document.getElementById('detail');
  const narrow=matchMedia('(max-width: 680px)');
  const query=document.getElementById('query'), zone=document.getElementById('zone');
  const cards=[...canvas.querySelectorAll('[data-scene]')];
  const cardsById=new Map(cards.map(card=>[card.dataset.scene,card]));
  function loadArt(card) {
    const img=card.querySelector('img');
    if(img.hasAttribute('src')) return;
    const svg=data.art[card.dataset.scene].replace(/xlink:href="scene-media:(\d+)"/g,(_,i)=>`xlink:href="${data.media[i]}"`);
    img.src=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  }
  const artObserver=new IntersectionObserver(entries=>{
    for(const entry of entries) if(entry.isIntersecting){
      loadArt(entry.target);
      artObserver.unobserve(entry.target);
    }
  },{root:viewport,rootMargin:'100px'});
  for(const card of cards) artObserver.observe(card);
  const scenes=new Map(data.scenes.map(s=>[s.id,s]));
  const zones=new Map(data.zones.map(z=>[z.id,new Set(z.scene_ids)]));
  let selected=data.default_scene_id ?? data.scenes[0].id;
  let scale=1, dragging=null, moved=false;

  function node(tag,text,className) {
    const element=document.createElement(tag);
    if (text) element.textContent=text;
    if (className) element.className=className;
    return element;
  }

  function matching() {
    const term=query.value.trim().toLowerCase();
    const has=(...strings)=>strings.join(' ').toLowerCase().includes(term);
    return data.scenes.filter(s=>{
      if (zone?.value && !zones.get(zone.value).has(s.id)) return false;
      return has(s.title,s.description,...s.semantic.roles.map(r=>r.label)) ||
        s.semantic.cases?.some(c=>has(c.title,c.roles,c.description));
    });
  }

  function select(id, refresh = false) {
    selected=id;
    for (const card of cards) card.setAttribute('aria-pressed',String(card.dataset.scene===id));
    detail.replaceChildren();
    const scene=scenes.get(id);
    if (!scene) {
      detail.append(node('h2','没有匹配场景'));
      return;
    }
    loadArt(cardsById.get(id));
    const {semantic}=scene;
    detail.append(node('h2',scene.interaction.title ?? scene.title),node('p',scene.interaction.description ?? scene.description,'muted'));
    for (const annotation of data.annotations.filter(a=>a.scene_id===id)) detail.append(node('p',annotation.text,'muted'));
    const cases=semantic.cases ?? [];
    const filter=query.value.trim().toLowerCase();
    const matches=cases.filter(c=>[c.title,c.roles,c.description].join(' ').toLowerCase().includes(filter));
    const sceneMatch=[scene.title,scene.description,...semantic.roles.map(r=>r.label)].join(' ').toLowerCase().includes(filter);
    const activeCaseIds=scene.interaction.case_ids ?? cases.map(c=>c.id);
    const visible=(sceneMatch ? cases : matches).filter(c=>activeCaseIds.includes(c.id));
    if (visible.length) {
      detail.append(node('h3',`业务案例 · ${visible.length}`));
      for (const item of visible) {
        const panel=node('details');
        panel.dataset.caseId=item.id;
        panel.append(node('summary',item.title),node('p',item.roles,'muted'),node('p',item.description),
          node('p',item.id+' · '+item.source_refs.join(' / '),'case-ref'));
        if (filter && !sceneMatch) panel.open=true;
        detail.append(panel);
      }
    }
    detail.append(node('h3','工作行为'));
    const list=node('ul');
    const entities=new Map([...semantic.roles,...semantic.business_objects,...semantic.systems].map(e=>[e.id,e.label]));
    for (const action of semantic.actions) {
      list.append(node('li',`${entities.get(action.actor)} · ${action.label}${action.output ? ' → '+entities.get(action.output) : ''}`));
    }
    detail.append(list);
    const objects=scene.objects.filter(o=>o.interaction?.case_ids?.length);
    if (objects.length) {
      detail.append(node('h3','场景物件对应案例'));
      for (const object of objects) {
        const button=node('button',object.label ?? object.id,'case-shortcut');
        button.type='button';
        button.addEventListener('click',()=>{
          const panels=[...detail.querySelectorAll('[data-case-id]')];
          const matches=panels.filter(p=>object.interaction.case_ids.includes(p.dataset.caseId));
          for (const panel of panels) panel.open=matches.includes(panel);
          matches[0]?.focus();
        });
        detail.append(button);
      }
    }
    const facts=[['角色',semantic.roles],['业务对象',semantic.business_objects],['业务系统',semantic.systems],['业务关系',semantic.relations ?? []]];
    const metadata=node('details');
    metadata.append(node('summary','业务对象与资料来源'));
    for (const [label,entities] of facts) {
      if (entities.length) metadata.append(node('p',label+' · '+entities.map(e=>e.label).join('、')));
    }
    const relevant=new Set([...semantic.roles,...semantic.business_objects,...semantic.systems,...semantic.actions,...cases].flatMap(e=>e.source_refs ?? []));
    for (const s of new Map([...(data.source_refs ?? []).filter(s=>relevant.has(s.id)),...semantic.source_refs].map(s=>[s.id,s])).values()) {
      metadata.append(node('p',s.id+' · '+s.title+' · '+s.locator,'muted'));
      if (s.excerpt) metadata.append(node('p',s.excerpt));
    }
    detail.append(metadata);
    if (!refresh && innerWidth<=850) detail.scrollIntoView({block:'nearest'});
  }

  function filter(event) {
    const available=new Set(matching().map(s=>s.id));
    document.getElementById('results').textContent=`显示 ${available.size} / ${scenes.size} 个场景`;
    for (const card of cards) card.disabled=!available.has(card.dataset.scene);
    const previous=selected;
    select(available.has(selected) ? selected : available.values().next().value,true);
    if (event && selected && selected!==previous) {
      const card=cards.find(c=>c.dataset.scene===selected);
      viewport.scrollTo({left:card.offsetLeft*scale-16,top:card.offsetTop*scale-16});
    }
  }

  function zoom(next,anchorX = viewport.clientWidth/2,anchorY = viewport.clientHeight/2) {
    const oldOffset=Math.max(0,(viewport.clientWidth-surface.offsetWidth)/2);
    const originX=(viewport.scrollLeft+anchorX-oldOffset)/scale;
    const originY=(viewport.scrollTop+anchorY)/scale;
    const {width,height}=narrow.matches?data.compact:data.wide;
    scale=Math.max(.30,Math.min(2.4,next));
    canvas.style.width=width+'px';
    canvas.style.height=height+'px';
    canvas.style.transform=`scale(${scale})`;
    surface.style.width=width*scale+'px';
    surface.style.height=height*scale+'px';
    const newOffset=Math.max(0,(viewport.clientWidth-width*scale)/2);
    viewport.scrollLeft=originX*scale-anchorX+newOffset;
    viewport.scrollTop=originY*scale-anchorY;
    document.getElementById('scale').value=Math.round(100*scale)+'%';
  }
  function fit() {
    const width=viewport.clientWidth;
    if (!width) return;
    const fitScale=width/(narrow.matches?data.compact.width:data.wide.width);
    zoom(Math.min(data.scenes.length===1 ? 1.16 : 1,fitScale));
    viewport.scrollLeft=0;
    viewport.scrollTop=0;
  }

  for (const card of cards) card.addEventListener('click',event=>{
    if (!moved || !event.detail) select(card.dataset.scene);
  });
  query.addEventListener('input',filter);
  zone?.addEventListener('change',filter);
  narrow.addEventListener('change',fit);
  document.getElementById('inc').addEventListener('click',()=>zoom(scale*1.2));
  document.getElementById('dec').addEventListener('click',()=>zoom(scale/1.2));
  document.getElementById('fit').addEventListener('click',fit);
  viewport.addEventListener('wheel',event=>{
    if (!event.ctrlKey&&!event.metaKey) return;
    event.preventDefault();
    const rect=viewport.getBoundingClientRect();
    zoom(scale*Math.exp(-event.deltaY*.003),event.clientX-rect.left,event.clientY-rect.top);
  },{passive:false});
  viewport.addEventListener('pointerdown',event=>{
    if (event.pointerType!=='mouse' || event.button!==0) return;
    moved=false;
    dragging={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
  });
  viewport.addEventListener('pointermove',event=>{
    if (!dragging) return;
    const dx=event.clientX-dragging.x, dy=event.clientY-dragging.y;
    if (!moved && Math.hypot(dx,dy)<5) return;
    moved=true;
    viewport.classList.add('dragging');
    viewport.setPointerCapture(event.pointerId);
    viewport.scrollLeft=dragging.left-dx;
    viewport.scrollTop=dragging.top-dy;
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) {
    window.addEventListener(name,()=>{
      dragging=null;
      viewport.classList.remove('dragging');
    });
  }
  const tabs=[...document.querySelectorAll('[data-view]')];
  for (const button of tabs) button.addEventListener('click',()=>{
    for (const tab of tabs) {
      tab.setAttribute('aria-pressed',String(tab===button));
      document.getElementById(tab.dataset.view).hidden=tab!==button;
    }
  });
  filter();
  fit();
})();
