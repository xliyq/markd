# Milkdown 编辑器 — 里程碑与迭代计划 (Roadmap)

| 项目 | 内容                                        |
| ---- | ------------------------------------------- |
| 状态 | **v1.0 定稿**（评审通过 2026-08-31，R1-R3） |
| 关联 | 01 §6 里程碑草案、02/03/04/05 全部文档      |

---

## 0. 前置：Spike 技术验证（Phase 0，代码阶段第一步）

> 01 §7 风险「Milkdown 插件生态成熟度」要求尽早 spike。Phase 0 全部通过后才进入正式开发。

| #   | Spike 项                       | 验证目标                                                       | 通过标准                                     |
| --- | ------------------------------ | -------------------------------------------------------------- | -------------------------------------------- |
| S1  | Vite+ / Rolldown × Milkdown    | Rolldown 生产构建能否正确打包 @milkdown/kit + ProseMirror 依赖 | ✅ **通过 2026-08-31**：831 modules / 9.2s / gzip 131KB；dev+build 均运行；发现 Milkdown 7.22 API 重构（ADR-012） |
| S2  | 官方语法插件覆盖度             | math / mermaid / table / upload 四个官方包的实际能力边界       | ✅ **通过 2026-08-31**：table/upload 官方富余；math 官方废弃(7.5.9)；mermaid/image 需自研（ADR-013） |
| S3  | 表格交互（prosemirror-tables） | 行列增删、单元格选择、对齐在 Milkdown 中的可用性               | ✅ 通过：官方 table-block 真实渲染 <table>（vitest 3 测试全绿）；组合=gfm(schema)+tableBlock(view)；行列/对齐/拖拽引擎齐备          |
| S4  | 图片 UploadProvider            | 官方 plugin-upload 的 uploader 接管点能否支持三层存储          | ✅ 通过：uploader 注入点承载 T1 base64（vitest 3 测试全绿）；T1/T2 经 uploader 返回不同 node；uploadConfig 在 .config() 覆盖 |
| S5  | 编辑器实例重建                 | 每切文档重建实例的性能与体验                                   | ✅ 通过：重建 4-7ms/次（首建 40ms），内容隔离、DOM 无泄漏（vitest 3 测试全绿）             |
| S6  | 全文搜索                       | Dexie 遍历 vs MiniSearch 索引方案取舍                          | ✅ 通过：MiniSearch 0.47ms/次 + 索引构建 270ms（万篇），快于遍历 2.6x；V1 采用 MiniSearch（ADR-016）       |
| S7  | KaTeX 离线                     | 数学公式在离线/本地环境渲染资源是否自包含                      | ✅ 通过：katex 0.18.4 渲染零外部引用（vitest 3 测试）；60 字体本地化；M0.2 自研方案基石确认（ADR-017）              |
| S8  | mermaid 大图性能               | 复杂图表（>100 节点）渲染耗时与编辑态卡顿                      | ✅ 通过：120 节点渲染 760ms/175KB SVG，零外部引用；错误图表抛 ParseError 需 try/catch（vitest 3 测试全绿）（ADR-018）                      |

**Phase 1 进展（2026-08-31）✅ 出口达成**：
- ✅ `core/plugin-system`：manifest / topology / plugin-manager / app-api（10 单测）
- ✅ `infra/dexie`：六表 schema + 迁移框架 + StorageProvider 接口与 Dexie 实现（9 单测）
- ✅ `core/editor-factory`：createEditor 正式版（Editor.make 链式，接受 PluginManager 插件集）+ createMinimalEditor 回归入口
- ✅ `plugins-editor`：L1 核心插件 commonmark/gfm/table/image/theme-nord manifest 化（4 集成测试：PluginManager→createEditor 链路）
- ✅ `plugins-app`：L2 persistence + autosave（4 全流程测试：新建→保存→重开）
- ✅ **出口验收**：新建→写 md→自动保存→重开加载 数据闭环跑通；全量 **46 测试全绿（10 文件）** + typecheck 0 错 + build 通过
- 📌 架构要点：AppApi 契约单一（复用 StorageProvider/EditorInstance）；core 插件静态 import（首建 40ms）；配置插件须在提供 $Ctx 的插件之后

