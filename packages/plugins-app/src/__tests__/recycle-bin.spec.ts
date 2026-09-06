// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieStorageProvider } from '@editor/infra'
import { createRecycleBinModule, TRASH_RETENTION_MS } from '../recycle-bin'

/**
 * Phase 5 —— 回收站单测（M2.6）：
 * 已删除节点收集、30 天过期清理、清空回收站。
 */

describe('recycle-bin 回收站', () => {
  let storage: DexieStorageProvider
  let bin: ReturnType<typeof createRecycleBinModule>

  beforeAll(() => {
    storage = new DexieStorageProvider()
    bin = createRecycleBinModule({ storage } as never)
  })
  afterAll(() => storage.dispose())

  beforeEach(async () => {
    const db = (storage as unknown as { db: { files: { clear: () => Promise<void> }; docs: { clear: () => Promise<void> } } }).db
    await Promise.all([db.files.clear(), db.docs.clear()])
  })

  it('软删除节点进入回收站列表', async () => {
    await storage.createNode({ id: 'd1', parentId: null, type: 'doc', name: '待删', sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null })
    await storage.softDelete('d1')
    const trash = await bin.listTrash()
    expect(trash.some((n) => n.id === 'd1')).toBe(true)
  })

  it('cleanExpired 清理超过 30 天的项', async () => {
    await storage.createNode({ id: 'old', parentId: null, type: 'doc', name: '旧', sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: Date.now() - TRASH_RETENTION_MS - 1000 })
    await storage.createNode({ id: 'new', parentId: null, type: 'doc', name: '新', sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: Date.now() })

    const cleaned = await bin.cleanExpired()
    expect(cleaned).toBe(1)
    // 旧的没了，新的还在
    const trash = await bin.listTrash()
    expect(trash.some((n) => n.id === 'old')).toBe(false)
    expect(trash.some((n) => n.id === 'new')).toBe(true)
  })

  it('emptyTrash 清空全部回收站', async () => {
    await storage.createNode({ id: 'a', parentId: null, type: 'doc', name: 'A', sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null })
    await storage.createNode({ id: 'b', parentId: null, type: 'doc', name: 'B', sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null })
    await storage.softDelete('a')
    await storage.softDelete('b')
    const n = await bin.emptyTrash()
    expect(n).toBe(2)
    expect(await bin.listTrash()).toHaveLength(0)
  })

  it('purge 单条永久删除', async () => {
    await storage.createNode({ id: 'p1', parentId: null, type: 'doc', name: 'P', sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null })
    await storage.softDelete('p1')
    await bin.purge('p1')
    expect(await storage.getNode('p1')).toBeUndefined()
  })
})
