import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const library=resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('用法：node examples/information-technology/build.mjs <场景案例库目录>');
const indexFile=join(library,'案例库索引.md');
const index=readFileSync(indexFile,'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
const write=(file,value)=>writeFileSync(new URL(file,import.meta.url),JSON.stringify(value,null,2)+'\n');
const indexed=index.match(/^### 信息技术（(\d+)）\r?\n([\s\S]*?)(?=\r?\n### |(?![\s\S]))/m);
if(!indexed) throw new Error('案例库索引中缺少信息技术分组');
const paths=[...indexed[2].matchAll(/\[打开\]\(\.\/([^\n)]+)\)/g)].map(m=>decodeURIComponent(m[1]));
const data=readdirSync(library,{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name.startsWith('【信息技术·')).map(d=>{
  const [,roleField,title]=d.name.match(/^【信息技术·([^】]+)】(.+)$/);
  const files=readdirSync(join(library,d.name),{withFileTypes:true}).filter(f=>!f.name.startsWith('.')&&f.isFile()&&f.name.toLowerCase().endsWith('.md'));
  if(files.length!==1) throw new Error(`${d.name} 应有一份案例正文，实际 ${files.length}`);
  const relative=d.name+'/'+files[0].name;
  const file=join(library,relative);
  const bytes=readFileSync(file);
  const markdown=bytes.toString('utf8');
  const line=markdown.split(/\r?\n/).findIndex(l=>/^\s*\|\s*场景痛点\s*\|/.test(l));
  const pain=markdown.split(/\r?\n/)[line]?.match(/^\s*\|\s*场景痛点\s*\|\s*(.*?)\s*\|\s*$/)?.[1];
  if(!pain) throw new Error(`缺少场景痛点：${relative}`);
  const id='it-'+sha(relative.normalize('NFC')).slice(0,16);
  return {id,title,roles:roleField.split('·').map(s=>s.trim()),key:title.split(' —— ')[0],pain,relative,
    uri:encodeURI(relative),line:line+1,sha256:sha(bytes)};
}).sort((a,b)=>a.relative.localeCompare(b.relative,'zh-CN'));
const normalize=values=>values.map(s=>s.normalize('NFC')).sort().join('\n');
if(data.length!==Number(indexed[1])||normalize(paths)!==normalize(data.map(a=>a.relative))) {
  throw new Error('索引与应用扫描口径的案例路径集合不一致');
}
const byKey=new Map(data.map(c=>[c.key,c]));
if(byKey.size!==data.length) throw new Error('需要为同名案例配置唯一键');
const schema_version='1.0.0',industry='information-technology';
const definitions=[
 {id:'sales',title:'售前与商机',layout:'meeting',actor:['sales','销售'],partner:['support','技术支持'],pose:'business-staff',
  keys:['客户 POC 测试报告','RFP 应答初稿与错承诺拦截','政企解决方案初稿','竞品对比矩阵与讲标弹药','集采标书合规检查'],
  action:'核对历史应答和承诺依据',input:'招标需求与历史应答',output:'RFP 应答初稿',representative:'RFP 应答初稿与错承诺拦截'},
 {id:'product',title:'需求与产品',layout:'meeting',actor:['product','产品'],pose:'office-worker',
  keys:['基于自有需求库的 PRD 初稿','数值改动影响面清单','版本文案五处一致性核对','需求池多源收口与语义去重'],
  action:'收口多源反馈并识别同一需求',input:'多渠道需求记录',output:'需求池去重结果',representative:'需求池多源收口与语义去重'},
 {id:'development',title:'研发与发布',layout:'desk',actor:['dev','研发'],pose:'technician',
  keys:['API 文档与代码同步巡检','发布说明与迁移指南起草','术语表驱动的本地化复核'],
  action:'核对接口实现与文档差异',input:'API 实现与接口文档',output:'文档差异清单',representative:'API 文档与代码同步巡检'},
 {id:'delivery',title:'实施与验收',layout:'meeting',actor:['operations','运营'],pose:'manager',
  keys:['割接方案初稿与审批链校验','代维服务月报','实施日志归档与延期归因','考核扣分对账','验收报告初稿与功能点核对'],
  action:'逐项核对需求书功能及交付证据',input:'需求书与验收材料',output:'验收核对清单',representative:'验收报告初稿与功能点核对'},
 {id:'incident',title:'值班与故障复盘',layout:'console',actor:['support','技术支持'],pose:'technician',
  keys:['值班交接班日志','故障 RCA 复盘报告初稿','故障处置报告初稿','售后日志与抓包分析','信号投诉根因关联','网优质量周报'],
  action:'对齐告警记录与故障处置流水',input:'工单与告警记录',output:'故障处置报告初稿',representative:'故障处置报告初稿'},
 {id:'datacenter',title:'机房与算力运营',layout:'rack',actor:['ops','生产（机房运维）'],pose:'technician',
  keys:['GPU 利用率日报','GPU 故障换卡台账','PUE 能耗月报','机房巡检记录结构化与巡检日报','电费账单核对与需量异常检测','闲置算力盘点与资金占用报告','机柜上架率报表与扩容测算'],
  action:'按设备编号交叉核对巡检记录与动环告警',input:'巡检记录与动环告警',output:'巡检日报',representative:'机房巡检记录结构化与巡检日报',system:'动环监控'},
 {id:'service',title:'客服与申诉',layout:'desk',actor:['service','客服'],pose:'office-worker',
  keys:['客户 SLA 月报与赔付预警','客户工单回复与进度通知','客诉工单分诊与优先级','工信部申诉答复报告','恶意差评识别与申诉证据包','投诉升级件时间线还原','版本客服预警联动','判责辅助决策'],
  action:'归集工单信息，准备回复与进度通知',input:'客户工单与处理进度',output:'客户回复与进度通知',representative:'客户工单回复与进度通知',system:'工单系统'},
 {id:'operations',title:'经营与用户反馈',layout:'console',actor:['operations','运营'],pose:'manager',
  keys:['网格经营日报','资费政策问答与口径核对','低动销商家诊断与套餐结构建议','商家拜访资料包','活动复盘一页纸','玩家之声聚类简报'],
  action:'核对活动数据和关键指标口径',input:'活动数据与指标',output:'活动复盘简报',representative:'活动复盘一页纸'},
 {id:'compliance',title:'合规与资质审核',layout:'meeting',actor:['operations','运营'],partner:['legal','法务'],pose:'office-worker',
  keys:['版号申报材料一致性自查','防沉迷与概率公示逐条核对','入驻资质核验预审','证照临期三级复审工单','入驻驳回意见书','海外分级问卷预审'],
  action:'预审材料、列出缺项并留存证据',input:'入驻材料与资质证明',output:'资质预审记录',representative:'入驻资质核验预审'},
];
const groups=definitions.flatMap(d=>d.keys);
if(groups.length!==data.length||new Set(groups).size!==data.length||groups.some(key=>!byKey.has(key))) {
  throw new Error('分组必须覆盖索引中的每个案例一次，请核对分组清单');
}
const sourceId=c=>'source-'+c.id;
const source=c=>({id:sourceId(c),title:c.title,locator:c.relative+':'+c.line,uri:c.uri});
const object=(id,asset,position,rotation=0,details={})=>({
  id,asset_id:asset.startsWith('information-technology.')?asset:'universal.'+asset,position,rotation,...details,
});
function scene(def) {
  const cases=def.keys.map(key=>byKey.get(key));
  const representative=byKey.get(def.representative);
  const refs=[sourceId(representative)];
  const [roleId,roleName]=def.actor;
  const p=def.partner;
  const person=(id,sprite,xy,angle)=>object(id,'person.'+sprite,xy,angle,{semantic_ref:id,...(id===roleId?{action:'work',target:'terminal'}:{})});
  const focus={label:def.input,semantic_ref:'input',interaction:{case_ids:[representative.id]}};
  const result={label:def.output,semantic_ref:'result',support:'desk'};
  const meeting=def.layout==='meeting',rack=def.layout==='rack',console=def.layout==='console';
  const center=meeting?[4.75,2.9,0]:rack?[6.05,3.1,0]:[4.55,2.85,0];
  const [x,y]=center;
  const objects=[
    object('desk',meeting?'furniture.meeting-table':'furniture.desk',center),
    object('terminal',console?'electronics.display':'electronics.computer',[x+(console ? .18 : meeting ? .52 : .29),y-(console ? .3 : meeting ? .29 : .07),0],console?0:90,{support:'desk',...focus}),
    object('record',def.id==='compliance'?'document.contract':'document.sheet',[x-(meeting?.78:.53),y+.12,0],90,result),
    person(roleId,def.pose,meeting?[2.72,2.75,0]:[x-1.49,y+.04,0],0),
  ];
  if(p) objects.push(person(p[0],p[0]==='legal'?'manager':'technician',[6.83,3.24,0],180));
  if(meeting) objects.push(object('board','accessory.kanban',[4.55,1.02,0]),object('wall','building.window-wall',[4.35,.38,0]));
  if(console) objects.push(object('board','accessory.kanban',[4.55,1.02,0]),object('drawer','furniture.rolling-drawer',[6.45,3.83,0]));
  if(!meeting&&!console&&!rack) objects.push(object('wall','building.window-wall',[4.35,.38,0]),object('cabinet','furniture.cabinet',[7.25,1.15,0]));
  if(rack) {
    objects.push(object('rack-a','information-technology.equipment.server-rack',[3.15,1.87,0],0,{...focus,label:'服务器机柜'}),
      object('rack-b','information-technology.equipment.server-rack',[4.72,1.87,0]),
      object('board','accessory.kanban',[7.08,1.03,0]),
      object('signal','accessory.status-light',[2.15,2.94,0]),
      object('rack-technician','person.technician',[3.53,3.1,0],270,{semantic_ref:roleId,action:'work',target:'rack-a'}));
  }
  return {
    schema_version,id:def.id,type:'scenario_diorama',industry,title:def.title,
    description:`${roleName}${p?'与'+p[1]:''}${def.action}，形成${def.output}。画面以代表案例为依据，其他同类案例可在右侧查看。`,
    semantic:{
      roles:[{id:roleId,label:roleName,source_refs:refs},...(p?[{id:p[0],label:p[1],source_refs:[sourceId(byKey.get(def.id==='sales'?'客户 POC 测试报告':'入驻资质核验预审'))]}]:[])],
      actions:[{id:'work',label:def.action,actor:roleId,target:'input',output:'result',source_refs:refs}],
      business_objects:[{id:'input',label:def.input,source_refs:refs},{id:'result',label:def.output,source_refs:refs}],
      systems:def.system?[{id:'system',label:def.system,source_refs:refs}]:[],
      source_refs:cases.map(source),
      cases:cases.map(c=>({id:c.id,title:c.title,roles:c.roles.join(' · '),description:c.pain,source_refs:[sourceId(c)]})),
    },
    scene:{template:meeting?'team-collaboration':rack?'equipment-operation':'single-workstation',
      platform:{asset_id:'universal.platform.'+(rack||console?'industrial':'office'),size:meeting?[8.4,4.95]:[8.5,4.7],height:.3},objects},
    interaction:{case_ids:cases.map(c=>c.id)},render:{},
  };
}
const scenes=definitions.map(scene);
const inspection=byKey.get('机房巡检记录结构化与巡检日报');
const atlas={
  schema_version,id:'information-technology-atlas',type:'industry_atlas',industry,title:'信息技术场景全景图',
  description:`场景案例库 · ${data.length} 个信息技术案例 · 按实际工作场景归入 ${scenes.length} 个节点`,
  scenes,zones:[
    {id:'product-delivery',title:'售前、产品与研发',scene_ids:['sales','product','development']},
    {id:'run-service',title:'交付、运行与技术支持',scene_ids:['delivery','datacenter','incident']},
    {id:'operations-compliance',title:'客服、经营与合规',scene_ids:['service','operations','compliance']},
  ],
  connections:[],
  annotations:[{id:'scope',text:'每篇案例计入一个主要场景。案例跨多个细分方向，分区为本图的阅读入口。',source_refs:['it-index']}],
  source_refs:[{id:'it-index',title:'场景案例库索引',locator:'案例库索引.md / 信息技术',uri:encodeURI('案例库索引.md')},source(inspection)],
  layers:[{id:'inspection-process',title:'机房巡检流程',heading:'机房巡检记录如何变成可追溯的日报',source_refs:[sourceId(inspection)],
    sections:[{title:'原案例的五步闭环',entries:[
      {label:'素材校验',description:'核对巡检表、告警导出和报修记录的时间范围，标注缺项。'},
      {label:'巡检记录结构化',description:'整理设备级记录，并归一设备编号。'},
      {label:'交叉核对',description:'按报表设备编号对齐巡检异常与动环告警。'},
      {label:'隐患聚类',description:'归集同一设备多次出现的问题。'},
      {label:'日报成稿',description:'整理巡检摘要、趋势和未闭环事项，保留来源和签核。'},
    ]}]}],
  interaction:{default_scene_id:'datacenter'},
};
write('source-data.json',{library:'场景案例库',index_title:'案例库索引.md / 信息技术',index_sha256:sha(index),cases:data});
write('atlas.json',atlas);
write('datacenter.json',scenes.find(s=>s.id==='datacenter'));
console.log(`${data.length} 篇源记录已核对，生成 ${scenes.length} 个信息技术场景`);
