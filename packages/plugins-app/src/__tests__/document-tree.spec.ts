import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieStorageProvider } from '@editor/infra'
import type { StorageProvider } from '@editor/core'
import { createDocumentTreeModule } from '../document-tree'
import type { DocumentTreeModule } from '../document-tree'

/**
 * Phase 2 —— document-tree L2 模块单测：
 * 列表过滤、新建、重命名、软删除/恢复、回收站、子树收集。
 */

describe('document-tree 文档树模块', () => {
  let storage: StorageProvider
  let tree: DocumentTreeModule

  beforeAll(() => {
    storage = new DexieStorageProvider()
    const api = { storage } as never
    tree = createDocumentTreeModule(api)
  })

  afterAll(() => storage.dispose())

  beforeEach(async () => {
    // 经 Dexie 实例清空六表（storage 私有 db 的公开类型化访问）
    const db = (storage as unknown as { db: {
      files: { clear: () => Promise<void> }
      docs: { clear: () => Promise<void> }
      assets: { clear: () => Promise<void> }
      versions: { clear: () => Promise<void> }
      settings: { clear: () => Promise<void> }
      meta: { clear: () => Promise<void> }
    } }).db
    await db.files.clear()
    await db.docs.clear()
    await db.assets.clear()
    await db.versions.clear()
    await db.settings.clear()
    await db.meta.clear()
  })

  it('新建文档 + 列表（根节点可见）', async () => {
    const doc = await tree.create('第一篇文档')
    expect(doc.type).toBe('doc')

    const list = await tree.list(null)
    expect(list).toHaveLength(1)
    expect(list[0]?.name).toBe('第一篇文档')
  })

  it('新建文件夹 + 嵌套文档 + 子级列表', async () => {
    const folder = await tree.createFolder('工作')
    const child = await tree.create('周报', folder.id)

    // 根只看到文件夹
    const roots = await tree.list(null)
    expect(roots.map((n) => n.id)).toEqual([folder.id])

    // 子级看到文档
    const children = await tree.list(folder.id)
    expect(children.map((n) => n.id)).toEqual([child.id])
  })

  it('重命名', async () => {
    const doc = await tree.create('旧名')
    await tree.rename(doc.id, '新名')
    const list = await tree.list(null)
    expect(list[0]?.name).toBe('新名')
  })

  it('软删除 → 列表过滤 + 回收站可见 + 恢复', async () => {
    const doc = await tree.create('临时文档')
    await tree.remove(doc.id)

    const list = await tree.list(null)
    expect(list).toHaveLength(0) // 已删除不进正常列表

    const trash = await tree.listTrash()
    expect(trash.map((n) => n.id)).toEqual([doc.id])

    await tree.restore(doc.id)
    const after = await tree.list(null)
    expect(after).toHaveLength(1)
  })

  it('collectSubtree 收集文件夹全部后代 id', async () => {
    const folder = await tree.createFolder('项目')
    const a = await tree.create('A.md', folder.id)
    const sub = await tree.createFolder('子目录', folder.id)
    const b = await tree.create('B.md', sub.id)

    const ids = await tree.collectSubtree(folder.id)
    // folder + a + sub + b
    expect(ids).toEqual(expect.arrayContaining([folder.id, a.id, sub.id, b.id]))
    expect(ids).toHaveLength(4)
  })
})
