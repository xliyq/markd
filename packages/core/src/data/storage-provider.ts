/**
 * StorageProvider 接口（对齐 docs/03-data-model.md §5）
 *
 * 位置约定：core/data —— 只定义契约，不实现。
 * Dexie 实现在 infra/dexie/storage-provider-dexie.ts（infra → core，单向依赖）。
 * 未来云同步（M8.2）实现替换同一接口。
 */
import type {
  DocAsset,
  DocContent,
  DocNode,
  DocVersion,
  SnapshotReason,
} from '@editor/shared'

export interface StorageProvider {
  // ── 文档树 ──
  /** 列某父节点下的子节点（null = 根，含 sortOrder 排序） */
  listChildren(parentId: string | null): Promise<DocNode[]>
  getNode(id: string): Promise<DocNode | undefined>
  createNode(node: DocNode): Promise<void>
  renameNode(id: string, name: string): Promise<void>
  /** 移动节点（换 parent + 排序位） */
  moveNode(id: string, newParentId: string | null, sortOrder: number): Promise<void>
  /** 软删除（回收站 M2.6，写 deletedAt） */
  softDelete(id: string): Promise<void>
  restoreNode(id: string): Promise<void>
  /** 永久删除（级联清理 assets/versions） */
  purgeNode(id: string): Promise<void>

  // ── 文档内容 ──
  getDocContent(id: string): Promise<DocContent | undefined>
  /** 保存/更新内容（Partial，需带 id） */
  saveDocContent(partial: Partial<DocContent> & { id: string }): Promise<void>

  // ── 资产（三层）──
  putAsset(asset: DocAsset): Promise<void>
  getAsset(docId: string, relPath: string): Promise<DocAsset | undefined>
  listAssets(docId: string): Promise<DocAsset[]>
  deleteAsset(docId: string, relPath: string): Promise<void>

  // ── 版本快照 ──
  createVersion(docId: string, content: string, reason: SnapshotReason): Promise<void>
  listVersions(docId: string): Promise<DocVersion[]>
  getVersion(id: string): Promise<DocVersion | undefined>
  /** 按保留策略清理旧快照（自动 20 / 手动 200，D2 决策） */
  trimVersions(docId: string): Promise<void>

  // ── 设置 ──
  getSetting<T>(key: string): Promise<T | undefined>
  setSetting<T>(key: string, value: T): Promise<void>

  // ── 通用 ──
  /** 跨表事务（原子操作） */
  tx<T>(fn: () => Promise<T>): Promise<T>
  dispose(): void
}
