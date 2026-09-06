/**
 * StorageProvider 的 Dexie 实现（对齐 03 §5 契约）
 *
 * 位置约定：infra/dexie —— 实现 core/data 定义的接口（infra → core，单向依赖）。
 * 用 fake-indexeddb 可在 Node/单测环境运行。
 */
import type { StorageProvider } from '@editor/core'
import type {
  DocAsset,
  DocContent,
  DocNode,
  DocVersion,
  SnapshotReason,
} from '@editor/shared'
import type { MilkdownDexie } from './db'
import { createDb } from './db'

/** 自动保存快照保留上限（D2 决策，可配） */
export const AUTOSAVE_KEEP = 20
/** 手动保存快照保留上限 */
export const MANUAL_KEEP = 200

/** 简单 uuid（生产可换 uuid 库；Node/浏览器均有 randomUUID） */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** 简易内容哈希（FNV-1a；判重/冲突检测够用，非密码学） */
export function hashContent(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return `fnv1a:${h.toString(16).padStart(8, '0')}`
}

/**
 * IndexedDB 键类型不支持 null（合法键：number/date/string/binary/array）。
 * 文档树 parentId 用空串 '' 表示根节点，IO 层转换。
 */
function dbParentId(parentId: string | null): string {
  return parentId ?? ''
}

function nodeParentId(parentId: string | null): string | null {
  return parentId === '' || parentId == null ? null : parentId
}

export class DexieStorageProvider implements StorageProvider {
  private db: MilkdownDexie

  constructor(db?: MilkdownDexie) {
    this.db = db ?? createDb()
  }

  dispose(): void {
    this.db.close()
  }

  // ── 文档树 ──

  async listChildren(parentId: string | null): Promise<DocNode[]> {
    const rows = await this.db.files.where('parentId').equals(dbParentId(parentId)).toArray()
    return rows
      .map((r) => ({ ...r, parentId: nodeParentId(r.parentId) }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async getNode(id: string): Promise<DocNode | undefined> {
    const row = await this.db.files.get(id)
    return row ? { ...row, parentId: nodeParentId(row.parentId) } : undefined
  }

  async createNode(node: DocNode): Promise<void> {
    await this.db.files.put({ ...node, parentId: dbParentId(node.parentId) })
  }

  async renameNode(id: string, name: string): Promise<void> {
    await this.db.files.update(id, { name, updatedAt: Date.now() })
  }

  async moveNode(id: string, newParentId: string | null, sortOrder: number): Promise<void> {
    await this.db.files.update(id, { parentId: dbParentId(newParentId), sortOrder, updatedAt: Date.now() })
  }

  async softDelete(id: string): Promise<void> {
    await this.db.files.update(id, { deletedAt: Date.now(), updatedAt: Date.now() })
  }

  async restoreNode(id: string): Promise<void> {
    await this.db.files.update(id, { deletedAt: null, updatedAt: Date.now() })
  }

  async purgeNode(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.files, this.db.docs, this.db.assets, this.db.versions, async () => {
      await this.db.files.delete(id)
      await this.db.docs.delete(id)
      // 级联清理资产
      for (const a of await this.db.assets.where('docId').equals(id).toArray()) {
        await this.db.assets.delete(a.id)
      }
      // 级联清理快照
      for (const v of await this.db.versions.where('docId').equals(id).toArray()) {
        await this.db.versions.delete(v.id)
      }
    })
  }

  // ── 文档内容 ──

  async getDocContent(id: string): Promise<DocContent | undefined> {
    return this.db.docs.get(id)
  }

  async saveDocContent(partial: Partial<DocContent> & { id: string }): Promise<void> {
    const existing = await this.db.docs.get(partial.id)
    const content = partial.content ?? existing?.content ?? ''
    await this.db.docs.put({
      id: partial.id,
      content,
      contentHash: partial.contentHash ?? hashContent(content),
      frontmatter: partial.frontmatter ?? existing?.frontmatter,
      tags: partial.tags ?? existing?.tags,
      updatedAt: Date.now(),
    })
  }

  // ── 资产 ──

  async putAsset(asset: DocAsset): Promise<void> {
    await this.db.assets.put(asset)
  }

  async getAsset(docId: string, relPath: string): Promise<DocAsset | undefined> {
    return this.db.assets.where('[docId+relPath]').equals([docId, relPath]).first()
  }

  async listAssets(docId: string): Promise<DocAsset[]> {
    return this.db.assets.where('docId').equals(docId).toArray()
  }

  async deleteAsset(docId: string, relPath: string): Promise<void> {
    const asset = await this.getAsset(docId, relPath)
    if (asset) await this.db.assets.delete(asset.id)
  }

  // ── 版本快照 ──

  async createVersion(docId: string, content: string, reason: SnapshotReason): Promise<void> {
    await this.db.versions.add({
      id: uuid(),
      docId,
      content,
      reason,
      createdAt: Date.now(),
    })
  }

  async listVersions(docId: string): Promise<DocVersion[]> {
    const rows = await this.db.versions.where('docId').equals(docId).toArray()
    // 新→旧
    return rows.sort((a, b) => b.createdAt - a.createdAt)
  }

  async getVersion(id: string): Promise<DocVersion | undefined> {
    return this.db.versions.get(id)
  }

  async trimVersions(docId: string): Promise<void> {
    const all = await this.db.versions.where('docId').equals(docId).toArray()
    const manual = all.filter((v) => v.reason === 'manual').sort((a, b) => b.createdAt - a.createdAt)
    const autosave = all.filter((v) => v.reason === 'autosave').sort((a, b) => b.createdAt - a.createdAt)
    const toDelete = [...manual.slice(MANUAL_KEEP), ...autosave.slice(AUTOSAVE_KEEP)]
    await this.db.transaction('rw', this.db.versions, async () => {
      for (const v of toDelete) await this.db.versions.delete(v.id)
    })
  }

  // ── 设置 ──

  async getSetting<T>(key: string): Promise<T | undefined> {
    const row = await this.db.settings.get(key)
    return row?.value as T | undefined
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    await this.db.settings.put({ key, value })
  }

  // ── 通用 ──

  tx<T>(fn: () => Promise<T>): Promise<T> {
    return fn()
  }
}
