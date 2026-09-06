# Milkdown 编辑器

类 Typora 的 **WYSIWYG Markdown 写作工具**（Web 应用，Vue 3 + TypeScript），基于 [@milkdown/kit](https://milkdown.dev)（ProseMirror + remark）。

- **本地优先**：数据存浏览器 IndexedDB，离线可用，不强制登录
- **文本可移植**：文档以 Markdown 原文存储（非私有序列化格式）
- **一切皆插件**：L1（编辑器内）/ L2（应用层）双层插件模型
- **UI 自绘**：不使用 crepe 成品壳，编辑器 UI 完全自研
- **编辑体验**：顶部工具栏 + 斜杠菜单 + 选中文本浮层，无任何原生弹窗

> 规划文档：`docs/01-product-plan.md`（PRD v1.0）、`docs/02-architecture.md`（架构）、`docs/03-data-model.md`（数据模型）、`docs/04-plugin-design.md`（插件设计）、`docs/05-ADR.md`（架构决策记录）、`docs/06-roadmap.md`（里程碑）。

---

## 环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | **v22.x**（必需） | vite-plus / vitest 4 / Rolldown 需要 v22；v14 会报语法错误 |
| pnpm | 11.x | workspace 管理 |
| 浏览器 | 现代 Chrome/Edge | 使用 IndexedDB |

---

## 快速开始

```bash
# 1. 安装依赖（首次）
pnpm install

# 2. 启动开发服务器
pnpm dev
# → http://localhost:5173/

# 3. 生产构建
pnpm build
```

---

## 命令速查

| 命令 | 作用 | 等价底层 |
|---|---|---|
| `pnpm dev` | 启动 dev server（http://localhost:5173/） | `vp dev apps/editor` |
| `pnpm build` | 生产构建（输出 `apps/editor/dist/`） | `vp build apps/editor` |
| `pnpm preview` | 预览生产构建 | `vp preview apps/editor` |
| `pnpm test` | 运行单测（vitest，一次性） | `vitest run` |
| `pnpm test:watch` | 单测监听模式 | `vitest` |
| `pnpm typecheck` | TypeScript 类型检查 | `tsc --noEmit` |
| `pnpm check` | 同 typecheck（质量门禁入口） | `tsc --noEmit` |

> 所有命令在**项目根目录**执行（pnpm workspace 自动路由到各包）。

---

## 项目结构（pnpm Monorepo）

```
milkdown/
├── apps/
│   ├── editor/          # Web 入口（Vue3 + Vite+ 构建入口，含应用壳 UI 层）
│   └── desktop/         # 预留占位（V1 不创建 Tauri 工程，见 02 §8.4）
├── packages/
│   ├── core/            # 框架本体（纯 TS）：plugin-system / editor / data 接口
│   ├── plugins-editor/  # L1 编辑器插件（@milkdown/kit + 自研）
│   ├── plugins-app/     # L2 应用模块（文档树/持久化/导出/主题...）
│   ├── infra/           # 基础设施实现（dexie / export / search / katex / mermaid）
│   └── shared/          # 跨层共享（types / utils / styles / stores）
├── docs/                # 规划文档（PRD / 架构 / 数据模型 / 插件 / ADR / roadmap）
├── e2e/                 # Playwright（Phase 后期启用）
├── dev-tool.cmd         # 固定 v22 工具链包装（见上）
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### 包间依赖方向（单向）

```
apps/editor ──▶ core, plugins-editor, plugins-app, shared
plugins-editor ──▶ core (+ @milkdown/kit)
plugins-app ──▶ core, shared
infra ──▶ core（实现其接口）
```

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Vue 3 + TypeScript + Vite+（vp CLI，Rolldown 构建） |
| 编辑器内核 | @milkdown/kit（Editor.make() 链式 API, 7.22+） |
| 存储 | Dexie.js（IndexedDB）+ 文档 Markdown 原文 |
| 全文搜索 | MiniSearch |
| 数学公式 | KaTeX（离线，本地字体） |
| 图表 | mermaid 11（自研插件，只读渲染） |
| 测试 | Vitest 4 + happy-dom |

---

## 测试

```bash
pnpm test          # 一次性跑全部（当前 19 个测试，S1-S8 spike 验证）
pnpm test:watch    # 监听模式
```

测试文件约定：`packages/*/src/__tests__/*.spec.ts`，使用 happy-dom 环境（见 `vitest.config.ts`）。

---

## 文档导航

| 文档 | 内容 | 状态 |
|---|---|---|
| `docs/01-product-plan.md` | 产品功能规划（8 模块 46 功能，R1-R18 决策，N1-N9 非目标） | ✅ v1.0 定稿 |
| `docs/02-architecture.md` | 整体技术架构（Monorepo 六包 / 分层 / 依赖规则） | ✅ |
| `docs/03-data-model.md` | 数据模型（Dexie 六表 / StorageProvider / AssetResolver） | ✅ v1.0 |
| `docs/04-plugin-design.md` | 插件体系（L1/L2 双层 / manifest 契约） | ✅ v1.0 |
| `docs/05-ADR.md` | 架构决策记录（ADR-001 ~ ADR-018） | ✅ 持续追加 |
| `docs/06-roadmap.md` | 里程碑（Phase 0-5 + 发布检查单 §8.1） | ✅ 核心完成 | 
| `PRIVACY.md` | 隐私声明（本地优先、数据不出浏览器） | ✅ 发布就绪 |
| `USER_GUIDE.md` | 用户指南（功能导览 / 快捷键 / 备份恢复 / FAQ） | ✅ 发布就绪 |

---

## 当前状态（v1.0 发布就绪——仅剩部署）

- ✅ Phase 0-4 全部完成（spike / 骨架 / 文档管理 / 表格图片 / 体验打磨）
- ✅ Phase 5 核心：版本快照 / 回收站 30 天 / 全文搜索（MiniSearch）/ 存储配额 / e2e 全量
- ✅ 153 单测全绿（30 文件）+ 6 个 e2e 全过 + typecheck 0 错 + build 通过
- ✅ 发布检查单 §8.1：a11y 走查 / 性能基线 / 首启引导（M1.12）/ 隐私声明（PRIVACY.md）/ 用户文档（USER_GUIDE.md）/ 移动端响应式 全部完成
- ✅ `pnpm build` 产物自包含（编辑器 + 主题 + 表格样式）
- ⏳ 唯一剩余：静态站点部署（Vercel/Cloudflare Pages/GitHub Pages，见 roadmap §8.1）