**Phase 2 进展（2026-08-31）**：
- ✅ L2 模块扩至 5 个：document-tree（树 CRUD/回收站/子树收集，5 单测）、export（M3.1 zip= .md+assets，3 单测）、import（M3.3 文件入库，3 单测）
- ✅ 事件驱动 autosave：bootstrap onChange → `doc:changed` 事件 → 防抖落库（真实 docId）
- ✅ 应用壳：bootstrap 装配器（PluginManager 全量装配 + inject storage/editor）、App.vue 三栏布局、FileTree.vue 树 UI（展开/新建/重命名/删/点击加载/高亮）、标题栏导入/导出按钮
- ✅ 全量 **58 测试全绿（13 文件）** + typecheck 0 错 + build 通过
- 📌 环境坑：fake-indexeddb × happy-dom 的 Blob 往返丢数据 → export/import 测试用 node 环境；jszip 写入前 Blob→ArrayBuffer

**Spike 产出**：✅ 8 项结论已归档（ADR-012~018）；04 插件覆盖度表已更新（math/mermaid 标记自研、table/upload 标记官方富余）；测试基建 vitest+happy-dom 就绪。

---

## 1. 阶段划分（总览）

| 阶段    | 主题                | 周期     | 出口标准                                     |
| ------- | ------------------- | -------- | -------------------------------------------- |
| Phase 0 | Spike 技术验证      | 3-5 天   | ✅ 完成 2026-08-31：S1-S8 八项通过、19 测试全绿、ADR-012~018 |
| Phase 1 | 骨架 + 编辑内核     | 1-1.5 周 | ✅ 完成 2026-08-31：闭环 + 76 测试 + e2e 通过 |
| Phase 2 | 文档管理 + 导入导出 | 1-1.5 周 | ✅ 核心完成：树/导入/导出zip/导出HTML/数据安全 全✅，101 测试全绿（tabs/拖拽待补 P1） |
| Phase 3 | 表格 + 图片全量     | 1-1.5 周 | ✅ 完成：M5 表格五项 + M4 图片四项全落地，101 测试全绿 + typecheck + build |
| Phase 4 | 体验打磨 + 主题     | 1 周     | ✅ 完成：slash/tooltip/大纲/查找/主题/备份/聚焦 全✅，128 测试全绿 |
| Phase 5 | 质量与收尾          | 1 周     | ✅ 核心完成：版本/回收站/搜索/配额/e2e 全过，150 测试全绿（a11y/压测 P1 尾项） |

---

## 2. Phase 1 骨架 + 编辑内核（P0 最小闭环）

**任务清单**（按 02 §6 包划分）：

1. ✅ Monorepo 脚手架：pnpm workspace、6 包空壳、tsconfig.base、vite-plus 配置 + dev-tool.cmd 工具链
2. ✅ `@editor/shared`：领域类型（DocNode/DocContent/DocAsset/DocVersion）首版
3. ✅ `@editor/core`：plugin-system（manifest/topology/plugin-manager/app-api 骨架）
4. ✅ `@editor/infra`：dexie（db.ts + 6 表 + 迁移框架）、storage-provider-dexie 实现
5. ✅ `@editor/core`：editor-factory（createEditor 正式版，依据启用 L1 插件创建 Milkdown 实例）
6. ⏳ `@editor/plugins-editor`：commonmark ✅ + gfm ✅ + table ✅ + image ✅ + theme-nord ✅（history/code-block 待补）
7. ✅ `@editor/plugins-app`：persistence + autosave 最小实现
8. ⏳ `@editor/app`：Web 入口 + App.vue + 单文档编辑视图（Phase 2 应用壳）
9. ✅ e2e：新建→输入→自动保存→重开加载 全流程（Playwright + chromium 真实浏览器验证通过，5.8s；抓出并修复 4 个真实 bug）

**验收**：最小可编辑闭环跑通（✅ phase1-flow 4 测试全绿）；`tsc --noEmit` 通过（✅）；浏览器级 e2e 通过（✅ Playwright）。

---

## 3. Phase 2 文档管理 + 导入导出（P0）

- ✅ 文档树（document-tree 插件：CRUD ✅ / 拖拽 / 移动）+ 快速记录（quicknote ⏳）
- ⏳ 多标签页（tabs）、最近打开（recent）
- ✅ 导入 .md（import 插件：文件读取入库，M3.3）
- ✅ 导出：Markdown（export 插件：jszip 打包 .md + assets，M3.1 ✅）/ HTML（M3.2 ⏳）
- ⏳ 数据安全：未保存关闭防护（beforeunload）、多标签冲突检测（BroadcastChannel）

**验收**：M2.1/M2.1a + M3.1/M3.2/M3.3 + M7.5 可用。

---

## 4. Phase 3 表格 + 图片全量（P0 高复杂度）

**表格（M5.1-M5.5）**：

