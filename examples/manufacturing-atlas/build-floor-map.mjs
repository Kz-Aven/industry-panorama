import { readFileSync, writeFileSync } from 'node:fs';

const root=new URL('../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const image='data:image/png;base64,'+read('assets/illustrations/manufacturing-continuous-floor.png').toString('base64');

const steps=[
  {id:'review',title:'接单评审',place:'控制室',who:'销售 · PMC（生产计划与物料控制）',input:'客户订单、数量、期望交期',
    action:'核对物料齐套、瓶颈产能和在制工单冲突。案例中，300 台控制柜急单被判为谨慎接单，需要先协调替代料及喷涂分批。',output:'接单建议与协调事项',next:'交给 PMC 做交期平衡与排产。',source:'订单接单评审 · 同一急单案例'},
  {id:'schedule',title:'平衡交期与排产',place:'控制室',who:'PMC · 销售 · 采购 · 生产',input:'评审结论、受影响工单和物料缺口',
    action:'给出守期、分批或延期的建议。方案确认后，PMC 更新工单优先级并通知受影响岗位。',output:'更新后的排程、工单优先级与通知',next:'采购跟催缺料，生产按新顺序准备开工。',source:'交期平衡与产销协同、排产与插单调整 · 同一急单案例'},
  {id:'receiving',title:'到料齐套与开工',place:'收货仓储',who:'采购 · PMC · 生产',input:'排程、到货预测与物料齐套状态',
    action:'采购跟催会影响开工的物料。生产开工前汇合物料、BOM 版本、工艺文件、产能和工装状态，检查还有哪些条件待补。',output:'齐套状态与开工条件核查结果',next:'条件满足后，生产按工单开工。',source:'来料跟催、开工条件核查 · 同类案例'},
  {id:'production',title:'生产与检验',place:'生产车间',who:'生产 · 质检 · PMC',input:'工单、领用物料与受控作业文件',
    action:'车间按工单装配，记录产量、欠数和返工情况。生产与 PMC 核对执行偏差，需要时调整后续产量和预计完成时间。',output:'批次、生产进度与检验记录',next:'将批次及其检验证据交给放行环节。',source:'执行偏差追踪与补产、交付风险评估 · 同类案例'},
  {id:'release',title:'放行与包装',place:'质检包装区',who:'质检 · 生产 · 仓储',input:'待放行批次、检验记录及客户约定',
    action:'依据检验数据与交付要求复核。案例有放行、返工、暂缓、让步和拒收等处置选项，相关责任人确认后再执行。',output:'放行或处置结论、可交付批次',next:'可交付批次进入包装发运，异常批次按处置结论返回相关环节。',source:'交付风险评估 · 同类案例'},
  {id:'shipping',title:'发运与交付',place:'成品发运区',who:'仓储 · 物流 · 销售',input:'可交付批次、收货要求与出货安排',
    action:'按批次准备发运。交付记录保留批号和去向，销售据交付安排向客户同步。',output:'订单与发运批次、去向记录',next:'交付后若发生客诉，可从成品批号逆查投入和检验记录。',source:'批次质量追溯与异常归因 · 案例的发货去向关系'},
  {id:'delay',title:'缺料或产能冲突',place:'控制室',who:'采购 · PMC · 销售',input:'到货预测晚于需求时间，或工单争抢同一瓶颈工序',
    action:'采购反馈到货预测，PMC 重算受影响订单。需要时改为拆批或调整交期，由销售更新对客户的承诺。',output:'新版排程与对客交期口径',next:'回到排产，根据新版计划检查齐套。',source:'来料跟催、交期平衡与产销协同'},
  {id:'trace',title:'客诉追溯',place:'发运区 → 生产 → 收货仓储',who:'售后 · 质检 · 仓储',input:'客户投诉、成品批号或发运记录',
    action:'先核对投诉批号与检验口径，再沿批次记录回查生产与原料批号，同时查清同批产品的库存和发货去向。',output:'批次谱系、受影响范围与证据清单',next:'供质量人员确认处置范围和对客答复。',source:'批次质量追溯与异常归因'},
];
const zones=[
  ['receiving','收货仓储',340,810],['production','生产车间',588,465],['release','质检包装',1085,485],
  ['shipping','发运区',1315,245],['schedule','控制室',1266,807],
];
const labels=zones.map(([id,title,x,y])=>`<button type="button" class="pin" data-select="${id}" style="--x:${x/15.36}%;--y:${y/10.24}%" aria-pressed="false">${title}</button>`).join('');
const menu=steps.slice(0,6).map((item,i)=>`<button type="button" class="step" data-select="${item.id}" aria-pressed="false"><span>${i+1}</span>${item.title}</button>`).join('');
const html=`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>一张急单，如何走完工厂</title>
<style>
${read('src/floor-map.css').toString()}</style></head>
<body><main>
<header><h1>一张急单，如何走完工厂</h1><p><span class="case">从 300 台控制柜急单开始</span> · 点击工区或按步骤跟踪，查看每一站交出去什么。</p></header>
<nav aria-label="订单交付步骤">${menu}</nav>
<div class="layout">
<div class="map-shell">
<div class="map">
<img src="${image}" width="1536" height="1024" alt="连续等距厂区，左下是收货仓储，中间是生产和质检，右上是装车发运，右下是控制室。">
<svg viewBox="0 0 1536 1024" aria-hidden="true">
<defs>
<marker id="m" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="3" markerHeight="3" orient="auto-start-reverse"><path d="M1 1 11 6 1 11Z" fill="#008372" stroke="white" stroke-width="1"/></marker>
<marker id="c" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="3" markerHeight="3" orient="auto-start-reverse"><path d="M1 1 11 6 1 11Z" fill="#574c96" stroke="white" stroke-width="1"/></marker>
<marker id="r" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="3" markerHeight="3" orient="auto-start-reverse"><path d="M1 1 11 6 1 11Z" fill="#a45525" stroke="white" stroke-width="1"/></marker>
<path id="receiving-path" d="M451 853 Q562 888 685 805 Q719 782 668 740 L585 693 Q560 678 603 650 L690 602"/>
<path id="assembly-path" d="M701 593 L792 541 Q840 513 898 483 L944 457"/>
<path id="shipping-path" d="M1056 540 L1152 486 Q1220 448 1282 401 Q1320 375 1280 349 L1207 303"/>
<path id="control-path" d="M1157 784 Q1035 723 947 676 L868 630 Q831 612 857 589 L917 551"/>
<path id="trace-path" d="M1211 321 L1272 355 Q1310 380 1271 410 L1140 494 L951 592 L750 699 L516 836"/>
</defs>
<g class="route material" data-track="receiving production"><use href="#receiving-path" class="halo"/><use href="#receiving-path" class="line" marker-end="url(#m)"/></g>
<g class="route material" data-track="production release"><use href="#assembly-path" class="halo"/><use href="#assembly-path" class="line" marker-end="url(#m)"/></g>
<g class="route material" data-track="release shipping"><use href="#shipping-path" class="halo"/><use href="#shipping-path" class="line" marker-end="url(#m)"/></g>
<g class="route control" data-track="review schedule delay"><use href="#control-path" class="halo"/><use href="#control-path" class="line" marker-end="url(#c)"/></g>
<g class="route reverse" data-track="trace"><use href="#trace-path" class="halo"/><use href="#trace-path" class="line" marker-end="url(#r)"/></g>
</svg>${labels}</div>
<div class="key"><span><i></i>物料与成品</span><span><i class="dashed"></i>排程与异常反馈</span><span id="trace-key" hidden><i class="trace"></i>批次逆查</span></div>
</div>
<aside class="detail" aria-live="polite" aria-labelledby="scene-title">
<h2 id="scene-title"></h2><div id="scene-who"></div><p id="scene-action"></p>
<dl><dt>收到什么</dt><dd id="scene-input"></dd><dt>交出什么</dt><dd id="scene-output"></dd><dt>流向哪里</dt><dd id="scene-next"></dd></dl>
<p class="source" id="scene-source"></p>
</aside>
</div>
<div class="branches" aria-label="条件分支"><button class="branch" type="button" data-select="delay" aria-pressed="false">缺料或产能冲突</button><button class="branch" type="button" data-select="trace" aria-pressed="false">从客诉逆查批次</button></div>
<p class="foot">接单评审、交期平衡和排产调整使用同一急单原文。收货、生产、放行和发运根据不同制造案例归纳，厂区及物流路径为教学示意。</p>
</main>
<script>
const steps=${JSON.stringify(steps).replaceAll('<','\\u003c')};
const buttons=[...document.querySelectorAll('[data-select]')];
const paths=[...document.querySelectorAll('[data-track]')];
function select(id){
  const step=steps.find(item=>item.id===id);
  const values={title:step.title,who:step.place+' · '+step.who,action:step.action,input:step.input,output:step.output,next:step.next,source:'案例依据 · '+step.source};
  for(const [key,value] of Object.entries(values)) document.getElementById('scene-'+key).textContent=value;
  for(const button of buttons){
    const physical=button.classList.contains('pin') && button.dataset.select==='schedule' && ['review','delay'].includes(id);
    button.setAttribute('aria-pressed',String(button.dataset.select===id || physical));
  }
  const branch=id==='delay'||id==='trace';
  for(const path of paths){
    const active=path.dataset.track.split(' ').includes(id);
    path.classList.toggle('active',active);
    path.classList.toggle('dim',branch && !active);
  }
  document.getElementById('trace-key').hidden=id!=='trace';
}
for(const button of buttons) button.addEventListener('click',()=>select(button.dataset.select));
select('review');
</script></body></html>
`;
writeFileSync(new URL('outputs/manufacturing-floor-map.html',root),html);
