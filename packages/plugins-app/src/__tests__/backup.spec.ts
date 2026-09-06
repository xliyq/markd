// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieStorageProvider } from '@editor/infra'
import { createBackupModule } from '../backup'
import { blobToBase64, base64ToBlob } from '../backup'

/**
 * M7.2 数据备份单测：
 * 导出全量 JSON（含 Blob→base64）、导入恢复往返（Blob 保真）、无效文件拒绝。
 */

describe('blob 编解码', () => {
  it('base64 往返保真', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03])
    const b64 = await blobToBase64(new Blob([bytes], { type: 'image/png' }))
    const back = base64ToBlob(b64, 'image/png')
    const arr = new Uint8Array(await back.arrayBuffer())
    expect(arr).toEqual(bytes)
  })
})

describe('backup 导出/导入', () => {
  let storage: DexieStorageProvider
  let backup: ReturnType<typeof createBackupModule>

  beforeAll(() => {
    storage = new DexieStorageProvider()
    backup = createBackupModule({ storage } as never)
  })
  afterAll(() => storage.dispose())

  beforeEach(async () => {
    const db = (storage as unknown as { db: { files: { clear: () => Promise<void> }; docs: { clear: () => Promise<void> }; assets: { clear: () => Promise<void> }; settings: { clear: () => Promise<void> }; versions: { clear: () => Promise<void> }; meta: { clear: () => Promise<void> } } }).db
    await Promise.all([db.files.clear(), db.docs.clear(), db.assets.clear(), db.settings.clear(), db.versions.clear(), db.meta.clear()])
  })

  it('导出含文档树 + 内容 + 资产（Blob base64）', async () => {
    // 造数据
    await storage.createNode({ id: 'd1', parentId: null, type: 'doc', name: '备份测试', sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null })
    await storage.saveDocContent({ id: 'd1', content: '# 备份\n\n内容' })
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    await storage.putAsset({ id: 'a1', docId: 'd1', relPath: 'assets/x.png', mime: 'image/png', size: 8, tier: 'local', blob: new Blob([png], { type: 'image/png' }), hash: 'h', createdAt: 1 })

    const { json, name } = await backup.exportBackup()
    expect(name).toMatch(/^milkdown-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const payload = JSON.parse(json)
    expect(payload.app).toBe('milkdown')
    expect(payload.docs).toHaveLength(1)
    expect(payload.files).toHaveLength(1)
    expect(payload.assets[0].blobBase64).toBeTruthy()
  })

  it('导出 → 清空 → 导入 → 数据完整恢复（含 Blob）', async () => {
    await storage.createNode({ id: 'd2', parentId: null, type: 'doc', name: '往返', sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null })
    await storage.saveDocContent({ id: 'd2', content: '# 往返内容' })
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02])
    await storage.putAsset({ id: 'a2', docId: 'd2', relPath: 'assets/a.png', mime: 'image/png', size: 7, tier: 'local', blob: new Blob([png], { type: 'image/png' }), hash: 'h', createdAt: 1 })

    const { json } = await backup.exportBackup()

    // 清空
    const db = (storage as unknown as { db: { files: { clear: () => Promise<void> }; docs: { clear: () => Promise<void> }; assets: { clear: () => Promise<void> } } }).db
    await Promise.all([db.files.clear(), db.docs.clear(), db.assets.clear()])

    // 导入
    const stat = await backup.importBackup(json)
    expect(stat.files).toBe(1)
    expect(stat.docs).toBe(1)
    expect(stat.assets).toBe(1)

    // 验证
    const doc = await storage.getDocContent('d2')
    expect(doc?.content).toBe('# 往返内容')
    const asset = await storage.getAsset('d2', 'assets/a.png')
    const arr = new Uint8Array(await asset!.blob!.arrayBuffer())
    expect(arr).toEqual(png)
  })

  it('无效备份文件被拒绝', async () => {
    await expect(backup.importBackup('{"foo":1}')).rejects.toThrow('无效的备份文件')
  })
})
