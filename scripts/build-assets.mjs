import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { brick, extent } from '../src/geometry.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const { id: style, palette } = parse(read('config/visual-style.yaml'));
const { pixels_per_unit: unit } = parse(read('config/rendering.yaml'));
const { navy, steel, teal, ice, white, wood, safety } = palette;
const dark = '#344957', glass = '#567e8b', skin = '#c89572', hair = '#3b4144';
const box = (x, y, z, w, d, h, color) => ({ x, y, z, w, d, h, color });

function person(coat, cap, pose = 'reach', tone = skin) {
  const reach = pose === 'reach';
  const point = pose === 'point';
  return [
    box(-.18,-.21,0,.38,.16,.12,navy), box(-.22,-.18,.12,.22,.14,.68,dark),
    box(-.24,.05,0,.39,.16,.12,navy), box(-.25,.06,.12,.23,.14,.69,dark),
    box(-.28,-.24,.75,.43,.48,.55,coat), box(-.23,-.22,.78,.37,.43,.07,dark),
    box(-.27,-.30,.91,.22,.10,.34,coat),
    box(-.08,-.31, reach ? 1.03 : .86, reach ? .29 : .11,.11,.12,coat),
    box(reach ? .21 : -.08,-.30, reach ? 1.03 : .78,.11,.10,.11,tone),
    box(-.25,.23,.94,.22,.10,.33,coat),
    box(-.05,.23,point ? 1.25 : reach ? 1.06 : .91,point ? .45 : reach ? .27 : .09,.10,.12,coat),
    box(point ? .40 : reach ? .22 : -.05,.23,point ? 1.26 : reach ? 1.06 : .83,.10,.10,.10,tone),
    box(-.19,-.09,1.26,.19,.19,.12,tone),
    box(-.24,-.16,1.37,.32,.32,.31,tone),
    box(-.25,-.17,1.59,.33,.34,.12,cap ?? hair),
    ...(cap ? [box(-.26,-.20,1.63,.44,.39,.05,cap)] : []),
  ];
}

function table(w, d, h, color, frame = dark) {
  return [
    ...[-1,1].flatMap(x => [-1,1].map(y => box(x*(w/2-.13)-.055,y*(d/2-.13)-.055,0,.11,.11,h-.05,frame))),
    box(-w/2,-d/2,h-.10,w,d,.10,color),
  ];
}

function cabinet(w,d,h,color,rows) {
  return [
    box(-w/2,-d/2,.05,w,d,h-.05,color),
    ...Array.from({length:rows}, (_, i) => {
      const z = .13+i*(h-.2)/rows;
      return [box(-w/2+.06,d/2,z,w-.12,.035,(h-.22)/rows-.04,ice),
        box(-.13,d/2+.035,z+.1,.26,.025,.035,navy)];
    }).flat(),
  ];
}

function monitor(w = .68, h = .45, color = glass) {
  return [
    box(-.23,-.16,0,.46,.32,.05,dark),box(-.055,-.06,.05,.11,.11,.18,dark),
    box(-w/2,-.085,.20,w,.13,h,navy),box(-w/2+.04,.044,.24,w-.08,.014,h-.08,color),
    box(-w/2+.09,.058,.29,w*.54,.007,.042,'#91c9ca'),
    box(-w/2+.09,.058,.39,w*.30,.008,.034,'#81adba'),
  ];
}

function paper(color = white, w = .38, d = .28, h = .035) {
  return [
    box(-w/2,-d/2,0,w,d,h,color),
    box(-w*.36,-d*.28,h,w*.57,.018,.006,steel),
    box(-w*.36,-d*.05,h,w*.43,.015,.006,ice),
    box(-w*.36,d*.16,h,w*.49,.015,.006,ice),
  ];
}

function board(w,h,color) {
  const d=.20;
  return [
    box(-w/2+.17,-d,0,.14,.39,h-.12,dark), box(w/2-.31,-d,0,.14,.39,h-.12,dark),
    box(-w/2,-.11,.83,w,.17,h-.83,navy),
    box(-w/2+.055,.06,.89,w-.11,.020,h-.95,color),
    ...[0,1,2].flatMap(i => [
      box(-w/2+.16+i*w*.28,.083,1.16,w*.19,.009,.16,[teal,steel,safety][i]),
      box(-w/2+.16+i*w*.28,.083,1.42,w*.18,.009,.085,ice)
    ]),
  ];
}

const specs = [];
function asset(id, name, footprint, height, aliases, parts, options = {}) {
  specs.push({ id, name, footprint, height, aliases, parts, ...options });
}

