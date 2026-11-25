---
name: isometric-scene-composer
description: 把行业研究、岗位职责、业务流程、已有 HTML、JSON 或文字描述转成等距微缩工作场景和可点击的行业、角色、流程或 AI 机会图。用于表现人物如何操作设备、使用系统、处理业务对象，以及如何保留原始案例和来源。
---

# Isometric Scene Composer

把业务知识整理成 Scene 或 Atlas JSON，再由 CLI 复用本地素材、计算布局并导出 SVG、透明 PNG 或离线 HTML。技能目录为本文件所在目录。首次使用时在该目录执行 `npm ci`，已有依赖时直接运行。PNG 与 FossFLOW 导出另需 `rsvg-convert`。

## 从资料到场景

1. **读原文。** 抽取角色、动作、工作对象、系统、结果、案例、关系和来源。对已有 HTML，先定位真实数据、分类、标签页和事件语义。静态读取嵌入 JSON 或 DOM，原文件只读。对照原图查案例数、分组、详情字段及交互。已符合 Schema 的 JSON 可以直接校验。
2. **选形式。** 价值链或组织分区用 `industry_atlas`，岗位职责与协作用 `role_atlas`，跟踪业务对象用 `process_journey`，一个工作片段用 `scenario_diorama`，人、Agent 与系统协作用 `ai_opportunity_map`。沿用用户明确选定的类型。复杂输入先做一个代表场景，再扩展到地图。
3. **计划动作与构图。** 由人物、环境、工作对象、动作和产出组成场景。具体业务规则与流程连接要有来源。设备型号、姿势等具象化选择可作为插画示意；有影响时在详情里说明。阅读顺序用 `reading_order`，业务流转用有证据的 `flow`，反查方向用 `query`。从 [布局与语义](references/scene-planning.md) 查槽位、锚点和 ID 约定。
4. **查询素材。** 先查已知 ID、行业映射与同义词。示例：`npm run scene -- assets search "数控机床" --industry manufacturing`。可以用 `assets match` 输入角色、动作、工具和工作对象，获得匹配证据、建议姿态和朝向。只有业务表达等价才复用其他素材。关键素材仍缺失时，保留预定 ID，运行 `assets check` 生成需求与提示词。素材来源、审核及可选生图见 [素材工作流](references/assets.md)。制造业需要时再读 [行业包](industry-packs/manufacturing/manifest.yaml)。
5. **写结构化输入。** 对照 [Scene Schema](schemas/scene.schema.json) 或 [Atlas Schema](schemas/atlas.schema.json)。使用原有案例 ID，补充稳定来源定位。通过 `semantic_ref`、`action`、`target` 将图形绑定到知识，交互通过 `case_ids` 引用案例。用模板槽位或显式坐标表达布局，桌面物件用 `support` 绑定承托对象。
6. **验证并执行。** `npm run scene -- validate <输入.json>` 校验结构、引用、素材、碰撞和边界。单场景用 `render <scene.json>`，全景用 `atlas <atlas.json>`，附 `--format svg|png|html` 和需要的 `--out`。用 `--format plan` 查看坐标和绘制顺序。多份资料先逐份规划为 JSON，再使用批次清单统一生成，见 [批量与匹配用法](references/p1-workflow.md)。需要在 FossFLOW 编辑时，用 `export <atlas.json> --format fossflow`，一并交付导入文件与业务映射。导入步骤与样例见 [README](README.md#在-fossflow-中编辑全景)。
7. **打开输出。** 对照 [质量评分表](references/quality-rubric.md) 看轮廓、人物动作、接触面、遮挡和来源。在浏览器点击场景、展开匹配案例，检查需要的搜索、筛选、知识视图和小屏表现。发现视觉问题时优先调整朝向、槽位和物体间距。
8. **交付与复用。** 返回生成文件、数据来源、缺失素材、实际执行的验证和仍需确认的语义。新外部素材先保留为 draft，审核可用性、授权和比例后再批准。重用成熟模板。Blender 和流程动画使用后续版本的接口。

需要参考图级的写实微缩效果时，先复用独立写实 PNG。缺少关键资产时按 [制作和登记](references/assets.md#写实-png-素材) 生成、验收并加入素材库。固定整图可用 `render.illustration`。

视觉要求见 [视觉设计规范](references/visual-design.md)。已有导出迁移可参考 [制造业全景示例](examples/manufacturing-atlas/atlas.json) 和 [原图提取脚本](scripts/extract-manufacturing.py)。
