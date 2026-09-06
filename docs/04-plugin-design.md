# Milkdown 编辑器 — 插件体系设计 (Plugin Architecture)

| 项目     | 内容                                                       |
| -------- | ---------------------------------------------------------- |
| 状态     | **v1.0 已评审定稿**（2026-08-31）                          |
| 关联     | 01-product-plan.md（功能全景）、02-architecture.md（待写） |
| 核心理念 | **一切功能皆插件：可插拔、可扩展、可开关**                 |

---

## 1. 设计目标

1. **可插拔**：任意功能可独立接入或移除，核心不感知
2. **可扩展**：第三方可贡献新语法/新 UI/新能力，不改核心
3. **可开关**：设置面板统一管理每个插件的启用状态与配置
4. **可测试**：每个插件可独立单测，互不污染
5. **可降级**：某插件异常时禁用即可，其余功能不受影响

## 2. 双层插件模型

> 关键认知：Milkdown 的插件体系只服务编辑器内部。应用层能力不能硬塞进 Milkdown。

### L1 — 编辑器内插件（MilkdownPlugin）

承载：语法扩展、编辑行为、编辑态 UI。

- 机制：Milkdown 原生 Ctx / Slice / Timer 体系
- 生命周期：setup → init → runtime → cleanup
- 依赖协调：Timer 等待（如 `wait(SchemaReady)`）

| 能力域 | 插件                                                                                                                            | 映射 PRD | 默认       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| 语法   | commonmark 基础语法                                                                                                             | M0.1     | 开（core） |
| 语法   | gfm（任务列表/删线/自动链接等）                                                                                                 | M0.1     | 开（core） |
| 语法   | math（KaTeX）⚠️ 官方 7.5.9 已废弃且与 7.22 不兼容 → 自研/等新方案（ADR-013） | M0.2     | 关         |
| 语法   | mermaid ⚠️ 无官方插件 → 完全自研（remark 扩展 + 只读渲染）（ADR-013） | M0.3     | 关         |
| 语法   | table 表格（官方 components/table-block：行列增删/对齐/拖拽引擎齐备，仅需主题化 UI + M5.5 数据交换自研；样式自备 table-block.css，ADR-019）（ADR-013） | M5.x     | 开（core） |
| 语法   | code-block 高亮                                                                                                                 | M0.4     | 开（core） |
| 行为   | auto-complete 自动完成                                                                                                          | M0.5     | 开         |
| 行为   | clipboard 粘贴转换                                                                                                              | M0.6     | 开（core） |
| 行为   | history 撤销重做                                                                                                                | M0.7     | 开（core） |
| 行为   | source-mode 源码模式                                                                                                            | M0.8     | 开         |
| UI     | slash-menu                                                                                                                      | M1.1     | 开         |
| UI     | tooltip 浮动工具栏                                                                                                              | M1.2     | 开         |
| UI     | outline 大纲                                                                                                                    | M1.3     | 开         |
| UI     | focus-mode                                                                                                                      | M1.7     | 关         |
| UI     | typewriter-mode                                                                                                                 | M1.8     | 关         |
| UI     | distraction-free                                                                                                                | M1.9     | 关         |
| 行为   | search-replace 查找替换                                                                                                         | M1.10    | 开         |
| 能力   | image 图片（官方 plugin-upload：uploader 注入点 + base64 默认；三层存储 T1/T2 经 uploader 自研；含 Asset Resolver）（ADR-013） | M4.x     | 开（core） |
| 扩展   | ai-assist（预留空壳）                                                                                                           | M7.1     | 关         |

### L2 — 应用层模块（AppModule）

承载：文档管理、持久化、导入导出、主题、设置等。

- 机制：Vue 应用自有注册表 + 依赖注入
- 生命周期：register → mount → unmount
- 依赖协调：显式 `dependsOn` 声明

| 模块                                                       | 映射 PRD   | 默认       |
| ---------------------------------------------------------- | ---------- | ---------- |
| document-tree 文档树                                       | M2.1       | 开（core） |
| quicknote 快速记录（无标题即写，自动归档）                 | M2.1a      | 开         |
| persistence 持久化（IndexedDB）                            | M2.x       | 开（core） |
| asset-store 资源存储（文档 assets 虚拟目录，三层策略底层） | M4.2/M4.2a | 开（core） |
| autosave 自动保存                                          | M1.6       | 开         |
| tabs 多标签                                                | M2.2       | 开         |
| versions 版本快照                                          | M2.4       | 开         |
| search 全文搜索                                            | M2.5       | 开         |
| import-export 导入导出                                     | M3.x       | 开         |
| theme 主题系统                                             | M6.x       | 开（core） |
| settings 设置面板                                          | M7.1       | 开（core） |
| backup 数据备份                                            | M7.2       | 开         |
| sync（预留）                                               | M7.2       | 关         |
| collab（预留）                                             | M7.3       | 关         |
| desktop（预留）                                            | M8.4       | 关         |
| i18n（key-based 文案结构，V1 中文）                        | M7.4       | 开（core） |

## 3. 插件 manifest 契约

```ts
// 统一契约，L1/L2 共用
interface PluginManifest {
  id: string; // 唯一标识，如 'math'
  type: "milkdown" | "app";
  name: string; // 中文显示名
  version: string;
  description: string;
  dependsOn: string[]; // 依赖的其他插件 id
  defaultEnabled: boolean;
  configSchema?: Record<string, unknown>; // 配置项定义，设置面板据此自动生成表单
}

// L1 扩展：Milkdown 插件工厂
interface MilkdownPluginManifest extends PluginManifest {
  type: "milkdown";
  create: () => MilkdownPlugin; // 返回 Milkdown 插件
}

// L2 扩展：应用模块工厂
interface AppModuleManifest extends PluginManifest {
  type: "app";
  mount: (api: AppApi) => AppModule; // 挂载，注入应用 API
}
```

