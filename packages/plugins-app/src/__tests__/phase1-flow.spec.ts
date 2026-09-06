import 'fake-indexeddb/auto'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DexieStorageProvider } from '@editor/infra'
import type { StorageProvider } from '@editor/core'
import { createPersistenceModule } from '../persistence'

/**
 * Phase 1 出口验收：新建文档 → 自动保存 → 重开加载 全流程。
 * 用真实 DexieStorageProvider（fake-indexeddb）走通数据闭环。
 */

describe('Phase 1 全流程（新建 → 保存 → 重开）', () => {
  let storage: StorageProvider
  let persistence: ReturnType<typeof createPersistenceModule>
  let createdId: string

  beforeAll(async () => {
    storage = new DexieStorageProvider()
    // 构造最小 AppApi（仅注入 storage，persistence 只用它）
    const api = { storage } as never
    persistence = createPersistenceModule(api)
  })

  afterAll(() => {
    storage.dispose()
  })

  it('1. 新建文档（files + docs 两表写入）', async () => {
    const node = await persistence.create('我的第一篇文档', null)
    createdId = node.id
    expect(node.id).toBeTruthy()
    expect(node.type).toBe('doc')

    // 双表落库
    const stored = await storage.getNode(node.id)
    expect(stored?.name).toBe('我的第一篇文档')
    const doc = await storage.getDocContent(node.id)
    expect(doc).toBeDefined()
  })

  it('2. 写入内容（模拟用户输入）', async () => {
    const md = '# 标题\n\n这是 **正文** 内容'
    await persistence.save(createdId, md)
    const doc = await storage.getDocContent(createdId)
    expect(doc?.content).toBe(md)
    expect(doc?.contentHash).toBeTruthy()
  })

  it('3. 重开加载（内容完整读回）', async () => {
    const doc = await persistence.open(createdId)
    expect(doc?.content).toContain('# 标题')
    expect(doc?.content).toContain('**正文**')
  })

  it('4. 文档树可见（listChildren 根节点）', async () => {
    const nodes = await storage.listChildren(null)
    // 至少包含 doc-1 和新建的文档
    const ids = nodes.map((n) => n.id)
    expect(ids).toContain(createdId)
  })
})
