import { writeFileSync } from 'node:fs';
import { readJSON, root } from '../src/workspace.mjs';

const original=readJSON('examples/manufacturing-atlas/source-data.json');
const write=(path,doc)=>writeFileSync(new URL(path,root),JSON.stringify(doc,null,2)+'\n');
const schema_version='1.0.0';
const universal='universal.', factory='manufacturing.';
const person=(id,asset,position,rotation,semantic_ref,action,target)=>({
  id,asset_id:asset, ...(typeof position==='string' ? {slot:position} : {position}),
  rotation,semantic_ref,action,target,
});
const prop=(id,asset,position,rotation=0,extra={})=>({
  id,asset_id:asset, ...(typeof position==='string' ? {slot:position} : {position}),rotation,...extra,
});
const entity=(id,label,ref)=>({id,label,...(ref?{source_refs:[ref]}:{})});
const act=(id,label,actor,target,output,ref)=>({
  id,label,actor,target,output,...(ref?{source_refs:[ref]}:{}),
});
const src=(id,locator,excerpt)=>({id,title:original.source,locator,...(excerpt?{excerpt}:{})});
const role=(...args)=>entity(...args);

function deskScene({ actor='office-worker',partner,work='desk',surface=[5.25,3.2], documents,board=true,isolation=false,wall=true,storage='furniture.cabinet',terminal='computer',extras=[] }) {
  const [x,y]=surface;
  const objects=[
    person('operator',universal+'person.'+actor,'operator',0,'operator','perform','workstation'),
    prop('workstation',universal+'furniture.'+work,'workstation'),
    prop('terminal',universal+'electronics.'+terminal,[x+.52,y-(partner ? .33 : .06),0],terminal==='display' ? 0 : 90,{support:'workstation'}),
    ...(storage?[prop('storage',storage.startsWith(factory)?storage:universal+storage,'storage')]:[]),
    ...(board?[prop('board',universal+'accessory.kanban','board',0)]:[]),
    ...(wall?[prop('wall',universal+'building.window-wall','wall')]:[]),
    ...extras,
    ...documents.map(([id,type,dx,dy])=>prop(id,universal+'document.'+type,[x+dx,y+dy,0],90,{support:'workstation',semantic_ref:id})),
  ];
  if (partner) objects.push(person('partner',universal+'person.'+partner,'partner',180,'partner','review','workstation'));
  if (isolation) objects.push(prop('drawer',universal+'furniture.rolling-drawer','cart',0));
  return objects;
}

function modeledScene({id,title,description,industry='manufacturing',type='scenario_diorama',
  roles,actions,business_objects,systems=[],relations=[],source_refs,cases=[],template,size,floor='industrial',objects}) {
  return {schema_version,id,type,industry,title,description,
    semantic:{roles,actions,business_objects,systems,relations,source_refs,cases},
    scene:{template,platform:{asset_id:universal+'platform.'+floor,size,height:.30},objects},
    interaction:{case_ids:cases.map(c=>c.id)},render:{}};
}

const ids=['sales-order','product-process','planning-supply','production-quality','release-delivery','service-trace','maintenance','quality-compliance','operations-finance'];
const groupData=(id)=>{
  const group=original.groups[ids.indexOf(id)];
  const primary=src('manufacturing-'+id,'#mfg-data / groups / '+group.name,group.examples);
  const cases=group.cases.map(number=>{
    const {title,roles,pain}=original.entries[number];
    return {id:'case-'+number,title,roles,description:pain,source_refs:['source-case-'+number]};
  });
  return {id,title:group.name,group,ref:primary.id,
    source_refs:[primary,...group.cases.map(n=>src('source-case-'+n,'#mfg-data / entries / '+n))],cases};
};
function office(id,description,people,actionLabel,objectsKnowledge,settings={}) {
  const group=groupData(id);
  const [input,output]=objectsKnowledge;
  const {secondary='复核同一业务记录',...layout}=settings;
  const partner=people[1];
  return modeledScene({...group,description,
    roles:[role('operator',people[0],group.ref),...(partner?[role('partner',partner,group.ref)]:[])],
    actions:[act('perform',actionLabel,'operator',input[0],output[0],group.ref),
      ...(partner?[act('review',secondary,'partner',input[0],output[0],group.ref)]:[])],
    business_objects:objectsKnowledge.map(([id,label])=>entity(id,label,group.ref)),
    template:partner?'team-collaboration':'single-workstation',
    size:partner?[10,7]:[9,6],floor:'office',
    objects:deskScene({partner:partner?'office-worker':undefined,
      work:partner?'meeting-table':'desk',surface:partner?[5.25,3.2]:[4.6,2.7],...layout}),
  });
}

