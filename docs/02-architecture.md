# Milkdown 编辑器 — 整体技术架构 (Architecture)

| 项目       | 内容                                                              |
| ---------- | ----------------------------------------------------------------- |
| 状态       | v0.1 草稿（随 02/03/05 文档迭代）                                 |
| 关联       | 01-product-plan.md（v1.0 定稿）、04-plugin-design.md（v1.0 定稿） |
| 本文档职责 | 把产品功能（M0-M8）与插件化理念（L1/L2）落成可实现的系统分层蓝图  |

---

## 1. 架构目标与原则

承接 01 的 5 条核心原则，架构上对应为：

| 产品原则           | 架构落点                                                           |
| ------------------ | ------------------------------------------------------------------ |
| WYSIWYG 输入即渲染 | Milkdown（ProseMirror+remark）为唯一编辑内核                       |
| 本地优先           | IndexedDB（Dexie 封装）为唯一事实源，StorageProvider 抽象          |
| 文本可移植         | 文档存 Markdown 原文；图片 assets 相对路径/base64；导出 zip 自包含 |
| UI 自绘            | 编辑器区全自绘；应用壳用 Naive UI 提效                             |
| 一切皆插件         | L1/L2 双层插件 + PluginManager（见 04）                            |

架构级约束（强制）：

- **L2 模块禁止直接 import milkdown**，只能通过 AppApi 访问能力（解耦，防内核污染）
- **渲染/序列化单方向过 Asset Resolver**，相对路径不在内核里裸奔
- **插件依赖显式声明**（dependsOn），启动时拓扑校验

---

## 2. 总体架构分层

```
┌─────────────────────────────────────────────────────────┐
│  L0 Web 入口 (Entry) + 应用壳 (App Shell) —— Vue 3        │
│  · 入口: index.html → main.ts → mount                    │
│  · 应用壳 UI: 布局 / 侧边栏(文档树/大纲/搜索) / 标签页/状态栏 │
│  · 壳级状态: Pinia (shell/tabs/layout，非领域)            │
└───────────────┬─────────────────────────────────────────┘
                │  AppApi 注入（L2 模块能力边界）
┌───────────────▼─────────────────────────────────────────┐
│  L2 应用插件 (AppModule) —— @editor/plugins-app/        │
│  document-tree / persistence / autosave / tabs /         │
│  versions / search / import-export / theme / settings /  │
│  backup / asset-store / quicknote / i18n / 数据安全       │
└───────────────┬─────────────────────────────────────────┘
                │  PluginManager（注册/排序/启停/设置聚合）
┌───────────────▼─────────────────────────────────────────┐
│  L1 编辑器插件 (MilkdownPlugin) —— @editor/plugins-editor/│
│  commonmark / gfm / math / mermaid / code-block /        │
│  slash-menu / tooltip / outline / image / table / ...   │
└───────────────┬─────────────────────────────────────────┘
                │  Milkdown 内核 (Editor.make() 链式 API, 7.22+)
┌───────────────▼─────────────────────────────────────────┐
│  内核: ProseMirror(文档/状态/视图) + remark(解析/序列化)   │
└───────────────┬─────────────────────────────────────────┘
                │  StorageProvider / AssetResolver
┌───────────────▼─────────────────────────────────────────┐
│  L4 数据层 —— Dexie(IndexedDB)                          │
│  docs 表 / files 表(文档树) / assets 表(图片) / settings  │
│  versions 表(快照) / 预留: sync 队列                     │
└─────────────────────────────────────────────────────────┘
```

分层依赖规则（自上而下单向）：

- L0 → L2 → L1 → 内核 → 数据层
- 禁止反向依赖：L1/L2 不反向依赖上层；数据层不感知 UI
- L2 只经 AppApi 访问能力

---

## 3. 技术选型全景（落地版）

