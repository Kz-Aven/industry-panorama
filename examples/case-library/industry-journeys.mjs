export const batches=[
  ['logistics','consumer-retail','information-technology'],
  ['medical-health','finance','public-services','energy-utilities'],
  ['construction-tourism','education-research','digital-creative','universal'],
];

// Work areas reference existing Atlas scenes. Each route names its supporting case.
export const industries={
  logistics:{
    areas:['warehouse','customs','branch','finance'],
    workspaceLabels:{branch:['出入库记录台','从收发流水找出与盘点差异有关的票据。'],finance:['报告复核台','汇总差异、归因证据与待复核事项。']},
    sites:[['shipper','委托货主','sales','提供客户要求与货件资料。'],['factory','仓配运营中心',null,'核对库存、处理单据和仓配异常。'],['carrier','承运和报关协作方','customs','补充运输及申报相关单据。'],['recipient','收货客户','service','根据交接记录核对货件与异常。']],
    main:['库存盘点与差异追查','盘点记录 → 出入库票据 → 归因报告',['warehouse','warehouse','branch','finance'],
      [['factory','carrier','按差异货件核对出入库或交接票据','库存账实差异归因']]],
    extra:{title:'报关单据核对',object:'委托资料 → 报关草单 → 差异项',steps:[
      ['收集申报资料','运营','收集申报所需单证，核对缺项','customs','报关草单智能生成'],
      ['核对单据一致性','报关运营','对照多份相关单据，标记冲突及证据','customs','报关四单一致审核']],
      edges:[['shipper','factory','交付单证用来形成报关草单','报关草单智能生成'],['factory','carrier','提交待复核的报关草单和差异项','报关四单一致审核']]},
  },
  'consumer-retail':{
    areas:['sourcing','fulfillment','store','support'],
    workspaceLabels:{support:['售后与索赔台','核对客户订单和处理状态，汇总适用的差异与证据。']},
    sites:[['shipper','上游发货方','sourcing','准备货物及装箱记录。'],['carrier','头程运输','fulfillment','按批次交接货件和签收证据。'],['factory','海外仓与零售运营',null,'核对上架和差异，处理渠道订单或索赔。'],['customer','零售顾客','support','提供订单及售后反馈。']],
    main:['头程入仓与索赔','装箱单 → 签收单 → 上架记录 → 索赔证据',['fulfillment','fulfillment','support','support'],
      [['shipper','carrier','货件及装箱记录','头程入仓核对与丢件索赔'],['carrier','factory','签收信息与待上架批次','头程入仓核对与丢件索赔'],['factory','carrier','按差异原因提交索赔证据','头程入仓核对与丢件索赔']]],
    extra:{title:'零售客诉追单',object:'顾客反馈 → 订单记录 → 处理进度',steps:[
      ['接收顾客反馈','客服','核对反馈与对应订单','support','客诉订单追踪'],
      ['回查订单和履约状态','客服 · 仓配','汇总履约记录与当前处理情况','fulfillment','客诉订单追踪'],
      ['整理可反馈的进度','客服','对齐订单信息和处理去向','support','客诉订单追踪']],
      edges:[['customer','factory','提供反馈及对应订单线索','客诉订单追踪'],['factory','customer','反馈核实后的订单处理进度','客诉订单追踪']]},
  },
  'information-technology':{
    areas:['datacenter','incident','delivery','service'],
    sites:[['client','客户使用现场','service','反馈工单和故障现象。'],['factory','技术运营中心',null,'核对巡检告警、维护记录和客户工单。'],['partner','委托方与服务方','delivery','代维工作以验收或报告向委托方呈现。']],
    main:['机房巡检与日报','巡检表 → 设备记录 → 告警对照 → 日报',['datacenter','datacenter','incident','incident'],[]],
    extra:{title:'客户工单与进度通知',object:'客户工单 → 核实记录 → 进度通知',steps:[
      ['登记客户问题','客服','汇集来访事项并建单','service','客户工单回复与进度通知'],
      ['核实事实与处理进度','技术支持','对齐工单和状态信息，起草回复','incident','客户工单回复与进度通知'],
      ['同步进度并归档','客服','确认反馈口径并保留记录','service','客户工单回复与进度通知']],
      edges:[['client','factory','客户问题与工单线索','客户工单回复与进度通知'],['factory','client','经核对的处理进度与回复','客户工单回复与进度通知']]},
  },
  'medical-health':{
    areas:['followup','service','billing','safety'],
    sites:[['patient','患者出院后','followup','按预约接受回访，反馈情况。'],['factory','医院随访工作区',null,'按名单排期、登记回访并跟进转介。'],['payer','结算核对接口','billing','在结算主题中展示院内和上报数据的对照。']],
    main:['出院随访','出院名单 → 排期 → 回访记录 → 随访台账',['followup','followup','service','safety'],
      [['factory','patient','电话或其他约定方式的随访联系','出院随访分层排期表'],['patient','factory','回访反馈及待跟进事项','出院随访分层排期表']]],
    extra:{title:'结算清单核对',object:'结算清单 → 差异 → 复核记录',steps:[
      ['整理待上报记录','财务','汇集清单及对照记录','billing','结算清单上传前的双口径核对'],
      ['对照口径并标出差异','财务','生成需人工复核的差异','billing','结算清单上传前的双口径核对']],
      edges:[['factory','payer','对照院内及上报清单口径','结算清单上传前的双口径核对']]},
  },
  finance:{
    areas:['insurance','service','operations','compliance'],
    workspaceLabels:{operations:['存量记录核对台','核查现有影像和留存记录，标出缺项后交回受理人员。']},
    sites:[['client','客户报案或投诉','service','提供事件与现有资料。'],['factory','金融服务工作区',null,'整理受理、核对和告知留痕。'],['review','外部投诉转办','compliance','在投诉专题中向机构转交投诉工单。']],
    main:['理赔材料告知','报案 → 材料清单 → 告知留痕',['insurance','service','operations','service'],
      [['client','factory','报案情况和已有材料','理赔材料一次性告知清单'],['factory','client','告知待补材料和经核实的替代路径','理赔材料一次性告知清单']]],
    extra:{title:'转办投诉答复',object:'转办工单 → 核实材料 → 答复草稿',steps:[
      ['接收转办工单','客服','整理投诉事实和材料','service','12363／12378 转办工单答复初稿'],
      ['核对口径并形成草稿','客服 · 合规','整理证据与待复核答复','compliance','12363／12378 转办工单答复初稿']],
      edges:[['review','factory','转办投诉工单供机构核查','12363／12378 转办工单答复初稿']]},
  },
  'public-services':{
    areas:['hotline','service','city','coordination'],
    sites:[['resident','来电群众','service','陈述诉求与地点等信息。'],['factory','热线与政务服务',null,'核对工单要素、查询责任单位并保留分拨依据。'],['agency','事项承办单位','city','根据职责接收待处理，历史退件用于复核分派。']],
    main:['12345 工单分拨','来电诉求 → 工单 → 分派建议',['hotline','city','service','coordination'],
      [['resident','factory','提供待记录的诉求与地点信息','12345 工单智能分拨'],['factory','agency','分派建议及责任单位信息','12345 工单智能分拨'],['agency','factory','已有退件记录用于复核分派','12345 工单智能分拨']]],
    extra:{title:'跨部门事件复盘',object:'处置记录 → 时间线 → 复盘报告',steps:[
      ['归集跨部门记录','行政','汇总处置资料与时间节点','city','跨部门事件处置复盘报告'],
      ['形成复盘报告','行政 · 协作部门','整理卡点及待跟进事项','coordination','跨部门事件处置复盘报告']],
      edges:[['agency','factory','处置记录用作事件复盘输入','跨部门事件处置复盘报告']]},
  },
  'energy-utilities':{
    areas:['water','field','operation','environment'],
    workspaceLabels:{field:['管网记录核对区','调取现场作业和巡检记录供同址对照。'],operation:['分区与监测台','核对异常测点所属分区与相关上下游记录。']},
    sites:[['field','分区测点与管网现场','field','采集运行作业和测点资料。'],['factory','供水化验与运营',null,'交叉核对测点、化验和作业记录。'],['report','公示与上报界面','environment','在数据上报专题中使用核对完成的水质资料。']],
    main:['水质异常归因','化验记录 → 作业时间轴 → 异常日报',['water','field','operation','environment'],
      [['field','factory','测点、管网作业与历史异常记录','水质化验日报与末梢余氯异常归因']]],
    extra:{title:'水质公示与上报',object:'检测记录 → 核对 → 上报包',steps:[
      ['汇集检测记录','生产','整理供水检测和报告输入','water','供水水质公示与上报数据包'],
      ['复核并形成可公示资料','生产 · 运营','整理水质数据包并记录缺项','environment','供水水质公示与上报数据包']],
      edges:[['factory','report','提交供核对或公示的数据包','供水水质公示与上报数据包']]},
  },
  'construction-tourism':{
    areas:['construction','settlement','approval','tender'],
    sites:[['owner','建设与委托方','tender','提供要求及合同资料，参与确认变更。'],['factory','建设项目现场',null,'记录变更、洽商、签证和价格依据。'],['filing','验收与备案接口','approval','在建设验收专题中核对备案和产权材料。']],
    main:['工程变更留证','现场记录 → 洽商签证 → 价格与待签批草稿',['construction','settlement','settlement','approval'],
      [['owner','factory','变更要求及相关洽商记录','工程变更与签证留证'],['factory','owner','提交需签认的变更材料','工程变更与签证留证']]],
    extra:{title:'竣工验收备案',object:'竣工和验收材料 → 缺项清单 → 备案材料',steps:[
      ['归集竣工资料','生产 · 项目人员','归拢验收证明和工程归档资料','construction','竣工验收备案与产权登记资料清单'],
      ['核对备案与登记资料','项目经办人','识别需补件的材料并整理清单','approval','竣工验收备案与产权登记资料清单']],
      edges:[['factory','filing','交接待核对的竣工验收与登记资料','竣工验收备案与产权登记资料清单']]},
  },
  'education-research':{
    areas:['teaching','learner','evaluation','academic'],
    sites:[['learner','课堂与学员','learner','课堂表现为备课提供反馈。'],['factory','教学与教研工作区',null,'核对教研资料、备课并审定课程内容。'],['review','校内或外部评审','academic','在课程申报主题中核验材料。']],
    main:['课堂反馈与教研','教研资料 → 学情 → 教案初稿 → 教研回流',['teaching','learner','teaching','evaluation'],
      [['learner','factory','课堂记录与学情作为备课输入','教案课件初稿']]],
    extra:{title:'课程申报材料核对',object:'课程资料 → 附件清单 → 待复核材料',steps:[
      ['整理课程申报材料','教师','归集教学、课程和附件资料','teaching','一流课程申报附件清单核对'],
      ['核对附件并补缺','行政 · 教师','对照申报清单标记缺项','academic','一流课程申报附件清单核对']],
      edges:[['factory','review','课程材料供评审核对','一流课程申报附件清单核对']]},
  },
  'digital-creative':{
    areas:['production','assets','localize','rights'],
    sites:[['studio','制片与拍摄','production','产出粗剪和剧本定稿。'],['factory','后期制作工作区',null,'校对字幕并记录版本与术语。'],['local','剪辑与译制协作方','localize','接收修订字幕和术语表。']],
    main:['字幕校对与译制','粗剪和剧本 → 对照字幕 → SRT 和术语表',['production','production','rights','localize'],
      [['studio','factory','交付粗剪、字幕及定稿剧本','字幕与剧本定稿对照校对'],['factory','local','交接修订字幕和术语表','字幕与剧本定稿对照校对']]],
    extra:{title:'内容授权审核',object:'授权材料 → 条款核对 → 冲突记录',steps:[
      ['汇总授权条款','法务','整理范围、期限及相关材料','rights','授权条款冲突自查'],
      ['比对冲突并留痕','法务','列出待复核的冲突与证据','rights','授权条款冲突自查']],
      edges:[['studio','factory','提供内容相关的授权材料供核对','授权条款冲突自查']]},
  },
  universal:{
    areas:['sales','finance','sourcing','legal'],
    sites:[['client','往来客户','sales','形成交易、订单和回款记录。'],['factory','企业协作工作区',null,'按企业内部口径核对、对账和采购协调。'],['supplier','报价供应商','sourcing','在采购专题中提供待比较的报价。']],
    main:['应收账龄与催收','销售台账 → 回款匹配 → 账龄 → 催收清单',['sales','finance','finance','sales'],
      [['client','factory','客户回款与订单或发票的匹配依据','应收账款账龄分析与逾期预警']]],
    extra:{title:'比价与采购留档',object:'供应商报价 → 比价表 → 留档记录',steps:[
      ['归集供应商报价','采购','汇集不同报价及历史价格','sourcing','比价留档表'],
      ['按口径比较并审阅','采购','形成比价依据及记录','sourcing','比价留档表']],
      edges:[['supplier','factory','报价单和报价条件供采购比较','比价留档表']]},
  },
};
