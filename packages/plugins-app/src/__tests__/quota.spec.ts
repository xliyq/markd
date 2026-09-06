// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieStorageProvider } from '@editor/infra'
import { createQuotaModule } from '../quota'

/**
 * Phase 5 —— 存储配额单测（M7.7）：
 * 各表行数/字节统计、回收站占用、浏览器 estimate 降级（node 无 navigator）。
 */

describe('quota 存储配额', () => {
  let storage: DexieStorageProvider
  let quota: ReturnType<typeof createQuotaModule>
  let fakeBin: { listTrash: () => Promise<{ id: string }[]> } | null

  const api = {
    storage: null as unknown as DexieStorageProvider,
  }

  beforeAll(() => {
    storage = new DexieStorageProvider()
    api.storage = storage
    fakeBin = { listTrash: async () => [{ id: 't1' }] }
    quota = createQuotaModule({ storage, recycleBin: fakeBin } as never)
  })
  afterAll(() => storage.dispose())

  beforeEach(async () => {
    const db = (storage as unknown as { db: { files: { clear: () => Promise<void> }; docs: { clear: () => Promise<void> }; assets: { clear: () => Promise<void> }; versions: { clear: () => Promise<void> }; settings: { clear: () => Promise<void> }; meta: { clear: () => Promise<void> } } }).db
    await Promise.all([db.files.clear(), db.docs.clear(), db.assets.clear(), db.versions.clear(), db.settings.clear(), db.meta.clear()])
  })

  it('node 环境 estimate 降级为 0（无 navigator.storage）', async () => {
    const est = await quota.estimate()
    expect(est).toEqual({ quota: 0, usage: 0 })
  })

  it('各表统计行数 + assets 精确字节', async () => {
    await storage.createNode({ id: 'd1', parentId: null, type: 'doc', name: '配额测试', sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null })
    await storage.saveDocContent({ id: 'd1', content: '# 配额' })
    await storage.putAsset({ id: 'a1', docId: 'd1', relPath: 'assets/x.png', mime: 'image/png', size: 5000, tier: 'local', blob: new Blob([new Uint8Array(5000)]), hash: 'h', createdAt: 1 })

    const r = await quota.report()
    expect(r.tables.find((t) => t.table === 'files')?.rows).toBe(1)
    expect(r.tables.find((t) => t.table === 'docs')?.rows).toBe(1)
    expect(r.tables.find((t) => t.table === 'assets')?.bytes).toBe(5000)
    expect(r.totalBytes).toBeGreaterThan(5000)
  })

  it('回收站占用反映到 trashBytes', async () => {
    const r = await quota.report()
    expect(r.trashBytes).toBeGreaterThan(0) // fake bin 返回 1 条
  })

  it('空库 report 正常（tables 六项）', async () => {
    const r = await quota.report()
    expect(r.tables).toHaveLength(6)
    expect(r.totalBytes).toBe(0)
    expect(r.ratio).toBe(0)
  })
})