| 领域         | 选型                          | 用途                         | 备注                                                                 |
| ------------ | ----------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| 框架         | Vue 3 + TS                    | 应用壳                       | 构建工具链见下                                                       |
| 工具链       | **Vite+（vp CLI，VoidZero）** | 统一 dev/build/lint/fmt/test | 生产构建 Vite 8 + Rolldown；兼容 Vite 生态；e2e(Playwright) 保持独立 |
| 编辑内核     | @milkdown/kit                 | 编辑器                       | 不用 crepe（UI 自绘）                                                |
| 文档模型     | ProseMirror（kit 内置）       | 编辑态运行时                 | Markdown 原文为主存储                                                |
| 解析/序列化  | remark（kit 内置）            | md ↔ AST                     |                                                                      |
| 存储         | Dexie.js + IndexedDB          | 文档/资产/设置               | 事务、索引、版本迁移                                                 |
| 状态         | Pinia                         | 应用状态                     | 分域 store                                                           |
| 组合式工具   | VueUse                        | 防抖/事件/滚动               | 与 Vue3 配套                                                         |
| 应用 UI      | Naive UI（自绘为主）          | 侧边栏/菜单/弹窗             | 编辑器区全自绘                                                       |
| 代码高亮     | Shiki                         | 代码块                       | 懒加载按需                                                           |
| 数学         | KaTeX                         | 公式渲染                     | 可离线                                                               |
| 图表         | mermaid                       | 图表渲染                     | 只读渲染                                                             |
| 表格         | prosemirror-tables（随 kit）  | 表格节点                     | UI 自研                                                              |
| 图床（预留） | 自定义 UploadProvider 实现    | 上传                         | V1 无默认实现                                                        |
| 协同（预留） | Yjs + plugin-collab           | 实时协同                     | V1 不做                                                              |
| 测试         | Vitest + Playwright           | 单测 + e2e                   | e2e 用真实浏览器                                                     |
| 打包（预留） | Tauri                         | 桌面化                       | 数据层换真目录                                                       |

---

## 4. 核心模块与职责

### 4.1 编辑会话（Editor Session）

- `Editor.vue` 组件持有 Milkdown 编辑器实例生命周期
- 核心流程：文档加载 → markdown 解析为 ProseMirror 文档 → 渲染 → 编辑 → 序列化回 markdown → 保存
- 每次切换文档 = 重建编辑器实例（Milkdown 官方推荐模式），避免状态串扰

### 4.2 文档生命周期

```
打开文档 ──▶ parse(markdown) ──▶ Editor 渲染
                                    │
输入 ──▶ transaction ──▶ 变更监听 ──┼──▶ 防抖自动保存 ──▶ serialize(markdown) ──▶ Dexie 写入
                                    │
                                    └──▶ 版本快照（每次保存，可配阈值）
```

### 4.3 图片/资产管道（Asset Pipeline）

对应 M4.2/M4.2a：

```
粘贴/拖拽/选择器 → 文件 → UploadProvider.resolve(file)
   ├─ T1 未配图床: 写入 assets 表 ──▶ 文档内引用 ./assets/<id>.<ext>
   │                                  渲染时 AssetResolver: assets/xxx → blob URL
   │                                  导出时 AssetResolver: 内嵌 base64 / 复制文件
   └─ T2 配图床: 上传远程 ──▶ 文档内引用 https://...
```

**AssetResolver 核心职责**（M4.2a）：

1. 渲染前：把文档内 `./assets/xxx` 解析为可显示 URL（blob / 远程）
2. 序列化时：还原相对路径
3. 导出时：内嵌 base64 或打包复制
4. 文档移动：事务性迁移其 assets（与 M2.1 联动）

### 4.4 导出管道（Export Pipeline）

对应 M3：

```
ExportService.dispatch(格式)
  ├─ .md (zip)   : markdown 原文 + assets 打包（jszip）          [M3.1]
  ├─ HTML        : remark → hast → html，图片内嵌/外链            [M3.2]
  ├─ PDF         : 打印样式渲染（浏览器 print），图片内嵌          [M3.4]
  └─ 复制富文本   : clipboard 事件自定义写入 text/html            [M3.5]
```

---

## 5. 状态管理设计（Pinia 分域）

