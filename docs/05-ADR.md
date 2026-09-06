# Milkdown 编辑器 — 架构决策记录 (ADR)

| 项目 | 内容                                                               |
| ---- | ------------------------------------------------------------------ |
| 状态 | v0.1 草稿（随项目演进持续追加）                                    |
| 规则 | 每条 ADR 是「上下文 + 决策 + 后果」三段式；新建 ADR 从最大编号继续 |

---

## ADR-001 编辑器内核采用 @milkdown/kit 而非 crepe

- **日期**：2026-08-31
- **状态**：已接受
- **上下文**：需要类 Typora 的 WYSIWYG Markdown 编辑器，UI 需完全自研贴合产品气质。选择范围：`@milkdown/crepe`（成品壳）vs `@milkdown/kit`（裸插件链路）。
- **决策**：采用 `@milkdown/kit`，自组装语法/UI/行为插件。
- **后果**：+ 完全掌控 UI 与插件组合；+ 与「一切皆插件」哲学一致；− 配置成本高、需自行验证各能力域官方包的覆盖程度。

## ADR-002 文档以 Markdown 原文存储（非 ProseMirror JSON）

- **日期**：2026-08-31
- **状态**：已接受
- **上下文**：编辑态内部是 ProseMirror 文档，落盘格式需要决策。
- **决策**：Markdown 原文 + 元数据为唯一事实源；ProseMirror JSON 仅运行时态。
- **后果**：+ 用户数据可移植、可 diff、可进 Git；+ 与 remark 序列化链路天然配套；− 复杂语法（如内嵌 HTML）序列化往返需保证保真，需 e2e 覆盖。

## ADR-003 存储采用 Dexie(IndexedDB) 本地优先

- **日期**：2026-08-31
- **状态**：已接受
- **上下文**：产品定位本地优先、离线可用、不强制登录。
- **决策**：Dexie 封装 IndexedDB 为唯一事实源；StorageProvider 接口抽象，云同步/桌面化为可替换实现（后续 ADR）。
- **后果**：+ 零后端、离线完整可用；+ StorageProvider 使同步/Tauri 无侵入；− 纯 Web 无法写真实磁盘（Tauri 前 assets 为 IDB 虚拟目录）。

## ADR-004 一切皆插件：L1(编辑器内)/L2(应用层) 双层模型

- **日期**：2026-08-31
- **状态**：已接受
- **上下文**：产品原则「可插拔、可扩展、可开关」。Milkdown 插件体系只服务编辑器内，应用层能力不能硬塞。
- **决策**：L1 = MilkdownPlugin（语法/行为/编辑态 UI），L2 = AppModule（文档树/持久化/导出等），统一 manifest 契约 + PluginManager 管理；core 层不可关。
- **后果**：+ 功能可插拔/可扩展/可开关；+ 可测可降级；− 需依赖排序（dependsOn + 拓扑校验）与配置聚合，复杂度前置。

## ADR-005 L2 模块禁止直接 import milkdown

- **日期**：2026-08-31
- **状态**：已接受
- **上下文**：若 L2 应用模块直接依赖编辑器内核内部，内核升级/替换将波及全部应用层。
- **决策**：L2 只经 AppApi 访问能力；core 定义接口，infra 实现。
- **后果**：+ 应用层与内核解耦，可替换内核/桌面化退路清晰；− 能力访问需先定义 AppApi 契约，前期设计成本略增。

## ADR-006 图片存储三层策略（T1 assets 相对路径 / base64 / T2 图床）

- **日期**：2026-08-31
- **状态**：已接受
- **上下文**：图片存储牵动导出、备份、同步。最初方案 base64 默认（体积暴增是硬伤）。
- **决策**：T1 未配图床 → 图片入文档 assets 目录、Markdown 引用相对路径（默认）或 base64；T2 配图床 → 上传远程 URL。StorageProvider 抽象，实现可换。
- **后果**：+ 文档+assets 可整目录进 Git 仓库；+ 图床可配置升级；− 需 AssetResolver 解析相对路径（渲染/序列化/导出三方向），新增核心管道。

## ADR-007 文档移动无需迁移 assets（修正早期方案）

- **日期**：2026-08-31
- **状态**：已接受（修正）
- **上下文**：早期风险表曾假设「文档移动需同步迁移 assets」。设计 03 §7.5 时发现：IDB 虚拟目录下 assets 按 docId 归属、relPath 为相对路径，移动仅改 files.parentId。
- **决策**：文档移动 = files.moveNode 单步操作，无需 assets 迁移；仅 Tauri 真实目录模型（未来）需按文件夹物理移动。
- **后果**：删除了一个不必要的跨表事务复杂度；01 风险表已同步修正。

## ADR-008 代码高亮采用 Shiki

- **日期**：2026-08-31
- **状态**：已接受
- **上下文**：M0.4 代码块需要语法高亮引擎。
- **决策**：Shiki（VS Code 同款渲染引擎），按需懒加载语言/主题。
- **后果**：+ 视觉顶配、语言覆盖广；− 包体积较大（懒加载缓解）。

## ADR-009 工具链采用 Vite+（vp CLI）

- **日期**：2026-08-31
- **状态**：已接受
- **上下文**：需要统一 dev/build/lint/fmt/test 工作流。
- **决策**：Vite+（VoidZero 统一工具链）：dev/build 用 Vite 8 + Rolldown，质量门禁 vp check；e2e 用 Playwright（独立）。
- **后果**：+ 单 CLI 收敛工具链、一致工作流；− Vite+ 较新需观察生态，Oxfmt/Oxlint 与 Prettier/ESLint 非逐字节兼容，Vite8 体积更大；Rolldown×Milkdown 兼容性进 spike。

## ADR-010 Monorepo：pnpm workspace 轻度结构

- **日期**：2026-08-31
- **状态**：已接受
- **上下文**：插件化理念需要包级边界；每个插件独立包的全量 Monorepo 对单人初期过重。
- **决策**：apps/editor + packages/{core, plugins-editor, plugins-app, infra, shared} 六个包；apps/desktop 仅占位（V1 不建 Tauri 工程）。
- **后果**：+ 依赖面隔离（L1 依赖 milkdown、L2 依赖 vue/shared）、加载边界清晰、呼应第三方插件预留；− apps 与 packages 的包间依赖需遵守单向规则。

