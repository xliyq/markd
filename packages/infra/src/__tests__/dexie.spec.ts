import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieStorageProvider, uuid, hashContent, AUTOSAVE_KEEP, MANUAL_KEEP } from '../dexie/storage-provider-dexie'
import type { DocNode, DocAsset } from '@editor/shared'

/**
 * Phase 1 —— 数据层单测：
 * 基于 fake-indexeddb 真实执行 IndexedDB 操作（六表 + StorageProvider 契约）。
 */

function makeNode(over: Partial<DocNode> = {}): DocNode {
  const now = Date.now()
  return {
    id: uuid(),
    parentId: null,
    type: 'doc',
    name: '未命名',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...over,
  }
}

describe('Dexie 数据层', () => {
  let sp: DexieStorageProvider

  beforeAll(() => {
    sp = new DexieStorageProvider()
  })
  afterAll(() => {
    sp.dispose()
  })
  beforeEach(async () => {
    // 清空所有表（避免测试间串扰）
    const db = (sp as any).db
    await db.files.clear()
    await db.docs.clear()
    await db.assets.clear()
    await db.versions.clear()
    await db.settings.clear()
  })

  describe('文档树', () => {
    it('创建节点 + 按父节点列出子节点（sortOrder 排序）', async () => {
      const a = makeNode({ id: 'root-a', name: 'A', sortOrder: 2 })
      const b = makeNode({ id: 'root-b', name: 'B', sortOrder: 0 })
      const child = makeNode({ id: 'child-1', name: '子文档', parentId: 'root-a', sortOrder: 1 })
      await sp.createNode(a)
      await sp.createNode(b)
      await sp.createNode(child)

      const roots = await sp.listChildren(null)
      expect(roots.map((n) => n.id)).toEqual(['root-b', 'root-a']) // sortOrder 升序

      const children = await sp.listChildren('root-a')
      expect(children.map((n) => n.id)).toEqual(['child-1'])
    })

    it('重命名 + 移动节点', async () => {
      await sp.createNode(makeNode({ id: 'doc-1', name: '旧名' }))
      await sp.renameNode('doc-1', '新名')
      const renamed = await sp.getNode('doc-1')
      expect(renamed?.name).toBe('新名')

      await sp.createNode(makeNode({ id: 'folder-1', type: 'folder', name: '文件夹' }))
      await sp.moveNode('doc-1', 'folder-1', 5)
      const moved = await sp.getNode('doc-1')
      expect(moved?.parentId).toBe('folder-1')
      expect(moved?.sortOrder).toBe(5)
    })

    it('软删除 + 恢复 + 永久删除（级联清理）', async () => {
      await sp.createNode(makeNode({ id: 'doc-1' }))
      // 绑内容 + 资产 + 快照
      await sp.saveDocContent({ id: 'doc-1', content: '# 测试' })
      await sp.putAsset({
        id: 'asset-1', docId: 'doc-1', relPath: 'assets/x.png',
        mime: 'image/png', size: 1, tier: 'local', hash: 'h', createdAt: Date.now(),
      })
      await sp.createVersion('doc-1', '# 测试', 'autosave')

      await sp.softDelete('doc-1')
      expect((await sp.getNode('doc-1'))?.deletedAt).not.toBeNull()

      await sp.restoreNode('doc-1')
      expect((await sp.getNode('doc-1'))?.deletedAt).toBeNull()

      await sp.purgeNode('doc-1')
      expect(await sp.getNode('doc-1')).toBeUndefined()
      expect(await sp.getDocContent('doc-1')).toBeUndefined()
      expect(await sp.listAssets('doc-1')).toHaveLength(0)
      expect(await sp.listVersions('doc-1')).toHaveLength(0)
    })
  })

  describe('文档内容', () => {
    it('保存自动计算 contentHash，缺字段补全', async () => {
      await sp.saveDocContent({ id: 'doc-1', content: 'hello world' })
      const doc = await sp.getDocContent('doc-1')
      expect(doc?.content).toBe('hello world')
      expect(doc?.contentHash).toBe(hashContent('hello world'))
      expect(doc?.updatedAt).toBeGreaterThan(0)
    })

    it('内容变更后 hash 随之变化（判重依据）', async () => {
      await sp.saveDocContent({ id: 'doc-1', content: 'v1' })
      const h1 = (await sp.getDocContent('doc-1'))?.contentHash
      await sp.saveDocContent({ id: 'doc-1', content: 'v2' })
      const h2 = (await sp.getDocContent('doc-1'))?.contentHash
      expect(h1).not.toBe(h2)
    })
  })

  describe('资产', () => {
    const asset = (over: Partial<DocAsset> = {}): DocAsset => ({
      id: uuid(), docId: 'doc-1', relPath: 'assets/a.png',
      mime: 'image/png', size: 10, tier: 'local', hash: 'abc', createdAt: Date.now(),
      ...over,
    })

    it('put + get（按 docId+relPath）+ list + delete', async () => {
      await sp.putAsset(asset({ relPath: 'assets/a.png' }))
      await sp.putAsset(asset({ relPath: 'assets/b.png' }))

      const got = await sp.getAsset('doc-1', 'assets/a.png')
      expect(got?.relPath).toBe('assets/a.png')

      const all = await sp.listAssets('doc-1')
      expect(all).toHaveLength(2)

      await sp.deleteAsset('doc-1', 'assets/a.png')
      expect(await sp.getAsset('doc-1', 'assets/a.png')).toBeUndefined()
    })
  })

  describe('版本快照', () => {
    it('listVersions 按新→旧排序', async () => {
      await sp.createVersion('doc-1', 'v1', 'manual')
      await new Promise((r) => setTimeout(r, 2))
      await sp.createVersion('doc-1', 'v2', 'manual')
      const list = await sp.listVersions('doc-1')
      expect(list[0]?.content).toBe('v2')
      expect(list[1]?.content).toBe('v1')
    })

    it('trimVersions 保留自动 20 / 手动 200 上限', async () => {
      for (let i = 0; i < 25; i++) {
        await sp.createVersion('doc-1', `auto-${i}`, 'autosave')
      }
      await sp.createVersion('doc-1', 'manual-save', 'manual')
      await sp.trimVersions('doc-1')
      const autosaveLeft = (await sp.listVersions('doc-1')).filter((v) => v.reason === 'autosave')
      const manualLeft = (await sp.listVersions('doc-1')).filter((v) => v.reason === 'manual')
      expect(autosaveLeft.length).toBe(AUTOSAVE_KEEP)
      expect(manualLeft.length).toBe(1) // 未超 MANUAL_KEEP
    })
  })

  describe('设置', () => {
    it('get/set KV 往返', async () => {
      expect(await sp.getSetting('theme')).toBeUndefined()
      await sp.setSetting('theme', 'dark')
      expect(await sp.getSetting<string>('theme')).toBe('dark')
      await sp.setSetting('fontSize', 15)
      expect(await sp.getSetting<number>('fontSize')).toBe(15)
    })
  })
})