| Store                  | 职责                                                                      | 对应       |
| ---------------------- | ------------------------------------------------------------------------- | ---------- |
| `useEditorStore`       | 当前编辑器实例、当前文档 id、脏标记、undo 状态                            | L0         |
| `useDocTreeStore`      | 文档树结构、当前选中、快速记录                                            | M2.1/M2.1a |
| `useTabsStore`         | 打开标签页、活动标签                                                      | M2.2       |
| `useFilesStore`        | 文档列表索引（标题/时间/标签）、最近打开                                  | M2.3       |
| `useSearchStore`       | 全文搜索状态                                                              | M2.5       |
| `useSettingsStore`     | 全局设置、主题、快捷键（位于 packages/shared）                            | M7.1       |
| `usePluginStore`       | 插件启停状态、插件配置覆盖（位于 packages/shared，由 PluginManager 提供） | 04 §6      |
| `useSyncStore`（预留） | 同步队列                                                                  | M8.2       |

规则：

- 编辑器内部状态（光标、选择）一律留在 Milkdown/ProseMirror，不镜像进 Pinia
- Pinia 只存「编辑器之外需要共享」的状态
- 插件配置覆盖：PluginStore > 插件 defaultEnabled

---

## 6. 工程结构（落地目录规划）

### 6.1 结构原则（职责所有权 + Monorepo）

**形态**：pnpm workspace 轻度 Monorepo（V1 即落地）。工程按 5 个包/区划分，每条规则决定「代码该放哪」：

| 区（包）                  | 放什么                                           | 规则                                                                    |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `apps/editor`             | **Web 入口** + 应用壳 UI 层（根布局、壳级状态）  | 包角色 = Web 入口；内部 App.vue/layout 为应用壳，只组装**不含业务功能** |
| `packages/core`           | 框架本体：插件系统、编辑器装配、数据接口         | 纯 TS、不依赖 Vue、**不实现具体功能**                                   |
| `packages/plugins-editor` | L1 编辑器插件（语法/行为/编辑态 UI）             | 依赖 core + @milkdown/kit；一个能力域一个目录，自包含                   |
| `packages/plugins-app`    | L2 应用模块（文档树/持久化/导出/主题）           | 依赖 core + shared；一个模块一个目录，自包含                            |
| `packages/infra`          | 基础设施实现：Dexie、导出引擎、搜索引擎          | 对接第三方/底层，**无业务语义**，实现 core 定义的接口                   |
| `packages/shared`         | 跨层共享：领域类型、工具、样式 token、共享 store | 薄层；插件独占的东西**绝不外提**                                        |

> 关键判别：一个功能要长在 `packages/plugins-editor`（L1）或 `packages/plugins-app`（L2）里，而不是散落在 apps/core/infra。
> 一个第三方依赖的封装要落在 `packages/infra` 里，而不是写进 core。

**包命名约定**（占位 scope，可按最终项目名调整）：

| 包            | 内部依赖名               |
| ------------- | ------------------------ |
| 应用壳        | `@editor/app`            |
| 框架核心      | `@editor/core`           |
| L1 编辑器插件 | `@editor/plugins-editor` |
| L2 应用模块   | `@editor/plugins-app`    |
| 基础设施      | `@editor/infra`          |
| 共享层        | `@editor/shared`         |

**包间依赖方向（单向，禁反向）**：

```
apps/editor ──▶ @editor/core, @editor/plugins-editor, @editor/plugins-app, @editor/shared
packages/plugins-editor ──▶ @editor/core（+ @milkdown/kit）
packages/plugins-app ──▶ @editor/core, @editor/shared
packages/infra ──▶ @editor/core（实现其接口）
packages/shared ──▶（无依赖）
```

### 6.2 目录树（Monorepo）

