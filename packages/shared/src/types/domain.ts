/**
 * 领域核心类型（对齐 docs/03-data-model.md §4）
 *
 * 位置约定：shared/types —— 被 core/infra/plugins 三包共享（包间依赖单向规则）
 */

// ---- 文档树 ----
export type NodeType = 'folder' | 'doc' | 'quicknote'

export interface DocNode {
  id: string
  parentId: string | null
  type: NodeType
  name: string
  sortOrder: number
  createdAt: number
  updatedAt: number
  /** 软删除标记（回收站 M2.6） */
  deletedAt: number | null
  /** 文档内容字节数（文档树展示；仅 doc 节点，由 document-tree list 填充） */
  size?: number
}

// ---- 文档内容 ----
export interface DocContent {
  /** = DocNode.id */
  id: string
  /** Markdown 原文（唯一事实源） */
  content: string
  contentHash: string
  frontmatter?: Record<string, unknown>
  tags?: string[]
  updatedAt: number
}

// ---- 资产（三层存储）----
export type AssetTier = 'local' | 'base64' | 'remote'

export interface DocAsset {
  id: string
  docId: string
  /** assets/xxx.png（Markdown 引用它，可移植） */
  relPath: string
  mime: string
  size: number
  tier: AssetTier
  /** T1 local */
  blob?: Blob
  /** T1 base64 */
  base64?: string
  /** T2 remote */
  remoteUrl?: string
  hash: string
  createdAt: number
}

// ---- 版本快照 ----
export type SnapshotReason = 'manual' | 'autosave'

export interface DocVersion {
  id: string
  docId: string
  content: string
  reason: SnapshotReason
  createdAt: number
}

// ---- 最近打开 ----
export interface RecentDoc {
  docId: string
  lastOpenedAt: number
}