## ADR-011 数据模型：文档树/内容分表 + 全文版本快照

- **日期**：2026-08-31
- **状态**：已接受
- **上下文**：03 开放问题评审。
- **决策**：files（轻量节点）与 docs（内容）分表；版本快照 V1 存全文、上限控制（自动 20/手动 200）；资产单一 tier；回收站 30 天；schema 版本存独立 meta 表。
- **后果**：+ 树遍历不背内容（大目录性能）；+ 全文快照简单可靠；− 快照体积受上限约束，diff 留作后续优化。

## ADR-012 Milkdown 7.22 API 重构：createEditor() → Editor.make() 链式

- **日期**：2026-08-31（S1 spike 发现）
- **状态**：已接受
- **上下文**：S1 验证 Rolldown×Milkdown 时，`vp build` 报 `createEditor is not exported`。深挖发现官方已将初始化 API 从 `createEditor({root, defaultValue, plugins})` 函数重构为 `Editor.make()` 链式：`.config(ctx => ctx.set(rootCtx, ...)/ctx.set(defaultValueCtx, ...)).use([...plugins]).create()`。旧文档/示例全部过时。
- **决策**：采用 7.22 新 API；`nord` 主题 `(ctx)=>void` 需包 MilkdownPlugin 适配器（返回 CtxRunner）；`listener()` 用链式 `.markdownUpdated()`。
- **后果**：+ 类型更清晰、链式装配更贴近插件模型；− 网上的旧教程/示例不可直接照搬，需以安装版本的类型声明为准；kit 为纯 re-export 聚合层，构建报错需向底层包（@milkdown/core 等）排查。

## ADR-013 官方插件覆盖度结论（S2）：table/upload 官方富余，math 废弃、mermaid/image 需自研

- **日期**：2026-08-31（S2 spike）
- **状态**：已接受
- **上下文**：验证 math/mermaid/table/upload 四个官方包的实际能力边界（04 插件清单的「开箱即用/需自研」判定）。
- **决策**：
  - **table**：采用官方 `components/table-block`——已含行列增删（useOperation）、对齐（onAlign）、悬停手柄+拖拽引擎（dnd/）、Vue DefineComponent；仅需主题化 renderButton + M5.5 数据交换自研。
  - **upload**：采用官方 `plugin-upload`——提供 uploader 注入点（files→Fragment/Node）+ `readImageAsBase64` 默认实现，正是 M4.2 三层存储的骨架。
  - **math**：官方 `plugin-math@7.5.9` **已被 npm 标记废弃**（"Package no longer supported"）且依赖 utils@7.5.9 与 kit@7.22 不兼容（tsc 类型错位）→ 不采用，数学能力自研（remark-math + KaTeX 直接集成）或等官方新方案。
  - **mermaid**：无任何官方插件 → 完全自研（fenced code 语言识别 + mermaid 渲染 + 只读交互）。
  - **image 独立插件**：不存在 → 基于 plugin-upload 自研。
- **后果**：+ table/upload 大幅减负（原计划"UI 自研"被证伪，官方能力远超预期）；− math/mermaid 进入自研 backlog，Phase 3 排期需计入；04 插件清单 defaultEnabled 相应调整（math/mermaid 默认关）。

## ADR-014 S3/S4 实测结论：table-block 组合方式 + uploader 注入点承载三层存储

- **日期**：2026-08-31（S3/S4 spike）
- **状态**：已接受
- **上下文**：验证表格交互真实可用性、图片上传注入点能否承载三层存储。
- **决策**：
  - **表格组合**：必须 `gfm`（提供 table schema，位于 preset-gfm/node/table）+ `tableBlock`（提供 NodeView 渲染，位于 components/table-block）一起加载，缺一报 `Missing node in schema`。`tableBlockConfig` 是 $Ctx，经 `.key` 访问并在 `.config()` 回调覆盖 renderButton。
  - **图片上传**：官方 `plugin-upload` 的 `uploader(files, schema, ctx, insertPos)` 注入点是三层存储的唯一挂载点——T1 返回 base64 image node、T2 返回远程 URL node；`uploadConfig` 在 `.config()` 回调覆盖（upload 插件 use 后才注入该 ctx）。
- **后果**：+ 表格/图片无需自研事件拦截，官方能力直接复用；+ 测试基建（vitest+happy-dom）验证可行，单测层替代 Playwright 高频场景；− Milkdown 7.22 的 $Ctx/子路径/FileList 等细节需以类型声明为准。

## ADR-015 编辑器实例重建模式确认（S5）：切换文档 = 重建实例

- **日期**：2026-08-31（S5 spike）
- **状态**：已接受
- **上下文**：02 §4.1 规划「每切文档重建编辑器实例」。需验证性能与正确性。
- **决策**：确认重建模式。实测：首个实例 40ms（模块初始化），后续每次 4-7ms；内容隔离验证通过；destroy 后 DOM 无泄漏。
- **后果**：+ 生命周期简单可靠，无需热切换状态迁移；+ 各文档独立实例天然隔离；− 首次切换需短暂等待（<50ms 可接受），Phase 1 编辑器生命周期按「创建→使用→销毁」单链实现。

## ADR-016 全文搜索采用 MiniSearch（S6）：万篇级 0.47ms/次，优于 Dexie 遍历

- **日期**：2026-08-31（S6 spike）
- **状态**：已接受
- **上下文**：03-open 问题「全文搜索索引策略」——Dexie 遍历 vs 词法索引。
- **决策**：V1 采用 **MiniSearch**（infra/search 实现）。实测 10000 篇：索引构建 270ms（一次性）、检索 0.47ms/次、公平对比快于全扫遍历 2.6 倍；且具备模糊/前缀/分词能力。索引序列化存 IndexedDB，随文档变更增量更新。
- **后果**：+ 检索质量与性能稳定，随规模放大不线性劣化；− 需维护索引一致性（文档 CRUD 时增量更新 + 启动时校验），V1 实现注意脏标记。

