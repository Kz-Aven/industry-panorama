# 外部项目调研

核查于 2026-11-24。V1 使用本地 Node.js、JSON Schema、原生 SVG、内嵌 HTML 和 librsvg。以下调研用于确认外部集成边界，演示素材全部来自项目内的程序化 SVG。

| 项目 | 核查结果与取舍 |
| --- | --- |
| FossFLOW | 任务给出的上游仓库与 release 页面访问返回 404。本机 npm 缓存曾记录 `fossflow@1.0.5`、MIT 和 `stan-smith/fossflow-lib` 仓库地址，缓存的元数据时间为 2025-07-04，该地址本次亦返回 404。可访问 fork 的文档描述 Webpack 构建的 React 库，记录了自定义图标导入和缩放滑杆。维护状态、当前官方地址和可固定的正式目标版本仍待确认。[原仓库地址](https://github.com/stan-smith/FossFLOW) · [可访问 fork 的源码导读](https://github.com/F4tal1t/FossFLOW/blob/master/FOSSFLOW_ENCYCLOPEDIA.md) |
| Isoflow | Community Edition 源码和组件文档可读，MIT。React 组件接收 `initialData`，支持自定义图标、位置、区域与连接。Pro 单独发布。仓库页面可访问，当前可用发行版本未做安装验证。[组件源码](https://github.com/markmanx/isoflow/tree/main/src) · [组件许可证](https://github.com/markmanx/isoflow/blob/main/LICENSE) · [InitialData](https://isoflow.io/docs/api/initialData) |
| Kenney | Factory Kit 有滚筒、仓储和设备，Furniture Kit 覆盖桌椅等室内构件，City Kit Industrial 有厂房。官方资产页分别列出 CC0；页面有版本记录。作为未来 3D 模型来源，需统一灯光、材质和比例再输出。[Factory Kit](https://kenney.nl/assets/factory-kit) · [Furniture Kit](https://kenney.nl/assets/furniture-kit) · [Industrial Kit](https://kenney.nl/assets/city-kit-industrial) · [使用条款说明](https://kenney.nl/support) |
| Quaternius | Universal Base Characters 页面列出人形骨骼及 OBJ、FBX、glTF，对该包明确标记 CC0。站点有 2026-08 更新的 QAL 页面，新增包需逐包检查许可证与可取得的版本。可作为人物比例和动作来源。[Characters 素材页](https://quaternius.com/packs/universalbasecharacters.html) · [QAL](https://quaternius.com/license.html) |
| Blender | 官方镜像和许可文件可访问，程序代码采用 GPL。可作为外部离线正交相机与批渲染器，原始模型的许可独立核查。当前项目没有执行 Blender 渲染。[源码](https://github.com/blender/blender) · [COPYING](https://github.com/blender/blender/blob/main/COPYING) |
| OpenGameArt | FAQ 正文访问受限，提交规范和 OGA-BY 说明可访问。按单个素材选定 CC0、CC-BY、OGA-BY 或其他适用条款，保留要求的署名及同许可义务。站点有公开素材规范，当前工业素材的覆盖和一致性未做逐个下载验证。[提交规范](https://opengameart.org/content/art-submission-guidelines) · [OGA-BY FAQ](https://opengameart.org/content/oga-by-30-faq) |

## FossFLOW 格式核查

现有适配目标为 [Abrar74774/FossFLOW v1.0.6](https://github.com/Abrar74774/FossFLOW/releases/tag/v1.0.6)，源码提交 `1f20f2bccb3fb4dfd1dda8779fb0791497e9cc61`。该版本使用主菜单的 **Open** 与 **Export as JSON** 往返原生绘图模型。格式与验收见 [P2 验收记录](../evals/report.md#p2-fossflow-适配验收)。

### V1 调研记录

- 只读检查了本机已有制造业 FossFLOW 微缩验证 JSON。实际顶层包含 `title`、`version`、`description`、`icons`、`colors`、`items`、`views` 和视口拟合字段。自定义 PNG 使用 `data:image/png;base64,…`，图标对象含 `id`、`name`、`url`、`collection`、`isIsometric` 和 `scale`。这份文件可用作未来往返测试的采样输入。
- `items` 的 `icon` 指向图标 ID。按 Isoflow 的组件契约，位置在 `views[].items[].tile`，区域在 `rectangles` 的 `from/to`，连接在 `connectors` 的 `anchors[].ref.item/tile`，标签用节点名、`textBoxes` 或连接标签表达。[位置与连接格式](https://isoflow.io/docs/api/initialData)
- fork 文档将导入逻辑定位到 `IconGrid.tsx`，节点渲染位于 `SceneLayers/Nodes`，投影使用 `useIsoProjection`。源码文件在本次访问中未能完整读取。FossFLOW 本机例证覆盖 PNG 数据 URL，SVG 自定义导入、尺寸、锚点、缩放、遮挡、标签和相邻平台的一致性仍需固定发行版本后在应用中实测。[FossFLOW 源码导读](https://github.com/F4tal1t/FossFLOW/blob/master/FOSSFLOW_ENCYCLOPEDIA.md)
- 后续适配器的验证目标是导入、打开、导出再导入，比较节点 ID、底板和素材锚点、连接、区域、标签和选中状态。案例详情可由外层页面消费相同业务 ID。V1 未生成 FossFLOW JSON。