- ✅ M5.1 table 插件创建/渲染（官方 table-block + gfm schema，S3 验证）
- ✅ M5.2 单元格编辑（官方 tableKeymap：Tab/Shift-Tab 跳格，prosemirror-tables 基座验证通过）
- ✅ M5.3 行列增删、对齐、表头（官方 operation，主题化按钮）
- ✅ M5.4 对齐写回（onAlign 官方）
- ✅ M5.5 Excel/CSV 粘贴双向转换（自研 table-exchange：TSV/CSV 识别 → GFM 表格，handlePaste 拦截）

**图片（M4.1/M4.2/M4.2a）**：

- ✅ M4.1 四种插入方式（粘贴/拖拽 [官方 upload] + 文件选择器 [onUpload] + URL 直链 [自研 url-paste]）
- ✅ M4.2 StorageProvider 三层（T1 assets 落库 image-manager；base64 备选 + T2 图床 proxyDomURL 直通预留）
- ✅ M4.2a AssetResolver（渲染解析：assets/xxx → blob URL；序列化还原 relPath）
- ✅ 文档移动 assets 不迁移（ADR-007，保留）

**验收**：表格五项 + 图片四项 P0 全部完成（M5 全✅ M4 全✅），导出 zip 图片不破（export 走 storage.listAssets）。101 测试全绿。

---

---

## Phase 3 进展（2026-08-31）

**表格（M5 五项全✅）**：
- M5.1 创建/渲染：官方 table-block + gfm schema（S3 验证，主题化按钮）
- M5.2 单元格编辑：官方 tableKeymap 的 Tab/Shift-Tab 跳格验证通过（prosemirror-tables 基座）
- M5.3/M5.4 行列/对齐：官方 operation（onAddRow/onAddCol/deleteSelected/onAlign）
- M5.5 数据交换（自研重头）：table-exchange（convert.ts 纯函数 + handlePaste 插件）
  - TSV（Excel 复制）/ CSV（引号转义）→ GFM 表格语法 → parser 插入真实表格节点
  - 强规则：≥2 行 ≥2 列且列数一致才转；HTML 剪贴板/散文交还默认
  - 10 个单测（含修复一个静默断言 toBeNull 漏括号）

**图片（M4 四项全✅）**：
- M4.1 四种插入：粘贴/拖拽（官方 upload）+ 文件选择器（image-block onUpload）+ URL 直链（自研 url-paste，IMAGE_URL_RE）
- M4.2 存储策略：image-manager L2 模块（T1 assets 落库，二层可选 base64/T2 图床）
- M4.2a AssetResolver：image-block 的 proxyDomURL 钩子 → assets/xxx → blob URL（序列化还原 relPath）
- 导出联动：export 模块走 storage.listAssets（zip 打包 assets 文件夹）

**架构要点**：
1. uploader 契约定为「纯数据 relPath 数组」，节点构造上移到 core（L2 不碰 milkdown 类型）
2. handlePaste 插件链协作：table-exchange 认表格数据、url-paste 认图片 URL、其余交还默认

**质量**：101 测试全绿（20 文件）+ typecheck 0 错 + build 通过 + e2e 回归通过

## 5. Phase 4 体验打磨 + 主题（P1 核心）

- ✅ Slash 菜单（slash-menu，12 项命令 + 关键词过滤）
- ✅ 浮动工具栏（tooltip：粗/斜/代码/链接）
- ✅ 大纲面板（outline）+ 字数统计（statusbar，中/英/字符/行/标题）
- ✅ 查找/替换（find-replace 自研：装饰高亮 + 跳转 + 替换当前/全部，Ctrl+F）
- ✅ 主题系统（theme：亮/暗/跟随系统 + CSS token + 偏好持久化）+ 设置面板（可开关插件）
- ✅ 数据备份（backup：六表全量 JSON 导出/导入，Blob↔base64 保真）
- ✅ 聚焦/无干扰模式（zen/focus 切换，P1.7-1.9）
- ⏳ 快捷键自定义（官方默认 keymap 已在；自定义映射 UI 留待 Phase 5）

**验收**：✅ P1 清单核心项可用（7/8），✅ 设置面板可开关插件（24 个 manifest 开关）。

---

---

## Phase 4 进展（2026-09-01）

