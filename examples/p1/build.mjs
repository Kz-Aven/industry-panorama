import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorkspace, readJSON } from '../../src/workspace.mjs';
import { matchAction } from '../../src/action-match.mjs';

const library=process.argv[2];
if(!library) throw new Error('用法：node examples/p1/build.mjs <场景案例库根目录>');
const workspace=loadWorkspace();
const write=(file,data)=>writeFileSync(new URL(file,import.meta.url),JSON.stringify(data,null,2)+'\n');
const schema_version='1.0.0';
function caseSource(id,prefix) {
  const dir=readdirSync(library).find(name=>name.startsWith(prefix));
  const name=readdirSync(join(library,dir)).find(name=>name.endsWith('.md'));
  const path=join(library,dir,name);
  const lines=readFileSync(path,'utf8').split('\n');
  const line=lines.findIndex(l=>l.includes('场景闭环')&&l.startsWith('##'));
  const row=lines.find(l=>/^\|\s*场景痛点\s*\|/.test(l)).split('|')[2].trim();
  const title=lines[0].replace(/^#\s+/,'');
  return {source:{id:'source-'+id,title,locator:`${dir}/${name}:${line+1}`,uri:encodeURI(dir+'/'+name)},
    caseData:{id,title,roles:dir.split('】')[0].split('·').slice(1).join(' · '),description:row,source_refs:['source-'+id]}};
}
const ticket=caseSource('customer-ticket','【信息技术·客服】客户工单回复与进度通知');
const purchase=caseSource('procurement-followup','【制造业·采购】来料跟催');
const clinic={source:{id:'source-clinic-intake',title:'P1 医疗问诊工作行为示意',locator:'P1 自编验收用例',excerpt:'医护人员核对预约与基础信息，问询来访者的主要诉求，记录其提供的既往资料以供交接。'},
  caseData:{id:'clinic-intake',title:'记录来访者主诉与既往资料',roles:'接待人员 · 医护人员',description:'医护人员询问来访者的主要诉求及其携带的相关资料，记录以供交接。此例为自编布局验收场景。',source_refs:['source-clinic-intake']}};
const us=(id,asset,extras={})=>({id,asset_id:'universal.'+asset,slot:id,...extras});
const planFor=(template,role,action,tool,target,actorSlot,focusSlot)=>({
  role,action,tool,target,placement:{actor:workspace.templates.get(template).slots[actorSlot],focus:workspace.templates.get(template).slots[focusSlot]},
});
const inputs={
  warehouse:planFor('warehouse','仓管员','核对发货单','发货单','待发纸箱','checking-operator','workstation'),
  reception:planFor('customer-reception','客服','归集和回复','工单系统','客户工单','staff','terminal'),
  monitoring:planFor('monitoring-center','技术支持','核对','监控屏','告警','operator','display'),
  review:planFor('meeting-review','采购员','确认跟催','跟催清单','供应商到货','lead','workstation'),
  intake:planFor('customer-reception','医护接待','接待核对','登记表','预约来访','staff','visitor'),
};
const matches=Object.fromEntries(Object.entries(inputs).map(([id,input])=>{
  const match=matchAction(workspace,input);
  if(match.status!=='matched') throw new Error(`${id} 匹配失败：${JSON.stringify(match)}`);
  return [id,match];
}));
const actor=(slot,match)=>({id:slot,slot,asset_id:match.assets.role,rotation:match.rotation,semantic_ref:'actor',action:'perform'});
const note=(slot,asset,support,ref='input')=>({id:slot,slot,asset_id:asset,support,semantic_ref:ref,rotation:0});
const body=(pack,id,type,title,template,role,action,input,output,objects,system,platform='office')=>{
  const source_refs=[pack.source.id];
  const entity=(id,label)=>({id,label,source_refs});
  return {schema_version,id,type,industry:pack===ticket?'information-technology':pack===clinic?'medical-health':'manufacturing',
    title,description:`${role}${action}，形成${output}。`,semantic:{
      roles:[entity('actor',role)],actions:[{id:'perform',label:action,actor:'actor',target:'input',output:'result',source_refs}],
      business_objects:[entity('input',input),entity('result',output)],
      systems:system?[entity('system',system)]:[],
      source_refs:[pack.source],cases:[pack.caseData],
    },
    scene:{template,platform:{asset_id:'universal.platform.'+platform,size:workspace.templates.get(template).size,height:.30},objects},
    interaction:{case_ids:[pack.caseData.id]},render:{},
  };
};
const cx=(pack,title,type,id,scenes,edges,steps)=>({
  schema_version,id,type,industry:scenes[0].industry,title,
  description:pack===ticket?'从工单建立到回复通知和归档的工作流。':'根据原案例展示 AI 可辅助的步骤、人工确认与场景交接。',
  scenes,zones:[{id:'workflow',title:pack===ticket?'工单流转':'来料风险处理',scene_ids:scenes.map(s=>s.id)}],
  connections:edges.map(([a,b,label],i)=>({id:'flow-'+(i+1),source:a,target:b,label,kind:'flow',source_refs:[pack.source.id]})),
  annotations:[],source_refs:[pack.source],
  layers:[{id:'steps',title:'步骤与交接',source_refs:[pack.source.id],sections:[{title:'原案例步骤',entries:steps}]}],
});
const reception=(m,visitor='person.customer')=>[
  us('counter','furniture.desk'),actor('staff',m),us('visitor',visitor,{rotation:180}),
  us('wall','building.window-wall'),us('chair','furniture.chair',{rotation:180}),
  {id:'terminal',slot:'terminal',asset_id:m===matches.intake?'universal.electronics.computer':m.assets.tool,support:'counter',rotation:90},
  note('form',m.assets.target,'counter'),
];
const monitoring=(m)=>[
  us('console','furniture.desk'),actor('operator',m),{id:'display',slot:'display',asset_id:m.assets.tool,support:'console',semantic_ref:'system'},
  note('form',m.assets.target,'console'),us('board','accessory.kanban'),us('lamp','accessory.status-light'),
];
const meeting=m=>[
  us('workstation','furniture.meeting-table'),actor('lead',m),us('reviewer','person.manager',{rotation:180}),
  us('board','accessory.kanban'),us('wall','building.window-wall'),
  us('terminal','electronics.computer',{support:'workstation',rotation:90}),
  note('document',m.assets.tool,'workstation','result'),note('packet',m.assets.target,'workstation'),
];
const serviceStart=body(ticket,'ticket-intake','process_journey','受理与建单','customer-reception','客服','收集来访或渠道反馈并建立工单','客户反馈','结构化工单',reception(matches.reception),'工单系统');
const serviceVerify=body(ticket,'ticket-verify','process_journey','事实核对与回复草拟','monitoring-center','技术支持','汇集工单和状态信息，核对已知事实','工单与客户服务口径','回复草稿',monitoring(matches.monitoring),'工单与监控系统','industrial');
const serviceArchive=body(ticket,'ticket-notify','process_journey','进度通知与归档','customer-reception','客服','确认进度、更新通知并保存沟通记录','回复草稿与处理进度','工单沟通档案',reception(matches.reception).filter(o=>o.id!=='chair'),'工单系统');
const service=cx(ticket,'客户服务 · 工单回复与进度通知','process_journey','customer-service-journey',
  [serviceStart,serviceVerify,serviceArchive],[['ticket-intake','ticket-verify','结构化工单'],['ticket-verify','ticket-notify','回复草稿与更新口径']],
  [{label:'工单结构化',description:'记录反馈来源、影响和紧急程度。'},
   {label:'客户档案对齐',description:'对齐服务承诺、配额和历史问题。'},
   {label:'回复草拟',description:'整理时间线、处理进展、待确认事项与后续安排。'},
   {label:'进度通知',description:'按约定时点准备进度更新。'},
   {label:'留痕归档',description:'将已确认的记录关联至事件编号。'}]);

const policy=[{label:'输入资料',description:'以在途采购单、供应商履约台账、工单需求计划和库存快照为依据。'},
  {label:'AI 辅助整理',description:'归纳履约情况，估算到货日和断料缺口，形成分级及跟催草稿。'},
  {label:'人工核对',description:'采购核对高影响事项、缺项和沟通口径，再确认处理安排。'}];
const procurementInput=body(purchase,'procurement-input','ai_opportunity_map','汇集采购与库存资料','meeting-review','采购','整理在途单、履约记录、工单需求与库存','四份业务资料','可核对的输入资料',meeting(matches.review),'采购与库存资料');
const procurementAssist=body(purchase,'procurement-assist','ai_opportunity_map','AI 辅助做风险初筛','monitoring-center','AI 助手','汇总履约信息、估算到货缺口并草拟跟催建议','四份输入资料','风险清单与话术草稿',
  monitoring(matches.monitoring).filter(o=>o.id!=='operator'),'AI 助手与业务数据','industrial');
const procurementReview=body(purchase,'procurement-review','ai_opportunity_map','采购审核跟催安排','meeting-review','采购','核对高影响事项并确认跟催口径','风险清单与话术草稿','经采购确认的跟催安排',meeting(matches.review),'采购业务台账');
const opportunity=cx(purchase,'AI 辅助采购 · 来料跟催机会图','ai_opportunity_map','procurement-ai-opportunity',
  [procurementInput,procurementAssist,procurementReview],
  [['procurement-input','procurement-assist','采购与库存资料'],['procurement-assist','procurement-review','风险清单与草稿']],policy);

const medical=body(clinic,'medical-intake','scenario_diorama','医疗问诊 · 主诉与资料记录','customer-reception','医护接待人员',
  '问询来访者的主要诉求并核对其提供的既往资料','来访主诉与既往资料','问询记录与交接事项',
  reception(matches.intake).map(o=>o.id==='form'?note('form',matches.intake.assets.tool,'counter'):o));
const shipment=readJSON('evals/cases/shipment.json');
shipment.scene.template='warehouse';
for(const o of shipment.scene.objects){delete o.position;o.slot=o.id;}
Object.assign(shipment.scene.objects.find(o=>o.id==='checking-operator'),{asset_id:matches.warehouse.assets.role,rotation:matches.warehouse.rotation});
shipment.scene.objects.find(o=>o.id==='delivery-document').asset_id=matches.warehouse.assets.tool;
shipment.scene.objects.find(o=>o.id==='unchecked-box').asset_id=matches.warehouse.assets.target;
shipment.scene.objects.push(us('rack','furniture.cabinet'),us('pallet','material.pallet'),us('cart','vehicle.hand-cart'));
for(const [name,data] of Object.entries({service,procurement:opportunity,medical,warehouse:shipment,actions:inputs,matches})) write(name+'.json',data);
write('warehouse-action.json',inputs.warehouse);
console.log('已编排两张图谱和两个单场景，并输出语义匹配记录');
