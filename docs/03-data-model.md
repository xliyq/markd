# Milkdown 编辑器 — 数据模型设计 (Data Model)

| 项目       | 内容                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| 状态       | **v1.0 定稿**（评审通过 2026-08-31，决策 D1-D5）                                          |
| 关联       | 01-product-plan.md（R7/R15 等存储决策）、02-architecture.md（L4 数据层）                  |
| 本文档职责 | Dexie 表结构、文档/资产/版本 schema、StorageProvider/AssetResolver 接口、数据流与迁移策略 |

---

## 1. 继承的设计约束（来自已定稿决策）

| 约束                                                               | 来源          |
| ------------------------------------------------------------------ | ------------- |
| 存储格式：**Markdown 原文 + 元数据**，ProseMirror JSON 仅运行时态  | 01 §5         |
| 本地优先：IndexedDB（Dexie 封装）为唯一事实源                      | 01 §1 / 02 §1 |
| 图片三层存储：T1 assets 相对路径（默认）/ base64；T2 图床远程 URL  | 01 R7         |
| 导出 zip：.md + assets 文件夹（未配图床）                          | 01 R15        |
| 版本快照：每次保存留存，可回滚                                     | 01 M2.4       |
| 数据备份：全量 JSON 导出/导入                                      | 01 M7.2       |
| 存储配额管理：监控 + 快照上限 + 超限引导                           | 01 M7.6       |
| L4 数据层位于 packages/infra（实现），接口在 packages/core（定义） | 02 §6         |
| 接口契约：StorageProvider（数据访问）、AssetResolver（资源解析）   | 02 §4.3/§4.4  |

---

## 2. 实体关系总览（ER）

```
files（文档树，轻量节点）
  ├── docs（文档内容，1:1）          —— Markdown 原文 + 元数据
  ├── assets（文档资产, 1:N）        —— 图片等二进制资源
  ├── versions（版本快照, 1:N）      —— 内容历史
  └── recent（最近打开, 1:1）        —— 最近访问记录
settings（全局设置，KV）
[sync_queue]（预留，V1 不建表）
```

---

## 3. Dexie 表结构设计

### 3.1 files 表 —— 文档树（轻量节点，不含内容）

> D1 决策：**分表**（files 轻量 / docs 内容）。树遍历不背内容，保证大目录性能。

> 文档树与内容分表：树遍历不加载内容，保证大目录性能。

| 字段                  | 类型                             | 说明                      |
| --------------------- | -------------------------------- | ------------------------- |
| id                    | string (PK)                      | uuid                      |
| parentId              | string \| null                   | null = 根节点             |
| type                  | 'folder' \| 'doc' \| 'quicknote' | 文档/文件夹/快速记录      |
| name                  | string                           | 标题（文件夹名/文档名）   |
| sortOrder             | number                           | 同级排序                  |
| createdAt / updatedAt | number                           | 时间戳                    |
| deletedAt             | number \| null                   | 软删除标记（回收站 M2.6） |

索引：`parentId + sortOrder`（同级遍历）、`type`。

> D4 决策：回收站保留周期 **30 天**，超期自动永久删除（purgeNode 级联清理）。

### 3.2 docs 表 —— 文档内容

| 字段        | 类型        | 说明                                |
| ----------- | ----------- | ----------------------------------- |
| id          | string (PK) | 与 files.id 1:1                     |
| content     | string      | Markdown 原文（唯一事实源）         |
| contentHash | string      | 内容哈希（自动保存判重/冲突检测用） |
| frontmatter | object?     | YAML 元数据（M2.8，P2）             |
| tags        | string[]?   | 标签（M2.7，P2）                    |
| updatedAt   | number      | 最后修改时间                        |

索引：`updatedAt`（最近打开排序）。

### 3.3 assets 表 —— 文档资产（图片等）

| 字段      | 类型                            | 说明                               |
| --------- | ------------------------------- | ---------------------------------- |
| id        | string (PK)                     | uuid                               |
| docId     | string                          | 归属文档                           |
| relPath   | string                          | 文档内相对路径（`assets/xxx.png`） |
| mime      | string                          | 类型                               |
| size      | number                          | 字节数                             |
| blob      | Blob?                           | T1 本地存储的二进制（V1 默认）     |
| base64    | string?                         | T1 base64 备选（小图/单文件场景）  |
| remoteUrl | string?                         | T2 图床 URL                        |
| tier      | 'local' \| 'base64' \| 'remote' | 当前存储层                         |
| hash      | string                          | 内容哈希（去重）                   |
| createdAt | number                          |                                    |

索引：`docId + relPath`（复合唯一，文档内资源定位）、`docId`。

> D3 决策：资产保持**单一 tier**，切换存储层时转换（如 base64 → local 时生成 blob 并清除 base64 字段）。

> **relPath 与 docId 双键的设计理由**：Markdown 里存相对路径（可移植），数据层里按 docId 定位二进制。移动文档时 relPath 不变、assets 行不变，仅 files.parentId 更新——**无需迁移 assets**（见 §7.5 澄清，修正 01 风险表措辞）。