## ADR-017 KaTeX 离线渲染确认（S7）：数学公式自研方案基石

- **日期**：2026-08-31（S7 spike）
- **状态**：已接受
- **上下文**：S2 结论 math 官方插件废弃，数学能力需自研。验证 KaTeX 能否离线工作。
- **决策**：采用 KaTeX 0.18+ 自研 math 插件（remark-math 解析 + KaTeX 渲染）。实测：渲染产物零外部 URL 引用；60 个字体（woff2/woff/ttf）随包本地化；错误表达式安全。
- **后果**：+ 完全离线可用（契合本地优先）；+ 与 M0.2 数学公式需求吻合；− 需自研 Milkdown math schema/NodeView（挂 plugins-editor），Phase 3 排期计入。

## ADR-018 mermaid 大图性能确认（S8）：自研方案可行性

- **日期**：2026-08-31（S8 spike）
- **状态**：已接受
- **上下文**：S2 结论 mermaid 无官方插件需自研。验证大图渲染性能与离线能力。
- **决策**：采用 mermaid 11.x 自研图表插件（fenced code 语言识别 + 渲染 + 只读交互）。实测：120 节点流程图渲染 760ms、SVG 175KB、产物零外部引用（离线可用）。
- **后果**：+ 性能可接受、完全离线；− 语法错误会抛 ParseError，NodeView 渲染必须 try/catch 降级（显示错误提示而非崩溃）；mermaid 包较大（~100+ 传递依赖），懒加载进 plugins-editor。
- **S8 结项后 Phase 0 全部完成**：S1-S8 八项 spike 全部验证通过，见 06-roadmap。

---

## 追加规则

- 新 ADR 编号：ADR-012 起
- 每条 ADR 变更状态：已接受 / 已修正 / 已废弃（废弃须指明代替它的 ADR）
- ADR 是 01 §8 决策账本的**深层档案**：账本记录「决定了什么」，ADR 记录「为什么这么决定」

## ADR-019 table-block 组件样式与官方主题版本错位（2026-08-31）

**状态**：已解决（自备样式兜底）

**背景**：编辑器上线自测发现表格「功能正常但视觉裸奔」——边框/表头背景/拖拽手柄全无样式。

**根因**：Milkdown 7.22 的表格由 `@milkdown/components/table-block` **Vue NodeView** 渲染，
类名体系为 `milkdown-table-block` / `table-wrapper` / `col-drag-handle` / `row-drag-handle` 等；
而官方主题 `@milkdown/theme-nord@7.22.1` 仍只带**旧版 prosemirror-tables** 的样式
（`.tableWrapper` / `table` 等），两者类名完全不匹配 → 主题对表格 0 覆盖。

**连带发现**：同因的「样式裸奔」事故难以被单测捕获（功能断言全绿、视觉失联）。

**决策**：
1. 自备 `apps/editor/src/table-block.css`（2.3 kB），按组件真实类名补齐全部样式
（容器/边框/表头/选中态/拖拽手柄/拖拽线/预览浮层），并在 `main.ts` 引入。
2. 建立「样式回归测试」`apps/editor/src/__tests__/styles.spec.ts`（7 断言）：
   - 主题 CSS 大小基线 ≥8 kB + 关键排版类存在
   - table-block 组件类名全覆盖（容器/单元格/拖拽手柄）
   - 升级 milkdown 或改动样式若导致丢失/错位 → 测试立即失败。
3. vitest include 扩至 `apps/**`（此前只收 `packages/**`）。

**影响**：表格样式完整（边框/表头/选中高亮/拖拽交互）；后续 milkdown 大版本升级
需复验此 ADR（新版本主题可能补齐，届时可移除兜底样式）。

## ADR-020 table-block 样式选择器须对齐 7.22 真实 DOM（2026-09-01）

**状态**：已解决（按真实 DOM 重写）

**背景**：用户反馈表格「效果差」。此前已引入 `table-block.css`（ADR-019），
但渲染仍异常——表格塌陷（height: 0）、拖拽预览层空表可见、主体无边框。

**根因**：手写 CSS 时按旧版 Milkdown 文档/经验猜的 DOM 结构，与实际 7.22 渲染不符。
用 Playwright 探针（`page.evaluate` + `getComputedStyle` + `outerHTML` dump）拿到真实结构：

```
.milkdown-table-block
  ├── [data-role="col-drag-handle"] / [data-role="row-drag-handle"]  （data-show 控制显隐）
  ├── .table-wrapper
  │   ├── .drag-preview                   拖拽预览，默认 data-show=false 应隐藏
  │   ├── [data-role="x/y-line-drag-handle"]  ＋行/＋列
  │   └── table.children                  真实表格主体（此前漏写样式！）
  │       └── tbody.content-dom > tr[data-is-header] > th / td
```

**关键错误**：
1. 漏写 `table.children` 规则 → 真实表格零边框/零 padding（全靠 nord 稀疏规则）
2. 给 `.drag-preview` 写了可见样式（白底+阴影+display:table）→ 把隐藏预览层显示成空表（height:2 的怪元素）
3. 手柄显隐用 `[data-show]` 控制，之前用 hover 猜测不匹配

**决策**：
1. 按真实 DOM 重写 `table-block.css`（4.1 kB）：`table.children th/td` 边框 padding、
`[data-role]` 手柄 data-show 显隐、`.drag-preview` 默认隐藏
2. 更新样式回归测试断言为真实选择器（`table.children`、`data-show="true"`）
3. 排查方法论沉淀：**组件样式异常时用 Playwright 读真实 DOM + 计算样式，勿凭文档猜结构**

**影响**：表格恢复正常（th 边框/表头背景/padding 验证通过，height 0→103）。
后续升级 Milkdown 大版本需复验（组件 DOM 结构可能再次变化）。



## ADR-021 应用壳引入 Naive UI（主题桥接方案，2026-09-05）

**状态**：已采纳（设置弹窗已落地，其余应用壳组件按队列迁移中）

