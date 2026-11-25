import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as yaml } from 'yaml';
import { escape } from '../../src/svg.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const readJSON=file=>JSON.parse(readFileSync(file,'utf8'));
const writeJSON=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2)+'\n');
if(!process.argv[2]) throw new Error('用法：node examples/case-library/build.mjs <场景案例库目录>');
const library=resolve(process.argv[2]);
const indexFile=join(library,'案例库索引.md');
const index=readFileSync(indexFile,'utf8');
const definitions=readJSON(join(here,'industries.json'));
const flows=readJSON(join(here,'flows.json'));
const sourceFiles=readdirSync(library,{withFileTypes:true}).filter(entry=>entry.isDirectory() && entry.name.startsWith('【'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const normalize=paths=>paths.map(path=>path.normalize('NFC')).sort().join('\n');
const records=sourceFiles.map(({name})=>{
  const [,industry,roles,title]=name.match(/^【([^·】]+)·([^】]+)】(.+)$/u);
  const dir=join(library,name);
  const files=readdirSync(dir,{withFileTypes:true}).filter(f=>f.isFile() && f.name.endsWith('.md'));
  if(files.length!==1) throw new Error(name+' 的正文文件数为 '+files.length);
  const file=join(dir,files[0].name);
  const bytes=readFileSync(file);
  const lines=bytes.toString('utf8').split(/\r?\n/);
  const painLine=lines.findIndex(line=>/^\|\s*场景痛点\s*\|/.test(line));
  const pain=lines[painLine]?.match(/^\|\s*场景痛点\s*\|\s*(.*?)\s*\|\s*$/)?.[1];
  if(!pain) throw new Error(name+' 缺少场景痛点');
  const path=relative(library,file);
  const uri=encodeURI(path);
  const id='catalog-'+sha(path.normalize('NFC')).slice(0,16);
  const flowLine=lines.findIndex(line=>line.startsWith('## 四 场景闭环'))+1;
  return {id,industry,title,roles:roles.split('·'),pain,path,uri,painLine:painLine+1,flowLine,sha256:sha(bytes)};
});

const version='1.0.0';
const sourceId=record=>'source-'+record.id;
const source=(record,line=record.painLine)=>({
  id:sourceId(record),title:record.title,locator:record.path+':'+line,uri:record.uri,
});
const caseRecord=record=>({id:record.id,title:record.title,roles:record.roles.join(' · '),
  description:record.pain,source_refs:[sourceId(record)]});
const templates={asset:'equipment-operation',desk:'single-workstation',meeting:'meeting-review',
  monitor:'monitoring-center',warehouse:'warehouse',equipment:'equipment-operation'};

function makeScene(industry,{id,title,role,action,input,output,layout,caseList,representative,flow=false}) {
  const refs=[sourceId(representative)];
  const focus={semantic_ref:'input',interaction:{case_ids:[representative.id]}};
  const object=(id,asset_id,position,rotation=0,extra={})=>({id,asset_id,position,rotation,...extra});
  const asset=layout==='asset', meeting=layout==='meeting', monitor=layout==='monitor';
  const warehouse=layout==='warehouse', equipment=layout==='equipment';
  const industrial=warehouse || equipment || (asset && ['logistics','construction-tourism','energy-utilities'].includes(industry.id));
  const [assetSuffix,assetName,setting]=industry.asset;
  const actorKind=industrial?'universal.person.worker':industry.id==='medical-health' && asset?
    'medical-health.person.clinician':meeting?'universal.person.business-staff':'universal.person.office-worker';
  const [x,y]=meeting?[4.8,2.9]:asset?[5.75,2.9]:[5.0,2.9];
  const objects=[
    object('workstation',meeting?'universal.furniture.meeting-table':'universal.furniture.desk',[x,y,0]),
    object('terminal',monitor?'universal.electronics.display':'universal.electronics.computer',
      [x+(monitor?.13:.28),y-(monitor?.24:.04),0],monitor?0:90,{...focus,label:input,support:'workstation'}),
    object('record','universal.document.sheet',[x-.58,y+(monitor?.19:.13),0],90,{semantic_ref:'result',label:output,support:'workstation'}),
    object('operator',actorKind,[meeting?2.77:x-1.46,y+.08,0],0,{semantic_ref:'role',action:'work',target:'terminal'}),
  ];
  if(meeting) {
    objects.push(object('colleague','universal.person.manager',[6.87,3.33,0],180));
    objects.push(object('board','universal.accessory.kanban',[4.55,1.12,0]));
  } else if(monitor) {
    objects.push(object('board','universal.accessory.kanban',[4.7,1.06,0]));
    objects.push(object('drawer','universal.furniture.rolling-drawer',[7.24,3.67,0],90));
  } else if(warehouse) {
    objects.push(object('rack','manufacturing.equipment.rack',[7.28,1.28,0]));
    objects.push(object('pallet','universal.material.pallet',[2.35,4.58,0]));
    objects.push(object('cargo','universal.material.carton',[2.35,4.58,0],0,{support:'pallet'}));
    objects.push(object('cart','universal.vehicle.hand-cart',[7.33,4.67,0],90));
  } else if(equipment) {
    objects.push(object('panel','manufacturing.equipment.control-panel',[2.15,1.2,0],90));
    objects.push(object('tools','manufacturing.tool.tool-cart',[7.1,4.51,0]));
  } else if(asset) {
    const scanner=industry.id==='universal';
    objects.push(object('industry-asset',industry.id+'.'+assetSuffix,scanner?[x-.57,y-.26,0]:[2.28,1.85,0],0,
      {...(scanner?{support:'workstation'}:{}),label:assetName,interaction:focus.interaction}));
    if(!industrial) objects.push(object('wall','universal.building.window-wall',[4.49,.38,0]));
  } else {
    objects.push(object('wall','universal.building.window-wall',[4.49,.38,0]));
    objects.push(object('cabinet','universal.furniture.cabinet',[7.25,1.15,0]));
  }
  return {schema_version:version,id,industry:industry.id,type:'scenario_diorama',title,
    description:`${role}${action}，形成${output}。${asset?'画面包含'+setting+'的环境示意。':''}`,
    semantic:{roles:[{id:'role',label:role,source_refs:refs}],
      actions:[{id:'work',label:action,actor:'role',target:'input',output:'result',source_refs:refs}],
      business_objects:[{id:'input',label:input,source_refs:refs},{id:'result',label:output,source_refs:refs}],
      systems:[],source_refs:caseList.map(c=>source(c,flow?c.flowLine:c.painLine)),cases:caseList.map(caseRecord)},
    scene:{template:templates[layout],platform:{asset_id:'universal.platform.'+(industrial?'industrial':'office'),
      size:[9,5.75],height:.3},objects},
    interaction:{case_ids:caseList.map(c=>c.id)},render:{},
  };
}
const jobs=[], summary=[];
for(const def of definitions) {
  const result=index.match(new RegExp('^### '+def.name+'（(\\d+)）\\r?\\n([\\s\\S]*?)(?=\\r?\\n### |(?![\\s\\S]))','m'));
  if(!result) throw new Error('索引缺少 '+def.name);
  const indexed=[...result[2].matchAll(/\[打开\]\(\.\/([^\n)]+)\)/g)].map(match=>decodeURIComponent(match[1]));
  const cases=records.filter(record=>record.industry===def.name).sort((a,b)=>a.path.localeCompare(b.path,'zh-CN'));
  if(cases.length!==Number(result[1]) || normalize(indexed)!==normalize(cases.map(record=>record.path))) {
    throw new Error(def.name+' 的索引与目录清单不一致');
  }
  const findCase=prefix=>{
    const matches=cases.filter(c=>c.title.startsWith(prefix));
    if(matches.length!==1) throw new Error(def.name+' / '+prefix+' 对应 '+matches.length+' 篇');
    return matches[0];
  };
  const definitions=def.scenes.map(([id,title,pattern,key,action,input,output,layout])=>({
    id,title,match:pattern==='*'?/(?:)/:new RegExp(pattern,'iu'),representative:findCase(key),action,input,output,layout,caseList:[],
  }));
  for(const record of cases) {
    const assigned=definitions.find(r=>r.representative===record) ??
      definitions.find(r=>r.match.test(record.title.split(' —— ')[0]+' '+record.roles.join(' ')));
    assigned.caseList.push(record);
  }
  const scenes=definitions.map(d=>makeScene(def,{...d,role:d.representative.roles.join('、')}));
  const reference=findCase(def.flow);
  if(!reference.flowLine) throw new Error(reference.title+' 缺少流程段落');
  const stages=flows[def.id].map(([title,role,action,input,output,layout],i)=>({
    id:'step-'+(i+1),title,role,action,input,output,layout,caseList:[reference],representative:reference,flow:true,
  }));
  const flowSource=source(reference,reference.flowLine);
  const indexSource={id:'catalog-index',title:'场景案例库索引',locator:'案例库索引.md / '+def.name,uri:encodeURI('案例库索引.md')};
  const flowLayer={
    id:'example-process',title:'典型业务流程',heading:def.flow,source_refs:[flowSource.id],
    note:'流程依据为该案例「场景闭环」一节，展示该案例的工作路径。',
    sections:[{title:'输入、动作与交接',entries:stages.map(s=>({label:s.title,participant:s.role,
      description:`接收${s.input}，${s.action}。交付${s.output}。`}))}],
  };
  const scope={id:'catalog-scope',text:'按原案例库口径分区，每条案例归入一个主要场景。画面呈现各组代表性工作。',source_refs:[indexSource.id]};
  const base={schema_version:version,industry:def.id};
  const atlas={...base,id:def.id+'-atlas',type:def.id==='universal'?'role_atlas':'industry_atlas',title:def.name+'场景全景图',
    description:`案例库 · ${cases.length} 个案例，按工作场景归入 ${scenes.length} 个节点`,scenes,
    zones:def.zones.map(([title,...scene_ids],i)=>({id:'zone-'+(i+1),title,scene_ids})),
    connections:[], annotations:[scope],source_refs:[indexSource,flowSource],layers:[flowLayer],
    interaction:{default_scene_id:definitions.find(d=>d.layout==='asset').id}};
  const journey={...base,id:def.id+'-journey',type:'process_journey',title:def.name+' · '+def.flow,
    description:'典型业务流程 · 来自同一篇案例的工作步骤',
    scenes:stages.map(stage=>makeScene(def,stage)),zones:[{id:'process',title:'工作步骤',scene_ids:stages.map(s=>s.id)}],
    connections:stages.slice(1).map((stage,i)=>({id:'handoff-'+(i+1),source:stages[i].id,target:stage.id,
      kind:'flow',label:stages[i].output,source_refs:[flowSource.id]})),
    annotations:[{id:'example',text:'箭头展示该案例内的记录流和环节交接。',source_refs:[flowSource.id]}],
    source_refs:[flowSource],layers:[flowLayer]};
  const folder=join(here,def.id);
  mkdirSync(folder,{recursive:true});
  writeJSON(join(folder,'atlas.json'),atlas);
  writeJSON(join(folder,'journey.json'),journey);
  writeJSON(join(folder,'source-data.json'),cases);
  const [suffix,assetName,setting]=def.asset;
  const assetId=def.id+'.'+suffix;
  const pack={id:def.id,name:def.name,version,vocabulary:{},
    entities:[...new Set(definitions.flatMap(d=>[d.input,d.output]))],
    roles:[...new Set(cases.flatMap(c=>c.roles))],actions:definitions.map(d=>d.action),
    asset_mappings:{[assetName]:[assetId],[setting]:[assetId],
      ...Object.fromEntries(definitions.filter(d=>d.layout==='asset').map(d=>[d.action,[assetId]]))},
    templates:[...new Set([...definitions,...stages].map(d=>templates[d.layout]))],
    visual_constraints:['使用相同的写实等距相机、光照及人物尺度。','按案例原始行业归类。流程以单一案例的场景闭环为依据。']};
  const packFolder=join(here,'../../industry-packs',def.id);
  mkdirSync(packFolder,{recursive:true});
  writeFileSync(join(packFolder,'manifest.yaml'),yaml(pack));

  jobs.push({input:def.id+'/atlas.json'},{input:def.id+'/journey.json'});
  summary.push({id:def.id,industry:def.name,cases:cases.length,scenes:scenes.length,flow:def.flow,handoffs:journey.connections.length});
}

writeJSON(join(here,'batch.json'),{jobs});
writeJSON(join(here,'coverage.json'),{catalog_total:records.length,index_sha256:sha(index),industries:summary});

const completed=[{id:'manufacturing',industry:'制造业',cases:66,scenes:9,covered:true},
  {id:'information-technology',industry:'信息技术',cases:50,scenes:9,covered:true},...summary];
const indexOutput=join(here,'../../outputs/case-library');
const cards=completed.map(item=>{
  const journeyLink=(item.id==='manufacturing'?'../':'')+item.id+'-business-journey.html';
  const floorLink=(item.id==='manufacturing'?'../':'')+item.id+'-floor-map.html';
  const floor=existsSync(join(indexOutput,floorLink))
    ? `<a class="floor-link" href="${floorLink}">打开连续场景图</a>` : '';
  return `<article><h2>${escape(item.industry)}</h2><p>${item.scenes} 个场景 · ${item.cases} 个案例</p>
${existsSync(join(indexOutput,journeyLink))?`<a class="journey-link" href="${journeyLink}">打开业务全景</a>`:''}
${floor}<a class="catalog-link" href="${item.covered?'../':''}${item.id}-atlas.html">浏览案例全图</a>
${item.flow?`<a class="catalog-link" href="${item.id}-journey.html">流程 · ${escape(item.flow)}</a>`:''}</article>`;
}).join('\n');
mkdirSync(indexOutput,{recursive:true});
writeFileSync(join(indexOutput,'index.html'),`<!doctype html><html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>行业场景全景</title><style>
:root{font-family:"PingFang SC","Microsoft YaHei",sans-serif;color:#17323a;background:#eff4f3;color-scheme:light}
body{max-width:1080px;margin:auto;padding:clamp(18px,4vw,56px)}
header{margin-bottom:26px}h1{font-size:clamp(30px,5vw,50px);margin:0 0 10px}
p{color:#4c666c;margin:0 0 18px} main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:14px}
article{background:#fff;border:1px solid #d0dfdc;border-radius:12px;padding:20px}h2{margin:0 0 8px;font-size:20px}
a{display:block;color:#165d61;font-weight:600;line-height:1.55;width:fit-content;margin-top:6px;text-underline-offset:3px}
.floor-link,.journey-link{background:#1e6156;color:white;border-radius:7px;padding:6px 10px;text-decoration:none;margin-bottom:12px}.floor-link:hover,.journey-link:hover{background:#174c46}
</style></head><body><header><h1>行业场景全景</h1><p>${completed.length} 个分类 · ${records.length} 个案例</p>
<a href="../asset-library.html">查看素材库</a></header><main>${cards}</main></body></html>\n`);
console.table(summary);
