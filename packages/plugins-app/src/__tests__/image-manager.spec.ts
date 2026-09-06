// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieStorageProvider } from '@editor/infra'
import { createImageManagerModule } from '../image-manager'
import type { ImageManagerModule } from '../image-manager'

/**
 * Phase 3 —— 图片存储管线单测（M4.2/M4.2a）：
 * 文件 → assets 表落库（T1 local）→ relPath 返回；getBlobUrl / resolveDocAssets 解析。
 */

function makePngFile(name = 'pic.png') {
  // 1x1 PNG
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
  return new File([bytes], name, { type: 'image/png' })
}

describe('image-manager 图片存储管线', () => {
  let storage: DexieStorageProvider
  let mgr: ImageManagerModule

  beforeAll(() => {
    storage = new DexieStorageProvider()
    mgr = createImageManagerModule({ storage } as never)
  })
  afterAll(() => storage.dispose())

  beforeEach(async () => {
    const db = (storage as unknown as { db: { assets: { clear: () => Promise<void> } } }).db
    await db.assets.clear()
  })

  it('saveImageFile：图片落库并返回 assets/ 相对路径', async () => {
    const relPath = await mgr.saveImageFile('doc-1', makePngFile())
    expect(relPath).toMatch(/^assets\/.*\.png$/)

    // 资产已入表（T1 local + blob 可读）
    const asset = await storage.getAsset('doc-1', relPath)
    expect(asset?.tier).toBe('local')
    expect(asset?.mime).toBe('image/png')
    expect(asset?.blob).toBeDefined()
  })

  it('handleFiles：多图批量落库', async () => {
    const map = await mgr.handleFiles([makePngFile('a.png'), makePngFile('b.png')])
    expect(map.size).toBe(2)
    const assets = await storage.listAssets('pending')
    expect(assets.length).toBe(2)
    for (const rel of map.values()) {
      expect(rel).toMatch(/^assets\//)
    }
  })

  it('非图片文件被过滤（handleFiles 只收 image/*）', async () => {
    const txt = new File(['hello'], 'note.txt', { type: 'text/plain' })
    const map = await mgr.handleFiles([txt])
    // 过滤后无图片 → map 空
    expect(map.size).toBe(0)
    // 且 assets 表无新增
    expect(await storage.listAssets('pending')).toHaveLength(0)
  })

  it('getBlobUrl：解析已落库资产为 blob URL', async () => {
    const relPath = await mgr.saveImageFile('doc-1', makePngFile())
    const url = await mgr.getBlobUrl('doc-1', relPath)
    expect(url).toMatch(/^blob:/)
    // 不存在的资产返回空串
    expect(await mgr.getBlobUrl('doc-1', 'assets/nope.png')).toBe('')
  })

  it('resolveDocAssets：列出文档全部图片 blob URL 映射', async () => {
    await mgr.saveImageFile('doc-1', makePngFile('x.png'))
    await mgr.saveImageFile('doc-1', makePngFile('y.png'))
    const map = await mgr.resolveDocAssets('doc-1')
    expect(map.size).toBe(2)
    for (const url of map.values()) {
      expect(url).toMatch(/^blob:/)
    }
  })
})
