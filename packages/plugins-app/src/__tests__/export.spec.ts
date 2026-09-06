// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import JSZip from 'jszip'
import { DexieStorageProvider } from '@editor/infra'
import { buildDocZip } from '../export'

/**
 * Phase 2 —— 导出 zip 单测：
 * .md 原文 + assets/ 文件夹结构、T1 local/base64 打包、remote 跳过（R15）。
 */

describe('buildDocZip 导出 zip', () => {
  let storage: DexieStorageProvider

  beforeAll(() => {
    storage = new DexieStorageProvider()
  })
  afterAll(() => storage.dispose())

  beforeEach(async () => {
    const db = (storage as unknown as { db: { [k: string]: { clear: () => Promise<void> } } }).db
    await db.files.clear()
    await db.docs.clear()
    await db.assets.clear()
  })

  async function seedDoc() {
    const node = {
      id: 'doc-1', parentId: null as string | null, type: 'doc' as const,
      name: '我的文章', sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null,
    }
    await storage.createNode(node)
    await storage.saveDocContent({ id: 'doc-1', content: '# 标题\n\n![图](assets/pic.png)\n' })
    // T1 local 资产（Blob）
    await storage.putAsset({
      id: 'a1', docId: 'doc-1', relPath: 'assets/pic.png',
      mime: 'image/png', size: 4, tier: 'local',
      blob: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
      hash: 'h1', createdAt: 1,
    })
    // T2 remote 资产（图床，不打包）
    await storage.putAsset({
      id: 'a2', docId: 'doc-1', relPath: 'assets/remote.png',
      mime: 'image/png', size: 4, tier: 'remote',
      remoteUrl: 'https://img.example.com/x.png', hash: 'h2', createdAt: 1,
    })
    return node
  }

  it('zip 含 .md 原文 + assets/ 文件夹（内容正确）', async () => {
    await seedDoc()
    const zip = await buildDocZip(storage, 'doc-1')
    const names = Object.keys(zip.files)
    expect(names).toContain('我的文章.md')
    expect(names).toContain('assets/pic.png')
    // remote 资产被跳过
    expect(names).not.toContain('assets/remote.png')

    const md = await zip.file('我的文章.md')?.async('string')
    expect(md).toContain('# 标题')
    expect(md).toContain('assets/pic.png')
  })

  it('T1 base64 资产同样打包', async () => {
    await seedDoc()
    // 追加一个 base64 资产
    await storage.putAsset({
      id: 'a3', docId: 'doc-1', relPath: 'assets/base64.png',
      mime: 'image/png', size: 4, tier: 'base64',
      base64: 'iVBORw0KGgo=', hash: 'h3', createdAt: 1,
    })
    const zip = await buildDocZip(storage, 'doc-1')
    expect(Object.keys(zip.files)).toContain('assets/base64.png')
    const bytes = await zip.file('assets/base64.png')?.async('uint8array')
    expect(bytes?.length).toBeGreaterThan(0)
  })

  it('文档不存在时抛错', async () => {
    await expect(buildDocZip(storage, 'ghost')).rejects.toThrow(/不存在/)
  })
})