## 4. 插件管理中心（Plugin Manager）

统一入口，职责：

1. **注册**：收集全部 manifest，校验 id 唯一性、依赖可解析
2. **排序**：拓扑排序，保证依赖先于被依赖者
3. **启停**：根据 `defaultEnabled` + 设置覆盖，决定实际装载集合
4. **暴露 API**：向 L2 模块注入 `AppApi`（编辑器实例、store、storage、配置等）
5. **汇总设置**：聚合所有 manifest 的 configSchema，供设置面板生成 UI

```
PluginManager
  ├─ registry: Map<id, Manifest>
  ├─ enabledSet: Set<id>          # 启用的插件集合
  ├─ resolveOrder(): Plugin[]     # 拓扑排序后的装载顺序
  ├─ mountAll(): void             # L1 喂给 Editor.make().use()，L2 逐个 mount
  └─ getSettingsSchema(): JSON Schema[]  # 汇总配置
```

## 5. 目录结构（Monorepo，pnpm workspace，未实现）

```
milkdown/
├── apps/
│   └── editor/                     # L0 应用壳（@editor/app）
├── packages/
│   ├── core/                       # 框架本体（@editor/core，纯 TS）
│   │   ├── src/plugin-system/      #   plugin-manager / app-api / topology / manifest
│   │   ├── src/editor/             #   editor-factory
│   │   └── src/data/               #   storage-provider / asset-resolver（仅接口）
│   ├── plugins-editor/             # L1 编辑器插件（@editor/plugins-editor）
│   │   ├── src/
│   │   │   ├── math/
│   │   │   │   ├── index.ts        #     manifest + create()
│   │   │   │   └── ...
│   │   │   ├── slash-menu/
│   │   │   └── ...
│   │   └── package.json
│   ├── plugins-app/                # L2 应用模块（@editor/plugins-app）
│   │   ├── src/
│   │   │   ├── document-tree/
│   │   │   │   ├── index.ts        #     manifest + mount()
│   │   │   │   ├── FileTree.vue
│   │   │   │   └── ...
│   │   │   ├── persistence/
│   │   │   └── ...
│   │   └── package.json
│   ├── infra/                      # 基础设施实现（@editor/infra）：dexie / export / search
│   └── shared/                     # 跨层共享（@editor/shared）：types / utils / styles / stores
└── e2e/                            # Playwright
```

> 约定：L1 插件 `index.ts` 导出 `{ manifest }`；L2 模块导出 `{ manifest, AppModule }`。插件目录自包含，不反向依赖其他插件（依赖只通过 manifest.dependsOn 声明）。
> 包间依赖单向：apps/editor → core/plugins-editor/plugins-app/shared；plugins-editor → core（+ @milkdown/kit）；plugins-app → core/shared；infra → core。L2 禁止直接 import milkdown（详见 02 §6）。

## 6. 设置面板集成

- 设置面板的「插件」页，由 PluginManager 聚合所有 manifest 渲染：
  - 每个插件一行：名称 / 描述 / 开关 / 展开配置表单（由 configSchema 自动生成）
  - core 插件不可关闭（灰置）
- 插件配置存 Pinia → 覆盖 `defaultEnabled` 与配置值

## 7. 风险与约束

| 风险             | 说明                                | 应对                                            |
| ---------------- | ----------------------------------- | ----------------------------------------------- |
| 过度细粒度       | 一个功能一个插件 = 碎片化、配置爆炸 | 按能力域组织；core 层固定，可选层控制数量       |
| 依赖地狱         | 插件间隐式依赖                      | 显式 dependsOn + 启动时拓扑校验 + 循环依赖报错  |
| 启动性能         | 插件越多初始化越慢                  | L1 懒加载（动态 import），只装载 enabledSet     |
| L2 耦合 Milkdown | 应用模块误依赖 Milkdown 内部        | L2 只通过 AppApi 访问，禁止直接 import milkdown |
| 版本升级         | 插件 API 变化                       | L1 锁定 @milkdown/kit 版本，API 变更走 ADR 记录 |

## 8. 已确认决策（2026-08-31 评审通过）

| #   | 决策点      | 结论                                                                                                     |
| --- | ----------- | -------------------------------------------------------------------------------------------------------- |
| D1  | 插件粒度    | **按能力域组织**（math 一个插件，不拆行内/块级；mermaid 独立插件）                                       |
| D2  | core 层范围 | 认可：commonmark / gfm / history / code-block / clipboard / persistence / theme / document-tree 不可关闭 |
| D3  | 第三方插件  | **V1 内部使用**，manifest 契约即为预留接口，后续再开放 npm 发布能力                                      |
| D4  | AI 插件     | **默认关闭**，仅留 ai-assist 接口空壳，通过 ctx/AppApi 暴露能力注入点                                    |

### 派生约束（由 D1–D4 得出）

- L1 插件目录：`packages/plugins-editor/src/<capability>/`，每个能力域一个目录、一个 manifest
- L2 模块目录：`packages/plugins-app/src/<module>/`
- 第三方插件开放前，先沉淀一套「插件作者指南」文档（后续补充 04b-plugin-authoring.md）