const productionData=groupData('production-quality');
const r=productionData.ref;
const production=modeledScene({...productionData,
  description:'加工区核查开工条件并处理工件，检验区查看样品和良率记录。设备与工位是便于理解的示意，具体案例来自原图。',
  roles:[role('operator','生产人员',r),role('inspector','检验人员',r),role('pmc','PMC',r),role('purchasing','采购',r)],
  business_objects:[entity('work-order','工单与开工条件',r),entity('sample','待检样品',r),entity('yield','良率与异常记录',r),entity('part','加工工件',r)],
  actions:[act('operate','核查开工条件并加工工件','operator','work-order','part','source-case-13'),
    act('inspect','核对样品与良率记录','inspector','sample','yield','source-case-14')],
  relations:[{id:'opening-check',source:'pmc',target:'operator',label:'共同参与开工条件核查',source_refs:['source-case-13']},
    {id:'material-check',source:'purchasing',target:'operator',label:'共同参与开工条件核查',source_refs:['source-case-13']}],
  template:'production-line',size:[12.75,6.55],objects:[
    prop('wall',universal+'building.window-wall','wall'),
    prop('fence',factory+'equipment.safety-fence',[1.16,2.88,0],90),
    prop('machine',factory+'equipment.cnc','machine',0,{label:'加工与开工核查',interaction:{case_ids:['case-13','case-5','case-18']}}),
    prop('signal',universal+'accessory.status-light',[5.3,1.7,0]),
    prop('conveyor',factory+'equipment.conveyor','conveyor'),
    prop('line-part-a',factory+'material.sample',[6.05,3.04,0],0,{support:'conveyor',semantic_ref:'part'}),
    prop('line-part-b',factory+'material.sample',[6.65,3.04,0],0,{support:'conveyor',semantic_ref:'part'}),
    prop('line-part-c',factory+'material.sample',[7.25,3.04,0],0,{support:'conveyor',semantic_ref:'part'}),
    prop('inspection',factory+'equipment.inspection-bench','inspection',0,{label:'检测与良率',interaction:{case_ids:['case-14','case-19','case-23','case-35','case-36']}}),
    prop('sample',factory+'material.sample',[9.54,3.85,0],0,{support:'inspection',semantic_ref:'sample'}),
    prop('yield',universal+'document.sheet',[10.31,3.69,0],0,{support:'inspection',semantic_ref:'yield'}),
    prop('board',universal+'accessory.kanban','board'),
    prop('materials',factory+'material.raw-material','materials'),
    prop('finished',factory+'material.finished-goods','finished'),
    person('operator',universal+'person.worker',[4.64,4.36,0],270,'operator','operate','machine'),
    person('inspector',factory+'person.inspector',[9.78,4.68,0],270,'inspector','inspect','inspection'),
  ],
});
write('examples/manufacturing-atlas/production-quality.json',production);
if (process.argv.includes('--production-only')) process.exit(0);

const sales=office('sales-order','商务人员与计划员在桌边核对客户订单、物料、产能和在制工单，形成接单建议。',
  ['销售','PMC'],'整理客户需求并核对接单条件',[['order','客户订单'],['decision','接单建议'],['capacity','产能负荷表']],
  {actor:'business-staff',documents:[['order','order',-.73,.04],['decision','contract',.02,.45],['capacity','sheet',.63,.48]],secondary:'核对物料齐套、瓶颈产能和在制冲突'});
const product=office('product-process','工程人员在工位核对 BOM 版本、变更记录和受影响订单。',
  ['工程人员'],'核对 BOM 和工程变更',[['bom','BOM 清单'],['change','变更记录']],
  {actor:'technician',documents:[['bom','sheet',-.56,.05],['change','order',-.08,.25]],isolation:true,board:false,
    extras:[prop('prototype',factory+'material.sample',[7.3,4.3,0],0,{support:'drawer',semantic_ref:'bom'})]});
