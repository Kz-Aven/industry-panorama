import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadWorkspace } from '../../src/workspace.mjs';
import { compose } from '../../src/composer.mjs';
import { polygon, project } from '../../src/geometry.mjs';
import { renderScene } from '../../src/svg.mjs';
import { renderJourneyPage } from '../../src/journey-page.mjs';
import { areas, participants, journeys } from './journey-data.mjs';

const folder=new URL('./',import.meta.url);
const read=file=>readFileSync(new URL(file,folder),'utf8');
const atlas=JSON.parse(read('atlas.json'));
const workspace=loadWorkspace();
if(!process.argv[2]) throw new Error('请提供场景案例库根目录');
const library=resolve(process.argv[2]);
const key=s=>s.normalize('NFKC').replace(/\s+/g,'').toLowerCase();
const sourceFiles=new Map(readdirSync(library,{withFileTypes:true})
  .filter(dir=>dir.isDirectory()&&dir.name.startsWith('【制造业·'))
  .map(({name})=>{
    const files=readdirSync(join(library,name)).filter(file=>file.endsWith('.md'));
    if(files.length!==1) throw new Error('正文文件无法唯一定位 · '+name);
    const title=name.split('】')[1].split(/\s+——\s+/)[0];
    return [key(title),join(name,files[0])];
  }));
