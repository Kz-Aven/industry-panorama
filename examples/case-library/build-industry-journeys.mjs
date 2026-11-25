import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compose } from '../../src/composer.mjs';
import { project, polygon } from '../../src/geometry.mjs';
import { loadWorkspace } from '../../src/workspace.mjs';
import { renderScene } from '../../src/svg.mjs';
import { renderJourneyPage } from '../../src/journey-page.mjs';
import { batches, industries } from './industry-journeys.mjs';

const here=new URL('./',import.meta.url);
const read=file=>JSON.parse(readFileSync(new URL(file,here),'utf8'));
const legacy=read('floor-maps.json');
const flows=read('flows.json');
const coverage=read('coverage.json');
const catalog=new Map(coverage.industries.map(d=>[d.id,d]));
catalog.set('information-technology',{id:'information-technology',industry:'信息技术',cases:50,flow:legacy['information-technology'].caseTitle});
if(!process.argv[2]) throw new Error('用法：node examples/case-library/build-industry-journeys.mjs <案例库> [1|2|3]');
const library=resolve(process.argv[2]);
const requested=process.argv[3]?batches[Number(process.argv[3])-1]:batches.flat();
if(!requested) throw new Error('批次编号为 1、2 或 3');
const workspace=loadWorkspace();
const compact=s=>s.normalize('NFKC').replace(/\s+/g,'').toLowerCase();
const colors=['#d7ac62','#89bdc6','#a9a7d6','#aad094'];
for(const id of requested){
  const def=industries[id], scope=catalog.get(id);
  const dir=id==='information-technology'?'../information-technology/':id+'/';
  const atlas=read(dir+'atlas.json'), snapshot=read(dir+'source-data.json');
  const sourceById=new Map((snapshot.cases??snapshot).map(record=>[record.id,record]));
  const scenes=new Map(atlas.scenes.map(scene=>[scene.id,scene]));
  const cases=atlas.scenes.flatMap(scene=>scene.semantic.cases.map(item=>{
    const record=sourceById.get(item.id);
    const file=record.path??record.relative;
    const lines=readFileSync(join(library,file),'utf8').split(/\r?\n/);
    const section=lines.findIndex(line=>/^## .*(场景闭环|工作流程|工作链路)/.test(line));
    const next=lines.findIndex((line,i)=>i>section&&/^## /.test(line));
    const work=section<0?[]:lines.slice(section+1,next<0?undefined:next)
      .map((line,i,sectionLines)=>line.match(/^\*\*([^*]+)\*\*(.*)$/) ?? line.match(/^\| STEP \d+ \|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/) ??
        (line.startsWith('### ')?[line,line.slice(4),sectionLines.slice(i+1).find(value=>value.trim()&&!value.startsWith('#'))]:null))
      .filter(Boolean).map(m=>({label:m[1].trim(),description:m[2]?.trim()??''})).slice(0,8);
    const outputs=lines.findIndex(line=>/^## .*会产出什么/.test(line));
    return {...item,group:scene.id,file,locator:section<0?(record.painLine??record.line):section+1,
      outputLine:outputs<0?null:outputs+1,work};
  }));
  if(cases.length!==scope.cases||sourceById.size!==cases.length||new Set(cases.map(c=>c.file)).size!==cases.length) {
    throw new Error(id+' 的案例目录数量或来源不一致');
  }
  const caseIds=title=>{
    const matched=cases.filter(c=>compact(c.title).startsWith(compact(title)));
    if(matched.length!==1) throw new Error(id+' 的参考案例「'+title+'」匹配 '+matched.length+' 项');
    return [matched[0].id];
  };
  const [title,object,areaSteps,edges]=def.main;
  const original=(legacy[id].steps??flows[id]);
  const steps=original.map(([label,role,,input,output],i)=>[label,role,input+' → '+output,areaSteps[i],caseIds(scope.flow)]);
  const mapEdges=rows=>rows.map(([a,b,label,ref])=>[a,b,label,caseIds(ref)]);
  const journeys=[
    {id:'main',title,object,question:title+'如何交接？',steps,external:mapEdges(edges),feedback:[],
      objects:original.map(([label,,action,input])=>[input,label,action,caseIds(scope.flow)])},
    {id:'related',title:def.extra.title,object:def.extra.object,question:def.extra.title+'涉及哪些角色和记录？',
      steps:def.extra.steps.map(([label,role,handoff,area,ref])=>[label,role,handoff,area,caseIds(ref)]),
      external:mapEdges(def.extra.edges),feedback:[],
      objects:def.extra.steps.map(([label,role,handoff,,ref])=>[label,role,handoff,caseIds(ref)])},
  ];
  const known=new Set(def.sites.map(site=>site[0]));
  for(const journey of journeys){
    const primary=[];
    for(const edge of journey.external){
      const [a,b]=edge;
      (primary.some(([from,to])=>from===b&&to===a)?journey.feedback:primary).push(edge);
    }
    journey.external=primary;
    if(journey.steps.some(step=>!def.areas.includes(step[3]))||[...journey.external,...journey.feedback].some(([a,b])=>!known.has(a)||!known.has(b))) {
      throw new Error(id+' 的流程节点或地点引用无效');
    }
  }
  const participants=def.sites.map(([id,title,group,description])=>({
    id,title,description,cases:group
      ? cases.filter(c=>c.group===group).slice(0,5).map(c=>c.id)
      : [...new Set(journeys.flatMap(j=>j.steps.flatMap(row=>row[4])))],
  }));
  const media=new Map();
  const register=svg=>svg.replace(/xlink:href="(data:image\/[^"]+;base64,[A-Za-z0-9+/=]+)"/g,(_,url)=>{
    if(!media.has(url)) media.set(url,media.size);
    return 'xlink:href="asset-slot:'+media.get(url)+'"';
  });
  const art=Object.fromEntries(atlas.scenes.map(scene=>[
    scene.id,register(renderScene(scene,compose(scene,workspace),workspace,false)),
  ]));
  for(const [site,,group] of def.sites) if(group) art[site]=art[group];
  const modules=def.areas.map(group=>scenes.get(group));
  const width=Math.max(...modules.map(s=>s.scene.platform.size[0]))+.7;
  const depth=Math.max(...modules.map(s=>s.scene.platform.size[1]))+1.1;
  const areas=modules.map((scene,i)=>{
    const offset=[i%2*width,Math.floor(i/2)*depth];
    const [x,y]=project([offset[0]+width*.57,offset[1]+depth*.87,0],workspace.rendering.pixels_per_unit);
    const [label,description]=def.workspaceLabels?.[scene.id]??[scene.title];
    return {id:scene.id,label,description,scene:scene.id,offset,x,y};
  });
  const objects=modules.flatMap((scene,i)=>{
    const slots=workspace.templates.get(scene.scene.template).slots;
    const [dx,dy]=areas[i].offset;
    return scene.scene.objects.map(object=>{
      const [x,y,z]=object.position??slots[object.slot??object.id];
      return {...object,id:scene.id+'-'+object.id,position:[x+dx+.3,y+dy+.35,z],
        ...(object.support?{support:scene.id+'-'+object.support}:{}),...(object.target?{target:scene.id+'-'+object.target}:{})};
    });
  });
  const floor={id:'connected-workspaces',title:scope.industry+'连续工作区',render:{},
    scene:{template:'single-workstation',platform:{asset_id:'universal.platform.industrial',size:[width*2,depth*2],height:.3},objects}};
  const plan=compose(floor,workspace);
  const tint=(points,color)=>polygon(points.map(([x,y])=>project([x,y,0],plan.pixels_per_unit)),color,'#edf3ee',1.6);
  const zones=areas.map(({offset:[x,y]},i)=>tint([[x,y],[x+width,y],[x+width,y+depth],[x,y+depth]],colors[i])).join('');
  const aisle=tint([[0,depth-.47],[width*2,depth-.47],[width*2,depth+.24],[0,depth+.24]],'#eff2e9');
  art.factory=register(renderScene(floor,plan,workspace,false).replace('<g opacity=".14" filter="url(#contact)">',
    '<g opacity=".34">'+zones+'</g>'+aisle+'<g opacity=".14" filter="url(#contact)">'));
  const groups=atlas.scenes.map(s=>({id:s.id,title:s.title,description:s.description,count:s.semantic.cases.length}));
  const assetIds=[...new Set([floor,...atlas.scenes].flatMap(scene=>[
    scene.scene.platform.asset_id,...scene.scene.objects.map(o=>o.asset_id)]))].sort();
  const html=renderJourneyPage({industry:scope.industry,workplace:'连续工作区',areas,participants,journeys,groups,cases,art,
    media:[...media.keys()],assetIds,floorBounds:plan.bounds});
  writeFileSync(new URL('../../outputs/case-library/'+id+'-business-journey.html',here),html);
  console.log(scope.industry+' · '+cases.length+' 案例 · '+assetIds.length+' 复用资产');
}