const planning=office('planning-supply','PMC 与采购查看排产板和清单，协调缺料、到货与插单影响。',
  ['PMC','采购'],'核对工单齐套与调整优先级',[['work-order','工单'],['schedule','更新后的排程'],['shortage','缺料清单']],
  {documents:[['work-order','order',-.7,.05],['schedule','sheet',.02,.44],['shortage','sheet',.55,.48]],wall:false,
    extras:[prop('cart',universal+'vehicle.hand-cart',[8.6,5.55,0]),prop('risk',universal+'document.order',[8.65,5.55,0],0,{support:'cart',semantic_ref:'shortage'})],
    secondary:'对照断料时间跟催到货'});
const releaseData=groupData('release-delivery');
const release=modeledScene({...releaseData,description:'检验人员核对待交付批次和放行证据，出货工位展示通过评估后的货物准备。',
  roles:[role('operator','放行审核人员',releaseData.ref)],actions:[act('approve','核对批次放行证据','operator','batch','evidence','source-case-31')],
  business_objects:[entity('batch','交付批次',releaseData.ref),entity('evidence','放行证据',releaseData.ref)],
  template:'equipment-operation',size:[11.5,7.5],floor:'outdoor',
  objects:[prop('machine',factory+'equipment.packing-station',[3.55,2.60,0],0),
    prop('delivery',universal+'vehicle.truck',[8.85,4.45,0],90),
    person('operator',factory+'person.inspector',[3.52,3.85,0],270,'operator','approve','machine'),
    prop('batch',factory+'material.finished-goods',[6.33,3.42,0],0,{semantic_ref:'batch'}),
    prop('evidence',universal+'document.sheet',[3.95,2.86,0],0,{support:'machine',semantic_ref:'evidence'}),
    prop('storage',factory+'equipment.rack',[8.42,1.23,0]),prop('board',universal+'accessory.kanban',[4.25,.91,0])],
});
const trace=office('service-trace','售后和质量人员并排核对客诉记录、成品批号和原料批次，定位追溯线索。',
  ['售后','质量'],'按客诉逆查成品与原料批次',[['complaint','客诉记录'],['batch','批次追溯记录']],
  {actor:'business-staff',documents:[['complaint','sheet',-.65,.04],['batch','order',.02,.39]],wall:false,board:false,
    storage:factory+'equipment.rack',extras:[prop('retained-sample',factory+'material.finished-goods',[8.3,4.9,0],0,{semantic_ref:'batch'})],
    secondary:'核对投料记录与供应商批号'});
const maintenanceData=groupData('maintenance');
const maintenance=modeledScene({...maintenanceData,
  description:'维修人员在设备旁检查报警状态并核对报修记录，工具车展示现场检修环境。',
  roles:[role('operator','设备维护人员',maintenanceData.ref)],
  actions:[act('check','检查异常报警并核对报修闭环','operator','alarm','ticket','source-case-33')],
  business_objects:[entity('alarm','报警记录',maintenanceData.ref),entity('ticket','维修工单',maintenanceData.ref)],
  template:'equipment-operation',size:[9,7],
  objects:[prop('wall',universal+'building.window-wall','wall'),prop('machine',factory+'equipment.cnc','machine'),
    prop('workstation',factory+'tool.tool-cart','workstation'),prop('board',universal+'accessory.kanban','board'),
    prop('storage',factory+'equipment.control-panel','storage',0,{semantic_ref:'alarm'}),
    prop('ticket',universal+'document.order',[6.99,4.88,0],0,{support:'workstation',semantic_ref:'ticket'}),
    person('operator',factory+'person.maintenance','operator',270,'operator','check','machine')],
});
const quality=office('quality-compliance','质量人员对照内部质量记录、证书与检测报告，准备审核所需的证据。',
  ['质量人员'],'检查记录栏位与证书有效性',[['records','质量记录'],['report','审核证据']],
  {actor:'technician',documents:[['records','sheet',-.56,.06],['report','contract',-.08,.22]],isolation:true,board:false});
const operations=office('operations-finance','经营与财务人员对照业务单据和利润数据，核实异常或对账差异。',
  ['经营负责人','财务'],'对照单据核实利润风险与差异',[['ledger','对账资料'],['exception','差异记录']],
  {actor:'manager',documents:[['ledger','contract',-.76,.06],['exception','invoice',.03,.44]],terminal:'display',board:false,
    secondary:'核查对账差异和归属'});
