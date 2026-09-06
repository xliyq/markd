/**
 * Dexie 数据库实例 + 迁移框架
 *
 * 对齐 docs/03-data-model.md §3/§5：
 * - 六表 schema（files/docs/assets/versions/settings/meta）
 * - db.version(n).stores() 逐版本升级；升级逻辑写在 upgrade(tx) 内（03 §5）
 */
import Dexie, { type Table } from 'dexie'
import type {
  FileRecord,
  DocRecord,
  AssetRecord,
  VersionRecord,
  SettingRecord,
  MetaRecord,
} from './types'
import { migrations, type Migration } from './migration'

/** 数据库名（本地优先，单库） */
export const DB_NAME = 'milkdown-editor'

/**
 * 带类型的具体 Dexie 子类（官方推荐方式：class 继承 Dexie 获得完整泛型）。
 */
export class MilkdownDexie extends Dexie {
  files!: Table<FileRecord, string>
  docs!: Table<DocRecord, string>
  assets!: Table<AssetRecord, string>
  versions!: Table<VersionRecord, string>
  settings!: Table<SettingRecord, string>
  meta!: Table<MetaRecord, string>

  constructor(name: string) {
    super(name)
    // v1：初始六表 schema（03 §3 字段与索引）
    this.version(1).stores({
      files: 'id, parentId, [parentId+sortOrder], type, deletedAt',
      docs: 'id, updatedAt',
      assets: 'id, docId, [docId+relPath], tier',
      versions: 'id, docId, [docId+createdAt]',
      settings: 'key',
      meta: 'key',
    })
    // v1 之后的迁移链（schema 变更在此追加）
    for (const m of migrations) {
      const v = this.version(m.version).stores(m.stores)
      if (m.upgrade) v.upgrade(m.upgrade)
    }
  }
}

/** 创建数据库实例（自动跑迁移链到最新版本） */
export function createDb(): MilkdownDexie {
  return new MilkdownDexie(DB_NAME)
}

export type { Migration }
