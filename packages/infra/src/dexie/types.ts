/**
 * Dexie 表结构类型（对齐 docs/03-data-model.md §3）
 *
 * 六表：files（文档树）/ docs（内容）/ assets（资产）/ versions（快照）/ settings（KV）/ meta（元信息）
 */
import type { Table } from 'dexie'

/** 节点类型：文档 / 文件夹 / 快速记录 */
export type NodeType = 'folder' | 'doc' | 'quicknote'

/** files 表：文档树（轻量节点，不含内容）——D1 分表决策 */
export interface FileRecord {
  /** uuid 主键 */
  id: string
  /** null = 根节点 */
  parentId: string | null
  /** 节点类型 */
  type: NodeType
  /** 标题（文件夹名/文档名） */
  name: string
  /** 同级排序 */
  sortOrder: number
  createdAt: number
  updatedAt: number
  /** 软删除标记（回收站 M2.6） */
  deletedAt: number | null
}

/** docs 表：文档内容（与 files.id 1:1）——Markdown 原文是唯一事实源 */
export interface DocRecord {
  /** 与 files.id 1:1 */
  id: string
  /** Markdown 原文 */
  content: string
  /** 内容哈希（自动保存判重/冲突检测用） */
  contentHash: string
  /** YAML 元数据（M2.8，P2） */
  frontmatter?: Record<string, unknown>
  /** 标签（M2.7，P2） */
  tags?: string[]
  updatedAt: number
}

/** 资产存储层 */
export type AssetTier = 'local' | 'base64' | 'remote'

/** assets 表：文档资产（图片等）——D3 单一 tier 决策 */
export interface AssetRecord {
  id: string
  /** 归属文档 */
  docId: string
  /** 文档内相对路径（`assets/xxx.png`），Markdown 引用它 */
  relPath: string
  mime: string
  size: number
  /** T1 本地二进制（V1 默认） */
  blob?: Blob
  /** T1 base64 备选（小图/单文件场景） */
  base64?: string
  /** T2 图床 URL */
  remoteUrl?: string
  tier: AssetTier
  /** 内容哈希（去重） */
  hash: string
  createdAt: number
}

/** versions 表：版本快照（M2.4）——D2 全文快照 + 上限控制 */
export interface VersionRecord {
  id: string
  docId: string
  /** 快照全文 */
  content: string
  /** 手动保存 / 自动保存 */
  reason: 'manual' | 'autosave'
  createdAt: number
}

/** settings 表：全局设置（KV，JSON 序列化值） */
export interface SettingRecord {
  key: string
  value: unknown
}

/** meta 表：数据模型元信息（Q5 独立表决策） */
export interface MetaRecord {
  key: string
  value: unknown
}

/** Dexie 表格类型声明 */
export interface MilkdownTables {
  files: Table<FileRecord, string>
  docs: Table<DocRecord, string>
  assets: Table<AssetRecord, string>
  versions: Table<VersionRecord, string>
  settings: Table<SettingRecord, string>
  meta: Table<MetaRecord, string>
}

/** 当前 schema 版本（迁移用） */
export const SCHEMA_VERSION = 1