```
milkdown/                           # pnpm workspace root
├── docs/                           # 规划文档（01-06）
├── apps/
│   ├── editor/                     # Web 入口（Vite+ 构建入口，含应用壳 UI 层）
│   │   # 注：应用壳（App.vue/layout）是此包内的 UI 层，
│   │   #     本包的角色 = Web 入口的宿主
│   │   ├── src/
│   │   │   ├── main.ts             #   入口
│   │   │   ├── App.vue             #   根布局（侧边栏/编辑区/标签页/状态栏）
│   │   │   ├── layout/             #   布局组件（自绘为主 + Naive UI 补充）
│   │   │   └── shell-stores.ts     #   壳级状态（tabs/layout，非领域）
│   │   ├── index.html
│   │   ├── vite.config.ts          #   Vite+ 配置（defineConfig from 'vite-plus'）
│   │   └── package.json            #   @editor/app
│   └── desktop/                    # 预留占位（V1 不创建 Tauri 工程，见 8.4）

├── packages/
│   ├── core/                       # 框架本体（纯 TS，无 Vue 依赖）
│   │   ├── src/
│   │   │   ├── plugin-system/      #   插件框架
│   │   │   │   ├── manifest.ts     #     PluginManifest 类型 + 校验
│   │   │   │   ├── plugin-manager.ts  #  注册/拓扑排序/启停/设置聚合
│   │   │   │   ├── topology.ts     #     依赖排序（环检测）
│   │   │   │   └── app-api.ts      #     L2 能力注入边界（唯一通道）
│   │   │   ├── editor/             #   编辑器装配
│   │   │   │   └── editor-factory.ts  # 依据启用插件创建 Milkdown 实例
│   │   │   └── data/               #   数据抽象（仅接口）
│   │   │       ├── storage-provider.ts
│   │   │       └── asset-resolver.ts
│   │   └── package.json            #   @editor/core
│   ├── plugins-editor/             # L1 编辑器插件（@editor/plugins-editor）
│   │   ├── src/
│   │   │   ├── commonmark/         #   每能力一目录，自包含
│   │   │   ├── math/
│   │   │   ├── table/
│   │   │   ├── image/
│   │   │   ├── slash-menu/
│   │   │   └── ...
│   │   └── package.json
│   ├── plugins-app/                # L2 应用模块（@editor/plugins-app）
│   │   ├── src/
│   │   │   ├── document-tree/      #   每模块一目录，自包含
│   │   │   ├── persistence/
│   │   │   ├── autosave/
│   │   │   ├── import-export/
│   │   │   ├── theme/
│   │   │   └── ...
│   │   └── package.json            #   @editor/plugins-app
│   ├── infra/                      # 基础设施实现（无业务语义）
│   │   ├── src/
│   │   │   ├── dexie/              #   IndexedDB 实现 storage-provider
│   │   │   ├── export/             #   导出引擎（md/html/pdf 序列化器）
│   │   │   └── search/             #   全文搜索引擎
│   │   └── package.json            #   @editor/infra
│   └── shared/                     # 跨层共享（薄层）
│       ├── src/
│       │   ├── types/              #   领域类型（Document/Asset/Setting）
│       │   ├── utils/
│       │   ├── styles/             #   主题 token、全局样式、dark 变量
│       │   └── stores/             #   跨插件共享 store（settings/plugin 启停）
│       └── package.json            #   @editor/shared
├── e2e/                            # Playwright（独立，Vite+ 不管）
├── package.json                    # workspace root（scripts: dev/build/check/test）
├── pnpm-workspace.yaml             # packages: ['apps/*', 'packages/*']
├── tsconfig.base.json              # 共享 TS 配置
└── vite.config.ts                  # 根级共享 Vite+ 配置（可选，各包可覆盖）
```

### 6.3 插件自包含约定（重要）

每个插件目录内部结构统一（示例：L2 文档树插件）：

```
packages/plugins-app/src/document-tree/
├── index.ts          # manifest + mount()
├── FileTree.vue      # 私有组件（不外提）
├── store.ts          # 私有 Pinia（仅该插件用）
├── types.ts          # 私有类型
└── README.md         # 一句话职责 + 依赖
```

规则：

- 插件的**私有组件/store/类型一律内聚在插件目录**，不进 shared
- 只有**两个以上插件共享**的东西才提升到 `packages/shared`
- 跨插件共享 store（settings、plugin 启停）在 `shared/stores/`，由 PluginManager 提供
- L1 插件在 `packages/plugins-editor/src/<capability>/`；L2 模块在 `packages/plugins-app/src/<module>/`
- 测试与 src 同构：单测放各包 `src/` 旁（`*.test.ts`），e2e 统一放根 `e2e/`

---

## 7. 构建与性能策略