const scenes=new Map(atlas.scenes.map(scene=>[scene.id,scene]));
const cases=atlas.scenes.flatMap(scene=>scene.semantic.cases.map(item=>{
  const file=sourceFiles.get(key(item.title));
  if(!file) throw new Error('找不到案例原文 · '+item.title);
  const text=readFileSync(join(library,file),'utf8');
  const lines=text.split(/\r?\n/);
  const section=lines.findIndex(line=>/^## .*场景闭环/.test(line));
  const next=lines.findIndex((line,i)=>i>section&&/^## /.test(line));
  const work=section<0?[]:lines.slice(section+1,next<0?undefined:next)
    .map(line=>line.match(/^\*\*([^*]+)\*\*(.*)$/) ?? line.match(/^\| STEP \d+ \|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/))
    .filter(Boolean).map(match=>({label:match[1].trim(),description:match[2]?.trim()??''})).slice(0,8);
  const outputs=lines.findIndex(line=>/^## .*会产出什么/.test(line));
  return {...item,group:scene.id,file,locator:section<0?1:section+1,outputLine:outputs<0?null:outputs+1,work};
}));
if(cases.length!==66||new Set(cases.map(item=>item.file)).size!==66||sourceFiles.size!==66) {
  throw new Error('制造业案例正文与图谱案例未形成 66 条一一对应关系');
}
const makeCaseId=n=>'case-'+n;
const caseIds=new Set(cases.map(item=>item.id));
const refs=[...areas.flatMap(area=>area.cases??[]),...participants.flatMap(participant=>participant.cases),
  ...journeys.flatMap(j=>[...j.external,...j.feedback,...j.objects,...j.steps].flatMap(row=>row.at(-1)))];
for(const n of refs) if(!caseIds.has(makeCaseId(n))) throw new Error('未知案例 ID '+n);

const object=(id,asset_id,x,y,rotation=0)=>({id,asset_id,position:[x,y,0],rotation});
const receiving=[
  object('rack-a','manufacturing.equipment.rack',3.15,1.65),object('rack-b','manufacturing.equipment.rack',6.1,1.65),
  object('load','manufacturing.material.raw-material',2.4,4.45),
  object('pallet','universal.material.pallet',6.4,4.05),
  {...object('carton','universal.material.carton',6.4,4.05),support:'pallet'},
  object('forklift','universal.vehicle.forklift',8.85,4.9,90),
  object('checker','universal.person.worker',4.45,4.1,0),
  object('board','universal.accessory.kanban',8.5,1.55),
];
const simple=(id,title,objects,size,platform='industrial')=>({
  id,title,render:{},scene:{template:'single-workstation',
    platform:{asset_id:'universal.platform.'+platform,size,height:.35},objects},
});
const floorObjects=areas.flatMap(area=>{
  const original=scenes.get(area.scene);
  const items=area.id==='receiving'?receiving:original.scene.objects;
  const slots=workspace.templates.get(original.scene.template).slots;
  return items.map(o=>{
    const [x,y,z]=o.position??slots[o.slot??o.id];
    return {...o,id:area.id+'-'+o.id,position:[x+area.offset[0]+.26,y+area.offset[1]+.20,z],
      ...(o.support?{support:area.id+'-'+o.support}:{}),...(o.target?{target:area.id+'-'+o.target}:{})};
  });
});
const floor=simple('connected-factory','厂内连续等距工作区',floorObjects,[37,16]);
const floorPlan=compose(floor,workspace);
const unit=floorPlan.pixels_per_unit;
const projectPoint=([x,y])=>project([x,y,0],unit);
const floorMarkers=areas.map(area=>{
  const [x,y]=projectPoint(area.pin);
  return {...area,x,y,r:[...area.offset,...area.size]};
});
const colorZones=areas.map(area=>{
  const [x,y]=area.offset,[w,d]=area.size;
  const corners=[[x,y],[x+w,y],[x+w,y+d],[x,y+d]].map(projectPoint);
  return `<g opacity=".35">${polygon(corners,area.color,'#f1f4ef',1.6)}</g>`;
}).join('');
const sharedWalkway=polygon([[0,7.2],[37,7.2],[37,8.65],[0,8.65]].map(projectPoint),'#eff2e9','#819899',1.6);
const external=[
  simple('supplier','供应商备货工作区',receiving.filter(o=>o.id!=='rack-b'&&o.id!=='board'),[11.5,7.2],'outdoor'),
  simple('logistics','运输交接工作区',[
    object('truck','universal.vehicle.truck',3.25,3.3),object('rack','manufacturing.equipment.rack',6.1,1.2),
    object('pallet','universal.material.pallet',6.07,3.45),
    {...object('goods','universal.material.carton',6.07,3.45),support:'pallet'},
    object('operator','universal.person.worker',5.6,4.9),object('cart','universal.vehicle.hand-cart',8,3.3,90),
  ],[10,6.5],'outdoor'),
  simple('customer','客户收货与验收工作区',[
    object('desk','universal.furniture.desk',4.08,2.81),
    {...object('terminal','universal.electronics.computer',4.37,2.81),support:'desk'},
    object('person','universal.person.customer',2.48,3.0),
    object('rack','manufacturing.equipment.rack',7,1.4),
    object('goods','manufacturing.material.finished-goods',6.8,3.9),
    object('receiver','universal.person.office-worker',6.65,4.95),
  ],[9.2,6.4],'office'),
];
const media=new Map();
const register=svg=>svg.replace(/xlink:href="(data:image\/[^"]+;base64,[A-Za-z0-9+/=]+)"/g,(_,url)=>{
  if(!media.has(url)) media.set(url,media.size);
  return 'xlink:href="asset-slot:'+media.get(url)+'"';
});
const art=Object.fromEntries([...external,...atlas.scenes].map(scene=>[scene.id,
  register(renderScene(scene,compose(scene,workspace),workspace,false))]));
const floorArt=register(renderScene(floor,floorPlan,workspace,false)
  .replace('<g opacity=".14" filter="url(#contact)">',colorZones+sharedWalkway+'<g opacity=".14" filter="url(#contact)">'));
art.factory=floorArt;
const groups=atlas.scenes.map(scene=>({id:scene.id,title:scene.title,description:scene.description,
  count:scene.semantic.cases.length}));
const assetIds=[...new Set([floor,...external,...atlas.scenes].flatMap(scene=>
  [scene.scene.platform.asset_id,...scene.scene.objects.map(o=>o.asset_id)]))].sort();
const payload={areas:floorMarkers,participants,journeys,groups,cases,art,media:[...media.keys()],assetIds,
  floorBounds:floorPlan.bounds};
const html=renderJourneyPage(payload);
writeFileSync(new URL('../../outputs/manufacturing-business-journey.html',folder),html);
console.log(cases.length+' 案例 · '+assetIds.length+' 复用资产 · '+areas.length+' 连续工区 · '+journeys.length+' 条业务主线');