const scenes=[sales,product,planning,production,release,trace,maintenance,quality,operations];
const atlasSource=src('manufacturing-overview','#mfg-overview',original.note);
const atlas={schema_version,id:'manufacturing-atlas',type:'industry_atlas',industry:'manufacturing',title:'制造业场景全景图',
  description:original.description,scenes,
  zones:[{id:'delivery-chain',title:original.zones[0],scene_ids:ids.slice(0,6)},
    {id:'cross-functional',title:original.zones[1],scene_ids:ids.slice(6)}],
  connections:ids.slice(0,5).map((id,i)=>({id:'order-'+(i+1),source:id,target:ids[i+1],label:'原图阅读顺序',kind:'reading_order',source_refs:[atlasSource.id]})),
  annotations:[{id:'scope',text:original.note,source_refs:[atlasSource.id]}],
  source_refs:[atlasSource,...original.layers.map(l=>src('manufacturing-'+l.id,'#mfg-'+l.id,l.heading))],
  layers:original.layers,interaction:{default_scene_id:'planning-supply'},
};
write('examples/manufacturing-atlas/atlas.json',atlas);

const pmcA={ ...planning,id:'pmc-scheduling',type:'role_atlas',title:'排产与插单协调',
  semantic:{...planning.semantic,cases:planning.semantic.cases.filter(c=>['case-3','case-6'].includes(c.id))},
  interaction:{case_ids:['case-3','case-6']} };
const pmcB={ ...planning,id:'pmc-material',type:'role_atlas',title:'齐套核查与来料跟催',
  description:'核对可用库存、缺料项和停线风险，将优先待催的物料交给采购跟进。',
  semantic:{...planning.semantic,
    actions:[act('perform','核查物料齐套与断料时间','operator','work-order','shortage','source-case-7'),
      act('review','按断料和交付风险跟催来料','partner','shortage','schedule','source-case-59')],
    cases:planning.semantic.cases.filter(c=>['case-7','case-59','case-1','case-4'].includes(c.id))},
  scene:{...planning.scene,objects:[...planning.scene.objects,
    prop('staged-material',factory+'material.raw-material',[1.65,4.75,0],0,{semantic_ref:'shortage'})]},
  interaction:{case_ids:['case-7','case-59','case-1','case-4']} };
write('examples/pmc-role/atlas.json',{schema_version,id:'pmc-role',type:'role_atlas',industry:'manufacturing',
  title:'PMC 岗位工作图',description:'沿原图急单协作视角，看计划员协调排产、物料齐套与采购跟催。',
  scenes:[pmcA,pmcB],zones:[{id:'pmc-work',title:'计划与物料协同',scene_ids:[pmcA.id,pmcB.id]}],
  connections:[{id:'pmc-handoff',source:pmcA.id,target:pmcB.id,label:'急单协作示例',kind:'reading_order',source_refs:['manufacturing-roles']}],
  annotations:[],source_refs:[src('manufacturing-roles','#mfg-roles','一张急单如何跨岗推进')],
  layers:[original.layers[0]],
});

const illustrative={id:'example-finance',title:'财务审核演示资料',locator:'examples/finance-review/scene.json',
  excerpt:'虚构演示：提交人提供报销单和发票，财务核对金额及附件，记录通过或补件事项。'};
const finance=modeledScene({id:'finance-review',type:'scenario_diorama',industry:'cross-industry',title:'财务报销审核',
  description:'演示场景。申请人提交费用凭证，财务人员将发票与报销单逐项核对并记录审核结果。',
  roles:[role('operator','财务审核人员',illustrative.id),role('partner','报销申请人',illustrative.id)],
  actions:[act('perform','核对金额和必要附件','operator','invoice','result',illustrative.id),
    act('review','说明业务用途并补充凭证','partner','claim','invoice',illustrative.id)],
  business_objects:[entity('invoice','发票',illustrative.id),entity('claim','报销单',illustrative.id),
    entity('result','审核记录',illustrative.id)],source_refs:[illustrative],
  cases:[{id:'finance-sample-case',title:'补核一笔差旅报销',roles:'财务审核人员 · 报销申请人',description:illustrative.excerpt,source_refs:[illustrative.id]}],
  template:'team-collaboration',size:[9.6,5.15],floor:'office',
  objects:deskScene({partner:'business-staff',work:'meeting-table',board:false,
    documents:[['invoice','invoice',-.70,-.05],['claim','order',-.36,.35],['result','sheet',.30,.32]]}),
});
write('examples/finance-review/scene.json',finance);