| 关注点       | 策略                                                                              |
| ------------ | --------------------------------------------------------------------------------- |
| 首屏体积     | L1 插件按需懒加载（动态 import），只装载 enabledSet                               |
| Shiki 体积   | 按需加载语言/主题，代码块懒渲染（IntersectionObserver）                           |
| mermaid 体积 | 动态 import（大依赖，不与首屏同包）                                               |
| KaTeX        | 静态资源本地化，可离线；仅文档含公式时加载                                        |
| 大文档       | 万行级：代码块高亮异步化、输入防抖、必要时虚拟滚动（P2 评估）                     |
| 图片         | 懒加载（M4.7）                                                                    |
| 构建         | Vite+（vp build）：Vite 8 + Rolldown 分包（vendor / milkdown / plugins 三档）     |
| 质量门禁     | vp check（format + lint + type-check 一条命令）；Oxlint/Oxfmt 兼容性进 spike 验证 |

---

## 8. 扩展点设计（预留）

### 8.1 AI 接入（M8.1，默认关）

- L2 `ai-assist` 空壳插件 + manifest defaultEnabled=false
- 注入点：选中文本 → AppApi.requestAI(action, selection) → 流式输出回调 → 替换选区
- action 表（continuation/rewrite/summarize/translate）由插件注册，核心不感知

### 8.2 云同步（M8.2）

- StorageProvider 接口先落地（本地实现：Dexie）
- 同步版实现（远程）替换同一接口 + 变更队列（如 CRDT/时序 staleness），数据层无需改动

### 8.3 协同编辑（M8.3）

- 预留 plugin-collab + Yjs，但**存储格式仍 markdown 原文**（协同态在编辑器内，落盘仍 md）

### 8.4 桌面化（M8.4）

- **Web 入口不变**：apps/editor 仍是 web 入口；`apps/desktop` 目录已**占位标注**（V1 不创建 Tauri 工程），未来初始化 Tauri 容器加载同一套 web 产物
- StorageProvider 增加 FileSystem 实现 → 文档真目录、assets 真目录
- 导出可直写磁盘；其余分层不动

---

## 9. 测试策略

| 层          | 工具                    | 覆盖                                                       |
| ----------- | ----------------------- | ---------------------------------------------------------- |
| L1 插件单测 | Vitest（vp test）       | 各语法插件解析/序列化保真、命令行为                        |
| L2 模块单测 | Vitest                  | 文档树 CRUD、自动保存防抖、导出内容正确性                  |
| 数据层      | Vitest + fake-indexeddb | 存储/迁移/事务                                             |
| e2e         | Playwright              | 核心用户旅程：建文档→写 md→插入表格/图片→导出 zip→重开加载 |
| 快照        | Playwright（视觉）      | 主题明暗、关键渲染                                         |

---

## 10. 与后续文档的衔接

| 文档             | 内容                                                                | 依赖           |
| ---------------- | ------------------------------------------------------------------- | -------------- |
| 03-data-model.md | Dexie 表结构、文档/资产/版本 schema、StorageProvider 接口、迁移策略 | 本文 §4.3/§4.4 |
| 05-ADR.md        | 关键架构取舍记录（kit vs crepe、markdown 存储、L2 禁入内核等）      | 本文全部       |
| 06-roadmap.md    | 里程碑细化、任务分解                                                | 01 §6          |

---

## 10.5 Vite+ 采用记录（2026-08-31 决策）

- **采用**：Vite+（vp CLI）为统一工具链；e2e 用 Playwright（独立）。
- 风险：① Vite+ 较新，生产生态待观察（绿地项目可控）；② Oxfmt 输出 ≠ Prettier 逐字节、Oxlint 不覆盖全部 ESLint 插件 → 若后续需要冷门规则先 spike；③ Vite 8 安装体积更大。
- 待验证：Rolldown 生产构建对 Milkdown/ProseMirror 依赖的兼容性（进 spike 清单）。

## 11. 开放问题（待 03/05 细化时回答）

1. Milkdown 编辑器实例的重建粒度：每文档切换重建 vs 单实例热切换（影响性能与状态保留）——倾向重建，需 spike 验证
2. 全文搜索的索引策略：遍历 markdown 文本（V1 简单）vs 词法索引（P2 升级）
3. 版本快照的触发阈值与保留策略（每条存 / 合并 / 上限 N 条）
4. jszip 等导出依赖的引入时机（V1 P0 就引入，体积可控）
