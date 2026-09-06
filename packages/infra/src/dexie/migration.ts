/**
 * 数据库迁移链（03 §5：Dexie db.version(n).stores() 逐版本升级）
 *
 * 规则：
 * - 每个迁移声明一个版本号 + 该版本的完整 schema + 可选 upgrade 数据迁移
 * - 版本号必须递增，db.ts 按序应用
 * - v1 为初始 schema（在 db.ts 里），此处只登记 v2+ 的变更
 */
import type { Transaction } from 'dexie'

export interface Migration {
  /** 目标版本号（>1） */
  version: number
  /** 该版本的完整 stores 声明（覆盖式） */
  stores: Record<string, string>
  /** 可选：数据升级逻辑 */
  upgrade?: (tx: Transaction) => void | Promise<void>
}

/**
 * 迁移链（按版本升序）。
 *
 * 示例（未来加字段时这样写）：
 * { version: 2, stores: { ...v1全量, files: 'id, parentId, [parentId+sortOrder], type, deletedAt, newField' }, upgrade: tx => { ... } }
 */
export const migrations: Migration[] = []