**背景**：01 §5「应用层 UI」与 02 技术栈表均约定「自绘为主 + Naive UI 补充：侧边栏/菜单/弹窗用 Naive UI 提效」。
但实现长期未安装 naive-ui，侧边栏/设置弹窗/菜单/查找/首启引导全为手写原生 HTML，且无任何 ADR 记录偏离 → 文档与实现背离。
用户拍板：尽可能使用 Naive UI。

**适用范围边界**（关键）：
- 迁移对象 = 应用壳（apps/editor 的 UI 层）：侧边栏、菜单、弹窗、设置、查找/替换、全文搜索、首启引导、大纲、工具栏、copy-toast、InputDialog。
- 不迁移 = 编辑器区（Milkdown UI：表格 block / tooltip / slash / 代码块 / 块句柄），保持自绘 + 官方主题变量，属 PRD「编辑器区全自绘」铁律。

**主题桥接**（技术关键）：
- App 根部包 `<n-config-provider :theme="darkTheme|null" :theme-overrides>`；`naiveTheme` 由 `themeMode`（light/dark/system）计算，system 走 `matchMedia(prefers-color-scheme)`。
- `naiveOverrides` 从 `data-theme` 落盘的 CSS 变量派生（--accent/--text/--border/--bg/--bg-soft），使 Naive 主色跟随应用 accent。
- ⚠️ 防坑：`getComputedStyle` 读 DOM 计算样式**非 Vue 响应式**——naiveOverrides computed 体内必须引用 `themeMode.value` 作响应式依赖，否则切主题不重算、primary 停在亮色值。