### 3.4 versions 表 —— 版本快照（M2.4）

| 字段      | 类型                   | 说明                |
| --------- | ---------------------- | ------------------- |
| id        | string (PK)            | uuid                |
| docId     | string                 | 所属文档            |
| content   | string                 | 快照全文            |
| reason    | 'manual' \| 'autosave' | 手动保存 / 自动保存 |
| createdAt | number                 | 快照时间            |

索引：`docId + createdAt`（按文档取历史）。

**保留策略**（配合 M7.6；D2 决策：V1 全文快照 + 上限控制，diff 后续优化）：

- 自动保存快照：仅保留最近 N 条（默认 20，可配），超限删除最旧
- 手动保存快照：常驻（可配上限，如 200）
- 文档删除时级联清理

### 3.5 settings 表 —— 全局设置（KV）

| 字段  | 类型        | 说明              |
| ----- | ----------- | ----------------- |
| key   | string (PK) | 设置键            |
| value | any         | 值（JSON 序列化） |

示例键：`theme`、`fontSize`、`shortcuts`、`image.tier`（图床配置）、`editor.behavior.*`。

### 3.6 meta 表 —— 数据模型元信息（Q5 决策：独立表）

| 字段  | 类型        | 说明     |
| ----- | ----------- | -------- |
| key   | string (PK) | 元信息键 |
| value | any         | 值       |

初始键：`schemaVersion`（当前数据模型版本，迁移时比对）、`dbVersion`。

### 3.7 预留：sync_queue

> 云同步（M8.2）预留。V1 **不建表**，接口层留 `SyncQueue` 类型定义于 core/data，避免空设计。见 §8。

---

## 4. 核心类型定义（TS 草案，位于 packages/shared/types）

```ts
// ---- 文档树 ----
type NodeType = "folder" | "doc" | "quicknote";

interface DocNode {
  id: string;
  parentId: string | null;
  type: NodeType;
  name: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

// ---- 文档内容 ----
interface DocContent {
  id: string; // = DocNode.id
  content: string; // Markdown 原文
  contentHash: string;
  frontmatter?: Record<string, unknown>;
  tags?: string[];
  updatedAt: number;
}

// ---- 资产（三层） ----
type AssetTier = "local" | "base64" | "remote";

interface DocAsset {
  id: string;
  docId: string;
  relPath: string; // assets/xxx.png
  mime: string;
  size: number;
  tier: AssetTier;
  blob?: Blob; // T1 local
  base64?: string; // T1 base64
  remoteUrl?: string; // T2 remote
  hash: string;
  createdAt: number;
}

// ---- 版本快照 ----
type SnapshotReason = "manual" | "autosave";

interface DocVersion {
  id: string;
  docId: string;
  content: string;
  reason: SnapshotReason;
  createdAt: number;
}

// ---- 最近打开 ----
interface RecentDoc {
  docId: string;
  lastOpenedAt: number;
}
```

---

## 5. StorageProvider 接口（packages/core/data/storage-provider.ts）

> 只定义契约，Dexie 实现放 packages/infra/dexie。同步实现（M8.2）替换同一接口。

```ts
interface StorageProvider {
  // ── 文档树 ──
  listChildren(parentId: string | null): Promise<DocNode[]>;
  getNode(id: string): Promise<DocNode | undefined>;
  createNode(node: DocNode): Promise<void>;
  renameNode(id: string, name: string): Promise<void>;
  moveNode(id: string, newParentId: string | null, sortOrder: number): Promise<void>;
  softDelete(id: string): Promise<void>; // 回收站 M2.6
  restoreNode(id: string): Promise<void>;
  purgeNode(id: string): Promise<void>; // 永久删除（级联 assets/versions）

  // ── 文档内容 ──
  getDocContent(id: string): Promise<DocContent | undefined>;
  saveDocContent(partial: Partial<DocContent> & { id: string }): Promise<void>;

  // ── 资产 ──
  putAsset(asset: DocAsset): Promise<void>;
  getAsset(docId: string, relPath: string): Promise<DocAsset | undefined>;
  listAssets(docId: string): Promise<DocAsset[]>;
  deleteAsset(docId: string, relPath: string): Promise<void>;

  // ── 版本快照 ──
  createVersion(docId: string, content: string, reason: SnapshotReason): Promise<void>;
  listVersions(docId: string): Promise<DocVersion[]>;
  getVersion(id: string): Promise<DocVersion | undefined>;
  trimVersions(docId: string): Promise<void>; // 按保留策略清理

  // ── 设置 ──
  getSetting<T>(key: string): Promise<T | undefined>;
  setSetting<T>(key: string, value: T): Promise<void>;

  // ── 通用 ──
  tx<T>(fn: () => Promise<T>): Promise<T>; // 跨表事务
  dispose(): void;
}
```

---

## 6. AssetResolver 接口（packages/core/data/asset-resolver.ts）

