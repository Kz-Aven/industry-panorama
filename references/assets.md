# 素材工作流

本地基础库包括通用原子素材、行业设备与物料、带姿态的人物和由模板组合的工作片段。素材查询先用精确 ID，其次使用行业包映射、语义标签和别名。确认通用替代物能表达原动作，再选择已有组合或创建新素材。核心素材使用统一方向与尺度且带内容哈希。登记元数据以 [Asset Schema](../schemas/asset.schema.json) 为准。

## 写实 PNG 素材

沿用 [写实等距资产制作标准](visual-design.md)。先查询可用素材，确实缺少时用内置 imagegen 生成单件素材的四向图。场景可将同一 PNG 资产放在不同行业、不同坐标、不同模板和承托表面上。配件可独立增加，场景图只引用稳定 ID。

生成图验收后，用 `python3 scripts/register-png-assets.py <manifest.json>` 分格、去除透明边距并计算文件哈希。脚本需要 Pillow。清单由每个资产的 ID、四向图文件路径、完整提示词及状态组成。缺省状态为 `draft`，写入 `assets/drafts/` 供核对。将已看过且放入场景复验的条目标为 `approved` 再登记。脚本沿用同 ID 的占地、尺寸及锚点，可用单独的 `tiles` 归一坐标指定每个视角的裁剪范围。

```json
[
  {
    "id": "manufacturing.equipment.cnc",
    "source": "./cnc-atlas.png",
    "prompt": "用于 ImageGen 的完整提示词与参考说明",
    "status": "draft",
    "tiles": {"0": [0, 0, 0.5, 0.5]}
  }
]
```

新 ID 通过 `metadata` 提供名称、类别、行业、标签、别名、`footprint`、`height`、`style_profile` 和可选 `surface_height`。底板资产还提供可伸缩底板所用的三个面色 `colors`。复用已有 ID 的素材升级保留已有元数据。需要调整姿态或显著形变时，判断是否属于可复用的新变体。登记后运行 `npm run scene -- assets audit`，用 `node scripts/preview-assets.mjs` 刷新 [素材一览](../outputs/asset-library.html)。

## 程序化素材

[scripts/build-assets.mjs](../scripts/build-assets.mjs) 是基础库的 SVG 绘制来源。它根据尺寸和色板生成四个朝向、地面锚点、哈希及注册表。重建后用 `npm run scene -- assets audit` 核对文件、许可字段、视窗和重复内容。新增资产初审用 `draft`，通过下列步骤后才将状态改为 `approved`。

## 外部素材草稿

事先核对素材页和随包许可证。保留来源 URL、具体许可、作者署名和应附带的许可文件。SVG 先归一为独立素材，投影使用本项目标尺，地面中心位于 SVG 坐标 (0,0) 并落在 `viewBox` 内。导入脚本接受基本 SVG 图形、局部渐变和本地片段引用，扩展矢量功能需先转为几何路径。

`python3 scripts/import-svg.py <manifest.json>` 会生成 `assets/imported/<id>/` 下的草稿。示例清单如下。

```json
{
  "id": "manufacturing.equipment.sealer",
  "name": "封装工位",
  "version": "1.0.0",
  "category": "equipment",
  "industry": "manufacturing",
  "tags": ["包装"],
  "aliases": ["封装机"],
  "footprint": [1.8, 1.1],
  "height": 1.6,
  "style_profile": "industrial-isometric-v1",
  "source_url": "https://example.org/source",
  "license": "CC0-1.0",
  "attribution": "示例作者（换成实际署名）",
  "directions": {"0": "sealer.svg"}
}
```

审查 SVG 朝向、尺度、锚点、语义和许可，执行素材审计并预览，确认后编辑该 `asset.json` 的状态。草稿不会被检索选中，渲染时引用草稿会输出缺失报告。换版时保持业务 ID 稳定，更新 `version` 和哈希。测试资产宜另用临时项目目录。

## 缺失素材的可选制作方式

缺失报告中的提示词包含业务用途、等距角度、光照、色板、比例、透明背景以及禁止文字与装饰。对关键设备补充结构、部件和操作面方向。用户要求生图时应用内置 imagegen；指定其他供应商时遵循用户指定。ImageGen 位图采用四方向 PNG 登记；归一的外部 SVG 通过上一节导入。Blender 可在后续版本生成统一视角的资产。


## 整景插画

若用户要求产品级 3D 微缩、照片级人物或指定参考图风格，先做一张代表场景验收。使用内置 imagegen 从工作行为、人物比例、设备结构和参考风格生成整景透明 PNG。要求可辨认的操作面与手部接触，统一等距视角、平台、材料和光线。审核后将图片保存到 `assets/illustrations/`，在 `render.illustration` 写入该项目相对路径。保存生成提示词和来源说明。

整个 PNG 是一个插画组件。业务语义、案例、场景选中与物件案例快捷入口仍读取 Scene。SVG 会内嵌位图，布局计划仍描述结构化物体。程序化构图可通过省略 `render.illustration` 使用。合成插画内的人物与道具适合按整景更新。