**初始迁移**（2026-09-05）：设置弹窗 `settings-overlay`（手写）→ `<n-modal preset="card">` + `<n-radio-button>`（主题）+ `<n-switch>`（25 插件开关）+ `<n-button>`（备份）。
Playwright 探针验证：n-modal=1、3 radio、25 switch(全 active)、切暗色后 radio checked 背景=暗 accent(#60a5fa)、toggle 开关状态栏更新、零 console/pageerror；typecheck 0 错。

**后果**：
- + 弹窗 Esc/遮罩点击/动画/无障碍由 Naive 内置；主题与自研 CSS 变量体系对齐
- − 新增依赖（naive-ui 及传递包）；naive 组件主题色需随 data-theme 桥接维护
- 待办队列：FileTree→n-tree（须验证 a11y role 保留）、InputDialog→n-modal、查找/全文搜索/首启引导/大纲→对应 Naive 组件、工具栏→n-button/n-dropdown、copy-toast→n-message

**2026-09-05 扩大迁移（均经 Playwright 探针验证，typecheck 0 错）**：
- 首启欢迎引导 → `n-modal`（新建/导入/快速记录/跳过）；InputDialog → `n-modal`+`n-input`+`n-button`（危险按钮 type=error）
- 查找/替换、全文搜索面板 → 保留浮动容器，内部控件升级 `n-input`/`n-button`；`onFindInput`/`onSearchInput` 无参读 ref，
  用显式 `:value` + `@update:value` 包方法写回再调用，避免依赖 v-model/同名事件执行序
- ⚠️ 防坑：**模板用了某 naive 组件但漏 import（如 `n-input` 未 import NInput），Vue 不做任何报错，直接原样输出为未知元素**——
  面板里出现裸 `<n-input>`、`.n-input` 计数为 0，排查极难。新增 naive 组件必须同步 import。

**2026-09-05 FileTree → n-tree（a11y 保真迁移，e2e 全绿）**：
- 树渲染换 `n-tree`；`node-props` 注入 role=treeitem/tabindex=0/aria-expanded/aria-selected；**naive 内置键盘关掉（:keyboard=false）**，
  树容器自管 keydown（Enter/Space 打开、Arrow/Home/End 移动焦点，焦点始终在 treeitem 上）。
- ⚠️ 防坑：naive `keyboard=true` 时 Enter 被内置键盘处理截掉，节点级 onKeydown 不触发；**nodeProps 不透传 data-* 属性**
  （data-key/data-node-id 都不渲染）→ 容器 keydown 用「DOM treeitem 顺序 = 树先序遍历」索引匹配 option。
- ⚠️ 焦点坑（toolbar e2e 稳定红）：**naive n-button 点击会把焦点抢走**，后续 Enter 被按钮消费（触发再次 click），
  编辑器换行丢失、文本拼接、wrapIn 对 heading 失败。`@mousedown.prevent`/`@mousedown.capture.prevent` 都拦不住
  （naive 内部 handler 抢先）。修复：`onToolbar` 命令前后调 `focusEditor()`（.ProseMirror.focus()）——焦点还给编辑器。
- e2e 全面适配 naive 选择器：欢迎跳过 `.n-modal button 跳过`、InputDialog `.n-modal .n-input input`、
  欢迎流程确认按钮是「创建」（App.vue welcome InputDialog confirm-text）而 FileTree 的是「确定」、树断言 `[role="treeitem"]`。
- ⚠️ 双 modal 并存：欢迎 + InputDialog 同时开时后者 footer 会拦截前者按钮点击；e2e 用 n-input 锚定 InputDialog。

**2026-09-05 naive 主题初始暗色修复（system 模式）**：
- 症状：系统为暗色、应用初始为暗（themeMode=system）时，naive 组件用亮色 token（primary 蓝 / modal 白）。
- 根因一：`naiveOverrides` computed 只依赖 `themeMode.value`——system 下恒为 "system" 永不重算；
  且 theme 模块 `init()` 是异步的（mount 时 void 触发），首次求值早于 `data-theme` 应用 → 停在亮色值。
- 根因二（连带）：App mounted 里在 theme.init 完成前读 `getMode()` → 拿到初始 'light' → 设置面板 radio 错误显示「亮色」。
- 修复：① App 用 MutationObserver 跟踪 `html[data-theme]`（resolvedDark ref），naiveTheme 与 naiveOverrides 都依赖它，
  **不再依赖 themeMode**——任何时序（异步 init、system 系统切换）都跟随；② theme 模块 init 幂等化（共享 promise），
  App 在 bootstrap 后 `await t.init()` 再读 getMode，radio 正确显示「跟随系统」。
- 验证：playwright `colorScheme: dark/light`（模拟系统偏好）→ 初始暗 modal bg=#1a1a1a、radio checked=跟随系统；
  双向切换 modal bg #fff↔#1a1a1a 精确跟随，零报错；6 e2e + 157 单测 + typecheck 全绿。

**2026-09-05 设置体系升级（弹窗/插件即时生效/编辑偏好）**：
- 设置弹窗 480→680px 两栏：左=通用（主题/编辑区/数据），右=插件开关（滚动区）。
- **插件开关真实生效**：① PluginManager 新增 `remountEnabled()`（重算 L1 列表 + L2 差异挂载/卸载）与 `enabledOverrides` getter；
  ② 启停覆盖持久化 localStorage（bootstrap 构造时读回 `enabledOverrides`，刷新后装配生效）；
  ③ 全部 L2 模块 mount 补 `dispose`（纯注册型 delete api key，订阅型清理监听/定时器）；
  ④ App togglePlugin：setEnabled → 持久化 → rebuildPlugins → L1 重建编辑器（内容取 lastMarkdown）即时生效，提示改为「立即生效」。
- **编辑区偏好**：字体大小（14-18px）+ 编辑区宽度（720/860/1000/1200），settings 表持久化，
  editor-root 用 CSS 变量（--editor-font-size/--editor-max-width）应用。
- ⚠️ 防坑：**Vue reactive proxy 无法被 Dexie 结构化克隆**——`ref({...}).value` 传给 storage.setSetting 抛
  DataCloneError（DexieError，无 stack，难查）。存 DB 前必须传 plain 对象（`{ ...ref.value }`）。
- 验证：探针全链路（关 slash → 输入 / 不弹、字体 18px/宽度 1200px 应用+刷新保持、localStorage 覆盖持久化）；
  6 e2e + 157 单测 + typecheck 全绿。

**2026-09-05 设置中心重构（页签导航 + 限高 + 修复 style 外 CSS 失效）**：
- 设置弹窗改为「设置中心」：左侧 n-menu 页签（通用/编辑区/插件/数据）+ 右侧内容区（v-show 切换，保留各面板状态）。
- **整体限高防超屏**：`.settings-shell { display:flex; height:min(560px, 72vh) }`，内容区独立滚动；
  modal 高度 ≤ 72vh+header，不再超出一屏。
- ⚠️ 大坑（累积数轮）：**App.vue 用 append 追加的 CSS 全落在 `</style>` 之后，浏览器静默忽略**——
  此前「两栏布局」等设置弹窗 CSS 一直未生效，弹窗实际靠 naive 默认样式撑。修复：把 style 外 CSS 全部移回 `<style>` 内。
  教训：SFC 追加样式必须插到 `</style>` 前；`getComputedStyle` 是唯一可信的验证方式（规则没应用时 cssText 为空）。
- ⚠️ 复用坑：新增 naive 组件（n-menu）又漏 import（NMenu），被原样输出为自定义元素（options 变 [object Object]）。
- 验证：shell=518px(72vh)、modal=606px<视口 720、4 页签切换、字体 9 radio/插件 25 switch/数据 2 按钮、slash 即时生效；
  6 e2e + 157 单测 + typecheck 全绿。

**2026-09-05 编辑区偏好迭代（语义字号档位 + 区块映射 + 真全屏）**：
- **字号语义档位**（用户建议，采纳）：小/中/大/超大（14/16/18/20px 基准），不用具体 px 让用户选。
- **区块映射**：`.ProseMirror` = 基准（--editor-font-size）；标题 h1-h6 用官方 em 倍数自动缩放（如 h1=2.625em → 16px 时 42px、20px 时 52.5px）；
  代码块 = 基准 × 0.875；列表/引用/表格等 em 相对自动跟随。旧数字 px 偏好兼容映射到档位。
- **全屏逻辑**：宽度档位 720/860/1000/**全屏**（max-width:none 真正铺满编辑区，替代原 1200 假全宽；旧 1200 值兼容转 full）。
- ⚠️ 防坑：`.milkdown .ProseMirror` 自带 `font-size: var(--crepe-base-font-size,16px)`，**容器继承会被它吃掉**——
  必须用更高特异性 `.editor-root .milkdown .ProseMirror` 覆盖；探针用 getComputedStyle(.ProseMirror).fontSize 验证（16→20px 实测）。
- 编辑区控件：radio 改 n-select 下拉（含单位/语义说明）。验证：正文/标题同步缩放、全屏 none、刷新持久化；6 e2e+157 单测+typecheck 全绿。

**2026-09-05 编辑区宽度小屏适配（消除水平滚动条）**：
- 症状：中间宽度窗口（如 1050px，main≈810）下「标准 860 / 宽 1000」底部出现水平滚动条——固定 px 档位超出可用宽度。
- 修复：`.editor-root { max-width: min(var(--editor-max-width,860px), 100%) }`——档位在大屏精确生效，小屏自动收缩到父宽，永不水平溢出；
  「全屏」档改设 100%（原 none，min() 里 none 无效声明）。
- 验证矩阵（720/860/1000/full × 视口 1280/1050/900/700）：大屏逐档精确、1050 起 860/1000 收缩、700（移动端响应式）全收缩，均 hScroll=false。

**2026-09-05 全屏档位块句柄不可见修复**：
- 根因：块句柄（六点 grip + 加号）placement 'left' + mainAxis 12，占块左外侧约 78px；
  非全屏（居中 860 等）时左侧有居中空白可容纳；全屏（max-width:100%）时 editor-root 贴左、padding-left 仅 32px，
  句柄被推到 .main 可视区外（负坐标）而不可见。
- 修复：新增 `--editor-pad-left` CSS 变量——全屏档设 96px（句柄 ~66px + offset 12 + 余量），其余档位 32px 不变；
  `.editor-root { padding-left: var(--editor-pad-left, 32px) }`。
- 验证：全屏 hover 段落句柄 show=true/opacity=1、handleLeft(284) ≥ mainLeft(240) 在可视区内；
  probe-block-plus e2e 通过；typecheck 0。

**2026-09-05 交互批改（slash/大纲/文档树/导出/壳层，10 项自主处理）**：
- slash：菜单支持到 H6（标题 1-6 统一构造）、每项加 emoji 图标（slash-icon span）、**点击外部关闭**（document mousedown，content 外 hide）。
- 大纲：①切换文档后手动刷新（openDoc 读 getDocContent → onDocChanged）；②修复示例文档（无 docId）时 doc:changed 不 emit 导致大纲/字数不更新的 bug
  （bootstrap onChange 总是 emit，autosave 自行忽略无 docId）；③点击大纲项跳转——core EditorInstance 新增 `scrollToHeading(text)`（doc 遍历 heading 匹配 → scrollIntoView）。
- 文档树：DocNode 加 `size?`（document-tree list 附内容字节数）；节点渲染改 naive **render-prefix/render-suffix 函数**
  （⚠️ naive NTree 只有 default/empty slot，`#prefix`/`#suffix` 从不渲染——静默失效）；当前文档 📌、doc 显示大小、文件夹行加「在此新建文档/子文件夹」按钮（dialog 支持 parentId，标题标注位置）。
- 导出：顶部两按钮合并 n-dropdown（zip/HTML + PDF/Word 规划中占位）。
- 壳层：去掉 聚焦/无干扰 三态（zen-mode CSS 清除），改「收起/展开侧边栏」（sidebar.collapsed display:none）；主题/设置按钮纯图标化。
- 排版：代码块 margin 12px 0；**官方 image-block 内置 resize 手柄**（index.js 拖拽改宽高+ratio），补 CSS（.image-resize-handle hover 显示）启用。
- ⚠️ 防坑：设置按钮纯图标后 e2e 不能用 hasText('设置') 定位，改用 title；naive 组件新增（NDropdown）又漏 import 风险。
- 验证：综合探针（导出下拉 4 项/侧边栏收起/树 size+📌+文件夹按钮/slash H6+图标+外部关闭/大纲实时+跳转）+ 7 e2e + 157 单测 + typecheck 全绿。

**2026-09-05 样式下沉 + 插件合并（ADR-021 落地）**：
- **样式随插件**：新建 `plugins-editor/src/style-inject.ts`（幂等注入 `<style data-plugin="key">`，无 document 守卫），
  `*.css?inline` 文本导入（新增 css-inline.d.ts 类型声明）。
  已下沉：block/table/code-block/slash/tooltip/find-replace/image + theme-nord（编辑器排版 editor.css + 官方 nord css 双注入）。
  `apps/editor/src/style.css` 只保留壳层（app-shell/titlebar/sidebar/main/面板等）；block.css/table-block.css/slash-menu.css/code-block.css 删除；
  main.ts 只 import 壳层 style.css。
- **插件合并**：image + image-block 合并为一个「图片」插件（create 含 upload + url-paste + imageBlockComponent，spread 数组），
  image-block 目录与 manifest 删除；设置面板开关 25→24。表格确认本就合并（tableManifest.create 已含 tableExchange）。
- ⚠️ 单测联动：integration.spec 的 enabled 顺序断言去掉 image-block。
- 验证：9 个 style[data-plugin] 注入生效（表格边框/字体排版正常）、24 开关、7 e2e + 157 单测 + typecheck 全绿。

**2026-09-05 Markdown 粘贴解析插件（Typora 式）+ 粘贴链路修复**：
- 新插件 `markdown-paste`（L1，13 个）：复制 Markdown 源文本粘贴时解析为格式。handlePaste 拦截：
  剪贴板纯文本（无 HTML）+ `looksLikeMarkdown` 启发式（行首 #/-/数字/引用/围栏/表格行）→ parserCtx 解析 → Slice 替换选区。
  与 table-exchange（TSV/CSV）分工（它认表格数据，本插件认 GFM 语法含 "| a | b |" 表格）；与 url-paste（图片 URL）分工。
- ⚠️ 大坑：**`tr.replaceSelection(fragment)` 传 Fragment 会崩**（TextSelection.replace 读 $to.parent.lastChild → undefined）。
  必须 `new Slice(node.content, 0, 0)` 包裹（node.content 才是文档 Fragment；node.content.content 是 Node[]，别传数组）。
  **table-exchange 同款写法一并修复**（此前真实粘贴 CSV 也会崩，单测只测了纯函数）。
- 验证：Playwright 真实粘贴（clipboard.writeText + Ctrl+V）"## 标题 + 列表 + 引用 + 代码围栏" → h2=1/li=2/bq=1/code=1、原文本被替换、零报错；
  looksLikeMarkdown 10 项判定单测 + integration 顺序断言更新；7 e2e + 167 单测 + typecheck 全绿。

**2026-09-05 图片块统一 + resize 手柄修复 + 点击预览大图**：
- 根因：①插入路径（url-paste/core uploader）构造的是标准 image 节点，官方 image-block NodeView（含 resize 手柄）不生效；
  且 url-paste 有 replaceSelection(Node[]) 崩溃 bug（真实粘贴 URL 图片变成纯文本，单测只测了 isImageUrl 纯函数）。
  ②image/style.css 拆分时丢了 position/hover/focus-within 规则，手柄 opacity 恒 0（不可见）。
  ③官方手柄显隐由 NodeSelection 选中态驱动（selectNode/deselectNode → .selected class），不是 hover。
- 修复：url-paste 直接构造 image-block 节点（schemaCtx 查 nodes['image-block']，退回 image）+ replaceSelectionWith；
  core uploader adapter 同样 image-block 优先（createAndFill({src,caption,ratio})）；image/style.css 补全
  position + hover/:focus-within/.selected 显隐；至此粘贴 URL/拖拽/文件选择器全部产出 image-block 节点。
- 新功能：点击编辑器内图片 → 大图预览弹层（editorRoot click 委托，closest .milkdown-image-block 排除
  operation-item/input/resize-handle；assets 相对路径经 imageManager.getBlobUrl 解析），点击遮罩/✕ 关闭。
- 验证：粘贴 URL → .milkdown-image-block 节点 + handle hover opacity=1(16×16)；点击 → 预览大图 + 关闭；
  7 e2e + 167 单测 + typecheck 全绿。

**2026-09-05 图片渲染层统一（废弃"按插入路径"方案）**：
- 用户批评成立：按插入路径逐个产出 image-block 会漏（工具栏 insertImageCommand 漏了），渲染形态不应由入口决定。
- 改为渲染层统一：image 插件给标准 image 节点注册自定义 `$view` NodeView（figure.milkdown-image + img + .image-resize-handle +
  assets→blob 解析 + 拖拽 resize），任何插入路径（粘贴/拖拽/URL/工具栏/文件选择器）的 image 节点统一渲染带手柄；
  image-block（解析路径 remark 产物）保留官方 NodeView，同样带手柄。
- ⚠️ $ctx 坑：`$ctx(value, key)` 本身是插件，**必须放进 use 数组才会 inject slice**——只 ctx.set 不 inject 会
  "Context xxx not found"；且 set 插件要排在 $ctx 之后（先 inject 再 set；NodeView 工厂内 ctx.get 发生在渲染期，天然最晚）。
- 配置：imageConfig($ctx{proxyDomURL}) 随 image 插件注入，bootstrap 追加 set 插件（plugins 末尾）。
- 验证：工具栏插入 → figure+handle、selected 后 handle opacity=1（transition 150ms 后读取）；粘贴 → image-block+handle；
  点击图片 → 预览大图；7 e2e + 167 单测 + typecheck 全绿。

**2026-09-05 图片手柄不可见的真根因（占位尺寸）**：
- 用户反馈弹窗添加的图片右下角无手柄。机制本身正常（hover/选中 opacity=1），真因是**图片加载失败/慢时
  figure 尺寸 0×0**——手柄挂在 0×0 容器上，hover 都无法命中。
- 修复：.milkdown-image / .milkdown-image-block 加 min-width/min-height: 48px + img 同尺寸 + 灰底占位
  （--crepe-color-surface）。加载中/失败也有可 hover/点击区域，手柄可见。
- 验证：加载失败的图 figW=figH=48，hover → handle opacity=1，点击 → selected + opacity=1；
  typecheck + 167 单测全绿。

**2026-09-05 链接双输入弹窗（文案 + 地址，对齐官方体验）**：
- 原工具栏「插入链接」是单 URL 输入 + toggleLinkCommand：未选中文本时插入无效（用户反馈"无效果"）。
- 改为双字段弹窗：显示文案 + 链接地址（选中文本自动预填文案）；新增 `requestLink`/`setLinkPrompt` 桥（command-bridge），
  App 实现双输入 n-modal（linkForm）；自定义 `insertLinkCommand`（$command，tooltip 插件注册）：
  选中且文案未改 → addMark；未选中/文案改动 → 替换为链接文本。
- ⚠️ 坑：①`$command` 的 cmd 返回 ProseMirror Command `(state, dispatch)=>boolean`，不是 boolean；payload 可选需守卫；
  ②**空选区时 `replaceSelectionWith(node)` 会丢 mark**（插入文本无 <a>）——改用 `tr.insert(pos, node)` 保留 marks；
  ③v-model 表达式必须是 member（`v-model:show="!!x"` 编译错）；④plugins-editor index 需导出新桥。
- 验证：选中预填文案→链接包文本；未选中输入文案+地址→插入链接文本；取消无变化；6 e2e + 167 单测 + typecheck 全绿。

**2026-09-05 链接悬浮浮层（官方 link-tooltip 组件接入）**：
- 用户要求悬浮链接显示地址/跳转/复制/编辑/删除——官方 @milkdown/components/link-tooltip 自带，之前未接入。
- 接入：tooltip 插件 create 手动展开 link-tooltip 插件数组（官方数组不含 configureLinkTooltip；且 ctx.set 要求先 inject）：
  state/api/config + preview/edit 的 spec($ctx) 先注入 → configureLinkTooltip set 值 → $prose 再读。
- 配置中文：linkIcon 🔗 / editButton ✎ 编辑 / removeButton ✕ / confirmButton 确定 / inputPlaceholder；
  onCopyLink → dispatch milkdown:link-copied → App 状态栏提示（对齐 code-copied 模式）；样式补 tooltip/style.css（link-preview/link-edit）。
- 官方行为：悬浮显示（preview tooltip）= 🔗复制 + 地址(a target=_blank 跳转) + 编辑 + 删除；编辑切换 edit 输入框。
- 验证：hover → preview 显示地址/target=_blank；🔗 复制（剪贴板 + "链接已复制"提示）；编辑改址生效；删除移除；零报错；
  6 e2e + 167 单测 + typecheck 全绿。

**2026-09-05 链接悬浮浮层改自研（官方 link-tooltip 定位在本项目基准错乱）**：
- 官方 link-tooltip（TooltipProvider + posToDOMRect reference）在本项目定位错乱：浮层掉到页面底部
  （probe：链接 top=118 时浮层 top=613，position static/absolute 基准与 offsetParent 错位）。
- 自研 link-hover 插件：悬浮链接 → fixed 定位浮层（strategy:'fixed' 视口基准，reference=链接 DOM 元素，
  placement top + offset(8) + shift）→ 紧贴链接上方；地址(<a target=_blank> 跳转)/复制/编辑(改 href)/删除。
- ⚠️ 坑：鼠标从编辑器文本移到链接时 mouseout(旧元素→隐藏 timer) 可能在 mouseover(链接→显示) 之后生效，
  mouseover 必须 clearTimeout 隐藏 timer；浮层 mouseenter 也取消；编辑弹窗期间浮层被 hide 置空 current——
  用闭包捕获 from/to（saved = current）再 await。
- 验证：浮层 above=true（底边≈链接顶）、复制"链接已复制"、编辑 href 更新、删除移除、零报错；
  7 e2e + 167 单测 + typecheck 全绿。

**2026-09-05 milkdown-tooltip 显示时机修复（纯点击不弹，拖选才显示）**：
- 症状：选中文本后点击编辑器内空白，selection 在 ProseMirror 内部**不被清空**（document.getSelection 空但
  view.state.selection 保持 2-9）→ mousedown 兜底 hide 后 mouseup 的 provider.update 又因旧选区 SHOW → tooltip 残留。
- 修复：mousedown 记录选区，mouseup 时若选区未变化（纯点击/点空白）→ 强制 hide 且不重弹；
  拖选（选区变化）才走 provider.update 显示；空选区再兜底 hide。
- 验证：拖选→显示；点击文本内/点空白→隐藏；7 e2e + 167 单测 + typecheck 全绿。

**2026-09-05 链接悬浮渲染层统一（milkdown-tooltip 入口失效修复）**：
- 用户指出：toolbar 弹窗加的链接有悬浮浮层，milkdown-tooltip(选中浮层 🔗) 加的链接没有——同样是"渲染层未统一"。
- 根因：link-hover 用 `posAtDOM(a,0)` → `resolve(pos).marks()` 找 link mark；tooltip 入口的链接在段落中部时
  posAtDOM 返回的位置不落在 mark 文本内 → marks() 为空 → 悬浮不触发。
- 修复：改为**纯渲染层**——遍历 doc.descendants 按 href 匹配 link mark（不依赖 pos 解析），
  只要 a 是 link mark 渲染的就悬浮，与插入入口无关。
- 验证：toolbar 弹窗 + milkdown-tooltip 两入口悬浮浮层均生效；7 e2e + 167 单测 + typecheck 全绿。

**2026-09-05 撤销/重做（history 插件注册）**：
- 症状：Ctrl+Z 无效。@milkdown/plugin-history 早已安装（kit 子路径）但从未注册。
- 修复：新建 history manifest（L1，14 个）注册官方 history（prosemirror-history，Ctrl+Z / Ctrl+Shift+Z 自带 keymap），
  dependsOn commonmark，默认开启；integration.spec 顺序断言同步加 history。
- 验证：输入→Ctrl+Z 撤销→Ctrl+Shift+Z 重做 均生效；7 e2e + 167 单测 + typecheck 全绿。

**2026-09-05 文档树/侧边栏/图片弹窗 UI 批改（4 项）**：
- ① 文档树：文件名不换行（n-tree-node-content__text nowrap+ellipsis）；操作图标改 SVG（铅笔/垃圾桶/加号，emoji 小尺寸模糊）；
  ② 新增并入弹窗：toolbar 一个「＋ 新增」→ n-modal（类型 radio 文档/文件夹 + 名称），文件夹内新建(createChild)保留；
  ③ 侧边栏折叠：移除顶部按钮，改 .layout 右边缘悬浮按钮（六个点 SVG，left 240/0 随折叠滑动，折叠后仍在窗口左缘）；
  ④ 图片弹窗：URL 直链 + 本地上传（requestImage 桥 + App 弹窗；上传走 imageManager.saveImageFile → assets/xxx 由渲染层 proxyDomURL 解析）。
- ⚠️ 坑：FileTree 新增 naive 组件（NModal/NInput/NRadioGroup/NRadioButton）又漏 import（第三次犯同类——组件原样输出不渲染）；
  e2e 里 tree-toolbar 旧选择器（button[title="新建文档"]）随按钮改造失效，workflow/a11y 同步改新增弹窗流程。
- 验证：新增弹窗选文件夹创建成功；折叠按钮折叠/展开且按钮常在；图片弹窗 URL+上传按钮；7 e2e + 167 单测 + typecheck 全绿。

**2026-09-05 新增弹窗目标目录选择**：
- 新增弹窗补「位置」下拉：递归收集全部文件夹（含缩进层级）+ 根目录；openCreate(parentId) 预选中归属；
  onCreateConfirm 用 selected parentId 落库。
- 验证：选目标目录后新建文档正确落入该文件夹；typecheck + 7 e2e + 167 单测全绿。

**2026-09-05 文件树简化（顶部按钮移除 + 操作悬浮/选中显示）**：
- 移除 tree-toolbar「＋ 新增」按钮 → 树底部轻量「＋ 新增」链接（弹窗含位置/类型/名称）；
- 移除文件夹节点「在此新建」按钮（新增统一走弹窗选目录）；
- 节点操作（重命名/删除）默认隐藏，hover 或选中（--selected）时显示；
- ⚠️ 坑：render-suffix 用 h() 创建的节点不带 scoped data-v，scoped 样式全部不匹配（默认隐藏从未生效）——
  node-actions/mini-btn 样式必须放非 scoped 全局 <style> 块（Vue SFC 支持多 style 块）。
- 验证：默认隐藏/悬浮显示/选中显示；顶部无按钮；typecheck + 7 e2e + 167 单测全绿。

**2026-09-05 文件树按钮修正**：
- 上一条「移除顶部按钮」是过度解读——用户指节点后 hover 的新建按钮，顶部「＋ 新增」n-button 恢复原样式；
- 保留：节点后无新建按钮、操作（重命名/删除）默认隐藏/悬浮或选中显示。
- 验证：typecheck + 7 e2e + 167 单测全绿。

**2026-09-05 块句柄「+」插入模式（先选类型后插入）+ 图片独立块**：
- 用户反馈：点 + 立即插一行太快，应选完类型才插入。改：点 + 不预插入 → showAt(pos, anchor, insertModeAt) 插入模式弹菜单 → 选完在 pos 插入对应新块；
- slash 菜单项 run(ctx, mode)：'insert' 用 insertBlockAt(schema.nodes.* 构造 + TextSelection.near 光标进入)；'convert' 保持官方转换；
- 新增「图片」菜单项(独立块)：requestImage 弹窗(URL/上传) → 插入 image-block 节点；
- ⚠️ 坑：① milkdown schema 包装器（imageBlockSchema.type 等）要 Ctx 不是 EditorSchema——插入构造一律 schema.nodes['image-block']（节点 key 带连字符！）直接建；② 插入模式 + 弹窗交互：onDocMouseDown 会把点击 n-modal 当"菜单外点击"清掉 insertModeAt → 图片弹窗期间菜单必须保留（closest('.n-modal') 豁免）；
- 插入模式 shouldShow 不撤旗（插入不依赖光标位置）；
- 验证：点 + 块数不变(noImmediateInsert)、菜单 14 项含图片、选标题2/图片/分割线均正确插入；typecheck + 7 e2e + 167 单测全绿。