```ts
interface AssetResolver {
  // 渲染：assets/xxx → 可显示 URL（T1: blob URL；T2: remoteUrl）
  toDisplayUrl(docId: string, relPath: string): Promise<string>;

  // 序列化回 Markdown：还原相对路径
  toMarkdownPath(asset: DocAsset): string;

  // 导出：内嵌 base64（HTML/PDF 单文件）或复制到导出目录（zip）
  inlineForExport(asset: DocAsset): Promise<string>; // data URI

  // 文档删除：级联清理该文档全部资源
  purgeDocAssets(docId: string): Promise<void>;
}
```

实现位置：`packages/infra`（T1 依赖 Dexie；T2 依赖图床 provider）。

---

## 7. 关键数据流

### 7.1 打开文档

```
files.getNode(id) ──▶ docs.getDocContent(id) ──▶ markdown 原文
      ──▶ editor-factory 创建编辑器 ──▶ AssetResolver 渲染图片
      ──▶ recent 写入最近打开
```

### 7.2 自动保存（防抖）

```
编辑变更 ──▶ 防抖 800ms ──▶ serialize(markdown)
      ──▶ saveDocContent（contentHash 判重，无变化则跳过）
      ──▶ 可选 createVersion(reason='autosave')（按保留策略）
```

### 7.3 版本快照（M2.4）

```
手动保存(Ctrl+S) ──▶ saveDocContent + createVersion('manual') + trimVersions
自动保存           ──▶ saveDocContent；仅当距上次快照 > 阈值 或 内容变化大 → 快照
```

### 7.4 导出 zip（M3.1）

```
读取 docs.content ──▶ listAssets(docId)
      ──▶ jszip: { document.md, assets/<file> } 打包下载
已配图床：纯 .md（引用 remoteUrl），不打包
```

### 7.5 文档移动（修正 01 风险表）

```
files.moveNode(id, newParentId, sortOrder)   ← 仅此一步
```

assets 按 `docId` 归属、relPath 为相对路径 → **移动无需迁移 assets**。

> ⚠️ 此发现修正 01 风险表「文档移动须同步迁移 assets」：在 IDB 虚拟目录模型下该风险不存在；仅在 Tauri 真实目录模型下（未来）需按文件夹物理移动。05-ADR 将记录此修正。

### 7.6 多标签冲突检测（M7.5）

```
BroadcastChannel('doc-lock') 广播
  ├─ 打开文档时：检查 he who 已打开同 docId → 提示只读/新窗口
  └─ 保存时：校验 contentHash 与打开时一致 → 不一致提示冲突
```

### 7.7 数据备份/恢复（M7.2）

```
导出：全量 JSON { files, docs, assets(base64), settings, version:1 }
恢复：事务导入，Dexie bulkPut + 版本校验
```

---

## 8. 与各包的对应关系

| 内容                                 | 包/位置                   |
| ------------------------------------ | ------------------------- |
| 类型定义（DocNode/DocAsset/...）     | packages/shared/src/types |
| StorageProvider / AssetResolver 接口 | packages/core/src/data    |
| Dexie 实现（表/迁移/事务）           | packages/infra/src/dexie  |
| 导出引擎（zip/html/pdf 内嵌）        | packages/infra/src/export |
| 全文搜索（V1 遍历 / P2 词法索引）    | packages/infra/src/search |

---

## 9. 迁移策略（M7.3）

- Dexie `db.version(n).stores()` 逐版本升级；升级逻辑写在 `upgrade(tx)` 内
- 迁移类型：加表 / 加字段 / 索引变更 / 数据改写（如 assets 从 base64 迁移到 blob）
- 每次 schema 变更同步 bump `ORM_SCHEMA_VERSION`（settings 表记录当前版本）
- 备份/恢复时校验版本，不兼容则拒绝或提示先升级

---

## 10. 存储配额管理（M7.6）

| 项           | 策略                                                          |
| ------------ | ------------------------------------------------------------- |
| 配额监控     | `navigator.storage.estimate()` 定期检查（打开/设置页/保存时） |
| 版本快照上限 | 自动保存 20 条 / 手动 200 条（可配），trimVersions 兜底       |
| 超限引导     | 提示：清理版本快照 / 清理回收站 / 导出备份后删除大资产        |
| assets 体积  | base64 资产在写入时检查单文件阈值（如 > 2MB 建议转 blob）     |

---

## 11. 已确认决策（评审通过 2026-08-31）

| #   | 决策点          | 结论                                                            |
| --- | --------------- | --------------------------------------------------------------- |
| D1  | 文档树/内容分表 | **分表**：files 轻量节点 + docs 内容（3.1/3.2）                 |
| D2  | 版本快照存储    | V1 **全文快照 + 上限控制**（自动 20 / 手动 200），diff 后续优化 |
| D3  | 资产 tier       | **单一 tier**，切换存储层时转换（3.3）                          |
| D4  | 回收站周期      | **30 天**自动永久删除（3.1）                                    |
| D5  | schema 版本号   | **独立 meta 表**（3.6），迁移时比对                             |