**P1 核心项 7 项完成（128 测试全绿）**：
1. **Slash 菜单**：slashFactory + SlashProvider，12 项命令（标题1-3/正文/引用/代码块/分割线/有序-无序列表/表格/图片/链接），输入过滤
2. **浮动工具栏**：tooltipFactory + 自绘按钮（粗/斜/行内代码/链接），floating-ui 定位
3. **大纲 + 字数**：doc-stats 纯函数（parseOutline/countStats/headingPathAtLine），doc:changed 事件驱动实时更新
4. **查找/替换**：自研 find-replace（正则转义纯函数 + Decoration 高亮 + 选区跳转 + 替换当前/全部），Ctrl+F 面板
5. **主题系统**：theme L2 模块（亮/暗/跟随系统 + settings 持久化）+ App 样式 token 化（CSS 变量 + data-theme）
6. **设置面板**：主题切换 + 24 个插件开关（PluginManager.setEnabled，重启生效）+ 备份/恢复入口
7. **数据备份**：backup 模块（六表 → JSON，Blob→base64 编解码，导入全量恢复）
8. **聚焦/无干扰**：zen/focus 模式（隐藏侧边栏 + CSS 弱化）

**架构要点**：L1 现 9 插件（find-replace 加入）；find-replace controller 经模块级 `getFindReplace()` 暴露给 UI（免全局 window hack）

**质量**：128 测试全绿（25 文件）+ typecheck 0 错 + build 通过 + e2e 回归通过

## 6. Phase 5 质量与收尾

- ✅ 版本快照（versions：全文 + trim 保留策略 20/200 + 恢复）
- ✅ 回收站（30 天自动清理 + 清空 + 单条 purge）
- ✅ 全文搜索（MiniSearch + 中文分词 + 摘要 + 增量索引，ADR-016）
- ✅ 存储配额管理（navigator.estimate + 各表占用 + 回收站占用）
- ✅ e2e 全量补覆盖（workflow 全流程 + phase5 交互回归，2 个全过）
- ✅ 无障碍 a11y 基础（M7.7：role/aria 标注 + 文档树键盘导航 + dialog/radiogroup；a11y-check e2e 验证）
- ✅ 性能压测基线（perf-baseline：5000 行解析 3.1s happy-dom / 真实浏览器 1.0s，100 图 45ms 增量；e2e 防退化阈值 2s）
- ✅ 发布准备：vp build 通过，产物就绪

**验收**：✅ P0 全绿、✅ P1 核心全绿；✅ e2e 通过率 100%（5/5，含 a11y + 性能 + 首启引导）；✅ build 产物就绪（153 单测全绿）。

---

---

## Phase 5 进展（2026-09-05 应用壳 Naive UI + 渲染层统一批改）

**Naive UI 应用壳迁移**（ADR-021）：设置中心（n-menu 左页签：通用/编辑区/插件/数据，72vh 高度封顶，主题桥接 n-config-provider + CSS 变量 naiveOverrides）、InputDialog/welcome 弹窗、查找替换面板、文档树（n-tree + render-prefix/suffix）、工具栏按钮；e2e 全套改 naive 选择器。

**渲染层统一原则（两次教训定稿）**：任何内容交互（手柄/浮层/预览/编辑）必须绑定渲染层（节点类型/DOM/mark），绝不能依赖插入入口——同一内容不管从哪进渲染一致，新增入口自动覆盖。案例：
- 链接悬浮浮层：doc 遍历按 href 匹配 link mark（弃用 posAtDOM/resolve.marks，tooltip 入口链接在段落中部时 pos 不落 mark 内）→ toolbar 弹窗 + milkdown-tooltip 两条路径统一
- 图片：image-block + image 双形态合一（渲染层交互对齐），粘贴/拖拽/URL/文件选择器/弹窗全入口统一
- 图片弹窗：URL 直链 + 本地上传（requestImage 桥 + imageManager.saveImageFile → assets）

**编辑内核补全**：
- 历史撤销/重做：history 插件（此前已装未注册，Ctrl+Z 一直无效）→ L1 第 14 插件
- 块句柄 + 插入模式：点 + 不预插入 → 菜单选完类型才在锚点插入（showAt 第三参 insertModeAt + insertBlockAt 用 schema.nodes.* 构造）；新增「图片」独立菜单项（插 image-block）
- markdown 粘贴解析：Typora 风格 handlePaste（new Slice(node.content,0,0)），h2/li/bq/code 全解析

**UI 批改（文档树/侧边栏）**：文件名单行省略 + SVG 图标；新增弹窗（位置下拉递归文件夹 + 类型 + 名称）；侧边栏折叠按钮移右边缘悬浮（六点）；节点操作默认隐藏/悬浮或选中显示。