asset('universal.person.office-worker','办公人员',[1.05,.72],1.71,['专员','操作电脑'],person(steel,null));
asset('universal.person.business-staff','商务人员',[1.05,.72],1.71,['销售','商务','采购员'],person('#507282',null,'point','#a97558'));
asset('universal.person.technician','技术人员',[1.05,.72],1.71,['工程师','技术员'],person('#e1e6de',null,'reach','#ba8864'));
asset('universal.person.worker','工业操作员',[1.05,.72],1.71,['工人','生产','机台操作员','仓管员','仓管'],person(steel,safety));
asset('universal.person.manager','管理人员',[1.05,.72],1.71,['经理','管理者'],person('#394f64',null,'point'));
asset('universal.person.customer','客户',[1.05,.72],1.71,['访客','客户代表'],person('#a78467',null,'stand','#a37359'));
asset('universal.furniture.desk','办公桌',[1.8,1.04],1.06,['桌子','办公工位'],table(1.8,1.04,1.06,wood),{surface_height:1.06});
asset('universal.furniture.meeting-table','会议桌',[2.85,1.58],1.06,['评审桌','协作桌'],table(2.85,1.58,1.06,wood),{surface_height:1.06});
asset('universal.furniture.chair','工位椅',[.68,.78],1.17,['办公椅','椅子'],[
  ...table(.58,.55,.55,teal),box(-.33,-.28,.55,.10,.56,.62,steel),
]);
asset('universal.furniture.cabinet','档案柜',[1.43,.63],1.78,['文件柜','抽屉柜'],cabinet(1.43,.54,1.78,white,4),{surface_height:1.78});
asset('universal.electronics.computer','台式电脑',[.9,.72],.65,['电脑','终端','桌面电脑'],[
  ...monitor(),box(-.37,.16,.005,.66,.18,.025,ice),box(.29,.17,.005,.12,.18,.05,white),
]);
asset('universal.electronics.phone','智能手机',[.20,.35],.04,['手机'],[
  box(-.09,-.16,0,.18,.32,.033,navy),box(-.073,-.137,.033,.146,.25,.007,glass),
]);
asset('universal.electronics.tablet','平板终端',[.43,.57],.05,['平板','PAD'],[
  box(-.21,-.28,0,.42,.56,.04,navy),box(-.19,-.25,.04,.38,.49,.01,teal),
]);
asset('universal.electronics.display','显示屏',[1.37,.43],.94,['屏幕','大屏'],monitor(1.34,.74));
asset('universal.document.sheet','记录单',[.38,.28],.041,['文件','记录','清单'],paper());
asset('universal.document.order','订单单据',[.46,.38],.076,['采购订单','订单','工单','发货单','送货单'],paper('#e2eee8',.46,.38,.07));
asset('universal.document.contract','合同文件夹',[.57,.46],.095,['合同','条款'],paper('#c2b190',.57,.46,.089));
asset('universal.document.invoice','发票凭证',[.39,.25],.056,['发票','票据','费用凭证'],paper('#e6cfdb',.39,.25,.05));
asset('universal.material.carton','纸箱',[.76,.64],.58,['包装箱','装箱'],[
  box(-.38,-.32,0,.76,.64,.58,wood),box(-.061,-.32,.58,.122,.64,.013,'#e0c89c'),
]);
asset('universal.material.pallet','木托盘',[1.22,.95],.21,['托盘','栈板'],[
  ...[-.34,.26].map(y=>box(-.61,y,0,1.22,.12,.12,wood)),
  ...[-.59,-.29,.01,.31].map(x=>box(x,-.475,.12,.24,.95,.09,wood)),
],{surface_height:.21});
asset('universal.vehicle.truck','厢式货车',[3,1.37],1.68,['货车','交付运输'],[
  ...[-.83,.86].flatMap(x=>[-.65,.43].map(y=>box(x,y,0,.34,.22,.45,dark))),
  box(-1.50,-.58,.36,2.98,1.16,.22,navy),
  box(-1.43,-.57,.56,1.99,1.14,1.12,white),
  box(.61,-.57,.58,.83,1.14,.84,steel),
  box(1.426,-.45,.99,.025,.90,.26,glass),
  box(.75,.56,.99,.46,.018,.26,glass),
  box(1.450,-.51,.64,.02,1.02,.10,ice),
]);
asset('universal.vehicle.forklift','叉车',[2.05,1.11],1.8,['叉车','搬运'],[
  ...[-.63,.28].flatMap(x=>[-.54,.35].map(y=>box(x,y,0,.35,.19,.39,dark))),
  box(-1,-.44,.35,1.22,.88,.42,safety),box(-.64,-.3,.77,.27,.46,.21,navy),
  ...[-.39,.26].map(y=>box(-.66,y,.76,.11,.12,1.0,dark)),
  box(-.74,-.42,1.72,.84,.84,.08,safety),box(.23,-.37,.15,.11,.74,1.52,navy),
  ...[-.32,.16].map(y=>box(.31,y,.13,.7,.12,.095,steel)),
]);
asset('universal.vehicle.hand-cart','手推车',[1.16,.82],1.02,['推车','工位周转车'],[
  ...[-.47,.36].flatMap(x=>[-.33,.26].map(y=>box(x,y,0,.11,.10,.18,dark))),
  box(-.58,-.38,.18,1.13,.76,.09,teal),
  ...[-.34,.27].map(y=>box(-.54,y,.27,.08,.08,.75,steel)),box(-.54,-.34,.94,.08,.69,.08,dark),
],{surface_height:.27});
for (const [id,name,colors] of [
  ['industrial','工业地面',['#92a4b4','#6f8497','#546b7d']],
  ['office','办公地面',['#ddc6a4','#768a9c','#586d80']],
  ['outdoor','室外底板',['#a0ada1','#788b80','#5a7065']],
]) {
  asset('universal.platform.'+id,name,[1,1],.27,['底板','平台'],[box(-.5,-.5,0,1,1,.27,colors[0])],{colors});
}
asset('universal.accessory.kanban','工作看板',[2.30,.43],1.88,['看板','排产看板','进度板'],board(2.28,1.88,white));
asset('universal.accessory.status-light','三色信号灯',[.25,.25],.71,['状态灯','安灯'],[
  box(-.115,-.115,0,.23,.23,.07,dark),box(-.04,-.04,.07,.08,.08,.33,steel),
  ...[teal,safety,'#b86b5e'].map((c,i)=>box(-.075,-.075,.40+.10*i,.15,.15,.10,c)),box(-.075,-.075,.70,.15,.15,.01,dark),
]);
asset('universal.building.window-wall','玻璃隔断',[5.78,.35],2.22,['窗墙','背景墙','办公室隔断'],[
  box(-2.87,-.12,0,5.74,.24,.88,white),
  box(-2.87,-.105,.87,5.74,.15,1.26,'#afc7c9'),
  ...[-2.85,-1.43,0,1.43,2.76].map(x=>box(x,.05,.83,.10,.11,1.33,steel)),
  box(-2.89,-.13,2.14,5.78,.28,.08,white),
  box(-2.89,.05,.83,5.78,.10,.075,steel),
]);
asset('universal.furniture.rolling-drawer','移动抽屉柜',[.80,.65],.84,['卷柜','边柜'],cabinet(.79,.56,.84,steel,3),{surface_height:.84});

