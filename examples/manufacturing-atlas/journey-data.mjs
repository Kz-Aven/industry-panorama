export const areas=[
  {id:'receiving',label:'收货仓储',scene:'planning-supply',offset:[0,8],size:[12,8],color:'#d7ac62',pin:[4.7,14.6],cases:[50,51,56,58,1,4,7,59]},
  {id:'production',label:'生产与质检',scene:'production-quality',offset:[12,8],size:[13,8],color:'#89bdc6',pin:[18,14.8]},
  {id:'shipping',label:'放行与发运',scene:'release-delivery',offset:[25,8],size:[12,8],color:'#aad094',pin:[30.4,14.5]},
  {id:'planning',label:'接单与计划室',scene:'sales-order',offset:[0,0],size:[12,8],color:'#d2a3a6',pin:[6.8,6.1],groups:['sales-order','planning-supply','operations-finance']},
  {id:'engineering',label:'工艺与质量室',scene:'product-process',offset:[12,0],size:[13,8],color:'#a9a7d6',pin:[18.4,5.4],groups:['product-process','quality-compliance','service-trace']},
  {id:'maintenance',label:'设备维修区',scene:'maintenance',offset:[25,0],size:[12,8],color:'#b5c9a7',pin:[31,5.4]},
];

export const participants=[
  {id:'supplier',title:'上游供应商',description:'提供来料、检验资料和到货承诺，配合处理到货异常与质量索赔。',cases:[59,55,50,51,56,54]},
  {id:'factory',title:'制造企业',description:'从接单评审、齐套开工到生产、质量放行和售后追溯。',cases:[2,6,13,5,17,28]},
  {id:'logistics',title:'仓配与承运',description:'接收可交付批次并记录发运去向。案例涉及在途、客户和库存范围核对，实际可由自营仓配或承运方承担。',cases:[17,28,34]},
  {id:'customer',title:'下游客户',description:'发出需求和交期，收货并反馈短收、质量或质保问题。',cases:[64,2,17,26,28,8]},
];

export const journeys=[
  {id:'delivery',title:'订单交付',object:'客户订单 → 工单 → 交付批次',question:'一张订单怎么变成发出去的一批货？',
    external:[['supplier','factory','来料、到货预测与检验资料',[50,59]],['factory','logistics','放行后的交付批次与发运记录',[17,28]],['logistics','customer','成品与批次去向',[28]]],
    feedback:[['customer','factory','订单行、数量与期望交期',[64,2]],['factory','customer','交期口径与协商事项',[3,17]]],
    steps:[
      ['受理订单','销售','客户单据 → 客户订单行','planning',[64]],
      ['评审与排产','PMC · 销售','订单行、产能、齐套 → 接单建议与调整后排程','planning',[2,3,6]],
      ['到料与开工','采购 · 仓储 · PMC · 生产','到货预测、受控版本与齐套状态 → 开工核查结果','receiving',[59,7,13]],
      ['生产与检验','生产 · 质检','工单与实际报工 → 批次记录、进度和检验证据','production',[5,23,35]],
      ['放行与出货','质检 · 仓配 · 销售','检验结果与客户条件 → 放行或处置结论、发运去向','shipping',[17,28]],
    ],
    objects:[['客户订单','订单号与订单行','客户单据转订单、接单评审',[64,2]],['生产工单','关联订单行与工单号','排产与补产',[6,5]],['交付批次','关联工单、检验及发货去向','放行与发运记录',[17,28]]]},
  {id:'change',title:'工程变更',object:'工程变更单 → 受控版本 → 在制与订单',question:'一处变更怎么落到现场和受影响订单？',
    external:[['supplier','factory','停产或变更通知（EOL／PCN）',[53]],['factory','customer','涉及客户要求时核查合同与约定',[62,66,53]]],
    feedback:[],
    steps:[
      ['识别与评估变更','研发 · 采购','变更通知 → ECN、影响范围与验证计划','engineering',[41,53,42]],
      ['核对物料与在制','采购 · PMC','料号、BOM、在制记录 → 受影响物料与订单','planning',[53,39,6]],
      ['更新受控作业文件','工艺 · 品质 · 生产','受控版本与现场发放台账 → 待替换文件和现场核查','production',[39,15,16]],
    ],
    objects:[['工程变更通知','ECN 编号或外部通知来源','变更触发与评估',[41,53]],['物料与版本','料号、BOM 版本与文件号','替代料与现场版本核对',[40,42,39]],['受影响订单','订单行、产品和在制工单','评估变更影响与排程',[53,6]]]},
  {id:'exception',title:'缺料与交期',object:'缺料项 → 到货预测 → 排程与对客交期',question:'来料延期会影响哪张订单，谁负责调整？',
    external:[['supplier','factory','供应商承诺与到货预测',[59]],['factory','customer','拆批或延期的回复口径',[3,61]]],
    feedback:[['factory','supplier','缺料项、断料日期与跟催请求',[57,59]]],
    steps:[
      ['识别断料与迟交风险','PMC · 生产','齐套表、排程 → 缺料项和受影响订单','receiving',[7,61]],
      ['跟催并确认到货预测','采购 · 供应商','断料日期与承诺日期 → 到货预测与跟催待办','receiving',[59,57]],
      ['重排并同步交期','PMC · 销售','到货预测、在制工单和产能 → 重排及对客口径','planning',[3,6,61]],
    ],
    objects:[['缺料项','料号、需求日期与缺口','齐套与缺料预警',[7]],['供应商到货预测','采购订单、承诺日和预测日','来料跟催',[59]],['受影响订单','订单、交期与在制工单','延期预警与产销协调',[3,61]]]},
  {id:'trace',title:'客诉与批次追溯',object:'客诉记录 → 成品批次 → 投料与供应商',question:'客户反馈一批货有问题，从哪里查起？',
    external:[['customer','factory','客诉、成品批号与验收口径',[26,28]],['factory','supplier','原辅料批号、来料证据及索赔材料',[21,54]]],
    feedback:[['factory','customer','受影响范围、调查证据与待确认的答复口径',[26,28,8]],['logistics','factory','发货去向、在途与签收线索',[28,34]]],
    steps:[
      ['确认客诉批次','售后 · 客户 · 质检','客诉记录与检验口径 → 待查成品批次','engineering',[26,28,8]],
      ['查发运与留存','质检 · 仓配','成品批号 → 库存、发运去向及在途记录','shipping',[28,34]],
      ['回查生产与检验','生产 · 质检','批号与工单 → 生产、检验及异常证据','production',[28,23,22]],
      ['追原辅料去向','质检 · 仓储 · 采购','投料记录 → 原辅料批号、受影响批次及供应商','receiving',[21,28,54]],
    ],
    objects:[['客诉记录','客户、投诉项目与成品批号','确认投诉和验收口径',[26,28]],['成品批次','成品批号、生产记录与出货去向','定位同批及在途范围',[28,34]],['原辅料批次','投料记录与原料批号、供应商','逆查材料来源与影响',[21,54]]]},
];