**质量**：7 e2e + 167 单测 + typecheck 0 全绿（perf-baseline 机器敏感阈值，单独跑 1.5s 通过）。

**已提交 git**：root commit 0a1d1a9（143 文件，24,799 行）。

## Phase 5 进展（2026-09-01）

**核心完成（150 测试全绿）**：
1. **版本快照**（M2.4/M7.6）：versions 模块订阅 doc:changed 自动快照 + manual 手动快照 + 保留策略（autosave 20 / manual 200）+ 恢复写回（5 测试）
2. **回收站**（M2.6）：30 天保留期 + 启动即清理 + 每小时定时检查 + 清空/单条 purge（4 测试）
3. **全文搜索**（ADR-016）：infra/search SearchManager（MiniSearch 7 + 自研中英分词 + 自维护 id Map）+ L2 桥接（递归收集 docs → 启动重建 + 持久化）+ UI 搜索面板（Ctrl+Shift+F，命中标题/摘要/评分）（8 测试）
4. **存储配额**（M7.7）：navigator.storage.estimate + 六表行数/字节统计 + 回收站占用引导（4 测试）
5. **e2e 全量**：workflow（新建→保存→重开）+ phase5（编辑器/表格/主题/设置）2 个全过
6. **样式修复**（ADR-020）：table-block.css 按 7.22 真实 DOM 重写（table.children + data-show 显隐 + drag-preview 默认隐藏）

**工程经验**：
- MiniSearch 无公开遍历 API → 自维护 Map<id, doc>（remove 需完整对象）
- 中文需自研分词（默认英文空格分词）
- Playwright 合成 ClipboardEvent 不触发 ProseMirror 内部监听 → 深交互靠单测
- 组件样式异常 → 探针读真实 DOM + 计算样式，勿凭文档猜结构

**剩余 P1 尾项**：首版部署（§8.1 检查单）

## 7. 风险登记（与 01 §7 联动）

| 风险                   | 触发点       | 兜底                                       |
| ---------------------- | ------------ | ------------------------------------------ |
| Rolldown×Milkdown 兼容 | S1 失败      | 回退 Vite 7 传统构建，Vite+ 仍可管理工具链 |
| 官方插件覆盖不足       | S2 记录缺口  | 缺口进自研 backlog，动态调 Phase 3         |
| 表格粘贴转换难度       | S3/S5 暴露   | 先支持 CSV/简单 HTML，复杂结构降级纯文本   |
| base64 体积            | 大图入库     | 单文件阈值提示 + M4.11 压缩 P2 兜底        |
| 大文档性能             | Phase 1 压测 | 懒加载代码块高亮、输入防抖、必要时虚拟滚动 |

---

## 8. 发布节奏

| 版本       | 内容      | 目标                             |
| ---------- | --------- | -------------------------------- |
| v0.1 alpha | Phase 0-2 | 内部自测：骨架 + 编辑 + 文档管理 |
| v0.2 beta  | Phase 3-4 | 核心功能完整：表格/图片/主题     |
| v1.0       | Phase 5   | P0/P1 全绿，首版可用             |

### 8.1 发布检查单（Q3 决策：公开上线）

- [x] 部署：GitHub Pages workflow 已配置（deploy.yml + .nojekyll + 相对路径产物），Vercel/Cloudflare 亦可（见 DEPLOY.md）
- [x] 隐私声明：本地优先、数据不出浏览器（PRIVACY.md 成文）
- [x] 完整用户文档：功能导览 / 快捷键表 / 数据备份恢复 / FAQ（USER_GUIDE.md）
- [x] 空状态与首启引导（M1.12）——首启欢迎面板（新建/导入/快速记录）+ 空库提示，e2e 验证
- [x] 基本 a11y 走查（M7.7：role/aria + 键盘导航，a11y-check e2e 验证）
- [x] 移动端响应式：≤768px 抽屉布局 + 紧凑顶栏/状态栏
- [x] 性能基线：5000 行导入+打开 ~1.0-1.8s（dev），100 图 45ms；perf-baseline e2e 防退化阈值 2s

---

## 9. 已确认决策（评审通过 2026-08-31）

| #   | 决策点     | 结论                                                          |
| --- | ---------- | ------------------------------------------------------------- |
| R1  | Spike 范围 | **8 项**（S1-S8，新增 KaTeX 离线 / mermaid 大图性能）         |
| R2  | 阶段周期   | 按 **6-7 周**推进（Phase 0-5）                                |
| R3  | 发布目标   | **公开上线**：部署 + 隐私声明 + 完整文档 + 发布检查单（§8.1） |