asset('manufacturing.equipment.cnc','数控机床',[2.68,1.95],2.66,['CNC','数控','加工中心'],[
  box(-1.28,-.96,0,2.55,1.88,.24,navy),
  box(-1.28,-.94,.24,2.55,1.77,2.21,white),
  box(-1.25,-.91,2.45,2.47,1.65,.12,ice),
  box(-1.03,.83,.68,1.57,.07,1.39,navy),
  box(-.96,.90,.75,1.43,.027,1.24,teal),
  box(-.81,.927,.89,1.11,.018,.91,glass),
  box(-.68,.948,.98,.81,.012,.085,'#83acba'),
  box(-.11,.948,1.13,.25,.013,.60,'#728f9c'),
  box(.27,.945,.75,.12,.065,1.18,ice),
  box(.66,.83,1.26,.52,.13,.61,dark),
  box(.72,.960,1.60,.39,.012,.19,'#84bbbd'),
  ...[0,1,2].map(i=>box(.74+.122*i,.960,1.43,.075,.013,.075,[ice,teal,safety][i])),
  box(1.15,-.67,.54,.13,1.12,.36,steel),
  ...Array.from({length:4},(_,i)=>box(1.281,-.60+i*.245,.64,.009,.12,.115,navy)),
  box(-.94,-.68,2.56,.17,.17,.1,safety),
]);
asset('manufacturing.equipment.conveyor','滚筒输送线',[3.30,1.01],.95,['传送带','生产线','输送线'],[
  ...[-1.36,1.16].flatMap(x=>[-.39,.29].map(y=>box(x,y,0,.13,.10,.72,dark))),
  box(-1.65,-.49,.70,3.30,.98,.15,steel),
  ...Array.from({length:16},(_,i)=>box(-1.58+i*.20,-.40,.85,.125,.8,.058,ice)),
  box(-1.65,-.505,.84,3.3,.10,.11,navy),box(-1.65,.405,.84,3.3,.10,.11,navy),
],{surface_height:.908});
asset('manufacturing.equipment.robot-arm','工业机械臂',[1.73,1.49],2.46,['机械手','机器人工作站'],[
  box(-.79,-.72,0,1.46,1.44,.17,navy),box(-.53,-.40,.17,.70,.78,.48,steel),
  box(-.39,-.28,.65,.45,.48,1.20,safety),box(-.39,-.28,1.78,1.17,.48,.37,safety),
  box(.47,-.24,1.45,.29,.38,.35,steel),box(.49,-.20,1.26,.12,.10,.19,navy),
  box(.64,.01,1.26,.12,.10,.19,navy),box(-.48,-.37,1.78,.62,.64,.18,steel),
]);
asset('manufacturing.equipment.inspection-bench','检测工作台',[2.46,1.46],1.94,['质检','检验台','检测台','量测'],[
  ...table(2.46,1.46,1.13,ice,navy),
  box(-1.12,-.65,1.13,2.24,.18,.81,steel),box(-1.02,-.47,1.36,1.17,.028,.46,dark),
  box(-.98,-.442,1.40,1.09,.013,.38,glass),
  ...[0,1,2,3,4,5].map((_,i)=>box(-.9+i*.16,-.428,1.46,.09,.01,.08+i*.025, i % 2 ? teal : '#a8cccc')),
  box(.54,-.40,1.13,.48,.48,.08,navy),box(.65,-.35,1.21,.22,.12,.43,dark),
  box(.65,-.26,1.55,.22,.30,.12,white),box(.73,-.05,1.34,.065,.07,.21,steel),
],{surface_height:1.13});
asset('manufacturing.equipment.rack','仓储货架',[2.28,.95],2.34,['货架','仓库货架'],[
  ...[-1.06,.96].flatMap(x=>[-.46,.36].map(y=>box(x,y,0,.10,.10,2.34,steel))),
  ...[.18,.90,1.64].map(z=>box(-1.14,-.475,z,2.28,.95,.10,ice)),
  ...[.28,1,1.74].flatMap(z=>[-.96,-.31,.34].map((x,i)=>box(x,-.26,z,.52,.57,.43,i%2?wood:teal))),
]);
asset('manufacturing.material.raw-material','原料周转托盘',[1.46,1.12],.73,['原料','原材料','来料'],[
  box(-.73,-.56,0,1.46,1.12,.18,wood),
  ...[-.60,-.02].flatMap(x=>[-.45,.04].map(y=>box(x,y,.18,.48,.40,.55,steel))),
  ...[-.57,.01].flatMap(x=>[-.40,.08].map(y=>box(x,y,.73,.38,.28,.012,ice))),
]);
asset('manufacturing.material.finished-goods','成品周转箱',[1.25,.91],.66,['成品','产品批次','周转箱'],[
  box(-.625,-.45,0,1.25,.90,.14,wood),box(-.57,-.40,.14,1.14,.80,.48,teal),
  box(-.50,-.34,.62,1,.68,.03,navy),...[-.42,-.11,.20].map(x=>box(x,-.23,.65,.21,.45,.11,ice)),
]);
asset('manufacturing.equipment.test-rig','试验测试柜',[1.53,1.14],2.19,['分容柜','测试柜','测试设备'],[
  ...cabinet(1.5,1.02,2.19,steel,4),box(-.54,.55,1.79,1.08,.029,.26,navy),
  ...[-.37,-.18,.01,.20,.39].map(x=>box(x,.580,1.91,.08,.009,.06,teal)),
]);
asset('manufacturing.tool.tool-cart','维修工具车',[1.20,.73],.98,['维修工具','工装车'],[
  ...[-.48,.40].flatMap(x=>[-.30,.21].map(y=>box(x,y,0,.11,.105,.14,navy))),
  box(-.57,-.33,.14,1.14,.66,.80,steel),...Array.from({length:4},(_,i)=>box(-.51,.33,.25+i*.16,1.02,.037,.045,ice)),
  box(-.42,-.19,.94,.73,.09,.04,safety),
],{surface_height:.94});
asset('manufacturing.equipment.packing-station','打包工位',[1.95,1.12],1.95,['包装设备','包装机','打包'],[
  ...table(1.95,1.12,1.03,steel),...[-.84,.71].map(x=>box(x,-.35,1.03,.13,.16,.91,safety)),
  box(-.84,-.35,1.79,1.68,.16,.16,safety),box(-.55,-.26,1.03,.85,.55,.39,wood),
],{surface_height:1.03});
asset('manufacturing.material.sample','待检样品',[.38,.34],.19,['样件','检验样品','试件'],[
  box(-.19,-.17,0,.38,.34,.075,navy),box(-.15,-.13,.075,.29,.26,.115,ice),
  box(-.08,-.07,.19,.12,.12,.015,steel),
]);
asset('manufacturing.equipment.control-panel','设备控制柜',[1.22,.94],1.79,['电控柜','操作台','控制面板'],[
  box(-.60,-.42,0,1.20,.84,1.2,steel),box(-.60,-.43,1.20,1.20,.86,.59,white),
  box(-.50,.43,1.35,.70,.021,.31,navy),box(-.45,.454,1.39,.60,.010,.22,glass),
  ...[teal,safety,'#b86b5e'].map((c,i)=>box(.31,.435,1.33+.12*i,.11,.017,.07,c)),
]);
asset('manufacturing.person.inspector','检验人员',[1.05,.72],1.71,['质检员','检测员','品质'],person('#dce7dc',teal));
asset('manufacturing.person.maintenance','维修人员',[1.05,.72],1.71,['维修工','维修员','运维'],person('#42717a',safety,'point'));
asset('manufacturing.equipment.safety-fence','安全隔离栏',[2.48,.31],1.34,['围栏','安全护栏'],[
  ...[-1.2,.99].map(x=>box(x,-.13,0,.20,.26,1.34,steel)),
  ...[.30,1.2].map(z=>box(-1.16,-.08,z,2.30,.16,.10,safety)),
  ...Array.from({length:9},(_,i)=>box(-1.03+i*.241,-.035,.39,.055,.07,.83,ice)),
]);

const registryURL = new URL('assets/registry.json',root);
const active = existsSync(registryURL) ? JSON.parse(readFileSync(registryURL,'utf8')) : [];
const existing = new Map(active.map(asset=>[asset.id,asset]));
const rotations = [0,90,180,270];
const registry = specs.map(({ parts, ...spec }) => {
  const approved = existing.get(spec.id);
  if (approved && approved.source_type !== 'procedural') return approved;
  const industry = spec.id.split('.')[0];
  const category = spec.id.split('.')[1];
  const variants = {};
  for (const rotation of rotations) {
    const blocks = parts.map(({ x,y,z,w,d,h,color }) => {
      const [rx,ry,rw,rd] = {
        0:[x,y,w,d],90:[-y-d,x,d,w],180:[-x-w,-y-d,w,d],270:[y,-x-w,d,w],
      }[rotation];
      return { x:rx,y:ry,z,w:rw,d:rd,h,color };
    });
    // Preserve assembly order for attached front panels and surface details.
    const bricks = blocks.map(p => brick(p.x,p.y,p.z,p.w,p.d,p.h,p.color,unit));
    const bounds = extent(bricks.flatMap(b=>b.points),2);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.join(' ')}">${bricks.map(b=>b.svg).join('')}</svg>\n`;
    const base = `assets/${industry === 'universal' ? 'universal' : 'industry/'+industry}/${category}`;
    const file = `${base}/${spec.id.split('.').at(-1)}-${rotation}.svg`;
    mkdirSync(new URL(base+'/',root),{recursive:true});
    writeFileSync(new URL(file,root),svg);
    variants[rotation] = { file, sha256:createHash('sha256').update(svg).digest('hex'), anchor:[-bounds[0],-bounds[1]], view_box:bounds };
  }
  return {
    ...spec, height:Math.max(spec.height,...parts.map(p=>p.z+p.h)),
    version:'1.0.0', category, industry, tags:[category,spec.name],
    file:variants[0].file, anchor:variants[0].anchor,
    supported_directions:rotations, style_profile:style, source_type:'procedural',
    source_url:null, license:'LicenseRef-Project-Original', attribution:'Isometric Scene Composer',
    status:'approved', variants,
  };
});
const builtIn = new Set(specs.map(spec=>spec.id));
registry.push(...active.filter(asset=>!builtIn.has(asset.id)));
writeFileSync(registryURL,JSON.stringify(registry,null,2)+'\n');
console.log(`Registered ${registry.length} assets. Existing non-procedural entries were kept.`);
